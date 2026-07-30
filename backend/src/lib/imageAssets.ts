import sharp from 'sharp';
import { uploadToR2, deleteFromR2 } from './r2';
import {
  computeAccentInk,
  DEFAULT_THEME_ACCENT,
  DEFAULT_THEME_ACCENT_INK,
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

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

export async function extractThemeFromImage(buffer: Buffer): Promise<{
  accent: string;
  accentInk: string;
} | null> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(120, 120, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels: Array<{ r: number; g: number; b: number; sat: number }> = [];
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const sat = saturation(r, g, b);
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (sat > 0.18 && lum > 0.12 && lum < 0.92) {
        pixels.push({ r, g, b, sat });
      }
    }

    if (pixels.length === 0) return null;

    pixels.sort((a, b) => b.sat - a.sat);
    const top = pixels.slice(0, Math.min(12, pixels.length));
    const r = Math.round(top.reduce((s, p) => s + p.r, 0) / top.length);
    const g = Math.round(top.reduce((s, p) => s + p.g, 0) / top.length);
    const b = Math.round(top.reduce((s, p) => s + p.b, 0) / top.length);
    const accent = rgbToHex(r, g, b);
    const accentInk = computeAccentInk(accent);

    const pageBgL = 0.02;
    const accentL =
      0.2126 * Math.pow(r / 255, 2.2) +
      0.7152 * Math.pow(g / 255, 2.2) +
      0.0722 * Math.pow(b / 255, 2.2);
    if (Math.abs(accentL - pageBgL) < 0.08) return null;

    return { accent, accentInk };
  } catch {
    return null;
  }
}

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
  const jpeg = await sharp(file.buffer)
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();

  const key = `events/${eventId}/flyer.jpg`;
  const url = await uploadToR2(key, jpeg, 'image/jpeg');

  const theme = await extractThemeFromImage(jpeg);
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

export { DEFAULT_THEME_ACCENT, DEFAULT_THEME_ACCENT_INK };
