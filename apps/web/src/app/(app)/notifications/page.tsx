'use client';
import {useEffect, useMemo, useState} from 'react';
import {AppShell} from '@/components/app-shell';
import {apiFetch} from '@/lib/api';

type Note = {id: string; severity: string; category: string; title: string; message: string; time: string; read: boolean; action: string};

export default function Notifications() {
  const [items, setItems] = useState<Note[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<any>('/api/notifications').then(d => {
      setItems((d.items || []).map((r: any) => ({
        id: r.NotificationId, severity: r.Severity, category: r.Category, title: r.Title, message: r.Message,
        time: new Date(r.CreatedAt).toLocaleString(), read: Boolean(r.IsRead), action: 'Open'
      })));
    }).catch(e => setError(e instanceof Error ? e.message : 'Unable to load notifications'));
  }, []);

  const visible = useMemo(
    () => items.filter(n => filter === 'ALL' || (filter === 'UNREAD' && !n.read) || n.category.toUpperCase() === filter),
    [items, filter]
  );

  const markAll = () => {
    setItems(x => x.map(n => ({...n, read: true})));
    for (const n of items.filter(i => !i.read)) {
      apiFetch(`/api/notifications/${n.id}`, {method: 'PATCH', body: JSON.stringify({read: true})}).catch(() => {});
    }
  };

  return (
    <AppShell eyebrow="COMMAND" title="Notifications" actions={<button className="btn secondary" onClick={markAll}>✓ Mark all as read</button>}>
      <p className="page-subtitle">Notifications stored for your account in the database.</p>
      {error && <div className="notice red">{error}</div>}
      <section className="notification-center">
        <aside className="notification-filters">
          <b>Inbox</b>
          {['ALL', 'UNREAD', 'WORKFLOW', 'APPROVAL', 'GENERATION', 'PUBLISHING', 'SECURITY'].map(f => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              <span>{f === 'ALL' ? 'All notifications' : f[0] + f.slice(1).toLowerCase()}</span>
              {f === 'UNREAD' && <em>{items.filter(n => !n.read).length}</em>}
            </button>
          ))}
        </aside>
        <div className="notification-feed">
          <div className="notification-feed-head"><div><b>{filter === 'ALL' ? 'All notifications' : filter}</b><span>{visible.length} events</span></div></div>
          {visible.map(n => (
            <article className={`notification-full ${!n.read ? 'unread' : ''}`} key={n.id}>
              <button className={`notification-symbol ${n.severity.toLowerCase()}`}>{n.severity === 'CRITICAL' ? '!' : n.severity === 'SUCCESS' ? '✓' : 'i'}</button>
              <div>
                <div className="notification-title-line"><b>{n.title}</b><span>{n.category}</span>{!n.read && <i/>}</div>
                <p>{n.message}</p>
                <small>{n.time}</small>
                <div className="notification-actions">
                  <button className="muted-action" onClick={() => {
                    setItems(x => x.map(v => v.id === n.id ? {...v, read: !v.read} : v));
                    apiFetch(`/api/notifications/${n.id}`, {method: 'PATCH', body: JSON.stringify({read: !n.read})}).catch(() => {});
                  }}>{n.read ? 'Mark unread' : 'Mark read'}</button>
                </div>
              </div>
            </article>
          ))}
          {visible.length === 0 && <div className="empty-state"><div>✓</div><h3>Nothing here</h3><p>No notifications match this view.</p></div>}
        </div>
      </section>
    </AppShell>
  );
}
