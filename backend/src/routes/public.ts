import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { signContributorToken } from '../lib/jwt';
import { ContributorRequest } from '../middleware/requireContributor';
import { uploadToR2 } from '../lib/r2';

function isContributionOpen(event: {
  contributionOpensAt: Date | null;
  contributionClosesAt: Date | null;
}): boolean {
  const now = new Date();
  if (event.contributionOpensAt && now < event.contributionOpensAt) return false;
  if (event.contributionClosesAt && now > event.contributionClosesAt) return false;
  return true;
}

export async function getPublicEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = await prisma.event.findUnique({
      where: { slug: req.params.slug },
      include: {
        owner: { select: { businessName: true, portfolioUrl: true } },
      },
    });
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json({
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
        coverImageUrl: event.coverImageUrl,
        brandingLogoUrl: event.brandingLogoUrl,
        thankYouMessage: event.thankYouMessage,
        requireContributorName: event.requireContributorName,
        galleryLive: event.galleryLive,
        contributionOpen: isContributionOpen(event),
        maxPhotosPerContributor: event.maxPhotosPerContributor,
        ownerBusinessName: event.owner.businessName,
        ownerPortfolioUrl: event.owner.portfolioUrl,
      },
    });
  } catch (err) {
    next(err);
  }
}

const sessionSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  phone: z.string().min(5).max(30).optional(),
});

export async function createSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    if (!isContributionOpen(event)) {
      res.status(403).json({ error: 'Contribution window is closed for this event' });
      return;
    }

    const body = sessionSchema.parse(req.body ?? {});
    if (event.requireContributorName && !body.name) {
      res.status(400).json({ error: 'Name is required for this event' });
      return;
    }

    const sessionToken = randomUUID();
    const contributor = await prisma.contributor.create({
      data: {
        eventId: event.id,
        name: body.name ?? null,
        phone: body.phone ?? null,
        sessionToken,
      },
    });

    const token = signContributorToken({
      eventId: event.id,
      contributorId: contributor.id,
    });

    res.status(201).json({
      token,
      contributor: {
        id: contributor.id,
        name: contributor.name,
        maxPhotos: event.maxPhotosPerContributor,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.flatten() });
      return;
    }
    next(err);
  }
}

export async function getGallery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    if (!event.galleryLive) {
      res.json({ photos: [], pro: [], contributor: [], total: 0, page: 1, pageSize: 60 });
      return;
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 60));
    const typeFilter = typeof req.query.type === 'string' ? req.query.type : undefined;

    const where = {
      eventId: event.id,
      status: 'published',
      ...(typeFilter === 'pro' || typeFilter === 'contributor' ? { type: typeFilter } : {}),
    };

    const [total, photos] = await Promise.all([
      prisma.photo.count({ where }),
      prisma.photo.findMany({
        where,
        orderBy: { uploadedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          contributor: { select: { name: true } },
        },
      }),
    ]);

    const mapped = photos.map((p) => ({
      id: p.id,
      type: p.type,
      fullUrl: p.fullUrl,
      thumbUrl: p.thumbUrl,
      uploadedAt: p.uploadedAt,
      contributorName: p.contributor?.name ?? null,
    }));

    res.json({
      photos: mapped,
      pro: mapped.filter((p) => p.type === 'pro'),
      contributor: mapped.filter((p) => p.type === 'contributor'),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
}

export async function contributorUpload(
  req: ContributorRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    if (req.contributor!.eventId !== event.id) {
      res.status(403).json({ error: 'Token does not match this event' });
      return;
    }
    if (!isContributionOpen(event)) {
      res.status(403).json({ error: 'Contribution window is closed for this event' });
      return;
    }

    const count = await prisma.photo.count({
      where: {
        eventId: event.id,
        contributorId: req.contributor!.contributorId,
      },
    });
    if (count >= event.maxPhotosPerContributor) {
      res.status(403).json({
        error: 'Photo limit reached for this contributor',
        max: event.maxPhotosPerContributor,
      });
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
    const fullKey = `events/${event.id}/contributor/${photoId}-full.jpg`;
    const thumbKey = `events/${event.id}/contributor/${photoId}-thumb.jpg`;

    const [fullUrl, thumbUrl] = await Promise.all([
      uploadToR2(fullKey, full.buffer, 'image/jpeg'),
      uploadToR2(thumbKey, thumb.buffer, 'image/jpeg'),
    ]);

    const status = event.moderationMode === 'manual' ? 'pending' : 'published';
    const photo = await prisma.photo.create({
      data: {
        id: photoId,
        eventId: event.id,
        contributorId: req.contributor!.contributorId,
        type: 'contributor',
        fullUrl,
        thumbUrl,
        status,
      },
    });

    res.status(201).json({ photo });
  } catch (err) {
    next(err);
  }
}
