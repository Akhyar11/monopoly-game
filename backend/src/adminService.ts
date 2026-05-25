import { GameEngine } from './gameEngine';
import { RowDataPacket } from 'mysql2/promise';
import { Room } from './types';
import { GameConfig, getDbPool } from './db';
import { setGameConfigCache } from './configStore';
import { setBoardTemplateCache } from './boardStore';

type AdminRole = 'super_admin' | 'game_master' | 'support' | 'analyst';

interface AdminContext {
  adminId: string;
  role: AdminRole;
}

interface AuditLogEntry {
  id: string;
  timestamp: number;
  adminId: string;
  role: AdminRole;
  action: string;
  targetType: 'room' | 'player' | 'config' | 'board' | 'skin';
  targetId: string;
  before: unknown;
  after: unknown;
}

export class AdminService {
  constructor(private engine: GameEngine) {}

  getDashboardSummary() {
    const rooms = this.engine.getRooms();
    const players = rooms.flatMap((room) => room.players);
    const now = Date.now();

    return {
      activeRooms: rooms.filter((room) => room.status === 'waiting' || room.status === 'playing').length,
      liveMatches: rooms.filter((room) => room.status === 'playing').length,
      endedMatchesToday: rooms.filter((room) => room.status === 'ended' && this.isToday(room.createdAt, now)).length,
      onlinePlayers: players.filter((player) => player.isConnected).length,
      debtCases: players.filter((player) => player.status === 'in_debt').length,
      activeTrades: rooms.reduce((count, room) => count + room.tradeOffers.length, 0),
      activeAuctions: rooms.filter((room) => !!room.auction).length,
      averageMatchDurationMs: this.getAverageMatchDuration(rooms, now),
    };
  }

  getRooms() {
    return this.engine.getRooms().map((room) => this.serializeRoomSummary(room));
  }

  getRoomDetail(code: string) {
    const room = this.engine.getRoom(code);
    if (!room) return null;

    return {
      ...this.serializeRoomSummary(room),
      hostPlayer: room.players.find((player) => player.id === room.hostPlayerId) ?? null,
      players: room.players,
      board: room.board,
      eventLog: room.eventLog,
      auction: room.auction ?? null,
      tradeOffers: room.tradeOffers,
    };
  }

  getPlayers() {
    return this.engine.getRooms().flatMap((room) =>
      room.players.map((player) => ({
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        roomCode: room.code,
        balance: player.balance,
        status: player.status,
        isConnected: player.isConnected,
        properties: player.properties.length,
        debtDeadline: player.debtDeadline ?? null,
      })),
    );
  }

  getPlayerDetail(playerId: string) {
    const room = this.engine.getRoomByPlayerId(playerId);
    if (!room) return null;

    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) return null;

    return {
      ...player,
      roomCode: room.code,
      roomStatus: room.status,
      ownedTiles: room.board.filter((tile) => tile.ownerPlayerId === player.id),
      recentEvents: room.eventLog.slice(0, 15),
    };
  }

  async broadcastToRoom(code: string, message: string, context: AdminContext) {
    const room = this.engine.getRoom(code);
    if (!room) return null;

    const before = { eventLogSize: room.eventLog.length };
    const updatedRoom = this.engine.adminBroadcast(code, message);
    if (!updatedRoom) return null;

    await this.addAuditLog({
      ...context,
      action: 'broadcast_room',
      targetType: 'room',
      targetId: code,
      before,
      after: { message },
    });

    return updatedRoom;
  }

  async forceEndRoom(code: string, reason: string, context: AdminContext) {
    const room = this.engine.getRoom(code);
    if (!room) return null;

    const before = { status: room.status, winnerId: room.winnerId ?? null };
    const updatedRoom = this.engine.adminEndGame(code, reason);
    if (!updatedRoom) return null;

    await this.addAuditLog({
      ...context,
      action: 'force_end_room',
      targetType: 'room',
      targetId: code,
      before,
      after: { status: updatedRoom.status, winnerId: updatedRoom.winnerId ?? null, reason },
    });

    return updatedRoom;
  }

  async getAuditLogs() {
    const db = getDbPool();
    const [rows] = await db.query<(RowDataPacket & {
      id: number;
      admin_id: string;
      role: AdminRole;
      action: string;
      target_type: 'room' | 'player' | 'config' | 'board';
      target_id: string;
      before_json: string | null;
      after_json: string | null;
      created_at: Date;
    })[]>(
      `
        SELECT id, admin_id, role, action, target_type, target_id, before_json, after_json, created_at
        FROM admin_audit_logs
        ORDER BY id DESC
        LIMIT 200
      `,
    );

    return rows.map((row) => ({
      id: String(row.id),
      timestamp: new Date(row.created_at).getTime(),
      adminId: row.admin_id,
      role: row.role,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      before: row.before_json ? JSON.parse(String(row.before_json)) : null,
      after: row.after_json ? JSON.parse(String(row.after_json)) : null,
    }));
  }

  async getGameConfig() {
    const db = getDbPool();
    const [rows] = await db.query<(RowDataPacket & {
      config_key: string;
      value_json: string;
      updated_by: string;
      updated_at: Date;
    })[]>(
      `
        SELECT config_key, value_json, updated_by, updated_at
        FROM game_config
        WHERE config_key = 'global'
        LIMIT 1
      `,
    );

    const config = rows[0];
    if (!config) return null;

    return {
      key: config.config_key,
      value: JSON.parse(String(config.value_json)),
      updatedBy: config.updated_by,
      updatedAt: new Date(config.updated_at).getTime(),
    };
  }

  async updateGameConfig(value: GameConfig, context: AdminContext) {
    const before = await this.getGameConfig();
    const db = getDbPool();
    await db.query(
      `
        INSERT INTO game_config (config_key, value_json, updated_by)
        VALUES ('global', ?, ?)
        ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_by = VALUES(updated_by)
      `,
      [JSON.stringify(value), context.adminId],
    );

    const after = await this.getGameConfig();
    if (after?.value) {
      setGameConfigCache(after.value as GameConfig);
    }
    await this.addAuditLog({
      ...context,
      action: 'update_game_config',
      targetType: 'config',
      targetId: 'global',
      before: before?.value ?? null,
      after: after?.value ?? null,
    });

    return after;
  }

  async getBoardVersions() {
    const db = getDbPool();
    const [rows] = await db.query<(RowDataPacket & {
      id: number;
      version_name: string;
      created_by: string;
      created_at: Date;
      published_at: Date | null;
    })[]>(
      `
        SELECT id, version_name, created_by, created_at, published_at
        FROM board_versions
        ORDER BY id DESC
      `,
    );

    return rows.map((row) => ({
      id: row.id,
      versionName: row.version_name,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at).getTime(),
      publishedAt: row.published_at ? new Date(row.published_at).getTime() : null,
    }));
  }

  async getBoardVersionById(id: number) {
    const db = getDbPool();
    const [rows] = await db.query<(RowDataPacket & {
      id: number;
      version_name: string;
      board_json: string;
      skin_id: number | null;
      created_by: string;
      created_at: Date;
      published_at: Date | null;
    })[]>(
      `
        SELECT id, version_name, board_json, skin_id, created_by, created_at, published_at
        FROM board_versions
        WHERE id = ?
      `,
      [id]
    );

    const board = rows[0];
    if (!board) return null;

    return {
      id: board.id,
      versionName: board.version_name,
      board: JSON.parse(String(board.board_json)),
      createdBy: board.created_by,
      skinId: board.skin_id,
      createdAt: new Date(board.created_at).getTime(),
      publishedAt: board.published_at ? new Date(board.published_at).getTime() : null,
    };
  }

  async getPublishedBoard() {
    const db = getDbPool();
    const [rows] = await db.query<(RowDataPacket & {
      id: number;
      version_name: string;
      board_json: string;
      created_by: string;
      skin_id: number | null;
      created_at: Date;
      published_at: Date | null;
    })[]>(
      `
        SELECT id, version_name, board_json, skin_id, created_by, created_at, published_at
        FROM board_versions
        ORDER BY published_at IS NULL ASC, published_at DESC, id DESC
        LIMIT 1
      `,
    );

    const board = rows[0];
    if (!board) return null;

    return {
      id: board.id,
      versionName: board.version_name,
      board: JSON.parse(String(board.board_json)),
      createdBy: board.created_by,
      skinId: board.skin_id,
      createdAt: new Date(board.created_at).getTime(),
      publishedAt: board.published_at ? new Date(board.published_at).getTime() : null,
    };
  }

  async publishBoardVersion(versionName: string, board: unknown, skinId: number | null, context: AdminContext) {
    const before = await this.getPublishedBoard();
    const db = getDbPool();
    await db.query('UPDATE board_versions SET published_at = NULL WHERE published_at IS NOT NULL');
    await db.query(
      `
        INSERT INTO board_versions (version_name, board_json, skin_id, created_by, published_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      [versionName, JSON.stringify(board), skinId, context.adminId],
    );

    const after = await this.getPublishedBoard();
    if (after?.board) {
      setBoardTemplateCache(after.board);
    }
    await this.addAuditLog({
      ...context,
      action: 'publish_board_version',
      targetType: 'board',
      targetId: versionName,
      before: before ? { id: before.id, versionName: before.versionName } : null,
      after: after ? { id: after.id, versionName: after.versionName } : null,
    });

    return after;
  }

  async setPlayerBalance(playerId: string, balance: number, context: AdminContext) {
    const before = this.getPlayerDetail(playerId);
    if (!before) return null;

    const room = this.engine.adminSetPlayerBalance(playerId, balance);
    if (!room) return null;

    const after = this.getPlayerDetail(playerId);
    await this.addAuditLog({
      ...context,
      action: 'set_player_balance',
      targetType: 'player',
      targetId: playerId,
      before: { balance: before.balance, status: before.status },
      after: { balance: after?.balance ?? null, status: after?.status ?? null },
    });

    return room;
  }

  async releasePlayerFromJail(playerId: string, context: AdminContext) {
    const before = this.getPlayerDetail(playerId);
    if (!before) return null;

    const room = this.engine.adminReleaseFromJail(playerId);
    if (!room) return null;

    const after = this.getPlayerDetail(playerId);
    await this.addAuditLog({
      ...context,
      action: 'release_player_from_jail',
      targetType: 'player',
      targetId: playerId,
      before: { status: before.status },
      after: { status: after?.status ?? null },
    });

    return room;
  }

  async resetPlayerCooldown(playerId: string, context: AdminContext) {
    const before = this.getPlayerDetail(playerId);
    if (!before) return null;

    const room = this.engine.adminResetCooldown(playerId);
    if (!room) return null;

    const after = this.getPlayerDetail(playerId);
    await this.addAuditLog({
      ...context,
      action: 'reset_player_cooldown',
      targetType: 'player',
      targetId: playerId,
      before: { status: before.status, cooldownUntil: before.cooldownUntil, rollsLeft: before.rollsLeft },
      after: { status: after?.status ?? null, cooldownUntil: after?.cooldownUntil ?? null, rollsLeft: after?.rollsLeft ?? null },
    });

    return room;
  }

  async setPlayerBankrupt(playerId: string, context: AdminContext) {
    const before = this.getPlayerDetail(playerId);
    if (!before) return null;

    const room = this.engine.adminSetBankrupt(playerId);
    if (!room) return null;

    const after = this.getPlayerDetail(playerId);
    await this.addAuditLog({
      ...context,
      action: 'set_player_bankrupt',
      targetType: 'player',
      targetId: playerId,
      before: { status: before.status, balance: before.balance, ownedTiles: before.ownedTiles.length },
      after: { status: after?.status ?? null, balance: after?.balance ?? null, ownedTiles: after?.ownedTiles.length ?? 0 },
    });

    return room;
  }

  async kickPlayer(playerId: string, context: AdminContext) {
    const before = this.getPlayerDetail(playerId);
    if (!before) return null;

    const room = this.engine.adminKickPlayer(playerId);
    if (!room) return null;

    const after = this.getPlayerDetail(playerId);
    await this.addAuditLog({
      ...context,
      action: 'kick_player',
      targetType: 'player',
      targetId: playerId,
      before: { status: before.status, isConnected: before.isConnected },
      after: { status: after?.status ?? null, isConnected: after?.isConnected ?? null },
    });

    return room;
  }

  private serializeRoomSummary(room: Room) {
    return {
      code: room.code,
      status: room.status,
      hostPlayerId: room.hostPlayerId,
      hostName: room.players.find((player) => player.id === room.hostPlayerId)?.name ?? 'Unknown',
      playerCount: room.players.length,
      createdAt: room.createdAt,
      gameStartedAt: room.gameStartedAt ?? null,
      activeTrades: room.tradeOffers.length,
      hasAuction: !!room.auction,
      debtCases: room.players.filter((player) => player.status === 'in_debt').length,
      bankruptPlayers: room.players.filter((player) => player.status === 'bankrupt').length,
    };
  }

  private async addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
    const db = getDbPool();
    await db.query(
      `
        INSERT INTO admin_audit_logs (admin_id, role, action, target_type, target_id, before_json, after_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        entry.adminId,
        entry.role,
        entry.action,
        entry.targetType,
        entry.targetId,
        JSON.stringify(entry.before ?? null),
        JSON.stringify(entry.after ?? null),
      ],
    );
  }

  private getAverageMatchDuration(rooms: Room[], now: number) {
    const finishedDurations = rooms
      .filter((room) => room.gameStartedAt)
      .map((room) => now - (room.gameStartedAt || now));

    if (finishedDurations.length === 0) return 0;
    return Math.round(finishedDurations.reduce((sum, duration) => sum + duration, 0) / finishedDurations.length);
  }

  private isToday(timestamp: number, now: number) {
    const date = new Date(timestamp);
    const today = new Date(now);
    return date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
  }

  async getBoardSkins() {
    const db = getDbPool();
    const [rows] = await db.query<(RowDataPacket & {
      id: number;
      name: string;
      type: 'image' | 'color';
      value: string;
      created_by: string;
      created_at: Date;
    })[]>(`SELECT id, name, type, value, created_by, created_at FROM board_skins ORDER BY created_at DESC`);
    
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      value: row.value,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at).getTime(),
    }));
  }

  async getBoardSkinById(id: number) {
    const db = getDbPool();
    const [rows] = await db.query<(RowDataPacket & {
      id: number;
      name: string;
      type: 'image' | 'color';
      value: string;
      created_by: string;
      created_at: Date;
    })[]>(`SELECT id, name, type, value, created_by, created_at FROM board_skins WHERE id = ?`, [id]);
    
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      value: row.value,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  async createBoardSkin(name: string, type: 'image' | 'color', value: string, context: AdminContext) {
    const db = getDbPool();
    await db.query(
      `INSERT INTO board_skins (name, type, value, created_by, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [name, type, value, context.adminId]
    );
    await this.addAuditLog({
      ...context,
      action: 'create_board_skin',
      targetType: 'skin',
      targetId: 'board_skins',
      before: null,
      after: { name, type, value },
    });
  }

  async deleteBoardSkin(id: number, context: AdminContext) {
    const db = getDbPool();
    await db.query(`DELETE FROM board_skins WHERE id = ?`, [id]);
    await this.addAuditLog({
      ...context,
      action: 'delete_board_skin',
      targetType: 'skin',
      targetId: 'board_skins',
      before: { id },
      after: null,
    });
  }

  async getAllCards() {
    const db = getDbPool();
    const [rows] = await db.query<(RowDataPacket & {
      id: number;
      type: 'chance' | 'community_chest';
      title: string;
      message: string;
      action_json: string;
      created_by: string;
      created_at: Date;
    })[]>(`SELECT id, type, title, message, action_json, created_by, created_at FROM game_cards ORDER BY type, id ASC`);
    
    return rows.map((row) => ({
      id: String(row.id),
      type: row.type,
      title: row.title,
      message: row.message,
      action: JSON.parse(row.action_json),
      createdBy: row.created_by,
      createdAt: new Date(row.created_at).getTime(),
    }));
  }

  async createCard(type: 'chance' | 'community_chest', title: string, message: string, actionJson: any, context: AdminContext) {
    const db = getDbPool();
    await db.query(
      `INSERT INTO game_cards (type, title, message, action_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [type, title, message, JSON.stringify(actionJson), context.adminId]
    );
    await this.addAuditLog({
      ...context,
      action: 'create_card',
      targetType: 'config',
      targetId: 'game_cards',
      before: null,
      after: { type, title, message, actionJson },
    });
  }

  async deleteCard(id: string, context: AdminContext) {
    const db = getDbPool();
    await db.query(`DELETE FROM game_cards WHERE id = ?`, [Number(id)]);
    await this.addAuditLog({
      ...context,
      action: 'delete_card',
      targetType: 'config',
      targetId: 'game_cards',
      before: { id },
      after: null,
    });
  }
}
