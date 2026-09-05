'use client';
import {FormEvent, useEffect, useMemo, useState} from 'react';
import {AppShell} from '@/components/app-shell';
import {StatCard, Status} from '@/components/ui';
import {apiFetch} from '@/lib/api';

type UserRow = {
  UserId: string;
  Email: string;
  DisplayName: string;
  IsActive: boolean;
  IsProtected?: boolean;
  MfaEnabled: boolean;
  LastLoginAt?: string | null;
  RoleName: string;
  MembershipStatus: string;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
}
function statusOf(u: UserRow) {
  if (u.MembershipStatus === 'INVITED') return 'Invited';
  if (!u.IsActive) return 'Suspended';
  return 'Active';
}
const tone = (s: string) => (s === 'Active' ? 'green' : s === 'Invited' ? 'blue' : 'red');

export default function Users() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [u, r] = await Promise.all([
        apiFetch<{items: UserRow[]}>('/api/admin/users'),
        apiFetch<{items: Array<{Name: string}>}>('/api/admin/roles')
      ]);
      setUsers(u.items || []);
      setRoles([...new Set((r.items || []).map(x => x.Name))]);
    } catch (e) {
      setUsers([]);
      setError(e instanceof Error ? e.message : 'Unable to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const list = useMemo(
    () => users.filter(u => `${u.DisplayName} ${u.Email} ${u.RoleName}`.toLowerCase().includes(query.toLowerCase())),
    [users, query]
  );
  const active = users.filter(u => statusOf(u) === 'Active').length;
  const invited = users.filter(u => statusOf(u) === 'Invited').length;
  const mfa = users.filter(u => u.MfaEnabled).length;

  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: String(form.get('email')),
          displayName: String(form.get('displayName')),
          roleName: String(form.get('roleName')),
          requireMfa: form.get('requireMfa') === 'on'
        })
      });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Users" actions={<><button className="btn secondary" onClick={() => void load()}>Refresh</button><button className="btn primary" onClick={() => setOpen(true)}>＋ Invite user</button></>}>
      <p className="page-subtitle">Manage workspace members, access status, roles and security posture.</p>
      {error && <div className="notice red">{error}</div>}
      <div className="stats-grid four">
        <StatCard icon="♙" label="Total users" value={String(users.length)} detail="Across this workspace"/>
        <StatCard icon="✓" label="Active" value={String(active)} detail={users.length ? `${Math.round((active / users.length) * 100)}% of users` : 'No users yet'}/>
        <StatCard icon="✉" label="Invited" value={String(invited)} detail="Awaiting activation"/>
        <StatCard icon="✦" label="MFA enabled" value={String(mfa)} detail={users.length ? `${Math.round((mfa / users.length) * 100)}% coverage` : '—'}/>
      </div>
      <section className="table-card">
        <div className="table-toolbar">
          <div className="search-input">⌕<input placeholder="Search users, email or role…" value={query} onChange={e => setQuery(e.target.value)}/></div>
          <span className="table-count">{loading ? 'Loading…' : `${list.length} users`}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th/><th>User</th><th>Role</th><th>Status</th><th>MFA</th><th>Last activity</th><th/></tr></thead>
            <tbody>
              {!loading && list.length === 0 && <tr><td colSpan={7}><div className="empty-state"><h3>No users found</h3><p>Invite a member to add the first workspace user.</p></div></td></tr>}
              {list.map(u => {
                const st = statusOf(u);
                return (
                  <tr key={u.UserId}>
                    <td/>
                    <td><div className="user-cell"><div className="avatar">{initials(u.DisplayName)}</div><div><b>{u.DisplayName}{u.IsProtected ? ' · Protected' : ''}</b><span>{u.Email}</span></div></div></td>
                    <td><span className="role-badge">{u.RoleName}</span></td>
                    <td><Status tone={tone(st) as any}>{st}</Status></td>
                    <td>{u.MfaEnabled ? <span className="mfa yes">✓ Enabled</span> : <span className="mfa no">— Not enabled</span>}</td>
                    <td>{u.LastLoginAt ? new Date(u.LastLoginAt).toLocaleString() : (st === 'Invited' ? 'Invitation pending' : '—')}</td>
                    <td/>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <form onSubmit={invite}>
              <div className="drawer-head"><div><div className="eyebrow">NEW MEMBER</div><h2>Invite user</h2><p>Invite a person and define their initial workspace access.</p></div><button type="button" className="close" onClick={() => setOpen(false)}>×</button></div>
              <div className="drawer-body">
                <label>Email address<input name="email" type="email" required placeholder="name@company.com"/></label>
                <label>Display name<input name="displayName" required placeholder="Full name"/></label>
                <label>Workspace role<select name="roleName" required defaultValue={roles.find(r => r === 'Creator') || roles[0] || 'Viewer'}>{roles.map(r => <option key={r}>{r}</option>)}</select></label>
                <label className="toggle-row"><div><b>Require MFA</b><span>User must configure MFA during activation.</span></div><input name="requireMfa" type="checkbox" defaultChecked/></label>
                <div className="notice blue">ℹ Invitation is stored in the database immediately. Activation email delivery can be connected later.</div>
              </div>
              <div className="drawer-foot"><button type="button" className="btn secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Send invitation'}</button></div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
