import { ChangeEvent, useRef, useState } from 'react';
import FilteredCamera from './FilteredCamera';

type Props = {
  disabled?: boolean;
  onFile: (file: File) => void;
  contributionOpen?: boolean;
};

export default function CaptureActions({ disabled, onFile, contributionOpen = true }: Props) {
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
      <button
        type="button"
        disabled
        className="w-full rounded-2xl bg-slate-700 px-6 py-4 text-lg font-semibold text-slate-300 opacity-60"
      >
        Contribution closed
      </button>
    );
  }

  return (
    <div className="space-y-3">
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
        className="w-full rounded-2xl bg-cyan-500 px-6 py-4 text-lg font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Open Camera
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => galleryInputRef.current?.click()}
        className="w-full rounded-2xl border border-slate-600 bg-slate-900 px-6 py-3 font-semibold text-slate-100 transition hover:border-cyan-500/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Choose from gallery
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setCameraError(null);
          setShowFilters(true);
        }}
        className="w-full py-2 text-sm font-medium text-cyan-400 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        Snap with filters
      </button>

      {cameraError && (
        <p className="text-center text-sm text-rose-400">{cameraError}</p>
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
