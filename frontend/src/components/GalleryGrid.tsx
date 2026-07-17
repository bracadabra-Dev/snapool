import { Photo } from '../lib/api';

type Props = {
  photos: Photo[];
  onSelect: (photo: Photo) => void;
  showTypeBadge?: boolean;
};

export default function GalleryGrid({ photos, onSelect, showTypeBadge = true }: Props) {
  if (!photos.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-slate-400">
        No photos yet — be the first to add one.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {photos.map((photo) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onSelect(photo)}
          className="group relative aspect-square overflow-hidden rounded-xl bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          <img
            src={photo.thumbUrl}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
          {showTypeBadge && (
            <span
              className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                photo.type === 'pro'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-cyan-500/90 text-white'
              }`}
            >
              {photo.type === 'pro' ? 'Pro' : 'Guest'}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
