import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.platformSettings.upsert({
    where: { id: 'platform' },
    update: {},
    create: {
      id: 'platform',
      videoEnabled: false,
      videoMaintenanceMessage: 'Video uploads are temporarily under maintenance',
      registrationEnabled: true,
      maintenanceMode: false,
      defaultMaxPhotosPerContributor: 20,
      defaultRetentionDays: 7,
      uploadRateLimitPerMinute: 10,
      currency: 'XAF',
    },
  });

  const plans = [
    {
      id: 'free',
      name: 'Free',
      description: 'Try PixDump with one event and basic limits',
      sortOrder: 0,
      billingType: 'free',
      priceAmount: 0,
      maxActiveEvents: 1,
      maxPhotosPerContributor: 20,
      maxRetentionDays: 7,
      allowCustomBranding: false,
      allowZipDownload: false,
      allowVideo: false,
      maxVideosPerEvent: 0,
      maxVideosPerContributor: 0,
      maxVideoDurationSec: 0,
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'For photographers running events regularly',
      sortOrder: 1,
      billingType: 'subscription',
      priceAmount: 8000,
      priceInterval: 'month',
      maxActiveEvents: null,
      maxPhotosPerContributor: 200,
      maxRetentionDays: 90,
      allowCustomBranding: true,
      allowZipDownload: true,
      allowVideo: true,
      maxVideosPerEvent: 50,
      maxVideosPerContributor: 3,
      maxVideoDurationSec: 30,
      highlightLabel: 'Most popular',
    },
    {
      id: 'studio',
      name: 'Studio',
      description: 'For teams and high-volume events',
      sortOrder: 2,
      billingType: 'subscription',
      priceAmount: 25000,
      priceInterval: 'month',
      maxActiveEvents: null,
      maxPhotosPerContributor: 200,
      maxRetentionDays: 180,
      allowCustomBranding: true,
      allowZipDownload: true,
      allowVideo: true,
      maxVideosPerEvent: 200,
      maxVideosPerContributor: 10,
      maxVideoDurationSec: 60,
    },
    {
      id: 'event_pass',
      name: 'Event Pass',
      description: 'One-time unlock for a single event',
      sortOrder: 3,
      billingType: 'one_time',
      priceAmount: 2000,
      maxActiveEvents: null,
      maxPhotosPerContributor: 100,
      maxRetentionDays: 30,
      allowCustomBranding: true,
      allowZipDownload: true,
      allowVideo: false,
      maxVideosPerEvent: 0,
      maxVideosPerContributor: 0,
      maxVideoDurationSec: 0,
    },
    {
      id: 'video_addon',
      name: 'Video Add-on',
      description: 'Enable guest video for one event',
      sortOrder: 4,
      billingType: 'addon',
      priceAmount: 1500,
      maxPhotosPerContributor: 0,
      maxRetentionDays: 0,
      allowVideo: true,
      maxVideosPerEvent: 30,
      maxVideosPerContributor: 3,
      maxVideoDurationSec: 30,
      active: true,
    },
  ];

  for (const plan of plans) {
    await prisma.planDefinition.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
  }

  await prisma.addOnDefinition.upsert({
    where: { id: 'video_event_pass' },
    update: {},
    create: {
      id: 'video_event_pass',
      name: 'Event Video Pack',
      description: 'Guest video uploads for one event',
      priceAmount: 1500,
      appliesToPlans: ['event_pass', 'free'],
      grantsJson: {
        allowVideo: true,
        maxVideosPerEvent: 30,
        maxVideosPerContributor: 3,
        maxVideoDurationSec: 30,
      },
    },
  });

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
