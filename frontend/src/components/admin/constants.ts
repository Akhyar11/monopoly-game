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
import type { AdminRoute, NavItem } from './types';

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
