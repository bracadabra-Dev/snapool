import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, EventDetail, Photo } from '../lib/api';
import { useAuth } from '../lib/auth';
import GalleryGrid from '../components/GalleryGrid';
import Lightbox from '../components/Lightbox';
import ProShotUpload from '../components/ProShotUpload';

type Tab = 'all' | 'pro' | 'contributor';

export default function EventEdit() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
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
    await api.proUpload(token, event.id, full, thumb);
    await load();
  }

  async function onDelete(photoId: string) {
    if (!token || !event) return;
    if (!confirm('Delete this photo?')) return;
    await api.deletePhoto(token, event.id, photoId);
    await load();
  }

  if (!event) {
    return <div className="p-8 text-slate-400">{error || 'Loading event…'}</div>;
  }

  const qrSrc = event.qrCodeUrl || event.qrDataUrl || null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/dashboard" className="text-sm text-cyan-400">
        ← Back to dashboard
      </Link>
      <h1 className="mt-3 text-3xl font-bold">{event.name}</h1>

      <div className="mt-6 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm text-slate-400">Share link</p>
          <p className="break-all font-mono text-sm text-cyan-300">{event.publicUrl}</p>
          <button
            type="button"
            className="mt-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm"
            onClick={async () => {
              await navigator.clipboard.writeText(event.publicUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
        {qrSrc && (
          <div className="justify-self-start rounded-xl bg-white p-2 md:justify-self-end">
            <img src={qrSrc} alt="Event QR code" className="h-36 w-36" />
          </div>
        )}
      </div>

      <form onSubmit={onSave} className="mt-8 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-xl font-semibold">Event settings</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-400">Name</span>
            <input
              value={event.name}
              onChange={(e) => setEvent({ ...event, name: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-400">Visibility</span>
            <select
              value={event.visibility}
              onChange={(e) => setEvent({ ...event, visibility: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
            >
              <option value="unlisted">Unlisted (link only)</option>
              <option value="public">Public</option>
              <option value="password">Password</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-400">Max photos per contributor</span>
            <input
              type="number"
              min={1}
              max={200}
              value={event.maxPhotosPerContributor}
              onChange={(e) =>
                setEvent({ ...event, maxPhotosPerContributor: Number(e.target.value) })
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-400">Retention days</span>
            <input
              type="number"
              min={1}
              max={365}
              value={event.retentionDays}
              onChange={(e) => setEvent({ ...event, retentionDays: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-400">Thank-you message</span>
            <textarea
              value={event.thankYouMessage || ''}
              onChange={(e) => setEvent({ ...event, thankYouMessage: e.target.value })}
              rows={2}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
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
            Require contributor name
          </label>
          <label className="flex items-center gap-2">
            Moderation
            <select
              value={event.moderationMode}
              onChange={(e) => setEvent({ ...event, moderationMode: e.target.value })}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1"
            >
              <option value="auto">Auto-publish</option>
              <option value="manual">Manual approve</option>
            </select>
          </label>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>

      <div className="mt-8">
        <ProShotUpload onUpload={onProUpload} />
      </div>

      <div className="mt-8">
        <div className="mb-4 flex flex-wrap gap-2">
          {(['all', 'pro', 'contributor'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                tab === t ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {t === 'all' ? 'All' : t === 'pro' ? 'Pro Shots' : 'Contributor Pool'}
            </button>
          ))}
        </div>
        <GalleryGrid photos={photos} onSelect={setSelected} />
        <div className="mt-4 space-y-2">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 px-3 py-2 text-sm"
            >
              <span className="truncate text-slate-400">
                {photo.type} · {new Date(photo.uploadedAt).toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => void onDelete(photo.id)}
                className="rounded-lg bg-rose-500/20 px-3 py-1 text-rose-300"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      <Lightbox photo={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
