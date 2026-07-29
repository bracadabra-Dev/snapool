import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AdminRequest } from '../../middleware/requireSuperAdmin';
import { writeAuditLog } from '../../lib/adminAudit';
import { invalidatePlatformCache } from '../../lib/platformConfig';

const planSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  billingType: z.enum(['free', 'subscription', 'one_time', 'addon']),
  priceAmount: z.number().int().min(0),
  priceInterval: z.enum(['month', 'year']).optional().nullable(),
  campayProductId: z.string().optional().nullable(),
  maxActiveEvents: z.number().int().min(1).optional().nullable(),
  maxPhotosPerContributor: z.number().int().min(1).max(500),
  maxRetentionDays: z.number().int().min(1).max(365),
  allowCustomBranding: z.boolean().optional(),
  allowZipDownload: z.boolean().optional(),
  allowManualModeration: z.boolean().optional(),
  allowVideo: z.boolean().optional(),
  maxVideosPerEvent: z.number().int().min(0).max(10000),
  maxVideosPerContributor: z.number().int().min(0).max(100),
  maxVideoDurationSec: z.number().int().min(0).max(600),
  highlightLabel: z.string().max(40).optional().nullable(),
});

const planPatchSchema = planSchema.partial().omit({ id: true });

export async function listPlans(
  _req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const plans = await prisma.planDefinition.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({ plans });
  } catch (err) {
    next(err);
  }
}

export async function createPlan(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = planSchema.parse(req.body);
    const plan = await prisma.planDefinition.create({ data: body });
    await writeAuditLog({
      adminId: req.adminUser!.id,
      action: 'plan.create',
      target: plan.id,
      after: plan,
      ip: req.ip,
    });
    invalidatePlatformCache();
    res.status(201).json({ plan });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.flatten() });
      return;
    }
    next(err);
  }
}

export async function patchPlan(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = planPatchSchema.parse(req.body);
    const before = await prisma.planDefinition.findUnique({ where: { id: req.params.id } });
    if (!before) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }
    const plan = await prisma.planDefinition.update({
      where: { id: req.params.id },
      data: body,
    });
    await writeAuditLog({
      adminId: req.adminUser!.id,
      action: 'plan.update',
      target: plan.id,
      before,
      after: plan,
      ip: req.ip,
    });
    invalidatePlatformCache();
    res.json({ plan });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.flatten() });
      return;
    }
    next(err);
  }
}
