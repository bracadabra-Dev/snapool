import { Photo } from '../lib/api';

type Props = {
  photos: Photo[];
  onSelect: (photo: Photo) => void;
  showTypeBadge?: boolean;
  /** masonry = Tumblr/Loona social feed; tiles = AllTrails utility grid */
  variant?: 'masonry' | 'tiles';
  highlightId?: string | null;
};

const MASONRY_ASPECTS = [
  'aspect-[3/4]',
  'aspect-square',
  'aspect-[4/5]',
  'aspect-[3/4]',
  'aspect-[5/6]',
  'aspect-[4/3]',
];

export default function GalleryGrid({
  photos,
  onSelect,
  showTypeBadge = true,
  variant = 'masonry',
  highlightId = null,
}: Props) {
  if (!photos.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-16 text-center">
        <p className="font-display text-lg font-semibold text-[var(--text)]">No shots yet</p>
        <p className="mt-1 text-sm text-[var(--muted)]">Be first — drop a photo into the live pool.</p>
      </div>
    );
  }

  if (variant === 'tiles') {
    return (
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onSelect(photo)}
            className={`group relative aspect-square overflow-hidden rounded-xl bg-[var(--surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              highlightId === photo.id ? 'pool-pop' : ''
            }`}
          >
            <img
              src={photo.thumbUrl}
              alt=""
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
            {showTypeBadge && photo.type === 'pro' && (
              <span className="absolute left-1.5 top-1.5 rounded-md bg-[var(--pro)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
                Pro
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // Social masonry — tight gutters, mixed portrait tiles (Loona + Tumblr)
  return (
    <div className="columns-2 gap-1.5 sm:columns-3 sm:gap-2">
      {photos.map((photo, i) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onSelect(photo)}
          className={`group relative mb-1.5 w-full break-inside-avoid overflow-hidden rounded-[1.15rem] bg-[var(--surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:mb-2 sm:rounded-[1.35rem] ${MASONRY_ASPECTS[i % MASONRY_ASPECTS.length]} ${
            highlightId === photo.id ? 'pool-pop' : ''
          }`}
        >
          <img
            src={photo.thumbUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-80" />
          {showTypeBadge && photo.type === 'pro' && (
            <span className="absolute left-2 top-2 rounded-lg bg-[var(--pro)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
              Pro
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
