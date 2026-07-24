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
  Earth,
  Gauge,
  GitBranch,
  Layers3,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
  Users,
  Workflow,
} from 'lucide-react';
import type {
  PortfolioBalanceOverview,
  PortfolioCandidate,
  PortfolioRecommendation,
} from '@/lib/content-intelligence/portfolio';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import styles from './portfolio-balance.module.css';

type TabId =
  | 'overview'
  | 'topics'
  | 'geography'
  | 'audiences'
  | 'formats'
  | 'matrix'
  | 'diversity'
  | 'recommendations'
  | 'constraints'
  | 'simulator'
  | 'impact'
  | 'history'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'topics', label: 'Topics' },
  { id: 'geography', label: 'Geography' },
  { id: 'audiences', label: 'Audiences' },
  { id: 'formats', label: 'Formats' },
  { id: 'matrix', label: 'Coverage Matrix' },
  { id: 'diversity', label: 'Diversity' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'constraints', label: 'Constraints' },
  { id: 'simulator', label: 'Simulator' },
  { id: 'impact', label: 'Candidate Impact' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'BALANCED':
    case 'HEALTHY':
    case 'READY':
    case 'COMPLETED':
    case 'RUNNING':
    case 'ACKNOWLEDGED':
    case 'APPROVE':
    case 'ACTIVE':
    case 'PASSED':
      return styles.toneReady;
    case 'OVER':
    case 'FAILED':
    case 'REJECT':
    case 'CRITICAL':
    case 'BLOCKED':
      return styles.toneBlocked;
    case 'UNDER':
    case 'WARNING':
    case 'DELAY':
    case 'REPLACE':
    case 'WAITING':
    case 'IDLE':
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

function packageLabel(overview: PortfolioBalanceOverview | null, systemRunning: boolean) {
  if (overview?.run?.status === 'FAILED') return 'Failed';
  if (systemRunning || overview?.run?.status === 'RUNNING') return 'Optimizing';
  if ((overview?.metrics.pendingRebalanceActions ?? 0) > 0) return 'Rebalance';
  if ((overview?.metrics.totalCandidates ?? 0) > 0) return 'Balanced';
  if (overview?.strategy) return 'Waiting';
  return 'Empty';
}

function matchesCandidate(
  item: PortfolioCandidate,
  needle: string,
  status: string,
  topic: string,
  audience: string,
  region: string,
  recommendation: string,
) {
  if (status !== 'all' && item.status !== status && item.selectionStatus !== status) return false;
  if (topic !== 'all' && item.domain !== topic) return false;
  if (audience !== 'all' && (item.audience ?? '') !== audience) return false;
  if (region !== 'all' && (item.geography ?? '') !== region) return false;
  if (recommendation !== 'all' && item.recommendation !== recommendation) return false;
  if (!needle) return true;
  const haystack = [
    item.title,
    item.domain,
    item.audience,
    item.geography,
    item.formatHint,
    item.status,
    item.recommendation,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function exportPayload(overview: PortfolioBalanceOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `portfolio-balance-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = ['id', 'title', 'domain', 'audience', 'geography', 'recommendation', 'score'];
  const lines = [
    header.join(','),
    ...overview.candidates.map((item) =>
      [
        item.id,
        JSON.stringify(item.title),
        JSON.stringify(item.domain),
        JSON.stringify(item.audience ?? ''),
        JSON.stringify(item.geography ?? ''),
        item.recommendation,
        item.measuredScore ? item.score : '',
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `portfolio-balance-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function SliceBars({
  items,
  maxShare,
}: {
  items: Array<{ label: string; share: number; count: number; status: string }>;
  maxShare: number;
}) {
  return (
    <div className={styles.waterfall}>
      {items.slice(0, 12).map((item) => (
        <div key={item.label} className={styles.waterfallRow}>
          <span>{item.label}</span>
          <div className={styles.radarBar}>
            <div
              className={styles.radarFill}
              style={{
                width: `${Math.min(100, (item.share / Math.max(maxShare, 1)) * 100)}%`,
                background:
                  item.status === 'over'
                    ? 'var(--critical)'
                    : item.status === 'under'
                      ? 'var(--warning)'
                      : undefined,
              }}
            />
          </div>
          <strong>
            {item.share}% · {item.count}
          </strong>
        </div>
      ))}
    </div>
  );
}

export function PortfolioBalanceWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<PortfolioBalanceOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [recommendationFilter, setRecommendationFilter] = useState('all');
  const [tab, setTab] = useState<TabId>('overview');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [sim, setSim] = useState({
    budget: 0,
    audience: 0,
    region: 0,
    educational: 0,
  });

  const systemRunning = systemState === 'RUNNING';

  async function load(preferId?: string | null) {
    setBusy(true);
    setError('');
    try {
      const [next, dashboard] = await Promise.all([
        intelligenceApi.portfolio(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const items = next.candidates ?? [];
      const targetId = preferId ?? selectedId;
      const selected = targetId ? items.find((item) => item.id === targetId) : items[0];
      setSelectedId(selected?.id ?? null);
      if (!selectedRecId && next.recommendations[0]) {
        setSelectedRecId(next.recommendations[0].id);
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

  const candidates = overview?.candidates ?? [];
  const metrics = overview?.metrics;
  const meta = overview?.meta;
  const needle = query.trim().toLowerCase();

  const statuses = useMemo(() => {
    const values = new Set<string>();
    for (const item of candidates) {
      values.add(item.status);
      if (item.selectionStatus) values.add(item.selectionStatus);
    }
    return [...values].sort();
  }, [candidates]);
  const topics = useMemo(
    () => [...new Set(candidates.map((item) => item.domain).filter(Boolean))].sort(),
    [candidates],
  );
  const audiences = useMemo(
    () => [...new Set(candidates.map((item) => item.audience).filter(Boolean) as string[])].sort(),
    [candidates],
  );
  const regions = useMemo(
    () =>
      [...new Set(candidates.map((item) => item.geography).filter(Boolean) as string[])].sort(),
    [candidates],
  );

  const filtered = useMemo(
    () =>
      candidates.filter((item) =>
        matchesCandidate(
          item,
          needle,
          statusFilter,
          topicFilter,
          audienceFilter,
          regionFilter,
          recommendationFilter,
        ),
      ),
    [
      candidates,
      needle,
      statusFilter,
      topicFilter,
      audienceFilter,
      regionFilter,
      recommendationFilter,
    ],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    candidates.find((item) => item.id === selectedId) ??
    null;

  const selectedRec: PortfolioRecommendation | null =
    overview?.recommendations.find((item) => item.id === selectedRecId) ??
    overview?.recommendations[0] ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const stageStatus = packageLabel(overview, systemRunning);
  const simulatedHealth = useMemo(() => {
    if (meta?.portfolioHealth == null) return null;
    let health = meta.portfolioHealth;
    health += sim.audience * 0.15;
    health += sim.region * 0.12;
    health += sim.educational * 0.1;
    health -= Math.abs(sim.budget) * 0.05;
    return Math.max(0, Math.min(100, Math.round(health * 10) / 10));
  }, [meta?.portfolioHealth, sim]);

  const kpis = useMemo(() => {
    const m = metrics;
    const last = meta?.lastOptimization
      ? new Date(meta.lastOptimization).toLocaleString()
      : 'No cycle yet';
    return [
      {
        label: 'Overall Portfolio Health',
        value: m?.overallHealth != null ? String(m.overallHealth) : 'UNMEAS.',
        meta: `Last opt · ${last}`,
        accent: '#2563EB',
        icon: Gauge,
        bars: sparkBars(m?.overallHealth ?? 0),
        drill: 'overview' as TabId,
      },
      {
        label: 'Diversity Score',
        value: m?.diversityScore != null ? String(m.diversityScore) : 'UNMEAS.',
        meta: 'Normalized Shannon mean',
        accent: '#7C3AED',
        icon: Scale,
        bars: sparkBars(m?.diversityScore ?? 0),
        drill: 'diversity' as TabId,
      },
      {
        label: 'Strategic Coverage',
        value: m?.strategicCoverage != null ? `${m.strategicCoverage}%` : 'UNMEAS.',
        meta: 'Topics represented',
        accent: '#0EA5E9',
        icon: Target,
        bars: sparkBars(m?.strategicCoverage ?? 0),
        drill: 'topics' as TabId,
      },
      {
        label: 'Audience Coverage',
        value: m?.audienceCoverage != null ? `${m.audienceCoverage}%` : 'UNMEAS.',
        meta: 'Attributed audiences',
        accent: '#14B8A6',
        icon: Users,
        bars: sparkBars(m?.audienceCoverage ?? 0),
        drill: 'audiences' as TabId,
      },
      {
        label: 'Geographic Coverage',
        value: m?.geographicCoverage != null ? `${m.geographicCoverage}%` : 'UNMEAS.',
        meta: 'Attributed geographies',
        accent: '#22C55E',
        icon: Earth,
        bars: sparkBars(m?.geographicCoverage ?? 0),
        drill: 'geography' as TabId,
      },
      {
        label: 'Language Coverage',
        value: 'UNMEAS.',
        meta: 'No language field persisted',
        accent: '#64748B',
        icon: Layers3,
        bars: sparkBars(0),
        drill: 'overview' as TabId,
      },
      {
        label: 'Documentary Balance',
        value: m?.documentaryBalance != null ? String(m.documentaryBalance) : 'UNMEAS.',
        meta: 'Format Shannon × 100',
        accent: '#F59E0B',
        icon: Workflow,
        bars: sparkBars(m?.documentaryBalance ?? 0),
        drill: 'formats' as TabId,
      },
      {
        label: 'Production Capacity Utilization',
        value: 'UNMEAS.',
        meta: 'No capacity plan persisted',
        accent: '#94A3B8',
        icon: Activity,
        bars: sparkBars(0),
        drill: 'constraints' as TabId,
      },
      {
        label: 'Budget Allocation',
        value: 'UNMEAS.',
        meta: 'No budget rows persisted',
        accent: '#94A3B8',
        icon: Scale,
        bars: sparkBars(0),
        drill: 'constraints' as TabId,
      },
      {
        label: 'Evergreen Ratio',
        value: m?.evergreenRatio != null ? `${m.evergreenRatio}%` : 'UNMEAS.',
        meta: 'Domain keyword heuristic',
        accent: '#10B981',
        icon: CheckCircle2,
        bars: sparkBars(m?.evergreenRatio ?? 0),
        drill: 'topics' as TabId,
      },
      {
        label: 'Trending Ratio',
        value: m?.trendingRatio != null ? `${m.trendingRatio}%` : 'UNMEAS.',
        meta: 'Domain keyword heuristic',
        accent: '#F97316',
        icon: Activity,
        bars: sparkBars(m?.trendingRatio ?? 0),
        drill: 'topics' as TabId,
      },
      {
        label: 'Commercial Ratio',
        value: m?.commercialRatio != null ? `${m.commercialRatio}%` : 'UNMEAS.',
        meta: 'Domain keyword heuristic',
        accent: '#EAB308',
        icon: Target,
        bars: sparkBars(m?.commercialRatio ?? 0),
        drill: 'topics' as TabId,
      },
      {
        label: 'Educational Ratio',
        value: m?.educationalRatio != null ? `${m.educationalRatio}%` : 'UNMEAS.',
        meta: 'Domain keyword heuristic',
        accent: '#6366F1',
        icon: Layers3,
        bars: sparkBars(m?.educationalRatio ?? 0),
        drill: 'topics' as TabId,
      },
      {
        label: 'Historical Ratio',
        value: m?.historicalRatio != null ? `${m.historicalRatio}%` : 'UNMEAS.',
        meta: 'Domain keyword heuristic',
        accent: '#A855F7',
        icon: CircleDot,
        bars: sparkBars(m?.historicalRatio ?? 0),
        drill: 'topics' as TabId,
      },
      {
        label: 'Scientific Ratio',
        value: m?.scientificRatio != null ? `${m.scientificRatio}%` : 'UNMEAS.',
        meta: 'Domain keyword heuristic',
        accent: '#06B6D4',
        icon: BrainCircuit,
        bars: sparkBars(m?.scientificRatio ?? 0),
        drill: 'topics' as TabId,
      },
      {
        label: 'Risk Distribution',
        value: m?.riskDistribution != null ? String(m.riskDistribution) : 'UNMEAS.',
        meta: 'Mean risk_score',
        accent: '#EF4444',
        icon: AlertTriangle,
        bars: sparkBars(m?.riskDistribution ?? 0),
        drill: 'impact' as TabId,
      },
      {
        label: 'Pending Rebalance Actions',
        value: String(m?.pendingRebalanceActions ?? 0),
        meta: 'HIGH/MEDIUM recommendations',
        accent: '#2563EB',
        icon: GitBranch,
        bars: sparkBars(m?.pendingRebalanceActions ?? 0),
        drill: 'recommendations' as TabId,
      },
    ];
  }, [metrics, meta]);

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
          Content Lifecycle / 02 Content Intelligence / Portfolio Balance
        </p>
        <h1 className={styles.title}>AI Portfolio Balance Engine</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Portfolio balance unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  const issues = overview?.issues ?? [];
  const audit = overview?.audit ?? [];
  const showEmptyHero = Boolean(overview?.strategy) && candidates.length === 0;
  const showWaitingStrategy = !overview?.strategy;
  const maxTopicShare = Math.max(1, ...(overview?.topics.map((item) => item.share) ?? [1]));

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 02 Content Intelligence / Portfolio Balance
          </p>
          <h1 className={styles.title}>AI Portfolio Balance Engine</h1>
          <p className={styles.lede}>
            Continuously optimise topic diversity, audience coverage, strategic priorities,
            production capacity, regional representation and long-term portfolio health using
            autonomous AI.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 02</span>
          <span className={`${styles.badge} ${statusTone(stageStatus)}`}>{stageStatus}</span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Health {measured(meta?.portfolioHealth)}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Balance {measured(meta?.balanceScore)}
          </span>
          <span className={`${styles.badge} ${styles.toneAi}`}>
            Diversity {measured(meta?.diversityIndex)}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Version {display(meta?.activePortfolioVersion)}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Last opt{' '}
            {meta?.lastOptimization
              ? new Date(meta.lastOptimization).toLocaleString()
              : 'UNMEASURED'}
          </span>
          <span className={`${styles.badge} ${statusTone(overview?.strategy?.status)}`}>
            Strategy v{overview?.strategy?.versionNumber ?? '—'}
          </span>
          <span className={`${styles.badge} ${statusTone(meta?.queueStatus)}`}>
            {display(meta?.queueStatus)}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous rebalance</strong>
          Diversity, coverage, and recommendations are computed from persisted{' '}
          <code>ci_opportunities</code> / <code>ci_rankings</code>. Capacity, budget, language, and
          forecasts stay UNMEASURED until workers persist them.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Portfolio KPI summary">
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

      <section className={styles.lifecycle} aria-label="Portfolio optimization pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Portfolio optimization pipeline</h2>
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
                {stage.recordsProcessed} · health {measured(stage.healthScore)} · conf{' '}
                {measured(stage.aiConfidence)} · q {stage.queueDepth}
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
            Portfolio optimization starts after an acknowledged Strategy package and scored
            opportunities are available.
          </div>
        </div>
      ) : null}

      {showEmptyHero ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>
              Portfolio optimization begins automatically once Opportunity Scoring has completed.
            </h2>
            <p className={styles.lede}>
              While Running, the engine analyses topic, audience, geography and format distributions,
              computes Shannon diversity, detects saturation gaps, and queues rebalance actions
              before Qualification Handoffs.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Load candidates</strong>
              From scored / ranked opportunities
            </li>
            <li>
              <strong>2. Measure diversity</strong>
              Shannon entropy across dimensions
            </li>
            <li>
              <strong>3. Detect imbalance</strong>
              Oversaturation & coverage gaps
            </li>
            <li>
              <strong>4. Notify handoffs</strong>
              Optimized portfolio for Stage 03
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Portfolio balance workspace">
        <aside className={styles.panel} aria-label="Portfolio Explorer">
          <div className={styles.panelHead}>
            <h2>Portfolio Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search topics, regions, audiences…"
                aria-label="Search portfolio balance"
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
              <span>Region</span>
              <select
                value={regionFilter}
                onChange={(event) => setRegionFilter(event.target.value)}
                aria-label="Filter by region"
              >
                <option value="all">All regions</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Recommendation</span>
              <select
                value={recommendationFilter}
                onChange={(event) => setRecommendationFilter(event.target.value)}
                aria-label="Filter by recommendation"
              >
                <option value="all">All actions</option>
                <option value="approve">Approve</option>
                <option value="delay">Delay</option>
                <option value="replace">Replace</option>
                <option value="reject">Reject</option>
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
                        setTab('impact');
                      }}
                    >
                      <span className={styles.explorerTitle}>{item.title}</span>
                      <span className={styles.explorerMeta}>
                        {item.domain}
                        {item.geography ? ` · ${item.geography}` : ''}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.recommendation)}`}>
                          {item.recommendation}
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

        <section className={`${styles.panel} ${styles.center}`} aria-label="Portfolio intelligence">
          <div className={styles.tabs} role="tablist" aria-label="Portfolio tabs">
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
                  <h3>Portfolio health</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Overall health</dt>
                      <dd>{measured(meta?.portfolioHealth)}</dd>
                    </div>
                    <div>
                      <dt>Balance score</dt>
                      <dd>{measured(meta?.balanceScore)}</dd>
                    </div>
                    <div>
                      <dt>Diversity index</dt>
                      <dd>{measured(meta?.diversityIndex)}</dd>
                    </div>
                    <div>
                      <dt>Candidates</dt>
                      <dd>{metrics?.totalCandidates ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Pending actions</dt>
                      <dd>{metrics?.pendingRebalanceActions ?? 0}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Topic treemap (share bars)</h3>
                  <SliceBars items={overview?.topics ?? []} maxShare={maxTopicShare} />
                </article>
                <article className={styles.detailCard}>
                  <h3>Optimization rules</h3>
                  <ul className={styles.bulletList}>
                    <li>Prevent topic / country / format oversaturation</li>
                    <li>Increase under-represented audiences and regions</li>
                    <li>Reduce duplicate narratives before handoff</li>
                    <li>Keep Shannon diversity above platform minimum</li>
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'topics' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Topic distribution</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th scope="col">Topic</th>
                        <th scope="col">Count</th>
                        <th scope="col">Share</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overview?.topics ?? []).map((item) => (
                        <tr key={item.key}>
                          <td>{item.label}</td>
                          <td>{item.count}</td>
                          <td>{item.share}%</td>
                          <td>{item.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'geography' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Geographic distribution</h3>
                  <p className={styles.lede}>
                    Interactive world map requires geocoded country codes — showing persisted
                    geography shares instead.
                  </p>
                  <SliceBars
                    items={overview?.geographies ?? []}
                    maxShare={Math.max(
                      1,
                      ...(overview?.geographies.map((item) => item.share) ?? [1]),
                    )}
                  />
                </article>
              </div>
            ) : null}

            {tab === 'audiences' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Audience distribution</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th scope="col">Audience</th>
                        <th scope="col">Count</th>
                        <th scope="col">Current %</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overview?.audiences ?? []).map((item) => (
                        <tr key={item.key}>
                          <td>{item.label}</td>
                          <td>{item.count}</td>
                          <td>{item.share}%</td>
                          <td>{item.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'formats' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Format / documentary balance</h3>
                  <SliceBars
                    items={overview?.formats ?? []}
                    maxShare={Math.max(1, ...(overview?.formats.map((item) => item.share) ?? [1]))}
                  />
                </article>
              </div>
            ) : null}

            {tab === 'matrix' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Coverage matrix (topic × region)</h3>
                  {!overview?.coverageMatrix.length ? (
                    <p className={styles.lede}>No coverage cells yet.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Topic</th>
                          <th scope="col">Region</th>
                          <th scope="col">Count</th>
                          <th scope="col">Share</th>
                          <th scope="col">Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.coverageMatrix.slice(0, 40).map((cell) => (
                          <tr key={`${cell.topic}-${cell.region}`}>
                            <td>{cell.topic}</td>
                            <td>{cell.region}</td>
                            <td>{cell.count}</td>
                            <td>{cell.share}%</td>
                            <td>{cell.priority}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'diversity' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Shannon diversity engine</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Topic (normalized)</dt>
                      <dd>{measured(overview?.diversity.shannonTopic)}</dd>
                    </div>
                    <div>
                      <dt>Audience (normalized)</dt>
                      <dd>{measured(overview?.diversity.shannonAudience)}</dd>
                    </div>
                    <div>
                      <dt>Geography (normalized)</dt>
                      <dd>{measured(overview?.diversity.shannonGeography)}</dd>
                    </div>
                    <div>
                      <dt>Format (normalized)</dt>
                      <dd>{measured(overview?.diversity.shannonFormat)}</dd>
                    </div>
                    <div>
                      <dt>Topic entropy</dt>
                      <dd>{measured(overview?.diversity.topicEntropy)}</dd>
                    </div>
                    <div>
                      <dt>Audience entropy</dt>
                      <dd>{measured(overview?.diversity.audienceEntropy)}</dd>
                    </div>
                    <div>
                      <dt>Geographic entropy</dt>
                      <dd>{measured(overview?.diversity.geographicEntropy)}</dd>
                    </div>
                    <div>
                      <dt>Format entropy</dt>
                      <dd>{measured(overview?.diversity.formatEntropy)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Timeline forecast</h3>
                  <p className={styles.lede}>
                    30 / 90 / 180 / 365 day portfolio forecasts remain UNMEASURED until forecast
                    workers persist projections.
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'recommendations' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Portfolio recommendations</h3>
                  {!overview?.recommendations.length ? (
                    <p className={styles.lede}>No rebalance recommendations from current state.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Action</th>
                          <th scope="col">Dimension</th>
                          <th scope="col">Priority</th>
                          <th scope="col">Confidence</th>
                          <th scope="col">Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.recommendations.map((item) => (
                          <tr
                            key={item.id}
                            style={{
                              cursor: 'pointer',
                              background:
                                selectedRec?.id === item.id ? '#eff6ff' : undefined,
                            }}
                            onClick={() => {
                              setSelectedRecId(item.id);
                            }}
                          >
                            <td>{item.action}</td>
                            <td>{item.dimension}</td>
                            <td>{item.priority}</td>
                            <td>{measured(item.confidence)}</td>
                            <td>{item.impact}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'constraints' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Portfolio constraints</h3>
                  <p className={styles.lede}>
                    Source: {overview?.constraints.source}. Enforced by optimization workers.
                  </p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Max topic %</dt>
                      <dd>{overview?.constraints.maximumTopicPct}</dd>
                    </div>
                    <div>
                      <dt>Max country %</dt>
                      <dd>{overview?.constraints.maximumCountryPct}</dd>
                    </div>
                    <div>
                      <dt>Max channel %</dt>
                      <dd>{overview?.constraints.maximumChannelPct}</dd>
                    </div>
                    <div>
                      <dt>Min diversity</dt>
                      <dd>{overview?.constraints.minimumDiversity}</dd>
                    </div>
                    <div>
                      <dt>Min evergreen %</dt>
                      <dd>{overview?.constraints.minimumEvergreen}</dd>
                    </div>
                    <div>
                      <dt>Max risk</dt>
                      <dd>{overview?.constraints.maximumRisk}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Capacity & budget</h3>
                  <p className={styles.lede}>
                    Editors, GPU, rendering, publishing slots, and budget sankeys are UNMEASURED —
                    no capacity or budget tables are persisted in Content Intelligence yet.
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'simulator' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>What-if simulator</h3>
                  <p className={styles.lede}>
                    Local sensitivity on current portfolio health. Strategy and capacity changes
                    require worker re-optimization to persist.
                  </p>
                  <div className={styles.simControls}>
                    {(
                      [
                        ['budget', 'If budget changes'],
                        ['audience', 'If audience emphasis changes'],
                        ['region', 'If region emphasis changes'],
                        ['educational', 'If educational content increases'],
                      ] as Array<[keyof typeof sim, string]>
                    ).map(([key, label]) => (
                      <label key={key} className={styles.field}>
                        <span>
                          {label}: {sim[key]}
                        </span>
                        <input
                          type="range"
                          min={-30}
                          max={30}
                          value={sim[key]}
                          onChange={(event) =>
                            setSim((prev) => ({
                              ...prev,
                              [key]: Number(event.target.value),
                            }))
                          }
                          aria-label={label}
                        />
                      </label>
                    ))}
                  </div>
                </article>
                <article className={styles.detailCard}>
                  <h3>Simulated portfolio health</h3>
                  <div className={styles.simResult}>
                    <p>
                      Baseline: <strong>{measured(meta?.portfolioHealth)}</strong>
                    </p>
                    <p>
                      Simulated: <strong>{measured(simulatedHealth)}</strong>
                    </p>
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'impact' ? (
              <div className={styles.detailGrid}>
                {selected ? (
                  <>
                    <article className={styles.detailCard}>
                      <h3>Candidate impact preview</h3>
                      <dl className={styles.kv}>
                        <div>
                          <dt>Candidate</dt>
                          <dd>{selected.title}</dd>
                        </div>
                        <div>
                          <dt>Recommendation</dt>
                          <dd>{selected.recommendation}</dd>
                        </div>
                        <div>
                          <dt>Topic share</dt>
                          <dd>{measured(selected.impactPreview.topicShareAfter)}%</dd>
                        </div>
                        <div>
                          <dt>Audience share</dt>
                          <dd>{measured(selected.impactPreview.audienceShareAfter)}%</dd>
                        </div>
                        <div>
                          <dt>Geography share</dt>
                          <dd>{measured(selected.impactPreview.geographyShareAfter)}%</dd>
                        </div>
                        <div>
                          <dt>Health delta hint</dt>
                          <dd>{measured(selected.impactPreview.healthDelta)}</dd>
                        </div>
                      </dl>
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
                          No <code>portfolio_effect_json</code> on the latest ranking row.
                        </p>
                      )}
                    </article>
                  </>
                ) : (
                  <div className={styles.emptyInline}>
                    <p>Select a candidate to preview portfolio impact.</p>
                  </div>
                )}
              </div>
            ) : null}

            {tab === 'history' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Portfolio history</h3>
                  <ul className={styles.timeline}>
                    <li>
                      <CircleDot size={14} aria-hidden />
                      <div>
                        <strong>Active portfolio version</strong>
                        <span>{display(meta?.activePortfolioVersion)}</span>
                      </div>
                    </li>
                    <li>
                      <RefreshCw size={14} aria-hidden />
                      <div>
                        <strong>Last optimization</strong>
                        <span>
                          {meta?.lastOptimization
                            ? new Date(meta.lastOptimization).toLocaleString()
                            : 'UNMEASURED'}
                        </span>
                      </div>
                    </li>
                    <li>
                      <BrainCircuit size={14} aria-hidden />
                      <div>
                        <strong>AI model</strong>
                        <span>{display(meta?.aiModel)}</span>
                      </div>
                    </li>
                    <li>
                      <GitBranch size={14} aria-hidden />
                      <div>
                        <strong>Optimization cycle</strong>
                        <span>{display(meta?.optimizationCycle)}</span>
                      </div>
                    </li>
                  </ul>
                  <p className={styles.lede}>
                    Versioned optimization rollbacks remain UNMEASURED until portfolio version
                    tables are persisted.
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Audit trail</h3>
                  {!audit.length ? (
                    <p className={styles.lede}>No portfolio-related audit events persisted yet.</p>
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
            <h2>AI Explainability</h2>
            <BrainCircuit size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightStack}>
              <article className={styles.insightCard}>
                <h3>Why AI suggested it</h3>
                <p>
                  {selectedRec
                    ? `${selectedRec.action} — ${selectedRec.reason}`
                    : 'Select a recommendation to inspect XAI rationale.'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Expected improvement</h3>
                <p>
                  {selectedRec
                    ? `${selectedRec.impact} · priority ${selectedRec.priority} · confidence ${measured(selectedRec.confidence)}`
                    : `Pending rebalance actions: ${metrics?.pendingRebalanceActions ?? 0}`}
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
                  {!issues.length ? <li>No open portfolio alerts.</li> : null}
                </ul>
              </article>
              <article className={styles.insightCard}>
                <h3>Next stage</h3>
                <p>
                  Optimized portfolio notifies Qualification Handoffs. Approve / delay / replace /
                  reject decisions are applied by lifecycle workers — this page is observe-only.
                </p>
              </article>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.bottom} aria-label="Portfolio monitoring">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Automation</h2>
            <Workflow size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              On Start, workers load qualified opportunities, analyse distributions, compute
              diversity, detect imbalance, re-rank, and notify Qualification Handoffs. No manual
              intervention on this page.
            </p>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Health</h2>
            <RefreshCw size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Health</dt>
                <dd>{measured(meta?.portfolioHealth)}</dd>
              </div>
              <div>
                <dt>Rebalance queue</dt>
                <dd>{metrics?.pendingRebalanceActions ?? 0}</dd>
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
