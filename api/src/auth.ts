import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { pool } from './db';

const accessSecret = () => {
  const s = process.env.JWT_SECRET ?? '';
  if (!s) throw new Error('JWT_SECRET no configurado');
  return s;
};
const refreshSecret = () => process.env.JWT_REFRESH_SECRET ?? accessSecret();
const accessTtl = () => process.env.JWT_ACCESS_TTL ?? '15m';
const refreshTtl = () => process.env.JWT_REFRESH_TTL ?? '7d';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function ensureSeedAdmin(): Promise<void> {
  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
  const [rows] = await pool.query('SELECT id FROM users LIMIT 1');
  if ((rows as unknown[]).length > 0) return;
  const hash = await bcrypt.hash(password, 10);
  await pool.query('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)', [uuid(), username, hash]);
  console.log(`[auth] usuario seed creado: ${username}`);
}

export async function login(username: string, password: string): Promise<TokenPair> {
  const [rows] = await pool.query('SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1', [username]);
  const user = (rows as Array<{ id: string; username: string; password_hash: string }>)[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw Object.assign(new Error('Credenciales inválidas'), { status: 401 });
  }
  return issuePair(user.id, user.username);
}

export async function issuePair(userId: string, username: string): Promise<TokenPair> {
  const accessToken = jwt.sign({ sub: userId, username, typ: 'access' }, accessSecret(), { expiresIn: accessTtl() } as jwt.SignOptions);
  const refreshToken = jwt.sign({ sub: userId, username, typ: 'refresh' }, refreshSecret(), { expiresIn: refreshTtl() } as jwt.SignOptions);
  const decoded = jwt.decode(refreshToken) as { exp?: number } | null;
  const expiresAt = new Date(((decoded?.exp ?? Date.now() / 1000 + 7 * 86400) * 1000));
  await pool.query('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)', [refreshToken, userId, expiresAt]);
  return { accessToken, refreshToken };
}

export async function refresh(refreshToken: string): Promise<{ accessToken: string }> {
  let payload: { sub: string; username: string; typ?: string };
  try {
    payload = jwt.verify(refreshToken, refreshSecret()) as typeof payload;
  } catch {
    throw Object.assign(new Error('Refresh inválido'), { status: 401 });
  }
  if (payload.typ !== 'refresh') throw Object.assign(new Error('Refresh inválido'), { status: 401 });
  const [rows] = await pool.query('SELECT token FROM refresh_tokens WHERE token = ? AND expires_at > NOW()', [refreshToken]);
  if ((rows as unknown[]).length === 0) throw Object.assign(new Error('Refresh revocado'), { status: 401 });
  const accessToken = jwt.sign({ sub: payload.sub, username: payload.username, typ: 'access' }, accessSecret(), {
    expiresIn: accessTtl(),
  } as jwt.SignOptions);
  return { accessToken };
}

export function verifyAccess(token: string): { sub: string; username: string } {
  return jwt.verify(token, accessSecret()) as { sub: string; username: string };
}
