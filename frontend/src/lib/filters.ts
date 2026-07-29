export type FilterId = 'original' | 'warm' | 'vivid' | 'mono' | 'cinema';

export type FilterPreset = {
  id: FilterId;
  label: string;
  /** CSS filter for live preview + canvas recording */
  css: string;
};

/** Five event-friendly looks — photos and in-app video clips. */
export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'original', label: 'Original', css: 'none' },
  {
    id: 'warm',
    label: 'Warm',
    css: 'sepia(0.35) saturate(1.2) brightness(1.06) contrast(1.05)',
  },
  {
    id: 'vivid',
    label: 'Vivid',
    css: 'saturate(1.55) contrast(1.15) brightness(1.03)',
  },
  { id: 'mono', label: 'Mono', css: 'grayscale(1) contrast(1.12) brightness(1.02)' },
  {
    id: 'cinema',
    label: 'Cinema',
    css: 'contrast(1.18) saturate(1.15) brightness(0.96) hue-rotate(8deg)',
  },
];

export const FILTER_SWATCH: Record<FilterId, string> = {
  original: 'linear-gradient(145deg, #f8fafc, #94a3b8)',
  warm: 'linear-gradient(145deg, #fdba74, #f97316 45%, #9a3412)',
  vivid: 'linear-gradient(145deg, #f472b6, #a78bfa 40%, #22d3ee)',
  mono: 'linear-gradient(145deg, #f5f5f5, #737373 50%, #171717)',
  cinema: 'linear-gradient(145deg, #67e8f9, #0f766e 40%, #ea580c)',
};

export function getFilterCss(id: FilterId): string {
  return FILTER_PRESETS.find((f) => f.id === id)?.css ?? 'none';
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function grayscale(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function contrast(v: number, amount: number): number {
  return (v - 128) * amount + 128;
}

function saturate(r: number, g: number, b: number, amount: number): [number, number, number] {
  const avg = (r + g + b) / 3;
  return [avg + (r - avg) * amount, avg + (g - avg) * amount, avg + (b - avg) * amount];
}

/** Bake the selected filter into canvas pixel data so uploads match preview. */
export function applyFilterToImageData(imageData: ImageData, filterId: FilterId): void {
  if (filterId === 'original') return;

  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    switch (filterId) {
      case 'mono': {
        const gray = grayscale(r, g, b) * 1.05;
        r = g = b = gray;
        break;
      }
      case 'warm': {
        r = r * 1.08 + 12;
        g = g * 1.02 + 4;
        b = b * 0.92;
        break;
      }
      case 'vivid': {
        [r, g, b] = saturate(r, g, b, 1.45);
        r = contrast(r, 1.12);
        g = contrast(g, 1.12);
        b = contrast(b, 1.12);
        break;
      }
      case 'cinema': {
        const luma = grayscale(r, g, b) / 255;
        r = r * (0.95 + luma * 0.18) + 6;
        g = g * 1.02;
        b = b * (1.12 - luma * 0.15) + 4;
        [r, g, b] = saturate(r, g, b, 1.12);
        r = contrast(r, 1.16);
        g = contrast(g, 1.16);
        b = contrast(b, 1.16);
        r *= 0.97;
        g *= 0.97;
        b *= 0.97;
        break;
      }
      default:
        break;
    }

    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }
}

/** Draw one filtered frame from camera video onto a 2D canvas (used for video mode). */
export function drawFilteredVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  filterId: FilterId,
  mirror: boolean
): boolean {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return false;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.save();
  ctx.filter = getFilterCss(filterId);
  ctx.clearRect(0, 0, width, height);
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, width, height);
  ctx.restore();
  return true;
}

export function captureFilteredFrame(
  video: HTMLVideoElement,
  filterId: FilterId,
  options?: { quality?: number; mirror?: boolean }
): Promise<File> {
  const quality = options?.quality ?? 0.92;
  const mirror = options?.mirror ?? false;
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

  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, width, height);
  if (mirror) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

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
