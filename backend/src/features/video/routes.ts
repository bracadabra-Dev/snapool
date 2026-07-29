import { Response, NextFunction, Request } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { ContributorRequest } from '../../middleware/requireContributor';
import { AuthedRequest } from '../../middleware/requireAuth';
import { assertVideoUploadAllowed } from './guards';
import { signVideoUpload, parseCloudinaryResult, verifyCloudinaryWebhook } from './cloudinary';
import { VideoError, sendVideoError } from './index';
import { emitPhotoCreated } from '../../realtime/io';

export async function contributorVideoSignature(
  req: ContributorRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const event = await prisma.event.findUnique({
      where: { slug: req.params.slug },
      include: { owner: true },
    });
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    if (req.contributor!.eventId !== event.id) {
      res.status(403).json({ error: 'Token does not match this event' });
      return;
    }

    const { maxDurationSec } = await assertVideoUploadAllowed(
      event.owner,
      event,
      req.contributor!.contributorId
    );

    const signed = signVideoUpload({
      eventId: event.id,
      uploadType: 'contributor',
      maxDurationSec,
    });

    res.json({ upload: signed, maxDurationSec });
  } catch (err) {
    if (err instanceof VideoError) {
      sendVideoError(res, err);
      return;
    }
    next(err);
  }
}

export async function ownerVideoSignature(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const event = await prisma.event.findFirst({
      where: { id: req.params.id, ownerId: req.user!.userId },
      include: { owner: true },
    });
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const { maxDurationSec } = await assertVideoUploadAllowed(event.owner, event);

    const signed = signVideoUpload({
      eventId: event.id,
      uploadType: 'pro',
      maxDurationSec,
    });

    res.json({ upload: signed, maxDurationSec });
  } catch (err) {
    if (err instanceof VideoError) {
      sendVideoError(res, err);
      return;
    }
    next(err);
  }
}

type CompleteBody = {
  publicId: string;
  fullUrl: string;
  thumbUrl: string;
  duration?: number;
  type?: 'pro' | 'contributor';
};

async function persistVideo(
  event: { id: string; slug: string; moderationMode: string },
  data: CompleteBody & { contributorId?: string | null; type: 'pro' | 'contributor' }
) {
  const status = event.moderationMode === 'manual' ? 'pending' : 'published';
  const photo = await prisma.photo.create({
    data: {
      id: randomUUID(),
      eventId: event.id,
      contributorId: data.contributorId ?? null,
      type: data.type,
      mediaType: 'video',
      fullUrl: data.fullUrl,
      thumbUrl: data.thumbUrl,
      duration: data.duration ?? null,
      cloudinaryPublicId: data.publicId,
      status,
    },
    include: {
      contributor: { select: { name: true } },
    },
  });

  const payload = {
    id: photo.id,
    type: photo.type,
    mediaType: photo.mediaType,
    fullUrl: photo.fullUrl,
    thumbUrl: photo.thumbUrl,
    duration: photo.duration ?? undefined,
    uploadedAt: photo.uploadedAt.toISOString(),
    contributorName: photo.contributor?.name ?? null,
    status: photo.status,
  };

  if (photo.status === 'published') {
    emitPhotoCreated(event.slug, payload);
  }

  return payload;
}

export async function contributorVideoComplete(
  req: ContributorRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const event = await prisma.event.findUnique({
      where: { slug: req.params.slug },
      include: { owner: true },
    });
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    await assertVideoUploadAllowed(event.owner, event, req.contributor!.contributorId);

    const body = req.body as CompleteBody;
    if (!body.publicId || !body.fullUrl || !body.thumbUrl) {
      res.status(400).json({ error: 'publicId, fullUrl, and thumbUrl are required' });
      return;
    }

    const photo = await persistVideo(event, {
      ...body,
      type: 'contributor',
      contributorId: req.contributor!.contributorId,
    });

    res.status(201).json({ photo });
  } catch (err) {
    if (err instanceof VideoError) {
      sendVideoError(res, err);
      return;
    }
    next(err);
  }
}

export async function ownerVideoComplete(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const event = await prisma.event.findFirst({
      where: { id: req.params.id, ownerId: req.user!.userId },
      include: { owner: true },
    });
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    await assertVideoUploadAllowed(event.owner, event);

    const body = req.body as CompleteBody;
    if (!body.publicId || !body.fullUrl || !body.thumbUrl) {
      res.status(400).json({ error: 'publicId, fullUrl, and thumbUrl are required' });
      return;
    }

    const photo = await persistVideo(event, { ...body, type: 'pro', contributorId: null });
    res.status(201).json({ photo });
  } catch (err) {
    if (err instanceof VideoError) {
      sendVideoError(res, err);
      return;
    }
    next(err);
  }
}

export async function cloudinaryWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.headers['x-cld-signature'] as string | undefined;
    const timestamp = req.headers['x-cld-timestamp'] as string | undefined;
    if (signature && timestamp) {
      const rawBody = JSON.stringify(req.body);
      if (!verifyCloudinaryWebhook(`${timestamp}${rawBody}`, signature)) {
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
    }

    const notification = req.body as Record<string, unknown>;
    if (notification.notification_type !== 'eager' && notification.notification_type !== 'upload') {
      res.json({ ok: true });
      return;
    }

    const parsed = parseCloudinaryResult(notification);
    if (!parsed) {
      res.json({ ok: true });
      return;
    }

    const folder = (notification.folder as string) || '';
    const match = folder.match(/^spaisnap\/events\/([^/]+)\/(contributor|pro)$/);
    if (!match) {
      res.json({ ok: true });
      return;
    }

    const [, eventId, uploadType] = match;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      res.json({ ok: true });
      return;
    }

    const existing = await prisma.photo.findFirst({
      where: { cloudinaryPublicId: parsed.publicId },
    });
    if (existing) {
      res.json({ ok: true });
      return;
    }

    await persistVideo(event, {
      publicId: parsed.publicId,
      fullUrl: parsed.fullUrl,
      thumbUrl: parsed.thumbUrl,
      duration: parsed.duration,
      type: uploadType as 'contributor' | 'pro',
      contributorId: null,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
