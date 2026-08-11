import { useEffect, useState } from 'react';
import { api, PlanDefinition } from '../lib/api';
import { useAuth } from '../lib/auth';
import ConfirmModal from './ConfirmModal';

export default function AdminPlansPage() {
  const { token } = useAuth();
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [selected, setSelected] = useState<PlanDefinition | null>(null);
  const [pendingSave, setPendingSave] = useState<PlanDefinition | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!token) return;
    const res = await api.admin.listPlans(token);
    setPlans(res.plans);
  }

  useEffect(() => {
    void load();
  }, [token]);

  return (
    <div className="space-y-6">
      <h2 className="font-display text-3xl font-extrabold">Plans & pricing</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelected({ ...plan })}
              className={`w-full rounded-xl border px-4 py-3 text-left ${
                selected?.id === plan.id ? 'border-[var(--accent)] bg-white/10' : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-bold">{plan.name}</span>
                <span className="text-sm text-[#9aa3b2]">
                  {plan.priceAmount.toLocaleString()} {plan.billingType !== 'free' ? '/ mo' : ''}
                </span>
              </div>
              <p className="text-xs text-[#9aa3b2]">{plan.id}</p>
            </button>
          ))}
        </div>

        {selected && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-display text-xl font-bold">{selected.name}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ['priceAmount', 'Price (XAF)'],
                ['maxPhotosPerContributor', 'Photos / guest'],
                ['maxRetentionDays', 'Retention days'],
                ['maxVideosPerEvent', 'Videos / event'],
                ['maxVideosPerContributor', 'Videos / guest'],
                ['maxVideoDurationSec', 'Max video sec'],
              ].map(([key, label]) => (
                <label key={key} className="block text-xs">
                  {label}
                  <input
                    type="number"
                    className="field mt-1 w-full"
                    value={selected[key as keyof PlanDefinition] as number}
                    onChange={(e) =>
                      setSelected({ ...selected, [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
              <div className="block text-xs sm:col-span-2">
                <span>Active events limit</span>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.maxActiveEvents == null}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        maxActiveEvents: e.target.checked ? null : 1,
                      })
                    }
                  />
                  Unlimited events
                </label>
                {selected.maxActiveEvents != null && (
                  <input
                    type="number"
                    min={1}
                    className="field mt-2 w-full"
                    value={selected.maxActiveEvents}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        maxActiveEvents: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                )}
              </div>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {[
                ['allowVideo', 'Allow video'],
                ['allowCustomBranding', 'Custom branding'],
                ['allowZipDownload', 'Zip download'],
                ['active', 'Active'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[key as keyof PlanDefinition])}
                    onChange={(e) =>
                      setSelected({ ...selected, [key]: e.target.checked })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => setPendingSave(selected)}
              className="btn-primary mt-4 px-4 py-2 text-sm"
            >
              {saving ? 'Saving…' : 'Save plan'}
            </button>
          </div>
        )}
      </div>

      {pendingSave && (
        <ConfirmModal
          title={`Save changes to ${pendingSave.name}?`}
          message={`Price: ${pendingSave.priceAmount} XAF · Events: ${pendingSave.maxActiveEvents == null ? 'unlimited' : pendingSave.maxActiveEvents} · Video: ${pendingSave.allowVideo ? `${pendingSave.maxVideosPerEvent}/event` : 'off'}`}
          onCancel={() => setPendingSave(null)}
          onConfirm={() => {
            const plan = pendingSave;
            setPendingSave(null);
            void (async () => {
              if (!token || !plan) return;
              setSaving(true);
              try {
                const res = await api.admin.patchPlan(token, plan.id, plan);
                setSelected(res.plan);
                await load();
              } finally {
                setSaving(false);
              }
            })();
          }}
        />
      )}
    </div>
  );
}
