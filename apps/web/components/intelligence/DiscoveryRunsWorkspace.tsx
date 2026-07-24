'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileSearch,
  Gauge,
  GitBranch,
  Layers3,
  ListOrdered,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
} from 'lucide-react';
import type {
  DiscoveryRun,
  DiscoveryRunsOverview,
} from '@/lib/content-intelligence/discovery';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import styles from './discovery-runs.module.css';

type TabId =
  | 'overview'
  | 'active'
  | 'coverage'
  | 'evidence'
  | 'reasoning'
  | 'dependencies'
  | 'history'
  | 'audit';

type StatusFilter =
  | 'all'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'partial'
  | 'cancelled';

type DateFilter = 'all' | 'today' | '7d' | '30d';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'active', label: 'Active Runs' },
  { id: 'coverage', label: 'Source Coverage' },
  { id: 'evidence', label: 'Evidence Collection' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'queue', label: 'Queue', icon: ListOrdered },
  { key: 'discover', label: 'Discover', icon: Radio },
  { key: 'collect', label: 'Collect', icon: FileSearch },
  { key: 'verify', label: 'Verify', icon: ShieldCheck },
  { key: 'score', label: 'Score', icon: Gauge },
  { key: 'complete', label: 'Complete', icon: CheckCircle2 },
  { key: 'handoff', label: 'Handoff', icon: GitBranch },
] as const;

function statusTone(status?: string | null) {
  switch (status) {
    case 'ACTIVE':
    case 'HEALTHY':
    case 'READY':
    case 'COMPLETED':
    case 'RUNNING':
    case 'ACKNOWLEDGED':
    case 'Completed':
    case 'Healthy':
      return styles.toneReady;
    case 'FAILED':
    case 'BLOCKED':
    case 'CANCELLED':
    case 'Failed':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'QUEUED':
    case 'PARTIAL':
    case 'WARNING':
    case 'PAUSED':
    case 'Running':
    case 'Waiting':
    case 'Queued':
      return styles.toneWarning;
    default:
      return styles.toneDraft;
  }
}

function display(value?: string | number | null) {
  if (value == null || value === '') return '—';
  return String(value);
}

function measured(value?: string | number | null) {
  if (value == null || value === '') return 'UNMEASURED';
  return String(value);
}

function sparkBars(seed: number) {
  return [4, 7, 5, 9, 6, 10, 8].map((base, index) => Math.max(3, ((base + seed + index * 2) % 10) + 3));
}

function formatDuration(ms: number | null) {
  if (ms == null) return 'UNMEASURED';
  if (ms < 1000) return `${ms} ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}m ${rem}s`;
}

function matchesRun(
  item: DiscoveryRun,
  needle: string,
  status: StatusFilter,
  dateFilter: DateFilter,
  sourceFilter: string,
) {
  if (status === 'queued' && item.status !== 'QUEUED') return false;
  if (status === 'running' && item.status !== 'RUNNING') return false;
  if (status === 'completed' && item.status !== 'COMPLETED') return false;
  if (status === 'failed' && item.status !== 'FAILED' && item.status !== 'BLOCKED') return false;
  if (status === 'partial' && item.status !== 'PARTIAL') return false;
  if (status === 'cancelled' && item.status !== 'CANCELLED') return false;

  if (sourceFilter === 'with-sources' && item.sourcesScanned <= 0) return false;
  if (sourceFilter === 'without-sources' && item.sourcesScanned > 0) return false;

  if (dateFilter !== 'all') {
    const created = new Date(item.createdAt).getTime();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    if (dateFilter === 'today' && now - created > day) return false;
    if (dateFilter === '7d' && now - created > 7 * day) return false;
    if (dateFilter === '30d' && now - created > 30 * day) return false;
  }

  if (!needle) return true;
  const haystack = [
    item.id,
    item.status,
    item.trigger,
    item.idempotencyKey,
    item.strategyVersionNumber,
    item.failureReason,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function lifecycleState(
  index: number,
  overview: DiscoveryRunsOverview | null,
  systemRunning: boolean,
) {
  const runs = overview?.runs ?? [];
  const latest = runs[0];
  const hasPackage = Boolean(overview?.strategy);

  if (!latest) {
    if (hasPackage || systemRunning) return index === 0 ? 'active' : 'pending';
    return 'pending';
  }

  switch (latest.status) {
    case 'COMPLETED':
      return index <= 5 ? 'done' : index === 6 ? (latest.handoffs > 0 ? 'done' : 'active') : 'pending';
    case 'PARTIAL':
      return index <= 4 ? 'done' : index === 5 ? 'active' : 'pending';
    case 'FAILED':
    case 'BLOCKED':
    case 'CANCELLED':
      return index <= 2 ? 'done' : index === 3 ? 'active' : 'pending';
    case 'RUNNING':
      if (index <= 1) return 'done';
      if (index === 2) return 'active';
      return 'pending';
    case 'QUEUED':
      return index === 0 ? 'active' : 'pending';
    default:
      return systemRunning && index === 0 ? 'active' : 'pending';
  }
}

function packageLabel(overview: DiscoveryRunsOverview | null, systemRunning: boolean) {
  const latest = overview?.runs[0];
  if (latest?.status === 'COMPLETED') return 'Completed';
  if (latest?.status === 'RUNNING' || systemRunning) return 'Running';
  if (latest?.status === 'QUEUED') return 'Queued';
  if (latest?.status === 'FAILED' || latest?.status === 'BLOCKED') return 'Failed';
  if (latest?.status === 'PARTIAL') return 'Warning';
  if (latest?.status === 'CANCELLED') return 'Cancelled';
  if (overview?.strategy) return 'Waiting';
  return 'Empty';
}

export function DiscoveryRunsWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<DiscoveryRunsOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [tab, setTab] = useState<TabId>('overview');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const systemRunning = systemState === 'RUNNING';
  const systemPaused = systemState === 'PAUSED';

  async function load(preferId?: string | null) {
    setBusy(true);
    setError('');
    try {
      const [next, dashboard] = await Promise.all([
        intelligenceApi.discovery(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const items = next.runs ?? [];
      const targetId = preferId ?? selectedId;
      const selected = targetId ? items.find((item) => item.id === targetId) : items[0];
      setSelectedId(selected?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unavailable');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load(selectedId);
    }, systemRunning ? 3000 : 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemRunning, selectedId]);

  useEffect(() => {
    const onControlChanged = () => void load(selectedId);
    window.addEventListener('cacsms:system-control-changed', onControlChanged);
    return () => window.removeEventListener('cacsms:system-control-changed', onControlChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const runs = overview?.runs ?? [];
  const metrics = overview?.metrics;
  const needle = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      runs.filter((item) => matchesRun(item, needle, statusFilter, dateFilter, sourceFilter)),
    [runs, needle, statusFilter, dateFilter, sourceFilter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    runs.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const kpis = useMemo(() => {
    const discoveryRuns = metrics?.discoveryRuns ?? 0;
    const activeJobs = metrics?.activeJobs ?? 0;
    const sourcesScanned = metrics?.sourcesScanned ?? 0;
    const evidenceCollected = metrics?.evidenceCollected ?? 0;
    const pipelineHealth = metrics?.pipelineHealth ?? 0;
    const measuredConfidence = (metrics?.measuredConfidence ?? 0) > 0;
    return [
      {
        label: 'Discovery Runs',
        value: String(discoveryRuns),
        meta: 'Persisted discovery runs',
        accent: '#2563EB',
        icon: Workflow,
        bars: sparkBars(discoveryRuns),
      },
      {
        label: 'Active Jobs',
        value: String(activeJobs),
        meta: 'Queued / running workers',
        accent: '#0EA5E9',
        icon: Activity,
        bars: sparkBars(activeJobs),
      },
      {
        label: 'Sources Scanned',
        value: String(sourcesScanned),
        meta: 'Distinct sources with signals',
        accent: '#22C55E',
        icon: Radio,
        bars: sparkBars(sourcesScanned),
      },
      {
        label: 'Evidence Collected',
        value: String(evidenceCollected),
        meta: 'Persisted discovery signals',
        accent: '#F59E0B',
        icon: FileSearch,
        bars: sparkBars(evidenceCollected),
      },
      {
        label: 'AI Confidence',
        value: measuredConfidence ? String(metrics?.avgConfidence ?? 0) : 'UNMEAS.',
        meta: measuredConfidence
          ? `${metrics?.measuredConfidence} run(s) with measured scores`
          : 'No measured signal confidence yet',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(metrics?.avgConfidence ?? 0),
      },
      {
        label: 'Pipeline Health',
        value: `${pipelineHealth}%`,
        meta: 'Completed vs failed/active mix',
        accent: '#EF4444',
        icon: Gauge,
        bars: sparkBars(pipelineHealth),
      },
    ];
  }, [metrics]);

  const stageStatus = systemPaused ? 'Paused' : packageLabel(overview, systemRunning);

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
      };

  if (busy && !overview) {
    return (
      <main className={styles.page}>
        <div className={styles.skeletonTop} />
        <div className={styles.skeletonGrid}>
          <div className={styles.skeletonPanel} />
          <div className={styles.skeletonPanel} />
          <div className={styles.skeletonPanel} />
        </div>
      </main>
    );
  }

  if (error || (overview && !overview.available)) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Content Lifecycle / 02 Content Intelligence / Discovery Runs</p>
        <h1 className={styles.title}>Autonomous Discovery Runs</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Discovery runs unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  const issues = overview?.issues ?? [];
  const audit = overview?.audit ?? [];
  const activeRuns = runs.filter(
    (item) => item.status === 'QUEUED' || item.status === 'RUNNING',
  );

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>Content Lifecycle / 02 Content Intelligence / Discovery Runs</p>
          <h1 className={styles.title}>Autonomous Discovery Runs</h1>
          <p className={styles.lede}>
            Orchestrate and monitor evidence-backed discovery across approved sources after a
            validated Strategy package is acknowledged.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 02</span>
          <span className={`${styles.badge} ${styles.toneAi}`}>System Managed</span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Observe Only</span>
          <span className={`${styles.badge} ${statusTone(stageStatus)}`}>{stageStatus}</span>
          <span className={`${styles.badge} ${statusTone(overview?.strategy?.status)}`}>
            Strategy v{overview?.strategy?.versionNumber ?? '—'}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only</strong>
          Discovery runs start automatically after Strategy package acknowledgement while the global
          system is RUNNING. Metrics below are persisted counts only — confidence and cost stay
          UNMEASURED until workers write measured values.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Discovery KPI summary">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article
              key={kpi.label}
              className={styles.kpiCard}
              style={{ ['--accent' as string]: kpi.accent }}
              title={kpi.meta}
            >
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>{kpi.label}</span>
                <Icon size={16} className={styles.kpiIcon} aria-hidden />
              </div>
              <div className={styles.kpiValue}>{kpi.value}</div>
              <div className={styles.kpiMeta}>
                <span>{kpi.meta}</span>
                <span className={styles.spark} aria-hidden>
                  {kpi.bars.map((height, index) => (
                    <i key={`${kpi.label}-${index}`} style={{ height: `${height}px` }} />
                  ))}
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <section className={styles.lifecycle} aria-label="Discovery lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Discovery lifecycle</h2>
          <span>
            {overview?.strategy
              ? `Package ACK · latest ${overview.runs[0]?.status ?? 'IDLE'}`
              : `Awaiting Strategy package · system ${systemState}`}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {LIFECYCLE.map((stage, index) => {
            const Icon = stage.icon;
            const state = lifecycleState(index, overview, systemRunning);
            return (
              <div key={stage.key} className={styles.stage} data-state={state}>
                <span className={styles.stageIcon}>
                  <Icon size={16} aria-hidden />
                </span>
                <strong>{stage.label}</strong>
              </div>
            );
          })}
        </div>
      </section>

      {!overview?.strategy ? (
        <div className={styles.waitingBanner} role="status">
          <Timer size={18} aria-hidden />
          <div>
            <strong>Waiting for Strategy activation</strong>
            Discovery runs queue automatically once Stage 01 hands off an acknowledged Strategy
            package and global control is RUNNING.
          </div>
        </div>
      ) : null}

      {overview?.strategy && runs.length === 0 ? (
        <div className={styles.waitingBanner} role="status">
          <Clock3 size={18} aria-hidden />
          <div>
            <strong>No discovery runs persisted yet</strong>
            The autonomous orchestrator will enqueue a discovery run while the system remains
            RUNNING. This page will refresh as soon as a run is written.
          </div>
        </div>
      ) : null}

      <section className={styles.workspace} aria-label="Discovery intelligence workspace">
        <aside className={`${styles.panel} ${styles.explorer}`} aria-label="Run Explorer">
          <div className={styles.panelHead}>
            <h2>Run Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search run ID, trigger, status…"
                aria-label="Search discovery runs"
              />
            </label>
            <label className={styles.field}>
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="queued">Queued</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed / blocked</option>
                <option value="partial">Partial</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Date</span>
              <select
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value as DateFilter)}
                aria-label="Filter by date"
              >
                <option value="all">All dates</option>
                <option value="today">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Source coverage</span>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                aria-label="Filter by source coverage"
              >
                <option value="all">All runs</option>
                <option value="with-sources">With scanned sources</option>
                <option value="without-sources">No sources scanned yet</option>
              </select>
            </label>

            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No persisted discovery runs match the current filters.</p>
              </div>
            ) : (
              <ul className={styles.explorerList}>
                {filtered.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`${styles.explorerItem} ${
                        selected?.id === item.id ? styles.explorerItemActive : ''
                      }`}
                      onClick={() => {
                        setSelectedId(item.id);
                        setTab('overview');
                      }}
                    >
                      <span className={styles.explorerTitle}>
                        Run {item.id.slice(0, 8)}…
                      </span>
                      <span className={styles.explorerMeta}>
                        {item.trigger} · Strategy v{item.strategyVersionNumber ?? '—'}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                        <span className={styles.chip}>
                          {item.signalsCollected} signals
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Discovery Intelligence">
          <div className={styles.tabs} role="tablist" aria-label="Discovery intelligence tabs">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`${styles.tab} ${tab === item.id ? styles.tabActive : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.tabBody} role="tabpanel">
            {!selected && tab !== 'audit' && tab !== 'dependencies' && tab !== 'active' ? (
              <div className={styles.emptyInline}>
                <Layers3 size={22} aria-hidden />
                <p>
                  {overview?.strategy
                    ? 'Select a discovery run to inspect progress and evidence.'
                    : 'Persisted runs appear after Strategy acknowledgement and autonomous enqueue.'}
                </p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Run identity</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Run ID</dt>
                      <dd>{selected.id}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{selected.status}</dd>
                    </div>
                    <div>
                      <dt>Trigger</dt>
                      <dd>{selected.trigger}</dd>
                    </div>
                    <div>
                      <dt>Idempotency key</dt>
                      <dd>{selected.idempotencyKey}</dd>
                    </div>
                    <div>
                      <dt>Strategy version</dt>
                      <dd>v{selected.strategyVersionNumber ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Checksum</dt>
                      <dd>{display(selected.strategyChecksum?.slice(0, 12))}…</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Progress & throughput</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Sources scanned</dt>
                      <dd>{selected.sourcesScanned}</dd>
                    </div>
                    <div>
                      <dt>Signals collected</dt>
                      <dd>{selected.signalsCollected}</dd>
                    </div>
                    <div>
                      <dt>Verified evidence</dt>
                      <dd>{selected.verifiedEvidence}</dd>
                    </div>
                    <div>
                      <dt>Opportunities</dt>
                      <dd>{selected.opportunities}</dd>
                    </div>
                    <div>
                      <dt>Duplicates flagged</dt>
                      <dd>{selected.duplicatesFlagged}</dd>
                    </div>
                    <div>
                      <dt>Handoffs</dt>
                      <dd>{selected.handoffs}</dd>
                    </div>
                    <div>
                      <dt>Active jobs</dt>
                      <dd>{selected.activeJobs}</dd>
                    </div>
                    <div>
                      <dt>Failed jobs</dt>
                      <dd>{selected.failedJobs}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Timing & quality</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Created</dt>
                      <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Started</dt>
                      <dd>
                        {selected.startedAt
                          ? new Date(selected.startedAt).toLocaleString()
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Completed</dt>
                      <dd>
                        {selected.completedAt
                          ? new Date(selected.completedAt).toLocaleString()
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Execution time</dt>
                      <dd>{formatDuration(selected.executionMs)}</dd>
                    </div>
                    <div>
                      <dt>Processing cost</dt>
                      <dd>UNMEASURED</dd>
                    </div>
                    <div>
                      <dt>Confidence</dt>
                      <dd>
                        {selected.measuredConfidence > 0
                          ? measured(selected.avgConfidence)
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Failure reason</dt>
                      <dd>{display(selected.failureReason)}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'active' ? (
              <div className={styles.detailGrid}>
                {!activeRuns.length ? (
                  <div className={styles.emptyInline}>
                    <p>No queued or running discovery jobs right now.</p>
                  </div>
                ) : (
                  activeRuns.map((run) => (
                    <article key={run.id} className={styles.detailCard}>
                      <h3>Run {run.id.slice(0, 8)}…</h3>
                      <dl className={styles.kv}>
                        <div>
                          <dt>Status</dt>
                          <dd>{run.status}</dd>
                        </div>
                        <div>
                          <dt>Active jobs</dt>
                          <dd>{run.activeJobs}</dd>
                        </div>
                        <div>
                          <dt>Signals</dt>
                          <dd>{run.signalsCollected}</dd>
                        </div>
                        <div>
                          <dt>Started</dt>
                          <dd>
                            {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}
                          </dd>
                        </div>
                      </dl>
                      {run.jobs.length ? (
                        <ul className={styles.bulletList}>
                          {run.jobs.slice(0, 5).map((job) => (
                            <li key={job.id}>
                              {job.jobType} · {job.status} · attempt {job.attemptCount}/
                              {job.maxAttempts}
                              {job.lastError ? ` — ${job.lastError}` : ''}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            ) : null}

            {selected && tab === 'coverage' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Source utilization</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Registered sources</dt>
                      <dd>{metrics?.registeredSources ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Scanned this run</dt>
                      <dd>{selected.sourcesScanned}</dd>
                    </div>
                    <div>
                      <dt>Coverage ratio</dt>
                      <dd>
                        {(metrics?.registeredSources ?? 0) > 0
                          ? `${Math.round(
                              (selected.sourcesScanned /
                                Math.max(1, metrics?.registeredSources ?? 1)) *
                                100,
                            )}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Why sources are scanned</h3>
                  <p>
                    Discovery workers scan approved registry sources linked to the acknowledged
                    Strategy package. Restricted/social classes remain deprioritised and cannot be
                    sole evidence.
                  </p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'evidence' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Evidence collection</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Signals</dt>
                      <dd>{selected.signalsCollected}</dd>
                    </div>
                    <div>
                      <dt>Verified</dt>
                      <dd>{selected.verifiedEvidence}</dd>
                    </div>
                    <div>
                      <dt>Duplicates flagged</dt>
                      <dd>{selected.duplicatesFlagged}</dd>
                    </div>
                    <div>
                      <dt>Opportunities formed</dt>
                      <dd>{selected.opportunities}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Acceptance policy</h3>
                  <p>
                    Evidence is accepted when provenance, authority class, and corroboration gates
                    pass. Rejected or low-confidence items remain visible in audit and issue panels
                    — values are never fabricated.
                  </p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>AI explainability</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Run outcome</dt>
                      <dd>{selected.status}</dd>
                    </div>
                    <div>
                      <dt>Strategic alignment</dt>
                      <dd>
                        Bound to Strategy v{selected.strategyVersionNumber ?? '—'} (
                        {display(selected.strategyChecksum?.slice(0, 12))}…)
                      </dd>
                    </div>
                    <div>
                      <dt>Confidence basis</dt>
                      <dd>
                        {selected.measuredConfidence > 0
                          ? `Average of ${selected.measuredConfidence} measured signal confidence value(s)`
                          : 'UNMEASURED — no signal confidence ≥ 1 persisted'}
                      </dd>
                    </div>
                    <div>
                      <dt>Retries observed</dt>
                      <dd>
                        {selected.jobs.reduce((sum, job) => sum + Math.max(0, job.attemptCount - 1), 0)}
                      </dd>
                    </div>
                  </dl>
                  {selected.failureReason ? (
                    <p className={styles.lede}>Failure: {selected.failureReason}</p>
                  ) : null}
                </article>
              </div>
            ) : null}

            {tab === 'dependencies' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Upstream</h3>
                  <ul className={styles.bulletList}>
                    <li>Stage 01 Strategy package (ACTIVE → ACK)</li>
                    <li>Source Registry readiness</li>
                    <li>Global system control RUNNING</li>
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Downstream</h3>
                  <ul className={styles.bulletList}>
                    <li>Trend / audience / gap intelligence</li>
                    <li>Verification, scoring, ranking</li>
                    <li>Stage 03 Idea Qualification handoff</li>
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Version reference</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Strategy</dt>
                      <dd>v{overview?.strategy?.versionNumber ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Selected run</dt>
                      <dd>{display(selected?.id?.slice(0, 8))}</dd>
                    </div>
                    <div>
                      <dt>Handoffs</dt>
                      <dd>{selected?.handoffs ?? 0}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {selected && tab === 'history' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Run timeline</h3>
                  <ul className={styles.timeline}>
                    <li>
                      <CircleDot size={14} aria-hidden />
                      <div>
                        <strong>Queued / created</strong>
                        <span>{new Date(selected.createdAt).toLocaleString()}</span>
                      </div>
                    </li>
                    <li>
                      <Activity size={14} aria-hidden />
                      <div>
                        <strong>Started</strong>
                        <span>
                          {selected.startedAt
                            ? new Date(selected.startedAt).toLocaleString()
                            : 'Not started'}
                        </span>
                      </div>
                    </li>
                    <li>
                      <CheckCircle2 size={14} aria-hidden />
                      <div>
                        <strong>Completed</strong>
                        <span>
                          {selected.completedAt
                            ? new Date(selected.completedAt).toLocaleString()
                            : 'In progress / pending'}
                        </span>
                      </div>
                    </li>
                    {selected.jobs.slice(0, 6).map((job) => (
                      <li key={job.id}>
                        <RefreshCw size={14} aria-hidden />
                        <div>
                          <strong>
                            {job.jobType} · {job.status}
                          </strong>
                          <span>
                            Updated {new Date(job.updatedAt).toLocaleString()}
                            {job.lastError ? ` — ${job.lastError}` : ''}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Audit trail</h3>
                  {!audit.length ? (
                    <p className={styles.lede}>No discovery-related audit events persisted yet.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">When</th>
                          <th scope="col">Action</th>
                          <th scope="col">Actor</th>
                          <th scope="col">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.map((row) => (
                          <tr key={row.id}>
                            <td>{new Date(row.createdAt).toLocaleString()}</td>
                            <td>{row.action}</td>
                            <td>{row.actorType}</td>
                            <td>{display(row.reason)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.insights}`} aria-label="AI Insights">
          <div className={styles.panelHead}>
            <h2>AI Insights</h2>
            <BrainCircuit size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightStack}>
              <article className={styles.insightCard}>
                <h3>Run health</h3>
                <p>
                  {metrics?.completed ?? 0} completed · {metrics?.failed ?? 0} failed ·{' '}
                  {metrics?.running ?? 0} running · health {metrics?.pipelineHealth ?? 0}%
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Throughput</h3>
                <p>
                  {metrics?.evidenceCollected ?? 0} signals across {metrics?.discoveryRuns ?? 0}{' '}
                  run(s) · {metrics?.activeJobs ?? 0} active job(s)
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Coverage</h3>
                <p>
                  {selected?.sourcesScanned ?? 0} sources on selected run ·{' '}
                  {metrics?.registeredSources ?? 0} registered
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Confidence</h3>
                <p>
                  {(metrics?.measuredConfidence ?? 0) > 0
                    ? `${metrics?.avgConfidence}% average measured`
                    : 'UNMEASURED'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Recommendations</h3>
                <ul className={styles.bulletList}>
                  {!overview?.strategy ? (
                    <li>Activate Stage 01 Strategy and wait for package acknowledgement.</li>
                  ) : null}
                  {overview?.strategy && runs.length === 0 && !systemRunning ? (
                    <li>Start the global system to enqueue autonomous discovery.</li>
                  ) : null}
                  {(metrics?.failed ?? 0) > 0 ? (
                    <li>Inspect failed runs and job errors; retries use persisted attempt counts.</li>
                  ) : null}
                  {(metrics?.registeredSources ?? 0) === 0 ? (
                    <li>Source Registry is empty — discovery cannot scan providers yet.</li>
                  ) : null}
                  {(metrics?.measuredConfidence ?? 0) === 0 && (metrics?.evidenceCollected ?? 0) > 0 ? (
                    <li>Signals exist but confidence remains UNMEASURED (&lt; 1).</li>
                  ) : null}
                  {systemPaused ? (
                    <li>System is PAUSED — queued work waits until Resume.</li>
                  ) : null}
                  {(metrics?.completed ?? 0) > 0 && (metrics?.failed ?? 0) === 0 ? (
                    <li>Discovery pipeline is healthy for downstream verification and ranking.</li>
                  ) : null}
                </ul>
              </article>
              <article className={styles.insightCard}>
                <h3>Detected issues</h3>
                {!issues.length ? (
                  <p>No open discovery anomalies in persisted state.</p>
                ) : (
                  <ul className={styles.bulletList}>
                    {issues.slice(0, 6).map((issue) => (
                      <li key={issue.id}>
                        [{issue.severity}] {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.bottom} aria-label="Discovery monitoring">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Live pipeline mix</h2>
            <Workflow size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Queued</dt>
                <dd>{metrics?.queued ?? 0}</dd>
              </div>
              <div>
                <dt>Running</dt>
                <dd>{metrics?.running ?? 0}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{metrics?.completed ?? 0}</dd>
              </div>
              <div>
                <dt>Failed</dt>
                <dd>{metrics?.failed ?? 0}</dd>
              </div>
              <div>
                <dt>Partial</dt>
                <dd>{metrics?.partial ?? 0}</dd>
              </div>
              <div>
                <dt>Cancelled</dt>
                <dd>{metrics?.cancelled ?? 0}</dd>
              </div>
            </dl>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Recovery posture</h2>
            <AlertTriangle size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              {(metrics?.failed ?? 0) > 0 || (selected?.failedJobs ?? 0) > 0
                ? 'Failed jobs remain eligible for automatic retry up to max attempts. No manual edits on this page.'
                : 'No failed discovery jobs in the current persisted set. Automatic recovery idle.'}
            </p>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Performance</h2>
            <CheckCircle2 size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Pipeline health</dt>
                <dd>{metrics?.pipelineHealth ?? 0}%</dd>
              </div>
              <div>
                <dt>Selected duration</dt>
                <dd>{formatDuration(selected?.executionMs ?? null)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>
                  {overview?.lastUpdated
                    ? new Date(overview.lastUpdated).toLocaleString()
                    : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </article>
      </section>
    </motion.main>
  );
}
