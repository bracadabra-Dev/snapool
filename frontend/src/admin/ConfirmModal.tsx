type Props = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#12141a] p-5">
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm text-[#9aa3b2]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost px-4 py-2 text-sm">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="btn-primary px-4 py-2 text-sm">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
