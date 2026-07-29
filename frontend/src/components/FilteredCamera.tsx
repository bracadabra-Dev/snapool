import { MouseEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FILTER_PRESETS,
  FILTER_SWATCH,
  FilterId,
  captureFilteredFrame,
  drawFilteredVideoFrame,
  getFilterCss,
} from '../lib/filters';
import { tagRecordedVideoDuration } from '../features/video/validateVideo';

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
  onError: (message: string) => void;
  videoEnabled?: boolean;
  maxDurationSec?: number;
  onVideoCapture?: (file: File) => void;
};

type PreviewState = {
  file: File;
  url: string;
  kind: 'photo' | 'video';
  durationSec?: number;
  posterUrl?: string;
};

function pickRecorderMime(): string {
  const types = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return types.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';
}

export default function FilteredCamera({
  onCapture,
  onClose,
  onError,
  videoEnabled = false,
  maxDurationSec = 30,
  onVideoCapture,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const filterCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const drawLoopRef = useRef<number | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const [filterId, setFilterId] = useState<FilterId>('original');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [lensKey, setLensKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [canFlip, setCanFlip] = useState(false);
  const [filterLabelVisible, setFilterLabelVisible] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewVideoBroken, setPreviewVideoBroken] = useState(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const focusTimer = useRef<number | null>(null);
  const labelTimer = useRef<number | null>(null);
  const reviewing = preview !== null;
  const showVideoMode = videoEnabled && Boolean(onVideoCapture);
  const isVideoMode = showVideoMode && mode === 'video';
  const filterIdRef = useRef<FilterId>(filterId);
  const facingModeRef = useRef(facingMode);
  filterIdRef.current = filterId;
  facingModeRef.current = facingMode;

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
  }, [facingMode, lensKey]);

  useEffect(() => {
    return () => {
      if (focusTimer.current) window.clearTimeout(focusTimer.current);
      if (labelTimer.current) window.clearTimeout(labelTimer.current);
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      if (drawLoopRef.current) window.cancelAnimationFrame(drawLoopRef.current);
      recorderRef.current?.stop();
    };
  }, []);

  function stopFilterDrawLoop() {
    if (drawLoopRef.current != null) {
      window.cancelAnimationFrame(drawLoopRef.current);
      drawLoopRef.current = null;
    }
  }

  function runFilterDrawLoop() {
    const canvas = filterCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const tick = () => {
      drawFilteredVideoFrame(
        video,
        canvas,
        filterIdRef.current,
        facingModeRef.current === 'user'
      );
      drawLoopRef.current = window.requestAnimationFrame(tick);
    };

    stopFilterDrawLoop();
    tick();
  }

  useEffect(() => {
    if (!isVideoMode || !ready || reviewing) {
      stopFilterDrawLoop();
      return;
    }
    runFilterDrawLoop();
    return () => stopFilterDrawLoop();
  }, [isVideoMode, ready, reviewing, filterId, facingMode, lensKey]);

  useEffect(() => {
    if (preview?.kind !== 'video' || previewVideoBroken) return;
    const el = previewVideoRef.current;
    if (!el) return;
    el.load();
    void el.play().catch(() => setPreviewVideoBroken(true));
  }, [preview?.url, preview?.kind, previewVideoBroken]);

  useEffect(() => {
    const url = preview?.url;
    return () => {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [preview?.url]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackRef.current = null;
  }

  function clearPreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  function stopRecordingTimer() {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  function stopActiveRecording() {
    stopRecordingTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }

  async function finalizeRecording() {
    const mime = recorderRef.current?.mimeType || 'video/webm';
    const blob = new Blob(chunksRef.current, { type: mime });
    chunksRef.current = [];
    recorderRef.current = null;
    setRecording(false);

    const elapsedMs = recordingStartedAtRef.current
      ? Date.now() - recordingStartedAtRef.current
      : recordSeconds * 1000;
    recordingStartedAtRef.current = null;
    const durationSec = Math.max(1, Math.min(maxDurationSec, Math.ceil(elapsedMs / 1000)));
    setRecordSeconds(0);

    if (!blob.size) {
      onError('Recording failed — try again');
      return;
    }

    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([blob], `clip-${Date.now()}.${ext}`, { type: mime });
    tagRecordedVideoDuration(file, durationSec);

    let posterUrl: string | undefined;
    const canvas = filterCanvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
      drawFilteredVideoFrame(video, canvas, filterId, facingMode === 'user');
      posterUrl = canvas.toDataURL('image/jpeg', 0.82);
    }

    stopStream();
    setReady(false);
    setTorchOn(false);
    setPreviewVideoBroken(false);
    setPreview({ file, url: URL.createObjectURL(blob), kind: 'video', durationSec, posterUrl });
  }

  function startRecording() {
    const canvas = filterCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !ready || recording || reviewing) return;

    if (!drawFilteredVideoFrame(video, canvas, filterId, facingMode === 'user')) {
      onError('Camera not ready — try again');
      return;
    }

    const mime = pickRecorderMime();
    if (!mime) {
      onError('Video recording is not supported on this device. Upload a clip from your gallery instead.');
      return;
    }

    const canvasStream = canvas.captureStream(30);
    chunksRef.current = [];
    const recorder = new MediaRecorder(canvasStream, {
      mimeType: mime,
      videoBitsPerSecond: 2_500_000,
    });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      void finalizeRecording();
    };
    recorder.onerror = () => {
      setRecording(false);
      stopRecordingTimer();
      onError('Recording failed — try again');
    };

    recorder.start(250);
    recordingStartedAtRef.current = Date.now();
    setRecording(true);
    setRecordSeconds(0);
    stopRecordingTimer();
    recordTimerRef.current = window.setInterval(() => {
      setRecordSeconds((prev) => {
        const next = prev + 1;
        if (next >= maxDurationSec) {
          stopActiveRecording();
        }
        return next;
      });
    }, 1000);
  }

  function handleVideoShutter() {
    if (recording) {
      stopActiveRecording();
      return;
    }
    startRecording();
  }

  async function handleShutter() {
    const video = videoRef.current;
    if (!video || !ready || capturing || reviewing) return;
    setCapturing(true);
    setFlash(true);

    // Brief shutter flash, then capture
    await new Promise((r) => window.setTimeout(r, 90));

    try {
      const file = await captureFilteredFrame(video, filterId, {
        mirror: facingMode === 'user',
      });
      await new Promise((r) => window.setTimeout(r, 120));
      stopStream();
      setReady(false);
      setTorchOn(false);
      setFlash(false);
      setCapturing(false);
      setPreview({ file, url: URL.createObjectURL(file), kind: 'photo' });
    } catch (err) {
      setFlash(false);
      setCapturing(false);
      onError(err instanceof Error ? err.message : 'Capture failed');
    }
  }

  function handleRetake() {
    stopActiveRecording();
    recordingStartedAtRef.current = null;
    setPreviewVideoBroken(false);
    clearPreview();
    setCapturing(false);
    setFlash(false);
    setReady(false);
    setTorchOn(false);
    setLensKey((k) => k + 1);
  }

  function handleApprove() {
    if (!preview) return;
    const { file, kind } = preview;
    URL.revokeObjectURL(preview.url);
    setPreview(null);
    stopStream();
    if (kind === 'video') onVideoCapture?.(file);
    else onCapture(file);
  }

  function handleClose() {
    stopActiveRecording();
    clearPreview();
    stopStream();
    onClose();
  }

  function handleFlip() {
    if (reviewing || recording) return;
    stopStream();
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
      {/* Full-bleed viewfinder / review */}
      <div className="absolute inset-0" onClick={reviewing ? undefined : handleViewfinderTap}>
        {reviewing ? (
          preview.kind === 'video' ? (
            <div className="relative h-full w-full bg-black">
              {preview.posterUrl && (
                <img
                  src={preview.posterUrl}
                  alt=""
                  className={`absolute inset-0 h-full w-full object-cover ${previewVideoBroken ? '' : 'opacity-0'}`}
                />
              )}
              {previewVideoBroken ? (
                <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
                  {preview.posterUrl && (
                    <img
                      src={preview.posterUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-50"
                    />
                  )}
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-2xl backdrop-blur-sm">
                      ▶
                    </span>
                    <p className="text-lg font-semibold">Clip ready</p>
                    <p className="text-sm text-white/80">
                      {(preview.durationSec ?? 0) > 0 ? `${preview.durationSec}s clip` : 'Short clip'} — tap Use clip to upload.
                    </p>
                  </div>
                </div>
              ) : (
                <video
                  ref={previewVideoRef}
                  key={preview.url}
                  src={preview.url}
                  playsInline
                  controls
                  muted
                  preload="auto"
                  className="relative h-full w-full object-cover"
                  onError={() => setPreviewVideoBroken(true)}
                />
              )}
            </div>
          ) : (
            <img
              src={preview.url}
              alt="Snap preview"
              className="h-full w-full object-cover"
            />
          )
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`h-full w-full object-cover transition-[filter] duration-300 ${
                isVideoMode ? 'pointer-events-none absolute inset-0 opacity-0' : ''
              } ${!isVideoMode && facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              style={{ filter: isVideoMode ? undefined : getFilterCss(filterId) }}
            />
            {isVideoMode && (
              <canvas
                ref={filterCanvasRef}
                className="h-full w-full object-cover"
              />
            )}
          </>
        )}

        {/* Soft vignette + control readability gradients */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.35)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        {!reviewing && showGrid && (
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="border border-white/20" />
            ))}
          </div>
        )}

        {!reviewing && focusPoint && (
          <div
            className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-lg border-2 border-amber-300/90 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
            style={{ left: `${focusPoint.x}%`, top: `${focusPoint.y}%` }}
          />
        )}

        {!ready && !reviewing && (
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
          aria-label={reviewing ? 'Discard photo' : 'Close camera'}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-xl backdrop-blur-md"
        >
          ✕
        </button>

        {reviewing ? (
          <p className="rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold tracking-wide text-white/85 backdrop-blur-md">
            {preview.kind === 'video' ? 'Use this clip?' : 'Looks good?'}
          </p>
        ) : (
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
        )}
      </div>

      {/* Filter name toast */}
      {!reviewing && recording && (
        <div className="pointer-events-none absolute left-1/2 top-[18%] z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-red-600/90 px-4 py-1.5 text-sm font-semibold backdrop-blur-md">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          REC {recordSeconds}s / {maxDurationSec}s
        </div>
      )}

      {!reviewing && !recording && (
        <div
          className={`pointer-events-none absolute left-1/2 top-[22%] z-10 -translate-x-1/2 rounded-full bg-black/45 px-4 py-1.5 text-sm font-medium tracking-wide backdrop-blur-md transition-all duration-300 ${
            filterLabelVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          {activeFilter?.label}
        </div>
      )}

      {/* Bottom chrome */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {reviewing ? (
          <div className="flex items-center justify-center gap-10 px-4">
            <button
              type="button"
              onClick={handleRetake}
              className="flex flex-col items-center gap-2"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-black/45 backdrop-blur-md">
                <RetakeIcon />
              </span>
              <span className="text-xs font-semibold tracking-wide text-white/80">Retake</span>
            </button>
            <button
              type="button"
              onClick={handleApprove}
              className="flex flex-col items-center gap-2"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_0_28px_rgba(214,255,60,0.35)]">
                <CheckIcon />
              </span>
              <span className="text-xs font-semibold tracking-wide text-white">
                {preview.kind === 'video' ? 'Use clip' : 'Use photo'}
              </span>
            </button>
          </div>
        ) : (
          <>
            {showVideoMode && (
              <div className="mb-4 flex justify-center">
                <div className="inline-flex rounded-full bg-black/45 p-1 backdrop-blur-md">
                  {(['photo', 'video'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMode(id)}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${
                        mode === id ? 'bg-white text-black' : 'text-white/70'
                      }`}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5 flex justify-center gap-3 px-2 pb-1">
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
                        active
                          ? 'scale-110 bg-gradient-to-br from-white via-cyan-200 to-amber-200'
                          : 'bg-white/25'
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

            {isVideoMode && (
              <p className="mb-4 text-center text-xs text-white/55">
                Tap to record · max {maxDurationSec}s · filter is baked into the clip
              </p>
            )}

            {/* Shutter row */}
            <div className="relative flex items-center justify-center">
              <button
                type="button"
                disabled={!ready || capturing}
                aria-label={isVideoMode ? (recording ? 'Stop recording' : 'Start recording') : 'Take photo'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isVideoMode) handleVideoShutter();
                  else void handleShutter();
                }}
                className="group relative flex h-[76px] w-[76px] items-center justify-center rounded-full disabled:opacity-40"
              >
                <span
                  className={`absolute inset-0 rounded-full border-[3px] ${
                    isVideoMode ? 'border-red-400/90' : 'border-white/90'
                  }`}
                />
                <span
                  className={`rounded-full transition-transform duration-150 ${
                    isVideoMode
                      ? recording
                        ? 'h-[28px] w-[28px] rounded-md bg-red-500'
                        : 'h-[60px] w-[60px] bg-red-500'
                      : `h-[60px] w-[60px] bg-white shadow-[0_0_30px_rgba(255,255,255,0.25)] ${
                          capturing ? 'scale-90' : 'group-active:scale-90'
                        }`
                  }`}
                />
              </button>

              <div className="absolute right-6 text-right">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Mode</p>
                <p className="text-xs font-medium text-white/80">
                  {isVideoMode ? 'Video' : facingMode === 'environment' ? 'Photo · Rear' : 'Photo · Front'}
                </p>
              </div>
            </div>
          </>
        )}
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

function RetakeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 12a7.5 7.5 0 0 1 12.7-5.4L19 9M19.5 12a7.5 7.5 0 0 1-12.7 5.4L5 15"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 5v4h-4M5 19v-4h4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.5 12.5 10 17l8.5-9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
