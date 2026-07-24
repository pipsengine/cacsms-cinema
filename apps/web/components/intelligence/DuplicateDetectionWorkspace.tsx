'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Copy,
  EyeOff,
  Gauge,
  GitBranch,
  GitMerge,
  Layers3,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  XCircle,
} from 'lucide-react';
import type {
  DuplicateDetectionOverview,
  DuplicateRecord,
} from '@/lib/content-intelligence/duplicates';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import styles from './duplicate-detection.module.css';

type TabId =
  | 'overview'
  | 'matches'
  | 'clusters'
  | 'reasoning'
  | 'resolution'
  | 'history'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'matches', label: 'Matches' },
  { id: 'clusters', label: 'Clusters' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'resolution', label: 'Resolution' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'scan', label: 'Scan', icon: ScanSearch },
  { key: 'compare', label: 'Compare', icon: Copy },
  { key: 'cluster', label: 'Cluster', icon: Layers3 },
  { key: 'score', label: 'Score', icon: Gauge },
  { key: 'resolve', label: 'Resolve', icon: GitMerge },
  { key: 'approve', label: 'Approve', icon: ShieldCheck },
  { key: 'handoff', label: 'Handoff', icon: GitBranch },
] as const;

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'PASSED':
    case 'VERIFIED':
    case 'ACCEPTED':
    case 'APPROVED':
    case 'QUALIFIED':
    case 'HANDED_OFF':
    case 'COMPLETED':
    case 'RUNNING':
    case 'ACKNOWLEDGED':
    case 'ACTIVE':
    case 'RESOLVED':
    case 'MATCHED':
    case 'HEALTHY':
    case 'OPERATIONAL':
      return styles.toneReady;
    case 'FAILED':
    case 'REJECTED':
    case 'BLOCKED':
    case 'ARCHIVED':
    case 'CRITICAL':
    case 'IGNORED':
      return styles.toneBlocked;
    case 'PENDING':
    case 'QUEUED':
    case 'WARNING':
    case 'WAITING':
    case 'SCANNING':
    case 'OPEN':
    case 'ANALYSING':
    case 'IN_PROGRESS':
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

function matchesDuplicate(
  item: DuplicateRecord,
  needle: string,
  status: string,
  category: string,
  similarityBand: string,
  resolution: string,
) {
  if (status !== 'all' && item.status !== status) return false;
  if (category !== 'all' && item.domain !== category) return false;
  if (resolution !== 'all' && item.resolutionStatus !== resolution) return false;
  if (similarityBand === 'high' && !(item.measuredSimilarity && (item.similarity ?? 0) >= 85)) {
    return false;
  }
  if (
    similarityBand === 'medium' &&
    !(item.measuredSimilarity && (item.similarity ?? 0) >= 50 && (item.similarity ?? 0) < 85)
  ) {
    return false;
  }
  if (similarityBand === 'low' && !(item.measuredSimilarity && (item.similarity ?? 0) < 50)) {
    return false;
  }
  if (similarityBand === 'unmeasured' && item.measuredSimilarity) return false;
  if (!needle) return true;
  const haystack = [
    item.title,
    item.summary,
    item.domain,
    item.status,
    item.matchTitle,
    item.clusterLabel,
    item.recommendedAction,
    item.resolutionStatus,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function lifecycleState(
  index: number,
  overview: DuplicateDetectionOverview | null,
  systemRunning: boolean,
) {
  const scanned = overview?.metrics.itemsScanned ?? 0;
  const duplicates = overview?.metrics.duplicates ?? 0;
  const resolved =
    (overview?.metrics.merged ?? 0) +
    (overview?.metrics.ignored ?? 0) +
    (overview?.records ?? []).filter((item) => item.resolutionStatus === 'resolved').length;
  const runStatus = overview?.run?.status;
  const hasPackage = Boolean(overview?.strategy);
  const clusters = overview?.clusters?.length ?? 0;

  if (scanned > 0 && duplicates > 0 && resolved >= duplicates && runStatus === 'COMPLETED') {
    if (index <= 5) return 'done';
    return index === 6 ? 'active' : 'pending';
  }
  if (scanned > 0 && (runStatus === 'RUNNING' || systemRunning)) {
    if (index <= 2) return 'done';
    if (index === 3) return 'active';
    return 'pending';
  }
  if (scanned > 0) {
    if (index <= 1) return 'done';
    if (index === 2) return clusters > 0 ? 'done' : 'active';
    if (index === 3) return duplicates > 0 ? 'done' : 'active';
    if (index === 4) return resolved > 0 ? 'done' : duplicates > 0 ? 'active' : 'pending';
    if (index === 5) return resolved > 0 ? 'active' : 'pending';
    return 'pending';
  }
  if (hasPackage || systemRunning || runStatus === 'RUNNING' || runStatus === 'QUEUED') {
    return index === 0 ? 'active' : 'pending';
  }
  return 'pending';
}

function packageLabel(overview: DuplicateDetectionOverview | null, systemRunning: boolean) {
  if ((overview?.metrics.highRisk ?? 0) > 0) return 'Warning';
  if (overview?.run?.status === 'FAILED') return 'Failed';
  if (overview?.run?.status === 'RUNNING' || systemRunning) {
    return (overview?.metrics.itemsScanned ?? 0) > 0 ? 'Scanning' : 'Collecting';
  }
  const resolvedOpen =
    (overview?.records ?? []).some((item) => item.resolutionStatus === 'resolved') ||
    (overview?.metrics.merged ?? 0) > 0;
  if (resolvedOpen && (overview?.metrics.duplicates ?? 0) === 0) return 'Resolved';
  if ((overview?.metrics.duplicates ?? 0) > 0) return 'Matched';
  if ((overview?.metrics.itemsScanned ?? 0) > 0) return 'Active';
  if (overview?.strategy) return 'Waiting';
  return 'Empty';
}

export function DuplicateDetectionWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<DuplicateDetectionOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [similarityFilter, setSimilarityFilter] = useState('all');
  const [resolutionFilter, setResolutionFilter] = useState('all');
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
        intelligenceApi.duplicates(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const items = next.records ?? [];
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

  const records = overview?.records ?? [];
  const metrics = overview?.metrics;
  const needle = query.trim().toLowerCase();

  const statuses = useMemo(
    () => [...new Set(records.map((item) => item.status))].sort(),
    [records],
  );
  const categories = useMemo(
    () => [...new Set(records.map((item) => item.domain).filter(Boolean))].sort(),
    [records],
  );

  const filtered = useMemo(
    () =>
      records.filter((item) =>
        matchesDuplicate(
          item,
          needle,
          statusFilter,
          categoryFilter,
          similarityFilter,
          resolutionFilter,
        ),
      ),
    [records, needle, statusFilter, categoryFilter, similarityFilter, resolutionFilter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    records.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const kpis = useMemo(() => {
    const scanned = metrics?.itemsScanned ?? 0;
    const duplicates = metrics?.duplicates ?? 0;
    const measuredSim = (metrics?.measuredSimilarity ?? 0) > 0;
    const uniqueIdeas = metrics?.uniqueIdeas ?? 0;
    const merged = metrics?.merged ?? 0;
    const ignored = metrics?.ignored ?? 0;
    return [
      {
        label: 'Items Scanned',
        value: String(scanned),
        meta: 'Persisted ci_opportunities',
        accent: '#2563EB',
        icon: ScanSearch,
        bars: sparkBars(scanned),
      },
      {
        label: 'Duplicates',
        value: String(duplicates),
        meta: 'Similarity ≥ 70%',
        accent: '#EF4444',
        icon: Copy,
        bars: sparkBars(duplicates),
      },
      {
        label: 'Similarity Score',
        value: measuredSim ? String(metrics?.avgSimilarity ?? 0) : 'UNMEAS.',
        meta: measuredSim
          ? `${metrics?.measuredSimilarity} measured rows`
          : 'No duplicate_similarity persisted',
        accent: '#7C3AED',
        icon: Gauge,
        bars: sparkBars(metrics?.avgSimilarity ?? 0),
      },
      {
        label: 'Unique Ideas',
        value: String(uniqueIdeas),
        meta: 'Low similarity or resolved keep',
        accent: '#22C55E',
        icon: Target,
        bars: sparkBars(uniqueIdeas),
      },
      {
        label: 'Merged',
        value: String(merged),
        meta: 'MERGED / merge resolution',
        accent: '#0EA5E9',
        icon: GitMerge,
        bars: sparkBars(merged),
      },
      {
        label: 'Ignored',
        value: String(ignored),
        meta: 'REJECTED / ignored resolution',
        accent: '#F59E0B',
        icon: EyeOff,
        bars: sparkBars(ignored),
      },
    ];
  }, [metrics]);

  const stageStatus = packageLabel(overview, systemRunning);
  const pairs = overview?.pairs ?? [];
  const clusters = overview?.clusters ?? [];
  const selectedCluster = selected
    ? clusters.find((cluster) => cluster.id === selected.clusterId)
    : null;

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
          Content Lifecycle / 02 Content Intelligence / Duplicate Detection
        </p>
        <h1 className={styles.title}>Duplicate Detection</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Duplicate detection unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  const issues = overview?.issues ?? [];
  const audit = overview?.audit ?? [];

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 02 Content Intelligence / Duplicate Detection
          </p>
          <h1 className={styles.title}>Duplicate Detection</h1>
          <p className={styles.lede}>
            Autonomously detect semantic overlap across existing, planned, and generated content
            before Stage 03 Idea Qualification.
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
          Similarity comes from persisted <code>ci_opportunities.duplicate_similarity</code> and
          related score explanations. Overlap and recommendations stay UNMEASURED unless workers
          write them.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Duplicate detection KPI summary">
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

      <section className={styles.lifecycle} aria-label="Duplicate detection lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Duplicate lifecycle</h2>
          <span>
            {overview?.strategy
              ? `Package ACK · run ${overview.run?.status ?? 'IDLE'}`
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
            Duplicate detection activates after an acknowledged Strategy package and discovery
            persists opportunities with similarity scoring.
          </div>
        </div>
      ) : null}

      {overview?.strategy && records.length === 0 ? (
        <div className={styles.waitingBanner} role="status">
          <Activity size={18} aria-hidden />
          <div>
            <strong>Scanning for duplicates</strong>
            No opportunities are persisted yet. This workspace updates when discovery writes into{' '}
            <code>ci_opportunities</code>.
          </div>
        </div>
      ) : null}

      <section className={styles.workspace} aria-label="Duplicate detection workspace">
        <aside className={styles.panel} aria-label="Duplicate Explorer">
          <div className={styles.panelHead}>
            <h2>Duplicate Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search duplicate detection…"
                aria-label="Search duplicate detection"
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
              <span>Similarity</span>
              <select
                value={similarityFilter}
                onChange={(event) => setSimilarityFilter(event.target.value)}
                aria-label="Filter by similarity"
              >
                <option value="all">All similarity</option>
                <option value="high">High (≥85)</option>
                <option value="medium">Medium (50–84)</option>
                <option value="low">Low (&lt;50)</option>
                <option value="unmeasured">Unmeasured</option>
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
              <span>Resolution</span>
              <select
                value={resolutionFilter}
                onChange={(event) => setResolutionFilter(event.target.value)}
                aria-label="Filter by resolution"
              >
                <option value="all">All resolutions</option>
                <option value="open">Open</option>
                <option value="merged">Merged</option>
                <option value="ignored">Ignored</option>
                <option value="resolved">Resolved</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No persisted items match the current filters.</p>
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
                      <span className={styles.explorerTitle}>{item.title}</span>
                      <span className={styles.explorerMeta}>
                        {item.domain}
                        {item.matchTitle ? ` · vs ${item.matchTitle.slice(0, 28)}` : ''}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.resolutionStatus)}`}>
                          {item.resolutionStatus}
                        </span>
                        <span className={styles.chip}>
                          {item.measuredSimilarity
                            ? `${Math.round(item.similarity as number)}%`
                            : 'UNMEAS.'}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Duplicate Intelligence">
          <div className={styles.tabs} role="tablist" aria-label="Duplicate tabs">
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
            {!selected && tab !== 'audit' && tab !== 'matches' && tab !== 'clusters' ? (
              <div className={styles.emptyInline}>
                <Layers3 size={22} aria-hidden />
                <p>
                  {overview?.strategy
                    ? 'Select an item to inspect matches, clusters, and resolution guidance.'
                    : 'Persisted opportunities appear after discovery writes ci_opportunities.'}
                </p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Duplicate profile</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Title</dt>
                      <dd>{selected.title}</dd>
                    </div>
                    <div>
                      <dt>Category</dt>
                      <dd>{selected.domain}</dd>
                    </div>
                    <div>
                      <dt>Match</dt>
                      <dd>{display(selected.matchTitle)}</dd>
                    </div>
                    <div>
                      <dt>Similarity</dt>
                      <dd>
                        {selected.measuredSimilarity
                          ? `${Math.round(selected.similarity as number)}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Semantic overlap</dt>
                      <dd>{measured(selected.semanticOverlap)}</dd>
                    </div>
                    <div>
                      <dt>Uniqueness</dt>
                      <dd>{measured(selected.uniqueness)}</dd>
                    </div>
                    <div>
                      <dt>Recommended action</dt>
                      <dd>{selected.recommendedAction}</dd>
                    </div>
                    <div>
                      <dt>Next stage</dt>
                      <dd>{selected.nextStage}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Similarity gauge</h3>
                  <div className={styles.timelineStrip} aria-hidden>
                    <div className={styles.timelineAxis}>
                      <div
                        className={styles.timelineBand}
                        style={{
                          width: `${selected.measuredSimilarity ? Math.min(100, selected.similarity ?? 0) : 0}%`,
                          background: 'var(--primary)',
                        }}
                      />
                    </div>
                    <div className={styles.timelineLabels}>
                      <span>Similarity</span>
                      <span>
                        {selected.measuredSimilarity
                          ? `${Math.round(selected.similarity as number)}%`
                          : '—'}
                      </span>
                    </div>
                    <div className={styles.timelineAxis}>
                      <div
                        className={styles.timelineBand}
                        style={{
                          width: `${selected.semanticOverlap ?? 0}%`,
                          background: 'var(--ai)',
                        }}
                      />
                    </div>
                    <div className={styles.timelineLabels}>
                      <span>Token overlap</span>
                      <span>{selected.semanticOverlap != null ? `${selected.semanticOverlap}%` : '—'}</span>
                    </div>
                  </div>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Confidence</dt>
                      <dd>
                        {selected.measuredConfidence
                          ? Math.round(selected.confidence as number)
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Resolution</dt>
                      <dd>{selected.resolutionStatus}</dd>
                    </div>
                    <div>
                      <dt>Opportunity status</dt>
                      <dd>{selected.status}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Summary</h3>
                  <p>{selected.summary}</p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Evidence links</dt>
                      <dd>{selected.evidenceCount}</dd>
                    </div>
                    <div>
                      <dt>Cluster</dt>
                      <dd>{selected.clusterLabel}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'matches' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Duplicate pairs</h3>
                  {!pairs.length ? (
                    <p className={styles.lede}>
                      No paired matches yet. Pairs appear when similarity scores or cluster peers
                      are available.
                    </p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Left</th>
                          <th scope="col">Right</th>
                          <th scope="col">Similarity</th>
                          <th scope="col">Action</th>
                          <th scope="col">Cluster</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pairs.slice(0, 40).map((pair) => (
                          <tr key={pair.id}>
                            <td>{pair.leftTitle}</td>
                            <td>{pair.rightTitle}</td>
                            <td>
                              {pair.measuredSimilarity && pair.similarity != null
                                ? `${Math.round(pair.similarity)}%`
                                : 'UNMEASURED'}
                            </td>
                            <td>{pair.recommendedAction}</td>
                            <td>{pair.clusterId.slice(0, 24)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
                {selected ? (
                  <article className={styles.detailCard}>
                    <h3>Comparison panel</h3>
                    <dl className={styles.kv}>
                      <div>
                        <dt>Selected</dt>
                        <dd>{selected.title}</dd>
                      </div>
                      <div>
                        <dt>Matched content</dt>
                        <dd>{display(selected.matchTitle)}</dd>
                      </div>
                      <div>
                        <dt>Affected content</dt>
                        <dd>
                          {selectedCluster
                            ? `${selectedCluster.size} ideas in cluster`
                            : 'Single item'}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ) : null}
              </div>
            ) : null}

            {tab === 'clusters' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Cluster view</h3>
                  {!clusters.length ? (
                    <p className={styles.lede}>No multi-item clusters detected yet.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Cluster</th>
                          <th scope="col">Domain</th>
                          <th scope="col">Size</th>
                          <th scope="col">Avg similarity</th>
                          <th scope="col">Max</th>
                          <th scope="col">Open</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clusters.slice(0, 30).map((cluster) => (
                          <tr key={cluster.id}>
                            <td>{cluster.label}</td>
                            <td>{cluster.domain}</td>
                            <td>{cluster.size}</td>
                            <td>{measured(cluster.avgSimilarity)}</td>
                            <td>{measured(cluster.maxSimilarity)}</td>
                            <td>{cluster.openCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
                {selectedCluster ? (
                  <article className={styles.detailCard}>
                    <h3>Similarity matrix (selected cluster)</h3>
                    <div
                      className={styles.spark}
                      aria-hidden
                      style={{ height: 48, alignItems: 'flex-end', gap: 6 }}
                    >
                      {(selectedCluster.memberIds ?? []).slice(0, 8).map((memberId, index) => {
                        const member = records.find((row) => row.id === memberId);
                        const value = member?.similarity ?? member?.semanticOverlap ?? 0;
                        return (
                          <i
                            key={memberId}
                            style={{
                              height: `${Math.max(4, Math.min(44, (value / 100) * 44 || 4))}px`,
                              width: 18,
                              borderRadius: 4,
                              background: 'var(--primary)',
                              display: 'block',
                              opacity: member?.measuredSimilarity ? 1 : 0.25,
                            }}
                            title={member?.title ?? `Member ${index + 1}`}
                          />
                        );
                      })}
                    </div>
                    <p className={styles.lede}>
                      Bars reflect measured similarity for cluster members; faint bars are
                      UNMEASURED.
                    </p>
                  </article>
                ) : null}
              </div>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>AI explanation</h3>
                  <p>
                    {selected.explanation ??
                      'No duplicate explanation persisted. Similarity and cluster membership remain the authoritative signals.'}
                  </p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Trace ID</dt>
                      <dd>{selected.id}</dd>
                    </div>
                    <div>
                      <dt>Match ID</dt>
                      <dd>{display(selected.matchOpportunityId)}</dd>
                    </div>
                    <div>
                      <dt>Fuzzy / semantic overlap</dt>
                      <dd>{measured(selected.semanticOverlap)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Evidence traceability</h3>
                  {!selected.evidenceSubjects.length ? (
                    <p className={styles.lede}>No linked signal subjects for this opportunity.</p>
                  ) : (
                    <ul className={styles.bulletList}>
                      {selected.evidenceSubjects.map((subject) => (
                        <li key={subject}>{subject}</li>
                      ))}
                    </ul>
                  )}
                </article>
                <article className={styles.detailCard}>
                  <h3>Embeddings posture</h3>
                  <ul className={styles.bulletList}>
                    <li>
                      Persisted similarity:{' '}
                      {selected.measuredSimilarity
                        ? `${Math.round(selected.similarity as number)}%`
                        : 'UNMEASURED'}
                    </li>
                    <li>
                      Clustering key: {selected.clusterId}
                    </li>
                    <li>
                      Recommended action derived from similarity thresholds and resolution state.
                    </li>
                  </ul>
                </article>
              </div>
            ) : null}

            {selected && tab === 'resolution' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Resolution</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Status</dt>
                      <dd>{selected.resolutionStatus}</dd>
                    </div>
                    <div>
                      <dt>Recommended action</dt>
                      <dd>{selected.recommendedAction}</dd>
                    </div>
                    <div>
                      <dt>Next stage</dt>
                      <dd>{selected.nextStage}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Action guidance</h3>
                  <ul className={styles.bulletList}>
                    <li>
                      <strong>merge</strong> — retain canonical idea; collapse near-duplicates
                    </li>
                    <li>
                      <strong>keep</strong> — treat as unique enough for qualification
                    </li>
                    <li>
                      <strong>reject</strong> — ignore / exclude from Stage 03 handoff
                    </li>
                    <li>
                      <strong>review</strong> — awaiting autonomous or operator-resolved decision
                    </li>
                  </ul>
                  <p className={styles.lede}>
                    This workspace is observe-only; resolution is applied by lifecycle workers.
                  </p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'history' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Detection timeline</h3>
                  <ul className={styles.timeline}>
                    <li>
                      <CircleDot size={14} aria-hidden />
                      <div>
                        <strong>Created</strong>
                        <span>{new Date(selected.createdAt).toLocaleString()}</span>
                      </div>
                    </li>
                    <li>
                      <RefreshCw size={14} aria-hidden />
                      <div>
                        <strong>Last updated</strong>
                        <span>{new Date(selected.updatedAt).toLocaleString()}</span>
                      </div>
                    </li>
                    <li>
                      <Copy size={14} aria-hidden />
                      <div>
                        <strong>Similarity / resolution</strong>
                        <span>
                          {selected.measuredSimilarity
                            ? `${Math.round(selected.similarity as number)}%`
                            : 'UNMEASURED'}{' '}
                          · {selected.resolutionStatus} · {selected.recommendedAction}
                        </span>
                      </div>
                    </li>
                    <li>
                      <CheckCircle2 size={14} aria-hidden />
                      <div>
                        <strong>Next stage</strong>
                        <span>{selected.nextStage}</span>
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
                    <p className={styles.lede}>No duplicate-related audit events persisted yet.</p>
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
                <h3>Duplicate risk</h3>
                <p>
                  High-risk open {metrics?.highRisk ?? 0} · duplicates {metrics?.duplicates ?? 0} ·
                  open clusters {metrics?.openClusters ?? 0}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Merge suggestions</h3>
                <p>
                  {selected
                    ? `Recommend ${selected.recommendedAction} for “${selected.title.slice(0, 48)}${selected.title.length > 48 ? '…' : ''}”${selected.matchTitle ? ` vs “${selected.matchTitle.slice(0, 32)}”` : ''}.`
                    : `Merged ${metrics?.merged ?? 0} · ignored ${metrics?.ignored ?? 0}. Select an item for pair guidance.`}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Recommendations</h3>
                <ul className={styles.bulletList}>
                  {!overview?.strategy ? (
                    <li>Acknowledge Strategy package to unlock duplicate scanning.</li>
                  ) : null}
                  {overview?.strategy && records.length === 0 ? (
                    <li>Keep system RUNNING until discovery persists opportunities.</li>
                  ) : null}
                  {(metrics?.highRisk ?? 0) > 0 ? (
                    <li>Resolve high-similarity (≥85%) open pairs before qualification.</li>
                  ) : null}
                  {(metrics?.duplicates ?? 0) > 0 ? (
                    <li>Review merge/keep/reject actions on flagged duplicates.</li>
                  ) : null}
                  {(metrics?.uniqueIdeas ?? 0) > 0 && (metrics?.highRisk ?? 0) === 0 ? (
                    <li>Portfolio uniqueness looks ready for Stage 03 Idea Qualification.</li>
                  ) : null}
                </ul>
              </article>
              <article className={styles.insightCard}>
                <h3>Alerts</h3>
                {!issues.length ? (
                  <p>No open duplicate anomalies in persisted state.</p>
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

      <section className={styles.bottom} aria-label="Duplicate monitoring">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Health monitoring</h2>
            <AlertTriangle size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Duplicates</dt>
                <dd>{metrics?.duplicates ?? 0}</dd>
              </div>
              <div>
                <dt>High risk</dt>
                <dd>{metrics?.highRisk ?? 0}</dd>
              </div>
              <div>
                <dt>Merged</dt>
                <dd>{metrics?.merged ?? 0}</dd>
              </div>
              <div>
                <dt>Ignored</dt>
                <dd>{metrics?.ignored ?? 0}</dd>
              </div>
            </dl>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Prevention</h2>
            <XCircle size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              Semantic overlap is scored into <code>duplicate_similarity</code> during discovery.
              This page is observe-only — Start/Pause/Resume/Stop remain global.
            </p>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Stage 03 readiness</h2>
            <CheckCircle2 size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Unique ideas</dt>
                <dd>{metrics?.uniqueIdeas ?? 0}</dd>
              </div>
              <div>
                <dt>Open high risk</dt>
                <dd>{metrics?.highRisk ?? 0}</dd>
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
