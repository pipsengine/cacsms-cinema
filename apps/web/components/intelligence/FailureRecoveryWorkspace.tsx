'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Download,
  Gauge,
  HeartPulse,
  Layers3,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
  Wrench,
} from 'lucide-react';
import type {
  FailureRecord,
  FailureRecoveryOverview,
} from '@/lib/content-intelligence/failures';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import styles from './failure-recovery.module.css';

type TabId =
  | 'overview'
  | 'queue'
  | 'diagnosis'
  | 'recovery'
  | 'deadletter'
  | 'categories'
  | 'infrastructure'
  | 'timeline'
  | 'analytics'
  | 'recommendations'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'queue', label: 'Active Failures' },
  { id: 'diagnosis', label: 'Diagnosis' },
  { id: 'recovery', label: 'Recovery' },
  { id: 'deadletter', label: 'Dead Letter' },
  { id: 'categories', label: 'Categories' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'audit', label: 'Audit' },
];

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'RECOVERED':
    case 'HEALTHY':
    case 'STABLE':
    case 'MONITORING':
    case 'COMPLETED':
    case 'RUNNING':
    case 'ACTIVE_OK':
      return styles.toneReady;
    case 'CRITICAL':
    case 'DEAD_LETTER':
    case 'FAILED':
    case 'BLOCKED':
    case 'IMPACTED':
      return styles.toneBlocked;
    case 'ACTIVE':
    case 'RETRYING':
    case 'RECOVERING':
    case 'PENDING':
    case 'WARNING':
    case 'DEGRADED':
    case 'DIAGNOSING':
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

function packageLabel(overview: FailureRecoveryOverview | null, systemRunning: boolean) {
  if (overview?.run?.status === 'FAILED') return 'Failed';
  if ((overview?.metrics.criticalFailures ?? 0) > 0) return 'Critical';
  if (systemRunning || overview?.run?.status === 'RUNNING') return 'Healing';
  if ((overview?.metrics.activeFailures ?? 0) > 0) return 'Active';
  if ((overview?.metrics.deadLetterQueue ?? 0) > 0) return 'Dead Letter';
  if ((overview?.failures.length ?? 0) > 0) return 'Stable';
  if (overview?.strategy) return 'Monitoring';
  return 'Empty';
}

function matchesFailure(
  item: FailureRecord,
  needle: string,
  severity: string,
  status: string,
  category: string,
  source: string,
) {
  if (severity !== 'all' && item.severity !== severity) return false;
  if (status !== 'all' && item.recoveryStatus !== status) return false;
  if (category !== 'all' && item.category !== category) return false;
  if (source !== 'all' && item.source !== source) return false;
  if (!needle) return true;
  const haystack = [
    item.id,
    item.message,
    item.module,
    item.workflow,
    item.component,
    item.rootCause,
    item.correlationId,
    item.lastError,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function exportPayload(overview: FailureRecoveryOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `failure-recovery-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'id',
    'severity',
    'category',
    'status',
    'module',
    'retries',
    'message',
  ];
  const lines = [
    header.join(','),
    ...overview.failures.map((item) =>
      [
        item.id,
        item.severity,
        item.category,
        item.recoveryStatus,
        JSON.stringify(item.module),
        item.retries,
        JSON.stringify(item.message),
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `failure-recovery-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function FailureRecoveryWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<FailureRecoveryOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [tab, setTab] = useState<TabId>('overview');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const systemRunning = systemState === 'RUNNING';

  async function load(preferId?: string | null) {
    setBusy(true);
    setError('');
    try {
      const [next, dashboard] = await Promise.all([
        intelligenceApi.failures(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const items = next.failures ?? [];
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

  const failures = overview?.failures ?? [];
  const metrics = overview?.metrics;
  const meta = overview?.meta;
  const needle = query.trim().toLowerCase();

  const severities = useMemo(
    () => [...new Set(failures.map((item) => item.severity))].sort(),
    [failures],
  );
  const statuses = useMemo(
    () => [...new Set(failures.map((item) => item.recoveryStatus))].sort(),
    [failures],
  );
  const categories = useMemo(
    () => [...new Set(failures.map((item) => item.category))].sort(),
    [failures],
  );

  const filtered = useMemo(
    () =>
      failures.filter((item) =>
        matchesFailure(item, needle, severityFilter, statusFilter, categoryFilter, sourceFilter),
      ),
    [failures, needle, severityFilter, statusFilter, categoryFilter, sourceFilter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    failures.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const stageStatus = packageLabel(overview, systemRunning);
  const maxCategory = Math.max(1, ...(overview?.categories.map((item) => item.count) ?? [1]));

  const kpis = useMemo(() => {
    const m = metrics;
    return [
      {
        label: 'System Health',
        value: m?.systemHealth != null ? `${m.systemHealth}%` : 'UNMEAS.',
        meta: 'Derived from active/critical share',
        accent: '#22C55E',
        icon: HeartPulse,
        bars: sparkBars(m?.systemHealth ?? 0),
        drill: 'overview' as TabId,
      },
      {
        label: 'Recovery Success Rate',
        value: m?.recoverySuccessRate != null ? `${m.recoverySuccessRate}%` : 'UNMEAS.',
        meta: 'Recovered / closed incidents',
        accent: '#2563EB',
        icon: ShieldCheck,
        bars: sparkBars(m?.recoverySuccessRate ?? 0),
        drill: 'analytics' as TabId,
      },
      {
        label: 'Active Failures',
        value: String(m?.activeFailures ?? 0),
        meta: 'Open / retrying / recovering',
        accent: '#F59E0B',
        icon: AlertTriangle,
        bars: sparkBars(m?.activeFailures ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Critical Failures',
        value: String(m?.criticalFailures ?? 0),
        meta: 'Severity CRITICAL open',
        accent: '#EF4444',
        icon: ShieldAlert,
        bars: sparkBars(m?.criticalFailures ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Warnings',
        value: String(m?.warnings ?? 0),
        meta: 'MEDIUM / LOW open',
        accent: '#F97316',
        icon: AlertTriangle,
        bars: sparkBars(m?.warnings ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Recovered Jobs',
        value: String(m?.recoveredJobs ?? 0),
        meta: 'Recovery status RECOVERED',
        accent: '#14B8A6',
        icon: CheckCircle2,
        bars: sparkBars(m?.recoveredJobs ?? 0),
        drill: 'recovery' as TabId,
      },
      {
        label: 'Auto-Healed Jobs',
        value: String(m?.autoHealedJobs ?? 0),
        meta: 'Recovered via retries',
        accent: '#7C3AED',
        icon: Wrench,
        bars: sparkBars(m?.autoHealedJobs ?? 0),
        drill: 'recovery' as TabId,
      },
      {
        label: 'Pending Recovery',
        value: String(m?.pendingRecovery ?? 0),
        meta: 'Pending / diagnosing / recovering',
        accent: '#0EA5E9',
        icon: Timer,
        bars: sparkBars(m?.pendingRecovery ?? 0),
        drill: 'recovery' as TabId,
      },
      {
        label: 'Retry Queue',
        value: String(m?.retryQueue ?? 0),
        meta: 'RETRYING status',
        accent: '#F59E0B',
        icon: RefreshCw,
        bars: sparkBars(m?.retryQueue ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Dead Letter Queue',
        value: String(m?.deadLetterQueue ?? 0),
        meta: 'Max attempts exhausted',
        accent: '#64748B',
        icon: Layers3,
        bars: sparkBars(m?.deadLetterQueue ?? 0),
        drill: 'deadletter' as TabId,
      },
      {
        label: 'Average Recovery Time',
        value:
          m?.averageRecoveryTimeMs != null
            ? `${Math.round(m.averageRecoveryTimeMs / 1000)}s`
            : 'UNMEAS.',
        meta: 'Detected → recovered',
        accent: '#0EA5E9',
        icon: Gauge,
        bars: sparkBars(m?.averageRecoveryTimeMs ?? 0),
        drill: 'analytics' as TabId,
      },
      {
        label: 'Failure Prediction Accuracy',
        value: 'UNMEAS.',
        meta: 'No prediction scores persisted',
        accent: '#94A3B8',
        icon: BrainCircuit,
        bars: sparkBars(0),
        drill: 'analytics' as TabId,
      },
      {
        label: 'Infrastructure Health',
        value: 'UNMEAS.',
        meta: 'Host metrics not in CI tables',
        accent: '#94A3B8',
        icon: Activity,
        bars: sparkBars(0),
        drill: 'infrastructure' as TabId,
      },
      {
        label: 'Workflow Availability',
        value: m?.workflowAvailability != null ? `${m.workflowAvailability}%` : 'UNMEAS.',
        meta: 'Inverse of active incident share',
        accent: '#22C55E',
        icon: Workflow,
        bars: sparkBars(m?.workflowAvailability ?? 0),
        drill: 'overview' as TabId,
      },
      {
        label: 'Data Integrity',
        value: 'UNMEAS.',
        meta: 'No integrity probe persisted',
        accent: '#94A3B8',
        icon: ShieldCheck,
        bars: sparkBars(0),
        drill: 'overview' as TabId,
      },
      {
        label: 'AI Confidence',
        value: m?.aiConfidence != null ? String(m.aiConfidence) : 'UNMEAS.',
        meta: 'Mean diagnosis confidence',
        accent: '#8B5CF6',
        icon: BrainCircuit,
        bars: sparkBars(m?.aiConfidence ?? 0),
        drill: 'diagnosis' as TabId,
      },
    ];
  }, [metrics]);

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
        <p className={styles.crumb}>
          Content Lifecycle / 02 Content Intelligence / Failure & Recovery
        </p>
        <h1 className={styles.title}>AI Failure Detection & Self-Healing Centre</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Failure recovery unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  const issues = overview?.issues ?? [];
  const audit = overview?.audit ?? [];
  const showEmptyHero = Boolean(overview?.strategy) && failures.length === 0;
  const showWaitingStrategy = !overview?.strategy;

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 02 Content Intelligence / Failure & Recovery
          </p>
          <h1 className={styles.title}>AI Failure Detection & Self-Healing Centre</h1>
          <p className={styles.lede}>
            Continuously detect, diagnose, recover and learn from autonomous workflow failures while
            maintaining uninterrupted content intelligence operations.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 02 Resilience</span>
          <span className={`${styles.badge} ${statusTone(stageStatus)}`}>{stageStatus}</span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Health {measured(meta?.systemHealth)}
            {meta?.systemHealth != null ? '%' : ''}
          </span>
          <span className={`${styles.badge} ${statusTone(overview?.strategy?.status)}`}>
            Strategy v{overview?.strategy?.versionNumber ?? '—'}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            {display(meta?.queueStatus)}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous self-healing</strong>
          Incidents come from persisted <code>ci_blockers</code>, <code>ci_jobs</code>, discovery
          run failures, and handoff errors. Host CPU/GPU/Redis metrics stay UNMEASURED until
          infrastructure probes are written.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
          <span style={{ marginLeft: 12 }}>
            <button
              type="button"
              className={styles.chip}
              onClick={() => overview && exportPayload(overview, 'json')}
            >
              <Download size={12} aria-hidden /> JSON
            </button>{' '}
            <button
              type="button"
              className={styles.chip}
              onClick={() => overview && exportPayload(overview, 'csv')}
            >
              <Download size={12} aria-hidden /> CSV
            </button>
          </span>
        </div>
      </div>

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Failure KPI summary">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              type="button"
              className={styles.kpiCard}
              style={{ ['--accent' as string]: kpi.accent }}
              title={kpi.meta}
              onClick={() => setTab(kpi.drill)}
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
            </button>
          );
        })}
      </section>

      <section className={styles.lifecycle} aria-label="Autonomous recovery pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Autonomous recovery pipeline</h2>
          <span>
            {overview?.strategy
              ? `Package ACK · run ${overview.run?.status ?? 'IDLE'}`
              : `Awaiting Strategy package · system ${systemState}`}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {(overview?.pipeline ?? []).map((stage) => (
            <div key={stage.key} className={styles.stage} data-state={stage.state}>
              <span className={styles.stageIcon}>
                <Workflow size={14} aria-hidden />
              </span>
              <strong>{stage.label}</strong>
              <span className={styles.pipelineMeta}>
                {stage.recordsProcessed} · q {stage.queueDepth} · conf {measured(stage.confidence)}{' '}
                · health {measured(stage.healthScore)}
                {stage.successRate != null ? ` · ${stage.successRate}%` : ''}
                {stage.latencyMs != null ? ` · ${stage.latencyMs}ms` : ' · lat UNMEAS.'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {showWaitingStrategy ? (
        <div className={styles.waitingBanner} role="status">
          <Timer size={18} aria-hidden />
          <div>
            <strong>Waiting for Strategy activation</strong>
            Failure monitoring activates with an acknowledged Strategy package and discovery /
            job workers.
          </div>
        </div>
      ) : null}

      {showEmptyHero ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>
              Autonomous Failure Recovery continuously monitors all Content Intelligence workflows.
              When failures occur, AI will automatically diagnose, repair and resume processing.
            </h2>
            <p className={styles.lede}>
              Detection → classification → root cause → dependency check → recovery planning →
              auto-healing → validation → resume → learning — with full audit trails and no manual
              intervention except emergency overrides.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Detect</strong>
              Blockers, jobs, runs, handoffs
            </li>
            <li>
              <strong>2. Diagnose</strong>
              Classify + root cause
            </li>
            <li>
              <strong>3. Heal</strong>
              Retry / rebuild / resume
            </li>
            <li>
              <strong>4. Learn</strong>
              Audit + prevention updates
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Failure recovery workspace">
        <aside className={styles.panel} aria-label="Incident Explorer">
          <div className={styles.panelHead}>
            <h2>Incident Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search failure & recovery…"
                aria-label="Search failure and recovery"
              />
            </label>
            <label className={styles.field}>
              <span>Severity</span>
              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
                aria-label="Filter by severity"
              >
                <option value="all">All severities</option>
                {severities.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Recovery status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by recovery status"
              >
                <option value="all">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Category</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Filter by category"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Source</span>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                aria-label="Filter by source"
              >
                <option value="all">All sources</option>
                <option value="blocker">Blocker</option>
                <option value="job">Job</option>
                <option value="run">Run</option>
                <option value="handoff">Handoff</option>
              </select>
            </label>

            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No persisted incidents match the current filters.</p>
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
                        setTab('diagnosis');
                      }}
                    >
                      <span className={styles.explorerTitle}>{item.message.slice(0, 80)}</span>
                      <span className={styles.explorerMeta}>
                        {item.module} · {item.category}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.severity)}`}>
                          {item.severity}
                        </span>
                        <span className={`${styles.chip} ${statusTone(item.recoveryStatus)}`}>
                          {item.recoveryStatus}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Recovery intelligence">
          <div className={styles.tabs} role="tablist" aria-label="Failure tabs">
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
            {tab === 'overview' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Resilience posture</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>System health</dt>
                      <dd>{measured(meta?.systemHealth)}{meta?.systemHealth != null ? '%' : ''}</dd>
                    </div>
                    <div>
                      <dt>Workflow availability</dt>
                      <dd>
                        {measured(meta?.workflowAvailability)}
                        {meta?.workflowAvailability != null ? '%' : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Active / critical</dt>
                      <dd>
                        {metrics?.activeFailures ?? 0} / {metrics?.criticalFailures ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt>Recovered / DLQ</dt>
                      <dd>
                        {metrics?.recoveredJobs ?? 0} / {metrics?.deadLetterQueue ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt>Last incident</dt>
                      <dd>
                        {meta?.lastIncident
                          ? new Date(meta.lastIncident).toLocaleString()
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Self-healing rules</h3>
                  <ul className={styles.bulletList}>
                    <li>Detect → classify → diagnose → repair → retry → validate → resume</li>
                    <li>Adaptive retries from attempt_count / max_attempts</li>
                    <li>Dead-letter when attempts exhausted</li>
                    <li>Learning updates recorded via audit trail</li>
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Selected snapshot</h3>
                  <p>{selected?.message ?? 'Select an incident for diagnosis.'}</p>
                  <p className={styles.lede}>{selected?.rootCause}</p>
                </article>
              </div>
            ) : null}

            {tab === 'queue' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Active failure queue</h3>
                  {!filtered.length ? (
                    <p className={styles.lede}>No incidents in the current filter set.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">ID</th>
                          <th scope="col">Module</th>
                          <th scope="col">Severity</th>
                          <th scope="col">Type</th>
                          <th scope="col">Status</th>
                          <th scope="col">Retries</th>
                          <th scope="col">Detected</th>
                          <th scope="col">Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice(0, 50).map((item) => (
                          <tr key={item.id}>
                            <td>{item.id.slice(0, 18)}</td>
                            <td>{item.module}</td>
                            <td>{item.severity}</td>
                            <td>{item.category}</td>
                            <td>{item.recoveryStatus}</td>
                            <td>
                              {item.retries}
                              {item.maxAttempts != null ? `/${item.maxAttempts}` : ''}
                            </td>
                            <td>{new Date(item.detectedAt).toLocaleString()}</td>
                            <td>{item.impact}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {selected && tab === 'diagnosis' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>AI diagnosis report</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Executive summary</dt>
                      <dd>{selected.diagnosis.summary}</dd>
                    </div>
                    <div>
                      <dt>Root cause</dt>
                      <dd>{selected.rootCause}</dd>
                    </div>
                    <div>
                      <dt>Probability</dt>
                      <dd>{measured(selected.diagnosis.probability)}</dd>
                    </div>
                    <div>
                      <dt>Confidence</dt>
                      <dd>{measured(selected.confidence)}</dd>
                    </div>
                    <div>
                      <dt>Impact</dt>
                      <dd>{selected.impact}</dd>
                    </div>
                    <div>
                      <dt>Correlation</dt>
                      <dd>{display(selected.correlationId)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Recovery plan</h3>
                  <ul className={styles.bulletList}>
                    {selected.diagnosis.recoveryPlan.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Preventive actions</h3>
                  <ul className={styles.bulletList}>
                    {selected.diagnosis.preventiveActions.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {selected && tab === 'recovery' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Intelligent recovery</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Status</dt>
                      <dd>{selected.recoveryStatus}</dd>
                    </div>
                    <div>
                      <dt>Method</dt>
                      <dd>{display(selected.recoveryMethod)}</dd>
                    </div>
                    <div>
                      <dt>Retries</dt>
                      <dd>
                        {selected.retries}
                        {selected.maxAttempts != null ? ` / ${selected.maxAttempts}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Next attempt</dt>
                      <dd>
                        {selected.nextAttemptAt
                          ? new Date(selected.nextAttemptAt).toLocaleString()
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Recommendation</dt>
                      <dd>{display(selected.recommendation)}</dd>
                    </div>
                  </dl>
                  <p className={styles.lede}>
                    Recovery actions are executed by workers — this page is observe-only (except
                    global emergency stop).
                  </p>
                </article>
                <article className={styles.detailCard}>
                  <h3>Self-healing dashboard</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Auto-healed</dt>
                      <dd>{metrics?.autoHealedJobs ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Recovery %</dt>
                      <dd>
                        {metrics?.recoverySuccessRate != null
                          ? `${metrics.recoverySuccessRate}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Avg recovery time</dt>
                      <dd>
                        {metrics?.averageRecoveryTimeMs != null
                          ? `${Math.round(metrics.averageRecoveryTimeMs / 1000)}s`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'deadletter' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Dead letter queue</h3>
                  {!(overview?.deadLetter.length) ? (
                    <p className={styles.lede}>No dead-letter jobs persisted.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Job</th>
                          <th scope="col">Reason</th>
                          <th scope="col">Attempts</th>
                          <th scope="col">Last error</th>
                          <th scope="col">Suggestion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.deadLetter.map((item) => (
                          <tr key={item.id}>
                            <td>{item.module}</td>
                            <td>{item.message.slice(0, 80)}</td>
                            <td>
                              {item.retries}
                              {item.maxAttempts != null ? `/${item.maxAttempts}` : ''}
                            </td>
                            <td>{display(item.lastError)}</td>
                            <td>{display(item.recommendation)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'categories' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Failure classification</h3>
                  <div className={styles.waterfall}>
                    {(overview?.categories ?? []).map((item) => (
                      <div key={item.category} className={styles.waterfallRow}>
                        <span>{item.category}</span>
                        <div className={styles.radarBar}>
                          <div
                            className={styles.radarFill}
                            style={{
                              width: `${Math.min(100, (item.count / maxCategory) * 100)}%`,
                            }}
                          />
                        </div>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'infrastructure' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Infrastructure monitor</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th scope="col">Component</th>
                        <th scope="col">Status</th>
                        <th scope="col">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overview?.infrastructure ?? []).map((item) => (
                        <tr key={item.key}>
                          <td>{item.label}</td>
                          <td>{item.status}</td>
                          <td>{measured(item.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className={styles.lede}>
                    Host-level probes are UNMEASURED in Content Intelligence tables; queue depth and
                    workflow availability are derived from persisted incidents only.
                  </p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'timeline' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Incident timeline</h3>
                  <ul className={styles.timeline}>
                    {selected.timeline.map((step) => (
                      <li key={step.key}>
                        <CircleDot size={14} aria-hidden />
                        <div>
                          <strong>
                            {step.label}
                            {step.done ? ' ✓' : ''}
                          </strong>
                          <span>
                            {step.at ? new Date(step.at).toLocaleString() : 'Pending / UNMEASURED'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'analytics' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Recovery analytics</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Active failures</dt>
                      <dd>{metrics?.activeFailures ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Recovered</dt>
                      <dd>{metrics?.recoveredJobs ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Success rate</dt>
                      <dd>
                        {metrics?.recoverySuccessRate != null
                          ? `${metrics.recoverySuccessRate}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Retry queue</dt>
                      <dd>{metrics?.retryQueue ?? 0}</dd>
                    </div>
                    <div>
                      <dt>DLQ</dt>
                      <dd>{metrics?.deadLetterQueue ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Avg resolution</dt>
                      <dd>
                        {metrics?.averageRecoveryTimeMs != null
                          ? `${Math.round(metrics.averageRecoveryTimeMs / 1000)}s`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>SLA dashboard</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Availability</dt>
                      <dd>
                        {measured(metrics?.workflowAvailability)}
                        {metrics?.workflowAvailability != null ? '%' : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>MTTR</dt>
                      <dd>
                        {metrics?.averageRecoveryTimeMs != null
                          ? `${Math.round(metrics.averageRecoveryTimeMs / 1000)}s`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>MTBF</dt>
                      <dd>UNMEASURED</dd>
                    </div>
                    <div>
                      <dt>Prediction accuracy</dt>
                      <dd>UNMEASURED</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'recommendations' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>AI recommendations</h3>
                  {!overview?.recommendations.length ? (
                    <p className={styles.lede}>No resilience recommendations from current state.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Action</th>
                          <th scope="col">Reason</th>
                          <th scope="col">Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.recommendations.map((item) => (
                          <tr key={item.id}>
                            <td>{item.action}</td>
                            <td>{item.reason}</td>
                            <td>{item.priority}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Audit trail</h3>
                  {!audit.length ? (
                    <p className={styles.lede}>No recovery-related audit events persisted yet.</p>
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

            {!selected && (tab === 'diagnosis' || tab === 'recovery' || tab === 'timeline') ? (
              <div className={styles.emptyInline}>
                <Layers3 size={22} aria-hidden />
                <p>Select an incident to inspect diagnosis, recovery plan, and timeline.</p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.insights}`} aria-label="AI Insights">
          <div className={styles.panelHead}>
            <h2>AI Explainability</h2>
            <BrainCircuit size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightStack}>
              <article className={styles.insightCard}>
                <h3>What happened</h3>
                <p>{selected?.message ?? 'Select an incident for XAI detail.'}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Why / root cause</h3>
                <p>{selected?.rootCause ?? '—'}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Recovery performed</h3>
                <p>
                  {selected
                    ? `${selected.recoveryStatus} · ${display(selected.recoveryMethod)} · conf ${measured(selected.confidence)}`
                    : `Active ${metrics?.activeFailures ?? 0} · healed ${metrics?.autoHealedJobs ?? 0}`}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Alerts</h3>
                <ul className={styles.bulletList}>
                  {issues.slice(0, 6).map((issue) => (
                    <li key={issue.id}>
                      [{issue.severity}] {issue.message}
                    </li>
                  ))}
                  {!issues.length ? <li>No open resilience alerts.</li> : null}
                </ul>
              </article>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.bottom} aria-label="Failure monitoring">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Automation</h2>
            <Wrench size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              On failure, workers detect, classify, diagnose, repair, retry, validate, resume, update
              learning, and audit. No manual intervention on this page except global emergency stop.
            </p>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Learning</h2>
            <RefreshCw size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Recovered</dt>
                <dd>{metrics?.recoveredJobs ?? 0}</dd>
              </div>
              <div>
                <dt>DLQ lessons</dt>
                <dd>{metrics?.deadLetterQueue ?? 0}</dd>
              </div>
            </dl>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Last updated</h2>
            <CheckCircle2 size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              {overview?.lastUpdated
                ? new Date(overview.lastUpdated).toLocaleString()
                : '—'}
            </p>
          </div>
        </article>
      </section>
    </motion.main>
  );
}
