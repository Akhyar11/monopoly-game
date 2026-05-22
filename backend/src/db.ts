import 'dotenv/config';
import mysql, { Pool, RowDataPacket } from 'mysql2/promise';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DEFAULT_BOARD_TEMPLATE } from './board';
import { Tile } from './types';

let pool: Pool | null = null;

const DEFAULT_ADMINS = [
  { username: 'admin', password: 'admin123', role: 'super_admin', displayName: 'Local Admin' },
  { username: 'ops', password: 'ops123', role: 'game_master', displayName: 'Ops Console' },
  { username: 'support', password: 'support123', role: 'support', displayName: 'Support Desk' },
  { username: 'analyst', password: 'analyst123', role: 'analyst', displayName: 'Read Only Analyst' },
];

export type GameConfig = {
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
  sfx: {
    rollDice: string;
    buyProperty: string;
    payRent: string;
    bankrupt: string;
    jail: string;
    cardDrawn: string;
    passGo: string;
  };
};

export const DEFAULT_GAME_CONFIG: GameConfig = {
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

const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (password: string, storedHash: string) => {
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;

  const candidateHash = scryptSync(password, salt, 64);
  const originalBuffer = Buffer.from(originalHash, 'hex');
  if (originalBuffer.length !== candidateHash.length) return false;
  return timingSafeEqual(originalBuffer, candidateHash);
};

export const getDbPool = () => {
  if (!pool) {
    const host = process.env.MYSQL_HOST || '127.0.0.1';
    const port = Number(process.env.MYSQL_PORT || 3306);
    const user = process.env.MYSQL_USER || 'root';
    const password = process.env.MYSQL_PASSWORD || '';
    const database = process.env.MYSQL_DATABASE || 'monopoly_admin';

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    });
  }

  return pool;
};

export const ensureAdminDatabase = async () => {
  const db = getDbPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL,
      display_name VARCHAR(128) NOT NULL,
      skin_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token VARCHAR(128) NOT NULL PRIMARY KEY,
      username VARCHAR(64) NOT NULL,
      role VARCHAR(32) NOT NULL,
      display_name VARCHAR(128) NOT NULL,
      skin_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NULL DEFAULT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      admin_id VARCHAR(64) NOT NULL,
      role VARCHAR(32) NOT NULL,
      action VARCHAR(64) NOT NULL,
      target_type VARCHAR(32) NOT NULL,
      target_id VARCHAR(128) NOT NULL,
      before_json JSON NULL,
      after_json JSON NULL,
      skin_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS game_config (
      config_key VARCHAR(64) NOT NULL PRIMARY KEY,
      value_json JSON NOT NULL,
      updated_by VARCHAR(64) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS board_versions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      version_name VARCHAR(128) NOT NULL,
      board_json JSON NOT NULL,
      created_by VARCHAR(64) NOT NULL,
      skin_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      published_at TIMESTAMP NULL DEFAULT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS board_skins (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      type ENUM('image', 'color') NOT NULL,
      value VARCHAR(1024) NOT NULL,
      created_by VARCHAR(64) NOT NULL,
      skin_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS game_cards (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      type ENUM('chance', 'community_chest') NOT NULL,
      title VARCHAR(128) NOT NULL,
      message TEXT NOT NULL,
      action_json JSON NOT NULL,
      created_by VARCHAR(64) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await db.query<RowDataPacket[]>('SELECT username FROM admin_users');
  const existingUsernames = new Set(rows.map((row) => String(row.username)));

  for (const admin of DEFAULT_ADMINS) {
    if (existingUsernames.has(admin.username)) continue;

    await db.query(
      `
        INSERT INTO admin_users (username, password_hash, role, display_name)
        VALUES (?, ?, ?, ?)
      `,
      [admin.username, hashPassword(admin.password), admin.role, admin.displayName],
    );
  }

  const [configRows] = await db.query<RowDataPacket[]>('SELECT config_key FROM game_config');
  const existingConfigKeys = new Set(configRows.map((row) => String(row.config_key)));

  if (!existingConfigKeys.has('global')) {
    await db.query(
      `
        INSERT INTO game_config (config_key, value_json, updated_by)
        VALUES (?, ?, ?)
      `,
      ['global', JSON.stringify(DEFAULT_GAME_CONFIG), 'system-bootstrap'],
    );
  }

  const [boardRows] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM board_versions');
  const boardCount = Number(boardRows[0]?.total || 0);
  if (boardCount === 0) {
    await db.query(
      `
        INSERT INTO board_versions (version_name, board_json, created_by, published_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `,
      ['default-v1', JSON.stringify(DEFAULT_BOARD_TEMPLATE), 'system-bootstrap'],
    );
  }
};

export const getStoredGameConfig = async (): Promise<GameConfig> => {
  const db = getDbPool();
  const [rows] = await db.query<(RowDataPacket & { value_json: string })[]>(
    `
      SELECT value_json
      FROM game_config
      WHERE config_key = 'global'
      LIMIT 1
    `,
  );

  if (!rows[0]?.value_json) {
    return DEFAULT_GAME_CONFIG;
  }

  const valueJson = rows[0].value_json;
  if (typeof valueJson === 'string') {
    return JSON.parse(valueJson) as GameConfig;
  }
  return valueJson as unknown as GameConfig;
};

export const getStoredPublishedBoard = async (): Promise<Tile[]> => {
  const db = getDbPool();
  const [rows] = await db.query<(RowDataPacket & { board_json: string })[]>(
    `
      SELECT board_json
      FROM board_versions
      ORDER BY published_at IS NULL ASC, published_at DESC, id DESC
      LIMIT 1
    `,
  );

  if (!rows[0]?.board_json) {
    return DEFAULT_BOARD_TEMPLATE.map((tile) => ({ ...tile }));
  }

  const boardJson = rows[0].board_json;
  if (typeof boardJson === 'string') {
    return JSON.parse(boardJson) as Tile[];
  }
  return boardJson as unknown as Tile[];
};
