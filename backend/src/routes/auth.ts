import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signOwnerToken } from '../lib/jwt';
import { AuthedRequest } from '../middleware/requireAuth';
import { assertRegistrationAllowed, PlanError, sendPlanError } from '../lib/plans';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['photographer', 'organizer', 'hybrid']).default('photographer'),
  businessName: z.string().optional(),
  portfolioUrl: z.string().url().optional().or(z.literal('')),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function serializeUser(user: {
  id: string;
  email: string;
  role: string;
  businessName: string | null;
  plan: string;
  planExpiresAt: Date | null;
  isSuperAdmin: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    businessName: user.businessName,
    plan: user.plan,
    planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
    isSuperAdmin: user.isSuperAdmin,
  };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await assertRegistrationAllowed();
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash,
        role: body.role,
        businessName: body.businessName || null,
        portfolioUrl: body.portfolioUrl || null,
      },
    });

    const token = signOwnerToken({ userId: user.id, email: user.email });
    res.status(201).json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    if (err instanceof PlanError) {
      sendPlanError(res, err);
      return;
    }
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.flatten() });
      return;
    }
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    if (user.suspended) {
      res.status(403).json({ error: 'Account suspended' });
      return;
    }

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signOwnerToken({ userId: user.id, email: user.email });
    res.json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.flatten() });
      return;
    }
    next(err);
  }
}

export async function me(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
}
