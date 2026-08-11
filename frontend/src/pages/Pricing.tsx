import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, PlanPublic } from '../lib/api';
import { useAuth } from '../lib/auth';
import BrandLogo from '../components/BrandLogo';

export default function PricingPage() {
  const { token, user } = useAuth();
  const [plans, setPlans] = useState<PlanPublic[]>([]);
  const [addons, setAddons] = useState<Array<{ id: string; name: string; priceAmount: number; description?: string | null }>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void api.getPublicPlans().then((res) => {
      setPlans(res.plans);
      setAddons(res.addons);
    });
  }, []);

  async function checkout(planId: string) {
    if (!token) {
      window.location.href = '/login';
      return;
    }
    setBusy(planId);
    setMessage(null);
    try {
      const res = await api.checkout(token, { planId });
      if (res.devComplete) {
        await api.devCompletePayment(token, res.reference);
        setMessage('Plan activated (dev mode)');
      } else if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        setMessage('Payment initiated');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <BrandLogo variant="full" size="sm" className="mb-6" href="/" />
      <p className="font-display text-xs font-bold tracking-[0.22em] text-[var(--accent)]">PRICING</p>
      <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight">Choose your plan</h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
        {user ? `Signed in as ${user.email} (${user.plan})` : 'Log in to upgrade your account.'}
      </p>
      {message && <p className="mt-4 text-sm text-[var(--accent)]">{message}</p>}

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.id} className="surface flex flex-col p-5">
            {plan.highlightLabel && (
              <span className="mb-2 w-fit rounded-md bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold uppercase text-black">
                {plan.highlightLabel}
              </span>
            )}
            <h2 className="font-display text-xl font-bold">{plan.name}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{plan.description}</p>
            <p className="font-display mt-4 text-3xl font-extrabold">
              {plan.priceAmount === 0 ? 'Free' : `${plan.priceAmount.toLocaleString()} XAF`}
            </p>
            <ul className="mt-4 flex-1 space-y-1 text-sm text-[var(--muted)]">
              <li>
                {plan.features.maxActiveEvents == null
                  ? 'Unlimited events'
                  : plan.features.maxActiveEvents === 1
                    ? '1 active event'
                    : `${String(plan.features.maxActiveEvents)} active events`}
              </li>
              <li>{String(plan.features.maxPhotosPerContributor)} photos / guest</li>
              <li>{String(plan.features.maxRetentionDays)} day retention</li>
              {plan.features.allowVideo ? (
                <li>Video: {String(plan.features.maxVideosPerEvent)} clips / event</li>
              ) : (
                <li>Photos only</li>
              )}
            </ul>
            {plan.billingType !== 'free' && (
              <button
                type="button"
                disabled={busy === plan.id}
                onClick={() => void checkout(plan.id)}
                className="btn-primary mt-5 w-full py-3 text-sm"
              >
                {busy === plan.id ? 'Processing…' : 'Upgrade'}
              </button>
            )}
          </div>
        ))}
      </div>

      {addons.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-2xl font-bold">Add-ons</h2>
          <p className="text-sm text-[var(--muted)]">Purchase from your event settings after checkout.</p>
          <ul className="mt-3 space-y-2">
            {addons.map((a) => (
              <li key={a.id} className="surface px-4 py-3 text-sm">
                {a.name} — {a.priceAmount.toLocaleString()} XAF
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link to="/dashboard" className="btn-ghost mt-8 inline-block px-4 py-2 text-sm">
        Back to dashboard
      </Link>
    </div>
  );
}
