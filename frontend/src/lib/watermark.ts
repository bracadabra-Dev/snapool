import type { EventWatermark } from '../lib/api';
import { BRAND_PNG, PLATFORM_WATERMARK } from './brand';

export type WatermarkConfig = {
  imageUrl: string;
  opacity?: number;
  thumbOpacity?: number;
  widthRatio?: number;
  thumbWidthRatio?: number;
  revision?: number;
};

export type WatermarkDrawOptions = {
  opacity?: number;
  widthRatio?: number;
  minWidth?: number;
  maxWidthRatio?: number;
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
  options: WatermarkDrawOptions = {}
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const padding = Math.max(10, Math.round(Math.min(canvas.width, canvas.height) * 0.018));
  const widthRatio = options.widthRatio ?? PLATFORM_WATERMARK.widthRatio;
  const maxWidthRatio = options.maxWidthRatio ?? PLATFORM_WATERMARK.maxWidthRatio;
  const minWidth = options.minWidth ?? PLATFORM_WATERMARK.minWidth;
  const targetWidth = Math.min(
    Math.round(canvas.width * maxWidthRatio),
    Math.max(minWidth, Math.round(canvas.width * widthRatio))
  );
  const scale = targetWidth / img.width;
  const targetHeight = img.height * scale;
  const x = canvas.width - targetWidth - padding;
  const y = canvas.height - targetHeight - padding;
  const opacity = options.opacity ?? PLATFORM_WATERMARK.opacity;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = Math.max(3, targetWidth * 0.08);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;
  ctx.drawImage(img, x, y, targetWidth, targetHeight);
  ctx.restore();
}

export function platformWatermarkConfig(): WatermarkConfig {
  return {
    imageUrl: defaultPlatformWatermarkUrl(),
    opacity: PLATFORM_WATERMARK.opacity,
    thumbOpacity: PLATFORM_WATERMARK.thumbOpacity,
    widthRatio: PLATFORM_WATERMARK.widthRatio,
    thumbWidthRatio: PLATFORM_WATERMARK.thumbWidthRatio,
    revision: 0,
  };
}

export function watermarkFromEvent(watermark: EventWatermark, brandingRevision: number): WatermarkConfig {
  if (watermark.mode === 'platform') {
    return { ...platformWatermarkConfig(), revision: brandingRevision };
  }
  return {
    imageUrl: watermark.imageUrl,
    opacity: 0.86,
    thumbOpacity: 0.82,
    widthRatio: 0.16,
    thumbWidthRatio: 0.18,
    revision: brandingRevision,
  };
}

export function defaultPlatformWatermarkUrl(): string {
  const override = import.meta.env.VITE_PLATFORM_WATERMARK_URL as string | undefined;
  if (override) return override;
  return BRAND_PNG.watermark560;
}
