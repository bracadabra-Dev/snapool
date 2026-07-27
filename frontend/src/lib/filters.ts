export type FilterId = 'original' | 'warm' | 'cool' | 'mono' | 'vivid';

export type FilterPreset = {
  id: FilterId;
  label: string;
  /** CSS filter for live video preview */
  css: string;
};

export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'original', label: 'Original', css: 'none' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.28) saturate(1.15) brightness(1.05)' },
  { id: 'cool', label: 'Cool', css: 'hue-rotate(195deg) saturate(1.1) brightness(1.02)' },
  { id: 'mono', label: 'Mono', css: 'grayscale(1) contrast(1.05)' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(1.45) contrast(1.12)' },
];

export function getFilterCss(id: FilterId): string {
  return FILTER_PRESETS.find((f) => f.id === id)?.css ?? 'none';
}

/** Bake the selected filter into canvas pixel data so the upload matches preview. */
export function applyFilterToImageData(imageData: ImageData, filterId: FilterId): void {
  if (filterId === 'original') return;

  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (filterId === 'mono') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = g = b = clamp(gray * 1.05);
    } else if (filterId === 'warm') {
      r = clamp(r * 1.08 + 12);
      g = clamp(g * 1.02 + 4);
      b = clamp(b * 0.92);
    } else if (filterId === 'cool') {
      r = clamp(r * 0.92);
      g = clamp(g * 1.02);
      b = clamp(b * 1.12 + 10);
    } else if (filterId === 'vivid') {
      const avg = (r + g + b) / 3;
      r = clamp(avg + (r - avg) * 1.45);
      g = clamp(avg + (g - avg) * 1.45);
      b = clamp(avg + (b - avg) * 1.45);
      r = clamp((r - 128) * 1.12 + 128);
      g = clamp((g - 128) * 1.12 + 128);
      b = clamp((b - 128) * 1.12 + 128);
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function captureFilteredFrame(
  video: HTMLVideoElement,
  filterId: FilterId,
  quality = 0.92
): Promise<File> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    return Promise.reject(new Error('Camera frame not ready'));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return Promise.reject(new Error('Could not get canvas context'));

  ctx.drawImage(video, 0, 0, width, height);

  if (filterId !== 'original') {
    const imageData = ctx.getImageData(0, 0, width, height);
    applyFilterToImageData(imageData, filterId);
    ctx.putImageData(imageData, 0, 0);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Capture failed'));
          return;
        }
        resolve(new File([blob], `snap-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      quality
    );
  });
}
