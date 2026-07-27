import { Request, Response, NextFunction } from 'express';
import { verifyToken, OwnerTokenPayload } from '../lib/jwt';

export type AuthedRequest = Request & {
  user?: OwnerTokenPayload;
};

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const payload = verifyToken(header.slice(7));
    if (payload.type !== 'owner') {
      res.status(403).json({ error: 'Only the event owner can perform this action' });
      return;
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
