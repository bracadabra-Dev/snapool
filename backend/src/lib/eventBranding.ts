import type { Event, User } from '@prisma/client';
import { env } from '../config/env';
import { getEffectiveLimits } from './platformConfig';
import { PLATFORM_WATERMARK_PATH } from './brandAssets';

export const DEFAULT_THEME_ACCENT = '#d6ff3c';
export const DEFAULT_THEME_ACCENT_INK = '#0a0a0a';
export const DEFAULT_THEME_SOURCE = 'default' as const;

export type ThemeSource = 'default' | 'flyer' | 'manual';

export type ResolvedTheme = {
  accent: string;
  accentInk: string;
  source: ThemeSource;
  version: number;
};

export type ResolvedWatermark = {
  mode: 'platform' | 'custom';
  imageUrl: string;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function computeAccentInk(accentHex: string): string {
  const rgb = hexToRgb(accentHex);
  if (!rgb) return DEFAULT_THEME_ACCENT_INK;
  const accentL = relativeLuminance(rgb.r, rgb.g, rgb.b);
  const blackL = relativeLuminance(0, 0, 0);
  const whiteL = relativeLuminance(255, 255, 255);
  return contrastRatio(accentL, blackL) >= contrastRatio(accentL, whiteL) ? '#0a0a0a' : '#ffffff';
}

export function resolveTheme(event: Pick<Event, 'themeAccent' | 'themeAccentInk' | 'themeSource' | 'themeVersion'>): ResolvedTheme {
  const source = (event.themeSource || DEFAULT_THEME_SOURCE) as ThemeSource;
  if (source !== 'default' && event.themeAccent) {
    return {
      accent: event.themeAccent,
      accentInk: event.themeAccentInk || computeAccentInk(event.themeAccent),
      source,
      version: event.themeVersion ?? 0,
    };
  }
  return {
    accent: DEFAULT_THEME_ACCENT,
    accentInk: DEFAULT_THEME_ACCENT_INK,
    source: 'default',
    version: event.themeVersion ?? 0,
  };
}

export function platformWatermarkUrl(platformWatermarkUrl?: string | null): string {
  if (platformWatermarkUrl) return platformWatermarkUrl;
  return `${env.APP_PUBLIC_URL}${PLATFORM_WATERMARK_PATH}`;
}

export async function resolveWatermark(
  event: Event,
  owner: User,
  platformWatermarkUrlSetting?: string | null
): Promise<ResolvedWatermark> {
  const limits = await getEffectiveLimits(owner, event);
  if (limits.features.allowCustomBranding && event.watermarkImageUrl) {
    return { mode: 'custom', imageUrl: event.watermarkImageUrl };
  }
  return { mode: 'platform', imageUrl: platformWatermarkUrl(platformWatermarkUrlSetting) };
}

export function buildPublicBrandingPayload(
  event: Event,
  theme: ResolvedTheme,
  watermark: ResolvedWatermark
) {
  return {
    theme,
    watermark,
    brandingRevision: event.brandingRevision ?? 0,
  };
}
