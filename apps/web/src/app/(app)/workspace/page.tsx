'use client';
import {useEffect, useState} from 'react';
import {apiFetch} from '@/lib/api';

type Workspace = {WorkspaceId: string; Name: string; Slug: string; RoleName: string; JoinedAt: string};
type Me = {id: string; email: string; name: string};

export default function Workspace() {
  const [items, setItems] = useState<Workspace[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<{items: Workspace[]}>('/api/workspaces'),
      apiFetch<Me>('/api/auth/me')
    ]).then(([ws, user]) => {
      setItems(ws.items || []);
      setMe(user);
    }).catch(e => setError(e instanceof Error ? e.message : 'Unable to load workspaces'));
  }, []);

  async function select(workspaceId: string) {
    setBusyId(workspaceId);
    setError('');
    try {
      await apiFetch('/api/workspaces/select', {method: 'POST', body: JSON.stringify({workspaceId})});
      location.href = '/command';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to select workspace');
      setBusyId('');
    }
  }

  async function signOut() {
    try { await apiFetch('/api/auth/logout', {method: 'POST'}); } catch {}
    location.href = '/login';
  }

  return (
    <main className="workspace-page">
      <div className="workspace-header">
        <div className="auth-brand"><div className="brand-mark">CC</div><div><strong>Cacsms Cinema</strong><span>Content Operations OS</span></div></div>
        <div className="avatar">{(me?.name || '?').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()}</div>
      </div>
      <section className="workspace-content">
        <div className="eyebrow">WORKSPACE ACCESS</div>
        <h1>Choose your workspace</h1>
        <p>Select the operating environment you want to enter. Your role and permissions may differ by workspace.</p>
        {error && <div className="notice red">{error}</div>}
        <div className="workspace-list">
          {items.map((w, i) => (
            <button className="workspace-card" key={w.WorkspaceId} disabled={busyId === w.WorkspaceId} onClick={() => void select(w.WorkspaceId)}>
              <div className={`workspace-logo c${i % 3}`}>{(w.Slug || w.Name).slice(0, 3).toUpperCase()}</div>
              <div className="workspace-info">
                <div><h2>{w.Name}</h2><span>Live</span></div>
                <p>{w.RoleName}</p>
                <small>Joined {new Date(w.JoinedAt).toLocaleDateString()}</small>
              </div>
              <span className="workspace-arrow">{busyId === w.WorkspaceId ? '…' : '→'}</span>
            </button>
          ))}
          {!items.length && !error && <div className="empty-state"><h3>No workspaces</h3><p>Your account is not assigned to a workspace yet.</p></div>}
        </div>
      </section>
      <footer className="workspace-footer">Signed in as <b>{me?.email || '…'}</b> · <button className="text-action" onClick={() => void signOut()}>Sign out</button></footer>
    </main>
  );
}
