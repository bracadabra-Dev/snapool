type Props = {
  message?: string;
  onClose: () => void;
};

export default function VideoMaintenanceSheet({ message, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="surface w-full max-w-md p-5">
        <p className="section-label mb-2 text-[var(--accent)]">Video</p>
        <h2 className="font-display text-xl font-bold">Under maintenance</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {message || 'Video uploads are temporarily under maintenance. Photos still work normally.'}
        </p>
        <button type="button" onClick={onClose} className="btn-primary mt-5 w-full py-3 text-sm">
          OK
        </button>
      </div>
    </div>
  );
}
