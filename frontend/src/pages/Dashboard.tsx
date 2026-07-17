import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, EventSummary } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Dashboard() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventSummary[]>([]);
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
    if (!token || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.createEvent(token, { name: name.trim() });
      navigate(`/events/${res.event.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-cyan-400">SnapPool</p>
          <h1 className="text-3xl font-bold">Your events</h1>
          <p className="text-slate-400">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm"
        >
          Log out
        </button>
      </div>

      <form onSubmit={onCreate} className="mb-8 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New event name"
          required
          className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create Event'}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-slate-400">No events yet. Create your first one above.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="block rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-cyan-500/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{event.name}</h2>
                  <p className="text-sm text-slate-400">/{event.slug}</p>
                </div>
                <div className="text-sm text-slate-400">
                  {event.photoCount} photos · {event.contributorCount} contributors
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
