import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AdminRequest } from '../../middleware/requireSuperAdmin';
import { writeAuditLog } from '../../lib/adminAudit';
import { invalidatePlatformCache } from '../../lib/platformConfig';

const addonSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
  active: z.boolean().optional(),
  priceAmount: z.number().int().min(0),
  campayProductId: z.string().optional().nullable(),
  appliesToPlans: z.array(z.string()).optional(),
  grantsJson: z.record(z.unknown()).optional(),
});

const addonPatchSchema = addonSchema.partial().omit({ id: true });

export async function listAddons(
  _req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const addons = await prisma.addOnDefinition.findMany({ orderBy: { name: 'asc' } });
    res.json({ addons });
  } catch (err) {
    next(err);
  }
}

export async function createAddon(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = addonSchema.parse(req.body);
    const addon = await prisma.addOnDefinition.create({
      data: {
        ...body,
        appliesToPlans: body.appliesToPlans ?? [],
        grantsJson: (body.grantsJson ?? {}) as Prisma.InputJsonValue,
      },
    });
    await writeAuditLog({
      adminId: req.adminUser!.id,
      action: 'addon.create',
      target: addon.id,
      after: addon,
      ip: req.ip,
    });
    invalidatePlatformCache();
    res.status(201).json({ addon });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.flatten() });
      return;
    }
    next(err);
  }
}

export async function patchAddon(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = addonPatchSchema.parse(req.body);
    const before = await prisma.addOnDefinition.findUnique({ where: { id: req.params.id } });
    if (!before) {
      res.status(404).json({ error: 'Add-on not found' });
      return;
    }
    const addon = await prisma.addOnDefinition.update({
      where: { id: req.params.id },
      data: {
        ...body,
        grantsJson: body.grantsJson as Prisma.InputJsonValue | undefined,
      },
    });
    await writeAuditLog({
      adminId: req.adminUser!.id,
      action: 'addon.update',
      target: addon.id,
      before,
      after: addon,
      ip: req.ip,
    });
    invalidatePlatformCache();
    res.json({ addon });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.flatten() });
      return;
    }
    next(err);
  }
}
