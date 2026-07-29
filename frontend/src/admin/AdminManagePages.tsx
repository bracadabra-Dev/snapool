import { useEffect, useState } from 'react';
import { api, AdminUser, AdminEvent, PaymentRecord, AuditLog } from '../lib/api';
import { useAuth } from '../lib/auth';

export function AdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!token) return;
    void api.admin.listUsers(token, q).then((res) => setUsers(res.users));
  }, [token, q]);

  async function patchUser(id: string, body: Record<string, unknown>) {
    if (!token) return;
    await api.admin.patchUser(token, id, body);
    const res = await api.admin.listUsers(token, q);
    setUsers(res.users);
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-3xl font-extrabold">Users</h2>
      <input
        className="field max-w-md"
        placeholder="Search email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-left text-[#9aa3b2]">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Events</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/5">
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.plan}</td>
                <td className="px-3 py-2">{u._count.events}</td>
                <td className="px-3 py-2">
                  <select
                    className="field py-1 text-xs"
                    value={u.plan}
                    onChange={(e) => void patchUser(u.id, { plan: e.target.value })}
                  >
                    {['free', 'pro', 'studio', 'event_pass'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminEventsPage() {
  const { token } = useAuth();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!token) return;
    void api.admin.listEvents(token, q).then((res) => setEvents(res.events));
  }, [token, q]);

  async function patchEvent(id: string, body: Record<string, unknown>) {
    if (!token) return;
    await api.admin.patchEvent(token, id, body);
    const res = await api.admin.listEvents(token, q);
    setEvents(res.events);
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-3xl font-extrabold">Events</h2>
      <input className="field max-w-md" placeholder="Search slug or name" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="space-y-2">
        {events.map((ev) => (
          <div key={ev.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display font-bold">{ev.name}</p>
                <p className="text-xs text-[#9aa3b2]">/{ev.slug} · {ev.owner.email}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => void patchEvent(ev.id, { videoEnabled: !ev.videoEnabled })}>
                  Video {ev.videoEnabled ? 'on' : 'off'}
                </button>
                <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => void patchEvent(ev.id, { grantAddOnId: 'video_event_pass' })}>
                  Grant video add-on
                </button>
                <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => void patchEvent(ev.id, { paidFeaturesUnlocked: true })}>
                  Unlock Event Pass
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminPaymentsPage() {
  const { token } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    if (!token) return;
    void api.admin.listPayments(token).then((res) => setPayments(res.payments));
  }, [token]);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-3xl font-extrabold">Payments</h2>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-left text-[#9aa3b2]">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Plan / Add-on</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="px-3 py-2">{new Date(p.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{p.user?.email || '—'}</td>
                <td className="px-3 py-2">{p.amount} {p.currency}</td>
                <td className="px-3 py-2">{p.status}</td>
                <td className="px-3 py-2">{p.planId || p.addOnId || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminAuditPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    if (!token) return;
    void api.admin.listAudit(token).then((res) => setLogs(res.logs));
  }, [token]);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-3xl font-extrabold">Audit log</h2>
      <ul className="space-y-2 text-sm">
        {logs.map((log) => (
          <li key={log.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex justify-between gap-3">
              <span className="font-semibold">{log.action}</span>
              <span className="text-[#9aa3b2]">{new Date(log.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-xs text-[#9aa3b2]">{log.admin.email}{log.target ? ` · ${log.target}` : ''}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
