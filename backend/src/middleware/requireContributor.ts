import { Request, Response, NextFunction } from 'express';
import { verifyToken, ContributorTokenPayload } from '../lib/jwt';

export type ContributorRequest = Request & {
  contributor?: ContributorTokenPayload;
};

export function requireContributor(
  req: ContributorRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Contributor session required' });
    return;
  }
  try {
    const payload = verifyToken(header.slice(7));
    if (payload.type !== 'contributor') {
      res.status(401).json({ error: 'Contributor token required' });
      return;
    }
    req.contributor = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired contributor session' });
  }
}
