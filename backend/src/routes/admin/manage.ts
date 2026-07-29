import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AdminRequest } from '../../middleware/requireSuperAdmin';
import { writeAuditLog } from '../../lib/adminAudit';

export async function listAudit(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
    const [total, logs] = await Promise.all([
      prisma.adminAuditLog.count(),
      prisma.adminAuditLog.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { email: true } } },
      }),
    ]);
    res.json({ logs, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

const userPatchSchema = z.object({
  plan: z.string().optional(),
  planExpiresAt: z.string().datetime().optional().nullable(),
  suspended: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
});

export async function listUsers(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30));
    const where = q
      ? { email: { contains: q, mode: 'insensitive' as const } }
      : {};
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          plan: true,
          planExpiresAt: true,
          isSuperAdmin: true,
          suspended: true,
          createdAt: true,
          _count: { select: { events: true } },
        },
      }),
    ]);
    res.json({ users, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

export async function patchUser(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = userPatchSchema.parse(req.body);
    const before = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!before) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        plan: body.plan,
        suspended: body.suspended,
        isSuperAdmin: body.isSuperAdmin,
        planExpiresAt:
          body.planExpiresAt === undefined
            ? undefined
            : body.planExpiresAt
              ? new Date(body.planExpiresAt)
              : null,
      },
    });
    await writeAuditLog({
      adminId: req.adminUser!.id,
      action: 'user.update',
      target: user.id,
      before,
      after: user,
      ip: req.ip,
    });
    res.json({ user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.flatten() });
      return;
    }
    next(err);
  }
}

export async function listEvents(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30));
    const where = q
      ? {
          OR: [
            { slug: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [total, events] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { email: true, plan: true } },
          _count: { select: { photos: true, contributors: true } },
        },
      }),
    ]);
    res.json({ events, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

const eventPatchSchema = z.object({
  videoEnabled: z.boolean().optional(),
  paidFeaturesUnlocked: z.boolean().optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
  galleryLive: z.boolean().optional(),
  grantAddOnId: z.string().optional(),
});

export async function patchEvent(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = eventPatchSchema.parse(req.body);
    const before = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!before) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const { grantAddOnId, ...eventData } = body;
    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: eventData,
    });

    if (grantAddOnId) {
      await prisma.eventEntitlement.create({
        data: { eventId: event.id, addOnId: grantAddOnId },
      });
    }

    await writeAuditLog({
      adminId: req.adminUser!.id,
      action: 'event.update',
      target: event.id,
      before,
      after: { ...event, grantAddOnId },
      ip: req.ip,
    });
    res.json({ event });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.flatten() });
      return;
    }
    next(err);
  }
}

export async function listPayments(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
    const [total, payments] = await Promise.all([
      prisma.paymentRecord.count(),
      prisma.paymentRecord.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true } },
          event: { select: { name: true, slug: true } },
        },
      }),
    ]);
    res.json({ payments, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}
