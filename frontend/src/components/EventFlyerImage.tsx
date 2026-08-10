import type { MouseEvent } from 'react';

type Props = {
  url: string;
  alt?: string;
  className?: string;
  draggable?: boolean;
  onClick?: (e: MouseEvent<HTMLImageElement>) => void;
};

/** Flyer asset from R2 — use the stored URL as-is (each upload gets a unique key). */
export default function EventFlyerImage({ url, alt = '', className, draggable, onClick }: Props) {
  return (
    <img
      key={url}
      src={url}
      alt={alt}
      className={className}
      draggable={draggable}
      onClick={onClick}
      decoding="async"
    />
  );
}
