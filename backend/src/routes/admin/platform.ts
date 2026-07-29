import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AdminRequest } from '../../middleware/requireSuperAdmin';
import { writeAuditLog } from '../../lib/adminAudit';
import { invalidatePlatformCache } from '../../lib/platformConfig';

export async function getDashboard(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [userCount, eventCount, photoCount, videoCount, recentAudit, platform] =
      await Promise.all([
        prisma.user.count(),
        prisma.event.count(),
        prisma.photo.count({ where: { mediaType: 'photo' } }),
        prisma.photo.count({ where: { mediaType: 'video' } }),
        prisma.adminAuditLog.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { admin: { select: { email: true } } },
        }),
        prisma.platformSettings.findUnique({ where: { id: 'platform' } }),
      ]);

    const uploads24h = await prisma.photo.count({ where: { uploadedAt: { gte: since } } });

    res.json({
      stats: { userCount, eventCount, photoCount, videoCount, uploads24h },
      platform,
      videoForcedOffByEnv: process.env.FEATURE_VIDEO_ENABLED !== 'true' && process.env.FEATURE_VIDEO_ENABLED !== '1',
      recentAudit,
    });
  } catch (err) {
    next(err);
  }
}

const platformPatchSchema = z.object({
  videoEnabled: z.boolean().optional(),
  videoMaintenanceMessage: z.string().min(1).max(500).optional(),
  registrationEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().min(1).max(500).optional(),
  defaultMaxPhotosPerContributor: z.number().int().min(1).max(500).optional(),
  defaultRetentionDays: z.number().int().min(1).max(365).optional(),
  uploadRateLimitPerMinute: z.number().int().min(1).max(1000).optional(),
  currency: z.string().min(3).max(6).optional(),
});

export async function getPlatform(
  _req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const platform = await prisma.platformSettings.findUnique({ where: { id: 'platform' } });
    res.json({ platform });
  } catch (err) {
    next(err);
  }
}

export async function patchPlatform(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = platformPatchSchema.parse(req.body);
    const before = await prisma.platformSettings.findUnique({ where: { id: 'platform' } });
    const platform = await prisma.platformSettings.update({
      where: { id: 'platform' },
      data: { ...body, updatedBy: req.adminUser!.id },
    });
    await writeAuditLog({
      adminId: req.adminUser!.id,
      action: 'platform.update',
      target: 'platform',
      before,
      after: platform,
      ip: req.ip,
    });
    invalidatePlatformCache();
    res.json({ platform });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.flatten() });
      return;
    }
    next(err);
  }
}

export async function invalidateCache(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    invalidatePlatformCache();
    await writeAuditLog({
      adminId: req.adminUser!.id,
      action: 'cache.invalidate',
      ip: req.ip,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
