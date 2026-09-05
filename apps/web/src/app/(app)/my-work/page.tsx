'use client';
import {useEffect, useMemo, useState} from 'react';
import {AppShell} from '@/components/app-shell';
import {Status} from '@/components/ui';
import {apiFetch} from '@/lib/api';

type Task = {id: string; title: string; project: string; projectTitle: string; type: string; priority: string; status: string; due: string; stage: string};

export default function MyWork() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<any>('/api/my-work').then(d => {
      setTasks((d.items || []).map((r: any) => ({
        id: r.WorkItemId, title: r.Title, project: r.ContentCode || 'Workspace', projectTitle: r.WorkingTitle || '',
        type: r.WorkType, priority: r.Priority, status: r.Status,
        due: r.DueAt ? new Date(r.DueAt).toLocaleString() : 'No due date', stage: r.StageKey || 'General'
      })));
    }).catch(e => setError(e instanceof Error ? e.message : 'Unable to load work items'));
  }, []);

  const visible = useMemo(() => filter === 'ALL' ? tasks : tasks.filter(t => t.status === filter), [tasks, filter]);
  const complete = (id: string) => {
    setTasks(x => x.map(t => t.id === id ? {...t, status: 'COMPLETED', due: 'Completed'} : t));
    apiFetch(`/api/my-work/${id}`, {method: 'PATCH', body: JSON.stringify({status: 'COMPLETED'})}).catch(() => {});
  };

  return (
    <AppShell eyebrow="COMMAND" title="My Work">
      <p className="page-subtitle">Work items assigned to you from the database.</p>
      {error && <div className="notice red">{error}</div>}
      <div className="work-summary">
        <div><span>Open</span><b>{tasks.filter(t => t.status === 'OPEN').length}</b></div>
        <div><span>In progress</span><b>{tasks.filter(t => t.status === 'IN_PROGRESS').length}</b></div>
        <div><span>Waiting</span><b>{tasks.filter(t => t.status === 'WAITING').length}</b></div>
        <div><span>Completed</span><b>{tasks.filter(t => t.status === 'COMPLETED').length}</b></div>
      </div>
      <section className="command-card work-board">
        <div className="work-toolbar">
          <div className="segmented">{['ALL', 'OPEN', 'IN_PROGRESS', 'WAITING', 'COMPLETED'].map(f => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f.replace('_', ' ')}</button>)}</div>
        </div>
        <div className="work-table">
          <div className="work-table-head"><span>Work item</span><span>Project / stage</span><span>Priority</span><span>Status</span><span>Due</span><span/></div>
          {visible.map(t => (
            <div className="work-table-row" key={t.id}>
              <div><span className={`work-type-icon ${(t.type || 'task').toLowerCase()}`}>{(t.type || 'T').slice(0, 1)}</span><div><b>{t.title}</b><small>{t.type} · Assigned to you</small></div></div>
              <div><b>{t.project}</b><small>{t.stage}</small></div>
              <Status tone={t.priority === 'URGENT' ? 'red' : t.priority === 'HIGH' ? 'amber' : 'gray'}>{t.priority}</Status>
              <Status tone={t.status === 'COMPLETED' ? 'green' : t.status === 'IN_PROGRESS' ? 'amber' : t.status === 'WAITING' ? 'blue' : 'gray'}>{t.status.replace('_', ' ')}</Status>
              <span className="due-text">{t.due}</span>
              <div className="row-actions">{t.status !== 'COMPLETED' && <button onClick={() => complete(t.id)}>✓ Complete</button>}</div>
            </div>
          ))}
          {!visible.length && <div className="empty-state"><h3>Nothing here</h3><p>No work items match this filter.</p></div>}
        </div>
      </section>
    </AppShell>
  );
}
