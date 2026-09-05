'use client';

import Link from 'next/link';
import {useEffect, useMemo, useState} from 'react';
import {useParams} from 'next/navigation';
import {AppShell} from '@/components/app-shell';
import {Status} from '@/components/ui';
import {apiFetch} from '@/lib/api';
import {mapProjectRow, type ContentProject} from '@/lib/module03-data';

const tone = (s: string) =>
  s === 'CONSUMED' ? 'green'
    : s === 'READY' ? 'blue'
      : s === 'REJECTED' ? 'red' : 'gray';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
}

function actorAvatar(a: any) {
  const actor = String(a.actor || a.ActorType || 'SYSTEM');
  if (actor === 'AI') return 'AI';
  if (actor === 'SYSTEM') return '⚙';
  return initials(a.name || a.ActorName || a.AgentName || 'Human');
}

export default function ProjectActivityPage() {
  const {id} = useParams<{id: string}>();
  const [project, setProject] = useState<ContentProject | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [handoffs, setHandoffs] = useState<any[]>([]);
  const [actor, setActor] = useState('ALL');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setItems([]);
    setHandoffs([]);
    setProject(null);

    const load = async () => {
      try {
        const [activity, handoffRes] = await Promise.all([
          apiFetch<{items?: any[]}>(`/api/projects/${id}/activity`),
          apiFetch<{items?: any[]}>(`/api/projects/${id}/handoffs`)
        ]);
        if (cancelled) return;
        setItems(activity.items || []);
        setHandoffs(handoffRes.items || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load activity history');
      } finally {
        if (!cancelled) setLoading(false);
      }

      try {
        const detail = await apiFetch<{project: any}>(`/api/projects/${id}`);
        if (!cancelled) setProject(mapProjectRow(detail.project));
      } catch {
        /* eyebrow falls back to … */
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id]);

  const filtered = useMemo(
    () => items.filter(a =>
      (actor === 'ALL' || String(a.actor || a.ActorType) === actor)
      && (!search || `${a.title || a.Title} ${a.detail || a.Details} ${a.stage || a.StageKey}`.toLowerCase().includes(search.toLowerCase()))
    ),
    [items, actor, search]
  );

  const counts = {
    human: items.filter(x => (x.actor || x.ActorType) === 'HUMAN').length,
    ai: items.filter(x => (x.actor || x.ActorType) === 'AI').length,
    system: items.filter(x => (x.actor || x.ActorType) === 'SYSTEM').length,
    handoff: handoffs.length
  };

  return (
    <AppShell
      eyebrow={`PROJECTS / ${project?.code || '…'}`}
      title="Activity & History"
      actions={
        <>
          <Link href={`/projects/${id}`} className="btn secondary link-btn">← Project workspace</Link>
          <button className="btn secondary">⇩ Export audit history</button>
        </>
      }
    >
      {error && <div className="notice red">{error}</div>}

      <div className="history-summary">
        <div><span>Human actions</span><b>{counts.human}</b></div>
        <div><span>AI actions</span><b>{counts.ai}</b></div>
        <div><span>System events</span><b>{counts.system}</b></div>
        <div><span>Stage handoffs</span><b>{counts.handoff}</b></div>
      </div>

      <div className="history-grid">
        <section className="workspace-card">
          <div className="workspace-card-head">
            <div>
              <h2>Complete activity history</h2>
              <p>Immutable project events from human operators, AI agents and the workflow engine.</p>
            </div>
          </div>
          <div className="workspace-toolbar">
            <div className="project-search">
              ⌕
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activity…" />
            </div>
            <select value={actor} onChange={e => setActor(e.target.value)}>
              <option value="ALL">All actors</option>
              <option value="HUMAN">Human</option>
              <option value="AI">AI agents</option>
              <option value="SYSTEM">System</option>
            </select>
            <select><option>All workflow stages</option></select>
          </div>

          {!loading && !error && filtered.length === 0 && (
            <div className="empty-state">
              <h3>No activity yet</h3>
              <p>
                {items.length === 0
                  ? 'Human, AI and system events for this project will appear here.'
                  : 'No activity matches the current filters.'}
              </p>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="activity-timeline full-history">
              {filtered.map((a: any, i) => (
                <div className="activity-item" key={a.id || a.ProjectActivityId || i}>
                  <span className={`activity-avatar ${String(a.actor || a.ActorType).toLowerCase()}`}>
                    {actorAvatar(a)}
                  </span>
                  <div>
                    <div>
                      <b>{a.title || a.Title}</b>
                      <span>{a.time || fmt(a.CreatedAt)}</span>
                    </div>
                    <p>{a.detail || a.Details}</p>
                    <small>
                      {a.name || a.ActorName || a.AgentName || 'System'} · {a.stage || a.StageKey || 'Project'} · {a.actor || a.ActorType}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="history-aside">
          <section className="workspace-card">
            <div className="workspace-card-head">
              <div>
                <h2>Data handoff ledger</h2>
                <p>Outputs transferred between production stages.</p>
              </div>
            </div>
            {handoffs.length === 0
              ? <div className="empty-state"><p>No stage handoffs recorded yet.</p></div>
              : (
                <div className="handoff-ledger">
                  {handoffs.map((h: any, i) => (
                    <div key={h.ProjectHandoffId || i}>
                      <span className="handoff-ledger-index">{i + 1}</span>
                      <div>
                        <b>{h.output || h.OutputType}</b>
                        <small>{h.from || h.FromStageKey} → {h.to || h.ToStageKey}</small>
                      </div>
                      <Status tone={tone(h.status || h.Status) as any}>
                        {String(h.status || h.Status || 'WAITING').replaceAll('_', ' ')}
                      </Status>
                    </div>
                  ))}
                </div>
              )}
          </section>
          <section className="workspace-card audit-assurance">
            <span>AUDIT ASSURANCE</span>
            <h3>Project lineage is enabled</h3>
            <p>Content changes, workflow controls, approval decisions, versions and handoffs are recorded against the master project.</p>
            <ul>
              <li>✓ Human actions attributed to a user</li>
              <li>✓ AI actions attributed to an agent</li>
              <li>✓ System transitions timestamped</li>
              <li>✓ Stage outputs versionable</li>
            </ul>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function fmt(v: any) {
  if (!v) return '—';
  try { return new Date(v).toLocaleString(); } catch { return String(v); }
}
