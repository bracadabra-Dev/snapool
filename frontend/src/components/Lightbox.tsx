import { Photo } from '../lib/api';

type Props = {
  photo: Photo | null;
  onClose: () => void;
};

export default function Lightbox({ photo, onClose }: Props) {
  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white"
        onClick={onClose}
      >
        Close
      </button>
      <img
        src={photo.fullUrl}
        alt=""
        className="max-h-[90vh] max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-slate-200">
        {photo.type === 'pro' ? 'Pro Shot' : photo.contributorName ? `Shot by ${photo.contributorName}` : 'Guest shot'}
      </div>
    </div>
  );
}
