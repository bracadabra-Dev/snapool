import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatVideoSizeLimit } from '../features/video/validateVideo';
import { PLATFORM_NAME } from '../lib/brand';

type Props = {
  videoAvailable?: boolean;
  maxDurationSec?: number;
  onChooseMedia: () => void;
  onUseSnap: () => void;
  onClose: () => void;
};

export default function UploadExplainerSheet({
  videoAvailable = false,
  maxDurationSec = 30,
  onChooseMedia,
  onUseSnap,
  onClose,
}: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-explain-title"
        className="relative z-10 w-full max-w-lg rounded-t-[1.75rem] border border-white/10 bg-[var(--ink-elevated)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[1.75rem] sm:m-4"
      >
        <p className="section-label mb-2 text-[var(--accent)]">Upload</p>
        <h2 id="upload-explain-title" className="font-display text-2xl font-extrabold tracking-tight">
          Add media from your camera roll
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {videoAvailable
            ? `Choose a photo or short clip (max ${maxDurationSec}s, ${formatVideoSizeLimit()}). Photos are compressed on your phone before upload; videos go straight to Cloudinary.`
            : 'Shot in another app? Save it to your camera roll, then choose it here. Photos are compressed on your phone before upload.'}
        </p>
        <div className="mt-5 space-y-2">
          <button
            type="button"
            className="btn-primary min-h-12 w-full py-3.5 text-sm"
            onClick={onChooseMedia}
          >
            {videoAvailable ? 'Choose photo or video' : 'Choose photo'}
          </button>
          <button
            type="button"
            className="btn-ghost min-h-12 w-full py-3.5 text-sm"
            onClick={onUseSnap}
          >
            Use {PLATFORM_NAME} camera instead
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
