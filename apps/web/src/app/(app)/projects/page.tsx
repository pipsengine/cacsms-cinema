'use client';

import Link from 'next/link';
import {useEffect, useMemo, useState} from 'react';
import {AppShell} from '@/components/app-shell';
import {Status} from '@/components/ui';
import {apiFetch} from '@/lib/api';
import {mapProjectRow, type ContentProject} from '@/lib/module03-data';

const tone = (s: string) =>
  s === 'COMPLETED' ? 'green'
    : s === 'IN_PROGRESS' ? 'amber'
      : s === 'AWAITING_APPROVAL' ? 'blue'
        : s === 'BLOCKED' || s === 'FAILED' ? 'red'
          : s === 'PAUSED' ? 'purple' : 'gray';

const label = (s: string) => s.replaceAll('_', ' ').replace(/\b\w/g, m => m.toUpperCase());

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
}

export default function ProjectsPage() {
  const [items, setItems] = useState<ContentProject[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [platform, setPlatform] = useState('ALL');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    apiFetch<{items?: any[]}>('/api/projects?limit=100')
      .then(r => setItems((r.items || []).map(mapProjectRow)))
      .catch(e => setError(e instanceof Error ? e.message : 'Unable to load projects'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => items.filter(p =>
      (!search || `${p.code} ${p.title} ${p.category}`.toLowerCase().includes(search.toLowerCase()))
      && (status === 'ALL' || p.status === status)
      && (platform === 'ALL' || p.platform === platform)
    ),
    [items, search, status, platform]
  );

  const counts = {
    all: items.length,
    active: items.filter(x => ['IN_PROGRESS', 'PAUSED', 'AWAITING_APPROVAL'].includes(x.status)).length,
    approval: items.filter(x => x.status === 'AWAITING_APPROVAL').length,
    exceptions: items.filter(x => ['BLOCKED', 'FAILED'].includes(x.status)).length
  };

  return (
    <AppShell
      eyebrow="CONTENT OPERATIONS"
      title="Content Projects"
      actions={
        <>
          <button className="btn secondary">⇩ Export</button>
          <Link className="btn primary link-btn" href="/projects/new">＋ Create project</Link>
        </>
      }
    >
      <p className="page-subtitle">
        The governed master record for every film, documentary, short, campaign and platform variant produced by Cacsms Cinema.
      </p>

      {error && <div className="notice red">{error}</div>}

      <div className="project-kpis">
        <ProjectKpi label="All projects" value={counts.all} note="Active workspace" />
        <ProjectKpi label="In production" value={counts.active} note="Running or paused" />
        <ProjectKpi label="Awaiting approval" value={counts.approval} note="Human gate" tone="blue" />
        <ProjectKpi label="Exceptions" value={counts.exceptions} note="Blocked or failed" tone="red" />
      </div>

      <section className="projects-panel">
        <div className="projects-toolbar">
          <div className="project-search">
            ⌕
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search project ID, title or category…"
            />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="NOT_STARTED">Not Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="AWAITING_APPROVAL">Awaiting Approval</option>
            <option value="PAUSED">Paused</option>
            <option value="BLOCKED">Blocked</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <select value={platform} onChange={e => setPlatform(e.target.value)}>
            <option value="ALL">All platforms</option>
            <option>YouTube</option>
            <option>YouTube Shorts</option>
            <option>TikTok</option>
            <option>Instagram</option>
            <option>Facebook</option>
          </select>
          <button className="filter-btn">☷ More filters</button>
          <div className="view-toggle">
            <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>☷</button>
            <button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}>▦</button>
          </div>
        </div>

        <div className="projects-resultbar">
          <span><b>{filtered.length}</b> projects</span>
          <span>Sorted by priority & recent activity</span>
        </div>

        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">
            <h3>No content projects</h3>
            <p>
              {items.length === 0
                ? 'Create a project to initialize the 22-stage production workflow.'
                : 'No projects match the current filters.'}
            </p>
            {items.length === 0 && (
              <Link className="btn primary link-btn" href="/projects/new">＋ Create project</Link>
            )}
          </div>
        )}

        {view === 'table' && filtered.length > 0 && (
          <div className="projects-table">
            <div className="projects-th">
              <span>Project</span>
              <span>Workflow</span>
              <span>Owner</span>
              <span>Priority</span>
              <span>Deadline</span>
              <span>Status</span>
              <span />
            </div>
            {filtered.map(p => <ProjectTableRow key={p.id} p={p} />)}
          </div>
        )}

        {view === 'cards' && filtered.length > 0 && (
          <div className="project-card-grid">
            {filtered.map(p => <ProjectCard key={p.id} p={p} />)}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function ProjectKpi({label, value, note, tone}: {label: string; value: number; note: string; tone?: string}) {
  return (
    <article className={`project-kpi ${tone || ''}`}>
      <div><span>{label}</span><b>{value}</b></div>
      <small>{note}</small>
    </article>
  );
}

function ProjectTableRow({p}: {p: ContentProject}) {
  return (
    <div className="projects-tr">
      <div className="project-cell">
        <Link href={`/projects/${p.id}`} className="project-code">{p.code}</Link>
        <Link href={`/projects/${p.id}`} className="project-title-link">{p.title}</Link>
        <div>
          <span>{p.platform}</span><i /> <span>{p.type}</span><i /><span>{p.category}</span>
        </div>
      </div>
      <div className="workflow-cell">
        <b>{p.stage}</b>
        <div>
          <span className="progress-track"><i style={{width: `${p.progress}%`}} /></span>
          <strong>{p.progress}%</strong>
        </div>
        <small>{p.completed}/{p.total} stages complete</small>
      </div>
      <div className="owner-cell">
        <span className="avatar tiny">{initials(p.owner)}</span>
        <div>
          <b>{p.owner}</b>
          <small>{label(p.mode)}</small>
        </div>
      </div>
      <span className={`priority-chip ${p.priority.toLowerCase()}`}>{p.priority}</span>
      <div className="deadline-cell">
        <b>{p.deadline}</b>
        <small>{p.updated}</small>
      </div>
      <Status tone={tone(p.status) as any}>{label(p.status)}</Status>
      <Link href={`/projects/${p.id}`} className="row-open">›</Link>
    </div>
  );
}

function ProjectCard({p}: {p: ContentProject}) {
  return (
    <Link href={`/projects/${p.id}`} className="project-tile">
      <div className="project-tile-top">
        <span className="project-code">{p.code}</span>
        <Status tone={tone(p.status) as any}>{label(p.status)}</Status>
      </div>
      <h3>{p.title}</h3>
      <p>{p.description}</p>
      <div className="tile-tags">
        <span>{p.platform}</span>
        <span>{p.type}</span>
        <span>{p.aspectRatio}</span>
      </div>
      <div className="tile-stage">
        <span>Current stage</span>
        <b>{p.stage}</b>
        <div className="progress-track"><i style={{width: `${p.progress}%`}} /></div>
        <small>{p.progress}% · {p.completed}/{p.total} stages</small>
      </div>
      <div className="tile-foot">
        <span className="avatar tiny">{initials(p.owner)}</span>
        <b>{p.owner}</b>
        <span className={`priority-chip ${p.priority.toLowerCase()}`}>{p.priority}</span>
        <small>{p.deadline}</small>
      </div>
    </Link>
  );
}
