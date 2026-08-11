import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import BrandLogo from '../components/BrandLogo';

export default function Home() {
  const { token } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in srgb, var(--line) 80%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--line) 80%, transparent) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-end px-5 pb-12 pt-10 sm:justify-center sm:pb-20">
        <BrandLogo variant="full" size="lg" className="rise mb-6" href="/" />
        <h1 className="font-display rise rise-delay-1 max-w-[11ch] text-[3.4rem] font-extrabold leading-[0.9] tracking-tight sm:text-7xl">
          The event’s live gallery.
        </h1>
        <p className="rise rise-delay-2 mt-5 max-w-md text-base text-[var(--muted)] sm:text-lg">
          One link. Every phone. A shared photo pool that fills in real time — no app, no guest
          login.
        </p>
        <div className="rise rise-delay-2 mt-8 flex flex-wrap gap-3">
          {token ? (
            <Link to="/dashboard" className="btn-primary px-6 py-3.5 text-sm">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn-primary px-6 py-3.5 text-sm">
                Start an event
              </Link>
              <Link to="/pricing" className="btn-ghost px-6 py-3.5 text-sm">
                Pricing
              </Link>
              <Link to="/login" className="btn-ghost px-6 py-3.5 text-sm">
                Log in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
