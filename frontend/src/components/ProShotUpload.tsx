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
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-amber-300">Pro Shots</h3>
          <p className="text-sm text-slate-400">Upload your official photos (kept visually distinct).</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {busy ? 'Uploading…' : 'Upload Pro Shot'}
        </button>
      </div>
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
      {error && <p className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
