import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { AuthedRequest } from '../middleware/requireAuth';
import { makeUniqueSlug } from '../utils/slug';
import { generateAndStoreQr, generateQrDataUrl } from '../utils/qr';
import { uploadToR2, deleteFromR2, publicUrlToKey } from '../lib/r2';
import { env } from '../config/env';
import { emitPhotoCreated, emitPhotoDeleted } from '../realtime/io';
import {
  assertCanCreateEvent,
  assertEventUpdateAllowed,
  PlanError,
  sendPlanError,
} from '../lib/plans';
import { getPlatformSettings, getPlanDefinition } from '../lib/platformConfig';
import { deleteCloudinaryVideo } from '../features/video/cloudinary';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image uploads are allowed'));
  },
});

const createEventSchema = z.object({
  name: z.string().min(1).max(120),
  coverImageUrl: z.string().url().optional().nullable(),
  visibility: z.enum(['public', 'unlisted', 'password']).optional(),
  thankYouMessage: z.string().max(500).optional().nullable(),
  maxPhotosPerContributor: z.number().int().min(1).max(200).optional(),
  requireContributorName: z.boolean().optional(),
  galleryLive: z.boolean().optional(),
  moderationMode: z.enum(['auto', 'manual']).optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
  contributionOpensAt: z.string().datetime().optional().nullable(),
  contributionClosesAt: z.string().datetime().optional().nullable(),
  brandingLogoUrl: z.string().url().optional().nullable(),
  videoEnabled: z.boolean().optional(),
  maxVideosPerContributor: z.number().int().min(0).max(100).optional().nullable(),
});

const updateEventSchema = createEventSchema.partial().extend({
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(4).optional().nullable(),
});

function eventPublicUrl(slug: string): string {
  return `${env.APP_PUBLIC_URL}/e/${slug}`;
}

export async function listEvents(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const events = await prisma.event.findMany({
      where: { ownerId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { photos: true, contributors: true } },
      },
    });
    res.json({
      events: events.map((e) => ({
        ...e,
        publicUrl: eventPublicUrl(e.slug),
        photoCount: e._count.photos,
        contributorCount: e._count.contributors,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function createEvent(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await assertCanCreateEvent(req.user!.userId);
    const body = createEventSchema.parse(req.body);
    const owner = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!owner) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const plan = await getPlanDefinition(owner.plan);
    const platform = await getPlatformSettings();
    const slug = makeUniqueSlug(body.name);
    const id = randomUUID();

    const event = await prisma.event.create({
      data: {
        id,
        ownerId: req.user!.userId,
        name: body.name,
        slug,
        coverImageUrl: body.coverImageUrl ?? null,
        visibility: body.visibility ?? 'unlisted',
        thankYouMessage: body.thankYouMessage ?? null,
        maxPhotosPerContributor: Math.min(
          body.maxPhotosPerContributor ?? platform.defaultMaxPhotosPerContributor,
          plan.maxPhotosPerContributor
        ),
        requireContributorName: body.requireContributorName ?? false,
        galleryLive: body.galleryLive ?? true,
        moderationMode: body.moderationMode ?? 'auto',
        retentionDays: Math.min(
          body.retentionDays ?? platform.defaultRetentionDays,
          plan.maxRetentionDays
        ),
        contributionOpensAt: body.contributionOpensAt ? new Date(body.contributionOpensAt) : null,
        contributionClosesAt: body.contributionClosesAt
          ? new Date(body.contributionClosesAt)
          : null,
        brandingLogoUrl: body.brandingLogoUrl ?? null,
        videoEnabled: false,
      },
    });

    const publicUrl = eventPublicUrl(slug);
    let qrCodeUrl: string | null = null;
    let qrDataUrl: string | null = null;

    try {
      qrCodeUrl = await generateAndStoreQr(event.id, publicUrl);
      await prisma.event.update({
        where: { id: event.id },
        data: { qrCodeUrl },
      });
    } catch (qrErr) {
      console.warn('R2 QR upload failed, falling back to data URL:', qrErr);
      qrDataUrl = await generateQrDataUrl(publicUrl);
    }

    res.status(201).json({
      event: {
        ...event,
        qrCodeUrl,
        publicUrl,
        qrDataUrl,
      },
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

export async function getEvent(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = await prisma.event.findFirst({
      where: { id: req.params.id, ownerId: req.user!.userId },
      include: {
        photos: { orderBy: { uploadedAt: 'desc' } },
        _count: { select: { contributors: true } },
      },
    });
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json({
      event: {
        ...event,
        publicUrl: eventPublicUrl(event.slug),
        contributorCount: event._count.contributors,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateEvent(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = updateEventSchema.parse(req.body);
    const existing = await prisma.event.findFirst({
      where: { id: req.params.id, ownerId: req.user!.userId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const owner = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!owner) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await assertEventUpdateAllowed(owner, existing, body);

    const { password, ...rest } = body;
    const data: Record<string, unknown> = { ...rest };
    if (password === null) data.passwordHash = null;
    if (typeof password === 'string') {
      const bcrypt = await import('bcryptjs');
      data.passwordHash = await bcrypt.hash(password, 10);
    }
    if (rest.contributionOpensAt !== undefined) {
      data.contributionOpensAt = rest.contributionOpensAt
        ? new Date(rest.contributionOpensAt)
        : null;
    }
    if (rest.contributionClosesAt !== undefined) {
      data.contributionClosesAt = rest.contributionClosesAt
        ? new Date(rest.contributionClosesAt)
        : null;
    }

    const event = await prisma.event.update({
      where: { id: existing.id },
      data,
    });

    res.json({ event: { ...event, publicUrl: eventPublicUrl(event.slug) } });
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

export async function proUpload(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = await prisma.event.findFirst({
      where: { id: req.params.id, ownerId: req.user!.userId },
    });
    if (!event) {
      res.status(403).json({ error: 'Only the event owner can upload Pro Shots' });
      return;
    }

    const files = req.files as { full?: Express.Multer.File[]; thumb?: Express.Multer.File[] };
    const full = files?.full?.[0];
    const thumb = files?.thumb?.[0];
    if (!full || !thumb) {
      res.status(400).json({ error: 'Both full and thumb image files are required' });
      return;
    }

    const photoId = randomUUID();
    const fullKey = `events/${event.id}/pro/${photoId}-full.jpg`;
    const thumbKey = `events/${event.id}/pro/${photoId}-thumb.jpg`;

    const [fullUrl, thumbUrl] = await Promise.all([
      uploadToR2(fullKey, full.buffer, 'image/jpeg'),
      uploadToR2(thumbKey, thumb.buffer, 'image/jpeg'),
    ]);

    const photo = await prisma.photo.create({
      data: {
        id: photoId,
        eventId: event.id,
        contributorId: null,
        type: 'pro',
        fullUrl,
        thumbUrl,
        status: 'published',
      },
    });

    const payload = {
      id: photo.id,
      type: photo.type,
      mediaType: photo.mediaType,
      fullUrl: photo.fullUrl,
      thumbUrl: photo.thumbUrl,
      uploadedAt: photo.uploadedAt.toISOString(),
      contributorName: null as string | null,
      status: photo.status,
    };
    emitPhotoCreated(event.slug, payload);

    res.status(201).json({ photo: payload });
  } catch (err) {
    next(err);
  }
}

export async function deletePhoto(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const photo = await prisma.photo.findUnique({
      where: { id: req.params.photoId },
      include: { event: true },
    });
    if (!photo || photo.event.ownerId !== req.user!.userId) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    if (photo.mediaType === 'video' && photo.cloudinaryPublicId) {
      await deleteCloudinaryVideo(photo.cloudinaryPublicId).catch(() => undefined);
    } else {
      const keys = [publicUrlToKey(photo.fullUrl), publicUrlToKey(photo.thumbUrl)].filter(
        Boolean
      ) as string[];
      await Promise.all(keys.map((k) => deleteFromR2(k).catch(() => undefined)));
    }
    await prisma.photo.delete({ where: { id: photo.id } });
    emitPhotoDeleted(photo.event.slug, photo.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
