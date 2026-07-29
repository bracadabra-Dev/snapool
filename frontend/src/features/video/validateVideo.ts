/** Keep uploads light on mobile networks at live events. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const recordedDurations = new WeakMap<File, number>();

export function formatVideoSizeLimit(): string {
  return `${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB`;
}

export function tagRecordedVideoDuration(file: File, durationSec: number): void {
  if (durationSec > 0) recordedDurations.set(file, Math.round(durationSec));
}

export function getRecordedVideoDuration(file: File): number | undefined {
  return recordedDurations.get(file);
}

export function probeVideoDuration(file: File, fallbackSec?: number): Promise<number> {
  const tagged = getRecordedVideoDuration(file);
  if (tagged != null && tagged > 0) return Promise.resolve(tagged);
  if (fallbackSec != null && fallbackSec > 0) return Promise.resolve(fallbackSec);

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;

    function finish(value: number | null, err?: Error) {
      if (settled) return;
      settled = true;
      window.clearTimeout(seekTimer);
      window.clearTimeout(hardTimer);
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
      if (value != null && value > 0) resolve(value);
      else reject(err ?? new Error('Could not read video length'));
    }

    const seekTimer = window.setTimeout(() => {
      try {
        video.currentTime = 1e7;
      } catch {
        finish(null, new Error('Could not read video length'));
      }
    }, 1200);

    const hardTimer = window.setTimeout(() => {
      const retry = getRecordedVideoDuration(file);
      if (retry != null && retry > 0) finish(retry);
      else finish(null, new Error('Could not read video length'));
    }, 9000);

    video.preload = 'auto';
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        finish(video.duration);
      }
    };
    video.ontimeupdate = () => {
      if (video.currentTime > 0 && Number.isFinite(video.duration) && video.duration > 0) {
        finish(video.duration);
      }
    };
    video.onerror = () => {
      const retry = getRecordedVideoDuration(file);
      if (retry != null && retry > 0) finish(retry);
      else finish(null, new Error('Could not read video file'));
    };
    video.src = url;
  });
}

export async function validateVideoFile(
  file: File,
  maxDurationSec: number,
  knownDurationSec?: number
): Promise<{ durationSec: number }> {
  if (!file.type.startsWith('video/')) {
    throw new Error('Please choose a video file');
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(`Video must be ${formatVideoSizeLimit()} or smaller`);
  }

  const tagged = knownDurationSec ?? getRecordedVideoDuration(file);
  let durationSec: number;
  try {
    durationSec = await probeVideoDuration(file, tagged);
  } catch (err) {
    if (tagged != null && tagged > 0) durationSec = tagged;
    else throw err;
  }

  if (durationSec > maxDurationSec + 0.35) {
    throw new Error(`Video must be ${maxDurationSec}s or shorter`);
  }
  return { durationSec: Math.round(durationSec) };
}

export function canPlayVideoMime(mime: string): boolean {
  if (!mime) return false;
  const video = document.createElement('video');
  return video.canPlayType(mime) !== '';
}
