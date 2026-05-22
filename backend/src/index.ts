import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { GameEngine } from './gameEngine';
import { ClientToServerEvents, ServerToClientEvents } from './types';
import { AdminService } from './adminService';
import { AdminAuthService, AdminRole } from './adminAuth';
import { ensureAdminDatabase } from './db';
import { loadGameConfigCache, getGameConfig } from './configStore';
import { loadBoardTemplateCache } from './boardStore';
import { validateBoardTemplate, validateGameConfig, validateVersionName } from './adminValidation';
import multer from 'multer';
import path from 'path';

const upload = multer({ dest: path.join(process.cwd(), 'uploads/') });

const app = express();
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(express.static(path.join(__dirname, '../public')));
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const engine = new GameEngine(
  (code, room) => {
    io.to(code).emit('room_state_updated', room);
  },
  (_code, playerId, data) => {
    io.to(playerId).emit('trade_offer_status', data);
  },
  (code, sfxKey) => {
    io.to(code).emit('play_sfx', sfxKey);
  }
);
const adminService = new AdminService(engine);
const adminAuth = new AdminAuthService();
const roleRank: Record<AdminRole, number> = {
  analyst: 0,
  support: 1,
  game_master: 2,
  super_admin: 3,
};

const getBearerToken = (req: express.Request) => {
  const authHeader = req.header('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return undefined;
  return authHeader.slice('Bearer '.length);
};

const requireAdminAuth: express.RequestHandler = (req, res, next) => {
  void (async () => {
    const token = getBearerToken(req);
    const session = await adminAuth.getSession(token);
    if (!session) {
      res.status(401).json({ message: 'Unauthorized admin session' });
      return;
    }

    res.locals.adminSession = session;
    next();
  })().catch((error: unknown) => {
    console.error('Admin auth failed:', error);
    res.status(500).json({ message: 'Admin auth failed' });
  });
};

const requireAdminRole = (minimumRole: AdminRole): express.RequestHandler => {
  return (_req, res, next) => {
    const currentRole = res.locals.adminSession?.role as AdminRole | undefined;
    if (!currentRole || roleRank[currentRole] < roleRank[minimumRole]) {
      res.status(403).json({ message: `Forbidden: requires ${minimumRole} role` });
      return;
    }

    next();
  };
};

const getAdminContext = (res: express.Response) => ({
  adminId: String(res.locals.adminSession?.username || 'unknown-admin'),
  role: (res.locals.adminSession?.role || 'support') as 'super_admin' | 'game_master' | 'support' | 'analyst',
});

app.post('/admin/upload', requireAdminAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: 'No image uploaded' });
    return;
  }
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

app.post('/admin/auth/login', (req, res) => {
  void (async () => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const session = await adminAuth.login(username, password);
    if (!session) {
      res.status(401).json({ message: 'Invalid admin credentials' });
      return;
    }

    res.json({
      token: session.token,
      user: {
        username: session.username,
        role: session.role,
        displayName: session.displayName,
      },
    });
  })().catch((error: unknown) => {
    console.error('Admin login failed:', error);
    res.status(500).json({ message: 'Admin login failed' });
  });
});

app.get('/admin/auth/me', requireAdminAuth, (_req, res) => {
  res.json({
    user: {
      username: res.locals.adminSession.username,
      role: res.locals.adminSession.role,
      displayName: res.locals.adminSession.displayName,
    },
  });
});

app.post('/admin/auth/logout', requireAdminAuth, (req, res) => {
  void (async () => {
    const token = getBearerToken(req);
    if (token) await adminAuth.logout(token);
    res.json({ success: true });
  })().catch((error: unknown) => {
    console.error('Admin logout failed:', error);
    res.status(500).json({ message: 'Admin logout failed' });
  });
});

app.get('/admin/dashboard/summary', requireAdminAuth, (_req, res) => {
  res.json(adminService.getDashboardSummary());
});

app.get('/admin/rooms', requireAdminAuth, (_req, res) => {
  res.json(adminService.getRooms());
});

app.get('/admin/rooms/:code', requireAdminAuth, (req, res) => {
  const roomCode = String(req.params.code);
  const room = adminService.getRoomDetail(roomCode);
  if (!room) {
    res.status(404).json({ message: 'Room not found' });
    return;
  }
  res.json(room);
});

app.post('/admin/rooms/:code/broadcast', requireAdminAuth, requireAdminRole('game_master'), (req, res) => {
  void (async () => {
    const roomCode = String(req.params.code);
    const message = String(req.body?.message || '').trim();
    if (!message) {
      res.status(400).json({ message: 'Message is required' });
      return;
    }

    const room = await adminService.broadcastToRoom(roomCode, message, getAdminContext(res));
    if (!room) {
      res.status(404).json({ message: 'Room not found' });
      return;
    }

    io.to(room.code).emit('room_state_updated', room);
    res.json({ success: true, room });
  })().catch((error: unknown) => {
    console.error('Admin broadcast failed:', error);
    res.status(500).json({ message: 'Admin broadcast failed' });
  });
});

app.post('/admin/rooms/:code/end', requireAdminAuth, requireAdminRole('game_master'), (req, res) => {
  void (async () => {
    const roomCode = String(req.params.code);
    const reason = String(req.body?.reason || 'Ended by admin');
    const room = await adminService.forceEndRoom(roomCode, reason, getAdminContext(res));
    if (!room) {
      res.status(404).json({ message: 'Room not found' });
      return;
    }

    io.to(room.code).emit('room_state_updated', room);
    res.json({ success: true, room });
  })().catch((error: unknown) => {
    console.error('Admin end room failed:', error);
    res.status(500).json({ message: 'Admin end room failed' });
  });
});

app.get('/admin/players', requireAdminAuth, (_req, res) => {
  res.json(adminService.getPlayers());
});

app.get('/admin/players/:id', requireAdminAuth, (req, res) => {
  const playerId = String(req.params.id);
  const player = adminService.getPlayerDetail(playerId);
  if (!player) {
    res.status(404).json({ message: 'Player not found' });
    return;
  }

  res.json(player);
});

app.post('/admin/players/:id/balance', requireAdminAuth, requireAdminRole('super_admin'), (req, res) => {
  void (async () => {
    const playerId = String(req.params.id);
    const balance = Number(req.body?.balance);
    if (Number.isNaN(balance)) {
      res.status(400).json({ message: 'Valid balance is required' });
      return;
    }

    const room = await adminService.setPlayerBalance(playerId, balance, getAdminContext(res));
    if (!room) {
      res.status(404).json({ message: 'Player not found' });
      return;
    }

    io.to(room.code).emit('room_state_updated', room);
    res.json({ success: true, room });
  })().catch((error: unknown) => {
    console.error('Admin set balance failed:', error);
    res.status(500).json({ message: 'Admin set balance failed' });
  });
});

app.post('/admin/players/:id/release-jail', requireAdminAuth, requireAdminRole('game_master'), (req, res) => {
  void (async () => {
    const playerId = String(req.params.id);
    const room = await adminService.releasePlayerFromJail(playerId, getAdminContext(res));
    if (!room) {
      res.status(404).json({ message: 'Player not found' });
      return;
    }

    io.to(room.code).emit('room_state_updated', room);
    res.json({ success: true, room });
  })().catch((error: unknown) => {
    console.error('Admin release jail failed:', error);
    res.status(500).json({ message: 'Admin release jail failed' });
  });
});

app.post('/admin/players/:id/reset-cooldown', requireAdminAuth, requireAdminRole('game_master'), (req, res) => {
  void (async () => {
    const playerId = String(req.params.id);
    const room = await adminService.resetPlayerCooldown(playerId, getAdminContext(res));
    if (!room) {
      res.status(404).json({ message: 'Player not found' });
      return;
    }

    io.to(room.code).emit('room_state_updated', room);
    res.json({ success: true, room });
  })().catch((error: unknown) => {
    console.error('Admin reset cooldown failed:', error);
    res.status(500).json({ message: 'Admin reset cooldown failed' });
  });
});

app.post('/admin/players/:id/bankrupt', requireAdminAuth, requireAdminRole('super_admin'), (req, res) => {
  void (async () => {
    const playerId = String(req.params.id);
    const room = await adminService.setPlayerBankrupt(playerId, getAdminContext(res));
    if (!room) {
      res.status(404).json({ message: 'Player not found' });
      return;
    }

    io.to(room.code).emit('room_state_updated', room);
    res.json({ success: true, room });
  })().catch((error: unknown) => {
    console.error('Admin bankrupt failed:', error);
    res.status(500).json({ message: 'Admin bankrupt failed' });
  });
});

app.post('/admin/players/:id/kick', requireAdminAuth, requireAdminRole('support'), (req, res) => {
  void (async () => {
    const playerId = String(req.params.id);
    const room = await adminService.kickPlayer(playerId, getAdminContext(res));
    if (!room) {
      res.status(404).json({ message: 'Player not found' });
      return;
    }

    io.to(room.code).emit('room_state_updated', room);
    res.json({ success: true, room });
  })().catch((error: unknown) => {
    console.error('Admin kick failed:', error);
    res.status(500).json({ message: 'Admin kick failed' });
  });
});

app.get('/admin/audit-logs', requireAdminAuth, (_req, res) => {
  void (async () => {
    res.json(await adminService.getAuditLogs());
  })().catch((error: unknown) => {
    console.error('Admin audit logs failed:', error);
    res.status(500).json({ message: 'Admin audit logs failed' });
  });
});

app.get('/admin/config', requireAdminAuth, (_req, res) => {
  void (async () => {
    const config = await adminService.getGameConfig();
    if (!config) {
      res.status(404).json({ message: 'Game config not found' });
      return;
    }
    res.json(config);
  })().catch((error: unknown) => {
    console.error('Admin get config failed:', error);
    res.status(500).json({ message: 'Admin get config failed' });
  });
});

app.put('/admin/config', requireAdminAuth, requireAdminRole('super_admin'), (req, res) => {
  void (async () => {
    const validation = validateGameConfig(req.body);
    if (!validation.valid) {
      res.status(400).json({ message: validation.errors.join('; ') });
      return;
    }

    const updated = await adminService.updateGameConfig(validation.config, getAdminContext(res));
    res.json(updated);
  })().catch((error: unknown) => {
    console.error('Admin update config failed:', error);
    res.status(500).json({ message: 'Admin update config failed' });
  });
});

app.get('/admin/board', requireAdminAuth, (_req, res) => {
  void (async () => {
    const board = await adminService.getPublishedBoard();
    if (!board) {
      res.status(404).json({ message: 'Published board not found' });
      return;
    }
    res.json(board);
  })().catch((error: unknown) => {
    console.error('Admin get board failed:', error);
    res.status(500).json({ message: 'Admin get board failed' });
  });
});

app.get('/admin/board/versions', requireAdminAuth, (_req, res) => {
  void (async () => {
    res.json(await adminService.getBoardVersions());
  })().catch((error: unknown) => {
    console.error('Admin get board versions failed:', error);
    res.status(500).json({ message: 'Admin get board versions failed' });
  });
});

app.get('/admin/board/versions/:id', requireAdminAuth, (req, res) => {
  void (async () => {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ message: 'Invalid board version ID' });
      return;
    }
    const version = await adminService.getBoardVersionById(id);
    if (!version) {
      res.status(404).json({ message: 'Board version not found' });
      return;
    }
    res.json(version);
  })().catch((error: unknown) => {
    console.error('Admin get board version failed:', error);
    res.status(500).json({ message: 'Admin get board version failed' });
  });
});

app.get('/admin/skins', requireAdminAuth, (_req, res) => {
  void (async () => {
    res.json(await adminService.getBoardSkins());
  })().catch((error: unknown) => {
    console.error('Admin get board skins failed:', error);
    res.status(500).json({ message: 'Admin get board skins failed' });
  });
});

app.post('/admin/skins', requireAdminAuth, (req, res) => {
  void (async () => {
    const { name, type, value } = req.body;
    if (!name || (type !== 'image' && type !== 'color') || !value) {
      res.status(400).json({ message: 'Invalid skin data' });
      return;
    }
    const context = getAdminContext(res);
    await adminService.createBoardSkin(name, type, value, context);
    res.json({ message: 'Board skin created' });
  })().catch((error: unknown) => {
    console.error('Admin create board skin failed:', error);
    res.status(500).json({ message: 'Admin create board skin failed' });
  });
});

app.delete('/admin/skins/:id', requireAdminAuth, (req, res) => {
  void (async () => {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ message: 'Invalid skin ID' });
      return;
    }
    const context = getAdminContext(res);
    await adminService.deleteBoardSkin(id, context);
    res.json({ message: 'Board skin deleted' });
  })().catch((error: unknown) => {
    console.error('Admin delete board skin failed:', error);
    res.status(500).json({ message: 'Admin delete board skin failed' });
  });
});

app.get('/admin/cards', requireAdminAuth, (_req, res) => {
  void (async () => {
    const cards = await adminService.getAllCards();
    res.json(cards);
  })().catch((error: unknown) => {
    console.error('Admin fetch cards failed:', error);
    res.status(500).json({ message: 'Admin fetch cards failed' });
  });
});

app.post('/admin/cards', requireAdminAuth, (req, res) => {
  void (async () => {
    const { type, title, message, action } = req.body;
    if ((type !== 'chance' && type !== 'community_chest') || !title || !message || !action) {
      res.status(400).json({ message: 'Invalid card data' });
      return;
    }
    const context = getAdminContext(res);
    await adminService.createCard(type, title, message, action, context);
    res.json({ message: 'Card created' });
  })().catch((error: unknown) => {
    console.error('Admin create card failed:', error);
    res.status(500).json({ message: 'Admin create card failed' });
  });
});

app.post('/admin/cards/import', requireAdminAuth, (req, res) => {
  void (async () => {
    const cards = req.body;
    if (!Array.isArray(cards)) {
      res.status(400).json({ message: 'Expected an array of cards' });
      return;
    }
    const context = getAdminContext(res);
    for (const card of cards) {
      const { type, title, message, action } = card;
      if ((type === 'chance' || type === 'community_chest') && title && message && action) {
        await adminService.createCard(type, title, message, action, context);
      }
    }
    res.json({ message: `Imported ${cards.length} cards` });
  })().catch((error: unknown) => {
    console.error('Admin import cards failed:', error);
    res.status(500).json({ message: 'Admin import cards failed' });
  });
});

app.delete('/admin/cards/:id', requireAdminAuth, (req, res) => {
  void (async () => {
    const context = getAdminContext(res);
    await adminService.deleteCard(String(req.params.id), context);
    res.json({ message: 'Card deleted' });
  })().catch((error: unknown) => {
    console.error('Admin delete card failed:', error);
    res.status(500).json({ message: 'Admin delete card failed' });
  });
});

app.get('/api/boards', (_req, res) => {
  void (async () => {
    const versions = await adminService.getBoardVersions();
    // Only return published boards for the lobby
    const published = versions.filter(v => v.publishedAt !== null);
    res.json(published);
  })().catch((error: unknown) => {
    console.error('Get public boards failed:', error);
    res.status(500).json({ message: 'Failed to fetch boards' });
  });
});

app.post('/admin/board/publish', requireAdminAuth, requireAdminRole('super_admin'), (req, res) => {
  void (async () => {
    const versionName = String(req.body?.versionName || '').trim();
    const board = req.body?.board;
    if (!versionName || !board) {
      res.status(400).json({ message: 'versionName and board are required' });
      return;
    }

    const versionError = validateVersionName(versionName);
    if (versionError) {
      res.status(400).json({ message: versionError });
      return;
    }

    const boardValidation = validateBoardTemplate(board);
    if (!boardValidation.valid) {
      res.status(400).json({ message: boardValidation.errors.join('; ') });
      return;
    }

    const skinId = req.body?.skinId ? parseInt(String(req.body.skinId), 10) : null;
    const published = await adminService.publishBoardVersion(versionName, boardValidation.board, skinId, getAdminContext(res));
    res.json(published);
  })().catch((error: unknown) => {
    console.error('Admin publish board failed:', error);
    res.status(500).json({ message: 'Admin publish board failed' });
  });
});

app.get(/(.*)/, (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create_room', async (data, callback) => {
    let boardTemplate = undefined;
    let skin = null;
    if (data.boardId) {
      const version = await adminService.getBoardVersionById(data.boardId);
      if (version && version.board) {
        boardTemplate = version.board;
        if (version.skinId) {
          skin = await adminService.getBoardSkinById(version.skinId);
        }
      }
    }
    const playerIdToUse = data.playerId || socket.id;
    socket.data.playerId = playerIdToUse;
    const config = getGameConfig();
    const { code, room } = engine.createRoom(playerIdToUse, data.name, data.avatar, boardTemplate, skin, config.sfx);
    socket.join(code);
    socket.join(playerIdToUse);
    callback({ code, playerId: playerIdToUse });
    io.to(code).emit('room_state_updated', room);
  });

  socket.on('join_room', (data, callback) => {
    const playerIdToUse = data.playerId || socket.id;
    socket.data.playerId = playerIdToUse;
    const res = engine.joinRoom(data.code, playerIdToUse, data.name, data.avatar);
    if (res.success && res.room) {
      socket.join(data.code);
      socket.join(playerIdToUse);
      callback({ success: true, playerId: playerIdToUse });
      io.to(data.code).emit('room_state_updated', res.room);
    } else {
      callback({ success: false, message: res.message });
    }
  });

  socket.on('start_game', (data) => {
    const playerId = socket.data.playerId || socket.id;
    if (engine.startGame(data.code, playerId)) {
      const room = engine.getRoom(data.code);
      if (room) io.to(data.code).emit('room_state_updated', room);
    }
  });

  socket.on('roll_dice', (data) => {
    void (async () => {
      const playerId = socket.data.playerId || socket.id;
      const res = await engine.rollDice(data.code, playerId);
      if (res.success && res.room) {
        io.to(data.code).emit('dice_rolled', { playerId, roll: (res.dice1 || 0) + (res.dice2 || 0), dice1: res.dice1 || 0, dice2: res.dice2 || 0 });
        io.to(data.code).emit('room_state_updated', res.room);

        if (res.tile && !res.tile.ownerPlayerId && ['property', 'railroad', 'utility'].includes(res.tile.type)) {
          socket.emit('property_decision', { playerId, tile: res.tile });
        }
        if ((res as any).cardDrawn) {
          socket.emit('card_drawn', (res as any).cardDrawn);
        }
      } else if (res.message) {
        socket.emit('error_message', res.message);
      }
    })();
  });

  socket.on('buy_property', (data) => {
    const playerId = socket.data.playerId || socket.id;
    const room = engine.buyProperty(data.code, playerId, data.tileId, data.decision);
    if (room) {
      io.to(data.code).emit('room_state_updated', room);
    }
  });

  socket.on('send_chat_message', (data) => {
    const playerId = socket.data.playerId || socket.id;
    const room = engine.getRoomByPlayerId(playerId);
    if (room) {
      const player = room.players.find(p => p.id === playerId);
      if (player) {
        room.eventLog.push(`💬 ${player.name}: ${data.message}`);
        if (room.eventLog.length > 50) room.eventLog.shift();
        io.to(data.code).emit('room_state_updated', room);
      }
    }
  });

  socket.on('end_game', (data) => {
    const playerId = socket.data.playerId || socket.id;
    const room = engine.endGame(data.code, playerId);
    if (room) {
      io.to(data.code).emit('room_state_updated', room);
    }
  });

  socket.on('pay_jail_fee', (data) => {
    const playerId = socket.data.playerId || socket.id;
    const room = engine.payJailFee(data.code, playerId);
    if (room) {
      io.to(data.code).emit('room_state_updated', room);
    }
  });

  socket.on('place_bid', (data) => {
    const playerId = socket.data.playerId || socket.id;
    const room = engine.placeBid(data.code, playerId, data.amount);
    if (room) {
      io.to(data.code).emit('room_state_updated', room);
    }
  });

  socket.on('build_property', (data) => {
    const playerId = socket.data.playerId || socket.id;
    const res = engine.buildProperty(data.code, playerId, data.tileId);
    if (res.success && res.room) {
      io.to(data.code).emit('room_state_updated', res.room);
    } else if (res.message) {
      socket.emit('error_message', res.message);
    }
  });

  socket.on('sell_building', (data) => {
    const playerId = socket.data.playerId || socket.id;
    const res = engine.sellBuilding(data.code, playerId, data.tileId);
    if (res.success && res.room) {
      io.to(data.code).emit('room_state_updated', res.room);
    } else if (res.message) {
      socket.emit('error_message', res.message);
    }
  });

  socket.on('mortgage_property', (data) => {
    const playerId = socket.data.playerId || socket.id;
    const res = engine.mortgageProperty(data.code, playerId, data.tileId);
    if (res.success && res.room) {
      io.to(data.code).emit('room_state_updated', res.room);
    } else if (res.message) {
      socket.emit('error_message', res.message);
    }
  });

  socket.on('redeem_property', (data) => {
    const playerId = socket.data.playerId || socket.id;
    const res = engine.redeemProperty(data.code, playerId, data.tileId);
    if (res.success && res.room) {
      io.to(data.code).emit('room_state_updated', res.room);
    } else if (res.message) {
      socket.emit('error_message', res.message);
    }
  });

  socket.on('send_trade_offer', (data) => {
    const playerId = socket.data.playerId || socket.id;
    const res = engine.sendTradeOffer(data.code, playerId, data);
    if (res.success && res.room && res.offer) {
      io.to(data.code).emit('room_state_updated', res.room);
      io.to(res.offer.toPlayerId).emit('trade_offer_received', res.offer);
      io.to(playerId).emit('trade_offer_status', {
        offerId: res.offer.id,
        status: 'sent',
        message: 'Trade offer sent.',
      });
    } else if (res.message) {
      socket.emit('error_message', res.message);
    }
  });

  socket.on('respond_trade_offer', (data) => {
    const playerId = socket.data.playerId || socket.id;
    const res = engine.respondTradeOffer(data.code, playerId, data.offerId, data.decision);
    if (res.success && res.room) {
      io.to(data.code).emit('room_state_updated', res.room);
    } else if (res.message) {
      socket.emit('error_message', res.message);
    }
  });

  socket.on('disconnect', () => {
    const playerId = socket.data.playerId || socket.id;
    console.log('User disconnected:', playerId);
    const room = engine.disconnectPlayer(playerId);
    if (room) {
      io.to(room.code).emit('room_state_updated', room);
    }
  });
});

const PORT = process.env.PORT || 3001;
void (async () => {
  await ensureAdminDatabase();
  await loadGameConfigCache();
  await loadBoardTemplateCache();
  server.listen(PORT, () => {
    console.log(`Server (Backend API + Frontend) is running on port ${PORT}`);
  });
})().catch((error: unknown) => {
  console.error('Failed to start backend server:', error);
  process.exit(1);
});
