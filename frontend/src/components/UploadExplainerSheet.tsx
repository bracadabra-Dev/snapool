import { useEffect } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  onChoosePhoto: () => void;
  onUseSnap: () => void;
  onClose: () => void;
};

export default function UploadExplainerSheet({ onChoosePhoto, onUseSnap, onClose }: Props) {
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
          Add a photo you already took
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Shot in Snapchat or another app? Save it to your camera roll, then choose it here.
        </p>
        <div className="mt-5 space-y-2">
          <button
            type="button"
            className="btn-primary min-h-12 w-full py-3.5 text-sm"
            onClick={onChoosePhoto}
          >
            Choose photo
          </button>
          <button
            type="button"
            className="btn-ghost min-h-12 w-full py-3.5 text-sm"
            onClick={onUseSnap}
          >
            Use SnapPool camera instead
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
