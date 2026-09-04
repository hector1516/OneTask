import { NextFunction, Request, Response } from 'express';
import { verifyAccess } from './auth';

export interface AuthedRequest extends Request {
  user?: { id: string; username: string };
}

/** DEC-003: JWT Bearer obligatorio (token en localStorage del Admin / Agent). */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'missing Bearer token' });
    return;
  }
  try {
    const payload = verifyAccess(token);
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}

/** deviceId via query ?deviceId= o header X-Device-Id (Agent pull). */
export function deviceIdOf(req: Request): string {
  const q = typeof req.query.deviceId === 'string' ? req.query.deviceId : '';
  const h = typeof req.headers['x-device-id'] === 'string' ? (req.headers['x-device-id'] as string) : '';
  return (q || h || (req.params as Record<string, string>).id || '').trim();
}
