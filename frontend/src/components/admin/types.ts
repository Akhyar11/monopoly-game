import React from 'react';

export type AdminRoute = '/admin' | '/admin/rooms' | '/admin/players' | '/admin/economy' | '/admin/board' | '/admin/skins' | '/admin/cards' | '/admin/audit-logs' | '/admin/analytics';
export type NoticeTone = 'info' | 'success' | 'warning';

export type NavItem = {
  label: string;
  path: AdminRoute;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
};

export type DashboardSummary = {
  activeRooms: number;
  liveMatches: number;
  endedMatchesToday: number;
  onlinePlayers: number;
  debtCases: number;
  activeTrades: number;
  activeAuctions: number;
  averageMatchDurationMs: number;
};

export type RoomSummary = {
  code: string;
  status: string;
  hostPlayerId: string;
  hostName: string;
  playerCount: number;
  createdAt: number;
  gameStartedAt: number | null;
  activeTrades: number;
  hasAuction: boolean;
  debtCases: number;
  bankruptPlayers: number;
};

export type PlayerSummary = {
  id: string;
  name: string;
  avatar: string;
  roomCode: string;
  balance: number;
  status: string;
  isConnected: boolean;
  properties: number;
  debtDeadline: number | null;
};

export type PlayerDetail = PlayerSummary & {
  position: number;
  cooldownUntil?: number | null;
  rollsLeft?: number;
  ownedTiles: Array<{ id: string; name?: string; isMortgaged?: boolean; buildingLevel?: number }>;
  recentEvents: string[];
};

export type RoomPlayer = {
  id: string;
  name: string;
  avatar: string;
  balance: number;
  properties: string[];
  status: string;
  isConnected: boolean;
  debtDeadline?: number | null;
};

export type RoomDetail = RoomSummary & {
  hostPlayer: RoomPlayer | null;
  players: RoomPlayer[];
  board: Array<{ id: string; ownerPlayerId?: string | null }>;
  eventLog: string[];
  auction: { tileId: string; currentBid: number; highestBidderId: string | null } | null;
  tradeOffers: Array<{ id: string; fromPlayerId: string; toPlayerId: string; expiresAt: number }>;
};

export type AuditLog = {
  id: string;
  timestamp: number;
  adminId: string;
  role: string;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
};

export type Notice = {
  id: string;
  tone: NoticeTone;
  message: string;
};

export type AdminUser = {
  username: string;
  role: string;
  displayName: string;
};

export type GameConfigValue = {
  initialBalance: number;
  passGoReward: number;
  cooldownMs: number;
  propertyDecisionMs: number;
  debtDecisionMs: number;
  tradeExpiryMs: number;
  jailFee: number;
  featureFlags: {
    auction: boolean;
    trade: boolean;
    mortgage: boolean;
    housesHotels: boolean;
  };
  sfx?: {
    rollDice: string;
    buyProperty: string;
    payRent: string;
    bankrupt: string;
    jail: string;
    cardDrawn: string;
    passGo: string;
  };
};

export type GameConfigResponse = {
  key: string;
  value: GameConfigValue;
  updatedBy: string;
  updatedAt: number;
};

export type BoardTile = {
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
};

export type PublishedBoardResponse = {
  id: number;
  versionName: string;
  board: BoardTile[];
  skinId: number | null;
  createdBy: string;
  createdAt: number;
  publishedAt: number | null;
};

export type BoardVersionSummary = {
  id: number;
  versionName: string;
  createdBy: string;
  createdAt: number;
  publishedAt: number | null;
};

export type BoardSkin = {
  id: number;
  name: string;
  type: 'image' | 'color';
  value: string;
  createdBy: string;
  createdAt: number;
}

export interface CardAction {
  type: 'money' | 'move' | 'jail';
  amount?: number;
  position?: number;
  relativePosition?: number;
  target?: 'self' | 'all_others' | 'everyone';
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
