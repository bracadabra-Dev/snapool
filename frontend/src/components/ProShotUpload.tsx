import { useRef, useState } from 'react';
import { compressForUpload } from '../lib/compress';

type Props = {
  onUpload: (full: Blob, thumb: Blob) => Promise<void>;
};

export default function ProShotUpload({ onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const { full, thumb } = await compressForUpload(file);
      await onUpload(full, thumb);
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
          Official photos — owner only, tagged separately in the pool.
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-xl bg-[var(--pro)] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
      >
        {busy ? 'Uploading…' : 'Upload Pro Shot'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      {error && <p className="w-full text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
