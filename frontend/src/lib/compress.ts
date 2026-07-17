export async function compressImage(
  file: File,
  maxDimension = 2048,
  quality = 0.85
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

export async function compressForUpload(file: File): Promise<{ full: Blob; thumb: Blob }> {
  const [full, thumb] = await Promise.all([
    compressImage(file, 2048, 0.85),
    compressImage(file, 400, 0.7),
  ]);
  return { full, thumb };
}
