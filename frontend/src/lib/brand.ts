/** Short product name for in-app UI and copy. */
export const PLATFORM_NAME = 'PixDump';

/** Official public domain (URLs, SEO, billing descriptors). */
export const PLATFORM_DOMAIN = 'pixdump.net';

/** Uppercase label for nav headers and badges. */
export const PLATFORM_NAME_HEADER = 'PIXDUMP';

/** Short slug for storage keys and internal identifiers. */
export const PLATFORM_SLUG = 'pixdump';

/** Brand palette tokens. */
export const BRAND_COLORS = {
  accent: '#d6ff3c',
  accentInk: '#0a0a0a',
  ink: '#070708',
  text: '#f4f4f5',
  muted: '#9b9ba8',
} as const;

/** PNG exports for marketing, print, and social (regenerate: npm run export-brand-png -w backend). */
export const BRAND_PNG = {
  mark1024: '/brand/png/logo-mark/logo-mark-1024.png',
  mark512: '/brand/png/logo-mark/logo-mark-512.png',
  mark256: '/brand/png/logo-mark/logo-mark-256.png',
  fullLight1200: '/brand/png/logo-full-light/logo-full-light-1200w.png',
  fullLight800: '/brand/png/logo-full-light/logo-full-light-800w.png',
  fullDark1200: '/brand/png/logo-full-dark/logo-full-dark-1200w.png',
  stacked512: '/brand/png/logo-stacked-light/logo-stacked-light-512w.png',
  og1200x630: '/brand/png/og-image/og-image-1200x630.png',
  appleTouch180: '/brand/png/apple-touch-icon/apple-touch-icon-180.png',
  favicon32: '/brand/png/favicon/favicon-32.png',
  favicon128: '/brand/png/favicon/favicon-128.png',
  watermark560: '/brand/png/watermark/watermark-560w.png',
  baseDir: '/brand/png',
} as const;

/** Static logo asset paths (served from /public). */
export const BRAND_ASSETS = {
  mark: '/brand/logo-mark.svg',
  markMono: '/brand/logo-mark-mono.svg',
  fullLight: '/brand/logo-full-light.svg',
  fullDark: '/brand/logo-full-dark.svg',
  stackedLight: '/brand/logo-stacked-light.svg',
  favicon: '/favicon.svg',
  faviconPng: BRAND_PNG.favicon32,
  appleTouchIcon: BRAND_PNG.appleTouch180,
  appleTouchSvg: '/apple-touch-icon.svg',
  watermark: BRAND_PNG.watermark560,
  ogImage: BRAND_PNG.og1200x630,
  manifest: '/site.webmanifest',
} as const;

/** Default platform watermark baked onto free-tier photo uploads. */
export const PLATFORM_WATERMARK = {
  imageUrl: BRAND_PNG.watermark560,
  /** Full-size uploads (~2048px) */
  opacity: 0.62,
  widthRatio: 0.105,
  minWidth: 72,
  maxWidthRatio: 0.14,
  /** Thumbnails (~400px) — slightly smaller relative footprint */
  thumbOpacity: 0.58,
  thumbWidthRatio: 0.13,
  thumbMinWidth: 40,
} as const;
