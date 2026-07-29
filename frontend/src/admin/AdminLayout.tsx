import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const links = [
  ['', 'Dashboard'],
  ['platform', 'Platform'],
  ['plans', 'Plans'],
  ['users', 'Users'],
  ['events', 'Events'],
  ['payments', 'Payments'],
  ['audit', 'Audit'],
] as const;

export default function AdminLayout() {
  const { token, user, authReady, logout } = useAuth();

  if (!authReady) {
    return <div className="p-8 text-sm text-[var(--muted)]">Checking admin access…</div>;
  }
  if (!token) return <Navigate to="/login" replace />;
  if (!user?.isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-[#e8eaef]">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-52 shrink-0 md:block">
          <p className="font-display text-xs font-bold tracking-[0.22em] text-[var(--accent)]">ADMIN</p>
          <h1 className="font-display mt-1 text-2xl font-extrabold">SnapPool Ops</h1>
          <nav className="mt-6 space-y-1">
            {links.map(([path, label]) => (
              <NavLink
                key={path}
                to={path ? `/admin/${path}` : '/admin'}
                end={path === ''}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-white/10 font-semibold' : 'text-[#9aa3b2] hover:bg-white/5'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={logout}
            className="mt-8 text-sm text-[#9aa3b2] hover:text-white"
          >
            Log out
          </button>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
