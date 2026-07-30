import { ChangeEvent, useRef, useState } from 'react';
import { VideoCapabilities } from '../lib/api';
import { compressForUpload } from '../lib/compress';
import { type WatermarkConfig } from '../lib/watermark';
import { runVideoUpload } from '../features/video/runVideoUpload';
import VideoMaintenanceSheet from '../features/video/VideoMaintenanceSheet';

type Props = {
  onPhotoUpload: (full: Blob, thumb: Blob) => Promise<void>;
  video?: VideoCapabilities | null;
  getVideoSignature?: () => Promise<{ upload: import('../lib/api').VideoUploadParams; maxDurationSec: number }>;
  onVideoComplete?: (body: import('../lib/api').VideoCompleteBody) => Promise<void>;
  watermark?: WatermarkConfig | null;
};

export default function ProShotUpload({
  onPhotoUpload,
  video,
  getVideoSignature,
  onVideoComplete,
  watermark = null,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMaintenance, setShowMaintenance] = useState(false);

  const videoAvailable = video?.state === 'available' && Boolean(getVideoSignature && onVideoComplete);
  const acceptTypes = videoAvailable ? 'image/*,video/*' : 'image/*';

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      if (file.type.startsWith('video/')) {
        if (video?.state === 'maintenance') {
          setShowMaintenance(true);
          return;
        }
        if (!videoAvailable || !getVideoSignature || !onVideoComplete) {
          throw new Error('Video is not available for this event');
        }
        await runVideoUpload(file, getVideoSignature, onVideoComplete);
        return;
      }

      const { full, thumb } = await compressForUpload(file, { watermark });
      await onPhotoUpload(full, thumb);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <h3 className="font-display text-lg font-bold text-[var(--pro)]">Pro Shots</h3>
        <p className="text-sm text-[var(--muted)]">
          Official {videoAvailable ? 'photos and clips' : 'photos'} — owner only, tagged separately in the pool.
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-xl bg-[var(--pro)] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
      >
        {busy ? 'Uploading…' : videoAvailable ? 'Upload Pro Media' : 'Upload Pro Shot'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={acceptTypes}
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      {error && <p className="w-full text-sm text-[var(--danger)]">{error}</p>}
      {showMaintenance && (
        <VideoMaintenanceSheet message={video?.message} onClose={() => setShowMaintenance(false)} />
      )}
    </div>
  );
}
