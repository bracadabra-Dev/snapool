import { useEffect } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  message?: string;
  onUploadInstead: () => void;
  onClose: () => void;
};

export default function PermissionSheet({
  message,
  onUploadInstead,
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
        aria-labelledby="permission-title"
        className="relative z-10 w-full max-w-lg rounded-t-[1.75rem] border border-white/10 bg-[var(--ink-elevated)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[1.75rem] sm:m-4"
      >
        <p className="section-label mb-2 text-[var(--danger)]">Camera</p>
        <h2 id="permission-title" className="font-display text-2xl font-extrabold tracking-tight">
          Camera blocked
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {message ||
            'SnapPool can’t access your camera. Allow camera access in your browser site settings, or upload a photo from your gallery instead.'}
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>Open site settings for this page</li>
          <li>Set Camera to Allow</li>
          <li>Return here and tap Snap again</li>
        </ul>
        <div className="mt-5 space-y-2">
          <button
            type="button"
            className="btn-primary min-h-12 w-full py-3.5 text-sm"
            onClick={onUploadInstead}
          >
            Upload instead
          </button>
          <button
            type="button"
            className="btn-ghost min-h-12 w-full py-3.5 text-sm"
            onClick={onClose}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
