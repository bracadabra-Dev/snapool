import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { readStorageItem, storageKey } from '../lib/storageKeys';

const SPLASH_MS = 4000;

type Props = {
  slug: string;
  flyerUrl?: string | null;
  themeVersion: number;
  eventName: string;
};

function splashStorageKey(slug: string): string {
  return storageKey(`splash_${slug}`);
}

export function shouldShowSplash(slug: string, themeVersion: number, flyerUrl?: string | null): boolean {
  if (!flyerUrl) return false;
  const stored = readStorageItem(splashStorageKey(slug), splashStorageKey(slug));
  const seenVersion = stored ? Number.parseInt(stored, 10) : -1;
  return Number.isNaN(seenVersion) || seenVersion !== themeVersion;
}

export function markSplashSeen(slug: string, themeVersion: number): void {
  localStorage.setItem(splashStorageKey(slug), String(themeVersion));
}

export default function EventSplash({ slug, flyerUrl, themeVersion, eventName }: Props) {
  const [visible, setVisible] = useState(() => shouldShowSplash(slug, themeVersion, flyerUrl));

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => dismiss(), SPLASH_MS);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(timer);
    };
  }, [visible]);

  function dismiss() {
    markSplashSeen(slug, themeVersion);
    setVisible(false);
  }

  if (!visible || !flyerUrl) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex flex-col justify-end bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`Welcome to ${eventName}`}
      onClick={dismiss}
    >
      <img
        src={flyerUrl}
        alt={eventName}
        className="absolute inset-0 h-full w-full object-cover"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/20" />
      <div className="relative z-10 flex flex-col items-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-24">
        <p className="font-display text-center text-2xl font-extrabold tracking-tight text-white drop-shadow-lg">
          {eventName}
        </p>
        <button
          type="button"
          className="mt-6 rounded-full border border-white/30 bg-black/40 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
        >
          Continue
        </button>
      </div>
    </div>,
    document.body
  );
}
