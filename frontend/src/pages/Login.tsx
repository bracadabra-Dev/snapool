import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.login({ email, password });
      setSession(res.token, res.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <Link to="/" className="font-display mb-8 text-sm font-bold tracking-[0.2em] text-[var(--accent)]">
        SNAPPOOL
      </Link>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Log in</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Pick up where your events left off.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field"
        />
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full py-3.5 text-sm">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-5 text-sm text-[var(--muted)]">
        No account?{' '}
        <Link className="font-semibold text-[var(--accent)]" to="/register">
          Register
        </Link>
      </p>
    </div>
  );
}
