'use client';

import Link from 'next/link';
import {useEffect, useMemo, useState} from 'react';
import {useParams} from 'next/navigation';
import {AppShell} from '@/components/app-shell';
import {Status} from '@/components/ui';
import {apiFetch} from '@/lib/api';
import {mapProjectRow, type ContentProject} from '@/lib/module03-data';
import {stages, type ProjectStatus} from '@/lib/module02-data';

const tabs = ['Overview', 'Workflow', 'Assets', 'Versions', 'Approvals', 'Activity'] as const;
type Tab = typeof tabs[number];

const tone = (s: string) =>
  s === 'COMPLETED' || s === 'APPROVED' || s === 'CONSUMED' ? 'green'
    : s === 'IN_PROGRESS' ? 'amber'
      : s === 'AWAITING_APPROVAL' || s === 'PENDING' ? 'blue'
        : s === 'BLOCKED' || s === 'FAILED' || s === 'REJECTED' ? 'red'
          : s === 'PAUSED' ? 'purple' : 'gray';

const label = (s: string) => String(s).replaceAll('_', ' ').replace(/\b\w/g, m => m.toUpperCase());

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
}

function actorAvatar(a: any) {
  const actor = String(a.actor || a.ActorType || 'SYSTEM');
  if (actor === 'AI') return 'AI';
  if (actor === 'SYSTEM') return '⚙';
  return initials(a.name || a.ActorName || a.AgentName || 'Human');
}

const phaseFor = (i: number) =>
  i < 5 ? 'Strategy'
    : i < 9 ? 'Pre-Production'
      : i < 13 ? 'Production'
        : i < 15 ? 'Post-Production'
          : i < 18 ? 'Packaging' : 'Release & Growth';

export default function ProjectWorkspace() {
  const params = useParams<{id: string}>();
  const [tab, setTab] = useState<Tab>('Overview');
  const [project, setProject] = useState<ContentProject | null>(null);
  const [stageRows, setStageRows] = useState<any[]>([]);
  const [liveAssets, setAssets] = useState<any[]>([]);
  const [liveVersions, setVersions] = useState<any[]>([]);
  const [liveApprovals, setApprovals] = useState<any[]>([]);
  const [liveActivity, setActivity] = useState<any[]>([]);
  const [handoffs, setHandoffs] = useState<any[]>([]);
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setProject(null);
    setStageRows([]);
    setAssets([]);
    setVersions([]);
    setApprovals([]);
    setActivity([]);
    setHandoffs([]);

    const load = async () => {
      try {
        const detail = await apiFetch<{project: any}>(`/api/projects/${params.id}`);
        if (cancelled) return;
        setProject(mapProjectRow(detail.project));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load project');
      } finally {
        if (!cancelled) setLoading(false);
      }

      const side = [
        apiFetch<any>(`/api/command-center/projects/${params.id}/stages`).then(r => { if (!cancelled) setStageRows(r.items || []); }),
        apiFetch<any>(`/api/projects/${params.id}/assets`).then(r => { if (!cancelled) setAssets(r.items || []); }),
        apiFetch<any>(`/api/projects/${params.id}/versions`).then(r => { if (!cancelled) setVersions(r.items || []); }),
        apiFetch<any>(`/api/projects/${params.id}/approvals`).then(r => { if (!cancelled) setApprovals(r.items || []); }),
        apiFetch<any>(`/api/projects/${params.id}/activity`).then(r => { if (!cancelled) setActivity(r.items || []); }),
        apiFetch<any>(`/api/projects/${params.id}/handoffs`).then(r => { if (!cancelled) setHandoffs(r.items || []); })
      ];
      await Promise.all(side.map(p => p.catch(() => {})));
    };

    load();
    return () => { cancelled = true; };
  }, [params.id]);

  const derivedStages = useMemo(() => {
    if (stageRows.length) return stageRows;
    return stages.map((name, i) => ({
      StageKey: name.toUpperCase().replaceAll(' ', '_').replaceAll('&', 'AND'),
      StageOrder: i + 1,
      DisplayName: name,
      PhaseName: phaseFor(i),
      Status: 'NOT_STARTED',
      ProgressPercent: 0,
      IsHumanGate: [4, 16, 17].includes(i)
    }));
  }, [stageRows]);

  const displayProject = useMemo(() => {
    if (!project) return null;
    if (!stageRows.length) return project;
    const completed = stageRows.filter(s => s.Status === 'COMPLETED').length;
    const current = stageRows.find(s => ['IN_PROGRESS', 'PAUSED', 'BLOCKED', 'AWAITING_APPROVAL'].includes(s.Status));
    const progress = stageRows.length
      ? Math.round(stageRows.reduce((sum, s) => sum + Number(s.ProgressPercent || 0), 0) / stageRows.length)
      : project.progress;
    return {
      ...project,
      completed,
      total: stageRows.length || project.total,
      progress,
      stage: current?.DisplayName || project.stage
    };
  }, [project, stageRows]);

  const control = (action: 'START' | 'PAUSE' | 'RESUME' | 'STOP') => {
    if (!displayProject) return;
    const next: ProjectStatus = action === 'PAUSE' ? 'PAUSED' : action === 'STOP' ? 'NOT_STARTED' : 'IN_PROGRESS';
    setProject(p => p ? {...p, status: next} : p);
    apiFetch(`/api/command-center/projects/${params.id}/control`, {
      method: 'POST',
      body: JSON.stringify({action})
    }).catch(() => {});
  };

  if (loading && !displayProject) {
    return (
      <AppShell eyebrow="CONTENT OPERATIONS / PROJECTS" title="Project">
        <p className="page-subtitle">Loading project from database…</p>
      </AppShell>
    );
  }

  if (error && !displayProject) {
    return (
      <AppShell eyebrow="CONTENT OPERATIONS / PROJECTS" title="Project" actions={<Link href="/projects" className="btn secondary link-btn">← Projects</Link>}>
        <div className="notice red">{error}</div>
        <div className="empty-state">
          <h3>Project unavailable</h3>
          <p>This project could not be loaded from Microsoft SQL Server.</p>
        </div>
      </AppShell>
    );
  }

  if (!displayProject) {
    return (
      <AppShell eyebrow="CONTENT OPERATIONS / PROJECTS" title="Project" actions={<Link href="/projects" className="btn secondary link-btn">← Projects</Link>}>
        <div className="empty-state">
          <h3>Project not found</h3>
          <p>No master content project exists for this ID in the current workspace.</p>
        </div>
      </AppShell>
    );
  }

  const p = displayProject;

  return (
    <AppShell
      eyebrow="CONTENT OPERATIONS / PROJECTS"
      title={p.code}
      actions={
        <>
          <button className="btn secondary">••• More</button>
          <button className="btn secondary" onClick={() => setEdit(!edit)}>✎ Edit project</button>
          {p.status === 'NOT_STARTED' && <button className="btn primary" onClick={() => control('START')}>▶ Start production</button>}
          {p.status === 'IN_PROGRESS' && <button className="btn primary" onClick={() => control('PAUSE')}>Ⅱ Pause</button>}
          {p.status === 'PAUSED' && <button className="btn primary" onClick={() => control('RESUME')}>▶ Resume</button>}
        </>
      }
    >
      {error && <div className="notice red">{error}</div>}

      <div className="project-workspace-head">
        <div className="project-title-block">
          <div className="workspace-title-line">
            <h1>{p.title}</h1>
            <Status tone={tone(p.status) as any}>{label(p.status)}</Status>
            <span className={`priority-chip ${p.priority.toLowerCase()}`}>{p.priority}</span>
          </div>
          <p>{p.description}</p>
          <div className="project-meta-line">
            <span>◉ {p.platform}</span><i />
            <span>{p.type}</span><i />
            <span>{p.aspectRatio}</span><i />
            <span>{p.duration}</span><i />
            <span>Owner: <b>{p.owner}</b></span><i />
            <span>Deadline: <b>{p.deadline}</b></span>
          </div>
        </div>
        <div className="project-progress-card">
          <div><span>Overall production</span><b>{p.progress}%</b></div>
          <div className="progress-track large"><i style={{width: `${p.progress}%`}} /></div>
          <small>{p.completed} of {p.total} stages completed · Current: <b>{p.stage}</b></small>
        </div>
      </div>

      <nav className="project-tabs">
        {tabs.map(t => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
            {t === 'Approvals' && <em>{liveApprovals.filter((x: any) => (x.status || x.Status) === 'PENDING').length}</em>}
          </button>
        ))}
      </nav>

      {edit && (
        <EditPanel
          p={p}
          close={() => setEdit(false)}
          save={async patch => {
            setProject(x => x ? {...x, ...patch} : x);
            setEdit(false);
            await apiFetch(`/api/projects/${params.id}`, {
              method: 'PATCH',
              body: JSON.stringify({workingTitle: patch.title, description: patch.description, priority: patch.priority})
            }).catch(() => {});
          }}
        />
      )}

      {tab === 'Overview' && <Overview p={p} stages={derivedStages} handoffs={handoffs} onWorkflow={() => setTab('Workflow')} />}
      {tab === 'Workflow' && <Workflow rows={derivedStages} />}
      {tab === 'Assets' && <Assets rows={liveAssets} />}
      {tab === 'Versions' && <Versions rows={liveVersions} />}
      {tab === 'Approvals' && <Approvals rows={liveApprovals} />}
      {tab === 'Activity' && <Activity rows={liveActivity} />}
    </AppShell>
  );
}

function Overview({p, stages, handoffs, onWorkflow}: {p: ContentProject; stages: any[]; handoffs: any[]; onWorkflow: () => void}) {
  const current = stages.find(x => ['IN_PROGRESS', 'PAUSED', 'BLOCKED', 'AWAITING_APPROVAL'].includes(x.Status))
    || stages.find(x => x.Status === 'NOT_STARTED');
  return (
    <div className="workspace-grid">
      <main>
        <section className="workspace-card next-action">
          <div className="next-icon">→</div>
          <div>
            <span>NEXT REQUIRED ACTION</span>
            <h2>
              {p.status === 'NOT_STARTED'
                ? 'Start the project workflow'
                : p.status === 'BLOCKED'
                  ? 'Resolve the blocking issue'
                  : current?.DisplayName || p.stage}
            </h2>
            <p>
              {p.status === 'NOT_STARTED'
                ? 'Human Start initializes execution at Strategy & Brief.'
                : p.status === 'BLOCKED'
                  ? 'A downstream module cannot proceed until this exception is resolved.'
                  : `Continue work in ${current?.DisplayName || p.stage}; its approved output will become the next stage input.`}
            </p>
          </div>
          <button className="btn primary" onClick={onWorkflow}>Open workflow →</button>
        </section>
        <div className="overview-two">
          <section className="workspace-card">
            <CardTitle title="Project definition" subtitle="Governed initiation data used throughout production" />
            <InfoGrid rows={[
              ['Content type', p.type],
              ['Category', p.category],
              ['Objective', p.objective],
              ['Creative direction', p.creativeDirection],
              ['Language', p.language],
              ['Autonomy', label(p.mode)],
              ['Generation budget', `$${p.budget.toFixed(2)}`],
              ['Primary platform', p.platform]
            ]} />
          </section>
          <section className="workspace-card">
            <CardTitle title="Audience & distribution" subtitle="Inputs to strategy, research, creative direction and packaging" />
            <InfoGrid rows={[
              ['Target audience', p.audience],
              ['Target markets', p.countries.join(', ')],
              ['Primary format', `${p.aspectRatio} · ${p.duration}`],
              ['Distribution', p.platform],
              ['Priority', p.priority],
              ['Deadline', p.deadline]
            ]} />
          </section>
        </div>
        <section className="workspace-card">
          <CardTitle
            title="Production pipeline"
            subtitle="The same 22-stage lifecycle used by Command Center"
            action={<button className="text-action" onClick={onWorkflow}>Full workflow →</button>}
          />
          <div className="mini-stage-grid">
            {stages.map((s, i) => (
              <div key={i} className={`mini-stage ${String(s.Status).toLowerCase()}`}>
                <span>{i + 1}</span>
                <div>
                  <b>{s.DisplayName}</b>
                  <small>{label(s.Status)}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <aside>
        <section className="workspace-card">
          <CardTitle title="Handoff chain" subtitle="Output lineage between modules" />
          {handoffs.length === 0
            ? <div className="empty-state"><p>No stage handoffs recorded yet.</p></div>
            : (
              <div className="handoff-list">
                {handoffs.slice(-5).map((h: any, i) => (
                  <div className="handoff-item" key={h.ProjectHandoffId || i}>
                    <span className={`handoff-state ${(h.status || h.Status || 'WAITING').toLowerCase()}`}>↳</span>
                    <div>
                      <b>{h.output || h.OutputType}</b>
                      <small>{h.from || h.FromStageKey} → {h.to || h.ToStageKey}</small>
                    </div>
                    <Status tone={tone(h.status || h.Status || 'NOT_STARTED') as any}>
                      {label(h.status || h.Status || 'Waiting')}
                    </Status>
                  </div>
                ))}
              </div>
            )}
        </section>
        <section className="workspace-card">
          <CardTitle title="Project governance" />
          <div className="governance-side">
            <div><span>Owner</span><b>{p.owner}</b></div>
            <div><span>Autonomy</span><b>{label(p.mode)}</b></div>
            <div><span>Human gates</span><b>3 mandatory</b></div>
            <div><span>Audit trail</span><b className="ok-text">● Enabled</b></div>
            <div><span>Version control</span><b className="ok-text">● Enabled</b></div>
          </div>
        </section>
        <section className="workspace-card handoff-cta">
          <span>MODULE 04 INPUT</span>
          <h3>Strategy & Brief</h3>
          <p>Project master data is ready to become the strategic Content Brief once Module 04 is implemented.</p>
          <button className="btn secondary" disabled>Module 04 not implemented</button>
        </section>
      </aside>
    </div>
  );
}

function Workflow({rows}: {rows: any[]}) {
  return (
    <section className="workspace-card workflow-page">
      <CardTitle
        title="End-to-end project workflow"
        subtitle="A stage cannot consume data until its required upstream output is complete and handed off."
      />
      <div className="workflow-phase-bar">
        <span>STRATEGY</span>
        <span>PRE-PRODUCTION</span>
        <span>PRODUCTION</span>
        <span>POST & PACKAGING</span>
        <span>RELEASE & GROWTH</span>
      </div>
      <div className="workflow-list-full">
        {rows.map((s, i) => (
          <div className={`workflow-full-row ${String(s.Status).toLowerCase()}`} key={s.StageKey || i}>
            <div className="workflow-order">{i + 1}</div>
            <div className="workflow-state-dot" />
            <div className="workflow-desc">
              <b>{s.DisplayName}</b>
              <span>{s.PhaseName || 'Production pipeline'} {s.IsHumanGate ? '· Mandatory human gate' : ''}</span>
            </div>
            <div className="workflow-input">
              <span>Input</span>
              <b>{i === 0 ? 'Project Master' : `${rows[i - 1]?.DisplayName} output`}</b>
            </div>
            <div className="workflow-output">
              <span>Output</span>
              <b>
                {s.Status === 'COMPLETED' ? 'Saved & handed off'
                  : s.Status === 'IN_PROGRESS' ? 'Working version' : 'Not created'}
              </b>
            </div>
            <div className="workflow-progress">
              <span>{Number(s.ProgressPercent || 0)}%</span>
              <div className="progress-track"><i style={{width: `${Number(s.ProgressPercent || 0)}%`}} /></div>
            </div>
            <Status tone={tone(s.Status) as any}>{label(s.Status)}</Status>
            <button className="row-open">›</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Assets({rows}: {rows: any[]}) {
  return (
    <section className="workspace-card">
      <CardTitle
        title="Project Asset Library"
        subtitle="Every generated or uploaded file stays attached to this project and its originating workflow stage."
        action={<button className="btn secondary">＋ Upload asset</button>}
      />
      <div className="workspace-toolbar">
        <div className="project-search">⌕<input placeholder="Search assets…" /></div>
        <select>
          <option>All asset types</option>
          <option>Image</option>
          <option>Video</option>
          <option>Audio</option>
          <option>Document</option>
        </select>
        <select><option>All stages</option></select>
      </div>
      {rows.length === 0
        ? <div className="empty-state"><h3>No assets yet</h3><p>Generated and uploaded files will appear here once production stages create them.</p></div>
        : (
          <div className="asset-table">
            <div className="asset-th">
              <span>Asset</span><span>Stage</span><span>Version</span><span>Status</span><span>Size</span><span>Created</span><span />
            </div>
            {rows.map((a: any, i) => (
              <div className="asset-tr" key={a.id || a.ProjectAssetId || i}>
                <div>
                  <span className={`asset-icon ${String(a.type || a.AssetType).toLowerCase()}`}>
                    {assetSymbol(a.type || a.AssetType)}
                  </span>
                  <div>
                    <b>{a.name || a.FileName}</b>
                    <small>{a.type || a.AssetType}</small>
                  </div>
                </div>
                <span>{a.stage || a.StageKey || '—'}</span>
                <b>v{a.version || a.VersionNumber}</b>
                <Status tone={tone(a.status || a.Status) as any}>{label(a.status || a.Status)}</Status>
                <span>{a.size || formatBytes(a.FileSizeBytes)}</span>
                <span>{a.created || date(a.CreatedAt)}</span>
                <button>•••</button>
              </div>
            ))}
          </div>
        )}
    </section>
  );
}

function Versions({rows}: {rows: any[]}) {
  return (
    <section className="workspace-card">
      <CardTitle title="Version History" subtitle="Immutable snapshots of governed project outputs and configuration changes." />
      {rows.length === 0
        ? <div className="empty-state"><h3>No versions yet</h3><p>Project snapshots will appear after create and subsequent governed changes.</p></div>
        : (
          <div className="version-list">
            {rows.map((v: any, i) => (
              <article className="version-row" key={v.id || v.ProjectVersionId || i}>
                <div className="version-badge">v{v.version || v.VersionNumber}</div>
                <div>
                  <div className="version-title">
                    <b>{v.title || v.Title}</b>
                    {(v.approved ?? v.IsApproved) && <Status tone="green">Approved</Status>}
                  </div>
                  <p>{v.summary || v.ChangeSummary || 'Version saved.'}</p>
                  <span>{v.stage || v.SourceStageKey || 'Project'} · {v.by || v.CreatedBy || 'System'} · {v.created || date(v.CreatedAt)}</span>
                </div>
                <span className="version-type">{label(v.type || v.VersionType)}</span>
                <button className="btn secondary tiny-btn">View snapshot</button>
              </article>
            ))}
          </div>
        )}
    </section>
  );
}

function Approvals({rows}: {rows: any[]}) {
  return (
    <section className="workspace-card">
      <CardTitle title="Approval History" subtitle="Human decision gates and review requests linked to this project." />
      {rows.length === 0
        ? <div className="empty-state"><h3>No approvals yet</h3><p>Human gate requests will appear when workflow stages require review.</p></div>
        : (
          <div className="approval-table">
            <div className="approval-th">
              <span>Approval</span><span>Stage</span><span>Assignee</span><span>Requested</span><span>Decision</span><span>Status</span>
            </div>
            {rows.map((a: any, i) => (
              <div className="approval-tr" key={a.id || a.ProjectApprovalId || i}>
                <div>
                  <b>{a.type || a.ApprovalType}</b>
                  <small>{a.comment || a.DecisionComment || a.RequestNote || 'No comment'}</small>
                </div>
                <span>{a.stage || a.StageKey || '—'}</span>
                <span>{a.assignee || a.AssignedTo || 'Unassigned'}</span>
                <span>{a.requested || date(a.RequestedAt)}</span>
                <span>{a.decision || date(a.DecidedAt) || '—'}</span>
                <Status tone={tone(a.status || a.Status) as any}>{label(a.status || a.Status)}</Status>
              </div>
            ))}
          </div>
        )}
    </section>
  );
}

function Activity({rows}: {rows: any[]}) {
  const params = useParams<{id: string}>();
  return (
    <section className="workspace-card">
      <CardTitle
        title="Project Activity"
        subtitle="Human, AI and system actions in chronological order."
        action={<Link href={`/projects/${params.id}/activity`} className="btn secondary link-btn tiny-btn">Open full history →</Link>}
      />
      {rows.length === 0
        ? <div className="empty-state"><h3>No activity yet</h3><p>Human, AI and system events for this project will appear here.</p></div>
        : (
          <div className="activity-timeline">
            {rows.map((a: any, i) => (
              <div className="activity-item" key={a.id || a.ProjectActivityId || i}>
                <span className={`activity-avatar ${String(a.actor || a.ActorType).toLowerCase()}`}>
                  {actorAvatar(a)}
                </span>
                <div>
                  <div>
                    <b>{a.title || a.Title}</b>
                    <span>{a.time || date(a.CreatedAt)}</span>
                  </div>
                  <p>{a.detail || a.Details}</p>
                  <small>{a.name || a.ActorName || a.AgentName || 'System'} · {a.stage || a.StageKey || 'Project'}</small>
                </div>
              </div>
            ))}
          </div>
        )}
    </section>
  );
}

function EditPanel({p, close, save}: {p: ContentProject; close: () => void; save: (x: any) => void}) {
  const [title, setTitle] = useState(p.title);
  const [description, setDescription] = useState(p.description);
  const [priority, setPriority] = useState(p.priority);
  return (
    <div className="modal-backdrop" onClick={close}>
      <aside className="edit-project-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span>PROJECT SETTINGS</span>
            <h2>Edit project master</h2>
          </div>
          <button onClick={close}>×</button>
        </div>
        <div className="drawer-body">
          <label className="form-field">
            <b>Working title</b>
            <input value={title} onChange={e => setTitle(e.target.value)} />
          </label>
          <label className="form-field">
            <b>Description</b>
            <textarea value={description} onChange={e => setDescription(e.target.value)} />
          </label>
          <label className="form-field">
            <b>Priority</b>
            <select value={priority} onChange={e => setPriority(e.target.value as any)}>
              <option>LOW</option>
              <option>MEDIUM</option>
              <option>HIGH</option>
              <option>URGENT</option>
            </select>
          </label>
          <div className="drawer-warning">
            <b>Versioned change</b>
            <p>Production-critical configuration changes should be captured as project versions once downstream modules begin consuming them.</p>
          </div>
        </div>
        <div className="drawer-footer">
          <button className="btn secondary" onClick={close}>Cancel</button>
          <button className="btn primary" onClick={() => save({title, description, priority})}>Save changes</button>
        </div>
      </aside>
    </div>
  );
}

function CardTitle({title, subtitle, action}: {title: string; subtitle?: string; action?: any}) {
  return (
    <div className="workspace-card-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function InfoGrid({rows}: {rows: string[][]}) {
  return (
    <div className="info-grid">
      {rows.map((r, i) => (
        <div key={i}><span>{r[0]}</span><b>{r[1] || '—'}</b></div>
      ))}
    </div>
  );
}

function assetSymbol(t: string) {
  return t === 'IMAGE' ? '▧' : t === 'VIDEO' ? '▶' : t === 'AUDIO' ? '♪' : t === 'SCRIPT' ? '¶' : '▤';
}

function formatBytes(n: number) {
  if (!n) return '—';
  return n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`;
}

function date(v: any) {
  if (!v) return '—';
  try { return new Date(v).toLocaleString(); } catch { return String(v); }
}
