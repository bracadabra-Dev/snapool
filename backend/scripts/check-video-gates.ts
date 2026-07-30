import { prisma } from '../src/lib/prisma';
import { env } from '../src/config/env';
import { getEffectiveLimits } from '../src/lib/platformConfig';

async function main() {
  console.log('Env FEATURE_VIDEO_ENABLED:', env.FEATURE_VIDEO_ENABLED);
  console.log('Env featureVideoRequested:', env.featureVideoRequested);
  console.log(
    'Cloudinary configured:',
    Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)
  );

  const platform = await prisma.platformSettings.findFirst();
  console.log('\nPlatform settings:', platform);

  const events = await prisma.event.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { owner: { select: { email: true, plan: true, planExpiresAt: true } } },
  });

  for (const event of events) {
    const limits = await getEffectiveLimits(event.owner, event);
    console.log(`\nEvent "${event.name}" (${event.slug})`);
    console.log('  owner:', event.owner.email, 'plan:', event.owner.plan);
    console.log('  event.videoEnabled:', event.videoEnabled);
    console.log('  video capability:', limits.video);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
