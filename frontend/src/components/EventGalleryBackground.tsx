import EventFlyerImage from './EventFlyerImage';

type Props = {
  flyerUrl?: string | null;
};

export default function EventGalleryBackground({ flyerUrl }: Props) {
  if (flyerUrl) {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-0 min-h-full overflow-hidden"
        aria-hidden="true"
      >
        <EventFlyerImage
          url={flyerUrl}
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
      className="pointer-events-none absolute inset-0 z-0 min-h-full"
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
