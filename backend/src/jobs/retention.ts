import { prisma } from '../lib/prisma';
import { deleteFromR2, publicUrlToKey } from '../lib/r2';
import { deleteCloudinaryVideo } from '../features/video/cloudinary';

export async function runRetentionCleanup(): Promise<{ eventsProcessed: number; photosDeleted: number }> {
  const events = await prisma.event.findMany({
    include: { photos: true },
  });

  let eventsProcessed = 0;
  let photosDeleted = 0;
  const now = Date.now();

  for (const event of events) {
    const expiresAt = event.createdAt.getTime() + event.retentionDays * 24 * 60 * 60 * 1000;
    if (now < expiresAt) continue;

    eventsProcessed += 1;

    for (const photo of event.photos) {
      if (photo.mediaType === 'video' && photo.cloudinaryPublicId) {
        await deleteCloudinaryVideo(photo.cloudinaryPublicId).catch(() => undefined);
      } else {
        const keys = [publicUrlToKey(photo.fullUrl), publicUrlToKey(photo.thumbUrl)].filter(
          Boolean
        ) as string[];
        await Promise.all(keys.map((k) => deleteFromR2(k).catch(() => undefined)));
      }
      await prisma.photo.delete({ where: { id: photo.id } });
      photosDeleted += 1;
    }
  }

  return { eventsProcessed, photosDeleted };
}
