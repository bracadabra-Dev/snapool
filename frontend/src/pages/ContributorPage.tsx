import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError, Photo, PublicEvent } from '../lib/api';
import { compressForUpload } from '../lib/compress';
import CaptureActions from '../components/CaptureActions';
import GalleryGrid from '../components/GalleryGrid';
import Lightbox from '../components/Lightbox';
import ThankChip from '../components/ThankChip';

const SESSION_KEY = (slug: string) => `spaisnap_contrib_${slug}`;

type FeedTab = 'all' | 'pro' | 'contributor';

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
  const [tab, setTab] = useState<FeedTab>('all');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

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

    let id: number | null = null;

    function startPoll() {
      if (id != null) return;
      id = window.setInterval(() => {
        if (document.visibilityState === 'visible') void loadGallery();
      }, 4000);
    }

    function stopPoll() {
      if (id != null) {
        window.clearInterval(id);
        id = null;
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        void loadGallery();
        startPoll();
      } else {
        stopPoll();
      }
    }

    if (document.visibilityState === 'visible') startPoll();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopPoll();
      document.removeEventListener('visibilitychange', onVisibility);
      if (highlightTimer.current != null) window.clearTimeout(highlightTimer.current);
    };
  }, [slug]);

  const feed = useMemo(() => {
    if (tab === 'pro') return photos.filter((p) => p.type === 'pro');
    if (tab === 'contributor') return photos.filter((p) => p.type === 'contributor');
    return photos;
  }, [photos, tab]);

  function clearSession() {
    localStorage.removeItem(SESSION_KEY(slug));
    setToken(null);
    tokenRef.current = null;
  }

  async function ensureSession(providedName?: string, forceNew = false): Promise<string> {
    if (!forceNew && tokenRef.current) return tokenRef.current;
    const res = await api.createSession(slug, {
      name: providedName || undefined,
    });
    localStorage.setItem(SESSION_KEY(slug), res.token);
    setToken(res.token);
    tokenRef.current = res.token;
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

  function pulseHighlight(photoId: string) {
    setHighlightId(photoId);
    if (highlightTimer.current != null) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightId(null), 450);
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
      let session =
        event.requireContributorName && !tokenRef.current
          ? await ensureSession(name)
          : await ensureSession();
      setProgress(40);
      setStatus('Uploading…');
      const { full, thumb } = await compressForUpload(file);
      setProgress(70);

      try {
        const res = await api.contributorUpload(slug, session, full, thumb);
        setProgress(100);
        setStatus(null);
        setShowThanks(true);
        await loadGallery();
        pulseHighlight(res.photo.id);
        setTimeout(() => setShowThanks(false), 4000);
      } catch (uploadErr) {
        if (uploadErr instanceof ApiError && uploadErr.status === 401) {
          clearSession();
          if (event.requireContributorName && !name.trim()) {
            setStatus(null);
            setProgress(0);
            setError('Session expired — enter your name to continue');
            return;
          }
          session = await ensureSession(name || undefined, true);
          const res = await api.contributorUpload(slug, session, full, thumb);
          setProgress(100);
          setStatus(null);
          setShowThanks(true);
          await loadGallery();
          pulseHighlight(res.photo.id);
          setTimeout(() => setShowThanks(false), 4000);
          return;
        }
        throw uploadErr;
      }
    } catch (err) {
      setStatus(null);
      setProgress(0);
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading gallery…
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-[var(--danger)]">
        {error || 'Event not found'}
      </div>
    );
  }

  const needsNameGate = event.requireContributorName && !token;
  const galleryHidden = !event.galleryLive;

  return (
    <div className="event-atmosphere relative mx-auto min-h-screen max-w-lg pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <header className="relative px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        {event.brandingLogoUrl && (
          <img
            src={event.brandingLogoUrl}
            alt=""
            className="mb-4 h-7 max-w-[45%] object-contain object-left"
          />
        )}
        <p className="text-[13px] font-medium text-white/55">
          {event.ownerBusinessName || 'Live event gallery'}
        </p>
        <h1 className="font-display mt-1 text-[2.15rem] font-extrabold leading-[0.95] tracking-tight text-white sm:text-4xl">
          {event.name}
        </h1>
        <p className="mt-3 max-w-[28ch] text-sm leading-relaxed text-white/50">
          Everyone’s angle, one pool — scroll the night as it fills.
        </p>

        {event.coverImageUrl && (
          <div className="mt-5 overflow-hidden rounded-[1.75rem]">
            <img
              src={event.coverImageUrl}
              alt=""
              className="aspect-[16/10] w-full object-cover"
            />
          </div>
        )}
      </header>

      {/* AllTrails-style section tabs */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[var(--ink)]/80 px-4 backdrop-blur-xl">
        <div className="flex items-end gap-5">
          {(
            [
              ['all', 'Photos'],
              ['pro', 'Pro'],
              ['contributor', 'Guests'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative pb-3 pt-3 text-sm font-semibold transition ${
                tab === id ? 'text-white' : 'text-white/40'
              }`}
            >
              {label}
              {tab === id && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--accent)]" />
              )}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5 pb-3 pt-3 text-[11px] font-semibold tabular-nums text-white/45">
            <span className="live-dot" />
            {feed.length}
          </div>
        </div>
      </div>

      <div className="px-3 pt-3 sm:px-4">
        {galleryHidden ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-[var(--muted)]">
            The host hasn’t published the gallery yet. You can still contribute.
          </div>
        ) : (
          <GalleryGrid
            variant="masonry"
            photos={feed}
            onSelect={setSelected}
            highlightId={highlightId}
          />
        )}

        {error && (
          <p className="mt-3 text-center text-sm text-[var(--danger)]">{error}</p>
        )}
        {showThanks && (
          <ThankChip message={event.thankYouMessage || 'You’re in the pool.'} />
        )}
      </div>

      {/* Soft floating capture sheet */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-lg rounded-[1.75rem] border border-white/10 bg-[var(--ink)]/90 p-3 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          {needsNameGate ? (
            <form onSubmit={startSession} className="space-y-2">
              <p className="px-1 text-xs text-[var(--muted)]">Name yourself to join the pool</p>
              <div className="flex gap-2">
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="field flex-1 !rounded-2xl !py-2.5"
                />
                <button type="submit" className="btn-primary min-h-12 !rounded-2xl px-4 py-2.5 text-sm">
                  Join
                </button>
              </div>
            </form>
          ) : (
            <>
              <CaptureActions
                compact
                disabled={!!status}
                contributionOpen={event.contributionOpen}
                onFile={(file) => void onFile(file)}
              />
              {status && (
                <div className="mt-2 px-1">
                  <div className="mb-1 flex justify-between text-[11px] text-[var(--muted)]">
                    <span>{status}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Lightbox
        photos={feed}
        photo={selected}
        onClose={() => setSelected(null)}
        onSelect={setSelected}
      />
    </div>
  );
}
