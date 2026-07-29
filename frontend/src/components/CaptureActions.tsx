import { ChangeEvent, useRef, useState } from 'react';
import FilteredCamera from './FilteredCamera';
import PermissionSheet from './PermissionSheet';
import UploadExplainerSheet from './UploadExplainerSheet';
import VideoMaintenanceSheet from '../features/video/VideoMaintenanceSheet';
import { VideoCapabilities } from '../lib/api';
import { CameraIcon, UploadIcon } from './icons';

const UPLOAD_EXPLAINED_KEY = 'spaisnap_upload_explained';

type Props = {
  disabled?: boolean;
  onPhotoFile: (file: File) => void;
  onVideoFile?: (file: File) => void;
  video?: VideoCapabilities | null;
  contributionOpen?: boolean;
  compact?: boolean;
};

export default function CaptureActions({
  disabled,
  onPhotoFile,
  onVideoFile,
  video,
  contributionOpen = true,
  compact = false,
}: Props) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);

  const videoAvailable = video?.state === 'available' && Boolean(onVideoFile);
  const acceptTypes = videoAvailable ? 'image/*,video/*' : 'image/*';

  function openPicker() {
    galleryInputRef.current?.click();
  }

  function handleUploadTap() {
    const explained = localStorage.getItem(UPLOAD_EXPLAINED_KEY);
    if (!explained) {
      setShowExplainer(true);
      return;
    }
    openPicker();
  }

  function markExplainedAndPick() {
    localStorage.setItem(UPLOAD_EXPLAINED_KEY, '1');
    setShowExplainer(false);
    openPicker();
  }

  function handleGalleryChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.type.startsWith('video/')) {
      if (video?.state === 'maintenance') {
        setShowMaintenance(true);
        return;
      }
      if (!videoAvailable) {
        setPermissionMessage('Video is not available for this event.');
        return;
      }
      onVideoFile?.(file);
      return;
    }

    onPhotoFile(file);
  }

  if (!contributionOpen) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-center text-sm text-[var(--muted)]">
        Contributions closed
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
      <input
        ref={galleryInputRef}
        type="file"
        accept={acceptTypes}
        className="hidden"
        onChange={handleGalleryChange}
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setPermissionMessage(null);
            setShowCamera(true);
          }}
          className="btn-primary min-h-12 gap-2 py-3.5 text-sm tracking-tight disabled:opacity-45"
        >
          <CameraIcon size={18} />
          Snap
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={handleUploadTap}
          className="btn-ghost min-h-12 gap-2 py-3.5 text-sm disabled:opacity-45"
        >
          <UploadIcon size={18} />
          Upload
        </button>
      </div>

      {showExplainer && (
        <UploadExplainerSheet
          videoAvailable={videoAvailable}
          maxDurationSec={video?.maxDurationSec}
          onChooseMedia={markExplainedAndPick}
          onUseSnap={() => {
            localStorage.setItem(UPLOAD_EXPLAINED_KEY, '1');
            setShowExplainer(false);
            setPermissionMessage(null);
            setShowCamera(true);
          }}
          onClose={() => setShowExplainer(false)}
        />
      )}

      {permissionMessage !== null && (
        <PermissionSheet
          message={permissionMessage}
          onUploadInstead={() => {
            setPermissionMessage(null);
            openPicker();
          }}
          onClose={() => setPermissionMessage(null)}
        />
      )}

      {showMaintenance && (
        <VideoMaintenanceSheet message={video?.message} onClose={() => setShowMaintenance(false)} />
      )}

      {showCamera && (
        <FilteredCamera
          videoEnabled={videoAvailable}
          maxDurationSec={video?.maxDurationSec ?? 30}
          onCapture={(file) => {
            setShowCamera(false);
            onPhotoFile(file);
          }}
          onVideoCapture={
            videoAvailable
              ? (file) => {
                  setShowCamera(false);
                  onVideoFile?.(file);
                }
              : undefined
          }
          onClose={() => setShowCamera(false)}
          onError={(message) => {
            setShowCamera(false);
            setPermissionMessage(message);
          }}
        />
      )}
    </div>
  );
}
