import { Link } from 'react-router-dom';
import { PLATFORM_NAME } from '../lib/brand';

export type BrandLogoVariant = 'mark' | 'full' | 'wordmark' | 'stacked';
export type BrandLogoTone = 'light' | 'dark' | 'accent';

type Props = {
  variant?: BrandLogoVariant;
  tone?: BrandLogoTone;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  href?: string;
  label?: string;
};

const sizeMap = {
  sm: { mark: 28, word: 'text-sm', gap: 'gap-2', stacked: 'text-base' },
  md: { mark: 34, word: 'text-base', gap: 'gap-2.5', stacked: 'text-xl' },
  lg: { mark: 42, word: 'text-lg', gap: 'gap-3', stacked: 'text-2xl' },
  xl: { mark: 52, word: 'text-xl', gap: 'gap-3.5', stacked: 'text-3xl' },
} as const;

function toneClasses(tone: BrandLogoTone) {
  if (tone === 'dark') {
    return { word: 'text-[#0a0a0a]', mark: '#0a0a0a', accent: '#0a0a0a' };
  }
  if (tone === 'accent') {
    return { word: 'text-[var(--accent)]', mark: 'var(--accent)', accent: 'var(--accent)' };
  }
  return { word: 'text-[var(--text)]', mark: '#f4f4f5', accent: '#d6ff3c' };
}

function LogoMark({ size, accent }: { size: number; accent: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="7" y="11" width="17" height="22" rx="3.5" transform="rotate(-14 15.5 22)" fill="#2e2e38" />
      <rect x="13" y="8" width="17" height="22" rx="3.5" transform="rotate(7 21.5 19)" fill="#18181f" />
      <rect x="17" y="12" width="22" height="28" rx="4.5" fill="#101014" stroke={accent} strokeWidth="1.75" />
      <circle cx="28" cy="25" r="5.25" stroke={accent} strokeWidth="1.5" opacity="0.95" />
      <circle cx="28" cy="25" r="2.1" fill={accent} />
      <circle cx="36.5" cy="16.5" r="2.6" fill={accent} />
    </svg>
  );
}

function Wordmark({ className }: { className: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight ${className}`}>
      Pix<span className="text-[var(--accent)]">Dump</span>
    </span>
  );
}

export default function BrandLogo({
  variant = 'full',
  tone = 'light',
  size = 'md',
  className = '',
  href,
  label = PLATFORM_NAME,
}: Props) {
  const sizing = sizeMap[size];
  const colors = toneClasses(tone);

  const content =
    variant === 'mark' ? (
      <LogoMark size={sizing.mark} accent={colors.accent} />
    ) : variant === 'wordmark' ? (
      <Wordmark className={`${sizing.word} ${colors.word}`} />
    ) : variant === 'stacked' ? (
      <span className="inline-flex flex-col items-center gap-2">
        <LogoMark size={sizing.mark + 6} accent={colors.accent} />
        <Wordmark className={`${sizing.stacked} ${colors.word}`} />
      </span>
    ) : (
      <span className={`inline-flex items-center ${sizing.gap}`}>
        <LogoMark size={sizing.mark} accent={colors.accent} />
        <Wordmark className={`${sizing.word} ${colors.word}`} />
      </span>
    );

  const shell = (
    <span className={`inline-flex items-center ${className}`} aria-label={label}>
      {content}
    </span>
  );

  if (href) {
    return (
      <Link to={href} className="inline-flex transition opacity-95 hover:opacity-100">
        {shell}
      </Link>
    );
  }

  return shell;
}

export function BrandLogoMark({ size = 34, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/brand/logo-mark.svg"
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    />
  );
}
