import sharp from 'sharp';
import { uploadToR2, deleteFromR2 } from './r2';
import { extractThemeFromImage } from './flyerThemeExtract';
import {
  DEFAULT_THEME_SOURCE,
} from './eventBranding';

const FLYER_MAX_BYTES = 4 * 1024 * 1024;
const WATERMARK_MAX_BYTES = 512 * 1024;
const LOGO_MAX_BYTES = 512 * 1024;

const FLYER_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PNG_MIMES = new Set(['image/png']);

export type FlyerUploadResult = {
  url: string;
  themeAccent: string | null;
  themeAccentInk: string | null;
  themeSource: typeof DEFAULT_THEME_SOURCE | 'flyer';
};

export { extractThemeFromImage } from './flyerThemeExtract';

export function validateFlyerFile(file: Express.Multer.File): void {
  if (!FLYER_MIMES.has(file.mimetype)) {
    throw new Error('Flyer must be JPEG, PNG, or WebP');
  }
  if (file.size > FLYER_MAX_BYTES) {
    throw new Error('Flyer must be 4MB or smaller');
  }
}

export function validatePngAsset(file: Express.Multer.File, label: string, maxBytes: number): void {
  if (!PNG_MIMES.has(file.mimetype)) {
    throw new Error(`${label} must be a PNG file`);
  }
  if (file.size > maxBytes) {
    throw new Error(`${label} must be ${Math.round(maxBytes / 1024)}KB or smaller`);
  }
}

export async function processAndUploadFlyer(
  eventId: string,
  file: Express.Multer.File
): Promise<FlyerUploadResult> {
  validateFlyerFile(file);
  const theme = await extractThemeFromImage(file.buffer);

  const jpeg = await sharp(file.buffer)
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();

  const key = `events/${eventId}/flyer.jpg`;
  const url = await uploadToR2(key, jpeg, 'image/jpeg', 'public, max-age=60, must-revalidate');

  if (theme) {
    return {
      url,
      themeAccent: theme.accent,
      themeAccentInk: theme.accentInk,
      themeSource: 'flyer',
    };
  }

  return {
    url,
    themeAccent: null,
    themeAccentInk: null,
    themeSource: DEFAULT_THEME_SOURCE,
  };
}

export async function uploadWatermarkPng(eventId: string, file: Express.Multer.File): Promise<string> {
  validatePngAsset(file, 'Watermark', WATERMARK_MAX_BYTES);
  const png = await sharp(file.buffer).png().toBuffer();
  const key = `events/${eventId}/watermark.png`;
  return uploadToR2(key, png, 'image/png');
}

export async function uploadLogoPng(eventId: string, file: Express.Multer.File): Promise<string> {
  validatePngAsset(file, 'Logo', LOGO_MAX_BYTES);
  const png = await sharp(file.buffer)
    .resize(800, 400, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  const key = `events/${eventId}/logo.png`;
  return uploadToR2(key, png, 'image/png');
}

export async function deleteAssetByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const { publicUrlToKey } = await import('./r2');
  const key = publicUrlToKey(url);
  if (key) await deleteFromR2(key).catch(() => undefined);
}

export function resetThemeFields() {
  return {
    themeAccent: null,
    themeAccentInk: null,
    themeSource: DEFAULT_THEME_SOURCE,
  };
}
