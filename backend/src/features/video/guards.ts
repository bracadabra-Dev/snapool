import type { Event, User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getEffectiveLimits } from '../../lib/platformConfig';
import { VideoError } from './index';

export async function countEventVideos(eventId: string): Promise<number> {
  return prisma.photo.count({ where: { eventId, mediaType: 'video' } });
}

export async function countContributorVideos(
  eventId: string,
  contributorId: string
): Promise<number> {
  return prisma.photo.count({
    where: { eventId, contributorId, mediaType: 'video' },
  });
}

export async function assertVideoUploadAllowed(
  owner: User,
  event: Event,
  contributorId?: string
): Promise<{ maxDurationSec: number }> {
  const limits = await getEffectiveLimits(owner, event);
  const video = limits.video;

  if (video.state === 'maintenance') {
    throw new VideoError(
      video.message || 'Video uploads are temporarily under maintenance',
      503,
      'VIDEO_MAINTENANCE'
    );
  }
  if (video.state === 'plan_required') {
    throw new VideoError(video.message || 'Video is available on paid plans', 403, 'VIDEO_PLAN_REQUIRED');
  }
  if (video.state === 'disabled_by_owner') {
    throw new VideoError('Video is disabled for this event', 403, 'VIDEO_DISABLED');
  }

  const maxPerEvent = video.maxPerEvent ?? 0;
  const eventCount = await countEventVideos(event.id);
  if (eventCount >= maxPerEvent) {
    throw new VideoError('Video limit reached for this event', 403, 'VIDEO_LIMIT');
  }

  if (contributorId) {
    const maxPerContributor = video.maxPerContributor ?? 0;
    const contributorCount = await countContributorVideos(event.id, contributorId);
    if (contributorCount >= maxPerContributor) {
      throw new VideoError('Video limit reached for this contributor', 403, 'VIDEO_LIMIT');
    }
  }

  return { maxDurationSec: video.maxDurationSec ?? 30 };
}
