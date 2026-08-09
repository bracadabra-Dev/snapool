import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, EventDetail } from '../lib/api';
import {
  buildEventThemeTokensFromAccent,
  DEFAULT_EVENT_ACCENT,
  DEFAULT_EVENT_ACCENT_INK,
} from '../lib/eventThemeTokens';

type Props = {
  token: string;
  event: EventDetail;
  allowCustomBranding: boolean;
  onEventUpdate: (event: EventDetail) => void;
};

function resolvedAccent(event: EventDetail): string {
  if (event.themeSource !== 'default' && event.themeAccent) return event.themeAccent;
  return DEFAULT_EVENT_ACCENT;
}

function resolvedAccentInk(event: EventDetail): string {
  if (event.themeAccentInk) return event.themeAccentInk;
  return DEFAULT_EVENT_ACCENT_INK;
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
  const previewStyle = useMemo(() => buildEventThemeTokensFromAccent(accent), [accent]);
  const hasFlyer = Boolean(event.coverImageUrl);
  const canPickThemeColor = !hasFlyer || allowCustomBranding;

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
          Shown once as a welcome screen. With a flyer, colors are extracted automatically and used as the gallery background.
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

      <div className="space-y-3 border-t border-[var(--line)] pt-4">
        <p className="section-label text-[var(--accent)]">Event theme</p>
        <p className="text-sm text-[var(--muted)]">
          {hasFlyer
            ? 'Main color is taken from your flyer and applied across the guest gallery.'
            : 'Pick a main color for the guest gallery — or upload a flyer to extract colors automatically.'}
        </p>

        {canPickThemeColor ? (
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">
              {hasFlyer ? 'Manual accent override' : 'Theme color'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={accent}
                onChange={(e) => void onManualAccent(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-[var(--line)] bg-transparent"
              />
              <span className="font-mono text-xs text-[var(--muted)]">{accent}</span>
              {hasFlyer && event.themeSource === 'manual' && (
                <button type="button" onClick={() => void resetToFlyerColors()} className="btn-ghost px-3 py-1.5 text-xs">
                  Reset to flyer colors
                </button>
              )}
            </div>
          </label>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="inline-block h-10 w-10 rounded-full border border-white/20"
              style={{ background: accent }}
              title={accent}
            />
            <span className="font-mono text-xs text-[var(--muted)]">{accent}</span>
            {event.themeSource === 'manual' && (
              <button type="button" onClick={() => void resetToFlyerColors()} className="btn-ghost px-3 py-1.5 text-xs">
                Reset to flyer colors
              </button>
            )}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-[var(--line)]" style={previewStyle}>
          <div className="p-3" style={{ background: 'var(--event-bg-elevated)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--event-text-muted)]">Gallery preview</p>
            <p className="font-display mt-2 text-lg font-bold text-[var(--event-text-accent)]">{event.name}</p>
            <p className="mt-1 text-sm text-[var(--event-text-muted)]">Subtitle and helper text</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-full px-4 py-2 text-sm font-bold"
                style={{ background: accent, color: accentInk }}
              >
                Primary action
              </button>
              <span
                className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  borderColor: 'var(--event-border)',
                  background: 'var(--event-surface)',
                  color: 'var(--event-text)',
                }}
              >
                Surface card
              </span>
            </div>
            <p className="mt-2 text-[10px] text-[var(--event-text-muted)]">
              Source: {event.themeSource || 'default'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-[var(--line)] pt-4">
        <p className="section-label">Custom branding</p>
        {!allowCustomBranding ? (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]/60 p-3 text-sm">
            <p className="font-semibold">Upgrade for custom logo, watermark, and accent override over a flyer</p>
            <p className="mt-1 text-[var(--muted)]">
              Free events use PixDump colors and the pixdump.net watermark on all photos. Theme color picker is available when no flyer is set.
            </p>
            <Link to="/pricing" className="btn-primary mt-3 inline-block px-3 py-2 text-xs">
              View plans
            </Link>
          </div>
        ) : (
          <>
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
