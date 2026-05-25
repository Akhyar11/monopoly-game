import {
  Activity,
  BarChart3,
  Flag,
  LayoutDashboard,
  ScrollText,
  Settings2,
  Users,
  Image as ImageIcon,
} from 'lucide-react';
import type { AdminRoute, NavItem, GameConfigValue, BoardTile } from './types';

export const ADMIN_API_URL = import.meta.env.VITE_API_URL || window.location.origin;
export const ADMIN_STORAGE_KEY = 'monopoly_admin_token';

export const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, description: 'Operational overview' },
  { label: 'Rooms', path: '/admin/rooms', icon: Activity, description: 'Live room monitor' },
  { label: 'Players', path: '/admin/players', icon: Users, description: 'Player control surface' },
  { label: 'Economy', path: '/admin/economy', icon: Settings2, description: 'Global game config' },
  { label: 'Board', path: '/admin/board', icon: Flag, description: 'Board and tile editor' },
  { label: 'Skins', path: '/admin/skins', icon: ImageIcon, description: 'Board skins' },
  { label: 'Cards', path: '/admin/cards', icon: ScrollText, description: 'Chance & Chest cards' },
  { label: 'Audit Logs', path: '/admin/audit-logs', icon: ScrollText, description: 'Admin action trail' },
  { label: 'Analytics', path: '/admin/analytics', icon: BarChart3, description: 'Economy and match metrics' },
];

export const routeTitle: Record<AdminRoute, { title: string; subtitle: string }> = {
  '/admin': { title: 'Operations Dashboard', subtitle: 'Live operational view across rooms, players, and economy.' },
  '/admin/rooms': { title: 'Room Monitor', subtitle: 'Inspect active rooms and intervene without entering the game client.' },
  '/admin/players': { title: 'Player Control', subtitle: 'Search players, inspect status, and prepare moderation actions.' },
  '/admin/economy': { title: 'Economy Control', subtitle: 'Tune global pacing, debt pressure, and feature toggles.' },
  '/admin/board': { title: 'Board Editor', subtitle: 'Manage tile definitions, rent values, and board publishing flow.' },
  '/admin/skins': { title: 'Board Skins', subtitle: 'Manage visual skins that can be mapped to the board.' },
  '/admin/cards': { title: 'Cards Manager', subtitle: 'Manage Chance and Community Chest cards.' },
  '/admin/audit-logs': { title: 'Audit Log', subtitle: 'Every admin intervention should be visible and traceable here.' },
  '/admin/analytics': { title: 'Analytics', subtitle: 'Use economy and match metrics to guide balancing decisions.' },
};

export const DEFAULT_GAME_CONFIG: GameConfigValue = {
  initialBalance: 1500,
  passGoReward: 100,
  cooldownMs: 10000,
  propertyDecisionMs: 15000,
  debtDecisionMs: 15000,
  tradeExpiryMs: 30000,
  jailFee: 50,
  featureFlags: {
    auction: true,
    trade: true,
    mortgage: true,
    housesHotels: true,
  },
  sfx: {
    rollDice: '',
    buyProperty: '',
    payRent: '',
    bankrupt: '',
    jail: '',
    cardDrawn: '',
    passGo: '',
  },
};

export const DEFAULT_BOARD_TEMPLATE: BoardTile[] = [
  { id: 't0', index: 0, name: 'GO', type: 'go' },
  { id: 't1', index: 1, name: 'Jakarta', type: 'property', price: 60, rent: 10, colorGroup: 'brown', houseCost: 50, buildingLevel: 0, isMortgaged: false },
  { id: 't2', index: 2, name: 'Community Chest', type: 'chest' },
  { id: 't3', index: 3, name: 'Bandung', type: 'property', price: 60, rent: 12, colorGroup: 'brown', houseCost: 50, buildingLevel: 0, isMortgaged: false },
  { id: 't4', index: 4, name: 'Income Tax', type: 'tax', taxAmount: 400 },
  { id: 't5', index: 5, name: 'Gambir Station', type: 'railroad', price: 200, rent: 50, buildingLevel: 0, isMortgaged: false },
  { id: 't6', index: 6, name: 'Surabaya', type: 'property', price: 100, rent: 20, colorGroup: 'lightBlue', houseCost: 50, buildingLevel: 0, isMortgaged: false },
  { id: 't7', index: 7, name: 'Jail (Just Visiting)', type: 'jail' },
  { id: 't8', index: 8, name: 'Semarang', type: 'property', price: 100, rent: 20, colorGroup: 'lightBlue', houseCost: 50, buildingLevel: 0, isMortgaged: false },
  { id: 't9', index: 9, name: 'Chance', type: 'chance' },
  { id: 't10', index: 10, name: 'Yogyakarta', type: 'property', price: 120, rent: 25, colorGroup: 'lightBlue', houseCost: 50, buildingLevel: 0, isMortgaged: false },
  { id: 't11', index: 11, name: 'PLN', type: 'utility', price: 150, rent: 30, buildingLevel: 0, isMortgaged: false },
  { id: 't12', index: 12, name: 'Solo', type: 'property', price: 140, rent: 30, colorGroup: 'pink', houseCost: 100, buildingLevel: 0, isMortgaged: false },
  { id: 't13', index: 13, name: 'Malang', type: 'property', price: 160, rent: 35, colorGroup: 'pink', houseCost: 100, buildingLevel: 0, isMortgaged: false },
  { id: 't14', index: 14, name: 'Free Parking', type: 'parking' },
  { id: 't15', index: 15, name: 'Bali', type: 'property', price: 180, rent: 40, colorGroup: 'orange', houseCost: 100, buildingLevel: 0, isMortgaged: false },
  { id: 't16', index: 16, name: 'Community Chest', type: 'chest' },
  { id: 't17', index: 17, name: 'Lombok', type: 'property', price: 200, rent: 45, colorGroup: 'orange', houseCost: 100, buildingLevel: 0, isMortgaged: false },
  { id: 't18', index: 18, name: 'Pasar Senen Station', type: 'railroad', price: 200, rent: 50, buildingLevel: 0, isMortgaged: false },
  { id: 't19', index: 19, name: 'Makassar', type: 'property', price: 220, rent: 50, colorGroup: 'red', houseCost: 150, buildingLevel: 0, isMortgaged: false },
  { id: 't20', index: 20, name: 'Chance', type: 'chance' },
  { id: 't21', index: 21, name: 'Go To Jail', type: 'gotojail' },
  { id: 't22', index: 22, name: 'Manado', type: 'property', price: 260, rent: 60, colorGroup: 'yellow', houseCost: 150, buildingLevel: 0, isMortgaged: false },
  { id: 't23', index: 23, name: 'Medan', type: 'property', price: 280, rent: 65, colorGroup: 'yellow', houseCost: 150, buildingLevel: 0, isMortgaged: false },
  { id: 't24', index: 24, name: 'PDAM', type: 'utility', price: 150, rent: 30, buildingLevel: 0, isMortgaged: false },
  { id: 't25', index: 25, name: 'Batam', type: 'property', price: 300, rent: 75, colorGroup: 'green', houseCost: 200, buildingLevel: 0, isMortgaged: false },
  { id: 't26', index: 26, name: 'Luxury Tax', type: 'tax', taxAmount: 300 },
  { id: 't27', index: 27, name: 'Papua', type: 'property', price: 400, rent: 100, colorGroup: 'darkBlue', houseCost: 200, buildingLevel: 0, isMortgaged: false },
];

