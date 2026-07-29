import { FormEvent, useEffect, useState } from 'react';
import { api, PlatformSettings } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function AdminPlatformPage() {
  const { token } = useAuth();
  const [platform, setPlatform] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void api.admin.getPlatform(token).then((res) => setPlatform(res.platform));
  }, [token]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!token || !platform) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await api.admin.patchPlatform(token, platform);
      setPlatform(res.platform);
      setMsg('Saved');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!platform) return <p className="text-sm text-[#9aa3b2]">Loading…</p>;

  return (
    <form onSubmit={onSave} className="space-y-6">
      <h2 className="font-display text-3xl font-extrabold">Platform settings</h2>
      {msg && <p className="text-sm text-[var(--accent)]">{msg}</p>}

      <div className="grid gap-4 rounded-xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
        <label className="block text-sm">
          Video maintenance message
          <textarea
            className="field mt-1 w-full"
            rows={3}
            value={platform.videoMaintenanceMessage}
            onChange={(e) => setPlatform({ ...platform, videoMaintenanceMessage: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Global maintenance message
          <textarea
            className="field mt-1 w-full"
            rows={3}
            value={platform.maintenanceMessage}
            onChange={(e) => setPlatform({ ...platform, maintenanceMessage: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={platform.registrationEnabled}
            onChange={(e) => setPlatform({ ...platform, registrationEnabled: e.target.checked })}
          />
          Registration enabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={platform.maintenanceMode}
            onChange={(e) => setPlatform({ ...platform, maintenanceMode: e.target.checked })}
          />
          Maintenance mode
        </label>
        <label className="block text-sm">
          Default photos / contributor
          <input
            type="number"
            className="field mt-1 w-full"
            value={platform.defaultMaxPhotosPerContributor}
            onChange={(e) =>
              setPlatform({ ...platform, defaultMaxPhotosPerContributor: Number(e.target.value) })
            }
          />
        </label>
        <label className="block text-sm">
          Upload rate limit / minute
          <input
            type="number"
            className="field mt-1 w-full"
            value={platform.uploadRateLimitPerMinute}
            onChange={(e) =>
              setPlatform({ ...platform, uploadRateLimitPerMinute: Number(e.target.value) })
            }
          />
        </label>
        <label className="block text-sm">
          Currency
          <input
            className="field mt-1 w-full"
            value={platform.currency}
            onChange={(e) => setPlatform({ ...platform, currency: e.target.value })}
          />
        </label>
      </div>

      <button type="submit" disabled={saving} className="btn-primary px-5 py-3 text-sm">
        {saving ? 'Saving…' : 'Save platform settings'}
      </button>
    </form>
  );
}
