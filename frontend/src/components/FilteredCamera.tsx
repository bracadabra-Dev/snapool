import { MouseEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FILTER_PRESETS,
  FILTER_SWATCH,
  FilterId,
  captureFilteredFrame,
  getFilterCss,
} from '../lib/filters';

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
  onError: (message: string) => void;
};

export default function FilteredCamera({ onCapture, onClose, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const [filterId, setFilterId] = useState<FilterId>('original');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [canFlip, setCanFlip] = useState(false);
  const [filterLabelVisible, setFilterLabelVisible] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const focusTimer = useRef<number | null>(null);
  const labelTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        onErrorRef.current(
          'In-app camera is not supported on this device. Upload a photo from your gallery instead.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const track = stream.getVideoTracks()[0] ?? null;
        trackRef.current = track;

        const caps = track?.getCapabilities?.() as
          | (MediaTrackCapabilities & { torch?: boolean })
          | undefined;
        setTorchSupported(Boolean(caps?.torch));
        setTorchOn(false);

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setReady(true);
        }

        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setCanFlip(devices.filter((d) => d.kind === 'videoinput').length > 1);
        } catch {
          setCanFlip(true);
        }
      } catch {
        onErrorRef.current(
          'Camera permission denied or unavailable. Allow camera access in site settings, or upload from your gallery.'
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      trackRef.current = null;
    };
  }, [facingMode]);

  useEffect(() => {
    return () => {
      if (focusTimer.current) window.clearTimeout(focusTimer.current);
      if (labelTimer.current) window.clearTimeout(labelTimer.current);
    };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function handleShutter() {
    const video = videoRef.current;
    if (!video || !ready || capturing) return;
    setCapturing(true);
    setFlash(true);

    // Brief shutter flash, then capture
    await new Promise((r) => window.setTimeout(r, 90));

    try {
      const file = await captureFilteredFrame(video, filterId, {
        mirror: facingMode === 'user',
      });
      await new Promise((r) => window.setTimeout(r, 120));
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      trackRef.current = null;
      onCapture(file);
    } catch (err) {
      setFlash(false);
      setCapturing(false);
      onError(err instanceof Error ? err.message : 'Capture failed');
    }
  }

  function handleClose() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackRef.current = null;
    onClose();
  }

  function handleFlip() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackRef.current = null;
    setReady(false);
    setTorchOn(false);
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track || !torchSupported) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }

  function selectFilter(id: FilterId) {
    setFilterId(id);
    setFilterLabelVisible(true);
    if (labelTimer.current) window.clearTimeout(labelTimer.current);
    labelTimer.current = window.setTimeout(() => setFilterLabelVisible(false), 900);
  }

  function handleViewfinderTap(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setFocusPoint({ x, y });
    if (focusTimer.current) window.clearTimeout(focusTimer.current);
    focusTimer.current = window.setTimeout(() => setFocusPoint(null), 900);
  }

  const activeFilter = FILTER_PRESETS.find((f) => f.id === filterId);

  return createPortal(
    <div className="fixed inset-0 z-[110] bg-black text-white">
      {/* Full-bleed viewfinder */}
      <div className="absolute inset-0" onClick={handleViewfinderTap}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`h-full w-full object-cover transition-[filter] duration-300 ${
            facingMode === 'user' ? 'scale-x-[-1]' : ''
          }`}
          style={{ filter: getFilterCss(filterId) }}
        />

        {/* Soft vignette + control readability gradients */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.35)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        {showGrid && (
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="border border-white/20" />
            ))}
          </div>
        )}

        {focusPoint && (
          <div
            className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-lg border-2 border-amber-300/90 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
            style={{ left: `${focusPoint.x}%`, top: `${focusPoint.y}%` }}
          />
        )}

        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <p className="text-sm tracking-wide text-white/70">Opening lens…</p>
          </div>
        )}
      </div>

      {/* Shutter flash */}
      <div
        className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-150 ${
          flash ? 'opacity-90' : 'opacity-0'
        }`}
      />

      {/* Top chrome */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(0.85rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close camera"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-xl backdrop-blur-md"
        >
          ✕
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            aria-label="Toggle grid"
            className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md ${
              showGrid ? 'bg-white text-black' : 'bg-black/40 text-white'
            }`}
          >
            <GridIcon />
          </button>
          {torchSupported && facingMode === 'environment' && (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              aria-label="Toggle flash"
              className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md ${
                torchOn ? 'bg-amber-300 text-black' : 'bg-black/40 text-white'
              }`}
            >
              <BoltIcon />
            </button>
          )}
          {canFlip && (
            <button
              type="button"
              onClick={handleFlip}
              aria-label="Flip camera"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"
            >
              <FlipIcon />
            </button>
          )}
        </div>
      </div>

      {/* Filter name toast */}
      <div
        className={`pointer-events-none absolute left-1/2 top-[22%] z-10 -translate-x-1/2 rounded-full bg-black/45 px-4 py-1.5 text-sm font-medium tracking-wide backdrop-blur-md transition-all duration-300 ${
          filterLabelVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        {activeFilter?.label}
      </div>

      {/* Bottom chrome */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {/* Instagram-style filter rings */}
        <div className="mb-5 -mx-1 flex gap-3 overflow-x-auto px-2 pb-1 scrollbar-none">
          {FILTER_PRESETS.map((preset) => {
            const active = filterId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  selectFilter(preset.id);
                }}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <span
                  className={`rounded-full p-[2px] transition-transform duration-200 ${
                    active ? 'scale-110 bg-gradient-to-br from-white via-cyan-200 to-amber-200' : 'bg-white/25'
                  }`}
                >
                  <span
                    className="block h-12 w-12 rounded-full border-2 border-black/40 shadow-lg"
                    style={{ background: FILTER_SWATCH[preset.id] }}
                  />
                </span>
                <span
                  className={`text-[11px] font-medium ${
                    active ? 'text-white' : 'text-white/55'
                  }`}
                >
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Shutter row */}
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            disabled={!ready || capturing}
            aria-label="Take photo"
            onClick={(e) => {
              e.stopPropagation();
              void handleShutter();
            }}
            className="group relative flex h-[76px] w-[76px] items-center justify-center rounded-full disabled:opacity-40"
          >
            <span className="absolute inset-0 rounded-full border-[3px] border-white/90" />
            <span
              className={`h-[60px] w-[60px] rounded-full bg-white shadow-[0_0_30px_rgba(255,255,255,0.25)] transition-transform duration-150 ${
                capturing ? 'scale-90' : 'group-active:scale-90'
              }`}
            />
          </button>

          <div className="absolute right-6 text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Lens</p>
            <p className="text-xs font-medium text-white/80">
              {facingMode === 'environment' ? 'Rear' : 'Front'}
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 3v18M15 3v18M3 9h18M3 15h18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 10-14h-7l0-6z" />
    </svg>
  );
}

function FlipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 4h4v4M20 4l-5.5 5.5M8 20H4v-4M4 20l5.5-5.5M7 7a7 7 0 0 1 10.5 1M17 17a7 7 0 0 1-10.5-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
