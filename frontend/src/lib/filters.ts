export type FilterId =
  | 'original'
  | 'warm'
  | 'cool'
  | 'mono'
  | 'vivid'
  | 'noir'
  | 'fade'
  | 'golden'
  | 'rose'
  | 'cinema'
  | 'sharp'
  | 'mist'
  | 'ember'
  | 'arctic';

export type FilterPreset = {
  id: FilterId;
  label: string;
  /** CSS filter for live video preview */
  css: string;
};

export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'original', label: 'Original', css: 'none' },
  {
    id: 'warm',
    label: 'Warm',
    css: 'sepia(0.35) saturate(1.2) brightness(1.06) contrast(1.05)',
  },
  {
    id: 'cool',
    label: 'Cool',
    css: 'saturate(1.05) brightness(1.03) contrast(1.05) hue-rotate(190deg)',
  },
  { id: 'mono', label: 'Mono', css: 'grayscale(1) contrast(1.12) brightness(1.02)' },
  {
    id: 'vivid',
    label: 'Vivid',
    css: 'saturate(1.55) contrast(1.15) brightness(1.03)',
  },
  {
    id: 'noir',
    label: 'Noir',
    css: 'grayscale(1) contrast(1.35) brightness(0.92)',
  },
  {
    id: 'fade',
    label: 'Fade',
    css: 'saturate(0.75) contrast(0.88) brightness(1.08)',
  },
  {
    id: 'golden',
    label: 'Golden',
    css: 'sepia(0.45) saturate(1.25) brightness(1.08) contrast(1.08)',
  },
  {
    id: 'rose',
    label: 'Rose',
    css: 'hue-rotate(320deg) saturate(1.2) brightness(1.05) contrast(1.05)',
  },
  {
    id: 'cinema',
    label: 'Cinema',
    css: 'contrast(1.18) saturate(1.15) brightness(0.96) hue-rotate(8deg)',
  },
  {
    id: 'sharp',
    label: 'Sharp',
    css: 'contrast(1.28) saturate(1.1) brightness(1.02)',
  },
  {
    id: 'mist',
    label: 'Mist',
    css: 'brightness(1.12) contrast(0.82) saturate(0.85)',
  },
  {
    id: 'ember',
    label: 'Ember',
    css: 'sepia(0.55) saturate(1.35) contrast(1.15) brightness(0.95)',
  },
  {
    id: 'arctic',
    label: 'Arctic',
    css: 'saturate(0.7) brightness(1.08) contrast(1.1) hue-rotate(200deg)',
  },
];

export const FILTER_SWATCH: Record<FilterId, string> = {
  original: 'linear-gradient(145deg, #f8fafc, #94a3b8)',
  warm: 'linear-gradient(145deg, #fdba74, #f97316 45%, #9a3412)',
  cool: 'linear-gradient(145deg, #bae6fd, #38bdf8 45%, #0369a1)',
  mono: 'linear-gradient(145deg, #f5f5f5, #737373 50%, #171717)',
  vivid: 'linear-gradient(145deg, #f472b6, #a78bfa 40%, #22d3ee)',
  noir: 'linear-gradient(145deg, #e5e5e5, #404040 40%, #0a0a0a)',
  fade: 'linear-gradient(145deg, #f5f0e8, #d4c4b0 50%, #a89080)',
  golden: 'linear-gradient(145deg, #fde68a, #f59e0b 45%, #b45309)',
  rose: 'linear-gradient(145deg, #fecdd3, #fb7185 45%, #be123c)',
  cinema: 'linear-gradient(145deg, #67e8f9, #0f766e 40%, #ea580c)',
  sharp: 'linear-gradient(145deg, #ffffff, #cbd5e1 50%, #334155)',
  mist: 'linear-gradient(145deg, #f8fafc, #e2e8f0 50%, #94a3b8)',
  ember: 'linear-gradient(145deg, #fecaca, #dc2626 40%, #431407)',
  arctic: 'linear-gradient(145deg, #e0f2fe, #7dd3fc 40%, #0c4a6e)',
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

/** Bake the selected filter into canvas pixel data so the upload matches preview. */
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
      case 'noir': {
        const gray = grayscale(r, g, b);
        r = g = b = contrast(gray * 0.95, 1.35);
        break;
      }
      case 'warm': {
        r = r * 1.08 + 12;
        g = g * 1.02 + 4;
        b = b * 0.92;
        break;
      }
      case 'cool': {
        r = r * 0.92;
        g = g * 1.02;
        b = b * 1.12 + 10;
        break;
      }
      case 'vivid': {
        [r, g, b] = saturate(r, g, b, 1.45);
        r = contrast(r, 1.12);
        g = contrast(g, 1.12);
        b = contrast(b, 1.12);
        break;
      }
      case 'fade': {
        [r, g, b] = saturate(r, g, b, 0.75);
        r = contrast(r, 0.88) + 10;
        g = contrast(g, 0.88) + 8;
        b = contrast(b, 0.88) + 6;
        break;
      }
      case 'golden': {
        r = r * 1.12 + 18;
        g = g * 1.06 + 10;
        b = b * 0.85;
        r = contrast(r, 1.08);
        g = contrast(g, 1.08);
        b = contrast(b, 1.05);
        break;
      }
      case 'rose': {
        r = r * 1.1 + 14;
        g = g * 0.95 + 2;
        b = b * 1.05 + 8;
        [r, g, b] = saturate(r, g, b, 1.15);
        break;
      }
      case 'cinema': {
        // Teal shadows / warm highlights lean
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
      case 'sharp': {
        [r, g, b] = saturate(r, g, b, 1.1);
        r = contrast(r, 1.28);
        g = contrast(g, 1.28);
        b = contrast(b, 1.28);
        break;
      }
      case 'mist': {
        [r, g, b] = saturate(r, g, b, 0.85);
        r = contrast(r, 0.82) + 18;
        g = contrast(g, 0.82) + 18;
        b = contrast(b, 0.82) + 20;
        break;
      }
      case 'ember': {
        r = r * 1.15 + 20;
        g = g * 0.9;
        b = b * 0.72;
        [r, g, b] = saturate(r, g, b, 1.25);
        r = contrast(r, 1.15);
        g = contrast(g, 1.12);
        b = contrast(b, 1.1);
        r *= 0.96;
        g *= 0.96;
        b *= 0.96;
        break;
      }
      case 'arctic': {
        r = r * 0.88;
        g = g * 1.02 + 4;
        b = b * 1.15 + 16;
        [r, g, b] = saturate(r, g, b, 0.7);
        r = contrast(r, 1.1) + 8;
        g = contrast(g, 1.1) + 8;
        b = contrast(b, 1.1) + 10;
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
