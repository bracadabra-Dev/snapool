import type { Event, User } from '@prisma/client';
import { Response } from 'express';
import { prisma } from './prisma';
import { getEffectiveLimits, getPlanDefinition, getPlatformSettings } from './platformConfig';

export class PlanError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendPlanError(res: Response, err: PlanError): void {
  res.status(err.status).json({ error: err.message, code: err.code });
}

export async function getOwnerForEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { owner: true },
  });
  if (!event) return null;
  return event;
}

export async function assertCanCreateEvent(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new PlanError('User not found', 404, 'USER_NOT_FOUND');
  if (user.suspended) throw new PlanError('Account suspended', 403, 'ACCOUNT_SUSPENDED');

  const plan = await getPlanDefinition(user.plan);
  if (plan.maxActiveEvents == null) return;

  const activeCount = await prisma.event.count({ where: { ownerId: userId } });
  if (activeCount >= plan.maxActiveEvents) {
    throw new PlanError(
      `Free plan allows ${plan.maxActiveEvents} active event. Upgrade to create more.`,
      403,
      'PLAN_LIMIT_EVENTS'
    );
  }
}

export async function assertEventUpdateAllowed(
  owner: User,
  event: Event,
  updates: {
    maxPhotosPerContributor?: number;
    retentionDays?: number;
    brandingLogoUrl?: string | null;
    thankYouMessage?: string | null;
    coverImageUrl?: string | null;
    videoEnabled?: boolean;
    maxVideosPerContributor?: number | null;
  }
): Promise<void> {
  const limits = await getEffectiveLimits(owner, event);

  if (updates.maxPhotosPerContributor != null && updates.maxPhotosPerContributor > limits.photos.maxPerContributor) {
    throw new PlanError(
      `Your plan allows up to ${limits.photos.maxPerContributor} photos per contributor`,
      403,
      'PLAN_LIMIT_PHOTOS'
    );
  }

  if (updates.retentionDays != null && updates.retentionDays > limits.photos.maxRetentionDays) {
    throw new PlanError(
      `Your plan allows up to ${limits.photos.maxRetentionDays} days retention`,
      403,
      'PLAN_LIMIT_RETENTION'
    );
  }

  const brandingChange =
    updates.brandingLogoUrl !== undefined ||
    updates.thankYouMessage !== undefined ||
    updates.coverImageUrl !== undefined;
  if (brandingChange && !limits.features.allowCustomBranding) {
    throw new PlanError('Custom branding requires a paid plan', 403, 'PLAN_BRANDING');
  }

  if (updates.videoEnabled === true && limits.video.state !== 'available' && limits.video.state !== 'disabled_by_owner') {
    if (limits.video.state === 'maintenance') {
      throw new PlanError(limits.video.message || 'Video under maintenance', 503, 'VIDEO_MAINTENANCE');
    }
    throw new PlanError('Video requires a paid plan or add-on', 403, 'VIDEO_PLAN_REQUIRED');
  }
}

export async function assertPhotoUploadAllowed(
  owner: User,
  event: Event,
  contributorPhotoCount: number
): Promise<number> {
  const limits = await getEffectiveLimits(owner, event);
  const max = limits.photos.maxPerContributor;
  if (contributorPhotoCount >= max) {
    throw new PlanError('Photo limit reached for this contributor', 403, 'PHOTO_LIMIT');
  }
  return max;
}

export async function assertRegistrationAllowed(): Promise<void> {
  const platform = await getPlatformSettings();
  if (!platform.registrationEnabled) {
    throw new PlanError('Registration is currently disabled', 503, 'REGISTRATION_DISABLED');
  }
}

export function isPaidUser(user: Pick<User, 'plan' | 'planExpiresAt'>): boolean {
  if (user.plan === 'free') return false;
  if (user.plan === 'event_pass') return true;
  if (!user.planExpiresAt) return user.plan === 'pro' || user.plan === 'studio';
  return user.planExpiresAt > new Date();
}
