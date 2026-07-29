/** Keep uploads light on mobile networks at live events. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function formatVideoSizeLimit(): string {
  return `${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB`;
}

export function probeVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        reject(new Error('Could not read video length'));
        return;
      }
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video file'));
    };
    video.src = url;
  });
}

export async function validateVideoFile(
  file: File,
  maxDurationSec: number
): Promise<{ durationSec: number }> {
  if (!file.type.startsWith('video/')) {
    throw new Error('Please choose a video file');
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(`Video must be ${formatVideoSizeLimit()} or smaller`);
  }
  const durationSec = await probeVideoDuration(file);
  if (durationSec > maxDurationSec + 0.35) {
    throw new Error(`Video must be ${maxDurationSec}s or shorter`);
  }
  return { durationSec: Math.round(durationSec) };
}
