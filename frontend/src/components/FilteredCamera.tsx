import { CSSProperties, MouseEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FILTER_PRESETS,
  FILTER_SWATCH,
  FilterId,
  captureFilteredFrame,
  drawFilteredVideoFrame,
  getFilterCss,
  scheduleVideoFrameDraw,
} from '../lib/filters';
import {
  cameraFrameRate,
  pickRecorderMime,
  videoBitrateForResolution,
} from '../features/video/recording';
import { tagRecordedVideoDuration } from '../features/video/validateVideo';

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
  onError: (message: string) => void;
  videoEnabled?: boolean;
  maxDurationSec?: number;
  onVideoCapture?: (file: File) => void;
  themeStyle?: CSSProperties;
};

type PreviewState = {
  file: File;
  url: string;
  kind: 'photo' | 'video';
  durationSec?: number;
  posterUrl?: string;
};

export default function FilteredCamera({
  onCapture,
  onClose,
  onError,
  videoEnabled = false,
  maxDurationSec = 30,
  onVideoCapture,
  themeStyle,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const filterCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const cancelDrawLoopRef = useRef<(() => void) | null>(null);
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
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            frameRate: { ideal: 30, min: 24 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const track = stream.getVideoTracks()[0] ?? null;
        trackRef.current = track;

        if (import.meta.env.DEV && track) {
          console.debug('[FilteredCamera] track settings', track.getSettings());
        }

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
      cancelDrawLoopRef.current?.();
      recorderRef.current?.stop();
    };
  }, []);

  function stopFilterDrawLoop() {
    cancelDrawLoopRef.current?.();
    cancelDrawLoopRef.current = null;
  }

  function runFilterDrawLoop() {
    const canvas = filterCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    stopFilterDrawLoop();
    cancelDrawLoopRef.current = scheduleVideoFrameDraw(video, () => {
      drawFilteredVideoFrame(
        video,
        canvas,
        filterIdRef.current,
        facingModeRef.current === 'user'
      );
    });
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

    const fps = cameraFrameRate(trackRef.current);
    const { width, height } = canvas;
    const canvasStream = canvas.captureStream(fps);
    chunksRef.current = [];
    const recorder = new MediaRecorder(canvasStream, {
      mimeType: mime,
      videoBitsPerSecond: videoBitrateForResolution(width, height),
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
  const recordProgress = Math.min(1, recordSeconds / maxDurationSec);
  const shutterRing = 2 * Math.PI * 38;

  return createPortal(
    <div
      className="camera-screen event-themed fixed inset-0 z-[110] bg-black text-white"
      style={themeStyle}
    >
      {/* Full-bleed viewfinder / review */}
      <div className="absolute inset-0" onClick={reviewing ? undefined : handleViewfinderTap}>
        {reviewing ? (
          preview.kind === 'video' ? (
            <div className="relative z-[1] box-border h-full w-full bg-black pb-32">
              {preview.posterUrl && previewVideoBroken && (
                <img
                  src={preview.posterUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-50"
                />
              )}
              {previewVideoBroken ? (
                <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 px-6 pb-28 text-center">
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
                  className="h-full w-full object-contain"
                  onError={() => setPreviewVideoBroken(true)}
                />
              )}
            </div>
          ) : (
            <div className="relative h-full w-full">
              <img
                src={preview.url}
                alt="Camera preview"
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
            </div>
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

        {!reviewing && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.35)_100%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
          </>
        )}

        {!reviewing && showGrid && (
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-80">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="border border-white/12" />
            ))}
          </div>
        )}

        {!reviewing && ready && (
          <>
            <div className="pointer-events-none absolute left-4 top-[calc(max(0.85rem,env(safe-area-inset-top))+3.25rem)] h-7 w-7 rounded-tl-md border-l-2 border-t-2 border-white/30" />
            <div className="pointer-events-none absolute right-4 top-[calc(max(0.85rem,env(safe-area-inset-top))+3.25rem)] h-7 w-7 rounded-tr-md border-r-2 border-t-2 border-white/30" />
            <div className="pointer-events-none absolute bottom-52 left-4 h-7 w-7 rounded-bl-md border-b-2 border-l-2 border-white/30" />
            <div className="pointer-events-none absolute bottom-52 right-4 h-7 w-7 rounded-br-md border-b-2 border-r-2 border-white/30" />
          </>
        )}

        {!reviewing && focusPoint && (
          <div
            className="camera-focus-ring pointer-events-none absolute h-[4.5rem] w-[4.5rem] rounded-md border-2 border-[var(--accent)] shadow-[0_0_24px_color-mix(in_srgb,var(--accent)_40%,transparent)]"
            style={{ left: `${focusPoint.x}%`, top: `${focusPoint.y}%` }}
          />
        )}

        {!ready && !reviewing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 backdrop-blur-sm">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-white/15 border-t-[var(--accent)]" />
              <CameraLensIcon />
            </div>
            <div className="text-center">
              <p className="font-display text-sm font-semibold tracking-wide text-white">Opening lens</p>
              <p className="mt-1 text-xs text-white/55">Hold steady — almost ready</p>
            </div>
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
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[var(--camera-chrome)] backdrop-blur-md transition hover:bg-[var(--camera-chrome-strong)]"
        >
          <CloseIcon />
        </button>

        {reviewing ? (
          <p className="rounded-full border border-white/10 bg-[var(--camera-chrome)] px-4 py-2 text-xs font-semibold tracking-wide text-white/90 backdrop-blur-md">
            {preview.kind === 'video' ? 'Review clip' : 'Review shot'}
          </p>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[var(--camera-chrome)] p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setShowGrid((v) => !v)}
              aria-label="Toggle grid"
              aria-pressed={showGrid}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                showGrid ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'text-white/85 hover:bg-white/10'
              }`}
            >
              <GridIcon />
            </button>
            {torchSupported && facingMode === 'environment' && (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                aria-label="Toggle flash"
                aria-pressed={torchOn}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                  torchOn ? 'bg-amber-300 text-black' : 'text-white/85 hover:bg-white/10'
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
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition hover:bg-white/10"
              >
                <FlipIcon />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter name toast */}
      {!reviewing && recording && (
        <div className="pointer-events-none absolute left-1/2 top-[16%] z-10 flex -translate-x-1/2 flex-col items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-red-400/30 bg-red-950/75 px-4 py-1.5 text-sm font-semibold backdrop-blur-md">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            REC {recordSeconds}s
          </div>
          <div className="h-1 w-28 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-red-400 transition-all duration-300"
              style={{ width: `${recordProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {!reviewing && !recording && (
        <div
          className={`pointer-events-none absolute left-1/2 top-[18%] z-10 -translate-x-1/2 rounded-full border border-white/10 bg-[var(--camera-chrome)] px-4 py-1.5 text-sm font-medium tracking-wide backdrop-blur-md transition-all duration-300 ${
            filterLabelVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          {activeFilter?.label}
        </div>
      )}

      {/* Bottom chrome */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/75 to-transparent px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
        {reviewing ? (
          <div className="flex items-end justify-center gap-12 px-4">
            <button
              type="button"
              onClick={handleRetake}
              className="flex flex-col items-center gap-2.5"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-[var(--camera-chrome)] backdrop-blur-md transition hover:bg-[var(--camera-chrome-strong)]">
                <RetakeIcon />
              </span>
              <span className="text-xs font-semibold tracking-wide text-white/75">Retake</span>
            </button>
            <button
              type="button"
              onClick={handleApprove}
              className="flex flex-col items-center gap-2.5"
            >
              <span className="flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_0_32px_color-mix(in_srgb,var(--accent)_42%,transparent)] transition hover:scale-[1.03]">
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
              <div className="mb-5 flex justify-center">
                <div className="inline-flex rounded-full border border-white/10 bg-[var(--camera-chrome)] p-1 backdrop-blur-md">
                  {(['photo', 'video'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMode(id)}
                      className={`rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wider transition ${
                        mode === id
                          ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
                          : 'text-white/65 hover:text-white'
                      }`}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="scrollbar-none mb-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1">
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
                    className="flex shrink-0 snap-center flex-col items-center gap-1.5"
                  >
                    <span
                      className={`rounded-full p-[2.5px] transition-all duration-200 ${
                        active
                          ? 'scale-105 bg-[var(--accent)] shadow-[0_0_18px_color-mix(in_srgb,var(--accent)_45%,transparent)]'
                          : 'bg-white/20'
                      }`}
                    >
                      <span
                        className="block h-11 w-11 rounded-full border-2 border-black/35 shadow-md"
                        style={{ background: FILTER_SWATCH[preset.id] }}
                      />
                    </span>
                    <span
                      className={`min-h-[1rem] text-[10px] font-semibold uppercase tracking-wide ${
                        active ? 'text-[var(--accent)]' : 'text-transparent'
                      }`}
                    >
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {isVideoMode && (
              <p className="mb-4 text-center text-[11px] tracking-wide text-white/50">
                Tap to record · up to {maxDurationSec}s · filter baked in
              </p>
            )}

            <div className="flex flex-col items-center gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                {isVideoMode ? 'Video' : facingMode === 'environment' ? 'Rear camera' : 'Selfie'}
              </p>

              <div className="relative flex items-center justify-center">
                {recording && (
                  <svg
                    className="pointer-events-none absolute -rotate-90"
                    width="84"
                    height="84"
                    viewBox="0 0 84 84"
                    aria-hidden="true"
                  >
                    <circle cx="42" cy="42" r="38" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
                    <circle
                      cx="42"
                      cy="42"
                      r="38"
                      fill="none"
                      stroke="#f87171"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={shutterRing}
                      strokeDashoffset={shutterRing * (1 - recordProgress)}
                    />
                  </svg>
                )}

                <button
                  type="button"
                  disabled={!ready || capturing}
                  aria-label={isVideoMode ? (recording ? 'Stop recording' : 'Start recording') : 'Take photo'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isVideoMode) handleVideoShutter();
                    else void handleShutter();
                  }}
                  className={`group relative flex h-[76px] w-[76px] items-center justify-center rounded-full disabled:opacity-40 ${
                    ready && !capturing && !recording ? 'camera-shutter-ready' : ''
                  }`}
                >
                  <span
                    className={`absolute inset-0 rounded-full border-[3px] ${
                      isVideoMode ? 'border-red-400/90' : 'border-white/90'
                    }`}
                  />
                  <span
                    className={`rounded-full transition-all duration-150 ${
                      isVideoMode
                        ? recording
                          ? 'h-[28px] w-[28px] rounded-md bg-red-500'
                          : 'h-[60px] w-[60px] bg-red-500 group-active:scale-95'
                        : `h-[60px] w-[60px] bg-white shadow-[0_0_28px_rgba(255,255,255,0.22)] ${
                            capturing ? 'scale-90' : 'group-active:scale-90'
                          }`
                    }`}
                  />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CameraLensIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 8.5A2.5 2.5 0 0 1 7 6h1.2l1.1-1.8A1.5 1.5 0 0 1 10.55 3.5h2.9a1.5 1.5 0 0 1 1.25.7L15.8 6H17a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 17 19H7a2.5 2.5 0 0 1-2.5-2.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
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
