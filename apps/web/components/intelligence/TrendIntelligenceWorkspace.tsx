'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Compass,
  Gauge,
  GitBranch,
  Layers3,
  LineChart,
  Radio,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import type {
  TrendIntelligenceOverview,
  TrendPhase,
  TrendRecord,
} from '@/lib/content-intelligence/trends';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import styles from './trend-intelligence.module.css';

type TabId =
  | 'overview'
  | 'analysis'
  | 'forecast'
  | 'opportunities'
  | 'reasoning'
  | 'dependencies'
  | 'history'
  | 'audit';

type PhaseFilter = 'all' | TrendPhase;

type TimeframeFilter = 'all' | '7d' | '30d' | '90d';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'analysis', label: 'Trend Analysis' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'opportunities', label: 'Opportunity Mapping' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'collect', label: 'Collect', icon: Radio },
  { key: 'detect', label: 'Detect', icon: Compass },
  { key: 'analyse', label: 'Analyse', icon: LineChart },
  { key: 'forecast', label: 'Forecast', icon: Activity },
  { key: 'score', label: 'Score', icon: Gauge },
  { key: 'prioritise', label: 'Prioritise', icon: Target },
  { key: 'handoff', label: 'Handoff', icon: GitBranch },
] as const;

function statusTone(status?: string | null) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'COMPLETED':
    case 'RUNNING':
    case 'ACKNOWLEDGED':
    case 'EMERGING':
    case 'GROWING':
    case 'EVERGREEN':
    case 'Completed':
    case 'Healthy':
      return styles.toneReady;
    case 'FAILED':
    case 'DECLINING':
    case 'ARCHIVED':
    case 'Failed':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'QUEUED':
    case 'PARTIAL':
    case 'WARNING':
    case 'SEASONAL':
    case 'STABLE':
    case 'UNKNOWN':
    case 'Waiting':
    case 'Analysing':
    case 'Collecting':
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

function matchesTrend(
  item: TrendRecord,
  needle: string,
  phase: PhaseFilter,
  timeframe: TimeframeFilter,
  category: string,
  region: string,
  language: string,
) {
  if (phase !== 'all' && item.phase !== phase) return false;
  if (category !== 'all' && (item.category ?? '') !== category) return false;
  if (region !== 'all' && (item.region ?? item.geographicReach ?? '') !== region) return false;
  if (language !== 'all' && (item.language ?? '') !== language) return false;

  if (timeframe !== 'all') {
    const created = new Date(item.createdAt).getTime();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    if (timeframe === '7d' && now - created > 7 * day) return false;
    if (timeframe === '30d' && now - created > 30 * day) return false;
    if (timeframe === '90d' && now - created > 90 * day) return false;
  }

  if (!needle) return true;
  const haystack = [
    item.topic,
    item.summary,
    item.phase,
    item.category,
    item.region,
    item.language,
    item.sourceName,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function lifecycleState(
  index: number,
  overview: TrendIntelligenceOverview | null,
  systemRunning: boolean,
) {
  const count = overview?.metrics.activeTrends ?? 0;
  const runStatus = overview?.run?.status;
  const hasPackage = Boolean(overview?.strategy);

  if (count > 0 && runStatus === 'COMPLETED') {
    return index <= 5 ? 'done' : index === 6 ? 'active' : 'pending';
  }
  if (count > 0 && (runStatus === 'RUNNING' || systemRunning)) {
    if (index <= 2) return 'done';
    if (index === 3) return 'active';
    return 'pending';
  }
  if (count > 0) {
    if (index <= 2) return 'done';
    if (index === 3) return 'active';
    return 'pending';
  }
  if (hasPackage || systemRunning || runStatus === 'RUNNING' || runStatus === 'QUEUED') {
    return index === 0 ? 'active' : 'pending';
  }
  return 'pending';
}

function packageLabel(overview: TrendIntelligenceOverview | null, systemRunning: boolean) {
  if ((overview?.metrics.activeTrends ?? 0) > 0 && overview?.run?.status === 'COMPLETED') {
    return 'Completed';
  }
  if (overview?.run?.status === 'RUNNING' || systemRunning) {
    return (overview?.metrics.activeTrends ?? 0) > 0 ? 'Analysing' : 'Collecting';
  }
  if (overview?.run?.status === 'FAILED') return 'Failed';
  if ((overview?.metrics.weakSignals ?? 0) > 0 && (overview?.metrics.activeTrends ?? 0) > 0) {
    return 'Warning';
  }
  if ((overview?.metrics.activeTrends ?? 0) > 0) return 'Healthy';
  if (overview?.strategy) return 'Waiting';
  return 'Empty';
}

export function TrendIntelligenceWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<TrendIntelligenceOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
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
        intelligenceApi.trends(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const items = next.trends ?? [];
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

  const trends = overview?.trends ?? [];
  const metrics = overview?.metrics;
  const needle = query.trim().toLowerCase();

  const categories = useMemo(
    () =>
      [...new Set(trends.map((item) => item.category).filter(Boolean) as string[])].sort(),
    [trends],
  );
  const regions = useMemo(
    () =>
      [
        ...new Set(
          trends
            .map((item) => item.region ?? item.geographicReach)
            .filter(Boolean) as string[],
        ),
      ].sort(),
    [trends],
  );
  const languages = useMemo(
    () =>
      [...new Set(trends.map((item) => item.language).filter(Boolean) as string[])].sort(),
    [trends],
  );

  const filtered = useMemo(
    () =>
      trends.filter((item) =>
        matchesTrend(
          item,
          needle,
          phaseFilter,
          timeframe,
          categoryFilter,
          regionFilter,
          languageFilter,
        ),
      ),
    [trends, needle, phaseFilter, timeframe, categoryFilter, regionFilter, languageFilter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    trends.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const kpis = useMemo(() => {
    const active = metrics?.activeTrends ?? 0;
    const emerging = metrics?.emergingTrends ?? 0;
    const declining = metrics?.decliningTrends ?? 0;
    const coverage = metrics?.coverageScore ?? 0;
    const opportunityIndex = metrics?.opportunityIndex ?? 0;
    const measuredConfidence = (metrics?.measuredConfidence ?? 0) > 0;
    return [
      {
        label: 'Active Trends',
        value: String(active),
        meta: 'Persisted TREND / SEASONAL signals',
        accent: '#2563EB',
        icon: LineChart,
        bars: sparkBars(active),
      },
      {
        label: 'Emerging Trends',
        value: String(emerging),
        meta: 'Phase = EMERGING',
        accent: '#22C55E',
        icon: TrendingUp,
        bars: sparkBars(emerging),
      },
      {
        label: 'Declining Trends',
        value: String(declining),
        meta: 'Phase = DECLINING',
        accent: '#EF4444',
        icon: TrendingDown,
        bars: sparkBars(declining),
      },
      {
        label: 'Trend Confidence',
        value: measuredConfidence ? String(metrics?.avgConfidence ?? 0) : 'UNMEAS.',
        meta: measuredConfidence
          ? `${metrics?.measuredConfidence} measured signal scores`
          : 'No measured confidence ≥ 1',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(metrics?.avgConfidence ?? 0),
      },
      {
        label: 'Coverage Score',
        value: `${coverage}%`,
        meta: 'Trends linked to a source',
        accent: '#0EA5E9',
        icon: Compass,
        bars: sparkBars(coverage),
      },
      {
        label: 'Opportunity Index',
        value: `${opportunityIndex}%`,
        meta: 'Trends mapped to opportunities',
        accent: '#F59E0B',
        icon: Target,
        bars: sparkBars(opportunityIndex),
      },
    ];
  }, [metrics]);

  const stageStatus = packageLabel(overview, systemRunning);

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
        <p className={styles.crumb}>Content Lifecycle / 02 Content Intelligence / Trend Intelligence</p>
        <h1 className={styles.title}>Trend Intelligence</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Trend intelligence unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  const issues = overview?.issues ?? [];
  const audit = overview?.audit ?? [];
  const phaseMix = [
    ['Emerging', metrics?.emergingTrends ?? 0],
    ['Growing', metrics?.growing ?? 0],
    ['Stable', metrics?.stable ?? 0],
    ['Declining', metrics?.decliningTrends ?? 0],
    ['Seasonal', metrics?.seasonal ?? 0],
    ['Evergreen', metrics?.evergreen ?? 0],
  ] as const;

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>Content Lifecycle / 02 Content Intelligence / Trend Intelligence</p>
          <h1 className={styles.title}>Trend Intelligence</h1>
          <p className={styles.lede}>
            Autonomously detect, validate, forecast, and prioritise evidence-backed content trends
            from verified discovery signals.
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
          Trend analysis runs automatically from persisted TREND and SEASONAL discovery signals.
          Growth, momentum, sentiment, and forecasts stay UNMEASURED unless written by workers.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Trend KPI summary">
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

      <section className={styles.lifecycle} aria-label="Trend lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Trend lifecycle</h2>
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
            Trends materialise after an acknowledged Strategy package and discovery runs persist
            TREND / SEASONAL signals.
          </div>
        </div>
      ) : null}

      {overview?.strategy && trends.length === 0 ? (
        <div className={styles.waitingBanner} role="status">
          <Activity size={18} aria-hidden />
          <div>
            <strong>Collecting trend signals</strong>
            No TREND or SEASONAL signals are persisted yet. This workspace updates when discovery
            writes verified evidence.
          </div>
        </div>
      ) : null}

      <section className={styles.workspace} aria-label="Trend intelligence workspace">
        <aside className={`${styles.panel}`} aria-label="Trend Explorer">
          <div className={styles.panelHead}>
            <h2>Trend Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search topics, categories, regions…"
                aria-label="Search trend intelligence"
              />
            </label>
            <label className={styles.field}>
              <span>Status / phase</span>
              <select
                value={phaseFilter}
                onChange={(event) => setPhaseFilter(event.target.value as PhaseFilter)}
                aria-label="Filter by trend phase"
              >
                <option value="all">All phases</option>
                <option value="EMERGING">Emerging</option>
                <option value="GROWING">Growing</option>
                <option value="STABLE">Stable</option>
                <option value="DECLINING">Declining</option>
                <option value="SEASONAL">Seasonal</option>
                <option value="EVERGREEN">Evergreen</option>
                <option value="ARCHIVED">Archived</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Timeframe</span>
              <select
                value={timeframe}
                onChange={(event) => setTimeframe(event.target.value as TimeframeFilter)}
                aria-label="Filter by timeframe"
              >
                <option value="all">All time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
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
              <span>Language</span>
              <select
                value={languageFilter}
                onChange={(event) => setLanguageFilter(event.target.value)}
                aria-label="Filter by language"
              >
                <option value="all">All languages</option>
                {languages.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </label>

            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No persisted trends match the current filters.</p>
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
                      <span className={styles.explorerTitle}>{item.topic}</span>
                      <span className={styles.explorerMeta}>
                        {item.category ?? 'Uncategorised'} · {item.sourceName ?? 'No source'}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.phase)}`}>
                          {item.phase}
                        </span>
                        <span className={styles.chip}>
                          {item.measuredConfidence ? `${Math.round(item.confidence)}%` : 'UNMEAS.'}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Trend Intelligence">
          <div className={styles.tabs} role="tablist" aria-label="Trend intelligence tabs">
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
            {!selected && tab !== 'audit' && tab !== 'dependencies' && tab !== 'analysis' ? (
              <div className={styles.emptyInline}>
                <Layers3 size={22} aria-hidden />
                <p>
                  {overview?.strategy
                    ? 'Select a trend to inspect analysis, forecast, and opportunity mapping.'
                    : 'Persisted trends appear after discovery writes TREND signals.'}
                </p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Trend profile</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Topic</dt>
                      <dd>{selected.topic}</dd>
                    </div>
                    <div>
                      <dt>Phase</dt>
                      <dd>{selected.phase}</dd>
                    </div>
                    <div>
                      <dt>Category</dt>
                      <dd>{display(selected.category)}</dd>
                    </div>
                    <div>
                      <dt>Region</dt>
                      <dd>{display(selected.region ?? selected.geographicReach)}</dd>
                    </div>
                    <div>
                      <dt>Language</dt>
                      <dd>{display(selected.language)}</dd>
                    </div>
                    <div>
                      <dt>Signal type</dt>
                      <dd>{selected.signalType}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Quality signals</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Confidence</dt>
                      <dd>
                        {selected.measuredConfidence
                          ? `${Math.round(selected.confidence)}`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Growth rate</dt>
                      <dd>{measured(selected.growthRate)}</dd>
                    </div>
                    <div>
                      <dt>Momentum</dt>
                      <dd>{measured(selected.momentum)}</dd>
                    </div>
                    <div>
                      <dt>Audience interest</dt>
                      <dd>{measured(selected.audienceInterest)}</dd>
                    </div>
                    <div>
                      <dt>Sentiment</dt>
                      <dd>{measured(selected.sentiment)}</dd>
                    </div>
                    <div>
                      <dt>Freshness</dt>
                      <dd>
                        {selected.freshnessHours != null
                          ? `${selected.freshnessHours}h`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Evidence count</dt>
                      <dd>{selected.evidenceCount}</dd>
                    </div>
                    <div>
                      <dt>Strategic relevance</dt>
                      <dd>{measured(selected.strategicRelevance)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Provenance</h3>
                  <p>{selected.summary}</p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Source</dt>
                      <dd>{display(selected.sourceName)}</dd>
                    </div>
                    <div>
                      <dt>Evidence URL</dt>
                      <dd>{display(selected.evidenceUrl)}</dd>
                    </div>
                    <div>
                      <dt>Downstream opportunities</dt>
                      <dd>{selected.opportunityCount}</dd>
                    </div>
                    <div>
                      <dt>Observed</dt>
                      <dd>
                        {selected.observedAt
                          ? new Date(selected.observedAt).toLocaleString()
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'analysis' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Phase distribution</h3>
                  <div className={styles.spark} aria-hidden style={{ gap: 8, height: 48, alignItems: 'flex-end' }}>
                    {phaseMix.map(([label, count]) => (
                      <span key={label} title={`${label}: ${count}`} style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
                        <i style={{ height: `${Math.max(4, Math.min(40, Number(count) * 8))}px`, width: 14, borderRadius: 4, background: 'var(--primary)', display: 'block' }} />
                        <em style={{ fontSize: 10, fontStyle: 'normal', color: 'var(--muted)' }}>{label}</em>
                      </span>
                    ))}
                  </div>
                  <dl className={styles.kv}>
                    {phaseMix.map(([label, count]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{count}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
                {selected ? (
                  <article className={styles.detailCard}>
                    <h3>Selected analysis</h3>
                    <dl className={styles.kv}>
                      <div>
                        <dt>Cluster key</dt>
                        <dd>{display(selected.clusterKey)}</dd>
                      </div>
                      <div>
                        <dt>Fingerprint</dt>
                        <dd>{selected.fingerprint.slice(0, 16)}…</dd>
                      </div>
                      <div>
                        <dt>Duplicates in topic</dt>
                        <dd>
                          {
                            trends.filter(
                              (item) =>
                                item.topic.trim().toLowerCase() ===
                                selected.topic.trim().toLowerCase(),
                            ).length
                          }
                        </dd>
                      </div>
                    </dl>
                  </article>
                ) : null}
              </div>
            ) : null}

            {selected && tab === 'forecast' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Forecast</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Horizon</dt>
                      <dd>{measured(selected.forecastHorizon)}</dd>
                    </div>
                    <div>
                      <dt>Decay / forecast note</dt>
                      <dd>{measured(selected.forecastNote)}</dd>
                    </div>
                    <div>
                      <dt>Momentum</dt>
                      <dd>{measured(selected.momentum)}</dd>
                    </div>
                    <div>
                      <dt>Growth rate</dt>
                      <dd>{measured(selected.growthRate)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Forecasting logic</h3>
                  <p>
                    Forecast fields are shown only when discovery workers persist them in signal
                    metadata. No synthetic velocity or seasonality curves are invented on this page.
                  </p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'opportunities' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Opportunity mapping</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Linked opportunities</dt>
                      <dd>{selected.opportunityCount}</dd>
                    </div>
                    <div>
                      <dt>Opportunity index (global)</dt>
                      <dd>{metrics?.opportunityIndex ?? 0}%</dd>
                    </div>
                    <div>
                      <dt>Strategic relevance</dt>
                      <dd>{measured(selected.strategicRelevance)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Downstream path</h3>
                  <p>
                    Linked opportunities feed verification, scoring, ranking, and Stage 03 Idea
                    Qualification handoff once gates pass.
                  </p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Why this trend was detected</h3>
                  <p>{selected.summary}</p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Confidence basis</dt>
                      <dd>
                        {selected.measuredConfidence
                          ? `Persisted signal confidence ${Math.round(selected.confidence)}`
                          : 'UNMEASURED (confidence < 1 or absent)'}
                      </dd>
                    </div>
                    <div>
                      <dt>Phase derivation</dt>
                      <dd>
                        Metadata phase when present; otherwise age/confidence heuristics on
                        persisted timestamps only
                      </dd>
                    </div>
                    <div>
                      <dt>Strategy alignment</dt>
                      <dd>
                        Bound to Strategy v{overview?.strategy?.versionNumber ?? '—'} via discovery
                        run {selected.runId.slice(0, 8)}…
                      </dd>
                    </div>
                    <div>
                      <dt>Evidence quality</dt>
                      <dd>
                        {selected.sourceName
                          ? `Linked source “${selected.sourceName}”`
                          : 'No source link'}
                        {selected.evidenceUrl ? ' · evidence URL present' : ''}
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'dependencies' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Upstream</h3>
                  <ul className={styles.bulletList}>
                    <li>Stage 01 Strategy package (ACK)</li>
                    <li>Source Registry + Discovery Runs</li>
                    <li>Persisted TREND / SEASONAL signals</li>
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Downstream</h3>
                  <ul className={styles.bulletList}>
                    <li>Audience demand & knowledge gaps</li>
                    <li>Topic opportunities & candidates</li>
                    <li>Stage 03 Idea Qualification</li>
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
                      <dt>Latest run</dt>
                      <dd>{display(overview?.run?.id?.slice(0, 8))}</dd>
                    </div>
                    <div>
                      <dt>Selected trend</dt>
                      <dd>{display(selected?.id?.slice(0, 8))}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {selected && tab === 'history' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Trend timeline</h3>
                  <ul className={styles.timeline}>
                    <li>
                      <CircleDot size={14} aria-hidden />
                      <div>
                        <strong>Signal created</strong>
                        <span>{new Date(selected.createdAt).toLocaleString()}</span>
                      </div>
                    </li>
                    <li>
                      <Activity size={14} aria-hidden />
                      <div>
                        <strong>Observed</strong>
                        <span>
                          {selected.observedAt
                            ? new Date(selected.observedAt).toLocaleString()
                            : 'Not supplied'}
                        </span>
                      </div>
                    </li>
                    <li>
                      <CheckCircle2 size={14} aria-hidden />
                      <div>
                        <strong>Current phase</strong>
                        <span>{selected.phase}</span>
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
                    <p className={styles.lede}>No trend-related audit events persisted yet.</p>
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
                <h3>Trend velocity</h3>
                <p>{measured(selected?.growthRate)}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Momentum</h3>
                <p>{measured(selected?.momentum)}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Confidence</h3>
                <p>
                  {selected?.measuredConfidence
                    ? `${Math.round(selected.confidence)}`
                    : (metrics?.measuredConfidence ?? 0) > 0
                      ? `${metrics?.avgConfidence}% average`
                      : 'UNMEASURED'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Strategic alignment</h3>
                <p>
                  Strategy v{overview?.strategy?.versionNumber ?? '—'} · relevance{' '}
                  {measured(selected?.strategicRelevance)}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Recommendations</h3>
                <ul className={styles.bulletList}>
                  {!overview?.strategy ? (
                    <li>Acknowledge an active Strategy package to unlock discovery trends.</li>
                  ) : null}
                  {overview?.strategy && trends.length === 0 ? (
                    <li>Keep the system RUNNING until discovery persists TREND signals.</li>
                  ) : null}
                  {(metrics?.weakSignals ?? 0) > 0 ? (
                    <li>Re-evaluate weak signals before promoting them to opportunities.</li>
                  ) : null}
                  {(metrics?.duplicateClusters ?? 0) > 0 ? (
                    <li>Deduplicate overlapping topics before scoring.</li>
                  ) : null}
                  {selected?.phase === 'DECLINING' ? (
                    <li>Deprioritise declining trend unless evergreen strategic fit is measured.</li>
                  ) : null}
                  {(metrics?.opportunityIndex ?? 0) > 0 ? (
                    <li>Mapped trends are ready for verification and ranking review.</li>
                  ) : null}
                </ul>
              </article>
              <article className={styles.insightCard}>
                <h3>Detected issues</h3>
                {!issues.length ? (
                  <p>No open trend anomalies in persisted state.</p>
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

      <section className={styles.bottom} aria-label="Trend health monitoring">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Health monitoring</h2>
            <AlertTriangle size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Weak signals</dt>
                <dd>{metrics?.weakSignals ?? 0}</dd>
              </div>
              <div>
                <dt>Duplicate clusters</dt>
                <dd>{metrics?.duplicateClusters ?? 0}</dd>
              </div>
              <div>
                <dt>Coverage</dt>
                <dd>{metrics?.coverageScore ?? 0}%</dd>
              </div>
            </dl>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Re-evaluation</h2>
            <RefreshCw size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              Trends re-evaluate automatically when discovery writes new signals or updates
              metadata. This page is observe-only.
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
                <dt>Opportunity index</dt>
                <dd>{metrics?.opportunityIndex ?? 0}%</dd>
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
