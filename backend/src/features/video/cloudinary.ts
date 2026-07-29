import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';
import { env } from '../../config/env';

let configured = false;

export function ensureCloudinaryConfigured(): void {
  if (configured) return;
  if (!env.CLOUDINARY_CLOUD_NAME) return;
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

export function isCloudinaryReady(): boolean {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

/** Pipe-separated eager transforms for signed browser uploads. */
export const EAGER_TRANSFORM_STRING = 'w_1280,c_limit,q_auto,f_mp4|w_400,c_fill,g_auto,f_jpg';

/** @deprecated Use EAGER_TRANSFORM_STRING — kept for exports/tests */
const EAGER_TRANSFORMS = EAGER_TRANSFORM_STRING;

export function buildUploadFolder(eventId: string, type: 'contributor' | 'pro'): string {
  return `spaisnap/events/${eventId}/${type}`;
}

export function signVideoUpload(params: {
  eventId: string;
  uploadType: 'contributor' | 'pro';
  maxDurationSec: number;
}): {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  eager: string;
  eagerAsync: boolean;
  notificationUrl?: string;
} {
  ensureCloudinaryConfigured();
  const timestamp = Math.round(Date.now() / 1000);
  const folder = buildUploadFolder(params.eventId, params.uploadType);
  const eager = EAGER_TRANSFORM_STRING;

  const signParams: Record<string, string | number> = {
    timestamp,
    folder,
    eager,
  };

  if (env.APP_PUBLIC_URL && !env.isDev) {
    signParams.notification_url = `${env.APP_PUBLIC_URL}/api/webhooks/cloudinary`;
  }

  const signature = cloudinary.utils.api_sign_request(signParams, env.CLOUDINARY_API_SECRET);

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    folder,
    eager,
    eagerAsync: false,
    notificationUrl:
      typeof signParams.notification_url === 'string' ? signParams.notification_url : undefined,
  };
}

export function verifyCloudinaryWebhook(body: string, signature: string): boolean {
  const secret = env.CLOUDINARY_WEBHOOK_SECRET || env.CLOUDINARY_API_SECRET;
  const expected = crypto.createHash('sha1').update(body + secret).digest('hex');
  return expected === signature;
}

export async function deleteCloudinaryVideo(publicId: string): Promise<void> {
  ensureCloudinaryConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: 'video', invalidate: true });
}

export function parseCloudinaryResult(result: Record<string, unknown>): {
  publicId: string;
  fullUrl: string;
  thumbUrl: string;
  duration?: number;
} | null {
  const publicId = result.public_id as string | undefined;
  if (!publicId) return null;

  const eager = (result.eager as Array<{ secure_url?: string; format?: string }>) || [];
  const mp4 = eager.find((e) => e.format === 'mp4') || eager[0];
  const poster = eager.find((e) => e.format === 'jpg');

  const fullUrl = mp4?.secure_url || (result.secure_url as string);
  const thumbUrl =
    poster?.secure_url ||
    cloudinary.url(publicId, {
      resource_type: 'video',
      format: 'jpg',
      transformation: [{ width: 400, crop: 'fill', gravity: 'auto' }],
      secure: true,
    });

  const duration = typeof result.duration === 'number' ? Math.round(result.duration) : undefined;

  return { publicId, fullUrl, thumbUrl, duration };
}

export { cloudinary, EAGER_TRANSFORMS };
