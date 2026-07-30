import sharp from 'sharp';
import { computeAccentInk } from './eventBranding';

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

type ColorBucket = {
  rSum: number;
  gSum: number;
  bSum: number;
  weight: number;
};

type Candidate = {
  r: number;
  g: number;
  b: number;
  score: number;
};

const SAMPLE_MAX = 384;
const QUANT_BITS = 4; // 16 levels per channel → reduces JPEG noise
const PAGE_BG_LUMINANCE = 0.02;

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
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

function quantKey(r: number, g: number, b: number): string {
  const shift = 8 - QUANT_BITS;
  return `${r >> shift},${g >> shift},${b >> shift}`;
}

function pixelWeight(x: number, y: number, width: number, height: number): number {
  const nx = (x + 0.5) / width - 0.5;
  const ny = (y + 0.5) / height - 0.5;
  const dist = Math.sqrt(nx * nx + ny * ny);
  const maxDist = Math.sqrt(0.5 * 0.5 + 0.5 * 0.5);
  // Center-weighted: edges (often borders/letterboxing) count less.
  return 1 + 1.75 * (1 - Math.min(1, dist / maxDist));
}

function scoreCandidate(
  r: number,
  g: number,
  b: number,
  weight: number,
  totalWeight: number,
  minSat: number,
  minLight: number,
  maxLight: number
): number {
  const { s, l } = rgbToHsl(r, g, b);
  if (s < minSat || l < minLight || l > maxLight) return 0;

  const freqScore = weight / totalWeight;
  const satScore = Math.min(1, s / 0.75);
  const lumScore = 1 - Math.min(1, Math.abs(l - 0.52) / 0.48);
  const accentL = relativeLuminance(r, g, b);
  const contrastScore = Math.min(1, Math.max(0, (contrastRatio(accentL, PAGE_BG_LUMINANCE) - 2.5) / 8));

  return freqScore * 0.5 + satScore * 0.28 + lumScore * 0.12 + contrastScore * 0.1;
}

function enhanceAccentForUi(r: number, g: number, b: number): Rgb {
  const { h, s, l } = rgbToHsl(r, g, b);
  if (s < 0.08) return { r, g, b };
  const targetS = s < 0.38 ? Math.min(1, s * 1.08) : s;
  return hslToRgb(h, targetS, Math.min(0.68, Math.max(0.32, l)));
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

function buildBuckets(
  data: Buffer,
  channels: number,
  width: number,
  height: number
): { buckets: Map<string, ColorBucket>; totalWeight: number } {
  const buckets = new Map<string, ColorBucket>();
  let totalWeight = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const w = pixelWeight(x, y, width, height);
      totalWeight += w;

      const key = quantKey(r, g, b);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.rSum += r * w;
        bucket.gSum += g * w;
        bucket.bSum += b * w;
        bucket.weight += w;
      } else {
        buckets.set(key, { rSum: r * w, gSum: g * w, bSum: b * w, weight: w });
      }
    }
  }

  return { buckets, totalWeight };
}

function candidatesFromBuckets(
  buckets: Map<string, ColorBucket>,
  totalWeight: number,
  minSat: number,
  minLight: number,
  maxLight: number
): Candidate[] {
  const candidates: Candidate[] = [];

  for (const bucket of buckets.values()) {
    if (bucket.weight <= 0) continue;
    const r = bucket.rSum / bucket.weight;
    const g = bucket.gSum / bucket.weight;
    const b = bucket.bSum / bucket.weight;
    const score = scoreCandidate(r, g, b, bucket.weight, totalWeight, minSat, minLight, maxLight);
    if (score > 0) candidates.push({ r, g, b, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function mergeSimilarCandidates(candidates: Candidate[]): Candidate[] {
  if (candidates.length <= 1) return candidates;

  const merged: Candidate[] = [];
  const used = new Set<number>();

  for (let i = 0; i < candidates.length; i++) {
    if (used.has(i)) continue;
    const base = candidates[i]!;
    let rSum = base.r * base.score;
    let gSum = base.g * base.score;
    let bSum = base.b * base.score;
    let scoreSum = base.score;

    for (let j = i + 1; j < candidates.length; j++) {
      if (used.has(j)) continue;
      const other = candidates[j]!;
      const h1 = rgbToHsl(base.r, base.g, base.b).h;
      const h2 = rgbToHsl(other.r, other.g, other.b).h;
      if (hueDistance(h1, h2) > 0.06) continue;
      if (other.score < base.score * 0.55) continue;

      used.add(j);
      rSum += other.r * other.score;
      gSum += other.g * other.score;
      bSum += other.b * other.score;
      scoreSum += other.score;
    }

    merged.push({
      r: rSum / scoreSum,
      g: gSum / scoreSum,
      b: bSum / scoreSum,
      score: scoreSum,
    });
  }

  merged.sort((a, b) => b.score - a.score);
  return merged;
}

function pickAccent(candidates: Candidate[]): Rgb | null {
  for (const c of candidates) {
    const enhanced = enhanceAccentForUi(c.r, c.g, c.b);
    const accentL = relativeLuminance(enhanced.r, enhanced.g, enhanced.b);
    if (contrastRatio(accentL, PAGE_BG_LUMINANCE) < 2.2) continue;
    if (Math.abs(accentL - PAGE_BG_LUMINANCE) < 0.06) continue;
    return enhanced;
  }
  return null;
}

export async function extractThemeFromImage(buffer: Buffer): Promise<{
  accent: string;
  accentInk: string;
} | null> {
  try {
    const { data, info } = await sharp(buffer)
      .rotate()
      .resize(SAMPLE_MAX, SAMPLE_MAX, { fit: 'inside', withoutEnlargement: false })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { buckets, totalWeight } = buildBuckets(data, info.channels, info.width, info.height);
    if (totalWeight <= 0 || buckets.size === 0) return null;

    const tiers = [
      { minSat: 0.16, minLight: 0.2, maxLight: 0.8 },
      { minSat: 0.11, minLight: 0.16, maxLight: 0.86 },
      { minSat: 0.07, minLight: 0.12, maxLight: 0.9 },
    ] as const;

    for (const tier of tiers) {
      const raw = candidatesFromBuckets(
        buckets,
        totalWeight,
        tier.minSat,
        tier.minLight,
        tier.maxLight
      );
      if (!raw.length) continue;

      const merged = mergeSimilarCandidates(raw.slice(0, 24));
      const picked = pickAccent(merged);
      if (!picked) continue;

      const accent = rgbToHex(picked.r, picked.g, picked.b);
      return { accent, accentInk: computeAccentInk(accent) };
    }

    return null;
  } catch {
    return null;
  }
}
