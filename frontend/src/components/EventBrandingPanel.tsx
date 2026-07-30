import { ChangeEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, EventDetail } from '../lib/api';

type Props = {
  token: string;
  event: EventDetail;
  allowCustomBranding: boolean;
  onEventUpdate: (event: EventDetail) => void;
};

function resolvedAccent(event: EventDetail): string {
  if (event.themeSource !== 'default' && event.themeAccent) return event.themeAccent;
  return '#d6ff3c';
}

function resolvedAccentInk(event: EventDetail): string {
  if (event.themeAccentInk) return event.themeAccentInk;
  return '#0a0a0a';
}

export default function EventBrandingPanel({ token, event, allowCustomBranding, onEventUpdate }: Props) {
  const flyerRef = useRef<HTMLInputElement>(null);
  const watermarkRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(key: string, fn: () => Promise<{ event: EventDetail }>) {
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      onEventUpdate({ ...event, ...res.event, photos: event.photos });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  async function onFlyerPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await runAction('flyer', () => api.uploadEventFlyer(token, event.id, file));
  }

  async function onWatermarkPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await runAction('watermark', () => api.uploadEventWatermark(token, event.id, file));
  }

  async function onLogoPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await runAction('logo', () => api.uploadEventLogo(token, event.id, file));
  }

  async function onManualAccent(hex: string) {
    setError(null);
    try {
      const res = await api.updateEvent(token, event.id, {
        themeAccent: hex,
        themeSource: 'manual',
      });
      onEventUpdate({ ...event, ...res.event, photos: event.photos });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save accent color');
    }
  }

  async function resetToFlyerColors() {
    if (!event.coverImageUrl) return;
    setError(null);
    try {
      const res = await api.updateEvent(token, event.id, { themeSource: 'flyer' });
      onEventUpdate({ ...event, ...res.event, photos: event.photos });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset colors');
    }
  }

  const accent = resolvedAccent(event);
  const accentInk = resolvedAccentInk(event);

  return (
    <div className="surface space-y-5 p-4">
      <div>
        <h2 className="font-display text-xl font-bold">Branding</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Flyer drives the guest welcome screen and event colors. Watermarks apply to every photo upload.
        </p>
      </div>

      <div className="space-y-3">
        <p className="section-label text-[var(--accent)]">Event flyer</p>
        <p className="text-sm text-[var(--muted)]">
          Shown once as a welcome screen. Accent colors are extracted automatically.
        </p>
        {event.coverImageUrl ? (
          <div className="overflow-hidden rounded-xl border border-[var(--line)]">
            <img src={event.coverImageUrl} alt="" className="max-h-48 w-full object-contain bg-black/40" />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            No flyer yet
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy === 'flyer'}
            onClick={() => flyerRef.current?.click()}
            className="btn-primary px-4 py-2 text-sm"
          >
            {busy === 'flyer' ? 'Uploading…' : event.coverImageUrl ? 'Replace flyer' : 'Upload flyer'}
          </button>
          {event.coverImageUrl && (
            <button
              type="button"
              disabled={busy === 'flyer-del'}
              onClick={() => void runAction('flyer-del', () => api.deleteEventFlyer(token, event.id))}
              className="btn-ghost px-4 py-2 text-sm"
            >
              Remove
            </button>
          )}
        </div>
        <input ref={flyerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void onFlyerPick(e)} />
      </div>

      <div className="rounded-xl border border-[var(--line)] p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Theme preview</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span
            className="inline-block h-8 w-8 rounded-full border border-white/20"
            style={{ background: accent }}
            title={accent}
          />
          <button
            type="button"
            className="rounded-full px-4 py-2 text-sm font-bold"
            style={{ background: accent, color: accentInk }}
          >
            Sample button
          </button>
          <span className="text-xs text-[var(--muted)]">
            Source: {event.themeSource || 'default'}
          </span>
        </div>
      </div>

      <div className="space-y-3 border-t border-[var(--line)] pt-4">
        <p className="section-label">Custom branding</p>
        {!allowCustomBranding ? (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]/60 p-3 text-sm">
            <p className="font-semibold">Upgrade for custom logo, watermark, and accent override</p>
            <p className="mt-1 text-[var(--muted)]">
              Free events use PixDump colors and the pixdump.net watermark on all photos.
            </p>
            <Link to="/pricing" className="btn-primary mt-3 inline-block px-3 py-2 text-xs">
              View plans
            </Link>
          </div>
        ) : (
          <>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Manual accent override</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => void onManualAccent(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-[var(--line)] bg-transparent"
                />
                {event.coverImageUrl && event.themeSource === 'manual' && (
                  <button type="button" onClick={() => void resetToFlyerColors()} className="btn-ghost px-3 py-1.5 text-xs">
                    Reset to flyer colors
                  </button>
                )}
              </div>
            </label>

            <div>
              <p className="mb-1 text-sm text-[var(--muted)]">Event logo (header)</p>
              {event.brandingLogoUrl && (
                <img src={event.brandingLogoUrl} alt="" className="mb-2 h-8 max-w-[40%] object-contain object-left" />
              )}
              <button
                type="button"
                disabled={busy === 'logo'}
                onClick={() => logoRef.current?.click()}
                className="btn-ghost px-3 py-2 text-xs"
              >
                {busy === 'logo' ? 'Uploading…' : 'Upload logo PNG'}
              </button>
              <input ref={logoRef} type="file" accept="image/png" className="hidden" onChange={(e) => void onLogoPick(e)} />
            </div>

            <div>
              <p className="mb-1 text-sm text-[var(--muted)]">Custom photo watermark (replaces pixdump.net)</p>
              {event.watermarkImageUrl && (
                <img src={event.watermarkImageUrl} alt="" className="mb-2 h-10 max-w-[160px] object-contain object-left" />
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy === 'watermark'}
                  onClick={() => watermarkRef.current?.click()}
                  className="btn-ghost px-3 py-2 text-xs"
                >
                  {busy === 'watermark' ? 'Uploading…' : 'Upload watermark PNG'}
                </button>
                {event.watermarkImageUrl && (
                  <button
                    type="button"
                    disabled={busy === 'wm-del'}
                    onClick={() => void runAction('wm-del', () => api.deleteEventWatermark(token, event.id))}
                    className="btn-ghost px-3 py-2 text-xs"
                  >
                    Remove custom watermark
                  </button>
                )}
              </div>
              <input ref={watermarkRef} type="file" accept="image/png" className="hidden" onChange={(e) => void onWatermarkPick(e)} />
            </div>
          </>
        )}
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
