import { useEffect, useRef, useState } from 'react';
import {
  FILTER_PRESETS,
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
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const [filterId, setFilterId] = useState<FilterId>('original');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [canFlip, setCanFlip] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        onErrorRef.current(
          'In-app camera is not supported on this device. Use Open Camera or Choose from gallery.'
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
          'Camera permission denied or unavailable. Use Open Camera or Choose from gallery instead.'
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode]);

  async function handleShutter() {
    const video = videoRef.current;
    if (!video || !ready || capturing) return;
    setCapturing(true);
    try {
      const file = await captureFilteredFrame(video, filterId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      onCapture(file);
    } catch (err) {
      setCapturing(false);
      onError(err instanceof Error ? err.message : 'Capture failed');
    }
  }

  function handleClose() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onClose();
  }

  function handleFlip() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white"
        >
          Close
        </button>
        {canFlip && (
          <button
            type="button"
            onClick={handleFlip}
            className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white"
          >
            Flip
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
          style={{ filter: getFilterCss(filterId) }}
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-slate-300">
            Starting camera…
          </div>
        )}
      </div>

      <div className="space-y-4 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setFilterId(preset.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                filterId === preset.id
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-white/15 text-white'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            disabled={!ready || capturing}
            aria-label="Take photo"
            onClick={() => void handleShutter()}
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/90 disabled:opacity-40"
          >
            <span className="h-12 w-12 rounded-full bg-cyan-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
