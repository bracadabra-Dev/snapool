import { PoolIcon } from './icons';

type Props = {
  message: string;
};

export default function ThankChip({ message }: Props) {
  return (
    <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 py-2.5 text-center text-sm font-semibold text-[var(--accent)]">
      <PoolIcon size={16} />
      {message}
    </div>
  );
}
