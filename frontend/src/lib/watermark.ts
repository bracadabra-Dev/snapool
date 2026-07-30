import type { EventWatermark } from '../lib/api';

export type WatermarkConfig = {
  imageUrl: string;
  opacity?: number;
  revision?: number;
};

const cache = new Map<string, Promise<HTMLImageElement>>();

function cacheKey(url: string, revision?: number): string {
  return `${url}::${revision ?? 0}`;
}

export function preloadWatermark(config: WatermarkConfig): Promise<HTMLImageElement> {
  const key = cacheKey(config.imageUrl, config.revision);
  let pending = cache.get(key);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Watermark failed to load'));
      img.src = config.imageUrl;
    });
    cache.set(key, pending);
  }
  return pending;
}

export function applyWatermarkToCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  opacity = 0.72
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const padding = Math.max(12, Math.round(canvas.width * 0.02));
  const targetWidth = Math.max(48, Math.round(canvas.width * 0.08));
  const scale = targetWidth / img.width;
  const targetHeight = img.height * scale;
  const x = canvas.width - targetWidth - padding;
  const y = canvas.height - targetHeight - padding;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(img, x, y, targetWidth, targetHeight);
  ctx.restore();
}

export function watermarkFromEvent(watermark: EventWatermark, brandingRevision: number): WatermarkConfig {
  return {
    imageUrl: watermark.imageUrl,
    revision: brandingRevision,
  };
}

export function defaultPlatformWatermarkUrl(): string {
  const override = import.meta.env.VITE_PLATFORM_WATERMARK_URL as string | undefined;
  if (override) return override;
  return '/watermark.svg';
}
