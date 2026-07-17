import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, Photo, PublicEvent } from '../lib/api';
import { compressForUpload } from '../lib/compress';
import CameraButton from '../components/CameraButton';
import GalleryGrid from '../components/GalleryGrid';
import Lightbox from '../components/Lightbox';

const SESSION_KEY = (slug: string) => `spaisnap_contrib_${slug}`;

export default function ContributorPage() {
  const { slug = '' } = useParams();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showThanks, setShowThanks] = useState(false);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadEvent() {
    setLoading(true);
    try {
      const res = await api.getPublicEvent(slug);
      setEvent(res.event);
      const stored = localStorage.getItem(SESSION_KEY(slug));
      if (stored) setToken(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Event not found');
    } finally {
      setLoading(false);
    }
  }

  async function loadGallery() {
    try {
      const res = await api.getGallery(slug);
      setPhotos(res.photos);
    } catch {
      // ignore transient poll errors
    }
  }

  useEffect(() => {
    void loadEvent();
    void loadGallery();
    const id = window.setInterval(() => void loadGallery(), 4000);
    return () => window.clearInterval(id);
  }, [slug]);

  async function ensureSession(providedName?: string): Promise<string> {
    if (token) return token;
    const res = await api.createSession(slug, {
      name: providedName || undefined,
    });
    localStorage.setItem(SESSION_KEY(slug), res.token);
    setToken(res.token);
    return res.token;
  }

  async function startSession(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await ensureSession(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start session');
    }
  }

  async function onFile(file: File) {
    if (!event?.contributionOpen) {
      setError('Contribution is closed for this event');
      return;
    }
    setError(null);
    setShowThanks(false);
    setStatus('Compressing…');
    setProgress(15);
    try {
      const session =
        event.requireContributorName && !token
          ? await ensureSession(name)
          : await ensureSession();
      setProgress(40);
      setStatus('Uploading…');
      const { full, thumb } = await compressForUpload(file);
      setProgress(70);
      await api.contributorUpload(slug, session, full, thumb);
      setProgress(100);
      setStatus(null);
      setShowThanks(true);
      await loadGallery();
      setTimeout(() => setShowThanks(false), 4000);
    } catch (err) {
      setStatus(null);
      setProgress(0);
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading event…</div>;
  }

  if (!event) {
    return <div className="p-8 text-center text-rose-400">{error || 'Event not found'}</div>;
  }

  const needsNameGate = event.requireContributorName && !token;

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pb-16 pt-6">
      {event.coverImageUrl && (
        <img
          src={event.coverImageUrl}
          alt=""
          className="mb-4 h-40 w-full rounded-2xl object-cover"
        />
      )}
      <div className="mb-6 text-center">
        {event.brandingLogoUrl && (
          <img src={event.brandingLogoUrl} alt="" className="mx-auto mb-3 h-10 object-contain" />
        )}
        <h1 className="text-2xl font-bold">{event.name}</h1>
        {event.ownerBusinessName && (
          <p className="mt-1 text-sm text-slate-400">{event.ownerBusinessName}</p>
        )}
      </div>

      {needsNameGate ? (
        <form onSubmit={startSession} className="mb-6 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-300">Enter your name to contribute photos.</p>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
          />
          <button type="submit" className="w-full rounded-xl bg-cyan-500 py-3 font-semibold text-slate-950">
            Continue
          </button>
        </form>
      ) : (
        <div className="mb-6 space-y-3">
          <CameraButton
            disabled={!event.contributionOpen || !!status}
            onFile={(file) => void onFile(file)}
            label={event.contributionOpen ? 'Open Camera' : 'Contribution closed'}
          />
          {status && (
            <div>
              <p className="mb-1 text-center text-sm text-cyan-300">{status}</p>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {showThanks && (
            <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-4 text-center">
              <p className="font-semibold text-cyan-200">
                {event.thankYouMessage || 'Thanks! Your photo is in the gallery.'}
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p className="mb-4 text-center text-sm text-rose-400">{error}</p>}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Live gallery</h2>
      <GalleryGrid photos={photos} onSelect={setSelected} />
      <Lightbox photo={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
