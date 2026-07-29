import { Photo } from './api';
import { PLATFORM_NAME } from './brand';

function extensionFromUrl(url: string, fallback: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    return match?.[1]?.toLowerCase() || fallback;
  } catch {
    return fallback;
  }
}

export function mediaFilename(photo: Photo): string {
  const ext =
    photo.mediaType === 'video'
      ? extensionFromUrl(photo.fullUrl, 'mp4')
      : extensionFromUrl(photo.fullUrl, 'jpg');
  return `pixdump-${photo.id.slice(0, 8)}.${ext}`;
}

export async function downloadMedia(photo: Photo): Promise<void> {
  const filename = mediaFilename(photo);
  try {
    const res = await fetch(photo.fullUrl);
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    const anchor = document.createElement('a');
    anchor.href = photo.fullUrl;
    anchor.download = filename;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
}

export async function shareMedia(photo: Photo): Promise<'shared' | 'copied'> {
  const title = photo.mediaType === 'video' ? `${PLATFORM_NAME} clip` : `${PLATFORM_NAME} photo`;
  const text =
    photo.contributorName != null
      ? `From ${photo.contributorName} on ${PLATFORM_NAME}`
      : `From ${PLATFORM_NAME}`;

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: photo.fullUrl });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(photo.fullUrl);
    return 'copied';
  }

  throw new Error('Sharing is not supported on this device');
}
