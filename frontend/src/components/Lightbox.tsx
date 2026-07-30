import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Photo } from '../lib/api';
import { downloadMedia, shareMedia } from '../lib/mediaActions';
import { DownloadIcon, ShareIcon } from './icons';

type Props = {
  photos: Photo[];
  photo: Photo | null;
  onClose: () => void;
  onSelect: (photo: Photo | null) => void;
};

const SWIPE_THRESHOLD = 50;

export default function Lightbox({ photos, photo, onClose, onSelect }: Props) {
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const ignoringVertical = useRef(false);
  const actionTimer = useRef<number | null>(null);

  const index = photo ? photos.findIndex((p) => p.id === photo.id) : -1;
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < photos.length - 1;

  const go = useCallback(
    (delta: number) => {
      if (animating || index < 0) return;
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= photos.length) return;

      setAnimating(true);
      setDragX(delta > 0 ? -48 : 48);

      window.setTimeout(() => {
        onSelect(photos[nextIndex]);
        setDragX(delta > 0 ? 48 : -48);
        requestAnimationFrame(() => {
          setDragX(0);
          window.setTimeout(() => setAnimating(false), 160);
        });
      }, 140);
    },
    [animating, index, onSelect, photos]
  );

  useEffect(() => {
    if (!photo || index < 0) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    }

    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [photo, index, onClose, go]);

  useEffect(() => {
    setDragX(0);
    setAnimating(false);
    setActionMsg(null);
  }, [photo?.id]);

  useEffect(() => {
    return () => {
      if (actionTimer.current != null) window.clearTimeout(actionTimer.current);
    };
  }, []);

  function flashAction(message: string) {
    setActionMsg(message);
    if (actionTimer.current != null) window.clearTimeout(actionTimer.current);
    actionTimer.current = window.setTimeout(() => setActionMsg(null), 2200);
  }

  async function handleShare(e: MouseEvent) {
    e.stopPropagation();
    if (!photo) return;
    try {
      const result = await shareMedia(photo);
      flashAction(result === 'shared' ? 'Shared' : 'Link copied');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      flashAction(err instanceof Error ? err.message : 'Could not share');
    }
  }

  async function handleDownload(e: MouseEvent) {
    e.stopPropagation();
    if (!photo || downloading) return;
    setDownloading(true);
    try {
      await downloadMedia(photo);
      flashAction('Download started');
    } catch {
      flashAction('Download failed');
    } finally {
      setDownloading(false);
    }
  }

  if (!photo || index < 0) return null;

  const caption =
    photo.mediaType === 'video'
      ? 'Video clip'
      : photo.type === 'pro'
        ? 'Pro Shot'
        : photo.contributorName
          ? `Shot by ${photo.contributorName}`
          : 'Guest shot';

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Photo lightbox"
    >
      <button
        type="button"
        className="absolute right-4 top-4 z-20 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white"
        onClick={onClose}
      >
        Close
      </button>

      {hasPrev && (
        <button
          type="button"
          aria-label="Previous photo"
          className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white backdrop-blur-sm transition hover:bg-white/25 sm:left-6"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
        >
          ‹
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          aria-label="Next photo"
          className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white backdrop-blur-sm transition hover:bg-white/25 sm:right-6"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
        >
          ›
        </button>
      )}

      <div
        className="relative flex max-h-[90vh] max-w-full touch-pan-y items-center justify-center overflow-hidden"
        style={{
          transform: `translateX(${dragX}px)`,
          opacity: animating && Math.abs(dragX) > 20 ? 0.5 : 1,
          transition:
            animating || dragX === 0 ? 'transform 160ms ease, opacity 160ms ease' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          const t = e.touches[0];
          touchStartX.current = t.clientX;
          touchStartY.current = t.clientY;
          ignoringVertical.current = false;
          setAnimating(false);
        }}
        onTouchMove={(e) => {
          if (touchStartX.current == null || touchStartY.current == null) return;
          const t = e.touches[0];
          const dx = t.clientX - touchStartX.current;
          const dy = t.clientY - touchStartY.current;
          if (!ignoringVertical.current && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
            ignoringVertical.current = true;
            setDragX(0);
            return;
          }
          if (ignoringVertical.current) return;
          if ((!hasPrev && dx > 0) || (!hasNext && dx < 0)) {
            setDragX(dx * 0.35);
            return;
          }
          setDragX(dx);
        }}
        onTouchEnd={() => {
          if (ignoringVertical.current) {
            touchStartX.current = null;
            touchStartY.current = null;
            setDragX(0);
            return;
          }
          if (dragX <= -SWIPE_THRESHOLD && hasNext) {
            go(1);
          } else if (dragX >= SWIPE_THRESHOLD && hasPrev) {
            go(-1);
          } else {
            setAnimating(true);
            setDragX(0);
            window.setTimeout(() => setAnimating(false), 160);
          }
          touchStartX.current = null;
          touchStartY.current = null;
        }}
      >
        {photo.mediaType === 'video' ? (
          <video
            key={photo.id}
            src={photo.fullUrl}
            poster={photo.thumbUrl}
            controls
            playsInline
            preload="auto"
            className="max-h-[90vh] max-w-full select-none rounded-lg object-contain"
          />
        ) : (
          <img
            key={photo.id}
            src={photo.fullUrl}
            alt=""
            className="max-h-[90vh] max-w-full select-none rounded-lg object-contain"
            draggable={false}
          />
        )}
      </div>

      <div
        className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {actionMsg && (
          <p className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent-ink)]">
            {actionMsg}
          </p>
        )}
        <div className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 backdrop-blur-sm">
          <p className="max-w-[42vw] truncate text-xs font-medium tracking-wide text-white/90 sm:max-w-none">
            {caption}
            {photos.length > 1 && (
              <span className="ml-2 tabular-nums text-white/50">
                {index + 1}/{photos.length}
              </span>
            )}
          </p>
          <span className="h-4 w-px bg-white/20" aria-hidden="true" />
          <button
            type="button"
            aria-label="Share"
            onClick={(e) => void handleShare(e)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/15"
          >
            <ShareIcon size={17} />
          </button>
          <button
            type="button"
            aria-label="Download"
            disabled={downloading}
            onClick={(e) => void handleDownload(e)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/15 disabled:opacity-50"
          >
            <DownloadIcon size={17} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
