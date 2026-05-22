import { randomBytes } from 'node:crypto';
import { RowDataPacket } from 'mysql2/promise';
import { getDbPool, verifyPassword } from './db';

export type AdminRole = 'super_admin' | 'game_master' | 'support' | 'analyst';

type AdminUserRow = RowDataPacket & {
  username: string;
  password_hash: string;
  role: AdminRole;
  display_name: string;
};

type AdminSessionRow = RowDataPacket & {
  token: string;
  username: string;
  role: AdminRole;
  display_name: string;
  created_at: Date;
};

type Session = {
  token: string;
  username: string;
  role: AdminRole;
  displayName: string;
  createdAt: number;
};

export class AdminAuthService {
  async login(username: string, password: string) {
    const db = getDbPool();
    const [rows] = await db.query<AdminUserRow[]>(
      `
        SELECT username, password_hash, role, display_name
        FROM admin_users
        WHERE username = ?
        LIMIT 1
      `,
      [username],
    );

    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return null;
    }

    const token = `adm_${Date.now()}_${randomBytes(8).toString('hex')}`;
    await db.query(
      `
        INSERT INTO admin_sessions (token, username, role, display_name)
        VALUES (?, ?, ?, ?)
      `,
      [token, user.username, user.role, user.display_name],
    );

    return {
      token,
      username: user.username,
      role: user.role,
      displayName: user.display_name,
      createdAt: Date.now(),
    };
  }

  async logout(token: string) {
    const db = getDbPool();
    await db.query('DELETE FROM admin_sessions WHERE token = ?', [token]);
  }

  async getSession(token: string | undefined): Promise<Session | null> {
    if (!token) return null;

    const db = getDbPool();
    const [rows] = await db.query<AdminSessionRow[]>(
      `
        SELECT token, username, role, display_name, created_at
        FROM admin_sessions
        WHERE token = ?
        LIMIT 1
      `,
      [token],
    );

    const session = rows[0];
    if (!session) return null;

    return {
      token: session.token,
      username: session.username,
      role: session.role,
      displayName: session.display_name,
      createdAt: new Date(session.created_at).getTime(),
    };
  }
}
