import { ChangeEvent, useRef, useState } from 'react';
import FilteredCamera from './FilteredCamera';
import PermissionSheet from './PermissionSheet';
import UploadExplainerSheet from './UploadExplainerSheet';
import { CameraIcon, UploadIcon } from './icons';

const UPLOAD_EXPLAINED_KEY = 'spaisnap_upload_explained';

type Props = {
  disabled?: boolean;
  onFile: (file: File) => void;
  contributionOpen?: boolean;
  compact?: boolean;
};

export default function CaptureActions({
  disabled,
  onFile,
  contributionOpen = true,
  compact = false,
}: Props) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);

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
    if (file) onFile(file);
    e.target.value = '';
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
        accept="image/*"
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
          onChoosePhoto={markExplainedAndPick}
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

      {showCamera && (
        <FilteredCamera
          onCapture={(file) => {
            setShowCamera(false);
            onFile(file);
          }}
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
