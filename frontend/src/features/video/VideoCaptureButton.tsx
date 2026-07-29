import { ChangeEvent, useRef, useState } from 'react';
import { VideoCapabilities } from '../../lib/api';
import { uploadVideoToCloudinary, parseCloudinaryUploadResult } from './uploadVideo';
import VideoMaintenanceSheet from './VideoMaintenanceSheet';

type Props = {
  slug: string;
  contributorToken: string;
  video: VideoCapabilities;
  disabled?: boolean;
  onSignature: () => Promise<{ upload: import('../../lib/api').VideoUploadParams; maxDurationSec: number }>;
  onComplete: (body: import('../../lib/api').VideoCompleteBody) => Promise<void>;
  onUploaded?: () => void;
};

export default function VideoCaptureButton({
  video,
  disabled,
  onSignature,
  onComplete,
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (video.state === 'plan_required' || video.state === 'disabled_by_owner') {
    return null;
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('video/')) {
      setError('Please choose a video file');
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const { upload, maxDurationSec } = await onSignature();
      const result = await uploadVideoToCloudinary(file, upload, setProgress);
      const duration = typeof result.duration === 'number' ? Math.round(result.duration as number) : undefined;
      if (duration != null && duration > maxDurationSec) {
        setError(`Video must be ${maxDurationSec}s or shorter`);
        return;
      }
      const parsed = parseCloudinaryUploadResult(result);
      await onComplete(parsed);
      onUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video upload failed');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFile(e)}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => {
          if (video.state === 'maintenance') {
            setShowMaintenance(true);
            return;
          }
          inputRef.current?.click();
        }}
        className="btn-ghost min-h-12 w-full gap-2 py-3.5 text-sm disabled:opacity-45"
      >
        {busy ? `Uploading video ${progress}%` : 'Video'}
      </button>
      {error && <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>}
      {showMaintenance && (
        <VideoMaintenanceSheet
          message={video.message}
          onClose={() => setShowMaintenance(false)}
        />
      )}
    </div>
  );
}
