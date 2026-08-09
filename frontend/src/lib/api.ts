import { legacyStorageKey, readStorageItem, storageKey } from './storageKeys';

const TOKEN_KEY = storageKey('owner_token');
const USER_KEY = storageKey('owner_user');
const TOKEN_KEY_LEGACY = legacyStorageKey('owner_token');
const USER_KEY_LEGACY = legacyStorageKey('owner_user');

export type User = {
  id: string;
  email: string;
  role: string;
  businessName?: string | null;
  plan: string;
  planExpiresAt?: string | null;
  isSuperAdmin?: boolean;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.code);
  }
  return data as T;
}

export type VideoCapabilities = {
  state: 'available' | 'maintenance' | 'plan_required' | 'disabled_by_owner';
  message?: string;
  maxDurationSec?: number;
  maxPerEvent?: number;
  maxPerContributor?: number;
};

export type PlanPublic = {
  id: string;
  name: string;
  description?: string | null;
  billingType: string;
  priceAmount: number;
  priceInterval?: string | null;
  highlightLabel?: string | null;
  features: Record<string, unknown>;
};

export const api = {
  register: (body: {
    email: string;
    password: string;
    role: string;
    businessName?: string;
  }) =>
    request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  me: (token: string) => request<{ user: User }>('/api/auth/me', {}, token),

  listEvents: (token: string) =>
    request<{ events: EventSummary[] }>('/api/events', {}, token),

  createEvent: (token: string, body: { name: string; thankYouMessage?: string }) =>
    request<{ event: EventDetail }>('/api/events', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),

  getEvent: (token: string, id: string) =>
    request<{ event: EventDetail }>(`/api/events/${id}`, {}, token),

  updateEvent: (token: string, id: string, body: Partial<EventConfig>) =>
    request<{ event: EventDetail }>(`/api/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }, token),

  proUpload: (token: string, id: string, full: Blob, thumb: Blob) => {
    const form = new FormData();
    form.append('full', full, 'full.jpg');
    form.append('thumb', thumb, 'thumb.jpg');
    return request<{ photo: Photo }>(`/api/events/${id}/pro-upload`, {
      method: 'POST',
      body: form,
    }, token);
  },

  deletePhoto: (token: string, eventId: string, photoId: string) =>
    request<{ ok: boolean }>(`/api/events/${eventId}/photos/${photoId}`, {
      method: 'DELETE',
    }, token),

  uploadEventFlyer: (token: string, eventId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ event: EventDetail }>(`/api/events/${eventId}/assets/flyer`, {
      method: 'POST',
      body: form,
    }, token);
  },

  deleteEventFlyer: (token: string, eventId: string) =>
    request<{ event: EventDetail }>(`/api/events/${eventId}/assets/flyer`, {
      method: 'DELETE',
    }, token),

  uploadEventWatermark: (token: string, eventId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ event: EventDetail }>(`/api/events/${eventId}/assets/watermark`, {
      method: 'POST',
      body: form,
    }, token);
  },

  deleteEventWatermark: (token: string, eventId: string) =>
    request<{ event: EventDetail }>(`/api/events/${eventId}/assets/watermark`, {
      method: 'DELETE',
    }, token),

  uploadEventLogo: (token: string, eventId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ event: EventDetail }>(`/api/events/${eventId}/assets/logo`, {
      method: 'POST',
      body: form,
    }, token);
  },

  getPublicEvent: (slug: string) =>
    request<{ event: PublicEvent }>(`/api/e/${slug}`),

  getCapabilities: (slug: string) =>
    request<{
      photos: { maxPerContributor: number };
      video: VideoCapabilities;
      features: Record<string, boolean>;
      theme: EventTheme;
      watermark: EventWatermark;
      brandingRevision: number;
    }>(`/api/e/${slug}/capabilities`),

  createSession: (slug: string, body?: { name?: string; phone?: string }) =>
    request<{ token: string; contributor: { id: string; name: string | null; maxPhotos: number } }>(
      `/api/e/${slug}/session`,
      { method: 'POST', body: JSON.stringify(body || {}) }
    ),

  getGallery: (slug: string, opts?: { since?: string }) => {
    const q = opts?.since ? `?since=${encodeURIComponent(opts.since)}` : '';
    return request<{
      photos: Photo[];
      pro: Photo[];
      contributor: Photo[];
      total: number;
    }>(`/api/e/${slug}/gallery${q}`);
  },

  contributorUpload: (slug: string, token: string, full: Blob, thumb: Blob) => {
    const form = new FormData();
    form.append('full', full, 'full.jpg');
    form.append('thumb', thumb, 'thumb.jpg');
    return request<{ photo: Photo }>(`/api/e/${slug}/upload`, {
      method: 'POST',
      body: form,
    }, token);
  },

  contributorVideoSignature: (slug: string, token: string) =>
    request<{ upload: VideoUploadParams; maxDurationSec: number }>(
      `/api/e/${slug}/video/signature`,
      { method: 'POST' },
      token
    ),

  contributorVideoComplete: (slug: string, token: string, body: VideoCompleteBody) =>
    request<{ photo: Photo }>(`/api/e/${slug}/video/complete`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),

  ownerVideoSignature: (token: string, eventId: string) =>
    request<{ upload: VideoUploadParams; maxDurationSec: number }>(
      `/api/events/${eventId}/video/signature`,
      { method: 'POST' },
      token
    ),

  ownerVideoComplete: (token: string, eventId: string, body: VideoCompleteBody) =>
    request<{ photo: Photo }>(`/api/events/${eventId}/video/complete`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),

  getPublicPlans: () =>
    request<{ plans: PlanPublic[]; addons: Array<{ id: string; name: string; priceAmount: number; description?: string | null }> }>(
      '/api/public/plans'
    ),

  checkout: (token: string, body: { planId?: string; addOnId?: string; eventId?: string }) =>
    request<{ paymentId: string; checkoutUrl: string | null; reference: string; devComplete?: boolean }>(
      '/api/billing/checkout',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  devCompletePayment: (token: string, reference: string) =>
    request<{ ok: boolean }>(`/api/billing/dev-complete/${reference}`, { method: 'POST' }, token),

  admin: {
    dashboard: (token: string) => request<AdminDashboard>('/api/admin/dashboard', {}, token),
    getPlatform: (token: string) => request<{ platform: PlatformSettings }>('/api/admin/platform', {}, token),
    patchPlatform: (token: string, body: Partial<PlatformSettings>) =>
      request<{ platform: PlatformSettings }>('/api/admin/platform', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }, token),
    listPlans: (token: string) => request<{ plans: PlanDefinition[] }>('/api/admin/plans', {}, token),
    patchPlan: (token: string, id: string, body: Partial<PlanDefinition>) =>
      request<{ plan: PlanDefinition }>(`/api/admin/plans/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }, token),
    listAudit: (token: string, page = 1) =>
      request<{ logs: AuditLog[]; total: number }>(`/api/admin/audit?page=${page}`, {}, token),
    listUsers: (token: string, q = '') =>
      request<{ users: AdminUser[]; total: number }>(`/api/admin/users?q=${encodeURIComponent(q)}`, {}, token),
    patchUser: (token: string, id: string, body: Record<string, unknown>) =>
      request(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),
    listEvents: (token: string, q = '') =>
      request<{ events: AdminEvent[]; total: number }>(`/api/admin/events?q=${encodeURIComponent(q)}`, {}, token),
    patchEvent: (token: string, id: string, body: Record<string, unknown>) =>
      request(`/api/admin/events/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),
    listPayments: (token: string) =>
      request<{ payments: PaymentRecord[]; total: number }>('/api/admin/payments', {}, token),
    runRetention: (token: string) =>
      request<{ eventsProcessed: number; photosDeleted: number }>('/api/admin/jobs/retention', { method: 'POST' }, token),
  },
};

export type VideoUploadParams = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  eager: string;
  eagerAsync: boolean;
  notificationUrl?: string;
};

export type VideoCompleteBody = {
  publicId: string;
  fullUrl: string;
  thumbUrl: string;
  duration?: number;
};

export type Photo = {
  id: string;
  type: string;
  mediaType?: string;
  fullUrl: string;
  thumbUrl: string;
  duration?: number;
  uploadedAt: string;
  contributorName?: string | null;
  status?: string;
};

export type EventSummary = {
  id: string;
  name: string;
  slug: string;
  publicUrl: string;
  qrCodeUrl?: string | null;
  photoCount: number;
  contributorCount: number;
  createdAt: string;
};

export type EventTheme = {
  accent: string;
  accentInk: string;
  source: 'default' | 'flyer' | 'manual';
  version: number;
};

export type EventWatermark = {
  mode: 'platform' | 'custom';
  imageUrl: string;
};

export type EventConfig = {
  name: string;
  visibility: string;
  galleryLive: boolean;
  moderationMode: string;
  maxPhotosPerContributor: number;
  maxVideosPerContributor?: number | null;
  requireContributorName: boolean;
  thankYouMessage?: string | null;
  brandingLogoUrl?: string | null;
  coverImageUrl?: string | null;
  themeAccent?: string | null;
  themeAccentInk?: string | null;
  themeSource?: string;
  themeVersion?: number;
  watermarkImageUrl?: string | null;
  brandingRevision?: number;
  retentionDays: number;
  videoEnabled?: boolean;
  paidFeaturesUnlocked?: boolean;
  contributionOpensAt?: string | null;
  contributionClosesAt?: string | null;
};

export type EventDetail = EventConfig & {
  id: string;
  slug: string;
  publicUrl: string;
  qrCodeUrl?: string | null;
  qrDataUrl?: string | null;
  photos?: Photo[];
  contributorCount?: number;
  createdAt: string;
};

export type PublicEvent = {
  id: string;
  name: string;
  slug: string;
  coverImageUrl?: string | null;
  brandingLogoUrl?: string | null;
  thankYouMessage?: string | null;
  requireContributorName: boolean;
  galleryLive: boolean;
  contributionOpen: boolean;
  maxPhotosPerContributor: number;
  ownerBusinessName?: string | null;
  ownerPortfolioUrl?: string | null;
  theme: EventTheme;
  watermark: EventWatermark;
  brandingRevision: number;
  viewerCount: number;
};

export type PlatformSettings = {
  videoEnabled: boolean;
  videoMaintenanceMessage: string;
  registrationEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  defaultMaxPhotosPerContributor: number;
  defaultRetentionDays: number;
  uploadRateLimitPerMinute: number;
  currency: string;
};

export type PlanDefinition = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  sortOrder: number;
  billingType: string;
  priceAmount: number;
  priceInterval?: string | null;
  maxActiveEvents?: number | null;
  maxPhotosPerContributor: number;
  maxRetentionDays: number;
  allowCustomBranding: boolean;
  allowZipDownload: boolean;
  allowVideo: boolean;
  maxVideosPerEvent: number;
  maxVideosPerContributor: number;
  maxVideoDurationSec: number;
  highlightLabel?: string | null;
};

export type AdminDashboard = {
  stats: { userCount: number; eventCount: number; photoCount: number; videoCount: number; uploads24h: number };
  platform: PlatformSettings;
  videoForcedOffByEnv: boolean;
  recentAudit: AuditLog[];
};

export type AuditLog = {
  id: string;
  action: string;
  target?: string | null;
  before?: unknown;
  after?: unknown;
  createdAt: string;
  admin: { email: string };
};

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  plan: string;
  planExpiresAt?: string | null;
  isSuperAdmin: boolean;
  suspended: boolean;
  createdAt: string;
  _count: { events: number };
};

export type AdminEvent = {
  id: string;
  name: string;
  slug: string;
  videoEnabled: boolean;
  paidFeaturesUnlocked: boolean;
  retentionDays: number;
  galleryLive: boolean;
  owner: { email: string; plan: string };
  _count: { photos: number; contributors: number };
};

export type PaymentRecord = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  planId?: string | null;
  addOnId?: string | null;
  createdAt: string;
  user?: { email: string } | null;
  event?: { name: string; slug: string } | null;
};

export function loadStoredAuth(): { token: string | null; user: User | null } {
  const token = readStorageItem(TOKEN_KEY, TOKEN_KEY_LEGACY);
  const userRaw = readStorageItem(USER_KEY, USER_KEY_LEGACY);
  return {
    token,
    user: userRaw ? JSON.parse(userRaw) : null,
  };
}

export function storeAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY_LEGACY);
  localStorage.removeItem(USER_KEY_LEGACY);
}
