import {
  applyWatermarkToCanvas,
  preloadWatermark,
  type WatermarkConfig,
  type WatermarkDrawOptions,
} from './watermark';

function drawOptionsFor(config: WatermarkConfig, isThumb: boolean): WatermarkDrawOptions {
  if (isThumb) {
    return {
      opacity: config.thumbOpacity ?? config.opacity,
      widthRatio: config.thumbWidthRatio ?? config.widthRatio,
      minWidth: 40,
      maxWidthRatio: 0.16,
    };
  }
  return {
    opacity: config.opacity,
    widthRatio: config.widthRatio,
    minWidth: 72,
    maxWidthRatio: 0.14,
  };
}

export async function compressImage(
  file: File,
  maxDimension = 2048,
  quality = 0.85,
  watermark?: WatermarkConfig | null
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  if (watermark) {
    try {
      const wm = await preloadWatermark(watermark);
      const isThumb = maxDimension <= 480;
      applyWatermarkToCanvas(canvas, wm, drawOptionsFor(watermark, isThumb));
    } catch {
      // Upload without watermark if asset fails to load (e.g. CORS)
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Image compression failed'));
        else resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

export async function compressForUpload(
  file: File,
  opts?: { watermark?: WatermarkConfig | null }
): Promise<{ full: Blob; thumb: Blob }> {
  const wm = opts?.watermark ?? null;
  const full = await compressImage(file, 2048, 0.85, wm);
  const thumb = await compressImage(file, 400, 0.7, wm);
  return { full, thumb };
}
