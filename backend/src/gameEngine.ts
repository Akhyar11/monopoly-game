import { Room, Player, Tile, TradeOffer, BoardSkin } from './types';
import { createBoard } from './board';
import { getGameConfig } from './configStore';
import { getDbPool } from './db';
import { RowDataPacket } from 'mysql2/promise';
import { CardAction } from './types';
const AUCTION_MS = 30000;
const HOTEL_LEVEL = 5;

export class GameEngine {
  private rooms: Map<string, Room> = new Map();
  private decisionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private auctionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private debtTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private tradeTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private onStateChange?: (code: string, room: Room) => void,
    private onTradeStatus?: (code: string, playerId: string, data: { offerId: string; status: 'accepted' | 'rejected' | 'expired' | 'sent'; message: string }) => void,
    private onSfxPlay?: (code: string, sfxKey: string) => void,
  ) {}

  createRoom(hostId: string, hostName: string, avatar: string, boardTemplate?: Tile[], skin?: BoardSkin | null, sfx?: Record<string, string>): { code: string; room: Room } {
    const code = this.generateRoomCode();
    const board = boardTemplate ? boardTemplate.map(t => ({...t})) : createBoard();
    const room: Room = {
      id: `room_${code}`,
      code,
      hostPlayerId: hostId,
      status: 'waiting',
      players: [this.createPlayer(hostId, hostName, avatar)],
      board,
      skin: skin || null,
      sfx: sfx,
      eventLog: [`Room created by ${hostName}`],
      createdAt: Date.now(),
      tradeOffers: [],
    };

    this.rooms.set(code, room);
    return { code, room };
  }

  joinRoom(code: string, playerId: string, playerName: string, avatar: string): { success: boolean; room?: Room; message?: string } {
    const room = this.rooms.get(code);
    if (!room) return { success: false, message: 'Room not found' };

    const existingPlayer = room.players.find((p) => p.id === playerId);
    if (existingPlayer) {
      existingPlayer.isConnected = true;
      if (room.status === 'waiting') {
        existingPlayer.status = 'ready';
      }
      return { success: true, room };
    }

    if (room.status !== 'waiting') return { success: false, message: 'Game already started' };
    if (room.players.length >= 4) return { success: false, message: 'Room is full' };

    room.players.push(this.createPlayer(playerId, playerName, avatar));
    this.addEventLog(room, `${playerName} joined the room`);
    return { success: true, room };
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  getRoomByPlayerId(playerId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.id === playerId)) {
        return room;
      }
    }
    return undefined;
  }

  startGame(code: string, playerId: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;
    if (room.hostPlayerId !== playerId) return false;
    if (room.players.length < 2) return false;

    room.status = 'playing';
    room.gameStartedAt = Date.now();
    this.addEventLog(room, 'Game started!');
    return true;
  }

  disconnectPlayer(playerId: string) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room) return undefined;

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return room;

    player.isConnected = false;
    this.addEventLog(room, `${player.name} disconnected`);
    this.checkRoundReset(room);
    this.emitState(room.code);
    return room;
  }

  async rollDice(code: string, playerId: string): Promise<{ room?: Room; success: boolean; dice1?: number; dice2?: number; message?: string; tile?: Tile; cardDrawn?: { title: string; message: string } }> {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing') return { success: false, message: 'Invalid game state' };

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: 'Player not found' };
    if (!['ready', 'cooldown'].includes(player.status) || player.debtDeadline) {
      return { success: false, message: 'Cannot roll right now' };
    }
    if (player.cooldownUntil && Date.now() < player.cooldownUntil) {
      return { success: false, message: 'Still in cooldown' };
    }
    if (player.rollsLeft <= 0) {
      return { success: false, message: 'Waiting for other players to roll' };
    }

    player.rollsLeft -= 1;
    player.status = 'moving';
    player.cooldownUntil = null;

    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const roll = dice1 + dice2;
    const isDoubles = dice1 === dice2;

    this.addEventLog(room, `${player.name} rolled ${roll}${isDoubles ? ' (doubles!)' : ''}`);

    // Handle consecutive doubles
    if (isDoubles) {
      player.consecutiveDoubles = (player.consecutiveDoubles || 0) + 1;

      if (player.consecutiveDoubles >= 3) {
        // Third double in a row: send to jail
        this.addEventLog(room, `${player.name} rolled doubles 3 times and went to jail!`);
        const jailIdx = room.board.findIndex((boardTile) => boardTile.type === 'jail');
        player.position = jailIdx !== -1 ? jailIdx : 10;
        player.status = 'jailed';
        player.consecutiveDoubles = 0;
        this.checkRoundReset(room);
        return { success: true, room, dice1, dice2, tile: room.board[player.position], message: 'Rolled doubles 3 times - sent to jail!' };
      }

      // Less than 3 doubles: get another roll
      player.rollsLeft += 1; // Negate the decrement from above, so they get a free roll
      this.addEventLog(room, `${player.name} gets another roll!`);
    } else {
      // Non-doubles: reset consecutive doubles counter
      player.consecutiveDoubles = 0;
    }

    const oldPosition = player.position;
    player.position = (oldPosition + roll) % room.board.length;

    if (player.position < oldPosition) {
      const config = getGameConfig();
      player.balance += config.passGoReward;
      this.addEventLog(room, `${player.name} passed GO and collected ${config.passGoReward}`);
      this.onSfxPlay?.(room.code, 'passGo');
    }

    const currentTile = room.board[player.position];
    const { cardDrawn } = await this.resolveTileAction(room, player, currentTile, roll);

    // Apply cooldown only if not doubles and not in special state
    if (!['resolving_tile', 'jailed', 'auction', 'in_debt'].includes(player.status)) {
      if (isDoubles) {
        player.status = 'ready';
        player.cooldownUntil = null;
      } else {
        this.setCooldown(player);
      }
    }

    this.checkWinCondition(room);
    this.checkRoundReset(room);

    return { success: true, room, dice1, dice2, tile: currentTile, cardDrawn };
  }

  buyProperty(code: string, playerId: string, tileId: string, decision: 'buy' | 'skip'): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;

    const player = room.players.find((p) => p.id === playerId);
    if (!player || player.status !== 'resolving_tile') return undefined;

    const tile = room.board.find((t) => t.id === tileId);
    const timeout = this.decisionTimeouts.get(playerId);
    if (timeout) {
      clearTimeout(timeout);
      this.decisionTimeouts.delete(playerId);
    }

    if (!tile || tile.ownerPlayerId) {
      if (player.consecutiveDoubles && player.consecutiveDoubles > 0) {
        player.status = 'ready';
        player.cooldownUntil = null;
      } else {
        this.setCooldown(player);
      }
      return room;
    }

    if (decision === 'buy') {
      if (player.balance >= (tile.price || 0)) {
        player.balance -= tile.price || 0;
        tile.ownerPlayerId = player.id;
        player.properties.push(tile.id);
        this.addEventLog(room, `${player.name} bought ${tile.name} for ${tile.price}`);
        this.onSfxPlay?.(room.code, 'buyProperty');
      } else {
        this.addEventLog(room, `${player.name} could not afford ${tile.name}`);
      }
    } else {
      this.addEventLog(room, `${player.name} skipped buying ${tile.name}`);
    }

    if (player.balance < 0) {
      this.enterDebtState(room, player);
    } else {
      if (player.consecutiveDoubles && player.consecutiveDoubles > 0) {
        player.status = 'ready';
        player.cooldownUntil = null;
      } else {
        this.setCooldown(player);
      }
    }

    this.checkRoundReset(room);
    return room;
  }

  payJailFee(code: string, playerId: string): Room | undefined {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing') return undefined;
    const config = getGameConfig();

    const player = room.players.find((p) => p.id === playerId);
    if (!player || player.status !== 'jailed') return undefined;
    if (player.balance < config.jailFee) return room;

    player.balance -= config.jailFee;
    player.status = 'ready';
    this.addEventLog(room, `${player.name} paid $${config.jailFee} to get out of jail!`);
    this.checkRoundReset(room);
    return room;
  }

  placeBid(code: string, playerId: string, amount: number): Room | undefined {
    const room = this.rooms.get(code);
    if (!room || !room.auction) return undefined;

    const player = room.players.find((p) => p.id === playerId);
    if (!player || !room.auction.participants.includes(playerId)) return undefined;
    if (amount <= room.auction.currentBid || player.balance < amount) return room;

    room.auction.currentBid = amount;
    room.auction.highestBidderId = playerId;
    this.addEventLog(room, `${player.name} bid $${amount}`);

    const remaining = room.auction.expiresAt - Date.now();
    if (remaining < 5000) {
      room.auction.expiresAt = Date.now() + 5000;
      const oldTimer = this.auctionTimeouts.get(code);
      if (oldTimer) clearTimeout(oldTimer);
      const newTimer = setTimeout(() => {
        this.resolveAuction(code);
        this.emitState(code);
      }, 5000);
      this.auctionTimeouts.set(code, newTimer);
    }

    return room;
  }

  buildProperty(code: string, playerId: string, tileId: string): { room?: Room; success: boolean; message?: string } {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing') return { success: false, message: 'Invalid game state' };

    const player = room.players.find((p) => p.id === playerId);
    const tile = room.board.find((t) => t.id === tileId);
    if (!player || !tile) return { success: false, message: 'Invalid build target' };
    if (this.isDebtLocked(player)) return { success: false, message: 'Resolve debt before building' };
    if (tile.ownerPlayerId !== player.id) return { success: false, message: 'You do not own this property' };
    if (tile.type !== 'property' || !tile.colorGroup) return { success: false, message: 'Only color properties can be upgraded' };
    if (tile.isMortgaged) return { success: false, message: 'Redeem the property before building' };
    if (!this.playerOwnsFullColorSet(room, player.id, tile.colorGroup)) return { success: false, message: 'Own the full color set first' };
    if (this.colorGroupHasMortgage(room, player.id, tile.colorGroup)) return { success: false, message: 'Redeem all mortgaged properties in this color set first' };
    if ((tile.buildingLevel || 0) >= HOTEL_LEVEL) return { success: false, message: 'This property already has a hotel' };
    if (!this.canBuildEvenly(room, player.id, tile)) return { success: false, message: 'Build evenly across this color set first' };
    const isBuildingHotel = (tile.buildingLevel || 0) === HOTEL_LEVEL - 1;
    const cost = isBuildingHotel && tile.hotelCost !== undefined ? tile.hotelCost : (tile.houseCost || 0);

    if (player.balance < cost) return { success: false, message: 'Not enough cash to build' };

    tile.buildingLevel = (tile.buildingLevel || 0) + 1;
    player.balance -= cost;
    this.addEventLog(
      room,
      `${player.name} built ${tile.buildingLevel === HOTEL_LEVEL ? 'a hotel' : `house #${tile.buildingLevel}`} on ${tile.name} for $${cost}`,
    );

    return { room, success: true };
  }

  sellBuilding(code: string, playerId: string, tileId: string): { room?: Room; success: boolean; message?: string } {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing') return { success: false, message: 'Invalid game state' };

    const player = room.players.find((p) => p.id === playerId);
    const tile = room.board.find((t) => t.id === tileId);
    if (!player || !tile) return { success: false, message: 'Invalid sell target' };
    if (tile.ownerPlayerId !== player.id) return { success: false, message: 'You do not own this property' };
    if (tile.type !== 'property' || !tile.colorGroup) return { success: false, message: 'Only color properties have buildings to sell' };
    if ((tile.buildingLevel || 0) <= 0) return { success: false, message: 'There are no buildings to sell here' };
    if (!this.canSellEvenly(room, player.id, tile)) return { success: false, message: 'Sell evenly across this color set first' };

    const isSellingHotel = (tile.buildingLevel || 0) === HOTEL_LEVEL;
    const cost = isSellingHotel && tile.hotelCost !== undefined ? tile.hotelCost : (tile.houseCost || 0);

    tile.buildingLevel = Math.max(0, (tile.buildingLevel || 0) - 1);
    const sellValue = Math.floor(cost / 2);
    player.balance += sellValue;
    this.addEventLog(
      room,
      `${player.name} sold ${tile.buildingLevel >= 4 ? 'a hotel level' : 'a building'} from ${tile.name} for $${sellValue}`,
    );

    if (player.status === 'in_debt' && player.balance >= 0) {
      this.resolveDebt(room, player);
    }

    return { room, success: true };
  }

  mortgageProperty(code: string, playerId: string, tileId: string): { room?: Room; success: boolean; message?: string } {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing') return { success: false, message: 'Invalid game state' };

    const player = room.players.find((p) => p.id === playerId);
    const tile = room.board.find((t) => t.id === tileId);
    if (!player || !tile) return { success: false, message: 'Invalid mortgage target' };
    if (tile.ownerPlayerId !== player.id) return { success: false, message: 'You do not own this property' };
    if (tile.isMortgaged) return { success: false, message: 'Property is already mortgaged' };
    if ((tile.buildingLevel || 0) > 0) return { success: false, message: 'Sell buildings first before mortgaging' };

    const mortgageValue = this.getMortgageValue(tile);
    tile.isMortgaged = true;
    player.balance += mortgageValue;
    this.addEventLog(room, `${player.name} mortgaged ${tile.name} for $${mortgageValue}`);

    if (player.status === 'in_debt' && player.balance >= 0) {
      this.resolveDebt(room, player);
    }

    return { room, success: true };
  }

  redeemProperty(code: string, playerId: string, tileId: string): { room?: Room; success: boolean; message?: string } {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing') return { success: false, message: 'Invalid game state' };

    const player = room.players.find((p) => p.id === playerId);
    const tile = room.board.find((t) => t.id === tileId);
    if (!player || !tile) return { success: false, message: 'Invalid redeem target' };
    if (this.isDebtLocked(player) && player.balance < this.getRedeemCost(tile)) {
      return { success: false, message: 'Use sell or mortgage actions to escape debt first' };
    }
    if (tile.ownerPlayerId !== player.id) return { success: false, message: 'You do not own this property' };
    if (!tile.isMortgaged) return { success: false, message: 'Property is not mortgaged' };

    const redeemCost = this.getRedeemCost(tile);
    if (player.balance < redeemCost) return { success: false, message: 'Not enough cash to redeem' };

    player.balance -= redeemCost;
    tile.isMortgaged = false;
    this.addEventLog(room, `${player.name} redeemed ${tile.name} for $${redeemCost}`);
    return { room, success: true };
  }

  sendTradeOffer(
    code: string,
    fromPlayerId: string,
    data: { toPlayerId: string; offeredPropertyIds: string[]; requestedPropertyIds: string[]; offeredCash: number; requestedCash: number },
  ): { room?: Room; success: boolean; message?: string; offer?: TradeOffer } {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing') return { success: false, message: 'Invalid game state' };

    const fromPlayer = room.players.find((p) => p.id === fromPlayerId);
    const toPlayer = room.players.find((p) => p.id === data.toPlayerId);
    if (!fromPlayer || !toPlayer || fromPlayer.id === toPlayer.id) return { success: false, message: 'Invalid trade target' };
    if (fromPlayer.status === 'bankrupt' || toPlayer.status === 'bankrupt') return { success: false, message: 'Bankrupt players cannot trade' };
    if (this.isDebtLocked(fromPlayer) || this.isDebtLocked(toPlayer)) return { success: false, message: 'Resolve debt before trading' };

    const offeredPropertyIds = [...new Set(data.offeredPropertyIds)];
    const requestedPropertyIds = [...new Set(data.requestedPropertyIds)];
    const offeredCash = Math.max(0, Math.floor(data.offeredCash));
    const requestedCash = Math.max(0, Math.floor(data.requestedCash));

    if (offeredPropertyIds.length === 0 && requestedPropertyIds.length === 0 && offeredCash === 0 && requestedCash === 0) {
      return { success: false, message: 'Trade offer cannot be empty' };
    }

    if (offeredCash > fromPlayer.balance) return { success: false, message: 'Not enough cash for this offer' };
    if (requestedCash > toPlayer.balance) return { success: false, message: 'Target player cannot afford requested cash' };
    if (!this.playerOwnsTiles(fromPlayer, room, offeredPropertyIds) || !this.playerOwnsTiles(toPlayer, room, requestedPropertyIds)) {
      return { success: false, message: 'Trade includes properties that are no longer owned' };
    }

    const offer: TradeOffer = {
      id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fromPlayerId,
      toPlayerId: toPlayer.id,
      offeredPropertyIds,
      requestedPropertyIds,
      offeredCash,
      requestedCash,
      expiresAt: Date.now() + getGameConfig().tradeExpiryMs,
    };

    room.tradeOffers
      .filter((existing) => existing.fromPlayerId === fromPlayerId && existing.toPlayerId === toPlayer.id)
      .forEach((existing) => this.clearTradeOffer(room, existing.id));

    room.tradeOffers.push(offer);
    this.addEventLog(room, `${fromPlayer.name} sent a trade offer to ${toPlayer.name}`);
    this.scheduleTradeOfferExpiry(room, offer);

    return { room, success: true, offer };
  }

  respondTradeOffer(code: string, playerId: string, offerId: string, decision: 'accept' | 'reject'): { room?: Room; success: boolean; message?: string } {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing') return { success: false, message: 'Invalid game state' };

    const offer = room.tradeOffers.find((item) => item.id === offerId);
    if (!offer) return { success: false, message: 'Trade offer not found' };
    if (offer.toPlayerId !== playerId) return { success: false, message: 'You cannot respond to this offer' };

    const fromPlayer = room.players.find((p) => p.id === offer.fromPlayerId);
    const toPlayer = room.players.find((p) => p.id === offer.toPlayerId);
    if (!fromPlayer || !toPlayer) return { success: false, message: 'Trade players not found' };
    if (this.isDebtLocked(fromPlayer) || this.isDebtLocked(toPlayer)) {
      return { success: false, message: 'Resolve debt before completing a trade' };
    }

    this.clearTradeOffer(room, offerId);

    if (decision === 'reject') {
      this.addEventLog(room, `${toPlayer.name} rejected ${fromPlayer.name}'s trade offer`);
      this.onTradeStatus?.(code, fromPlayer.id, {
        offerId,
        status: 'rejected',
        message: `${toPlayer.name} rejected your trade offer.`,
      });
      this.onTradeStatus?.(code, toPlayer.id, {
        offerId,
        status: 'rejected',
        message: `You rejected ${fromPlayer.name}'s trade offer.`,
      });
      return { room, success: true };
    }

    if (!this.playerOwnsTiles(fromPlayer, room, offer.offeredPropertyIds) || !this.playerOwnsTiles(toPlayer, room, offer.requestedPropertyIds)) {
      return { success: false, message: 'A traded property changed hands before acceptance' };
    }
    if (fromPlayer.balance < offer.offeredCash || toPlayer.balance < offer.requestedCash) {
      return { success: false, message: 'One player no longer has the required cash' };
    }

    fromPlayer.balance -= offer.offeredCash;
    toPlayer.balance += offer.offeredCash;
    toPlayer.balance -= offer.requestedCash;
    fromPlayer.balance += offer.requestedCash;

    this.transferProperties(room, fromPlayer, toPlayer, offer.offeredPropertyIds);
    this.transferProperties(room, toPlayer, fromPlayer, offer.requestedPropertyIds);

    this.addEventLog(room, `${toPlayer.name} accepted ${fromPlayer.name}'s trade offer`);
    this.onTradeStatus?.(code, fromPlayer.id, {
      offerId,
      status: 'accepted',
      message: `${toPlayer.name} accepted your trade offer.`,
    });
    this.onTradeStatus?.(code, toPlayer.id, {
      offerId,
      status: 'accepted',
      message: `You accepted ${fromPlayer.name}'s trade offer.`,
    });
    return { room, success: true };
  }

  endGame(code: string, playerId: string): Room | undefined {
    const room = this.rooms.get(code);
    if (!room || room.hostPlayerId !== playerId) return undefined;

    room.status = 'ended';
    let maxBalance = -Infinity;
    let winnerId: string | undefined;

    room.players.forEach((player) => {
      if (player.status !== 'bankrupt' && player.balance > maxBalance) {
        maxBalance = player.balance;
        winnerId = player.id;
      }
    });

    if (winnerId) {
      room.winnerId = winnerId;
      const winner = room.players.find((player) => player.id === winnerId);
      this.addEventLog(room, `Game ended by host. ${winner?.name} won with $${maxBalance}!`);
    }

    return room;
  }

  adminBroadcast(code: string, message: string): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;

    this.addEventLog(room, `[ADMIN] ${message}`);
    return room;
  }

  adminEndGame(code: string, reason = 'Ended by admin'): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;

    room.status = 'ended';
    let maxBalance = -Infinity;
    let winnerId: string | undefined;

    room.players.forEach((player) => {
      if (player.status !== 'bankrupt' && player.balance > maxBalance) {
        maxBalance = player.balance;
        winnerId = player.id;
      }
    });

    if (winnerId) {
      room.winnerId = winnerId;
    }

    this.addEventLog(room, `[ADMIN] ${reason}`);
    return room;
  }

  adminSetPlayerBalance(playerId: string, balance: number): Room | undefined {
    const room = this.getRoomByPlayerId(playerId);
    if (!room) return undefined;

    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) return room;

    player.balance = Math.floor(balance);
    if (player.balance >= 0 && player.status === 'in_debt') {
      this.resolveDebt(room, player);
    } else if (player.balance < 0) {
      this.enterDebtState(room, player);
    }

    this.addEventLog(room, `[ADMIN] ${player.name}'s balance set to $${player.balance}`);
    this.checkWinCondition(room);
    this.checkRoundReset(room);
    return room;
  }

  adminReleaseFromJail(playerId: string): Room | undefined {
    const room = this.getRoomByPlayerId(playerId);
    if (!room) return undefined;

    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) return room;

    player.status = 'ready';
    player.cooldownUntil = null;
    player.debtDeadline = null;
    this.addEventLog(room, `[ADMIN] ${player.name} was released from jail`);
    return room;
  }

  adminResetCooldown(playerId: string): Room | undefined {
    const room = this.getRoomByPlayerId(playerId);
    if (!room) return undefined;

    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) return room;

    player.status = 'ready';
    player.cooldownUntil = null;
    player.rollsLeft = Math.max(player.rollsLeft, 1);
    this.addEventLog(room, `[ADMIN] ${player.name}'s cooldown was reset`);
    return room;
  }

  adminSetBankrupt(playerId: string): Room | undefined {
    const room = this.getRoomByPlayerId(playerId);
    if (!room) return undefined;

    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) return room;

    this.bankruptPlayer(room, player);
    this.addEventLog(room, `[ADMIN] ${player.name} was forced into bankruptcy`);
    return room;
  }

  adminKickPlayer(playerId: string): Room | undefined {
    const room = this.getRoomByPlayerId(playerId);
    if (!room) return undefined;

    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) return room;

    player.isConnected = false;
    player.status = 'disconnected';
    player.cooldownUntil = null;
    player.debtDeadline = null;
    this.addEventLog(room, `[ADMIN] ${player.name} was kicked from the room`);
    this.checkWinCondition(room);
    this.checkRoundReset(room);
    return room;
  }

  private createPlayer(id: string, name: string, avatar: string): Player {
    return {
      id,
      name,
      avatar,
      balance: getGameConfig().initialBalance,
      position: 0,
      properties: [],
      status: 'ready',
      isConnected: true,
      cooldownUntil: null,
      rollsLeft: 2,
      debtDeadline: null,
      consecutiveDoubles: 0,
    };
  }
  private async resolveTileAction(room: Room, player: Player, tile: Tile, rollTotal: number): Promise<{ cardDrawn?: { title: string; message: string } }> {
    let cardDrawn: { title: string; message: string } | undefined;

    switch (tile.type) {
      case 'property':
      case 'railroad':
      case 'utility':
        if (!tile.ownerPlayerId) {
          this.handleUnownedPurchasableTile(room, player, tile);
        } else if (tile.ownerPlayerId !== player.id) {
          const owner = room.players.find((p) => p.id === tile.ownerPlayerId);
          if (owner) {
            const rent = this.calculateRent(room, tile, rollTotal);
            if (rent > 0) {
              player.balance -= rent;
              owner.balance += rent;
              this.addEventLog(room, `${player.name} paid ${rent} rent to ${owner.name} for ${tile.name}`);
              this.onSfxPlay?.(room.code, 'payRent');
              this.evaluateSolvency(room, player);
            } else {
              this.addEventLog(room, `${player.name} landed on mortgaged ${tile.name}. No rent charged.`);
            }
          }
        }
        break;
      case 'tax':
        player.balance -= tile.taxAmount || 100;
        this.addEventLog(room, `${player.name} paid ${tile.taxAmount} for ${tile.name}`);
        this.evaluateSolvency(room, player);
        break;
      case 'gotojail':
        player.position = room.board.findIndex((boardTile) => boardTile.type === 'jail');
        player.status = 'jailed';
        this.addEventLog(room, `${player.name} went to jail! (Must pay $${getGameConfig().jailFee} or wait for round reset)`);
        this.onSfxPlay?.(room.code, 'jail');
        break;
      case 'chance':
      case 'chest': {
        const type = tile.type === 'chest' ? 'community_chest' : 'chance';
        try {
          const db = getDbPool();
          const [rows] = await db.query<RowDataPacket[]>(`
            SELECT title, message, action_json 
            FROM game_cards 
            WHERE type = ? 
            ORDER BY RAND() 
            LIMIT 1
          `, [type]);

          if (rows.length > 0) {
            const card = rows[0];
            const action = JSON.parse(card.action_json) as CardAction;
            cardDrawn = { title: card.title, message: card.message };
            this.onSfxPlay?.(room.code, 'cardDrawn');
            
            const targetType = action.target || 'self';
            const targets = targetType === 'everyone' ? room.players : 
                            targetType === 'all_others' ? room.players.filter(p => p.id !== player.id) : 
                            [player];

            if (action.type === 'money') {
              if (targetType === 'all_others') {
                const amt = action.amount || 0;
                let totalExchanged = 0;
                for (const p of targets) {
                  p.balance -= amt;
                  totalExchanged += amt;
                  if (amt > 0) this.evaluateSolvency(room, p);
                }
                player.balance += totalExchanged;
                this.addEventLog(room, `${player.name} drew: ${card.title}. Exchanged $${Math.abs(amt)} with each player.`);
                if (totalExchanged < 0) this.evaluateSolvency(room, player);
              } else {
                for (const p of targets) {
                  p.balance += action.amount || 0;
                  if ((action.amount || 0) < 0) this.evaluateSolvency(room, p);
                }
                if (targetType === 'everyone') {
                  this.addEventLog(room, `Everyone affected by ${card.title}. (Money change: $${action.amount})`);
                } else {
                  this.addEventLog(room, `${player.name} drew a card: ${card.title}. (Money change: $${action.amount})`);
                }
              }
            } else if (action.type === 'move') {
              for (const p of targets) {
                if (action.position !== undefined) {
                   p.position = action.position;
                } else if (action.relativePosition !== undefined) {
                   p.position = (p.position + action.relativePosition + room.board.length) % room.board.length;
                }
                const newTile = room.board[p.position];
                if (newTile.type !== 'chance' && newTile.type !== 'chest') {
                   await this.resolveTileAction(room, p, newTile, rollTotal);
                }
              }
              if (targetType === 'everyone') {
                this.addEventLog(room, `Everyone moved due to ${card.title}.`);
              } else if (targetType === 'all_others') {
                this.addEventLog(room, `Everyone else moved due to ${card.title}.`);
              } else {
                this.addEventLog(room, `${player.name} drew a card: ${card.title}. Moved to tile ${player.position}`);
              }
            } else if (action.type === 'jail') {
               for (const p of targets) {
                 p.position = room.board.findIndex((boardTile) => boardTile.type === 'jail');
                 p.status = 'jailed';
               }
               if (targetType === 'everyone') {
                 this.addEventLog(room, `Everyone went to jail due to ${card.title}!`);
               } else if (targetType === 'all_others') {
                 this.addEventLog(room, `Everyone else went to jail due to ${card.title}!`);
               } else {
                 this.addEventLog(room, `${player.name} drew a card: ${card.title}. Went to jail!`);
               }
            }
          } else {
             const gain = Math.random() < 0.5;
             const amount = 50;
             if (gain) {
               player.balance += amount;
               cardDrawn = { title: tile.name, message: 'You found $50!' };
               this.addEventLog(room, `${player.name} found 50 in ${tile.name}`);
             } else {
               player.balance -= amount;
               cardDrawn = { title: tile.name, message: 'You lost $50!' };
               this.addEventLog(room, `${player.name} lost 50 in ${tile.name}`);
               this.evaluateSolvency(room, player);
             }
          }
        } catch (e) {
          console.error('Failed to draw card:', e);
        }
        break;
      }
      default:
        break;
    }

    return { cardDrawn };
  }

  private handleUnownedPurchasableTile(room: Room, player: Player, tile: Tile) {
    if (room.auction && room.auction.tileId === tile.id) {
      player.status = 'auction';
      if (!room.auction.participants.includes(player.id)) {
        room.auction.participants.push(player.id);
        this.addEventLog(room, `${player.name} joined the auction for ${tile.name}!`);
      }
      return;
    }

    const othersResolving = room.players.filter(
      (other) => other.id !== player.id && other.status === 'resolving_tile' && other.position === tile.index,
    );

    if (othersResolving.length > 0) {
      othersResolving.forEach((other) => {
        const timeout = this.decisionTimeouts.get(other.id);
        if (timeout) clearTimeout(timeout);
        this.decisionTimeouts.delete(other.id);
      });

      player.status = 'auction';
      room.auction = {
        tileId: tile.id,
        participants: [player.id, ...othersResolving.map((other) => other.id)],
        currentBid: 10,
        highestBidderId: null,
        expiresAt: Date.now() + AUCTION_MS,
      };

      const timer = setTimeout(() => {
        this.resolveAuction(room.code);
        this.emitState(room.code);
      }, AUCTION_MS);

      this.auctionTimeouts.set(room.code, timer);
      this.addEventLog(room, `Conflict! Auction started for ${tile.name}!`);
      return;
    }

    player.status = 'resolving_tile';
    const timeout = setTimeout(() => {
      this.autoSkipProperty(room.code, player.id);
      this.emitState(room.code);
    }, getGameConfig().propertyDecisionMs);
    this.decisionTimeouts.set(player.id, timeout);
  }

  private autoSkipProperty(code: string, playerId: string) {
    const room = this.rooms.get(code);
    if (!room) return;

    const player = room.players.find((item) => item.id === playerId);
    if (!player || player.status !== 'resolving_tile') return;

    const tile = room.board[player.position];
    if (tile) {
      this.buyProperty(code, playerId, tile.id, 'skip');
    }
  }

  private resolveAuction(code: string) {
    const room = this.rooms.get(code);
    if (!room || !room.auction) return;

    const auction = room.auction;
    const tile = room.board.find((boardTile) => boardTile.id === auction.tileId);

    if (auction.highestBidderId) {
      const winner = room.players.find((player) => player.id === auction.highestBidderId);
      if (winner && tile && winner.balance >= auction.currentBid) {
        winner.balance -= auction.currentBid;
        winner.properties.push(tile.id);
        tile.ownerPlayerId = winner.id;
        this.addEventLog(room, `${winner.name} won the auction for ${tile.name} at $${auction.currentBid}!`);
      } else {
        this.addEventLog(room, `Auction for ${tile?.name} could not be completed.`);
      }
    } else {
      this.addEventLog(room, `Auction for ${tile?.name} ended with no bids.`);
    }

    room.players.forEach((player) => {
      if (player.status === 'auction') {
        this.setCooldown(player);
      }
    });

    const timer = this.auctionTimeouts.get(code);
    if (timer) clearTimeout(timer);
    this.auctionTimeouts.delete(code);
    room.auction = undefined;
    this.checkRoundReset(room);
  }

  private calculateRent(room: Room, tile: Tile, rollTotal?: number): number {
    if (tile.isMortgaged) return 0;

    const baseRent = tile.rent || 0;
    if (tile.type === 'railroad') {
      const ownedRailroads = room.board.filter(
        (boardTile) => boardTile.type === 'railroad' && boardTile.ownerPlayerId === tile.ownerPlayerId && !boardTile.isMortgaged,
      ).length;
      return baseRent * Math.max(1, ownedRailroads);
    }

    if (tile.type === 'utility') {
      const ownedUtilities = room.board.filter(
        (boardTile) => boardTile.type === 'utility' && boardTile.ownerPlayerId === tile.ownerPlayerId && !boardTile.isMortgaged,
      ).length;
      const multiplier = ownedUtilities >= 2 ? 10 : 4;
      return (rollTotal || 0) * multiplier;
    }

    if (tile.type !== 'property' || !tile.colorGroup) return baseRent;

    const buildingLevel = tile.buildingLevel || 0;
    if (buildingLevel > 0) {
      if (buildingLevel === 1 && tile.rent1House !== undefined) return tile.rent1House;
      if (buildingLevel === 2 && tile.rent2Houses !== undefined) return tile.rent2Houses;
      if (buildingLevel === 3 && tile.rent3Houses !== undefined) return tile.rent3Houses;
      if (buildingLevel === 4 && tile.rent4Houses !== undefined) return tile.rent4Houses;
      if (buildingLevel === 5 && tile.rentHotel !== undefined) return tile.rentHotel;

      const multipliers = [5, 15, 45, 80, 125];
      return baseRent * multipliers[Math.min(buildingLevel, HOTEL_LEVEL) - 1];
    }

    return this.playerOwnsFullColorSet(room, tile.ownerPlayerId || '', tile.colorGroup) && !this.colorGroupHasMortgage(room, tile.ownerPlayerId || '', tile.colorGroup)
      ? baseRent * 2
      : baseRent;
  }

  private playerOwnsFullColorSet(room: Room, playerId: string, colorGroup: string): boolean {
    const groupTiles = room.board.filter((tile) => tile.colorGroup === colorGroup);
    return groupTiles.length > 1 && groupTiles.every((tile) => tile.ownerPlayerId === playerId);
  }

  private colorGroupHasMortgage(room: Room, playerId: string, colorGroup: string): boolean {
    return room.board.some(
      (tile) => tile.colorGroup === colorGroup && tile.ownerPlayerId === playerId && tile.isMortgaged,
    );
  }

  private canBuildEvenly(room: Room, playerId: string, tile: Tile): boolean {
    if (!tile.colorGroup) return false;
    const groupTiles = room.board.filter(
      (boardTile) => boardTile.colorGroup === tile.colorGroup && boardTile.ownerPlayerId === playerId,
    );
    const currentLevel = tile.buildingLevel || 0;
    return groupTiles.every((groupTile) => (groupTile.buildingLevel || 0) >= currentLevel);
  }

  private canSellEvenly(room: Room, playerId: string, tile: Tile): boolean {
    if (!tile.colorGroup) return false;
    const groupTiles = room.board.filter(
      (boardTile) => boardTile.colorGroup === tile.colorGroup && boardTile.ownerPlayerId === playerId,
    );
    const currentLevel = tile.buildingLevel || 0;
    return groupTiles.every((groupTile) => (groupTile.buildingLevel || 0) <= currentLevel);
  }

  private getMortgageValue(tile: Tile): number {
    return Math.floor((tile.price || 0) / 2);
  }

  private getRedeemCost(tile: Tile): number {
    return Math.ceil(this.getMortgageValue(tile) * 1.1);
  }

  private playerOwnsTiles(player: Player, room: Room, tileIds: string[]): boolean {
    return tileIds.every((tileId) => {
      const tile = room.board.find((boardTile) => boardTile.id === tileId);
      return tile?.ownerPlayerId === player.id;
    });
  }

  private transferProperties(room: Room, fromPlayer: Player, toPlayer: Player, tileIds: string[]) {
    tileIds.forEach((tileId) => {
      const tile = room.board.find((boardTile) => boardTile.id === tileId);
      if (!tile) return;

      fromPlayer.properties = fromPlayer.properties.filter((ownedId) => ownedId !== tileId);
      if (!toPlayer.properties.includes(tileId)) {
        toPlayer.properties.push(tileId);
      }
      tile.ownerPlayerId = toPlayer.id;
    });
  }

  private evaluateSolvency(room: Room, player: Player) {
    if (player.balance >= 0) return;
    this.enterDebtState(room, player);
  }

  private isDebtLocked(player: Player): boolean {
    return player.status === 'in_debt' || (player.debtDeadline || 0) > Date.now();
  }

  private enterDebtState(room: Room, player: Player) {
    if (player.status === 'bankrupt') return;

    const mortgageableTiles = room.board.filter(
      (tile) => tile.ownerPlayerId === player.id && !tile.isMortgaged && (tile.buildingLevel || 0) === 0,
    );

    if (mortgageableTiles.length === 0) {
      this.bankruptPlayer(room, player);
      return;
    }

    const existing = this.debtTimeouts.get(player.id);
    if (existing) clearTimeout(existing);

    player.status = 'in_debt';
    player.cooldownUntil = null;
    const debtDecisionMs = getGameConfig().debtDecisionMs;
    player.debtDeadline = Date.now() + debtDecisionMs;
    this.addEventLog(room, `${player.name} is in debt. Mortgage property within ${Math.ceil(debtDecisionMs / 1000)} seconds or go bankrupt.`);

    const timer = setTimeout(() => {
      const activeRoom = this.rooms.get(room.code);
      if (!activeRoom) return;
      const activePlayer = activeRoom.players.find((item) => item.id === player.id);
      if (!activePlayer) return;

      if (activePlayer.balance < 0) {
        this.bankruptPlayer(activeRoom, activePlayer);
      } else {
        this.resolveDebt(activeRoom, activePlayer);
      }
      this.emitState(activeRoom.code);
    }, debtDecisionMs);

    this.debtTimeouts.set(player.id, timer);
  }

  private resolveDebt(room: Room, player: Player) {
    const timer = this.debtTimeouts.get(player.id);
    if (timer) clearTimeout(timer);
    this.debtTimeouts.delete(player.id);

    player.debtDeadline = null;
    if (player.consecutiveDoubles && player.consecutiveDoubles > 0) {
      player.status = 'ready';
      player.cooldownUntil = null;
    } else {
      this.setCooldown(player);
    }
    this.addEventLog(room, `${player.name} escaped bankruptcy.`);
    this.checkRoundReset(room);
  }

  private bankruptPlayer(room: Room, player: Player) {
    const debtTimer = this.debtTimeouts.get(player.id);
    if (debtTimer) clearTimeout(debtTimer);
    this.debtTimeouts.delete(player.id);

    const decisionTimer = this.decisionTimeouts.get(player.id);
    if (decisionTimer) clearTimeout(decisionTimer);
    this.decisionTimeouts.delete(player.id);

    player.status = 'bankrupt';
    player.debtDeadline = null;
    player.cooldownUntil = null;

    player.properties.forEach((propertyId) => {
      const tile = room.board.find((boardTile) => boardTile.id === propertyId);
      if (!tile) return;
      tile.ownerPlayerId = null;
      tile.isMortgaged = false;
      tile.buildingLevel = 0;
    });
    player.properties = [];

    room.tradeOffers
      .filter((offer) => offer.fromPlayerId === player.id || offer.toPlayerId === player.id)
      .forEach((offer) => this.clearTradeOffer(room, offer.id));

    this.addEventLog(room, `${player.name} went bankrupt!`);
    this.onSfxPlay?.(room.code, 'bankrupt');
    this.checkWinCondition(room);
    this.checkRoundReset(room);
  }

  private scheduleTradeOfferExpiry(room: Room, offer: TradeOffer) {
    const existingTimer = this.tradeTimeouts.get(offer.id);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      const activeRoom = this.rooms.get(room.code);
      if (!activeRoom) return;

      const activeOffer = activeRoom.tradeOffers.find((item) => item.id === offer.id);
      if (!activeOffer) return;

      const fromPlayer = activeRoom.players.find((player) => player.id === activeOffer.fromPlayerId);
      const toPlayer = activeRoom.players.find((player) => player.id === activeOffer.toPlayerId);

      this.clearTradeOffer(activeRoom, activeOffer.id);
      if (fromPlayer && toPlayer) {
        this.addEventLog(activeRoom, `Trade offer from ${fromPlayer.name} to ${toPlayer.name} expired`);
        this.onTradeStatus?.(activeRoom.code, fromPlayer.id, {
          offerId: activeOffer.id,
          status: 'expired',
          message: `Your trade offer to ${toPlayer.name} expired.`,
        });
        this.onTradeStatus?.(activeRoom.code, toPlayer.id, {
          offerId: activeOffer.id,
          status: 'expired',
          message: `Trade offer from ${fromPlayer.name} expired.`,
        });
      }
      this.emitState(activeRoom.code);
    }, Math.max(0, offer.expiresAt - Date.now()));

    this.tradeTimeouts.set(offer.id, timer);
  }

  private clearTradeOffer(room: Room, offerId: string) {
    const timer = this.tradeTimeouts.get(offerId);
    if (timer) clearTimeout(timer);
    this.tradeTimeouts.delete(offerId);
    room.tradeOffers = room.tradeOffers.filter((offer) => offer.id !== offerId);
  }

  private setCooldown(player: Player) {
    player.status = 'cooldown';
    player.cooldownUntil = Date.now() + getGameConfig().cooldownMs;
    player.debtDeadline = null;
  }

  private checkWinCondition(room: Room) {
    const activePlayers = room.players.filter((player) => !['bankrupt', 'disconnected'].includes(player.status));
    if (activePlayers.length === 1 && room.players.length > 1) {
      room.status = 'ended';
      room.winnerId = activePlayers[0].id;
      this.addEventLog(room, `${activePlayers[0].name} has won the game!`);
    }
  }

  private checkRoundReset(room: Room) {
    if (room.status !== 'playing' || room.auction) return;

    const activePlayers = room.players.filter((player) => !['bankrupt', 'disconnected', 'jailed'].includes(player.status));
    if (activePlayers.some((player) => ['resolving_tile', 'moving', 'auction', 'in_debt'].includes(player.status))) return;

    const allExhausted = activePlayers.length > 0 && activePlayers.every((player) => player.rollsLeft <= 0);
    if (!allExhausted) return;

    activePlayers.forEach((player) => {
      player.rollsLeft = 2;
        player.consecutiveDoubles = 0;
    });

    room.players.forEach((player) => {
      if (player.status === 'jailed') {
        player.status = 'ready';
        player.rollsLeft = 1;
        this.addEventLog(room, `${player.name} was freed from jail (Got 50% Quota)`);
      }
    });

    this.addEventLog(room, 'All active players rolled. Quotas reset to 2!');
  }

  private addEventLog(room: Room, message: string) {
    room.eventLog.unshift(message);
    if (room.eventLog.length > 50) {
      room.eventLog.pop();
    }
  }

  private emitState(code: string) {
    const room = this.rooms.get(code);
    if (room && this.onStateChange) {
      this.onStateChange(code, room);
    }
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let index = 0; index < 4; index += 1) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
