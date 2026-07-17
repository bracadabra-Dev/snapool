import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Home() {
  const { token } = useAuth();

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">SnapPool</p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Crowd-sourced event photography, one shared gallery.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-300">
        Create an event, share a QR code, and let every guest contribute photos — no app, no login.
        Keep your Pro Shots distinct in the same live gallery.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {token ? (
          <Link
            to="/dashboard"
            className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950"
          >
            Go to dashboard
          </Link>
        ) : (
          <>
            <Link
              to="/register"
              className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950"
            >
              Get started
            </Link>
            <Link
              to="/login"
              className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-100"
            >
              Log in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
