import type { CSSProperties } from 'react';
import type { EventTheme } from './api';

export const DEFAULT_EVENT_ACCENT = '#d6ff3c';
export const DEFAULT_EVENT_ACCENT_INK = '#0a0a0a';

const INK_BASE = '#070708';
const SURFACE_BASE = '#0e0e10';
const ELEVATED_BASE = '#121217';
const LINE_BASE = '#2e2e38';
const TEXT_BASE = '#f4f4f5';
const MUTED_BASE = '#9b9ba8';

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
  if (!rgb) return DEFAULT_EVENT_ACCENT_INK;
  const accentL = relativeLuminance(rgb.r, rgb.g, rgb.b);
  const blackL = relativeLuminance(0, 0, 0);
  const whiteL = relativeLuminance(255, 255, 255);
  return contrastRatio(accentL, blackL) >= contrastRatio(accentL, whiteL) ? '#0a0a0a' : '#ffffff';
}

export function hasCustomEventTheme(theme?: EventTheme | null): boolean {
  return Boolean(theme && theme.source !== 'default' && theme.accent);
}

export function buildEventThemeTokens(theme?: EventTheme | null): CSSProperties {
  const isDefault = !hasCustomEventTheme(theme);
  const accent = isDefault ? DEFAULT_EVENT_ACCENT : theme!.accent;
  const accentInk = isDefault ? DEFAULT_EVENT_ACCENT_INK : theme!.accentInk || computeAccentInk(accent);

  const elevatedL = relativeLuminance(18, 18, 23);
  const textL = relativeLuminance(244, 244, 245);
  const textContrast = contrastRatio(textL, elevatedL);
  const eventText = textContrast >= 4.5 ? TEXT_BASE : '#ffffff';
  const eventTextMuted = isDefault ? MUTED_BASE : `color-mix(in srgb, ${accent} 16%, ${MUTED_BASE})`;

  return {
    ['--accent' as string]: accent,
    ['--accent-ink' as string]: accentInk,
    ['--event-bg' as string]: `color-mix(in srgb, ${accent} 9%, ${INK_BASE})`,
    ['--event-bg-elevated' as string]: `color-mix(in srgb, ${accent} 14%, ${ELEVATED_BASE})`,
    ['--event-surface' as string]: `color-mix(in srgb, ${accent} 11%, ${SURFACE_BASE})`,
    ['--event-border' as string]: `color-mix(in srgb, ${accent} 24%, ${LINE_BASE})`,
    ['--event-text' as string]: eventText,
    ['--event-text-muted' as string]: eventTextMuted,
    ['--event-text-accent' as string]: accent,
    ['--event-accent-soft' as string]: `color-mix(in srgb, ${accent} 20%, transparent)`,
    ['--event-gradient-a' as string]: `color-mix(in srgb, ${accent} 38%, ${INK_BASE})`,
    ['--event-gradient-b' as string]: `color-mix(in srgb, ${accent} 14%, #0b0b10)`,
    ['--muted' as string]: eventTextMuted,
  };
}

/** Preview tokens for host branding panel from a raw hex seed. */
export function buildEventThemeTokensFromAccent(accent: string): CSSProperties {
  return buildEventThemeTokens({
    accent,
    accentInk: computeAccentInk(accent),
    source: 'manual',
    version: 0,
  });
}
