import { io, type Socket } from 'socket.io-client';
import type { Photo } from './api';

export type LiveConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';

export type PhotoCreatedEvent = { photo: Photo };
export type PhotoDeletedEvent = { photoId: string };

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: '/socket.io',
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 15000,
      randomizationFactor: 0.5,
      timeout: 20000,
    });
  }
  return socket;
}

export function upsertPhotos(prev: Photo[], incoming: Photo[]): Photo[] {
  if (!incoming.length) return prev;
  const map = new Map<string, Photo>();
  for (const p of prev) map.set(p.id, p);
  for (const p of incoming) {
    map.set(p.id, {
      ...p,
      uploadedAt:
        typeof p.uploadedAt === 'string' ? p.uploadedAt : new Date(p.uploadedAt).toISOString(),
    });
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

export function newestUploadedAt(photos: Photo[]): string | undefined {
  if (!photos.length) return undefined;
  let newest = photos[0].uploadedAt;
  for (const p of photos) {
    if (new Date(p.uploadedAt).getTime() > new Date(newest).getTime()) {
      newest = p.uploadedAt;
    }
  }
  return typeof newest === 'string' ? newest : new Date(newest).toISOString();
}
