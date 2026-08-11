import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, AccountEventLimits, EventSummary } from '../lib/api';
import { useAuth } from '../lib/auth';
import BrandLogo from '../components/BrandLogo';

export default function Dashboard() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [limits, setLimits] = useState<AccountEventLimits | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.listEvents(token);
      setEvents(res.events);
      setLimits(res.limits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token || !name.trim() || limits?.canCreate === false) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.createEvent(token, { name: name.trim() });
      navigate(`/events/${res.event.id}?setup=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <BrandLogo variant="full" size="sm" className="mb-2" href="/" />
          <h1 className="font-display mt-1 text-4xl font-extrabold tracking-tight">Events</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {user?.email}
            {user?.plan ? ` · ${user.plan}` : ''}
            {limits?.maxActiveEvents != null && (
              <> · {limits.activeCount} / {limits.maxActiveEvents} events</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/pricing" className="btn-ghost px-4 py-2 text-sm">
            Pricing
          </Link>
          {user?.isSuperAdmin && (
            <Link to="/admin" className="btn-ghost px-4 py-2 text-sm">
              Admin
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="btn-ghost px-4 py-2 text-sm"
          >
            Log out
          </button>
        </div>
      </div>

      {limits?.canCreate === false ? (
        <div className="surface mb-6 p-4 text-sm">
          <p className="text-[var(--muted)]">
            {limits.planName} allows {limits.maxActiveEvents} active{' '}
            {limits.maxActiveEvents === 1 ? 'event' : 'events'}. Upgrade to create more.
          </p>
          <Link to="/pricing" className="btn-primary mt-3 inline-block px-4 py-2 text-sm">
            View plans
          </Link>
        </div>
      ) : (
        <form onSubmit={onCreate} className="surface mb-6 flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New event name"
            required
            className="field flex-1 !border-transparent !bg-[var(--ink)]"
          />
          <button type="submit" disabled={busy} className="btn-primary px-5 py-3 text-sm">
            {busy ? 'Creating…' : 'Create'}
          </button>
        </form>
      )}

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : events.length === 0 ? (
        <div className="border border-dashed border-[var(--line)] px-4 py-12 text-center">
          <p className="font-display text-lg font-semibold">No events yet</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Create one and share the link tonight.</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--line)] border border-[var(--line)]">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="flex items-center justify-between gap-3 bg-[var(--surface)]/50 px-4 py-4 transition hover:bg-[var(--surface)]"
            >
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-bold tracking-tight">
                  {event.name}
                </h2>
                <p className="truncate text-xs text-[var(--muted)]">/{event.slug}</p>
              </div>
              <div className="shrink-0 text-right text-xs tabular-nums text-[var(--muted)]">
                <div className="font-semibold text-[var(--text)]">{event.photoCount}</div>
                <div>photos</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
