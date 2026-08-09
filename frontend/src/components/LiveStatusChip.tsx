import type { LiveConnectionState } from '../lib/realtime';

type Props = {
  state: LiveConnectionState;
  count?: number;
};

export default function LiveStatusChip({ state, count }: Props) {
  if (state === 'live') {
    return (
      <div className="ml-auto flex items-center gap-1.5 pb-3 pt-3 text-[11px] font-semibold tabular-nums text-[var(--event-text-muted)]">
        <span className="live-dot" />
        <span className="text-[var(--accent)]">Live</span>
        {typeof count === 'number' && <span>{count}</span>}
      </div>
    );
  }

  if (state === 'connecting' || state === 'reconnecting') {
    return (
      <div className="ml-auto flex items-center gap-1.5 pb-3 pt-3 text-[11px] font-semibold text-[var(--event-text-muted)]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300/80" />
        Reconnecting…
        {typeof count === 'number' && (
          <span className="tabular-nums opacity-80">{count}</span>
        )}
      </div>
    );
  }

  return (
    <div className="ml-auto flex items-center gap-1.5 pb-3 pt-3 text-[11px] font-semibold text-[var(--event-text-muted)]">
      <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
      Offline
      {typeof count === 'number' && <span className="tabular-nums">{count}</span>}
    </div>
  );
}
