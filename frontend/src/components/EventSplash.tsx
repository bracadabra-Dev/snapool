import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { readStorageItem, storageKey } from '../lib/storageKeys';

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
    const timer = window.setTimeout(() => dismiss(), 2500);
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
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/95 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Welcome to ${eventName}`}
      onClick={dismiss}
    >
      <img
        src={flyerUrl}
        alt={eventName}
        className="max-h-[min(72vh,720px)] max-w-full rounded-2xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <p className="mt-4 text-center text-sm text-white/70">{eventName}</p>
      <button
        type="button"
        className="mt-5 rounded-full border border-white/25 px-5 py-2.5 text-sm font-semibold text-white"
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
      >
        Continue
      </button>
    </div>,
    document.body
  );
}
