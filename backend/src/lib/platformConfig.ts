import type { Event, PlanDefinition, User } from '@prisma/client';
import { prisma } from './prisma';
import { env } from '../config/env';

export type VideoState = 'available' | 'maintenance' | 'plan_required' | 'disabled_by_owner';

export type VideoCapabilities = {
  state: VideoState;
  message?: string;
  maxDurationSec?: number;
  maxPerEvent?: number;
  maxPerContributor?: number;
};

export type EffectiveLimits = {
  planId: string;
  photos: {
    maxPerContributor: number;
    maxRetentionDays: number;
    maxActiveEvents: number | null;
  };
  video: VideoCapabilities;
  features: {
    allowCustomBranding: boolean;
    allowZipDownload: boolean;
    allowManualModeration: boolean;
  };
};

type GrantOverrides = {
  allowVideo?: boolean;
  maxVideosPerEvent?: number;
  maxVideosPerContributor?: number;
  maxVideoDurationSec?: number;
};

let platformCache: Awaited<ReturnType<typeof loadPlatform>> | null = null;
let plansCache: Map<string, PlanDefinition> | null = null;
let cacheAt = 0;
const TTL_MS = 60_000;

async function loadPlatform() {
  let settings = await prisma.platformSettings.findUnique({ where: { id: 'platform' } });
  if (!settings) {
    settings = await prisma.platformSettings.create({
      data: { id: 'platform' },
    });
  }
  return settings;
}

async function loadPlans(): Promise<Map<string, PlanDefinition>> {
  const plans = await prisma.planDefinition.findMany();
  return new Map(plans.map((p) => [p.id, p]));
}

export function invalidatePlatformCache(): void {
  platformCache = null;
  plansCache = null;
  cacheAt = 0;
}

async function getCachedPlatform() {
  const now = Date.now();
  if (!platformCache || now - cacheAt > TTL_MS) {
    platformCache = await loadPlatform();
    plansCache = await loadPlans();
    cacheAt = now;
  }
  return platformCache;
}

async function getCachedPlans() {
  const now = Date.now();
  if (!plansCache || now - cacheAt > TTL_MS) {
    platformCache = await loadPlatform();
    plansCache = await loadPlans();
    cacheAt = now;
  }
  return plansCache!;
}

export async function getPlatformSettings() {
  return getCachedPlatform();
}

export async function getPlanDefinition(planId: string): Promise<PlanDefinition> {
  const plans = await getCachedPlans();
  const plan = plans.get(planId);
  if (!plan) {
    const fallback = plans.get('free');
    if (!fallback) throw new Error('Free plan not seeded');
    return fallback;
  }
  return plan;
}

function isSubscriptionActive(user: Pick<User, 'plan' | 'planExpiresAt'>): boolean {
  if (user.plan === 'free') return false;
  if (user.plan === 'event_pass') return true;
  if (!user.planExpiresAt) return user.plan === 'pro' || user.plan === 'studio';
  return user.planExpiresAt > new Date();
}

async function getEventGrantOverrides(eventId: string): Promise<GrantOverrides> {
  const entitlements = await prisma.eventEntitlement.findMany({
    where: {
      eventId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  if (entitlements.length === 0) return {};

  const addonIds = entitlements.map((e) => e.addOnId);
  const addons = await prisma.addOnDefinition.findMany({
    where: { id: { in: addonIds }, active: true },
  });

  const merged: GrantOverrides = {};
  for (const addon of addons) {
    const grants = addon.grantsJson as GrantOverrides;
    if (grants.allowVideo) merged.allowVideo = true;
    if (grants.maxVideosPerEvent != null) {
      merged.maxVideosPerEvent = Math.max(merged.maxVideosPerEvent ?? 0, grants.maxVideosPerEvent);
    }
    if (grants.maxVideosPerContributor != null) {
      merged.maxVideosPerContributor = Math.max(
        merged.maxVideosPerContributor ?? 0,
        grants.maxVideosPerContributor
      );
    }
    if (grants.maxVideoDurationSec != null) {
      merged.maxVideoDurationSec = Math.max(
        merged.maxVideoDurationSec ?? 0,
        grants.maxVideoDurationSec
      );
    }
  }
  return merged;
}

function resolvePlanForUser(user: Pick<User, 'plan' | 'planExpiresAt'>, event: Pick<Event, 'paidFeaturesUnlocked'>): string {
  if (user.plan === 'event_pass' && event.paidFeaturesUnlocked) return 'event_pass';
  if (isSubscriptionActive(user) && (user.plan === 'pro' || user.plan === 'studio')) {
    return user.plan;
  }
  return 'free';
}

export async function getEffectiveLimits(
  owner: Pick<User, 'plan' | 'planExpiresAt'>,
  event: Pick<
    Event,
    'id' | 'paidFeaturesUnlocked' | 'videoEnabled' | 'maxPhotosPerContributor' | 'maxVideosPerContributor' | 'retentionDays'
  >
): Promise<EffectiveLimits> {
  const platform = await getCachedPlatform();
  const effectivePlanId = resolvePlanForUser(owner, event);
  const plan = await getPlanDefinition(effectivePlanId);
  const grants = await getEventGrantOverrides(event.id);

  const subscriptionVideo = plan.allowVideo && isSubscriptionActive(owner);
  const addonVideo = grants.allowVideo === true;
  const allowVideo = subscriptionVideo || addonVideo;
  const maxVideosPerEvent = Math.max(plan.maxVideosPerEvent, grants.maxVideosPerEvent ?? 0);
  const planVideoPerContributor = Math.max(
    plan.maxVideosPerContributor,
    grants.maxVideosPerContributor ?? 0
  );
  const maxVideosPerContributor =
    event.maxVideosPerContributor != null
      ? Math.min(event.maxVideosPerContributor, planVideoPerContributor || event.maxVideosPerContributor)
      : planVideoPerContributor;
  const maxVideoDurationSec = Math.max(plan.maxVideoDurationSec, grants.maxVideoDurationSec ?? 0);

  const maxPhotosPerContributor = Math.min(
    event.maxPhotosPerContributor,
    plan.maxPhotosPerContributor
  );
  const maxRetentionDays = Math.min(event.retentionDays, plan.maxRetentionDays);

  let video: VideoCapabilities;

  if (!env.FEATURE_VIDEO_ENABLED) {
    video = {
      state: 'plan_required',
      message: 'Video uploads are not enabled on this server.',
    };
  } else if (!platform.videoEnabled) {
    video = {
      state: 'maintenance',
      message: platform.videoMaintenanceMessage,
    };
  } else if (!allowVideo || maxVideosPerEvent <= 0) {
    video = { state: 'plan_required', message: 'Video is available on paid plans' };
  } else if (!event.videoEnabled) {
    video = { state: 'disabled_by_owner', message: 'Video is disabled for this event' };
  } else if (userNeedsActiveSubscription(owner) && !isSubscriptionActive(owner) && !addonVideo) {
    video = { state: 'plan_required', message: 'Your plan has expired' };
  } else {
    video = {
      state: 'available',
      maxDurationSec: maxVideoDurationSec,
      maxPerEvent: maxVideosPerEvent,
      maxPerContributor: maxVideosPerContributor || grants.maxVideosPerContributor || plan.maxVideosPerContributor,
    };
  }

  return {
    planId: effectivePlanId,
    photos: {
      maxPerContributor: maxPhotosPerContributor,
      maxRetentionDays,
      maxActiveEvents: plan.maxActiveEvents,
    },
    features: {
      allowCustomBranding: plan.allowCustomBranding,
      allowZipDownload: plan.allowZipDownload,
      allowManualModeration: plan.allowManualModeration,
    },
    video,
  };
}

function userNeedsActiveSubscription(user: Pick<User, 'plan' | 'planExpiresAt'>): boolean {
  return user.plan === 'pro' || user.plan === 'studio';
}

export async function getPublicConfig() {
  const platform = await getCachedPlatform();
  return {
    videoGloballyEnabled: env.FEATURE_VIDEO_ENABLED && platform.videoEnabled,
    videoForcedOffByEnv: !env.FEATURE_VIDEO_ENABLED,
    maintenanceMode: platform.maintenanceMode,
    maintenanceMessage: platform.maintenanceMessage,
    registrationEnabled: platform.registrationEnabled,
    currency: platform.currency,
  };
}

export async function getPublicPlans() {
  const plans = await prisma.planDefinition.findMany({
    where: { active: true, billingType: { not: 'addon' } },
    orderBy: { sortOrder: 'asc' },
  });
  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    billingType: p.billingType,
    priceAmount: p.priceAmount,
    priceInterval: p.priceInterval,
    highlightLabel: p.highlightLabel,
    features: {
      maxActiveEvents: p.maxActiveEvents,
      maxPhotosPerContributor: p.maxPhotosPerContributor,
      maxRetentionDays: p.maxRetentionDays,
      allowCustomBranding: p.allowCustomBranding,
      allowZipDownload: p.allowZipDownload,
      allowVideo: p.allowVideo,
      maxVideosPerEvent: p.maxVideosPerEvent,
      maxVideoDurationSec: p.maxVideoDurationSec,
    },
  }));
}

export async function getPublicAddOns() {
  return prisma.addOnDefinition.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });
}
