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

/** Static logo asset paths (served from /public). */
export const BRAND_ASSETS = {
  mark: '/brand/logo-mark.svg',
  markMono: '/brand/logo-mark-mono.svg',
  fullLight: '/brand/logo-full-light.svg',
  fullDark: '/brand/logo-full-dark.svg',
  stackedLight: '/brand/logo-stacked-light.svg',
  favicon: '/favicon.svg',
  appleTouchIcon: '/apple-touch-icon.svg',
  watermark: '/watermark.svg',
  ogImage: '/brand/og-image.svg',
  manifest: '/site.webmanifest',
} as const;
