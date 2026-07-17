const TOKEN_KEY = 'spaisnap_owner_token';
const USER_KEY = 'spaisnap_owner_user';

export type User = {
  id: string;
  email: string;
  role: string;
  businessName?: string | null;
  plan: string;
};

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
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

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

  getPublicEvent: (slug: string) =>
    request<{ event: PublicEvent }>(`/api/e/${slug}`),

  createSession: (slug: string, body?: { name?: string; phone?: string }) =>
    request<{ token: string; contributor: { id: string; name: string | null; maxPhotos: number } }>(
      `/api/e/${slug}/session`,
      { method: 'POST', body: JSON.stringify(body || {}) }
    ),

  getGallery: (slug: string) =>
    request<{
      photos: Photo[];
      pro: Photo[];
      contributor: Photo[];
      total: number;
    }>(`/api/e/${slug}/gallery`),

  contributorUpload: (slug: string, token: string, full: Blob, thumb: Blob) => {
    const form = new FormData();
    form.append('full', full, 'full.jpg');
    form.append('thumb', thumb, 'thumb.jpg');
    return request<{ photo: Photo }>(`/api/e/${slug}/upload`, {
      method: 'POST',
      body: form,
    }, token);
  },
};

export type Photo = {
  id: string;
  type: string;
  fullUrl: string;
  thumbUrl: string;
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

export type EventConfig = {
  name: string;
  visibility: string;
  galleryLive: boolean;
  moderationMode: string;
  maxPhotosPerContributor: number;
  requireContributorName: boolean;
  thankYouMessage?: string | null;
  brandingLogoUrl?: string | null;
  coverImageUrl?: string | null;
  retentionDays: number;
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
};

export function loadStoredAuth(): { token: string | null; user: User | null } {
  return {
    token: localStorage.getItem(TOKEN_KEY),
    user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
  };
}

export function storeAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
