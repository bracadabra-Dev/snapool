import crypto from 'crypto';
import type { Request } from 'express';
import { env } from '../config/env';
import { prisma } from './prisma';

function hashIp(ip: string): string {
  const pepper = env.JWT_SECRET || 'pixdump-viewer';
  return crypto.createHash('sha256').update(`${pepper}:${ip}`).digest('hex');
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.ip || 'unknown';
}

export async function recordEventPageView(eventId: string, req: Request): Promise<number> {
  const ipHash = hashIp(getClientIp(req));

  await prisma.eventPageView.upsert({
    where: {
      eventId_ipHash: { eventId, ipHash },
    },
    create: { eventId, ipHash },
    update: { lastSeen: new Date() },
  });

  return prisma.eventPageView.count({ where: { eventId } });
}

export async function getEventViewerCount(eventId: string): Promise<number> {
  return prisma.eventPageView.count({ where: { eventId } });
}
