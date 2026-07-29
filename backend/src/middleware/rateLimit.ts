import rateLimit from 'express-rate-limit';
import { getPlatformSettings } from '../lib/platformConfig';

let cachedMax = 10;
let cachedAt = 0;

export async function refreshUploadRateLimit(): Promise<void> {
  try {
    const platform = await getPlatformSettings();
    cachedMax = platform.uploadRateLimitPerMinute;
    cachedAt = Date.now();
  } catch {
    cachedMax = 10;
  }
}

void refreshUploadRateLimit();

export const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: () => cachedMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads from this IP, please try again shortly' },
});

export const videoSignatureRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many video upload requests, please try again shortly' },
});

export function touchRateLimitCache(): void {
  if (Date.now() - cachedAt > 60_000) void refreshUploadRateLimit();
}
