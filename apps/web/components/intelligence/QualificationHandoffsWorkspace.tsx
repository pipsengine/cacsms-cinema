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
  FileCheck2,
  Gauge,
  GitBranch,
  Layers3,
  Package,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
} from 'lucide-react';
import type {
  HandoffPackage,
  QualificationHandoffsOverview,
} from '@/lib/content-intelligence/handoffs';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import styles from './qualification-handoffs.module.css';

type TabId =
  | 'overview'
  | 'queue'
  | 'package'
  | 'dependencies'
  | 'integrity'
  | 'receiving'
  | 'timeline'
  | 'analytics'
  | 'recommendations'
  | 'history'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'queue', label: 'Transfer Queue' },
  { id: 'package', label: 'Package Viewer' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'integrity', label: 'Integrity' },
  { id: 'receiving', label: 'Receiving' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'ACKNOWLEDGED':
    case 'COMPLETED':
    case 'IMPORTED':
    case 'READY':
    case 'PASSED':
    case 'RUNNING':
    case 'ACKNOWLEDGED_OK':
    case 'CLEAR':
    case 'ACTIVE':
    case 'SIGNED':
      return styles.toneReady;
    case 'FAILED':
    case 'REJECTED':
    case 'ROLLED_BACK':
    case 'CRITICAL':
    case 'BLOCKED':
      return styles.toneBlocked;
    case 'PENDING':
    case 'QUEUED':
    case 'VALIDATING':
    case 'RETRY':
    case 'RETRYING':
    case 'TRANSFERRED':
    case 'WARNING':
    case 'WAITING':
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

function packageLabel(overview: QualificationHandoffsOverview | null, systemRunning: boolean) {
  if (overview?.run?.status === 'FAILED') return 'Failed';
  if (systemRunning || overview?.run?.status === 'RUNNING') return 'Transferring';
  if ((overview?.metrics.failed ?? 0) > 0) return 'Recovery';
  if ((overview?.metrics.successful ?? 0) > 0) return 'Acknowledged';
  if ((overview?.metrics.queueSize ?? 0) > 0) return 'Queued';
  if ((overview?.metrics.ready ?? 0) > 0) return 'Ready';
  if (overview?.strategy) return 'Waiting';
  return 'Empty';
}

function matchesPackage(
  item: HandoffPackage,
  needle: string,
  status: string,
  topic: string,
  priority: string,
) {
  if (status !== 'all' && item.handoffStatus !== status && item.opportunityStatus !== status) {
    return false;
  }
  if (topic !== 'all' && item.domain !== topic) return false;
  if (priority === 'high' && !(item.rankPosition != null && item.rankPosition <= 10)) return false;
  if (
    priority === 'medium' &&
    !(item.rankPosition != null && item.rankPosition > 10 && item.rankPosition <= 30)
  ) {
    return false;
  }
  if (priority === 'low' && item.rankPosition != null && item.rankPosition <= 30) return false;
  if (!needle) return true;
  const haystack = [
    item.packageId,
    item.title,
    item.domain,
    item.audience,
    item.geography,
    item.handoffStatus,
    item.idempotencyKey,
    item.checksum,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function exportPayload(overview: QualificationHandoffsOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `qualification-handoffs-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'packageId',
    'title',
    'status',
    'score',
    'checksum',
    'retryCount',
    'acknowledgedAt',
  ];
  const lines = [
    header.join(','),
    ...overview.packages.map((item) =>
      [
        item.packageId,
        JSON.stringify(item.title),
        item.handoffStatus,
        item.measuredScore ? item.score : '',
        item.checksum,
        item.retryCount,
        item.acknowledgedAt ?? '',
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `qualification-handoffs-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function QualificationHandoffsWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<QualificationHandoffsOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
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
        intelligenceApi.handoffs(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const items = next.packages ?? [];
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

  const packages = overview?.packages ?? [];
  const metrics = overview?.metrics;
  const meta = overview?.meta;
  const needle = query.trim().toLowerCase();

  const statuses = useMemo(() => {
    const values = new Set<string>();
    for (const item of packages) {
      values.add(item.handoffStatus);
      values.add(item.opportunityStatus);
    }
    return [...values].sort();
  }, [packages]);
  const topics = useMemo(
    () => [...new Set(packages.map((item) => item.domain).filter(Boolean))].sort(),
    [packages],
  );

  const filtered = useMemo(
    () =>
      packages.filter((item) =>
        matchesPackage(item, needle, statusFilter, topicFilter, priorityFilter),
      ),
    [packages, needle, statusFilter, topicFilter, priorityFilter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    packages.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const stageStatus = packageLabel(overview, systemRunning);

  const kpis = useMemo(() => {
    const m = metrics;
    return [
      {
        label: 'Qualified Opportunities Ready',
        value: String(m?.ready ?? 0),
        meta: 'Ready / dependency-clear',
        accent: '#2563EB',
        icon: Package,
        bars: sparkBars(m?.ready ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Packages Generated',
        value: String(m?.packagesGenerated ?? 0),
        meta: 'Persisted ci_handoffs',
        accent: '#7C3AED',
        icon: FileCheck2,
        bars: sparkBars(m?.packagesGenerated ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Successful Handoffs',
        value: String(m?.successful ?? 0),
        meta: 'ACKNOWLEDGED / COMPLETED',
        accent: '#22C55E',
        icon: CheckCircle2,
        bars: sparkBars(m?.successful ?? 0),
        drill: 'receiving' as TabId,
      },
      {
        label: 'Failed Transfers',
        value: String(m?.failed ?? 0),
        meta: 'FAILED / REJECTED',
        accent: '#EF4444',
        icon: AlertTriangle,
        bars: sparkBars(m?.failed ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Pending Validation',
        value: String(m?.pendingValidation ?? 0),
        meta: 'Gaps or pending status',
        accent: '#F59E0B',
        icon: Timer,
        bars: sparkBars(m?.pendingValidation ?? 0),
        drill: 'dependencies' as TabId,
      },
      {
        label: 'Dependency Errors',
        value: String(m?.dependencyErrors ?? 0),
        meta: 'Failed dependency checks',
        accent: '#F97316',
        icon: ShieldAlert,
        bars: sparkBars(m?.dependencyErrors ?? 0),
        drill: 'dependencies' as TabId,
      },
      {
        label: 'Average Handoff Time',
        value:
          m?.averageHandoffTimeMs != null
            ? `${Math.round(m.averageHandoffTimeMs / 1000)}s`
            : 'UNMEAS.',
        meta: 'Created → acknowledged',
        accent: '#0EA5E9',
        icon: Gauge,
        bars: sparkBars(m?.averageHandoffTimeMs ?? 0),
        drill: 'analytics' as TabId,
      },
      {
        label: 'AI Confidence',
        value: m?.aiConfidence != null ? String(m.aiConfidence) : 'UNMEAS.',
        meta: 'Confidence / validation score',
        accent: '#8B5CF6',
        icon: BrainCircuit,
        bars: sparkBars(m?.aiConfidence ?? 0),
        drill: 'overview' as TabId,
      },
      {
        label: 'Digital Signatures',
        value: String(m?.digitalSignatures ?? 0),
        meta: 'Packages with checksum',
        accent: '#14B8A6',
        icon: ShieldCheck,
        bars: sparkBars(m?.digitalSignatures ?? 0),
        drill: 'integrity' as TabId,
      },
      {
        label: 'Queue Size',
        value: String(m?.queueSize ?? 0),
        meta: 'Pending / queued / ready',
        accent: '#2563EB',
        icon: Layers3,
        bars: sparkBars(m?.queueSize ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Retry Queue',
        value: String(m?.retryQueue ?? 0),
        meta: 'retry_count > 0 or RETRY',
        accent: '#F59E0B',
        icon: RefreshCw,
        bars: sparkBars(m?.retryQueue ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Rollback Queue',
        value: String(m?.rollbackQueue ?? 0),
        meta: 'ROLLED_BACK status',
        accent: '#64748B',
        icon: GitBranch,
        bars: sparkBars(m?.rollbackQueue ?? 0),
        drill: 'history' as TabId,
      },
      {
        label: 'Transfer Success Rate',
        value: m?.transferSuccessRate != null ? `${m.transferSuccessRate}%` : 'UNMEAS.',
        meta: 'Ack / packages generated',
        accent: '#22C55E',
        icon: Activity,
        bars: sparkBars(m?.transferSuccessRate ?? 0),
        drill: 'analytics' as TabId,
      },
      {
        label: 'Package Integrity',
        value: m?.packageIntegrity != null ? `${m.packageIntegrity}%` : 'UNMEAS.',
        meta: 'Mean integrity score',
        accent: '#0EA5E9',
        icon: ShieldCheck,
        bars: sparkBars(m?.packageIntegrity ?? 0),
        drill: 'integrity' as TabId,
      },
      {
        label: 'Receiving Module Status',
        value: 'UNMEAS.',
        meta: 'Idea Qualification health',
        accent: '#94A3B8',
        icon: Workflow,
        bars: sparkBars(0),
        drill: 'receiving' as TabId,
      },
      {
        label: 'Average Package Size',
        value: 'UNMEAS.',
        meta: 'No package size persisted',
        accent: '#94A3B8',
        icon: Package,
        bars: sparkBars(0),
        drill: 'package' as TabId,
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
          Content Lifecycle / 02 Content Intelligence / Idea Qualification Handoffs
        </p>
        <h1 className={styles.title}>Autonomous Qualification Handoff Centre</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Qualification handoffs unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  const issues = overview?.issues ?? [];
  const audit = overview?.audit ?? [];
  const showEmptyHero = Boolean(overview?.strategy) && packages.length === 0;
  const showWaitingStrategy = !overview?.strategy;

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 02 Content Intelligence / Idea Qualification Handoffs
          </p>
          <h1 className={styles.title}>Autonomous Qualification Handoff Centre</h1>
          <p className={styles.lede}>
            Package, validate, digitally sign and autonomously transfer qualified content
            opportunities into the Idea Qualification lifecycle.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 02 Gateway</span>
          <span className={`${styles.badge} ${statusTone(stageStatus)}`}>{stageStatus}</span>
          <span className={`${styles.badge} ${statusTone(overview?.strategy?.status)}`}>
            Strategy v{overview?.strategy?.versionNumber ?? '—'}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Queue {display(meta?.queueStatus)}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Last transfer{' '}
            {meta?.lastTransfer
              ? new Date(meta.lastTransfer).toLocaleString()
              : 'UNMEASURED'}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous bridge to Stage 03</strong>
          Packages, checksums, retries, and acknowledgements come from persisted{' '}
          <code>ci_handoffs</code>. Receiving health and package byte size stay UNMEASURED until
          workers publish them.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Handoff KPI summary">
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

      <section className={styles.lifecycle} aria-label="Autonomous handoff pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Autonomous handoff pipeline</h2>
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
                {stage.recordsProcessed} · q {stage.queueDepth} · conf {measured(stage.aiConfidence)}{' '}
                · health {measured(stage.healthScore)} · retry {stage.retries}
                {stage.durationMs != null ? ` · ${stage.durationMs}ms` : ' · dur UNMEAS.'}
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
            Handoffs begin after an acknowledged Strategy package and portfolio-optimized
            opportunities are ready for Stage 03.
          </div>
        </div>
      ) : null}

      {showEmptyHero ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>
              Qualified opportunities will automatically appear here after Content Intelligence has
              completed portfolio optimization and AI certification.
            </h2>
            <p className={styles.lede}>
              While Running, workers validate dependencies, assemble packages, attach checksums,
              transfer to Idea Qualification, and wait for acknowledgement — with full audit
              traceability.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Collect</strong>
              Qualified / selected opportunities
            </li>
            <li>
              <strong>2. Validate & sign</strong>
              Dependencies + SHA-256 checksum
            </li>
            <li>
              <strong>3. Transfer</strong>
              Durable handoff into Stage 03
            </li>
            <li>
              <strong>4. Acknowledge</strong>
              Record receiving response + audit
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Handoff workspace">
        <aside className={styles.panel} aria-label="Package Explorer">
          <div className={styles.panelHead}>
            <h2>Package Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search packages, topics, checksums…"
                aria-label="Search idea qualification handoffs"
              />
            </label>
            <label className={styles.field}>
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by status"
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
              <span>Topic</span>
              <select
                value={topicFilter}
                onChange={(event) => setTopicFilter(event.target.value)}
                aria-label="Filter by topic"
              >
                <option value="all">All topics</option>
                {topics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Priority</span>
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                aria-label="Filter by priority"
              >
                <option value="all">All priorities</option>
                <option value="high">High (rank ≤10)</option>
                <option value="medium">Medium (11–30)</option>
                <option value="low">Low / unranked</option>
              </select>
            </label>

            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No persisted packages match the current filters.</p>
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
                        setTab('package');
                      }}
                    >
                      <span className={styles.explorerTitle}>{item.title}</span>
                      <span className={styles.explorerMeta}>
                        {item.packageId.slice(0, 13)}
                        {item.rankPosition != null ? ` · Rank #${item.rankPosition}` : ''}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.handoffStatus)}`}>
                          {item.handoffStatus}
                        </span>
                        <span className={styles.chip}>
                          {item.measuredScore ? item.score.toFixed(1) : 'UNMEAS.'}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Handoff intelligence">
          <div className={styles.tabs} role="tablist" aria-label="Handoff tabs">
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
                  <h3>Gateway status</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Ready</dt>
                      <dd>{metrics?.ready ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Generated</dt>
                      <dd>{metrics?.packagesGenerated ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Success rate</dt>
                      <dd>
                        {metrics?.transferSuccessRate != null
                          ? `${metrics.transferSuccessRate}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Integrity</dt>
                      <dd>
                        {metrics?.packageIntegrity != null
                          ? `${metrics.packageIntegrity}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Next stage</dt>
                      <dd>03 Idea Qualification</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Automation</h3>
                  <ul className={styles.bulletList}>
                    <li>Collect qualified opportunities</li>
                    <li>Validate dependencies & evidence</li>
                    <li>Assemble metadata + rankings + portfolio</li>
                    <li>Digitally sign (checksum) and transfer</li>
                    <li>Wait for acknowledgement · audit · notify Stage 03</li>
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Selected recommendation</h3>
                  <p>{selected?.recommendation ?? 'Select a package for guidance.'}</p>
                  <p className={styles.lede}>{selected?.explainability}</p>
                </article>
              </div>
            ) : null}

            {tab === 'queue' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Transfer queue</h3>
                  {!filtered.length ? (
                    <p className={styles.lede}>No packages in queue.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Package</th>
                          <th scope="col">Opportunity</th>
                          <th scope="col">Score</th>
                          <th scope="col">Rank</th>
                          <th scope="col">Status</th>
                          <th scope="col">Retry</th>
                          <th scope="col">Checksum</th>
                          <th scope="col">Ack</th>
                          <th scope="col">Latency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice(0, 50).map((item) => (
                          <tr key={item.id}>
                            <td>{item.packageId.slice(0, 8)}</td>
                            <td>{item.title}</td>
                            <td>
                              {item.measuredScore ? item.score.toFixed(1) : 'UNMEASURED'}
                            </td>
                            <td>
                              {item.rankPosition != null ? `#${item.rankPosition}` : '—'}
                            </td>
                            <td>{item.handoffStatus}</td>
                            <td>{item.retryCount}</td>
                            <td>{item.checksum ? `${item.checksum.slice(0, 10)}…` : '—'}</td>
                            <td>
                              {item.acknowledgedAt
                                ? new Date(item.acknowledgedAt).toLocaleString()
                                : '—'}
                            </td>
                            <td>
                              {item.latencyMs != null
                                ? `${Math.round(item.latencyMs / 1000)}s`
                                : 'UNMEASURED'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {selected && tab === 'package' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Qualification package</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Package ID</dt>
                      <dd>{selected.packageId}</dd>
                    </div>
                    <div>
                      <dt>Opportunity</dt>
                      <dd>{selected.title}</dd>
                    </div>
                    <div>
                      <dt>Topic</dt>
                      <dd>{selected.domain}</dd>
                    </div>
                    <div>
                      <dt>Audience</dt>
                      <dd>{display(selected.audience)}</dd>
                    </div>
                    <div>
                      <dt>Geography</dt>
                      <dd>{display(selected.geography)}</dd>
                    </div>
                    <div>
                      <dt>Format</dt>
                      <dd>{display(selected.formatHint)}</dd>
                    </div>
                    <div>
                      <dt>Score / rank</dt>
                      <dd>
                        {selected.measuredScore ? selected.score.toFixed(2) : 'UNMEASURED'}
                        {selected.rankPosition != null ? ` · #${selected.rankPosition}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Strategy</dt>
                      <dd>v{display(selected.strategyVersion)}</dd>
                    </div>
                    <div>
                      <dt>Digital signature</dt>
                      <dd>{selected.digitalSignature}</dd>
                    </div>
                    <div>
                      <dt>Checksum</dt>
                      <dd>{selected.checksum || 'UNMEASURED'}</dd>
                    </div>
                    <div>
                      <dt>Idempotency</dt>
                      <dd>{selected.idempotencyKey || '—'}</dd>
                    </div>
                    <div>
                      <dt>Next stage</dt>
                      <dd>{selected.nextStage}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Certificate</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>AI model</dt>
                      <dd>{display(selected.modelVersion)}</dd>
                    </div>
                    <div>
                      <dt>AI confidence</dt>
                      <dd>{measured(selected.aiConfidence)}</dd>
                    </div>
                    <div>
                      <dt>Validation score</dt>
                      <dd>{measured(selected.validationScore)}</dd>
                    </div>
                    <div>
                      <dt>Integrity score</dt>
                      <dd>{measured(selected.integrityScore)}</dd>
                    </div>
                    <div>
                      <dt>Completeness</dt>
                      <dd>{measured(selected.completenessScore)}</dd>
                    </div>
                    <div>
                      <dt>Evidence</dt>
                      <dd>
                        {selected.evidenceCount} · verified {selected.verificationPassed}/
                        {selected.verificationFailed} fail
                      </dd>
                    </div>
                    <div>
                      <dt>Risk</dt>
                      <dd>{measured(selected.riskScore)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Explainability</h3>
                  <p>{selected.explainability}</p>
                  <p className={styles.lede}>
                    Recommendation: <strong>{selected.recommendation}</strong>
                  </p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'dependencies' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Dependency validation</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th scope="col">Dependency</th>
                        <th scope="col">Present</th>
                        <th scope="col">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.dependencies.map((dep) => (
                        <tr key={dep.key}>
                          <td>{dep.label}</td>
                          <td>{dep.present ? 'Yes' : 'No'}</td>
                          <td>{display(dep.detail)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'integrity' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Package integrity dashboard</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Integrity %</dt>
                      <dd>{measured(overview?.integrity.integrityPct)}</dd>
                    </div>
                    <div>
                      <dt>Missing fields</dt>
                      <dd>{overview?.integrity.missingFields ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Warnings</dt>
                      <dd>{overview?.integrity.warnings ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Validation errors</dt>
                      <dd>{overview?.integrity.validationErrors ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Dependency issues</dt>
                      <dd>{overview?.integrity.dependencyIssues ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Broken references</dt>
                      <dd>{overview?.integrity.brokenReferences ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Metadata completeness</dt>
                      <dd>{measured(overview?.integrity.metadataCompleteness)}</dd>
                    </div>
                    <div>
                      <dt>Evidence completeness</dt>
                      <dd>{measured(overview?.integrity.evidenceCompleteness)}</dd>
                    </div>
                    <div>
                      <dt>Overall health</dt>
                      <dd>{measured(overview?.integrity.overallHealth)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Selected missing fields</h3>
                  {selected?.missingFields.length ? (
                    <ul className={styles.bulletList}>
                      {selected.missingFields.map((field) => (
                        <li key={field}>{field}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.lede}>No missing fields on selected package.</p>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'receiving' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Receiving module — Idea Qualification</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Status</dt>
                      <dd>{display(overview?.receiving.status)}</dd>
                    </div>
                    <div>
                      <dt>Pending</dt>
                      <dd>{overview?.receiving.pending ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Acknowledged</dt>
                      <dd>{overview?.receiving.acknowledged ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Rejected</dt>
                      <dd>{overview?.receiving.rejected ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Failed</dt>
                      <dd>{overview?.receiving.failed ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Avg processing</dt>
                      <dd>
                        {overview?.receiving.averageProcessingMs != null
                          ? `${Math.round(overview.receiving.averageProcessingMs / 1000)}s`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Availability</dt>
                      <dd>{measured(overview?.receiving.availability)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Retry & recovery</h3>
                  <p className={styles.lede}>
                    Retries use persisted <code>retry_count</code>. Workers rebuild checksums and
                    re-queue on network/API failures. This page is observe-only.
                  </p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Retry queue</dt>
                      <dd>{metrics?.retryQueue ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Rollback queue</dt>
                      <dd>{metrics?.rollbackQueue ?? 0}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {selected && tab === 'timeline' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Real-time transfer monitor</h3>
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
                  <h3>Transfer analytics</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Volume (packages)</dt>
                      <dd>{metrics?.packagesGenerated ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Success %</dt>
                      <dd>
                        {metrics?.transferSuccessRate != null
                          ? `${metrics.transferSuccessRate}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Failures</dt>
                      <dd>{metrics?.failed ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Retry queue</dt>
                      <dd>{metrics?.retryQueue ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Avg handoff time</dt>
                      <dd>
                        {metrics?.averageHandoffTimeMs != null
                          ? `${Math.round(metrics.averageHandoffTimeMs / 1000)}s`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Queue growth</dt>
                      <dd>{metrics?.queueSize ?? 0}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Performance</h3>
                  <p className={styles.lede}>
                    Validation, packaging, API response, and AI decision timings remain UNMEASURED
                    until workers persist stage durations.
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'recommendations' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>AI recommendations</h3>
                  {!overview?.recommendations.length ? (
                    <p className={styles.lede}>No handoff recommendations from current state.</p>
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

            {tab === 'history' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Handoff history</h3>
                  <ul className={styles.timeline}>
                    <li>
                      <CircleDot size={14} aria-hidden />
                      <div>
                        <strong>Strategy package</strong>
                        <span>v{overview?.strategy?.versionNumber ?? '—'}</span>
                      </div>
                    </li>
                    <li>
                      <RefreshCw size={14} aria-hidden />
                      <div>
                        <strong>Last transfer</strong>
                        <span>
                          {meta?.lastTransfer
                            ? new Date(meta.lastTransfer).toLocaleString()
                            : 'UNMEASURED'}
                        </span>
                      </div>
                    </li>
                    <li>
                      <CheckCircle2 size={14} aria-hidden />
                      <div>
                        <strong>Successful / failed</strong>
                        <span>
                          {metrics?.successful ?? 0} ack · {metrics?.failed ?? 0} failed
                        </span>
                      </div>
                    </li>
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Audit trail</h3>
                  {!audit.length ? (
                    <p className={styles.lede}>No handoff-related audit events persisted yet.</p>
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

            {!selected &&
            (tab === 'package' || tab === 'dependencies' || tab === 'timeline') ? (
              <div className={styles.emptyInline}>
                <Layers3 size={22} aria-hidden />
                <p>Select a package to inspect contents, dependencies, and transfer timeline.</p>
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
                <h3>Why transferred / delayed</h3>
                <p>
                  {selected?.explainability ??
                    'Select a package to view transfer rationale and dependency results.'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Recommended action</h3>
                <p>{selected?.recommendation ?? `Queue size ${metrics?.queueSize ?? 0}`}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Notifications</h3>
                <ul className={styles.bulletList}>
                  {issues.slice(0, 6).map((issue) => (
                    <li key={issue.id}>
                      [{issue.severity}] {issue.message}
                    </li>
                  ))}
                  {!issues.length ? <li>No open handoff alerts.</li> : null}
                </ul>
              </article>
              <article className={styles.insightCard}>
                <h3>Stage 03 bridge</h3>
                <p>
                  Only checksum-signed, dependency-valid packages proceed into Idea Qualification.
                  This page does not accept manual transfer controls.
                </p>
              </article>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.bottom} aria-label="Handoff monitoring">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Automation</h2>
            <Workflow size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              On Start, workers package, validate, sign, transfer, await acknowledgement, audit, and
              notify Stage 03. No human interaction on this page.
            </p>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Integrity</h2>
            <ShieldCheck size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Integrity</dt>
                <dd>{measured(overview?.integrity.overallHealth)}</dd>
              </div>
              <div>
                <dt>Signatures</dt>
                <dd>{metrics?.digitalSignatures ?? 0}</dd>
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
