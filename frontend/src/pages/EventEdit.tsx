import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, EventDetail, Photo } from '../lib/api';
import { useAuth } from '../lib/auth';
import GalleryGrid from '../components/GalleryGrid';
import Lightbox from '../components/Lightbox';
import ProShotUpload from '../components/ProShotUpload';
import { useEventLiveRoom } from '../hooks/useEventLiveRoom';
import { useVideoCapabilities } from '../features/video/useVideoCapabilities';
import { upsertPhotos } from '../lib/realtime';

type Tab = 'all' | 'pro' | 'contributor';

export default function EventEdit() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const { video } = useVideoCapabilities(event?.slug);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [selected, setSelected] = useState<Photo | null>(null);

  async function load() {
    if (!token || !id) return;
    try {
      const res = await api.getEvent(token, id);
      setEvent(res.event);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event');
    }
  }

  useEffect(() => {
    void load();
  }, [token, id]);

  const onPhotoCreated = useCallback((photo: Photo) => {
    setEvent((prev) => {
      if (!prev) return prev;
      return { ...prev, photos: upsertPhotos(prev.photos || [], [photo]) };
    });
  }, []);

  const onPhotoDeleted = useCallback((photoId: string) => {
    setEvent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        photos: (prev.photos || []).filter((p) => p.id !== photoId),
      };
    });
  }, []);

  useEventLiveRoom({
    slug: event?.slug,
    enabled: Boolean(event?.slug),
    onPhotoCreated,
    onPhotoDeleted,
    onReconnect: () => {
      void load();
    },
  });

  const photos = useMemo(() => {
    const list = event?.photos || [];
    if (tab === 'pro') return list.filter((p) => p.type === 'pro');
    if (tab === 'contributor') return list.filter((p) => p.type === 'contributor');
    return list;
  }, [event, tab]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!token || !event) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.updateEvent(token, event.id, {
        name: event.name,
        visibility: event.visibility,
        galleryLive: event.galleryLive,
        moderationMode: event.moderationMode,
        maxPhotosPerContributor: event.maxPhotosPerContributor,
        requireContributorName: event.requireContributorName,
        thankYouMessage: event.thankYouMessage,
        retentionDays: event.retentionDays,
        brandingLogoUrl: event.brandingLogoUrl,
        coverImageUrl: event.coverImageUrl,
        videoEnabled: event.videoEnabled,
      });
      setEvent((prev) => (prev ? { ...prev, ...res.event, photos: prev.photos } : res.event));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onProUpload(full: Blob, thumb: Blob) {
    if (!token || !event) return;
    const res = await api.proUpload(token, event.id, full, thumb);
    onPhotoCreated(res.photo);
  }

  async function purchaseVideoAddon() {
    if (!token || !event) return;
    try {
      const res = await api.checkout(token, { addOnId: 'video_event_pass', eventId: event.id });
      if (res.devComplete) {
        await api.devCompletePayment(token, res.reference);
        await load();
      } else if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    }
  }

  async function onDelete(photoId: string) {
    if (!token || !event) return;
    if (!confirm('Delete this photo?')) return;
    try {
      await api.deletePhoto(token, event.id, photoId);
      onPhotoDeleted(photoId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  if (!event) {
    return (
      <div className="p-8 text-sm text-[var(--muted)]">{error || 'Loading event…'}</div>
    );
  }

  const qrSrc = event.qrCodeUrl || event.qrDataUrl || null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <Link to="/dashboard" className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--accent)]">
        ← Events
      </Link>
      <h1 className="font-display mt-3 text-4xl font-extrabold tracking-tight">{event.name}</h1>

      <div className="surface mt-6 grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <p className="section-label mb-2">Share</p>
          <p className="break-all font-mono text-xs text-[var(--accent)] sm:text-sm">{event.publicUrl}</p>
          <button
            type="button"
            className="btn-ghost mt-3 px-3 py-1.5 text-xs"
            onClick={async () => {
              await navigator.clipboard.writeText(event.publicUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        {qrSrc && (
          <div className="justify-self-start bg-white p-2 md:justify-self-end">
            <img src={qrSrc} alt="Event QR code" className="h-32 w-32" />
          </div>
        )}
      </div>

      <form onSubmit={onSave} className="surface mt-5 space-y-4 p-4">
        <h2 className="font-display text-xl font-bold">Settings</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Name</span>
            <input
              value={event.name}
              onChange={(e) => setEvent({ ...event, name: e.target.value })}
              className="field"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Visibility</span>
            <select
              value={event.visibility}
              onChange={(e) => setEvent({ ...event, visibility: e.target.value })}
              className="field"
            >
              <option value="unlisted">Unlisted (link only)</option>
              <option value="public">Public</option>
              <option value="password">Password</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Max photos / guest</span>
            <input
              type="number"
              min={1}
              max={200}
              value={event.maxPhotosPerContributor}
              onChange={(e) =>
                setEvent({ ...event, maxPhotosPerContributor: Number(e.target.value) })
              }
              className="field"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Retention days</span>
            <input
              type="number"
              min={1}
              max={365}
              value={event.retentionDays}
              onChange={(e) => setEvent({ ...event, retentionDays: Number(e.target.value) })}
              className="field"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-[var(--muted)]">Thank-you message</span>
            <textarea
              value={event.thankYouMessage || ''}
              onChange={(e) => setEvent({ ...event, thankYouMessage: e.target.value })}
              rows={2}
              className="field"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={event.galleryLive}
              onChange={(e) => setEvent({ ...event, galleryLive: e.target.checked })}
            />
            Gallery live
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={event.requireContributorName}
              onChange={(e) => setEvent({ ...event, requireContributorName: e.target.checked })}
            />
            Require guest name
          </label>
          <label className="flex items-center gap-2">
            Moderation
            <select
              value={event.moderationMode}
              onChange={(e) => setEvent({ ...event, moderationMode: e.target.value })}
              className="field !w-auto !py-1"
            >
              <option value="auto">Auto-publish</option>
              <option value="manual">Manual approve</option>
            </select>
          </label>
          {(video?.state === 'available' || video?.state === 'disabled_by_owner') && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={event.videoEnabled ?? false}
                onChange={(e) => setEvent({ ...event, videoEnabled: e.target.checked })}
              />
              Allow guest videos
            </label>
          )}
        </div>
        {(user?.plan === 'free' || video?.state === 'plan_required') && (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]/60 p-3 text-sm">
            <p className="font-semibold">Video is a paid feature</p>
            <p className="mt-1 text-[var(--muted)]">
              Upgrade to Pro or add the Event Video Pack to unlock guest clips.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/pricing" className="btn-primary px-3 py-2 text-xs">
                View plans
              </Link>
              <button type="button" onClick={() => void purchaseVideoAddon()} className="btn-ghost px-3 py-2 text-xs">
                Buy video add-on
              </button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary px-4 py-2.5 text-sm">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>

      <div className="mt-5 space-y-3">
        <ProShotUpload
          onPhotoUpload={onProUpload}
          video={video}
          getVideoSignature={() => api.ownerVideoSignature(token!, event!.id)}
          onVideoComplete={async (body) => {
            const res = await api.ownerVideoComplete(token!, event!.id, body);
            onPhotoCreated(res.photo);
          }}
        />
      </div>

      <div className="mt-6">
        <div className="mb-3 flex gap-1 border-b border-[var(--line)]">
          {(['all', 'pro', 'contributor'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-semibold transition ${
                tab === t
                  ? 'border-b-2 border-[var(--accent)] text-[var(--text)]'
                  : 'text-[var(--muted)]'
              }`}
            >
              {t === 'all' ? 'All' : t === 'pro' ? 'Pro' : 'Guests'}
            </button>
          ))}
        </div>
        <GalleryGrid photos={photos} onSelect={setSelected} variant="tiles" />
        <div className="mt-3 divide-y divide-[var(--line)] border border-[var(--line)]">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
            >
              <span className="truncate text-[var(--muted)]">
                {photo.type} · {new Date(photo.uploadedAt).toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => void onDelete(photo.id)}
                className="font-semibold text-[var(--danger)]"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      <Lightbox
        photos={photos}
        photo={selected}
        onClose={() => setSelected(null)}
        onSelect={setSelected}
      />
    </div>
  );
}
