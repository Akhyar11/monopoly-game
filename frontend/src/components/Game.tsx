import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { socket } from '../socket';
import type { Room, Tile as TileType } from '../types';
import { AlertCircle, ArrowLeftRight, Building2, Dices, Flag, Hammer, LandPlot, ShieldAlert } from 'lucide-react';

type TradeDraft = {
  toPlayerId: string;
  offeredPropertyIds: string[];
  requestedPropertyIds: string[];
  offeredCash: number;
  requestedCash: number;
};

type Notice = {
  id: string;
  tone: 'info' | 'success' | 'warning';
  message: string;
};

const colorMap: Record<string, string> = {
  brown: 'bg-yellow-800',
  lightBlue: 'bg-sky-400',
  pink: 'bg-pink-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-400',
  green: 'bg-green-500',
  darkBlue: 'bg-blue-700',
};

const playerGlowClasses = [
  'border-blue-500 shadow-[inset_0_0_20px_rgba(59,130,246,0.8)]',
  'border-red-500 shadow-[inset_0_0_20px_rgba(239,68,68,0.8)]',
  'border-green-500 shadow-[inset_0_0_20px_rgba(34,197,94,0.8)]',
  'border-yellow-500 shadow-[inset_0_0_20px_rgba(234,179,8,0.8)]',
  'border-purple-500 shadow-[inset_0_0_20px_rgba(168,85,247,0.8)]',
  'border-pink-500 shadow-[inset_0_0_20px_rgba(236,72,153,0.8)]',
  'border-orange-500 shadow-[inset_0_0_20px_rgba(249,115,22,0.8)]',
  'border-cyan-500 shadow-[inset_0_0_20px_rgba(6,182,212,0.8)]'
];

const initialTradeDraft: TradeDraft = {
  toPlayerId: '',
  offeredPropertyIds: [],
  requestedPropertyIds: [],
  offeredCash: 0,
  requestedCash: 0,
};

const ownsFullColorSet = (room: Room, playerId: string, colorGroup?: string) => {
  if (!colorGroup) return false;
  const groupTiles = room.board.filter((tile) => tile.colorGroup === colorGroup);
  return groupTiles.length > 1 && groupTiles.every((tile) => tile.ownerPlayerId === playerId);
};

const colorGroupHasMortgage = (room: Room, playerId: string, colorGroup?: string) => {
  if (!colorGroup) return false;
  return room.board.some((tile) => tile.colorGroup === colorGroup && tile.ownerPlayerId === playerId && tile.isMortgaged);
};

const canBuildEvenly = (room: Room, playerId: string, tile: TileType) => {
  if (!tile.colorGroup) return false;
  const currentLevel = tile.buildingLevel || 0;
  return room.board
    .filter((boardTile) => boardTile.colorGroup === tile.colorGroup && boardTile.ownerPlayerId === playerId)
    .every((boardTile) => (boardTile.buildingLevel || 0) >= currentLevel);
};

const canSellEvenly = (room: Room, playerId: string, tile: TileType) => {
  if (!tile.colorGroup) return false;
  const currentLevel = tile.buildingLevel || 0;
  return room.board
    .filter((boardTile) => boardTile.colorGroup === tile.colorGroup && boardTile.ownerPlayerId === playerId)
    .every((boardTile) => (boardTile.buildingLevel || 0) <= currentLevel);
};

const calculateRent = (room: Room, tile: TileType) => {
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
    return multiplier * 7;
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
    return baseRent * multipliers[Math.min(buildingLevel, 5) - 1];
  }

  return ownsFullColorSet(room, tile.ownerPlayerId || '', tile.colorGroup) && !colorGroupHasMortgage(room, tile.ownerPlayerId || '', tile.colorGroup)
    ? baseRent * 2
    : baseRent;
};

const buildingLabel = (tile: TileType) => {
  const level = tile.buildingLevel || 0;
  if (level <= 0) return 'No build';
  if (level >= 5) return 'Hotel';
  return `${level} House`;
};

const rentLabel = (room: Room, tile: TileType) => {
  if (tile.type === 'utility') {
    const ownedUtilities = room.board.filter(
      (boardTile) => boardTile.type === 'utility' && boardTile.ownerPlayerId === tile.ownerPlayerId && !boardTile.isMortgaged,
    ).length;
    return ownedUtilities >= 2 ? '10x dice' : '4x dice';
  }

  return `$${calculateRent(room, tile)}`;
};

const toggleId = (items: string[], id: string) => (items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);

export const Game: React.FC = () => {
  const { room, playerId, diceRoll } = useStore();
  const [showPropertyModal, setShowPropertyModal] = useState<{ tile: TileType } | null>(null);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [buyTimer, setBuyTimer] = useState(15);
  const [auctionTimer, setAuctionTimer] = useState(0);
  const [showCardModal, setShowCardModal] = useState<{ title: string; message: string } | null>(null);
  const [cardTimer, setCardTimer] = useState(0);
  const [tradeDraft, setTradeDraft] = useState<TradeDraft>(initialTradeDraft);
  const [incomingOfferId, setIncomingOfferId] = useState<string | null>(null);
  const [debtTime, setDebtTime] = useState(0);
  const [tradeNotices, setTradeNotices] = useState<Notice[]>([]);
  const [visualPositions, setVisualPositions] = useState<Record<string, number>>({});

  useEffect(() => {
    const interval = setInterval(() => {
      const currentRoom = useStore.getState().room;
      if (!currentRoom) return;

      setVisualPositions((prev) => {
        const next = { ...prev };
        let changed = false;
        
        for (const player of currentRoom.players) {
          const target = player.position;
          const current = prev[player.id];
          
          if (current !== undefined && current !== target) {
            changed = true;
            const N = currentRoom.board.length;
            const sideLen = Math.floor(N / 4);
            const goToJailIndex = 3 * sideLen;
            const jailIndex = sideLen;

            if (current === goToJailIndex && target === jailIndex) {
              next[player.id] = jailIndex;
            } else if ((current - target + N) % N === 3) {
              next[player.id] = (current - 1 + N) % N;
            } else {
              next[player.id] = (current + 1) % N;
            }
          } else if (current === undefined) {
            changed = true;
            next[player.id] = target;
          }
        }
        return changed ? next : prev;
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    socket.on('property_decision', (data) => {
      if (data.playerId === playerId) {
        setShowPropertyModal({ tile: data.tile });
        setBuyTimer(15);
      }
    });

    socket.on('card_drawn', (data) => {
      setShowCardModal({ title: data.title, message: data.message });
      setCardTimer(10);
    });

    socket.on('trade_offer_received', (offer) => {
      if (offer.toPlayerId === playerId) {
        setIncomingOfferId(offer.id);
      }
    });

    socket.on('trade_offer_status', (data) => {
      const tone: Notice['tone'] = data.status === 'accepted' ? 'success' : data.status === 'rejected' || data.status === 'expired' ? 'warning' : 'info';
      const noticeId = `${data.offerId}-${Date.now()}`;
      const notice = { id: noticeId, tone, message: data.message };
      setTradeNotices((items) => [...items, notice].slice(-4));
      
      setTimeout(() => {
        setTradeNotices((items) => items.filter((item) => item.id !== noticeId));
      }, 5000);

      if (data.status !== 'sent') {
        setIncomingOfferId((current) => (current === data.offerId ? null : current));
      }
    });

    return () => {
      socket.off('property_decision');
      socket.off('card_drawn');
      socket.off('trade_offer_received');
      socket.off('trade_offer_status');
    };
  }, [playerId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const me = room?.players.find((player) => player.id === playerId);
      if (me?.cooldownUntil && me.status === 'cooldown') {
        setCooldownTime(Math.max(0, me.cooldownUntil - Date.now()));
      } else {
        setCooldownTime(0);
      }

      if (room?.auction) {
        setAuctionTimer(Math.max(0, Math.ceil((room.auction.expiresAt - Date.now()) / 1000)));
      } else {
        setAuctionTimer(0);
      }

      if (me?.debtDeadline && me.status === 'in_debt') {
        setDebtTime(Math.max(0, Math.ceil((me.debtDeadline - Date.now()) / 1000)));
      } else {
        setDebtTime(0);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [room, playerId]);

  useEffect(() => {
    if (!showPropertyModal) return undefined;

    const interval = setInterval(() => {
      setBuyTimer((time) => {
        if (time <= 1) {
          setShowPropertyModal(null);
          return 0;
        }
        return time - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showPropertyModal]);

  useEffect(() => {
    if (!showCardModal) return undefined;

    const interval = setInterval(() => {
      setCardTimer((time) => {
        if (time <= 1) {
          setShowCardModal(null);
          return 0;
        }
        return time - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showCardModal]);

  if (!room) return null;

  const me = room.players.find((player) => player.id === playerId);
  if (!me) return null;

  const ownedTiles = room.board.filter((tile) => tile.ownerPlayerId === me.id);
  const rescueTiles = ownedTiles.filter((tile) => (tile.buildingLevel || 0) > 0 || !tile.isMortgaged);
  const otherPlayers = room.players.filter((player) => player.id !== me.id && player.status !== 'bankrupt');
  const targetPlayer = room.players.find((player) => player.id === tradeDraft.toPlayerId) || null;
  const targetTiles = room.board.filter((tile) => tile.ownerPlayerId === targetPlayer?.id);
  const hasQuota = me.rollsLeft > 0;
  const canRoll = hasQuota && !['moving', 'resolving_tile', 'jailed', 'bankrupt', 'disconnected', 'auction', 'in_debt'].includes(me.status) && cooldownTime === 0;
  const amInAuction = !!(room.auction && room.auction.participants.includes(me.id));
  const auctionTile = room.auction ? room.board.find((tile) => tile.id === room.auction?.tileId) : null;
  const isHighestBidder = room.auction?.highestBidderId === me.id;
  const incomingOffer = room.tradeOffers.find((offer) => offer.id === incomingOfferId)
    || room.tradeOffers.find((offer) => offer.toPlayerId === me.id)
    || null;
  const outgoingOffers = room.tradeOffers.filter((offer) => offer.fromPlayerId === me.id);
  const incomingOfferSeconds = incomingOffer ? Math.max(0, Math.ceil((incomingOffer.expiresAt - Date.now()) / 1000)) : 0;
  const canSubmitTrade = !!tradeDraft.toPlayerId
    && (
      tradeDraft.offeredPropertyIds.length > 0
      || tradeDraft.requestedPropertyIds.length > 0
      || tradeDraft.offeredCash > 0
      || tradeDraft.requestedCash > 0
    );
  const inDebtMode = me.status === 'in_debt';

  const ownTileLookup = Object.fromEntries(room.board.map((tile) => [tile.id, tile] as const));

  const handleRollDice = () => {
    if (canRoll) {
      socket.emit('roll_dice', { code: room.code });
    }
  };

  const handlePropertyDecision = (decision: 'buy' | 'skip') => {
    if (!showPropertyModal) return;

    socket.emit('buy_property', {
      code: room.code,
      tileId: showPropertyModal.tile.id,
      decision,
    });
    setShowPropertyModal(null);
  };

  const handleEndGame = () => {
    if (confirm('Are you sure you want to end the game early?')) {
      socket.emit('end_game', { code: room.code });
    }
  };

  const handlePayJailFee = () => {
    if (me.status === 'jailed') {
      socket.emit('pay_jail_fee', { code: room.code });
    }
  };

  const submitTrade = () => {
    if (!tradeDraft.toPlayerId) return;

    socket.emit('send_trade_offer', {
      code: room.code,
      toPlayerId: tradeDraft.toPlayerId,
      offeredPropertyIds: tradeDraft.offeredPropertyIds,
      requestedPropertyIds: tradeDraft.requestedPropertyIds,
      offeredCash: tradeDraft.offeredCash,
      requestedCash: tradeDraft.requestedCash,
    });

    setTradeDraft(initialTradeDraft);
  };

  const removeNotice = (id: string) => {
    setTradeNotices((items) => items.filter((item) => item.id !== id));
  };

  const renderPropertyPill = (tile: TileType, active: boolean, onClick: () => void) => (
    <button
      key={tile.id}
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left transition ${active ? 'border-cyan-400 bg-cyan-500/20' : 'border-slate-700 bg-slate-900/60 hover:bg-slate-800'}`}
    >
      <div className="flex items-center gap-2">
        {tile.colorGroup && <span className={`h-3 w-3 rounded-full ${colorMap[tile.colorGroup]}`} />}
        <span className="text-sm font-semibold text-white">{tile.name}</span>
      </div>
      <div className="mt-1 text-xs text-slate-400">
        Rent {rentLabel(room, tile)} • {buildingLabel(tile)} {tile.isMortgaged ? '• Mortgaged' : ''}
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] p-4 font-sans text-slate-100">
      {tradeNotices.length > 0 && (
        <div className="fixed right-4 top-4 z-[80] flex w-80 flex-col gap-2">
          {tradeNotices.map((notice) => (
            <button
              key={notice.id}
              onClick={() => removeNotice(notice.id)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm shadow-lg ${
                notice.tone === 'success'
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100'
                  : notice.tone === 'warning'
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-100'
                    : 'border-cyan-500/40 bg-cyan-500/15 text-cyan-100'
              }`}
            >
              {notice.message}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-4 lg:flex-row flex-col">
        <div className="w-full lg:w-80 flex flex-col gap-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto custom-scrollbar">
          <div className="glassmorphism p-4 rounded-2xl flex-shrink-0">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold"><LandPlot className="h-5 w-5 text-blue-400" /> Players</h3>
            <div className="space-y-3">
              {room.players.map((player) => (
                <div key={player.id} className={`relative overflow-hidden rounded-xl border p-3 ${player.id === playerId ? 'border-blue-500/50 bg-blue-500/20' : 'border-slate-700/50 bg-slate-800/50'}`}>
                  {player.status === 'bankrupt' && <div className="absolute inset-0 flex items-center justify-center bg-red-950/60 font-bold text-red-500 backdrop-blur-[1px]">BANKRUPT</div>}
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-lg font-semibold">{player.avatar} {player.name}</span>
                    <span className="font-mono font-bold text-green-400">${player.balance}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span className="rounded-md bg-slate-900 px-2 py-0.5 uppercase tracking-wider">
                      {player.status} {player.status !== 'bankrupt' && player.status !== 'disconnected' && `(Quota: ${player.rollsLeft})`}
                    </span>
                    <span>Assets: {player.properties.length}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glassmorphism flex h-[350px] lg:h-auto lg:flex-1 min-h-[250px] flex-col overflow-hidden rounded-2xl p-4">
            <h3 className="mb-3 text-lg font-bold">Event Log</h3>
            <div className="custom-scrollbar flex flex-grow flex-col-reverse gap-2 overflow-y-auto pr-2">
              {[...room.eventLog].reverse().map((log, index) => (
                <div key={`${room.eventLog.length - index}-${log.slice(0, 10)}`} className="animate-fade-in rounded-lg border-l-2 border-slate-600 bg-slate-800/40 p-2 text-sm text-slate-300">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex min-h-[640px] flex-grow flex-col items-center justify-center overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 p-4 shadow-inner md:p-8">
          {room.status === 'ended' && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
              <h1 className="mb-4 bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-5xl font-black text-transparent md:text-6xl">GAME OVER</h1>
              <p className="text-xl md:text-2xl mb-8">Winner: {room.players.find((player) => player.id === room.winnerId)?.name || 'Unknown'}</p>
              <button 
                onClick={() => {
                  useStore.getState().setRoomCode('');
                  useStore.getState().setRoom(null as any);
                  window.location.reload();
                }}
                className="rounded-full bg-cyan-600 px-8 py-3 font-bold text-white shadow-lg transition-transform hover:scale-105 hover:bg-cyan-500"
              >
                Return to Lobby
              </button>
            </div>
          )}

          <AnimatePresence>
            {diceRoll && (
              <motion.div 
                initial={{ scale: 0, opacity: 0, rotate: -180 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0, opacity: 0, rotate: 180 }}
                transition={{ type: 'spring', damping: 15, stiffness: 100 }}
                className="absolute z-40 flex items-center justify-center rounded-2xl bg-slate-950/90 p-8 shadow-2xl backdrop-blur-sm pointer-events-none"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 text-lg font-bold text-slate-300">
                    {room.players.find(p => p.id === diceRoll.playerId)?.name || 'Someone'} rolled:
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white text-5xl font-black text-slate-900 shadow-inner">
                      {diceRoll.dice1}
                    </div>
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white text-5xl font-black text-slate-900 shadow-inner">
                      {diceRoll.dice2}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className={`grid aspect-square w-full max-w-4xl gap-1 rounded-2xl p-2 shadow-2xl ${!room.skin ? 'bg-slate-800' : ''}`}
            style={{
              ...(room.skin
                ? room.skin.type === 'color'
                  ? { backgroundColor: room.skin.value }
                  : { backgroundImage: `url(${room.skin.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : {}),
              gridTemplateColumns: `1.5fr repeat(${Math.ceil(room.board.length / 4) - 1}, 1fr) 1.5fr`,
              gridTemplateRows: `1.5fr repeat(${Math.ceil(room.board.length / 4) - 1}, 1fr) 1.5fr`,
            }}
          >
            {(() => {
              const N = room.board.length;
              const side = Math.ceil(N / 4);
              const gridSize = side + 1;

              return room.board.map((tile, index) => {
                let row;
                let col;
                if (index < side) {
                  row = gridSize;
                  col = gridSize - index;
                } else if (index < side * 2) {
                  row = gridSize - (index - side);
                  col = 1;
                } else if (index < side * 3) {
                  row = 1;
                  col = index - side * 2 + 1;
                } else {
                  row = index - side * 3 + 1;
                  col = gridSize;
                }

              const playersOnTile = room.players.filter((player) => (visualPositions[player.id] ?? player.position) === index && player.status !== 'bankrupt');
              const tileRentLabel = rentLabel(room, tile);

              const hasSkin = !!room.skin;
              const pIndex = playersOnTile.length > 0 ? room.players.findIndex(p => p.id === playersOnTile[0].id) : -1;
              const glowClass = pIndex !== -1 
                ? `border-2 ${playerGlowClasses[pIndex % playerGlowClasses.length]}` 
                : (hasSkin ? 'border border-transparent hover:border-slate-500 hover:bg-slate-900/40 cursor-pointer' : 'border border-slate-600');

              return (
                <div 
                  key={tile.id} 
                  className={`relative flex flex-col overflow-hidden rounded-lg p-1 text-center group transition-colors ${hasSkin ? 'bg-transparent' : 'bg-slate-700'} ${glowClass}`} 
                  style={{ gridRow: row, gridColumn: col }}
                >
                  {!hasSkin && tile.colorGroup && <div className={`absolute left-0 top-0 h-2 w-full ${colorMap[tile.colorGroup]}`} />}
                  
                  {!hasSkin && (
                    <>
                      <div className="mt-2 text-[10px] font-bold uppercase leading-tight text-slate-300">{tile.name}</div>
                      {tile.price && <div className="mt-auto text-[9px] text-slate-400">${tile.price}</div>}
                      {tile.ownerPlayerId && (
                        <div className="mt-1 text-[9px] text-cyan-300">
                          {tileRentLabel} {tile.isMortgaged ? '• MG' : ''}
                        </div>
                      )}
                      {(tile.buildingLevel || 0) > 0 && (
                        <div className="text-[9px] font-semibold text-amber-300">{buildingLabel(tile)}</div>
                      )}
                    </>
                  )}

                  {/* Hover Overlay for Skin Mode */}
                  {hasSkin && (
                    <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10 p-1">
                      <div className="text-[10px] font-bold text-white text-center leading-tight mb-1">{tile.name}</div>
                      {tile.ownerPlayerId ? (
                        <>
                          <div className="text-[10px] text-cyan-300 font-semibold">{tileRentLabel} {tile.isMortgaged ? '• MG' : ''}</div>
                          {(tile.buildingLevel || 0) > 0 && (
                            <div className="text-[9px] font-semibold text-amber-300">{buildingLabel(tile)}</div>
                          )}
                        </>
                      ) : tile.price ? (
                        <div className="text-[10px] text-emerald-400 font-semibold">Buy: ${tile.price}</div>
                      ) : (
                        <div className="text-[9px] text-slate-400 uppercase">{tile.type.replace('_', ' ')}</div>
                      )}
                    </div>
                  )}

                  {/* Players on Tile (Always visible) */}
                  <div className="pointer-events-none absolute inset-0 flex flex-wrap items-center justify-center gap-1 p-2 z-20">
                    {playersOnTile.map((player) => (
                      <motion.div 
                        key={player.id} 
                        layoutId={player.id}
                        transition={{ type: 'tween', duration: 0.25, ease: 'linear' }}
                        className="text-3xl md:text-4xl drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] z-30"
                      >
                        {player.avatar}
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}

            <div 
              style={{
                gridColumnStart: 2,
                gridColumnEnd: Math.ceil(room.board.length / 4) + 1,
                gridRowStart: 2,
                gridRowEnd: Math.ceil(room.board.length / 4) + 1,
              }}
              className="pointer-events-none flex items-center justify-center opacity-10"
            >
              <span className="text-7xl font-black md:text-9xl">MONOPOLY</span>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[24rem] flex flex-col gap-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto custom-scrollbar">
          <div className="glassmorphism rounded-2xl p-6 text-center">
            <div className="mb-6">
              <div className="mb-2 text-4xl">{me.avatar}</div>
              <h2 className="text-xl font-bold">{me.name}</h2>
              <p className="font-mono text-2xl font-bold text-green-400">${me.balance}</p>
            </div>

            <button
              onClick={handleRollDice}
              disabled={!canRoll}
              className={`flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-xl font-black transition-all ${canRoll ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-900 shadow-[0_0_20px_rgba(52,211,153,0.4)] hover:scale-105' : 'cursor-not-allowed bg-slate-800 text-slate-500'}`}
            >
              <Dices className="h-6 w-6" />
              {canRoll ? 'ROLL DICE' : cooldownTime > 0 ? `COOLDOWN (${(cooldownTime / 1000).toFixed(1)}s)` : !hasQuota ? 'WAITING FOR OTHERS...' : 'WAITING...'}
            </button>

            {me.status === 'jailed' && (
              <div className="mt-4 flex w-full flex-col items-center gap-2">
                <div className="text-sm font-bold text-red-400">IN JAIL! Pay $50 or wait for round reset.</div>
                <button onClick={handlePayJailFee} className="w-full rounded-xl border border-orange-500/50 bg-orange-500/20 py-2 font-bold text-orange-400 transition hover:bg-orange-500/40">
                  Pay $50 to Exit Now
                </button>
              </div>
            )}

            {inDebtMode && (
              <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-left">
                <div className="mb-2 flex items-center gap-2 font-bold text-red-300">
                  <ShieldAlert className="h-5 w-5" /> Emergency Mortgage
                </div>
                <p className="text-sm text-slate-200">Saldo kamu minus. Gadaikan aset tanpa bangunan dalam {debtTime}s untuk menghindari bangkrut.</p>
                <p className="mt-2 text-xs text-red-200/80">Aset penyelamat tersedia: {rescueTiles.length}</p>
                <p className="mt-2 text-xs text-red-200/80">Aksi lain dikunci sampai saldo kembali aman.</p>
              </div>
            )}

            {me.id === room.hostPlayerId && (
              <button onClick={handleEndGame} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/50 py-3 font-bold text-red-400 transition-all hover:bg-red-500/20">
                <Flag className="h-5 w-5" /> End Game
              </button>
            )}
          </div>

          {amInAuction && room.auction && auctionTile && (
            <div className="glassmorphism relative mt-0 overflow-hidden rounded-2xl border border-purple-500/50 p-6 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
              <div className="absolute left-0 top-0 h-1 bg-purple-500 transition-all duration-1000" style={{ width: `${(auctionTimer / 30) * 100}%` }} />
              <h3 className="mb-1 flex items-center justify-between text-xl font-bold text-purple-400">
                <span>⚖️ Auction!</span>
                <span className="rounded bg-purple-500/20 px-2 py-0.5 text-sm font-mono">{auctionTimer}s</span>
              </h3>
              <p className="mb-4 text-sm text-slate-300">Conflict on {auctionTile.name}.</p>

              <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-400">Current Bid</span>
                  <span className="font-mono text-xl font-bold text-green-400">${room.auction.currentBid}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Highest Bidder</span>
                  <span className="font-bold">{room.auction.highestBidderId ? room.players.find((player) => player.id === room.auction?.highestBidderId)?.name : 'None'}</span>
                </div>
              </div>

              {isHighestBidder ? (
                <div className="rounded-lg border border-green-500/20 bg-green-500/10 py-2 text-center text-sm font-bold text-green-400">You are the highest bidder.</div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => socket.emit('place_bid', { code: room.code, amount: room.auction!.currentBid + 10 })}
                    disabled={me.balance < room.auction.currentBid + 10}
                    className="flex-1 rounded-lg bg-purple-600 py-2 font-bold transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + $10
                  </button>
                  <button
                    onClick={() => socket.emit('place_bid', { code: room.code, amount: room.auction!.currentBid + 50 })}
                    disabled={me.balance < room.auction.currentBid + 50}
                    className="flex-1 rounded-lg bg-purple-600 py-2 font-bold transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + $50
                  </button>
                </div>
              )}
            </div>
          )}

          <div className={`glassmorphism rounded-2xl p-5 ${inDebtMode ? 'ring-2 ring-red-500/50' : ''}`}>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold"><Building2 className="h-5 w-5 text-amber-400" /> Your Assets</h3>
            {inDebtMode && (
              <div className="mb-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
                Jual bangunan atau gadaikan properti untuk keluar dari utang. Properti yang sudah tergadai tidak bisa dipakai menarik sewa.
              </div>
            )}
            <div className="space-y-3">
              {ownedTiles.length === 0 && <div className="rounded-xl bg-slate-900/50 p-3 text-sm text-slate-400">Belum punya properti.</div>}
              {ownedTiles.map((tile) => {
                const canBuild = tile.type === 'property'
                  && !!tile.colorGroup
                  && ownsFullColorSet(room, me.id, tile.colorGroup)
                  && !colorGroupHasMortgage(room, me.id, tile.colorGroup)
                  && !tile.isMortgaged
                  && (tile.buildingLevel || 0) < 5
                  && canBuildEvenly(room, me.id, tile)
                  && !inDebtMode;
                const canSell = (tile.buildingLevel || 0) > 0 && canSellEvenly(room, me.id, tile);
                const canMortgage = !tile.isMortgaged;
                const canRedeem = tile.isMortgaged && !inDebtMode;

                return (
                  <div key={tile.id} className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {tile.colorGroup && <span className={`h-3 w-3 rounded-full ${colorMap[tile.colorGroup]}`} />}
                          <div className="font-semibold text-white">{tile.name}</div>
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          Rent {rentLabel(room, tile)} • {buildingLabel(tile)} {tile.isMortgaged ? '• Mortgaged' : ''}
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        <div>Mortgage ${Math.floor((tile.price || 0) / 2)}</div>
                        {tile.isMortgaged && <div>Redeem ${Math.ceil(Math.floor((tile.price || 0) / 2) * 1.1)}</div>}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {canBuild && (() => {
                        const isBuildingHotel = (tile.buildingLevel || 0) === 4;
                        const cost = isBuildingHotel && tile.hotelCost !== undefined ? tile.hotelCost : (tile.houseCost || 0);
                        return (
                          <button onClick={() => socket.emit('build_property', { code: room.code, tileId: tile.id })} className="flex-1 rounded-xl bg-amber-500/20 py-2 text-sm font-bold text-amber-300 transition hover:bg-amber-500/35">
                            <Hammer className="mr-1 inline h-4 w-4" /> Build ${cost}
                          </button>
                        );
                      })()}
                      {canSell && (() => {
                        const isSellingHotel = (tile.buildingLevel || 0) === 5;
                        const cost = isSellingHotel && tile.hotelCost !== undefined ? tile.hotelCost : (tile.houseCost || 0);
                        return (
                          <button onClick={() => socket.emit('sell_building', { code: room.code, tileId: tile.id })} className="flex-1 rounded-xl bg-blue-500/20 py-2 text-sm font-bold text-blue-300 transition hover:bg-blue-500/35">
                            Sell +${Math.floor(cost / 2)}
                          </button>
                        );
                      })()}
                      {canMortgage ? (
                        <button onClick={() => socket.emit('mortgage_property', { code: room.code, tileId: tile.id })} className="flex-1 rounded-xl bg-rose-500/20 py-2 text-sm font-bold text-rose-300 transition hover:bg-rose-500/35">
                          Mortgage
                        </button>
                      ) : canRedeem ? (
                        <button onClick={() => socket.emit('redeem_property', { code: room.code, tileId: tile.id })} className="flex-1 rounded-xl bg-emerald-500/20 py-2 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/35">
                          Redeem
                        </button>
                      ) : (
                        <div className="flex-1 rounded-xl border border-slate-700 py-2 text-center text-sm font-bold text-slate-500">
                          Redeem Locked
                        </div>
                      )}
                    </div>
                    {!canBuild && tile.type === 'property' && tile.colorGroup && ownsFullColorSet(room, me.id, tile.colorGroup) && !tile.isMortgaged && (
                      <div className="mt-2 text-xs text-slate-500">
                        Build/Sell mengikuti aturan merata dalam satu color set.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div id="trade-center-section" className={`glassmorphism rounded-2xl p-5 ${inDebtMode ? 'opacity-50' : ''}`}>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold"><ArrowLeftRight className="h-5 w-5 text-cyan-400" /> Trade Center</h3>
            <div className="space-y-3">
              {inDebtMode && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
                  Trade dinonaktifkan sementara sampai utang selesai.
                </div>
              )}
              <select
                value={tradeDraft.toPlayerId}
                onChange={(event) => setTradeDraft({ ...initialTradeDraft, toPlayerId: event.target.value })}
                disabled={inDebtMode}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">Choose player</option>
                {otherPlayers.map((player) => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>

              {tradeDraft.toPlayerId && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="mb-2 text-xs uppercase tracking-wider text-slate-400">You Offer</div>
                      <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                        {ownedTiles.map((tile) => renderPropertyPill(tile, tradeDraft.offeredPropertyIds.includes(tile.id), () => setTradeDraft((draft) => ({ ...draft, offeredPropertyIds: toggleId(draft.offeredPropertyIds, tile.id) }))))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-xs uppercase tracking-wider text-slate-400">You Ask</div>
                      <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                        {targetTiles.map((tile) => renderPropertyPill(tile, tradeDraft.requestedPropertyIds.includes(tile.id), () => setTradeDraft((draft) => ({ ...draft, requestedPropertyIds: toggleId(draft.requestedPropertyIds, tile.id) }))))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm text-slate-300">
                      Cash you add
                      <input
                        type="number"
                        min={0}
                        value={tradeDraft.offeredCash}
                        disabled={inDebtMode}
                        onChange={(event) => setTradeDraft((draft) => ({ ...draft, offeredCash: Number(event.target.value) || 0 }))}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-white outline-none"
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      Cash you request
                      <input
                        type="number"
                        min={0}
                        value={tradeDraft.requestedCash}
                        disabled={inDebtMode}
                        onChange={(event) => setTradeDraft((draft) => ({ ...draft, requestedCash: Number(event.target.value) || 0 }))}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-white outline-none"
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-3 text-sm text-slate-300">
                    <div className="font-semibold text-white">Trade Preview</div>
                    <div className="mt-1">
                      You give: {tradeDraft.offeredPropertyIds.length > 0 ? tradeDraft.offeredPropertyIds.map((id) => ownTileLookup[id]?.name).join(', ') : 'No property'}
                      {tradeDraft.offeredCash > 0 ? ` + $${tradeDraft.offeredCash}` : ''}
                    </div>
                    <div className="mt-1">
                      You get: {tradeDraft.requestedPropertyIds.length > 0 ? tradeDraft.requestedPropertyIds.map((id) => ownTileLookup[id]?.name).join(', ') : 'No property'}
                      {tradeDraft.requestedCash > 0 ? ` + $${tradeDraft.requestedCash}` : ''}
                    </div>
                  </div>

                  <button onClick={submitTrade} disabled={!canSubmitTrade || inDebtMode} className="w-full rounded-xl bg-cyan-500 py-3 font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">
                    Send Trade Offer
                  </button>
                </>
              )}

              {outgoingOffers.length > 0 && (
                <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-3 text-sm text-slate-300">
                  <div className="font-semibold text-white">Pending Offers</div>
                  <div className="mt-2 space-y-2">
                    {outgoingOffers.map((offer) => (
                      <div key={offer.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                        <div className="flex items-center justify-between">
                          <span>To {room.players.find((player) => player.id === offer.toPlayerId)?.name}</span>
                          <span className="font-mono text-cyan-300">{Math.max(0, Math.ceil((offer.expiresAt - Date.now()) / 1000))}s</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          Give: {offer.offeredPropertyIds.length > 0 ? offer.offeredPropertyIds.map((id) => ownTileLookup[id]?.name).join(', ') : 'No property'}
                          {offer.offeredCash > 0 ? ` + $${offer.offeredCash}` : ''}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          Get: {offer.requestedPropertyIds.length > 0 ? offer.requestedPropertyIds.map((id) => ownTileLookup[id]?.name).join(', ') : 'No property'}
                          {offer.requestedCash > 0 ? ` + $${offer.requestedCash}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {incomingOffer && (
            <div className={`glassmorphism rounded-2xl border border-cyan-500/40 p-5 ${inDebtMode ? 'opacity-60' : ''}`}>
              <h3 className="mb-2 flex items-center justify-between text-lg font-bold text-cyan-300">
                <span>Incoming Trade Offer</span>
                <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-sm font-mono">{incomingOfferSeconds}s</span>
              </h3>
              <p className="mb-3 text-sm text-slate-300">
                {room.players.find((player) => player.id === incomingOffer.fromPlayerId)?.name} wants to trade with you.
              </p>
              {inDebtMode && (
                <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
                  Respons trade dikunci selama kamu masih dalam mode utang.
                </div>
              )}
              <div className="space-y-2 rounded-xl bg-slate-900/60 p-3 text-sm text-slate-300">
                <div>
                  They offer: {incomingOffer.offeredPropertyIds.length > 0 ? incomingOffer.offeredPropertyIds.map((id) => ownTileLookup[id]?.name).join(', ') : 'No property'}
                  {incomingOffer.offeredCash > 0 ? ` + $${incomingOffer.offeredCash}` : ''}
                </div>
                <div>
                  They want: {incomingOffer.requestedPropertyIds.length > 0 ? incomingOffer.requestedPropertyIds.map((id) => ownTileLookup[id]?.name).join(', ') : 'No property'}
                  {incomingOffer.requestedCash > 0 ? ` + $${incomingOffer.requestedCash}` : ''}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    socket.emit('respond_trade_offer', { code: room.code, offerId: incomingOffer.id, decision: 'accept' });
                    setIncomingOfferId(null);
                  }}
                  disabled={inDebtMode}
                  className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  onClick={() => {
                    setTradeDraft({
                      toPlayerId: incomingOffer.fromPlayerId,
                      offeredPropertyIds: [...incomingOffer.requestedPropertyIds],
                      requestedPropertyIds: [...incomingOffer.offeredPropertyIds],
                      offeredCash: incomingOffer.requestedCash,
                      requestedCash: incomingOffer.offeredCash,
                    });
                    socket.emit('respond_trade_offer', { code: room.code, offerId: incomingOffer.id, decision: 'reject' });
                    setIncomingOfferId(null);
                    // optionally scroll to trade center
                    document.getElementById('trade-center-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  disabled={inDebtMode}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
                >
                  Counter
                </button>
                <button
                  onClick={() => {
                    socket.emit('respond_trade_offer', { code: room.code, offerId: incomingOffer.id, decision: 'reject' });
                    setIncomingOfferId(null);
                  }}
                  disabled={inDebtMode}
                  className="flex-1 rounded-xl bg-slate-700 py-2.5 text-sm font-bold text-white transition hover:bg-slate-600 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {showPropertyModal && me.status !== 'auction' && (
            <div className="glassmorphism relative overflow-hidden rounded-2xl border border-yellow-500/30 p-6 shadow-[0_0_30px_rgba(234,179,8,0.15)]">
              <div className="absolute left-0 top-0 h-1 bg-yellow-500 transition-all duration-1000" style={{ width: `${(buyTimer / 15) * 100}%` }} />
              <h3 className="mb-1 flex items-center justify-between text-xl font-bold text-yellow-400">
                <span className="flex items-center gap-2"><AlertCircle className="h-5 w-5" /> Buy Property?</span>
                <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-sm font-mono">{buyTimer}s</span>
              </h3>
              <p className="mb-4 text-sm text-slate-300">You landed on an unowned property.</p>

              <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="mb-2 text-lg font-bold text-white">{showPropertyModal.tile.name}</div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Price</span>
                  <span className="font-mono font-bold text-green-400">${showPropertyModal.tile.price}</span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-slate-400">Rent</span>
                  <span className="font-mono font-bold text-rose-400">${showPropertyModal.tile.rent}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => handlePropertyDecision('buy')} className="flex-1 rounded-xl bg-green-500 py-3 font-bold text-white transition hover:bg-green-400">
                  Buy
                </button>
                <button onClick={() => handlePropertyDecision('skip')} className="flex-1 rounded-xl bg-slate-700 py-3 font-bold text-white transition hover:bg-slate-600">
                  Skip
                </button>
              </div>
            </div>
          )}

          {showCardModal && me.status !== 'auction' && (
            <div className="glassmorphism relative overflow-hidden rounded-2xl border border-blue-500/30 p-6 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
              <div className="absolute left-0 top-0 h-1 bg-blue-500 transition-all duration-1000" style={{ width: `${(cardTimer / 10) * 100}%` }} />
              <h3 className="mb-2 text-center text-2xl font-bold text-blue-400">{showCardModal.title}</h3>
              <div className="mb-6 flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-800 p-6 text-center">
                <span className="text-xl font-bold text-white">{showCardModal.message}</span>
              </div>
              <button onClick={() => setShowCardModal(null)} className="w-full rounded-xl bg-blue-500 py-3 font-bold text-white transition hover:bg-blue-400">
                OK
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
