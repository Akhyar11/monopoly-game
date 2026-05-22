import type { AdminRoute } from './types';
import { navItems } from './constants';

export const toAdminRoute = (pathname: string): AdminRoute => {
  const matched = navItems.find((item) => pathname === item.path);
  return matched?.path ?? '/admin';
};

export const navigate = (path: AdminRoute, setPath: (path: AdminRoute) => void) => {
  window.history.pushState({}, '', path);
  setPath(path);
};

export const statusTone = (status: string) => {
  if (status === 'playing' || status === 'ready' || status === 'waiting') return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/25';
  if (status === 'in_debt' || status === 'auction') return 'text-amber-200 bg-amber-500/15 border-amber-500/25';
  if (status === 'bankrupt' || status === 'ended') return 'text-rose-200 bg-rose-500/15 border-rose-500/25';
  return 'text-cyan-200 bg-cyan-500/15 border-cyan-500/25';
};

export const formatCountdown = (timestamp?: number | null) => {
  if (!timestamp) return '-';
  return `${Math.max(0, Math.ceil((timestamp - Date.now()) / 1000))}s`;
};

export const formatDateTime = (timestamp?: number | null) => {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString();
};

export const formatDuration = (ms: number) => {
  if (!ms) return '0m';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};

export const formatJsonValue = (value: unknown, depth = 0): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') return `"${value}"`;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item) => formatJsonValue(item, depth + 1));
    if (depth > 2 || items.join(', ').length > 60) {
      return `[\n  ${items.join(',\n  ')}\n]`;
    }
    return `[${items.join(', ')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) return '{}';
    const entries = keys.map((key) => `"${key}": ${formatJsonValue((value as Record<string, unknown>)[key], depth + 1)}`);
    if (depth > 1 || entries.join(', ').length > 60) {
      return `{\n  ${entries.join(',\n  ').replace(/\n/g, '\n  ')}\n}`;
    }
    return `{ ${entries.join(', ')} }`;
  }
  return String(value);
};

export const getChangedFields = (before: unknown, after: unknown): Array<{key: string; from: unknown; to: unknown}> => {
  if (typeof before !== 'object' || before === null || typeof after !== 'object' || after === null) {
    return [];
  }
  
  const beforeObj = before as Record<string, unknown>;
  const afterObj = after as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  const changes: Array<{key: string; from: unknown; to: unknown}> = [];
  
  for (const key of allKeys) {
    const beforeVal = beforeObj[key];
    const afterVal = afterObj[key];
    
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changes.push({ key, from: beforeVal, to: afterVal });
    }
  }
  
  return changes;
};

export const hasAdminRole = (role: string | undefined, required: string) => {
  if (!role) return false;
  if (role === 'super_admin') return true;
  if (role === 'game_master' && required !== 'super_admin') return true;
  if (role === required) return true;
  return false;
};
