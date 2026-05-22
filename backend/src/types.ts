export type GameStatus = 'waiting' | 'playing' | 'ended';
export type PlayerStatus = 'ready' | 'moving' | 'cooldown' | 'resolving_tile' | 'bankrupt' | 'disconnected' | 'jailed' | 'auction' | 'in_debt';

export interface AuctionState {
  tileId: string;
  participants: string[];
  currentBid: number;
  highestBidderId: string | null;
  expiresAt: number;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offeredPropertyIds: string[];
  requestedPropertyIds: string[];
  offeredCash: number;
  requestedCash: number;
  expiresAt: number;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  balance: number;
  position: number;
  properties: string[]; // array of tile IDs
  status: PlayerStatus;
  isConnected: boolean;
  cooldownUntil: number | null; // timestamp
  rollsLeft: number;
  debtDeadline?: number | null;
  consecutiveDoubles?: number; // for tracking doubles rolls (0-3)
}

export interface Tile {
  id: string;
  index: number;
  name: string;
  type: 'go' | 'property' | 'railroad' | 'utility' | 'tax' | 'chance' | 'chest' | 'jail' | 'gotojail' | 'parking';
  price?: number;
  rent?: number;
  rent1House?: number;
  rent2Houses?: number;
  rent3Houses?: number;
  rent4Houses?: number;
  rentHotel?: number;
  ownerPlayerId?: string | null;
  colorGroup?: string;
  taxAmount?: number;
  houseCost?: number;
  hotelCost?: number;
  buildingLevel?: number;
  isMortgaged?: boolean;
}

export interface BoardSkin {
  id: number;
  name: string;
  type: 'image' | 'color';
  value: string;
  createdBy: string;
  createdAt: number;
}

export interface CardAction {
  type: 'money' | 'move' | 'jail';
  amount?: number; // for money (positive = receive, negative = pay)
  position?: number; // for move
  relativePosition?: number; // for move (e.g. move back 3 spaces)
  target?: 'self' | 'all_others' | 'everyone'; // default 'self'. 'all_others' transfers between drawer and others. 'everyone' applies to all.
}

export interface GameCard {
  id: string;
  type: 'chance' | 'community_chest';
  title: string;
  message: string;
  action: CardAction;
  createdBy: string;
  createdAt: number;
}

export interface Room {
  id: string;
  code: string;
  hostPlayerId: string;
  status: GameStatus;
  players: Player[];
  board: Tile[];
  skin?: BoardSkin | null;
  sfx?: Record<string, string>;
  eventLog: string[];
  createdAt: number;
  gameStartedAt?: number;
  winnerId?: string | null;
  auction?: AuctionState;
  tradeOffers: TradeOffer[];
}

// Client to Server Events
export interface ClientToServerEvents {
  create_room: (data: { name: string; avatar: string; boardId?: number; playerId?: string }, callback: (res: { code: string, playerId: string }) => void) => void;
  join_room: (data: { code: string; name: string; avatar: string; playerId?: string }, callback: (res: { success: boolean, message?: string, playerId?: string }) => void) => void;
  leave_room: () => void;
  start_game: (data: { code: string }) => void;
  roll_dice: (data: { code: string }) => void;
  buy_property: (data: { code: string; tileId: string; decision: 'buy' | 'skip' }) => void;
  pay_jail_fee: (data: { code: string }) => void;
  send_chat_message: (data: { code: string; message: string }) => void;
  end_game: (data: { code: string }) => void;
  place_bid: (data: { code: string; amount: number }) => void;
  build_property: (data: { code: string; tileId: string }) => void;
  sell_building: (data: { code: string; tileId: string }) => void;
  mortgage_property: (data: { code: string; tileId: string }) => void;
  redeem_property: (data: { code: string; tileId: string }) => void;
  send_trade_offer: (data: { code: string; toPlayerId: string; offeredPropertyIds: string[]; requestedPropertyIds: string[]; offeredCash: number; requestedCash: number }) => void;
  respond_trade_offer: (data: { code: string; offerId: string; decision: 'accept' | 'reject' }) => void;
}

// Server to Client Events
export interface ServerToClientEvents {
  room_state_updated: (room: Room) => void;
  event_log: (message: string) => void;
  dice_rolled: (data: { playerId: string, roll: number, dice1: number, dice2: number }) => void;
  player_moved: (data: { playerId: string, position: number }) => void;
  property_decision: (data: { playerId: string, tile: Tile }) => void; // Triggered when a player lands on unowned property
  error_message: (message: string) => void;
  chat_message: (data: { playerName: string; message: string }) => void;
  card_drawn: (data: { title: string; message: string }) => void;
  trade_offer_received: (offer: TradeOffer) => void;
  trade_offer_status: (data: { offerId: string; status: 'accepted' | 'rejected' | 'expired' | 'sent'; message: string }) => void;
  play_sfx: (sfxKey: keyof NonNullable<Room['sfx']>) => void;
}
