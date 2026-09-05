'use client';
import {useEffect, useMemo, useState} from 'react';
import {AppShell} from '@/components/app-shell';
import {apiFetch} from '@/lib/api';

type RoleRow = {RoleId: string; Name: string; Description: string; IsSystemRole: boolean; PermissionKey: string; PermissionName: string; IsGranted: number};

export default function Roles() {
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [selectedName, setSelectedName] = useState('');
  const [error, setError] = useState('');
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([
      apiFetch<{items: RoleRow[]}>('/api/admin/roles'),
      apiFetch<{items: Array<{RoleName: string}>}>('/api/admin/users').catch(() => ({items: []}))
    ]).then(([roles, users]) => {
      setRows(roles.items || []);
      const counts: Record<string, number> = {};
      for (const u of users.items || []) counts[u.RoleName] = (counts[u.RoleName] || 0) + 1;
      setUserCounts(counts);
      const first = roles.items?.[0]?.Name;
      if (first) setSelectedName(first);
    }).catch(e => setError(e instanceof Error ? e.message : 'Unable to load roles'));
  }, []);

  const roleNames = useMemo(() => [...new Set(rows.map(r => r.Name))], [rows]);
  const selectedRows = rows.filter(r => r.Name === selectedName);
  const selected = selectedRows[0];
  const granted = selectedRows.filter(r => r.IsGranted).map(r => r.PermissionKey);

  return (
    <AppShell title="Roles & Permissions">
      <p className="page-subtitle">Define what each role can see, create, approve and administer within the workspace.</p>
      {error && <div className="notice red">{error}</div>}
      <div className="roles-layout">
        <section className="role-list">
          <div className="role-list-head"><b>Workspace roles</b><span>{roleNames.length} roles</span></div>
          {roleNames.map(name => {
            const meta = rows.find(r => r.Name === name)!;
            return (
              <button className={selectedName === name ? 'role-item selected' : 'role-item'} onClick={() => setSelectedName(name)} key={name}>
                <div className="role-icon">{name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div><b>{name}</b>{meta.IsSystemRole ? <span>System</span> : null}</div>
                  <p>{meta.Description}</p>
                  <small>{userCounts[name] || 0} assigned user{(userCounts[name] || 0) === 1 ? '' : 's'}</small>
                </div>
                <span>›</span>
              </button>
            );
          })}
          {!roleNames.length && <div className="empty-state"><h3>No roles</h3><p>Run database seed to create system roles.</p></div>}
        </section>
        {selected && (
          <section className="permission-panel">
            <div className="permission-head"><div><div className="eyebrow">ROLE CONFIGURATION</div><h2>{selected.Name}</h2><p>{selected.Description}</p></div></div>
            <div className="permission-summary">
              <div><span>Assigned users</span><b>{userCounts[selected.Name] || 0}</b></div>
              <div><span>Granted permissions</span><b>{granted.length}</b></div>
              <div><span>Role type</span><b>{selected.IsSystemRole ? 'System' : 'Custom'}</b></div>
            </div>
            <div className="permission-groups">
              <h3>Permission matrix</h3>
              <p>Permissions loaded from the database for this workspace role.</p>
              <div className="perm-table">
                {selectedRows.map(p => (
                  <label className="perm-row" key={p.PermissionKey}>
                    <div><b>{p.PermissionName}</b><span>{p.PermissionKey}</span></div>
                    <input type="checkbox" checked={Boolean(p.IsGranted)} readOnly disabled/>
                  </label>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
