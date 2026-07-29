import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthedRequest } from './requireAuth';

export type AdminRequest = AuthedRequest & {
  adminUser?: { id: string; email: string };
};

export async function requireSuperAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const { verifyToken } = await import('../lib/jwt');
    const payload = verifyToken(header.slice(7));
    if (payload.type !== 'owner') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user?.isSuperAdmin) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    if (user.suspended) {
      res.status(403).json({ error: 'Account suspended' });
      return;
    }

    req.user = payload;
    req.adminUser = { id: user.id, email: user.email };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
