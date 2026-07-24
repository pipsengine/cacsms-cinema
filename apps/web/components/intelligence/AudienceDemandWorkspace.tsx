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
  MessageSquareText,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
  Users,
} from 'lucide-react';
import type {
  AudienceDemandOverview,
  AudienceDemandRecord,
  DemandStatus,
} from '@/lib/content-intelligence/audience-demand';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import styles from './audience-demand.module.css';

type TabId =
  | 'overview'
  | 'analysis'
  | 'intent'
  | 'segments'
  | 'reasoning'
  | 'dependencies'
  | 'history'
  | 'audit';

type StatusFilter = 'all' | DemandStatus;

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'analysis', label: 'Demand Analysis' },
  { id: 'intent', label: 'Search Intent' },
  { id: 'segments', label: 'Audience Segments' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'collect', label: 'Collect', icon: Radio },
  { key: 'analyse', label: 'Analyse', icon: Search },
  { key: 'segment', label: 'Segment', icon: Users },
  { key: 'predict', label: 'Predict', icon: Activity },
  { key: 'prioritise', label: 'Prioritise', icon: Target },
  { key: 'validate', label: 'Validate', icon: CheckCircle2 },
  { key: 'handoff', label: 'Handoff', icon: GitBranch },
] as const;

function statusTone(status?: string | null) {
  switch (status) {
    case 'ACTIVE':
    case 'HIGH':
    case 'EMERGING':
    case 'COMPLETED':
    case 'RUNNING':
    case 'ACKNOWLEDGED':
    case 'Completed':
    case 'Healthy':
      return styles.toneReady;
    case 'FAILED':
    case 'WEAK':
    case 'STALE':
    case 'ARCHIVED':
    case 'Failed':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'MODERATE':
    case 'WARNING':
    case 'UNKNOWN':
    case 'Waiting':
    case 'Collecting':
    case 'Analysing':
    case 'Forecasting':
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

function matchesDemand(
  item: AudienceDemandRecord,
  needle: string,
  status: StatusFilter,
  audience: string,
  region: string,
  language: string,
  platform: string,
) {
  if (status !== 'all' && item.status !== status) return false;
  if (audience !== 'all' && (item.audience ?? 'Unspecified audience') !== audience) return false;
  if (region !== 'all' && (item.geography ?? '') !== region) return false;
  if (language !== 'all' && (item.language ?? '') !== language) return false;
  if (platform !== 'all' && (item.platform ?? '') !== platform) return false;
  if (!needle) return true;
  const haystack = [
    item.topic,
    item.summary,
    item.audience,
    item.intent,
    item.geography,
    item.language,
    item.platform,
    item.status,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function lifecycleState(
  index: number,
  overview: AudienceDemandOverview | null,
  systemRunning: boolean,
) {
  const count = overview?.demands.length ?? 0;
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

function packageLabel(overview: AudienceDemandOverview | null, systemRunning: boolean) {
  if ((overview?.demands.length ?? 0) > 0 && overview?.run?.status === 'COMPLETED') {
    return 'Completed';
  }
  if (overview?.run?.status === 'RUNNING' || systemRunning) {
    return (overview?.demands.length ?? 0) > 0 ? 'Analysing' : 'Collecting';
  }
  if (overview?.run?.status === 'FAILED') return 'Failed';
  if ((overview?.metrics.weakDemand ?? 0) > 0 && (overview?.demands.length ?? 0) > 0) {
    return 'Warning';
  }
  if ((overview?.demands.length ?? 0) > 0) return 'Healthy';
  if (overview?.strategy) return 'Waiting';
  return 'Empty';
}

export function AudienceDemandWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<AudienceDemandOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
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
        intelligenceApi.audienceDemand(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const items = next.demands ?? [];
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

  const demands = overview?.demands ?? [];
  const metrics = overview?.metrics;
  const segments = overview?.segments ?? [];
  const needle = query.trim().toLowerCase();

  const audiences = useMemo(
    () =>
      [
        ...new Set(
          demands.map((item) => item.audience?.trim() || 'Unspecified audience'),
        ),
      ].sort(),
    [demands],
  );
  const regions = useMemo(
    () => [...new Set(demands.map((item) => item.geography).filter(Boolean) as string[])].sort(),
    [demands],
  );
  const languages = useMemo(
    () => [...new Set(demands.map((item) => item.language).filter(Boolean) as string[])].sort(),
    [demands],
  );
  const platforms = useMemo(
    () => [...new Set(demands.map((item) => item.platform).filter(Boolean) as string[])].sort(),
    [demands],
  );

  const filtered = useMemo(
    () =>
      demands.filter((item) =>
        matchesDemand(
          item,
          needle,
          statusFilter,
          audienceFilter,
          regionFilter,
          languageFilter,
          platformFilter,
        ),
      ),
    [demands, needle, statusFilter, audienceFilter, regionFilter, languageFilter, platformFilter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    demands.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const kpis = useMemo(() => {
    const segmentsCount = metrics?.audienceSegments ?? 0;
    const highDemand = metrics?.highDemandTopics ?? 0;
    const demandIndex = metrics?.demandIndex ?? 0;
    const opportunityScore = metrics?.opportunityScore ?? 0;
    const measuredIntent = (metrics?.measuredIntent ?? 0) > 0;
    const measuredConfidence = (metrics?.measuredConfidence ?? 0) > 0;
    return [
      {
        label: 'Audience Segments',
        value: String(segmentsCount),
        meta: 'Distinct audiences + opportunity segments',
        accent: '#2563EB',
        icon: Users,
        bars: sparkBars(segmentsCount),
      },
      {
        label: 'High-Demand Topics',
        value: String(highDemand),
        meta: 'HIGH status or measured score ≥ 75/70',
        accent: '#22C55E',
        icon: Target,
        bars: sparkBars(highDemand),
      },
      {
        label: 'Search Intent Score',
        value: measuredIntent ? String(metrics?.avgSearchIntent ?? 0) : 'UNMEAS.',
        meta: measuredIntent
          ? `${metrics?.measuredIntent} measured intent scores`
          : 'No searchIntentScore in metadata',
        accent: '#0EA5E9',
        icon: Search,
        bars: sparkBars(metrics?.avgSearchIntent ?? 0),
      },
      {
        label: 'Demand Index',
        value: `${demandIndex}%`,
        meta: 'High-demand + opportunity linkage mix',
        accent: '#F59E0B',
        icon: Gauge,
        bars: sparkBars(demandIndex),
      },
      {
        label: 'AI Confidence',
        value: measuredConfidence ? String(metrics?.avgConfidence ?? 0) : 'UNMEAS.',
        meta: measuredConfidence
          ? `${metrics?.measuredConfidence} measured signal scores`
          : 'No measured confidence ≥ 1',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(metrics?.avgConfidence ?? 0),
      },
      {
        label: 'Opportunity Score',
        value: `${opportunityScore}%`,
        meta: 'Demand signals linked to opportunities',
        accent: '#EF4444',
        icon: MessageSquareText,
        bars: sparkBars(opportunityScore),
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
        <p className={styles.crumb}>Content Lifecycle / 02 Content Intelligence / Audience Demand</p>
        <h1 className={styles.title}>Audience Demand Intelligence</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Audience demand unavailable</h2>
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
          <p className={styles.crumb}>Content Lifecycle / 02 Content Intelligence / Audience Demand</p>
          <h1 className={styles.title}>Audience Demand Intelligence</h1>
          <p className={styles.lede}>
            Autonomously identify, measure, and prioritise audience needs from verified discovery
            signals for Stage 03 Idea Qualification.
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
          Audience demand is derived from persisted AUDIENCE_DEMAND signals. Engagement, growth,
          intent scores, and forecasts stay UNMEASURED unless workers write them.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Audience demand KPI summary">
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

      <section className={styles.lifecycle} aria-label="Audience demand lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Demand lifecycle</h2>
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
            Audience demand appears after an acknowledged Strategy package and discovery persists
            AUDIENCE_DEMAND signals.
          </div>
        </div>
      ) : null}

      {overview?.strategy && demands.length === 0 ? (
        <div className={styles.waitingBanner} role="status">
          <Activity size={18} aria-hidden />
          <div>
            <strong>Collecting audience signals</strong>
            No AUDIENCE_DEMAND records are persisted yet. This workspace updates when discovery
            writes verified evidence.
          </div>
        </div>
      ) : null}

      <section className={styles.workspace} aria-label="Audience intelligence workspace">
        <aside className={styles.panel} aria-label="Audience Explorer">
          <div className={styles.panelHead}>
            <h2>Audience Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search topics, audiences, intent…"
                aria-label="Search audience demand"
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
                <option value="ACTIVE">Active</option>
                <option value="EMERGING">Emerging</option>
                <option value="HIGH">High</option>
                <option value="MODERATE">Moderate</option>
                <option value="WEAK">Weak</option>
                <option value="STALE">Stale</option>
                <option value="ARCHIVED">Archived</option>
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
            <label className={styles.field}>
              <span>Platform</span>
              <select
                value={platformFilter}
                onChange={(event) => setPlatformFilter(event.target.value)}
                aria-label="Filter by platform"
              >
                <option value="all">All platforms</option>
                {platforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </label>

            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No persisted audience demand records match the current filters.</p>
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
                        {item.audience ?? 'Unspecified audience'} · {item.intent ?? 'Intent UNMEAS.'}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.status)}`}>
                          {item.status}
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

        <section className={`${styles.panel} ${styles.center}`} aria-label="Audience Intelligence">
          <div className={styles.tabs} role="tablist" aria-label="Audience intelligence tabs">
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
            {!selected && tab !== 'audit' && tab !== 'dependencies' && tab !== 'segments' ? (
              <div className={styles.emptyInline}>
                <Layers3 size={22} aria-hidden />
                <p>
                  {overview?.strategy
                    ? 'Select a demand record to inspect intent, segments, and recommendations.'
                    : 'Persisted audience demand appears after discovery writes AUDIENCE_DEMAND signals.'}
                </p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Demand profile</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Topic</dt>
                      <dd>{selected.topic}</dd>
                    </div>
                    <div>
                      <dt>Audience</dt>
                      <dd>{display(selected.audience)}</dd>
                    </div>
                    <div>
                      <dt>Intent</dt>
                      <dd>{display(selected.intent)}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{selected.status}</dd>
                    </div>
                    <div>
                      <dt>Geography</dt>
                      <dd>{display(selected.geography)}</dd>
                    </div>
                    <div>
                      <dt>Language</dt>
                      <dd>{display(selected.language)}</dd>
                    </div>
                    <div>
                      <dt>Platform</dt>
                      <dd>{display(selected.platform)}</dd>
                    </div>
                    <div>
                      <dt>Priority</dt>
                      <dd>{measured(selected.priority)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Scores & evidence</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Demand score</dt>
                      <dd>{measured(selected.demandScore)}</dd>
                    </div>
                    <div>
                      <dt>Search intent score</dt>
                      <dd>{measured(selected.searchIntentScore)}</dd>
                    </div>
                    <div>
                      <dt>Engagement</dt>
                      <dd>{measured(selected.engagement)}</dd>
                    </div>
                    <div>
                      <dt>Sentiment</dt>
                      <dd>{measured(selected.sentiment)}</dd>
                    </div>
                    <div>
                      <dt>Confidence</dt>
                      <dd>
                        {selected.measuredConfidence
                          ? `${Math.round(selected.confidence)}`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Opportunity rating</dt>
                      <dd>{measured(selected.opportunityRating)}</dd>
                    </div>
                    <div>
                      <dt>Supporting source</dt>
                      <dd>{display(selected.sourceName)}</dd>
                    </div>
                    <div>
                      <dt>Evidence URL</dt>
                      <dd>{display(selected.evidenceUrl)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Needs & recommendations</h3>
                  <p>{selected.summary}</p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Unmet need</dt>
                      <dd>{selected.unmetNeed ? 'Yes' : 'No'}</dd>
                    </div>
                    <div>
                      <dt>Linked opportunities</dt>
                      <dd>{selected.opportunityCount}</dd>
                    </div>
                    <div>
                      <dt>Freshness</dt>
                      <dd>
                        {selected.freshnessHours != null
                          ? `${selected.freshnessHours}h`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                  </dl>
                  {selected.contentRecommendations.length ? (
                    <ul className={styles.bulletList}>
                      {selected.contentRecommendations.map((rec) => (
                        <li key={rec}>{rec}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.lede}>No downstream content recommendations persisted.</p>
                  )}
                </article>
              </div>
            ) : null}

            {selected && tab === 'analysis' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Demand analysis</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Demand score</dt>
                      <dd>{measured(selected.demandScore)}</dd>
                    </div>
                    <div>
                      <dt>Engagement</dt>
                      <dd>{measured(selected.engagement)}</dd>
                    </div>
                    <div>
                      <dt>Pain points</dt>
                      <dd>
                        {selected.painPoints.length
                          ? selected.painPoints.join('; ')
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Audience questions</dt>
                      <dd>
                        {selected.questions.length ? selected.questions.join('; ') : 'UNMEASURED'}
                      </dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Seasonality & correlation</h3>
                  <p>
                    Seasonal and trend-correlation fields appear only when discovery workers persist
                    them. No synthetic engagement curves are invented here.
                  </p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Forecast horizon</dt>
                      <dd>{measured(selected.forecastHorizon)}</dd>
                    </div>
                    <div>
                      <dt>Forecast note</dt>
                      <dd>{measured(selected.forecastNote)}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {selected && tab === 'intent' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Search intent</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Intent label</dt>
                      <dd>{display(selected.intent)}</dd>
                    </div>
                    <div>
                      <dt>Intent score</dt>
                      <dd>{measured(selected.searchIntentScore)}</dd>
                    </div>
                    <div>
                      <dt>Global avg intent</dt>
                      <dd>
                        {(metrics?.measuredIntent ?? 0) > 0
                          ? String(metrics?.avgSearchIntent)
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Behavioural pattern</h3>
                  <p>
                    Intent is explained from persisted metadata and signal summary. Competing
                    platforms stay UNMEASURED unless comparison scores are written by workers.
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'segments' ? (
              <div className={styles.detailGrid}>
                {!segments.length ? (
                  <div className={styles.emptyInline}>
                    <p>No audience segments persisted yet.</p>
                  </div>
                ) : (
                  segments.map((segment) => (
                    <article key={segment.audience} className={styles.detailCard}>
                      <h3>{segment.audience}</h3>
                      <dl className={styles.kv}>
                        <div>
                          <dt>Records</dt>
                          <dd>{segment.count}</dd>
                        </div>
                        <div>
                          <dt>Avg confidence</dt>
                          <dd>
                            {segment.avgConfidence != null
                              ? String(segment.avgConfidence)
                              : 'UNMEASURED'}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))
                )}
              </div>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Why this demand exists</h3>
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
                      <dt>Evidence source</dt>
                      <dd>{display(selected.sourceName)}</dd>
                    </div>
                    <div>
                      <dt>Strategy alignment</dt>
                      <dd>
                        Bound to Strategy v{overview?.strategy?.versionNumber ?? '—'} via run{' '}
                        {selected.runId.slice(0, 8)}…
                      </dd>
                    </div>
                    <div>
                      <dt>Forecasting logic</dt>
                      <dd>{measured(selected.forecastNote)}</dd>
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
                    <li>Discovery Runs + Source Registry</li>
                    <li>Persisted AUDIENCE_DEMAND signals</li>
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Downstream</h3>
                  <ul className={styles.bulletList}>
                    <li>Knowledge gaps & topic opportunities</li>
                    <li>Candidate generation & verification</li>
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
                      <dt>Selected demand</dt>
                      <dd>{display(selected?.id?.slice(0, 8))}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {selected && tab === 'history' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Demand timeline</h3>
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
                        <strong>Current status</strong>
                        <span>{selected.status}</span>
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
                    <p className={styles.lede}>No audience-related audit events persisted yet.</p>
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
                <h3>Demand score</h3>
                <p>{measured(selected?.demandScore)}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Growth</h3>
                <p>{measured(selected?.forecastNote)}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Engagement</h3>
                <p>{measured(selected?.engagement)}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Strategic alignment</h3>
                <p>
                  Strategy v{overview?.strategy?.versionNumber ?? '—'} · opportunity rating{' '}
                  {measured(selected?.opportunityRating)}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Recommendations</h3>
                <ul className={styles.bulletList}>
                  {!overview?.strategy ? (
                    <li>Acknowledge an active Strategy package to unlock demand signals.</li>
                  ) : null}
                  {overview?.strategy && demands.length === 0 ? (
                    <li>Keep the system RUNNING until discovery persists AUDIENCE_DEMAND.</li>
                  ) : null}
                  {(metrics?.weakDemand ?? 0) > 0 ? (
                    <li>Re-evaluate weak demand before promoting to candidates.</li>
                  ) : null}
                  {(metrics?.staleInsights ?? 0) > 0 ? (
                    <li>Refresh stale audience insights before scoring.</li>
                  ) : null}
                  {(metrics?.unmetNeeds ?? 0) > 0 ? (
                    <li>Prioritise flagged unmet needs for opportunity mapping.</li>
                  ) : null}
                  {(metrics?.opportunityScore ?? 0) > 0 ? (
                    <li>Mapped demand is ready for verification and Stage 03 handoff review.</li>
                  ) : null}
                </ul>
              </article>
              <article className={styles.insightCard}>
                <h3>Detected issues</h3>
                {!issues.length ? (
                  <p>No open audience-demand anomalies in persisted state.</p>
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

      <section className={styles.bottom} aria-label="Audience demand monitoring">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Health monitoring</h2>
            <AlertTriangle size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Weak demand</dt>
                <dd>{metrics?.weakDemand ?? 0}</dd>
              </div>
              <div>
                <dt>Stale insights</dt>
                <dd>{metrics?.staleInsights ?? 0}</dd>
              </div>
              <div>
                <dt>Duplicate topics</dt>
                <dd>{metrics?.duplicateTopics ?? 0}</dd>
              </div>
              <div>
                <dt>Unmet needs</dt>
                <dd>{metrics?.unmetNeeds ?? 0}</dd>
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
              Demand re-evaluates automatically when discovery writes new AUDIENCE_DEMAND signals or
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
                <dt>Demand index</dt>
                <dd>{metrics?.demandIndex ?? 0}%</dd>
              </div>
              <div>
                <dt>Opportunity score</dt>
                <dd>{metrics?.opportunityScore ?? 0}%</dd>
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
