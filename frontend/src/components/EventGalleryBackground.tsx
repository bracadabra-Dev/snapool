import { cacheBustUrl } from '../lib/cacheBustUrl';

type Props = {
  flyerUrl?: string | null;
  cacheVersion?: number;
};

export default function EventGalleryBackground({ flyerUrl, cacheVersion = 0 }: Props) {
  const src = cacheBustUrl(flyerUrl, cacheVersion);

  if (src) {
    return (
      <div
        className="pointer-events-none absolute inset-0 -z-10 min-h-full overflow-hidden"
        aria-hidden="true"
      >
        <img
          key={src}
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-black/62" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/75" />
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 min-h-full"
      aria-hidden="true"
      style={{
        background: `
          radial-gradient(ellipse 120% 85% at 50% -15%, var(--event-gradient-a), transparent 58%),
          radial-gradient(ellipse 75% 55% at 100% 40%, var(--event-gradient-b), transparent 52%),
          radial-gradient(ellipse 65% 50% at 0% 85%, var(--event-gradient-b), transparent 48%),
          var(--event-bg)
        `,
      }}
    />
  );
}
