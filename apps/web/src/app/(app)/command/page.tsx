'use client';
import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {AppShell} from '@/components/app-shell';
import {Status} from '@/components/ui';
import {apiFetch} from '@/lib/api';
import {stages, type DemoProject, type ProjectStatus} from '@/lib/module02-data';

const statusLabel: Record<ProjectStatus, string> = {NOT_STARTED: 'Not Started', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed', AWAITING_APPROVAL: 'Awaiting Approval', PAUSED: 'Paused', BLOCKED: 'Blocked', FAILED: 'Failed'};
const tone = (s: string) => s === 'COMPLETED' ? 'green' : s === 'IN_PROGRESS' ? 'amber' : s === 'AWAITING_APPROVAL' ? 'blue' : s === 'BLOCKED' || s === 'FAILED' ? 'red' : s === 'PAUSED' ? 'purple' : 'gray';

type Task = {id: string; title: string; project: string; stage: string; priority: string; due: string};
type Note = {id: string; severity: string; title: string; message: string; time: string; read: boolean};
type Agent = {key: string; name: string; project: string; stage: string; status: string; progress: number};
type Slot = {code: string; title: string; platform: string; time: string; status: string};

export default function CommandCenter() {
  const [projects, setProjects] = useState<DemoProject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [schedule, setSchedule] = useState<Slot[]>([]);
  const [usage, setUsage] = useState({GenerationsToday: 0, MonthCost: 0});
  const [selected, setSelected] = useState<DemoProject | null>(null);
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<any>('/api/command-center').then(d => {
      setProjects((d.projects || []).map((r: any) => ({
        id: r.ContentProjectId,
        code: r.ContentCode,
        title: r.WorkingTitle,
        status: r.Status,
        mode: String(r.AutonomyMode || 'AI_ASSISTED').replaceAll('_', ' '),
        progress: Number(r.ProgressPercent || 0),
        completed: Number(r.CompletedStages || 0),
        total: Number(r.TotalStages || 22),
        stage: r.CurrentStageName || 'Waiting to start',
        updated: r.UpdatedAt ? new Date(r.UpdatedAt).toLocaleString() : '—',
        owner: 'Workspace',
        platform: '—',
        deadline: '—'
      } as DemoProject)));
      setTasks((d.tasks || []).map((r: any) => ({
        id: r.WorkItemId, title: r.Title, project: r.ContentCode || 'Workspace', stage: r.StageKey || 'General',
        priority: r.Priority, due: r.DueAt ? new Date(r.DueAt).toLocaleString() : 'No due date'
      })));
      setNotes((d.notifications || []).map((r: any) => ({
        id: r.NotificationId, severity: r.Severity, title: r.Title, message: r.Message,
        time: new Date(r.CreatedAt).toLocaleString(), read: Boolean(r.IsRead)
      })));
      setAgents((d.agents || []).map((r: any) => ({
        key: r.AgentKey, name: r.AgentName, project: r.ContentCode || '—', stage: r.StageKey || '—',
        status: r.Status, progress: Number(r.ProgressPercent || 0)
      })));
      setSchedule((d.schedule || []).map((r: any) => ({
        code: r.ContentCode, title: r.WorkingTitle, platform: r.Platform,
        time: new Date(r.ScheduledAt).toLocaleString(), status: r.Status
      })));
      setUsage({GenerationsToday: Number(d.usage?.GenerationsToday || 0), MonthCost: Number(d.usage?.MonthCost || 0)});
    }).catch(e => setError(e instanceof Error ? e.message : 'Unable to load command center'));
  }, []);

  const summary = useMemo(() => ({
    total: projects.length,
    active: projects.filter(p => ['IN_PROGRESS', 'AWAITING_APPROVAL', 'PAUSED'].includes(p.status)).length,
    approval: projects.filter(p => p.status === 'AWAITING_APPROVAL').length,
    exceptions: projects.filter(p => ['BLOCKED', 'FAILED'].includes(p.status)).length
  }), [projects]);

  const control = (id: string, action: 'START' | 'PAUSE' | 'RESUME' | 'STOP') => {
    setProjects(ps => ps.map(p => {
      if (p.id !== id) return p;
      const status: ProjectStatus = action === 'PAUSE' ? 'PAUSED' : action === 'STOP' ? 'NOT_STARTED' : 'IN_PROGRESS';
      const updated = {...p, status, stage: action === 'STOP' ? 'Stopped — ready to restart' : p.stage, updated: 'just now'};
      if (selected?.id === id) setSelected(updated);
      return updated;
    }));
    apiFetch(`/api/command-center/projects/${id}/control`, {method: 'POST', body: JSON.stringify({action})}).catch(() => {});
  };

  return (
    <AppShell eyebrow="COMMAND" title="Command Center">
      <div className="command-title-row"><p className="page-subtitle">Live operating view from Microsoft SQL Server.</p><div className="live-indicator"><i/> LIVE</div></div>
      {error && <div className="notice red">{error}</div>}
      <section className="command-kpis">
        <Kpi icon="▤" label="Content projects" value={summary.total} meta="In this workspace"/>
        <Kpi icon="▶" label="Active production" value={summary.active} meta="In progress / paused / approval"/>
        <Kpi icon="✓" label="Awaiting approval" value={summary.approval} meta="Human action required" alert={summary.approval > 0}/>
        <Kpi icon="!" label="Exceptions" value={summary.exceptions} meta="Blocked or failed" alert={summary.exceptions > 0}/>
        <Kpi icon="✦" label="Generations today" value={usage.GenerationsToday} meta={`Month est. $${usage.MonthCost.toFixed(2)}`}/>
        <Kpi icon="▣" label="Scheduled" value={schedule.length} meta="Upcoming publish slots"/>
      </section>
      <div className="command-grid wide-left">
        <section className="command-card production-board">
          <CardHead title="Production pipeline" subtitle="Projects from the database" action={<div className="segmented"><button className={view === 'pipeline' ? 'active' : ''} onClick={() => setView('pipeline')}>Pipeline</button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button></div>}/>
          <div className="project-stack">
            {projects.map(p => <ProjectRow key={p.id} p={p} onOpen={() => setSelected(p)} onControl={control}/>)}
            {!projects.length && <div className="empty-state"><h3>No content projects</h3><p>Projects created in this workspace will appear here.</p></div>}
          </div>
        </section>
        <section className="command-card">
          <CardHead title="My work" subtitle="Open items assigned to you"/>
          <div className="task-list">
            {tasks.map(t => <div className="task-row" key={t.id}><span className={`priority-mark ${(t.priority || 'LOW').toLowerCase()}`}/><div className="task-main"><b>{t.title}</b><span>{t.project} · {t.stage}</span></div><Status tone={t.priority === 'URGENT' ? 'red' : t.priority === 'HIGH' ? 'amber' : 'gray'}>{t.priority}</Status><small>{t.due}</small></div>)}
            {!tasks.length && <div className="empty-state"><p>No open work items.</p></div>}
          </div>
        </section>
      </div>
      <div className="command-grid thirds">
        <section className="command-card">
          <CardHead title="AI agent activity" subtitle="Agent runs from the database"/>
          <div className="agent-list">
            {agents.map(a => <div className="agent-row" key={a.key + a.status}><div className="agent-orb">AI</div><div><b>{a.name}</b><span>{a.project} · {a.stage}</span></div><div className="agent-status"><Status tone={a.status === 'RUNNING' ? 'purple' : a.status === 'FAILED' ? 'red' : a.status === 'WAITING' ? 'amber' : 'green'}>{a.status}</Status>{a.status === 'RUNNING' && <small>{a.progress}%</small>}</div></div>)}
            {!agents.length && <div className="empty-state"><p>No agent runs yet.</p></div>}
          </div>
        </section>
        <section className="command-card">
          <CardHead title="Notifications" subtitle="Unread and recent alerts"/>
          <div className="notification-mini-list">
            {notes.map(n => <div className={`notification-mini ${!n.read ? 'unread' : ''}`} key={n.id}><span className={`notification-symbol ${n.severity.toLowerCase()}`}>{n.severity === 'CRITICAL' ? '!' : n.severity === 'SUCCESS' ? '✓' : 'i'}</span><div><b>{n.title}</b><p>{n.message}</p><small>{n.time}</small></div></div>)}
            {!notes.length && <div className="empty-state"><p>No notifications.</p></div>}
          </div>
        </section>
        <section className="command-card">
          <CardHead title="Publishing schedule" subtitle="Scheduled releases"/>
          <div className="schedule-list">
            {schedule.map(s => <div className="schedule-row" key={s.code + s.time}><div className="date-tile"><b>{s.time}</b></div><div><span className="platform-tag">{s.platform}</span><b>{s.title}</b><small>{s.code}</small></div><Status>{s.status}</Status></div>)}
            {!schedule.length && <div className="empty-state"><p>No scheduled publishes.</p></div>}
          </div>
        </section>
      </div>
      {selected && <ProjectDrawer project={selected} onClose={() => setSelected(null)} onControl={control}/>}
    </AppShell>
  );
}

function Kpi({icon, label, value, meta, alert}: {icon: string; label: string; value: string | number; meta: string; alert?: boolean}) {
  return <article className={`command-kpi ${alert ? 'attention' : ''}`}><div className="kpi-top"><span className="kpi-icon">{icon}</span>{alert && <span className="alert-dot"/>}</div><strong>{value}</strong><b>{label}</b><span>{meta}</span></article>;
}
function CardHead({title, subtitle, action}: {title: string; subtitle?: string; action?: ReactNode}) {
  return <div className="command-card-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
function ProjectRow({p, onOpen, onControl}: {p: DemoProject; onOpen: () => void; onControl: (id: string, a: any) => void}) {
  return <article className="project-row"><button className="project-main-click" onClick={onOpen}><div className="project-id-line"><b>{p.code}</b><span>{p.mode}</span></div><h3>{p.title}</h3><div className="project-progress-line"><div className="progress-track"><i style={{width: `${p.progress}%`}}/></div><b>{p.progress}%</b><span>{p.completed}/{p.total} stages</span></div></button><div className="project-stage"><span>Current stage</span><b>{p.stage}</b><small>Updated {p.updated}</small></div><div className="project-state"><Status tone={tone(p.status) as any}>{statusLabel[p.status]}</Status><div className="project-controls">{p.status === 'NOT_STARTED' && <button onClick={() => onControl(p.id, 'START')} title="Start">▶</button>}{p.status === 'IN_PROGRESS' && <button onClick={() => onControl(p.id, 'PAUSE')} title="Pause">Ⅱ</button>}{p.status === 'PAUSED' && <button onClick={() => onControl(p.id, 'RESUME')} title="Resume">▶</button>}{['IN_PROGRESS', 'PAUSED', 'AWAITING_APPROVAL'].includes(p.status) && <button className="danger" onClick={() => onControl(p.id, 'STOP')} title="Stop">■</button>}<button onClick={onOpen} title="Open workflow">›</button></div></div></article>;
}
function ProjectDrawer({project, onClose, onControl}: {project: DemoProject; onClose: () => void; onControl: (id: string, a: any) => void}) {
  return <div className="modal-backdrop" onClick={onClose}><aside className="project-drawer" onClick={e => e.stopPropagation()}><div className="drawer-head"><div><div className="eyebrow">{project.code}</div><h2>{project.title}</h2><p>{project.mode}</p></div><button className="close" onClick={onClose}>×</button></div><div className="project-drawer-summary"><div><span>Overall progress</span><strong>{project.progress}%</strong></div><div className="progress-track large"><i style={{width: `${project.progress}%`}}/></div></div><div className="drawer-control-bar"><Status tone={tone(project.status) as any}>{statusLabel[project.status]}</Status><div>{project.status === 'NOT_STARTED' && <button className="btn primary small" onClick={() => onControl(project.id, 'START')}>▶ Start</button>}{project.status === 'IN_PROGRESS' && <button className="btn secondary small" onClick={() => onControl(project.id, 'PAUSE')}>Ⅱ Pause</button>}{project.status === 'PAUSED' && <button className="btn primary small" onClick={() => onControl(project.id, 'RESUME')}>▶ Resume</button>}{['IN_PROGRESS', 'PAUSED', 'AWAITING_APPROVAL'].includes(project.status) && <button className="btn danger-btn small" onClick={() => onControl(project.id, 'STOP')}>■ Stop</button>}</div></div><div className="stage-timeline">{stages.map((s, i) => {const st = i < project.completed ? 'COMPLETED' : i === project.completed && project.status !== 'COMPLETED' ? project.status : 'NOT_STARTED'; return <div className={`stage-line ${st.toLowerCase()}`} key={s}><span className="stage-number">{String(i + 1).padStart(2, '0')}</span><div><b>{s}</b></div><Status tone={tone(st) as any}>{statusLabel[st as ProjectStatus] || st.replaceAll('_', ' ')}</Status></div>;})}</div></aside></div>;
}
