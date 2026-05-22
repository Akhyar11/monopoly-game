import React, { useEffect, useMemo, useState } from 'react';
import {
  Lock,
  Radio,
  Shield,
} from 'lucide-react';

import type { AdminRoute, DashboardSummary, RoomSummary, PlayerSummary, PlayerDetail, AuditLog, Notice, NoticeTone, AdminUser, GameConfigValue, GameConfigResponse, PublishedBoardResponse, BoardVersionSummary, BoardTile, BoardSkin, RoomDetail, GameCard, CardAction } from './types';
import { ADMIN_API_URL, ADMIN_STORAGE_KEY, navItems, routeTitle } from './constants';
import { toAdminRoute, navigate, hasAdminRole } from './utils';
import { fetchAdmin } from './api';
import { DashboardView } from './views/DashboardView';
import { RoomsView } from './views/RoomsView';
import { PlayersView } from './views/PlayersView';
import { EconomyView } from './views/EconomyView';
import { BoardView } from './views/BoardView';
import { SkinsView } from './views/SkinsView';
import { AuditLogsView } from './views/AuditLogsView';
import { CardsView } from './views/CardsView';

export const AdminPanel: React.FC = () => {
  const [path, setPath] = useState<AdminRoute>(toAdminRoute(window.location.pathname));
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ADMIN_STORAGE_KEY));
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'admin123' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(!!localStorage.getItem(ADMIN_STORAGE_KEY));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetail | null>(null);
  const [selectedRoomCode, setSelectedRoomCode] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomDetail | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [configData, setConfigData] = useState<GameConfigResponse | null>(null);
  const [configDraft, setConfigDraft] = useState<GameConfigValue | null>(null);
  const [boardData, setBoardData] = useState<PublishedBoardResponse | null>(null);
  const [boardVersions, setBoardVersions] = useState<BoardVersionSummary[]>([]);
  const [boardSkins, setBoardSkins] = useState<BoardSkin[]>([]);
  const [cards, setCards] = useState<GameCard[]>([]);
  const [newSkin, setNewSkin] = useState<{ name: string; type: 'image' | 'color'; value: string; file?: File }>({ name: '', type: 'image', value: '' });
  const [selectedBoardTileId, setSelectedBoardTileId] = useState<string | null>(null);
  const [boardVersionName, setBoardVersionName] = useState('');
  const [boardSkinId, setBoardSkinId] = useState<string>('');
  const [draggedTileIndex, setDraggedTileIndex] = useState<number | null>(null);
  const canKickPlayers = hasAdminRole(adminUser?.role, 'support');
  const canManageRooms = hasAdminRole(adminUser?.role, 'game_master');
  const canManageCooldowns = hasAdminRole(adminUser?.role, 'game_master');
  const canManageBalances = hasAdminRole(adminUser?.role, 'super_admin');

  useEffect(() => {
    const onPopState = () => setPath(toAdminRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const selectedRoomSummary = useMemo(
    () => rooms.find((room) => room.code === selectedRoomCode) ?? rooms[0] ?? null,
    [rooms, selectedRoomCode],
  );

  useEffect(() => {
    if (!selectedPlayerId && players.length > 0) {
      setSelectedPlayerId(players[0].id);
    }
  }, [players, selectedPlayerId]);

  useEffect(() => {
    if (!selectedRoomCode && rooms.length > 0) {
      setSelectedRoomCode(rooms[0].code);
    }
  }, [rooms, selectedRoomCode]);

  useEffect(() => {
    if (!selectedBoardTileId && boardData && boardData.board.length > 0) {
      setSelectedBoardTileId(boardData.board[0].id);
    }
  }, [boardData, selectedBoardTileId]);

  useEffect(() => {
    if (!token) {
      setAuthChecking(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const bootstrap = async () => {
      try {
        const data = await fetchAdmin<{ user: AdminUser }>('/admin/auth/me', token);
        if (!cancelled) {
          setAdminUser(data.user);
          setAuthChecking(false);
        }
      } catch {
        if (!cancelled) {
          setToken(null);
          setAdminUser(null);
          setAuthChecking(false);
          localStorage.removeItem(ADMIN_STORAGE_KEY);
        }
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const load = async (isInitial = false) => {
      if (isInitial) setLoading(true);
      setError(null);
      try {
        const [dashboardData, roomData, playerData, auditData] = await Promise.all([
          fetchAdmin<DashboardSummary>('/admin/dashboard/summary', token),
          fetchAdmin<RoomSummary[]>('/admin/rooms', token),
          fetchAdmin<PlayerSummary[]>('/admin/players', token),
          fetchAdmin<AuditLog[]>('/admin/audit-logs', token),
        ]);

        if (cancelled) return;
        setSummary(dashboardData);
        setRooms(roomData);
        setPlayers(playerData);
        setAuditLogs(auditData);
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : 'Failed to load admin data';
        setError(message);
        if (message.toLowerCase().includes('unauthorized')) {
          setToken(null);
          setAdminUser(null);
          localStorage.removeItem(ADMIN_STORAGE_KEY);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load(true);
    const interval = window.setInterval(() => load(false), 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
    if (!selectedRoomSummary || !token) {
      setSelectedRoom(null);
      return;
    }

    let cancelled = false;
    const loadRoom = async () => {
      try {
        const roomData = await fetchAdmin<RoomDetail>(`/admin/rooms/${selectedRoomSummary.code}`, token);
        if (!cancelled) setSelectedRoom(roomData);
      } catch (loadError) {
        if (!cancelled) {
          setSelectedRoom(null);
          setError(loadError instanceof Error ? loadError.message : 'Failed to load room detail');
        }
      }
    };

    loadRoom();
    const interval = window.setInterval(loadRoom, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedRoomSummary, token]);

  useEffect(() => {
    if (!selectedPlayerId || !token) {
      setSelectedPlayer(null);
      return;
    }

    let cancelled = false;
    const loadPlayer = async () => {
      try {
        const playerData = await fetchAdmin<PlayerDetail>(`/admin/players/${selectedPlayerId}`, token);
        if (!cancelled) setSelectedPlayer(playerData);
      } catch (loadError) {
        if (!cancelled) {
          setSelectedPlayer(null);
          setError(loadError instanceof Error ? loadError.message : 'Failed to load player detail');
        }
      }
    };

    loadPlayer();
    const interval = window.setInterval(loadPlayer, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedPlayerId, token]);

  useEffect(() => {
    if (!token || path !== '/admin/economy') return;

    let cancelled = false;
    const loadConfig = async () => {
      try {
        const data = await fetchAdmin<GameConfigResponse>('/admin/config', token);
        if (cancelled) return;
        setConfigData(data);
        setConfigDraft(data.value);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load config');
        }
      }
    };

    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, [path, token]);

  useEffect(() => {
    if (!token || path !== '/admin/board') return;

    let cancelled = false;
    const loadBoard = async () => {
      try {
        const [publishedBoard, versions] = await Promise.all([
          fetchAdmin<PublishedBoardResponse>('/admin/board', token),
          fetchAdmin<BoardVersionSummary[]>('/admin/board/versions', token),
        ]);
        if (cancelled) return;
        setBoardData(publishedBoard);
        setBoardVersions(versions);
        setBoardVersionName(`${publishedBoard.versionName}-copy`);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load board');
        }
      }
    };

    void loadBoard();
    return () => {
      cancelled = true;
    };
  }, [path, token]);

  useEffect(() => {
    if (!token || (path !== '/admin/skins' && path !== '/admin/board')) return;

    let cancelled = false;
    const loadSkins = async () => {
      try {
        const skins = await fetchAdmin<BoardSkin[]>('/admin/skins', token);
        if (cancelled) return;
        setBoardSkins(skins);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load skins');
        }
      }
    };

    void loadSkins();
    return () => {
      cancelled = true;
    };
  }, [path, token]);

  useEffect(() => {
    if (!token || path !== '/admin/cards') return;

    let cancelled = false;
    const loadCards = async () => {
      try {
        const data = await fetchAdmin<GameCard[]>('/admin/cards', token);
        if (cancelled) return;
        setCards(data);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load cards');
        }
      }
    };

    void loadCards();
    return () => {
      cancelled = true;
    };
  }, [path, token]);

  const pageMeta = routeTitle[path];
  const selectedBoardTile = boardData?.board.find((tile) => tile.id === selectedBoardTileId) ?? null;

  const pushNotice = (message: string, tone: NoticeTone) => {
    setNotices((items) => [...items, { id: `${Date.now()}_${Math.random()}`, message, tone }].slice(-4));
  };

  const removeNotice = (id: string) => {
    setNotices((items) => items.filter((item) => item.id !== id));
  };

  const refreshAuditLogs = async () => {
    if (!token) return;
    const data = await fetchAdmin<AuditLog[]>('/admin/audit-logs', token);
    setAuditLogs(data);
  };

  const refreshRooms = async () => {
    if (!token) return;
    const [roomData, dashboardData] = await Promise.all([
      fetchAdmin<RoomSummary[]>('/admin/rooms', token),
      fetchAdmin<DashboardSummary>('/admin/dashboard/summary', token),
    ]);
    setRooms(roomData);
    setSummary(dashboardData);
  };

  const refreshPlayers = async () => {
    if (!token) return;
    const data = await fetchAdmin<PlayerSummary[]>('/admin/players', token);
    setPlayers(data);
  };

  const refreshConfig = async () => {
    if (!token) return;
    const data = await fetchAdmin<GameConfigResponse>('/admin/config', token);
    setConfigData(data);
    setConfigDraft(data.value);
  };

  const refreshBoard = async () => {
    if (!token) return;
    const [publishedBoard, versions] = await Promise.all([
      fetchAdmin<PublishedBoardResponse>('/admin/board', token),
      fetchAdmin<BoardVersionSummary[]>('/admin/board/versions', token),
    ]);
    setBoardData(publishedBoard);
    setBoardVersions(versions);
    setBoardVersionName(`${publishedBoard.versionName}-copy`);
    setBoardSkinId(publishedBoard.skinId ? String(publishedBoard.skinId) : '');
  };

  const refreshSkins = async () => {
    if (!token) return;
    const skins = await fetchAdmin<BoardSkin[]>('/admin/skins', token);
    setBoardSkins(skins);
  };

  const refreshCards = async () => {
    if (!token) return;
    const data = await fetchAdmin<GameCard[]>('/admin/cards', token);
    setCards(data);
  };

  const handleCreateSkin = async (skinToCreate?: { name: string; type: 'image' | 'color'; value: string; file?: File }) => {
    const data = skinToCreate || newSkin;
    if (!token || !data.name || (!data.value && !data.file)) return;
    try {
      let finalValue = data.value;
      
      if (data.type === 'image' && data.file) {
        const formData = new FormData();
        formData.append('image', data.file);
        
        const uploadRes = await fetchAdmin<{ url: string }>('/admin/upload', token, {
          method: 'POST',
          body: formData,
        });
        finalValue = uploadRes.url;
      }

      await fetchAdmin('/admin/skins', token, {
        method: 'POST',
        body: JSON.stringify({ name: data.name, type: data.type, value: finalValue }),
      });
      pushNotice('Board skin created successfully', 'success');
      setNewSkin({ name: '', type: 'image', value: '' });
      await refreshSkins();
    } catch (e) {
      pushNotice(e instanceof Error ? e.message : 'Failed to create skin', 'warning');
    }
  };

  const handleDeleteSkin = async (id: number) => {
    if (!token) return;
    if (!window.confirm('Are you sure you want to delete this skin?')) return;
    try {
      await fetchAdmin(`/admin/skins/${id}`, token, { method: 'DELETE' });
      pushNotice('Skin deleted', 'info');
      await refreshSkins();
    } catch (e) {
      pushNotice(e instanceof Error ? e.message : 'Failed to delete skin', 'warning');
    }
  };

  const handleCreateCard = async (type: 'chance' | 'community_chest', title: string, message: string, action: CardAction) => {
    if (!token) return;
    try {
      await fetchAdmin('/admin/cards', token, {
        method: 'POST',
        body: JSON.stringify({ type, title, message, action }),
      });
      pushNotice('Card created successfully', 'success');
      await refreshCards();
    } catch (e) {
      pushNotice(e instanceof Error ? e.message : 'Failed to create card', 'warning');
    }
  };

  const handleImportCards = async (importedCards: Partial<GameCard>[]) => {
    if (!token) return;
    try {
      const res = await fetchAdmin<{ message: string }>('/admin/cards/import', token, {
        method: 'POST',
        body: JSON.stringify(importedCards),
      });
      pushNotice(res.message, 'success');
      await refreshCards();
    } catch (e) {
      pushNotice(e instanceof Error ? e.message : 'Failed to import cards', 'warning');
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (!token) return;
    if (!window.confirm('Are you sure you want to delete this card?')) return;
    try {
      await fetchAdmin(`/admin/cards/${id}`, token, { method: 'DELETE' });
      pushNotice('Card deleted', 'info');
      await refreshCards();
    } catch (e) {
      pushNotice(e instanceof Error ? e.message : 'Failed to delete card', 'warning');
    }
  };

  const handleBroadcast = async () => {
    if (!selectedRoomSummary) return;
    const message = window.prompt(`Broadcast message to room ${selectedRoomSummary.code}:`);
    if (!message?.trim()) return;

    try {
      if (!token) return;
      await fetchAdmin(`/admin/rooms/${selectedRoomSummary.code}/broadcast`, token, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      await Promise.all([refreshRooms(), refreshPlayers(), refreshAuditLogs()]);
      pushNotice(`Broadcast sent to ${selectedRoomSummary.code}.`, 'success');
    } catch (actionError) {
      pushNotice(actionError instanceof Error ? actionError.message : 'Broadcast failed', 'warning');
    }
  };

  const handleForceEnd = async () => {
    if (!selectedRoomSummary) return;
    const confirmed = window.confirm(`Force end room ${selectedRoomSummary.code}?`);
    if (!confirmed) return;

    try {
      if (!token) return;
      await fetchAdmin(`/admin/rooms/${selectedRoomSummary.code}/end`, token, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Force ended from admin panel' }),
      });
      await Promise.all([refreshRooms(), refreshPlayers(), refreshAuditLogs()]);
      pushNotice(`Room ${selectedRoomSummary.code} ended.`, 'success');
    } catch (actionError) {
      pushNotice(actionError instanceof Error ? actionError.message : 'End room failed', 'warning');
    }
  };

  const runPlayerAction = async (action: 'balance' | 'release-jail' | 'reset-cooldown' | 'bankrupt' | 'kick') => {
    if (!selectedPlayer) return;

    try {
      if (!token) return;
      if (action === 'balance') {
        const nextBalance = window.prompt(`Set balance for ${selectedPlayer.name}:`, String(selectedPlayer.balance));
        if (nextBalance === null) return;
        await fetchAdmin(`/admin/players/${selectedPlayer.id}/balance`, token, {
          method: 'POST',
          body: JSON.stringify({ balance: Number(nextBalance) }),
        });
      } else {
        const confirmed = window.confirm(`Run "${action}" for ${selectedPlayer.name}?`);
        if (!confirmed) return;
        await fetchAdmin(`/admin/players/${selectedPlayer.id}/${action}`, token, { method: 'POST' });
      }

      await Promise.all([refreshPlayers(), refreshRooms(), refreshAuditLogs()]);
      const refreshed = await fetchAdmin<PlayerDetail>(`/admin/players/${selectedPlayer.id}`, token);
      setSelectedPlayer(refreshed);
      pushNotice(`Action "${action}" applied to ${selectedPlayer.name}.`, 'success');
    } catch (actionError) {
      pushNotice(actionError instanceof Error ? actionError.message : 'Player action failed', 'warning');
    }
  };

  const updateConfigNumber = (field: keyof Omit<GameConfigValue, 'featureFlags' | 'sfx'>, value: string) => {
    setConfigDraft((current) => (current ? { ...current, [field]: Number(value) } : current));
  };

  const updateConfigFlag = (field: keyof GameConfigValue['featureFlags'], value: boolean) => {
    setConfigDraft((current) =>
      current
        ? {
            ...current,
            featureFlags: {
              ...current.featureFlags,
              [field]: value,
            },
          }
        : current,
    );
  };

  const updateConfigSfx = (field: keyof NonNullable<GameConfigValue['sfx']>, value: string) => {
    setConfigDraft((current) =>
      current
        ? {
            ...current,
            sfx: {
              ...(current.sfx || { rollDice: '', buyProperty: '', payRent: '', bankrupt: '', jail: '', cardDrawn: '', passGo: '' }),
              [field]: value,
            },
          }
        : current,
    );
  };

  const handleUploadAudio = async (file: File): Promise<string | null> => {
    if (!token) return null;
    const formData = new FormData();
    formData.append('image', file); // using existing 'image' field expected by multer
    try {
      const res = await fetch('/admin/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      return data.url;
    } catch (e) {
      pushNotice(e instanceof Error ? e.message : 'Upload failed', 'warning');
      return null;
    }
  };

  const handleSaveConfig = async () => {
    if (!token || !configDraft) return;

    try {
      await fetchAdmin('/admin/config', token, {
        method: 'PUT',
        body: JSON.stringify(configDraft),
      });
      await Promise.all([refreshConfig(), refreshAuditLogs()]);
      pushNotice('Game config updated in MySQL.', 'success');
    } catch (actionError) {
      pushNotice(actionError instanceof Error ? actionError.message : 'Config update failed', 'warning');
    }
  };

  const updateBoardTile = (field: keyof BoardTile, rawValue: string | boolean) => {
    setBoardData((current) => {
      if (!current || !selectedBoardTileId) return current;
      return {
        ...current,
        board: current.board.map((tile) => {
          if (tile.id !== selectedBoardTileId) return tile;

          const nextTile = { ...tile };
          if (typeof rawValue === 'boolean') {
            (nextTile as Record<string, unknown>)[field] = rawValue;
            return nextTile;
          }

          if (['index', 'price', 'rent', 'taxAmount', 'houseCost', 'buildingLevel', 'rent1House', 'rent2Houses', 'rent3Houses', 'rent4Houses', 'rentHotel', 'hotelCost'].includes(String(field))) {
            const trimmed = rawValue.trim();
            if (trimmed === '') {
              delete (nextTile as Record<string, unknown>)[field];
            } else {
              (nextTile as Record<string, unknown>)[field] = Number(trimmed);
            }
            return nextTile;
          }

          if (field === 'ownerPlayerId') {
            nextTile.ownerPlayerId = rawValue.trim() ? rawValue : null;
            return nextTile;
          }

          (nextTile as Record<string, unknown>)[field] = rawValue;
          return nextTile;
        }),
      };
    });
  };

  const handleAddTile = () => {
    setBoardData((current) => {
      if (!current) return current;
      const newTile: BoardTile = {
        id: `t${Date.now()}`,
        index: current.board.length,
        name: 'New Tile',
        type: 'property',
        price: 100,
        rent: 10,
        colorGroup: 'gray',
        houseCost: 50,
      };
      return { ...current, board: [...current.board, newTile] };
    });
  };

  const handleRemoveTile = (tileId: string) => {
    setBoardData((current) => {
      if (!current) return current;
      const newBoard = current.board.filter(t => t.id !== tileId).map((t, idx) => ({ ...t, index: idx }));
      return { ...current, board: newBoard };
    });
    if (selectedBoardTileId === tileId) setSelectedBoardTileId(null);
  };

  const handleLoadVersion = async (versionId: number) => {
    if (!token) return;
    try {
      const version = await fetchAdmin<PublishedBoardResponse>(`/admin/board/versions/${versionId}`, token);
      setBoardData(version);
      setBoardVersionName(`${version.versionName} (copy)`);
      setBoardSkinId(version.skinId ? String(version.skinId) : '');
      pushNotice(`Loaded version: ${version.versionName}`, 'success');
    } catch (actionError) {
      pushNotice(actionError instanceof Error ? actionError.message : 'Failed to load version', 'warning');
    }
  };

  const handleImportBoard = (importedBoard: BoardTile[]) => {
    if (!canManageBalances) return;
    setBoardData((current) => {
      if (!current) return current;
      const parsedBoard = importedBoard.map((tile, idx) => ({ ...tile, index: idx }));
      return { ...current, board: parsedBoard };
    });
    setBoardVersionName('Imported Board');
    setSelectedBoardTileId(null);
    pushNotice(`Successfully imported ${importedBoard.length} tiles.`, 'success');
  };

  const handleResetBoardDraft = () => {
    void refreshBoard().then(() => pushNotice('Board draft reset to published version.', 'info')).catch((actionError) => {
      pushNotice(actionError instanceof Error ? actionError.message : 'Board reset failed', 'warning');
    });
  };

  const handleClearBoard = () => {
    if (!canManageBalances) return;
    setBoardData((current) => {
      if (!current) return current;
      return { ...current, board: [] };
    });
    setBoardVersionName('New Custom Board');
    setBoardSkinId('');
    setSelectedBoardTileId(null);
    pushNotice('Board cleared to 0 tiles.', 'info');
  };

  const handleDragStart = (index: number) => {
    if (!canManageBalances) return;
    setDraggedTileIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!canManageBalances) return;
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number) => {
    if (!canManageBalances || draggedTileIndex === null || draggedTileIndex === targetIndex) return;
    
    setBoardData((current) => {
      if (!current) return current;
      const newBoard = [...current.board];
      const [draggedTile] = newBoard.splice(draggedTileIndex, 1);
      newBoard.splice(targetIndex, 0, draggedTile);
      const updatedBoard = newBoard.map((t, idx) => ({ ...t, index: idx }));
      return { ...current, board: updatedBoard };
    });
    setDraggedTileIndex(null);
  };


  const handlePublishBoard = async () => {
    if (!token || !boardData) return;
    const versionName = boardVersionName.trim();
    if (!versionName) {
      pushNotice('Version name is required before publishing.', 'warning');
      return;
    }

    try {
      await fetchAdmin('/admin/board/publish', token, {
        method: 'POST',
        body: JSON.stringify({ versionName, board: boardData.board, skinId: boardSkinId || null }),
      });
      await Promise.all([refreshBoard(), refreshAuditLogs()]);
      pushNotice(`Board version "${versionName}" published to MySQL.`, 'success');
    } catch (actionError) {
      pushNotice(actionError instanceof Error ? actionError.message : 'Board publish failed', 'warning');
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginLoading(true);
    setError(null);
    try {
      const response = await fetch(`${ADMIN_API_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Login failed');
      }

      localStorage.setItem(ADMIN_STORAGE_KEY, payload.token);
      setToken(payload.token);
      setAdminUser(payload.user);
      setAuthChecking(false);
      pushNotice(`Logged in as ${payload.user.displayName}.`, 'success');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (token) {
        await fetchAdmin('/admin/auth/logout', token, { method: 'POST' });
      }
    } catch {
      // ignore logout errors
    } finally {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      setToken(null);
      setAdminUser(null);
      setAuthChecking(false);
      setSummary(null);
      setRooms([]);
      setPlayers([]);
      setAuditLogs([]);
      setSelectedRoom(null);
      setSelectedPlayer(null);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#123047_0%,#08111f_52%,#020617_100%)] p-4 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-md items-center justify-center">
          <div className="w-full rounded-[34px] border border-slate-800 bg-slate-950/70 p-8 text-center text-sm text-slate-400">
            Verifying admin session...
          </div>
        </div>
      </div>
    );
  }

  if (!token || !adminUser) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#123047_0%,#08111f_52%,#020617_100%)] p-4 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-md items-center justify-center">
          <div className="w-full rounded-[34px] border border-slate-800 bg-slate-950/70 p-8 shadow-[0_30px_80px_rgba(2,6,23,0.4)]">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-400/15 p-3 text-cyan-200"><Shield className="h-6 w-6" /></div>
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Admin Login</div>
                <div className="mt-1 text-2xl font-black text-white">Turnless Monopoly</div>
              </div>
            </div>
            <p className="mb-6 text-sm text-slate-400">Use the seeded local admin credentials to access operations tooling.</p>
            {error && <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div>}
            <form onSubmit={handleLogin} className="space-y-4">
              <label className="block text-sm text-slate-300">
                Username
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-white outline-none"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Password
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-white outline-none"
                />
              </label>
              <button disabled={loginLoading} className="w-full rounded-2xl bg-cyan-500 py-3 font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">
                {loginLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
              Default local credentials:
              <div className="mt-2">`admin / admin123`</div>
              <div>`ops / ops123`</div>
              <div>`support / support123`</div>
              <div>`analyst / analyst123`</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderLoading = () => (
    <div className="rounded-[30px] border border-slate-800 bg-slate-950/70 p-8 text-sm text-slate-400">
      Loading admin data...
    </div>
  );

  const renderError = () => error ? (
    <div className="rounded-[30px] border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-100">
      {error}
    </div>
  ) : null;

  
  
  
  
  
  
  const renderPlaceholder = (title: string, bullets: string[]) => (
    <div className="rounded-[30px] border border-slate-800 bg-slate-950/70 p-6">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {bullets.map((bullet) => (
          <div key={bullet} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
            {bullet}
          </div>
        ))}
      </div>
    </div>
  );

  
  const renderContent = () => {
    if (loading) return renderLoading();

    switch (path) {
      case '/admin':
        return <DashboardView summary={summary} rooms={rooms} auditLogs={auditLogs} setPath={setPath} />;
      case '/admin/rooms':
        return <RoomsView rooms={rooms} selectedRoomSummary={selectedRoomSummary} setSelectedRoomCode={setSelectedRoomCode} selectedRoom={selectedRoom} canManageRooms={canManageRooms} handleBroadcast={handleBroadcast} handleForceEnd={handleForceEnd} />;
      case '/admin/players':
        return <PlayersView players={players} selectedPlayerId={selectedPlayerId} setSelectedPlayerId={setSelectedPlayerId} selectedPlayer={selectedPlayer} canManageBalances={canManageBalances} canManageCooldowns={canManageCooldowns} canKickPlayers={canKickPlayers} runPlayerAction={runPlayerAction} />;
      case '/admin/audit-logs':
        return <AuditLogsView auditLogs={auditLogs} />;
      case '/admin/economy':
        return <EconomyView configData={configData} configDraft={configDraft} canManageBalances={canManageBalances} updateConfigNumber={updateConfigNumber} updateConfigFlag={updateConfigFlag} updateConfigSfx={updateConfigSfx} handleUploadAudio={handleUploadAudio} handleSaveConfig={handleSaveConfig} refreshConfig={refreshConfig} renderLoading={renderLoading} />;
      case '/admin/board':
        return <BoardView boardData={boardData} boardVersions={boardVersions} boardSkins={boardSkins} boardVersionName={boardVersionName} setBoardVersionName={setBoardVersionName} boardSkinId={boardSkinId} setBoardSkinId={setBoardSkinId} selectedBoardTileId={selectedBoardTileId} setSelectedBoardTileId={setSelectedBoardTileId} selectedBoardTile={selectedBoardTile} canManageBalances={canManageBalances} draggedTileIndex={draggedTileIndex} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDrop={handleDrop} handleAddTile={handleAddTile} updateBoardTile={updateBoardTile} handleRemoveTile={handleRemoveTile} handlePublishBoard={handlePublishBoard} handleResetBoardDraft={handleResetBoardDraft} handleClearBoard={handleClearBoard} handleLoadVersion={handleLoadVersion} handleImportBoard={handleImportBoard} renderLoading={renderLoading} />;
      case '/admin/skins':
        return <SkinsView boardSkins={boardSkins} handleCreateSkin={handleCreateSkin} handleDeleteSkin={handleDeleteSkin} />;
      case '/admin/cards':
        return <CardsView cards={cards} handleCreateCard={handleCreateCard} handleDeleteCard={handleDeleteCard} handleImportCards={handleImportCards} />;
      case '/admin/analytics':
        return renderPlaceholder('Analytics Draft', ['Most profitable properties and debt hotspot tracking.', 'Trade frequency, bankruptcy rate, and average match duration.', 'Charts should be fed by persisted match summaries, not live room memory only.']);
      default:
        return <DashboardView summary={summary} rooms={rooms} auditLogs={auditLogs} setPath={setPath} />;
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#123047_0%,#08111f_52%,#020617_100%)] text-slate-100">
      {notices.length > 0 && (
        <div className="fixed right-4 top-4 z-[90] flex w-80 flex-col gap-2">
          {notices.map((notice) => (
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

      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-800 bg-slate-950/80 p-6">
          <div className="rounded-[28px] border border-cyan-500/15 bg-[linear-gradient(160deg,rgba(9,32,48,0.95),rgba(7,14,24,0.95))] p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-400/15 p-3 text-cyan-200"><Shield className="h-6 w-6" /></div>
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Admin Console</div>
                <div className="mt-1 text-xl font-black text-white">Turnless Monopoly</div>
              </div>
            </div>
            <div className="mt-4 text-sm text-slate-400">Live backend monitor for rooms, players, and game interventions.</div>
          </div>

          <nav className="mt-6 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.path === path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path, setPath)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    active
                      ? 'border-cyan-500/40 bg-cyan-500/12 shadow-[0_12px_30px_rgba(34,211,238,0.08)]'
                      : 'border-slate-800 bg-slate-950/45 hover:border-slate-700 hover:bg-slate-900/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2 ${active ? 'bg-cyan-400/15 text-cyan-200' : 'bg-slate-900 text-slate-400'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">{item.label}</div>
                      <div className="text-xs text-slate-500">{item.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="p-4 md:p-6 xl:p-8">
          <div className="rounded-[34px] border border-slate-800 bg-slate-950/50 p-4 md:p-6 xl:p-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Admin Route</div>
                <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">{pageMeta.title}</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-400 md:text-base">{pageMeta.subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm text-slate-300">
                  <Radio className="mr-2 inline h-4 w-4 text-emerald-300" /> API healthy
                </div>
                <div className="rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm text-slate-300">
                  <Lock className="mr-2 inline h-4 w-4 text-cyan-300" /> {adminUser.displayName} ({adminUser.role})
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200"
                >
                  Logout
                </button>
                <button
                  onClick={() => {
                    window.location.href = '/';
                  }}
                  className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200"
                >
                  Exit Admin
                </button>
              </div>
            </div>

            {renderError()}
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};
