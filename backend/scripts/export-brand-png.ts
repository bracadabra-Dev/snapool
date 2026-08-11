/**
 * Export PixDump SVG brand assets to PNG for marketing / print use.
 * Run: npx tsx scripts/export-brand-png.ts
 */
import { mkdir, readFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const ROOT = path.resolve(__dirname, '../../frontend/public');
const OUT = path.join(ROOT, 'brand', 'png');

type ExportJob = {
  src: string;
  outDir: string;
  variants: Array<{ name: string; width?: number; height?: number; size?: number }>;
};

const jobs: ExportJob[] = [
  {
    src: 'brand/logo-mark.svg',
    outDir: 'logo-mark',
    variants: [
      { name: 'logo-mark-1024.png', size: 1024 },
      { name: 'logo-mark-512.png', size: 512 },
      { name: 'logo-mark-256.png', size: 256 },
      { name: 'logo-mark-128.png', size: 128 },
      { name: 'logo-mark-64.png', size: 64 },
      { name: 'logo-mark-32.png', size: 32 },
    ],
  },
  {
    src: 'brand/logo-mark-mono.svg',
    outDir: 'logo-mark-mono',
    variants: [
      { name: 'logo-mark-mono-512.png', size: 512 },
      { name: 'logo-mark-mono-256.png', size: 256 },
      { name: 'logo-mark-mono-128.png', size: 128 },
    ],
  },
  {
    src: 'brand/logo-full-light.svg',
    outDir: 'logo-full-light',
    variants: [
      { name: 'logo-full-light-2400w.png', width: 2400 },
      { name: 'logo-full-light-1200w.png', width: 1200 },
      { name: 'logo-full-light-800w.png', width: 800 },
      { name: 'logo-full-light-400w.png', width: 400 },
    ],
  },
  {
    src: 'brand/logo-full-dark.svg',
    outDir: 'logo-full-dark',
    variants: [
      { name: 'logo-full-dark-2400w.png', width: 2400 },
      { name: 'logo-full-dark-1200w.png', width: 1200 },
      { name: 'logo-full-dark-800w.png', width: 800 },
      { name: 'logo-full-dark-400w.png', width: 400 },
    ],
  },
  {
    src: 'brand/logo-stacked-light.svg',
    outDir: 'logo-stacked-light',
    variants: [
      { name: 'logo-stacked-light-1024w.png', width: 1024 },
      { name: 'logo-stacked-light-512w.png', width: 512 },
      { name: 'logo-stacked-light-256w.png', width: 256 },
    ],
  },
  {
    src: 'brand/og-image.svg',
    outDir: 'og-image',
    variants: [{ name: 'og-image-1200x630.png', width: 1200, height: 630 }],
  },
  {
    src: 'favicon.svg',
    outDir: 'favicon',
    variants: [
      { name: 'favicon-128.png', size: 128 },
      { name: 'favicon-64.png', size: 64 },
      { name: 'favicon-32.png', size: 32 },
      { name: 'favicon-16.png', size: 16 },
    ],
  },
  {
    src: 'apple-touch-icon.svg',
    outDir: 'apple-touch-icon',
    variants: [
      { name: 'apple-touch-icon-512.png', size: 512 },
      { name: 'apple-touch-icon-180.png', size: 180 },
    ],
  },
  {
    src: 'watermark.svg',
    outDir: 'watermark',
    variants: [
      { name: 'watermark-1120w.png', width: 1120 },
      { name: 'watermark-560w.png', width: 560 },
      { name: 'watermark-280w.png', width: 280 },
    ],
  },
];

async function exportVariant(
  svg: Buffer,
  outPath: string,
  variant: ExportJob['variants'][number]
): Promise<void> {
  let pipeline = sharp(svg, { density: 300 });

  if (variant.size) {
    pipeline = pipeline.resize(variant.size, variant.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  } else if (variant.width && variant.height) {
    pipeline = pipeline.resize(variant.width, variant.height, { fit: 'fill' });
  } else if (variant.width) {
    pipeline = pipeline.resize({ width: variant.width });
  }

  await pipeline.png({ compressionLevel: 9 }).toFile(outPath);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  let count = 0;
  for (const job of jobs) {
    const srcPath = path.join(ROOT, job.src);
    const svg = await readFile(srcPath);
    const dir = path.join(OUT, job.outDir);
    await mkdir(dir, { recursive: true });

    for (const variant of job.variants) {
      const outPath = path.join(dir, variant.name);
      await exportVariant(svg, outPath, variant);
      console.log('wrote', path.relative(path.resolve(__dirname, '../..'), outPath));
      count += 1;
    }
  }

  console.log(`\nExported ${count} PNG files to frontend/public/brand/png/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
