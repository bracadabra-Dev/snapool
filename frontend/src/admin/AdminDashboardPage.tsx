import { useEffect, useState } from 'react';
import { api, AdminDashboard } from '../lib/api';
import { useAuth } from '../lib/auth';
import ConfirmModal from './ConfirmModal';

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmVideo, setConfirmVideo] = useState(false);

  async function load() {
    if (!token) return;
    try {
      const res = await api.admin.dashboard(token);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function toggleVideo() {
    if (!token || !data) return;
    setSaving(true);
    try {
      await api.admin.patchPlatform(token, { videoEnabled: !data.platform.videoEnabled });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <p className="text-sm text-[#9aa3b2]">{error || 'Loading…'}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-extrabold">Dashboard</h2>
        <p className="text-sm text-[#9aa3b2]">Platform overview and quick controls</p>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Users', data.stats.userCount],
          ['Events', data.stats.eventCount],
          ['Photos', data.stats.photoCount],
          ['Videos', data.stats.videoCount],
          ['Uploads 24h', data.stats.uploads24h],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wider text-[#9aa3b2]">{label as string}</p>
            <p className="font-display mt-1 text-2xl font-bold">{value as number}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold">Video uploads</h3>
            {data.videoForcedOffByEnv && (
              <p className="text-xs text-amber-400">Forced off by FEATURE_VIDEO_ENABLED env</p>
            )}
          </div>
          <button
            type="button"
            disabled={saving || data.videoForcedOffByEnv}
            onClick={() => setConfirmVideo(true)}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          >
            {data.platform.videoEnabled ? 'Disable video' : 'Enable video'}
          </button>
        </div>
      </div>

      {confirmVideo && (
        <ConfirmModal
          title={data.platform.videoEnabled ? 'Disable video platform-wide?' : 'Enable video uploads?'}
          message={
            data.platform.videoEnabled
              ? 'Guests will see a maintenance message until video is turned back on.'
              : 'Paid events with video enabled will allow guest video uploads.'
          }
          confirmLabel={data.platform.videoEnabled ? 'Disable' : 'Enable'}
          onCancel={() => setConfirmVideo(false)}
          onConfirm={() => {
            setConfirmVideo(false);
            void toggleVideo();
          }}
        />
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="font-display mb-3 text-lg font-bold">Recent audit</h3>
        <ul className="space-y-2 text-sm">
          {data.recentAudit.map((log) => (
            <li key={log.id} className="flex justify-between gap-3 border-b border-white/5 pb-2">
              <span>
                <span className="font-semibold">{log.action}</span>
                {log.target ? ` · ${log.target}` : ''}
              </span>
              <span className="shrink-0 text-[#9aa3b2]">{new Date(log.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
