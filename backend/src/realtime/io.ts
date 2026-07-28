import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { prisma } from '../lib/prisma';

export type LivePhotoPayload = {
  id: string;
  type: string;
  fullUrl: string;
  thumbUrl: string;
  uploadedAt: string;
  contributorName?: string | null;
  status?: string;
};

let io: Server | null = null;

function roomForSlug(slug: string) {
  return `event:${slug}`;
}

export function getIO(): Server | null {
  return io;
}

export function initRealtime(server: HttpServer): Server {
  io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin:
        process.env.NODE_ENV === 'production'
          ? true
          : ['http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    socket.on('event:join', async (payload: { slug?: string }, ack?: (res: unknown) => void) => {
      try {
        const slug = typeof payload?.slug === 'string' ? payload.slug.trim() : '';
        if (!slug) {
          ack?.({ ok: false, error: 'slug required' });
          return;
        }

        const event = await prisma.event.findUnique({
          where: { slug },
          select: { id: true, slug: true },
        });
        if (!event) {
          ack?.({ ok: false, error: 'Event not found' });
          return;
        }

        // Leave previous event rooms on this socket
        for (const room of socket.rooms) {
          if (room.startsWith('event:') && room !== roomForSlug(slug)) {
            void socket.leave(room);
          }
        }

        await socket.join(roomForSlug(slug));
        socket.data.slug = slug;
        ack?.({ ok: true, slug });
        socket.emit('event:joined', { slug });
      } catch (err) {
        console.error('event:join failed', err);
        ack?.({ ok: false, error: 'Join failed' });
      }
    });

    socket.on('event:leave', async (payload: { slug?: string }, ack?: (res: unknown) => void) => {
      const slug = typeof payload?.slug === 'string' ? payload.slug.trim() : socket.data.slug;
      if (slug) {
        await socket.leave(roomForSlug(slug));
        if (socket.data.slug === slug) socket.data.slug = undefined;
      }
      ack?.({ ok: true });
    });
  });

  return io;
}

export function emitPhotoCreated(slug: string, photo: LivePhotoPayload): void {
  getIO()?.to(roomForSlug(slug)).emit('photo:created', { photo });
}

export function emitPhotoDeleted(slug: string, photoId: string): void {
  getIO()?.to(roomForSlug(slug)).emit('photo:deleted', { photoId });
}
