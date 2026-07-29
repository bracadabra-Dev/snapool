import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PLATFORM_NAME_HEADER } from '../lib/brand';

export default function Register() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('photographer');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.register({
        email,
        password,
        role,
        businessName: businessName || undefined,
      });
      setSession(res.token, res.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <Link to="/" className="font-display mb-8 text-sm font-bold tracking-[0.2em] text-[var(--accent)]">
        {PLATFORM_NAME_HEADER}
      </Link>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Create account</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Launch galleries your guests fill in real time.</p>
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
          minLength={8}
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="field"
        >
          <option value="photographer">Photographer</option>
          <option value="organizer">Organizer</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <input
          type="text"
          placeholder="Business name (optional)"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="field"
        />
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full py-3.5 text-sm">
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="mt-5 text-sm text-[var(--muted)]">
        Already have an account?{' '}
        <Link className="font-semibold text-[var(--accent)]" to="/login">
          Log in
        </Link>
      </p>
    </div>
  );
}
