import { useCallback, useEffect, useRef, useState } from 'react';
import { Photo } from '../lib/api';

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
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const ignoringVertical = useRef(false);

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
    if (!photo) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photo, onClose, go]);

  if (!photo || index < 0) return null;

  const caption =
    photo.type === 'pro'
      ? 'Pro Shot'
      : photo.contributorName
        ? `Shot by ${photo.contributorName}`
        : 'Guest shot';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Photo lightbox"
    >
      <button
        type="button"
        className="absolute right-4 top-4 z-20 rounded-full bg-white/10 px-3 py-1 text-sm text-white"
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
        <img
          key={photo.id}
          src={photo.fullUrl}
          alt=""
          className="max-h-[90vh] max-w-full select-none rounded-lg object-contain"
          draggable={false}
        />
      </div>

      <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-slate-200">
        {caption}
        {photos.length > 1 && (
          <span className="ml-2 text-slate-400">
            {index + 1} / {photos.length}
          </span>
        )}
      </div>
    </div>
  );
}
