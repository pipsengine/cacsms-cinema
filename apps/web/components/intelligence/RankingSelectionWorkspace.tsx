'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Gauge,
  GitBranch,
  Layers3,
  ListOrdered,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Trophy,
} from 'lucide-react';
import type {
  RankingRecord,
  RankingSelectionOverview,
} from '@/lib/content-intelligence/ranking';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import styles from './ranking-selection.module.css';

type TabId =
  | 'overview'
  | 'rankings'
  | 'comparison'
  | 'reasoning'
  | 'portfolio'
  | 'history'
  | 'audit';

type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'portfolio', label: 'Portfolio Fit' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'score', label: 'Score', icon: Gauge },
  { key: 'rank', label: 'Rank', icon: ListOrdered },
  { key: 'compare', label: 'Compare', icon: Scale },
  { key: 'select', label: 'Select', icon: Trophy },
  { key: 'explain', label: 'Explain', icon: BrainCircuit },
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
    case 'SELECTED':
    case 'SHORTLISTED':
    case 'RANKED':
    case 'READY':
    case 'ACTIVE':
    case 'HEALTHY':
    case 'OPERATIONAL':
      return styles.toneReady;
    case 'FAILED':
    case 'REJECTED':
    case 'BLOCKED':
    case 'ARCHIVED':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'PENDING':
    case 'QUEUED':
    case 'WARNING':
    case 'WAITING':
    case 'SCORING':
    case 'UNRANKED':
    case 'HOLD':
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

function isHighPriority(item: RankingRecord) {
  return (
    (item.priority != null && item.priority <= 10) ||
    (item.rankPosition != null && item.rankPosition <= 10) ||
    (item.measuredScore && item.overallScore >= 75) ||
    item.selectionStatus.toUpperCase() === 'SELECTED' ||
    item.status === 'QUALIFIED' ||
    item.status === 'HANDED_OFF'
  );
}

function matchesCandidate(
  item: RankingRecord,
  needle: string,
  status: string,
  category: string,
  audience: string,
  priority: PriorityFilter,
) {
  if (status !== 'all' && item.status !== status && item.selectionStatus !== status) {
    return false;
  }
  if (category !== 'all' && item.domain !== category) return false;
  if (audience !== 'all' && (item.audience ?? '') !== audience) return false;
  if (priority === 'high' && !isHighPriority(item)) return false;
  if (priority === 'medium') {
    const mid =
      (item.measuredScore && item.overallScore >= 40 && item.overallScore < 75) ||
      (item.rankPosition != null && item.rankPosition > 10 && item.rankPosition <= 30);
    if (!mid) return false;
  }
  if (priority === 'low' && (isHighPriority(item) || (item.measuredScore && item.overallScore >= 40))) {
    return false;
  }
  if (!needle) return true;
  const haystack = [
    item.title,
    item.summary,
    item.domain,
    item.audience,
    item.geography,
    item.status,
    item.selectionStatus,
    item.recommendedAction,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function lifecycleState(
  index: number,
  overview: RankingSelectionOverview | null,
  systemRunning: boolean,
) {
  const candidates = overview?.metrics.candidates ?? 0;
  const ranked = overview?.metrics.ranked ?? 0;
  const selected = overview?.metrics.selected ?? 0;
  const ready = overview?.metrics.ready ?? 0;
  const runStatus = overview?.run?.status;
  const hasPackage = Boolean(overview?.strategy);
  const scored = overview?.metrics.measuredAiScore ?? 0;

  if (ready > 0 && selected > 0 && runStatus === 'COMPLETED') {
    if (index <= 5) return 'done';
    return index === 6 ? 'active' : 'pending';
  }
  if (candidates > 0 && (runStatus === 'RUNNING' || systemRunning)) {
    if (index === 0) return scored > 0 ? 'done' : 'active';
    if (index === 1) return ranked > 0 ? 'done' : 'active';
    if (index === 2) return ranked > 1 ? 'active' : 'pending';
    return 'pending';
  }
  if (candidates > 0) {
    if (index === 0) return scored > 0 ? 'done' : 'active';
    if (index === 1) return ranked > 0 ? 'done' : scored > 0 ? 'active' : 'pending';
    if (index === 2) return ranked > 1 ? 'done' : ranked > 0 ? 'active' : 'pending';
    if (index === 3) return selected > 0 ? 'done' : ranked > 0 ? 'active' : 'pending';
    if (index === 4) return selected > 0 ? 'done' : 'pending';
    if (index === 5) return ready > 0 ? 'active' : selected > 0 ? 'active' : 'pending';
    return ready > 0 ? 'active' : 'pending';
  }
  if (hasPackage || systemRunning || runStatus === 'RUNNING' || runStatus === 'QUEUED') {
    return index === 0 ? 'active' : 'pending';
  }
  return 'pending';
}

function packageLabel(overview: RankingSelectionOverview | null, systemRunning: boolean) {
  if ((overview?.metrics.blocked ?? 0) > 0) return 'Warning';
  if (overview?.run?.status === 'FAILED') return 'Failed';
  if (overview?.run?.status === 'RUNNING' || systemRunning) {
    if ((overview?.metrics.ranked ?? 0) > 0) return 'Ranking';
    return (overview?.metrics.measuredAiScore ?? 0) > 0 ? 'Scoring' : 'Collecting';
  }
  if ((overview?.metrics.ready ?? 0) > 0) return 'Ready';
  if ((overview?.metrics.selected ?? 0) > 0) return 'Selected';
  if ((overview?.metrics.ranked ?? 0) > 0) return 'Ranked';
  if ((overview?.metrics.measuredAiScore ?? 0) > 0) return 'Scoring';
  if ((overview?.metrics.candidates ?? 0) > 0) return 'Active';
  if (overview?.strategy) return 'Waiting';
  return 'Empty';
}

export function RankingSelectionWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<RankingSelectionOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
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
        intelligenceApi.ranking(),
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
      if (!compareIds.length && items.length >= 2) {
        setCompareIds(items.slice(0, 3).map((item) => item.id));
      }
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

  const statuses = useMemo(() => {
    const values = new Set<string>();
    for (const item of records) {
      values.add(item.status);
      if (item.selectionStatus) values.add(item.selectionStatus);
    }
    return [...values].sort();
  }, [records]);
  const categories = useMemo(
    () => [...new Set(records.map((item) => item.domain).filter(Boolean))].sort(),
    [records],
  );
  const audiences = useMemo(
    () => [...new Set(records.map((item) => item.audience).filter(Boolean) as string[])].sort(),
    [records],
  );

  const filtered = useMemo(
    () =>
      records.filter((item) =>
        matchesCandidate(item, needle, statusFilter, categoryFilter, audienceFilter, priorityFilter),
      ),
    [records, needle, statusFilter, categoryFilter, audienceFilter, priorityFilter],
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

  const rankedTable = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const ra = a.rankPosition ?? Number.MAX_SAFE_INTEGER;
        const rb = b.rankPosition ?? Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
        return b.overallScore - a.overallScore;
      }),
    [filtered],
  );

  const compareItems = useMemo(
    () =>
      compareIds
        .map((id) => records.find((item) => item.id === id))
        .filter((item): item is RankingRecord => Boolean(item)),
    [compareIds, records],
  );

  const kpis = useMemo(() => {
    const candidates = metrics?.candidates ?? 0;
    const ranked = metrics?.ranked ?? 0;
    const selectedCount = metrics?.selected ?? 0;
    const measuredAi = (metrics?.measuredAiScore ?? 0) > 0;
    const measuredFit = (metrics?.measuredPortfolioFit ?? 0) > 0;
    const ready = metrics?.ready ?? 0;
    return [
      {
        label: 'Candidates',
        value: String(candidates),
        meta: 'Persisted ci_opportunities',
        accent: '#2563EB',
        icon: Target,
        bars: sparkBars(candidates),
      },
      {
        label: 'Ranked',
        value: String(ranked),
        meta: 'Rows in ci_rankings',
        accent: '#7C3AED',
        icon: ListOrdered,
        bars: sparkBars(ranked),
      },
      {
        label: 'Selected',
        value: String(selectedCount),
        meta: 'SELECTED / QUALIFIED / HANDED_OFF',
        accent: '#0EA5E9',
        icon: Trophy,
        bars: sparkBars(selectedCount),
      },
      {
        label: 'AI Score',
        value: measuredAi ? String(metrics?.avgAiScore ?? 0) : 'UNMEAS.',
        meta: measuredAi
          ? `${metrics?.measuredAiScore} scored candidates`
          : 'No scores > 0 persisted',
        accent: '#22C55E',
        icon: BrainCircuit,
        bars: sparkBars(metrics?.avgAiScore ?? 0),
      },
      {
        label: 'Portfolio Fit',
        value: measuredFit ? String(metrics?.avgPortfolioFit ?? 0) : 'UNMEAS.',
        meta: measuredFit
          ? `${metrics?.measuredPortfolioFit} portfolio readings`
          : 'No portfolio_effect_json fit',
        accent: '#F59E0B',
        icon: Scale,
        bars: sparkBars(metrics?.avgPortfolioFit ?? 0),
      },
      {
        label: 'Ready',
        value: String(ready),
        meta: 'Selected / qualified for Stage 03',
        accent: '#EF4444',
        icon: CheckCircle2,
        bars: sparkBars(ready),
      },
    ];
  }, [metrics]);

  const stageStatus = packageLabel(overview, systemRunning);
  const distribution = overview?.scoreDistribution ?? [];
  const maxBucket = Math.max(1, ...distribution.map((item) => item.count));

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
      };

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 4) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }

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
          Content Lifecycle / 02 Content Intelligence / Ranking & Selection
        </p>
        <h1 className={styles.title}>Ranking & Selection</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Ranking & selection unavailable</h2>
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
            Content Lifecycle / 02 Content Intelligence / Ranking & Selection
          </p>
          <h1 className={styles.title}>Ranking & Selection</h1>
          <p className={styles.lede}>
            Autonomously score, prioritize, explain, and select the highest-value opportunities for
            Stage 03 Idea Qualification.
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
          Ranks come from persisted <code>ci_rankings</code>; factor scores from{' '}
          <code>ci_scores</code>. Portfolio fit and ROI stay UNMEASURED unless workers write them.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Ranking & selection KPI summary">
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

      <section className={styles.lifecycle} aria-label="Ranking & selection lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Selection lifecycle</h2>
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
            Ranking appears after an acknowledged Strategy package and discovery persists scored
            opportunities into rankings.
          </div>
        </div>
      ) : null}

      {overview?.strategy && records.length === 0 ? (
        <div className={styles.waitingBanner} role="status">
          <Activity size={18} aria-hidden />
          <div>
            <strong>Scoring candidates</strong>
            No opportunities are persisted yet. This workspace updates when discovery writes
            opportunities and rankings.
          </div>
        </div>
      ) : null}

      <section className={styles.workspace} aria-label="Ranking & selection workspace">
        <aside className={styles.panel} aria-label="Candidate Explorer">
          <div className={styles.panelHead}>
            <h2>Candidate Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ranking & selection…"
                aria-label="Search ranking and selection"
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
              <span>Audience</span>
              <select
                value={audienceFilter}
                onChange={(event) => setAudienceFilter(event.target.value)}
                aria-label="Filter by audience"
              >
                <option value="all">All audiences</option>
                {audiences.map((audience) => (
                  <option key={audience} value={audience}>
                    {audience}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Priority</span>
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                aria-label="Filter by priority"
              >
                <option value="all">All priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>

            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No persisted candidates match the current filters.</p>
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
                        toggleCompare(item.id);
                      }}
                    >
                      <span className={styles.explorerTitle}>{item.title}</span>
                      <span className={styles.explorerMeta}>
                        {item.domain}
                        {item.rankPosition != null ? ` · Rank #${item.rankPosition}` : ' · Unranked'}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.selectionStatus)}`}>
                          {item.selectionStatus}
                        </span>
                        <span className={styles.chip}>
                          {item.measuredScore ? item.overallScore.toFixed(1) : 'UNMEAS.'}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Ranking Intelligence">
          <div className={styles.tabs} role="tablist" aria-label="Ranking tabs">
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
            {!selected && tab !== 'audit' && tab !== 'rankings' && tab !== 'comparison' ? (
              <div className={styles.emptyInline}>
                <Layers3 size={22} aria-hidden />
                <p>
                  {overview?.strategy
                    ? 'Select a candidate to inspect ranking, portfolio fit, and explainability.'
                    : 'Persisted candidates appear after discovery writes opportunities.'}
                </p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Candidate profile</h3>
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
                      <dt>Audience</dt>
                      <dd>{display(selected.audience)}</dd>
                    </div>
                    <div>
                      <dt>Rank</dt>
                      <dd>
                        {selected.rankPosition != null ? `#${selected.rankPosition}` : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Selection</dt>
                      <dd>{selected.selectionStatus}</dd>
                    </div>
                    <div>
                      <dt>Priority</dt>
                      <dd>{measured(selected.priority)}</dd>
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
                  <h3>Multi-factor scores</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Overall / AI score</dt>
                      <dd>
                        {selected.measuredScore
                          ? selected.overallScore.toFixed(2)
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Confidence</dt>
                      <dd>
                        {selected.measuredConfidence
                          ? Math.round(selected.confidence as number)
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Demand</dt>
                      <dd>{measured(selected.demand)}</dd>
                    </div>
                    <div>
                      <dt>Uniqueness</dt>
                      <dd>{measured(selected.uniqueness)}</dd>
                    </div>
                    <div>
                      <dt>Strategic fit</dt>
                      <dd>{measured(selected.strategicFit)}</dd>
                    </div>
                    <div>
                      <dt>ROI</dt>
                      <dd>{measured(selected.roi)}</dd>
                    </div>
                    <div>
                      <dt>Portfolio impact</dt>
                      <dd>{measured(selected.portfolioImpact)}</dd>
                    </div>
                    <div>
                      <dt>Evidence quality</dt>
                      <dd>{measured(selected.evidenceQuality)}</dd>
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
                      <dt>Handoff</dt>
                      <dd>{display(selected.handoffStatus)}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'rankings' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Weighted ranking table</h3>
                  {!rankedTable.length ? (
                    <p className={styles.lede}>No candidates to rank yet.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Rank</th>
                          <th scope="col">Title</th>
                          <th scope="col">AI score</th>
                          <th scope="col">Selection</th>
                          <th scope="col">Fit</th>
                          <th scope="col">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankedTable.slice(0, 40).map((item, index) => (
                          <tr key={item.id}>
                            <td>{item.rankPosition ?? index + 1}</td>
                            <td>{item.title}</td>
                            <td>
                              {item.measuredScore
                                ? item.overallScore.toFixed(1)
                                : 'UNMEASURED'}
                            </td>
                            <td>{item.selectionStatus}</td>
                            <td>{measured(item.portfolioFit)}</td>
                            <td>{item.recommendedAction}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
                <article className={styles.detailCard}>
                  <h3>Score distribution</h3>
                  {!distribution.some((item) => item.count > 0) ? (
                    <p className={styles.lede}>No measured scores to chart yet.</p>
                  ) : (
                    <div
                      className={styles.spark}
                      aria-hidden
                      style={{ height: 56, alignItems: 'flex-end', gap: 8 }}
                    >
                      {distribution.map((item) => (
                        <i
                          key={item.bucket}
                          title={`${item.bucket}: ${item.count}`}
                          style={{
                            height: `${Math.max(4, (item.count / maxBucket) * 52)}px`,
                            width: 28,
                            borderRadius: 4,
                            background: 'var(--primary)',
                            display: 'block',
                            opacity: item.count ? 1 : 0.2,
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <p className={styles.lede}>
                    Buckets: {distribution.map((item) => `${item.bucket} (${item.count})`).join(' · ') || '—'}
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'comparison' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Comparison chart</h3>
                  {compareItems.length < 2 ? (
                    <p className={styles.lede}>
                      Select at least two candidates from the explorer to compare factors.
                    </p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Factor</th>
                          {compareItems.map((item) => (
                            <th key={item.id} scope="col">
                              {item.title.slice(0, 28)}
                              {item.title.length > 28 ? '…' : ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            ['Rank', (item: RankingRecord) => measured(item.rankPosition)],
                            [
                              'AI score',
                              (item: RankingRecord) =>
                                item.measuredScore
                                  ? item.overallScore.toFixed(1)
                                  : 'UNMEASURED',
                            ],
                            ['Confidence', (item: RankingRecord) => measured(item.confidence)],
                            ['Demand', (item: RankingRecord) => measured(item.demand)],
                            ['Uniqueness', (item: RankingRecord) => measured(item.uniqueness)],
                            ['Strategic fit', (item: RankingRecord) => measured(item.strategicFit)],
                            ['ROI', (item: RankingRecord) => measured(item.roi)],
                            [
                              'Portfolio fit',
                              (item: RankingRecord) => measured(item.portfolioFit),
                            ],
                            [
                              'Evidence quality',
                              (item: RankingRecord) => measured(item.evidenceQuality),
                            ],
                          ] as Array<[string, (item: RankingRecord) => string]>
                        ).map(([label, getter]) => (
                          <tr key={label}>
                            <td>{label}</td>
                            {compareItems.map((item) => (
                              <td key={`${label}-${item.id}`}>{getter(item)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
                <article className={styles.detailCard}>
                  <h3>Visual scores</h3>
                  <div
                    className={styles.spark}
                    aria-hidden
                    style={{ height: 48, alignItems: 'flex-end', gap: 8 }}
                  >
                    {compareItems.map((item) => (
                      <i
                        key={item.id}
                        title={item.title}
                        style={{
                          height: `${Math.max(4, Math.min(44, ((item.overallScore || 0) / 100) * 44 || 4))}px`,
                          width: 22,
                          borderRadius: 4,
                          background: 'var(--primary)',
                          display: 'block',
                          opacity: item.measuredScore ? 1 : 0.25,
                        }}
                      />
                    ))}
                  </div>
                  <p className={styles.lede}>Bar height reflects overall AI score when measured.</p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>AI explanation</h3>
                  <p>
                    {selected.explanation ??
                      'No ranking explanation persisted. Rank position and score factors remain authoritative.'}
                  </p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Ranking ID</dt>
                      <dd>{display(selected.rankingId)}</dd>
                    </div>
                    <div>
                      <dt>Opportunity ID</dt>
                      <dd>{selected.opportunityId}</dd>
                    </div>
                    <div>
                      <dt>Recommended action</dt>
                      <dd>{selected.recommendedAction}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Score factors</h3>
                  {Object.keys(selected.scoreFactors).length ? (
                    <dl className={styles.kv}>
                      {Object.entries(selected.scoreFactors)
                        .slice(0, 12)
                        .map(([key, value]) => (
                          <div key={key}>
                            <dt>{key}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                    </dl>
                  ) : (
                    <p className={styles.lede}>No score factors persisted for this candidate.</p>
                  )}
                </article>
                <article className={styles.detailCard}>
                  <h3>Evidence traceability</h3>
                  {!selected.evidenceSubjects.length ? (
                    <p className={styles.lede}>No linked signal subjects.</p>
                  ) : (
                    <ul className={styles.bulletList}>
                      {selected.evidenceSubjects.map((subject) => (
                        <li key={subject}>{subject}</li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>
            ) : null}

            {selected && tab === 'portfolio' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Portfolio fit</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Portfolio fit</dt>
                      <dd>{measured(selected.portfolioFit)}</dd>
                    </div>
                    <div>
                      <dt>Portfolio impact</dt>
                      <dd>{measured(selected.portfolioImpact)}</dd>
                    </div>
                    <div>
                      <dt>Strategic fit</dt>
                      <dd>{measured(selected.strategicFit)}</dd>
                    </div>
                    <div>
                      <dt>Uniqueness</dt>
                      <dd>{measured(selected.uniqueness)}</dd>
                    </div>
                    <div>
                      <dt>Risk</dt>
                      <dd>{measured(selected.riskScore)}</dd>
                    </div>
                  </dl>
                  <div className={styles.timelineStrip} aria-hidden>
                    <div className={styles.timelineAxis}>
                      <div
                        className={styles.timelineBand}
                        style={{
                          width: `${Math.min(100, selected.portfolioFit ?? 0)}%`,
                          background: 'var(--primary)',
                        }}
                      />
                    </div>
                    <div className={styles.timelineLabels}>
                      <span>Fit</span>
                      <span>{selected.portfolioFit != null ? `${selected.portfolioFit}%` : '—'}</span>
                    </div>
                  </div>
                </article>
                <article className={styles.detailCard}>
                  <h3>Portfolio effect payload</h3>
                  {Object.keys(selected.portfolioEffect).length ? (
                    <dl className={styles.kv}>
                      {Object.entries(selected.portfolioEffect)
                        .slice(0, 10)
                        .map(([key, value]) => (
                          <div key={key}>
                            <dt>{key}</dt>
                            <dd>
                              {typeof value === 'string' || typeof value === 'number'
                                ? String(value)
                                : JSON.stringify(value)}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  ) : (
                    <p className={styles.lede}>
                      No <code>portfolio_effect_json</code> persisted for this ranking row.
                    </p>
                  )}
                </article>
                <article className={styles.detailCard}>
                  <h3>Balancing posture</h3>
                  <ul className={styles.bulletList}>
                    <li>
                      Selected in portfolio: {metrics?.selected ?? 0} · ready {metrics?.ready ?? 0}
                    </li>
                    <li>Open rank ties: {metrics?.ties ?? 0}</li>
                    <li>
                      Category concentration uses persisted domain assignments only — no fabricated
                      balance scores.
                    </li>
                  </ul>
                </article>
              </div>
            ) : null}

            {selected && tab === 'history' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Ranking timeline</h3>
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
                      <ListOrdered size={14} aria-hidden />
                      <div>
                        <strong>Ranked</strong>
                        <span>
                          {selected.rankedAt
                            ? new Date(selected.rankedAt).toLocaleString()
                            : 'Not ranked yet'}
                          {selected.rankPosition != null
                            ? ` · #${selected.rankPosition}`
                            : ''}
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
                    <p className={styles.lede}>No ranking-related audit events persisted yet.</p>
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
                <h3>Selection rationale</h3>
                <p>
                  {selected
                    ? `Rank ${selected.rankPosition != null ? `#${selected.rankPosition}` : 'UNMEASURED'} · score ${selected.measuredScore ? selected.overallScore.toFixed(1) : 'UNMEASURED'} · action ${selected.recommendedAction}.`
                    : `Selected ${metrics?.selected ?? 0} · ranked ${metrics?.ranked ?? 0}.`}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Risks</h3>
                <p>
                  Blocked {metrics?.blocked ?? 0} · rank ties {metrics?.ties ?? 0} · ready{' '}
                  {metrics?.ready ?? 0}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Recommendations</h3>
                <ul className={styles.bulletList}>
                  {!overview?.strategy ? (
                    <li>Acknowledge Strategy package to unlock scoring and ranking.</li>
                  ) : null}
                  {overview?.strategy && records.length === 0 ? (
                    <li>Keep system RUNNING until discovery persists candidates.</li>
                  ) : null}
                  {(metrics?.ties ?? 0) > 0 ? (
                    <li>Resolve rank ties before final selection approval.</li>
                  ) : null}
                  {(metrics?.ready ?? 0) > 0 ? (
                    <li>Ready selections can proceed to Stage 03 Idea Qualification.</li>
                  ) : null}
                  {(metrics?.ranked ?? 0) > 0 && (metrics?.selected ?? 0) === 0 ? (
                    <li>Promote top-ranked candidates to SELECTED when portfolio fit allows.</li>
                  ) : null}
                </ul>
              </article>
              <article className={styles.insightCard}>
                <h3>Alerts</h3>
                {!issues.length ? (
                  <p>No open ranking anomalies in persisted state.</p>
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

      <section className={styles.bottom} aria-label="Ranking monitoring">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Health monitoring</h2>
            <AlertTriangle size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Ranked</dt>
                <dd>{metrics?.ranked ?? 0}</dd>
              </div>
              <div>
                <dt>Selected</dt>
                <dd>{metrics?.selected ?? 0}</dd>
              </div>
              <div>
                <dt>Ties</dt>
                <dd>{metrics?.ties ?? 0}</dd>
              </div>
              <div>
                <dt>Blocked</dt>
                <dd>{metrics?.blocked ?? 0}</dd>
              </div>
            </dl>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Automatic handoff</h2>
            <RefreshCw size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              Selection and handoff advance through lifecycle workers writing{' '}
              <code>ci_rankings</code> and <code>ci_handoffs</code>. This page is observe-only.
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
                <dt>Ready</dt>
                <dd>{metrics?.ready ?? 0}</dd>
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
