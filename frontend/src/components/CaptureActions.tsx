import { ChangeEvent, useRef, useState } from 'react';
import FilteredCamera from './FilteredCamera';

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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  function handleInputChange(
    e: ChangeEvent<HTMLInputElement>,
    input: HTMLInputElement | null
  ) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    if (input) input.value = '';
  }

  if (!contributionOpen) {
    return (
      <div className="border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-center text-sm text-[var(--muted)]">
        Contributions closed
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleInputChange(e, cameraInputRef.current)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleInputChange(e, galleryInputRef.current)}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => cameraInputRef.current?.click()}
        className="btn-primary w-full py-3.5 text-base tracking-tight"
      >
        Open Camera
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => galleryInputRef.current?.click()}
          className="btn-ghost px-3 py-2.5 text-sm disabled:opacity-45"
        >
          From gallery
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setCameraError(null);
            setShowFilters(true);
          }}
          className="btn-ghost px-3 py-2.5 text-sm disabled:opacity-45"
        >
          Filters
        </button>
      </div>

      {cameraError && (
        <p className="text-center text-xs text-[var(--danger)]">{cameraError}</p>
      )}

      {showFilters && (
        <FilteredCamera
          onCapture={(file) => {
            setShowFilters(false);
            onFile(file);
          }}
          onClose={() => setShowFilters(false)}
          onError={(message) => {
            setShowFilters(false);
            setCameraError(message);
          }}
        />
      )}
    </div>
  );
}
