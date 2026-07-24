'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  FileSearch,
  Gauge,
  GitBranch,
  Layers3,
  Lightbulb,
  ListOrdered,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
} from 'lucide-react';
import type {
  TopicOpportunitiesOverview,
  TopicOpportunityRecord,
} from '@/lib/content-intelligence/topic-opportunities';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import styles from './topic-opportunities.module.css';

type TabId =
  | 'overview'
  | 'opportunities'
  | 'scoring'
  | 'evidence'
  | 'reasoning'
  | 'dependencies'
  | 'history'
  | 'audit';

type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'collect', label: 'Collect', icon: FileSearch },
  { key: 'correlate', label: 'Correlate', icon: Activity },
  { key: 'score', label: 'Score', icon: Gauge },
  { key: 'rank', label: 'Rank', icon: ListOrdered },
  { key: 'explain', label: 'Explain', icon: Lightbulb },
  { key: 'recommend', label: 'Recommend', icon: Sparkles },
  { key: 'handoff', label: 'Handoff', icon: GitBranch },
] as const;

function statusTone(status?: string | null) {
  switch (status) {
    case 'QUALIFIED':
    case 'VERIFIED':
    case 'HANDED_OFF':
    case 'COMPLETED':
    case 'RUNNING':
    case 'ACKNOWLEDGED':
    case 'DISCOVERED':
    case 'Completed':
    case 'Ranked':
    case 'Healthy':
      return styles.toneReady;
    case 'BLOCKED':
    case 'REJECTED':
    case 'FAILED':
    case 'ARCHIVED':
    case 'Failed':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'ENRICHING':
    case 'WARNING':
    case 'Waiting':
    case 'Analysing':
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

function isHighPriority(item: TopicOpportunityRecord) {
  return (
    (item.priority != null && item.priority <= 10) ||
    (item.rankPosition != null && item.rankPosition <= 10) ||
    (item.measuredScore && item.opportunityScore >= 75) ||
    item.status === 'QUALIFIED' ||
    item.status === 'HANDED_OFF'
  );
}

function matchesOpportunity(
  item: TopicOpportunityRecord,
  needle: string,
  status: string,
  domain: string,
  audience: string,
  region: string,
  language: string,
  priority: PriorityFilter,
) {
  if (status !== 'all' && item.status !== status) return false;
  if (domain !== 'all' && item.domain !== domain) return false;
  if (audience !== 'all' && (item.audience ?? '') !== audience) return false;
  if (region !== 'all' && (item.geography ?? '') !== region) return false;
  if (language !== 'all') return false; // language not persisted on opportunity rows
  if (priority === 'high' && !isHighPriority(item)) return false;
  if (priority === 'medium') {
    const mid =
      (item.measuredScore && item.opportunityScore >= 40 && item.opportunityScore < 75) ||
      (item.rankPosition != null && item.rankPosition > 10 && item.rankPosition <= 30);
    if (!mid) return false;
  }
  if (priority === 'low' && (isHighPriority(item) || (item.measuredScore && item.opportunityScore >= 40))) {
    return false;
  }
  if (!needle) return true;
  const haystack = [
    item.topic,
    item.summary,
    item.domain,
    item.audience,
    item.geography,
    item.status,
    item.formatHint,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function lifecycleState(
  index: number,
  overview: TopicOpportunitiesOverview | null,
  systemRunning: boolean,
) {
  const count = overview?.metrics.opportunities ?? 0;
  const runStatus = overview?.run?.status;
  const hasPackage = Boolean(overview?.strategy);
  const ranked = (overview?.opportunities ?? []).some((item) => item.rankPosition != null);

  if (count > 0 && ranked && runStatus === 'COMPLETED') {
    return index <= 5 ? 'done' : index === 6 ? 'active' : 'pending';
  }
  if (count > 0 && (runStatus === 'RUNNING' || systemRunning)) {
    if (index <= 2) return 'done';
    if (index === 3) return 'active';
    return 'pending';
  }
  if (count > 0) {
    if (index <= 2) return 'done';
    if (index === 3) return ranked ? 'done' : 'active';
    return 'pending';
  }
  if (hasPackage || systemRunning || runStatus === 'RUNNING' || runStatus === 'QUEUED') {
    return index === 0 ? 'active' : 'pending';
  }
  return 'pending';
}

function packageLabel(overview: TopicOpportunitiesOverview | null, systemRunning: boolean) {
  const ranked = (overview?.opportunities ?? []).some((item) => item.rankPosition != null);
  if ((overview?.metrics.opportunities ?? 0) > 0 && ranked) return 'Ranked';
  if ((overview?.metrics.opportunities ?? 0) > 0 && overview?.run?.status === 'COMPLETED') {
    return 'Completed';
  }
  if (overview?.run?.status === 'RUNNING' || systemRunning) {
    return (overview?.metrics.opportunities ?? 0) > 0 ? 'Analysing' : 'Collecting';
  }
  if (overview?.run?.status === 'FAILED') return 'Failed';
  if ((overview?.metrics.blocked ?? 0) > 0) return 'Warning';
  if ((overview?.metrics.opportunities ?? 0) > 0) return 'Healthy';
  if (overview?.strategy) return 'Waiting';
  return 'Empty';
}

export function TopicOpportunitiesWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<TopicOpportunitiesOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [domainFilter, setDomainFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
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
        intelligenceApi.topicOpportunities(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const items = next.opportunities ?? [];
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

  const opportunities = overview?.opportunities ?? [];
  const metrics = overview?.metrics;
  const needle = query.trim().toLowerCase();

  const domains = useMemo(
    () => [...new Set(opportunities.map((item) => item.domain).filter(Boolean))].sort(),
    [opportunities],
  );
  const audiences = useMemo(
    () =>
      [...new Set(opportunities.map((item) => item.audience).filter(Boolean) as string[])].sort(),
    [opportunities],
  );
  const regions = useMemo(
    () =>
      [
        ...new Set(opportunities.map((item) => item.geography).filter(Boolean) as string[]),
      ].sort(),
    [opportunities],
  );
  const statuses = useMemo(
    () => [...new Set(opportunities.map((item) => item.status))].sort(),
    [opportunities],
  );

  const filtered = useMemo(
    () =>
      opportunities.filter((item) =>
        matchesOpportunity(
          item,
          needle,
          statusFilter,
          domainFilter,
          audienceFilter,
          regionFilter,
          'all',
          priorityFilter,
        ),
      ),
    [
      opportunities,
      needle,
      statusFilter,
      domainFilter,
      audienceFilter,
      regionFilter,
      priorityFilter,
    ],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    opportunities.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const kpis = useMemo(() => {
    const count = metrics?.opportunities ?? 0;
    const highPriority = metrics?.highPriority ?? 0;
    const approved = metrics?.approved ?? 0;
    const measuredScores = (metrics?.measuredScores ?? 0) > 0;
    const measuredDemand = (metrics?.measuredDemand ?? 0) > 0;
    const measuredConfidence = (metrics?.measuredConfidence ?? 0) > 0;
    return [
      {
        label: 'Opportunities',
        value: String(count),
        meta: 'Persisted ci_opportunities',
        accent: '#2563EB',
        icon: Lightbulb,
        bars: sparkBars(count),
      },
      {
        label: 'High Priority',
        value: String(highPriority),
        meta: 'Top rank / score / qualified',
        accent: '#F59E0B',
        icon: Target,
        bars: sparkBars(highPriority),
      },
      {
        label: 'Opportunity Score',
        value: measuredScores ? String(metrics?.avgOpportunityScore ?? 0) : 'UNMEAS.',
        meta: measuredScores
          ? `${metrics?.measuredScores} scored opportunities`
          : 'No opportunity scores > 0',
        accent: '#0EA5E9',
        icon: Gauge,
        bars: sparkBars(metrics?.avgOpportunityScore ?? 0),
      },
      {
        label: 'Demand Score',
        value: measuredDemand ? String(metrics?.avgDemandScore ?? 0) : 'UNMEAS.',
        meta: measuredDemand
          ? `${metrics?.measuredDemand} measured demand factors`
          : 'No demand factor in score metadata',
        accent: '#22C55E',
        icon: Activity,
        bars: sparkBars(metrics?.avgDemandScore ?? 0),
      },
      {
        label: 'AI Confidence',
        value: measuredConfidence ? String(metrics?.avgConfidence ?? 0) : 'UNMEAS.',
        meta: measuredConfidence
          ? `${metrics?.measuredConfidence} measured confidence scores`
          : 'No measured confidence ≥ 1',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(metrics?.avgConfidence ?? 0),
      },
      {
        label: 'Approved',
        value: String(approved),
        meta: 'Verified / qualified / handed off',
        accent: '#EF4444',
        icon: CheckCircle2,
        bars: sparkBars(approved),
      },
    ];
  }, [metrics]);

  const stageStatus = packageLabel(overview, systemRunning);
  const rankedTable = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const ra = a.rankPosition ?? Number.MAX_SAFE_INTEGER;
        const rb = b.rankPosition ?? Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
        return b.opportunityScore - a.opportunityScore;
      }),
    [filtered],
  );

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
          Content Lifecycle / 02 Content Intelligence / Topic Opportunities
        </p>
        <h1 className={styles.title}>Topic Opportunity Intelligence</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Topic opportunities unavailable</h2>
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
            Content Lifecycle / 02 Content Intelligence / Topic Opportunities
          </p>
          <h1 className={styles.title}>Topic Opportunity Intelligence</h1>
          <p className={styles.lede}>
            Autonomously correlate verified signals into scored, explained, and ranked content
            opportunities ready for Stage 03 – Idea Qualification.
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
          Opportunities are persisted from discovery. Demand, competition, ROI, and predicted
          performance stay UNMEASURED unless score factors are written by workers.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Topic opportunity KPI summary">
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

      <section className={styles.lifecycle} aria-label="Opportunity lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Opportunity lifecycle</h2>
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
            Topic opportunities appear after an acknowledged Strategy package and discovery
            persists scored candidates.
          </div>
        </div>
      ) : null}

      {overview?.strategy && opportunities.length === 0 ? (
        <div className={styles.waitingBanner} role="status">
          <Activity size={18} aria-hidden />
          <div>
            <strong>Correlating verified signals</strong>
            No opportunities are persisted yet. This workspace updates when discovery writes
            candidates into ci_opportunities.
          </div>
        </div>
      ) : null}

      <section className={styles.workspace} aria-label="Topic opportunity workspace">
        <aside className={styles.panel} aria-label="Opportunity Explorer">
          <div className={styles.panelHead}>
            <h2>Opportunity Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search topics, domains, audiences…"
                aria-label="Search topic opportunities"
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
            <label className={styles.field}>
              <span>Domain</span>
              <select
                value={domainFilter}
                onChange={(event) => setDomainFilter(event.target.value)}
                aria-label="Filter by domain"
              >
                <option value="all">All domains</option>
                {domains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
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

            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No persisted opportunities match the current filters.</p>
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
                        {item.domain}
                        {item.rankPosition != null ? ` · Rank #${item.rankPosition}` : ''}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                        <span className={styles.chip}>
                          {item.measuredScore ? item.opportunityScore.toFixed(1) : 'UNMEAS.'}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Opportunity Intelligence">
          <div className={styles.tabs} role="tablist" aria-label="Opportunity tabs">
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
            {!selected &&
            tab !== 'audit' &&
            tab !== 'dependencies' &&
            tab !== 'opportunities' ? (
              <div className={styles.emptyInline}>
                <Layers3 size={22} aria-hidden />
                <p>
                  {overview?.strategy
                    ? 'Select an opportunity to inspect scoring, evidence, and explainability.'
                    : 'Persisted opportunities appear after discovery writes candidates.'}
                </p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Opportunity profile</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Topic</dt>
                      <dd>{selected.topic}</dd>
                    </div>
                    <div>
                      <dt>Category / domain</dt>
                      <dd>{selected.domain}</dd>
                    </div>
                    <div>
                      <dt>Audience</dt>
                      <dd>{display(selected.audience)}</dd>
                    </div>
                    <div>
                      <dt>Region</dt>
                      <dd>{display(selected.geography)}</dd>
                    </div>
                    <div>
                      <dt>Recommended format</dt>
                      <dd>{display(selected.formatHint)}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{selected.status}</dd>
                    </div>
                    <div>
                      <dt>Rank</dt>
                      <dd>
                        {selected.rankPosition != null ? `#${selected.rankPosition}` : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Priority</dt>
                      <dd>{measured(selected.priority)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Scores</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Opportunity score</dt>
                      <dd>
                        {selected.measuredScore
                          ? selected.opportunityScore.toFixed(2)
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Demand</dt>
                      <dd>{measured(selected.demandScore)}</dd>
                    </div>
                    <div>
                      <dt>Competition</dt>
                      <dd>{measured(selected.competitionScore)}</dd>
                    </div>
                    <div>
                      <dt>Trend strength</dt>
                      <dd>{measured(selected.trendStrength)}</dd>
                    </div>
                    <div>
                      <dt>Evidence quality</dt>
                      <dd>{measured(selected.evidenceQuality)}</dd>
                    </div>
                    <div>
                      <dt>Audience fit</dt>
                      <dd>{measured(selected.audienceFit)}</dd>
                    </div>
                    <div>
                      <dt>Strategic alignment</dt>
                      <dd>{measured(selected.strategicAlignment)}</dd>
                    </div>
                    <div>
                      <dt>Confidence</dt>
                      <dd>
                        {selected.measuredConfidence
                          ? `${Math.round(selected.confidence)}`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Summary & downstream</h3>
                  <p>{selected.summary}</p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Expected ROI</dt>
                      <dd>{measured(selected.expectedRoi)}</dd>
                    </div>
                    <div>
                      <dt>Predicted performance</dt>
                      <dd>{measured(selected.predictedPerformance)}</dd>
                    </div>
                    <div>
                      <dt>Handoff</dt>
                      <dd>{display(selected.handoffStatus)}</dd>
                    </div>
                    <div>
                      <dt>Duplicate similarity</dt>
                      <dd>{measured(selected.duplicateSimilarity)}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'opportunities' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Ranked opportunities</h3>
                  {!rankedTable.length ? (
                    <p className={styles.lede}>No opportunities to rank yet.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Rank</th>
                          <th scope="col">Topic</th>
                          <th scope="col">Score</th>
                          <th scope="col">Status</th>
                          <th scope="col">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankedTable.slice(0, 25).map((item, index) => (
                          <tr key={item.id}>
                            <td>{item.rankPosition ?? index + 1}</td>
                            <td>{item.topic}</td>
                            <td>
                              {item.measuredScore
                                ? item.opportunityScore.toFixed(1)
                                : 'UNMEASURED'}
                            </td>
                            <td>{item.status}</td>
                            <td>
                              {item.measuredConfidence
                                ? Math.round(item.confidence)
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

            {selected && tab === 'scoring' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Scoring factors</h3>
                  {Object.keys(selected.scoreFactors).length ? (
                    <dl className={styles.kv}>
                      {Object.entries(selected.scoreFactors).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className={styles.lede}>No score factors persisted for this opportunity.</p>
                  )}
                </article>
                <article className={styles.detailCard}>
                  <h3>Content potential heatmap</h3>
                  <div
                    className={styles.spark}
                    aria-hidden
                    style={{ height: 40, alignItems: 'flex-end', gap: 6 }}
                  >
                    {[
                      selected.demandScore,
                      selected.trendStrength,
                      selected.evidenceQuality,
                      selected.audienceFit,
                      selected.strategicAlignment,
                      selected.opportunityScore,
                    ].map((value, index) => (
                      <i
                        key={index}
                        style={{
                          height: `${Math.max(4, Math.min(36, ((value ?? 0) / 100) * 36 || 4))}px`,
                          width: 16,
                          borderRadius: 4,
                          background: 'var(--primary)',
                          display: 'block',
                          opacity: value == null ? 0.2 : 1,
                        }}
                      />
                    ))}
                  </div>
                  <p className={styles.lede}>
                    Bars reflect measured factors only; empty bars mean UNMEASURED.
                  </p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'evidence' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Supporting evidence</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Linked signals</dt>
                      <dd>{selected.evidenceCount}</dd>
                    </div>
                    <div>
                      <dt>Verifications passed</dt>
                      <dd>{selected.verificationPassed}</dd>
                    </div>
                    <div>
                      <dt>Verifications failed</dt>
                      <dd>{selected.verificationFailed}</dd>
                    </div>
                  </dl>
                  {selected.signalSubjects.length ? (
                    <ul className={styles.bulletList}>
                      {selected.signalSubjects.map((subject) => (
                        <li key={subject}>{subject}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.lede}>No linked signal subjects persisted.</p>
                  )}
                </article>
                <article className={styles.detailCard}>
                  <h3>Traceability</h3>
                  <p>
                    Evidence links come from ci_opportunity_signals and ci_verifications. Semantic
                    similarity uses persisted duplicate_similarity when present.
                  </p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>AI explainability</h3>
                  <p>
                    {selected.scoreExplanation ??
                      selected.summary}
                  </p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Scoring logic</dt>
                      <dd>
                        {Object.keys(selected.scoreFactors).length
                          ? `${Object.keys(selected.scoreFactors).length} persisted factor(s)`
                          : 'UNMEASURED — awaiting ci_scores factors'}
                      </dd>
                    </div>
                    <div>
                      <dt>Strategic alignment</dt>
                      <dd>
                        Strategy v{overview?.strategy?.versionNumber ?? '—'} · fit{' '}
                        {measured(selected.strategicAlignment)}
                      </dd>
                    </div>
                    <div>
                      <dt>Trend correlation</dt>
                      <dd>{measured(selected.trendStrength)}</dd>
                    </div>
                    <div>
                      <dt>Risk</dt>
                      <dd>{measured(selected.riskScore)}</dd>
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
                    <li>Strategy package (ACK)</li>
                    <li>Trends, audience demand, knowledge gaps, competitors</li>
                    <li>Verified discovery signals</li>
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Downstream</h3>
                  <ul className={styles.bulletList}>
                    <li>Verification, duplicates, scoring, ranking</li>
                    <li>Portfolio balance</li>
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
                      <dt>Run</dt>
                      <dd>{display(selected?.runId?.slice(0, 8) ?? overview?.run?.id?.slice(0, 8))}</dd>
                    </div>
                    <div>
                      <dt>Selected</dt>
                      <dd>{display(selected?.id?.slice(0, 8))}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {selected && tab === 'history' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Opportunity timeline</h3>
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
                      <CheckCircle2 size={14} aria-hidden />
                      <div>
                        <strong>Current status</strong>
                        <span>
                          {selected.status}
                          {selected.rankPosition != null ? ` · Rank #${selected.rankPosition}` : ''}
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
                    <p className={styles.lede}>No opportunity-related audit events persisted yet.</p>
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
                <h3>Business value</h3>
                <p>
                  Score{' '}
                  {selected?.measuredScore
                    ? selected.opportunityScore.toFixed(1)
                    : 'UNMEASURED'}{' '}
                  · ROI {measured(selected?.expectedRoi)}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Impact</h3>
                <p>
                  Demand {measured(selected?.demandScore)} · predicted{' '}
                  {measured(selected?.predictedPerformance)}
                </p>
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
                <h3>Recommendations</h3>
                <ul className={styles.bulletList}>
                  {!overview?.strategy ? (
                    <li>Acknowledge Strategy package to unlock opportunity formation.</li>
                  ) : null}
                  {overview?.strategy && opportunities.length === 0 ? (
                    <li>Keep system RUNNING until discovery persists candidates.</li>
                  ) : null}
                  {(metrics?.duplicates ?? 0) > 0 ? (
                    <li>Review high duplicate-similarity opportunities before handoff.</li>
                  ) : null}
                  {(metrics?.blocked ?? 0) > 0 ? (
                    <li>Resolve blocked/rejected items before Stage 03 intake.</li>
                  ) : null}
                  {(metrics?.approved ?? 0) > 0 ? (
                    <li>Approved opportunities are ready for Idea Qualification handoff.</li>
                  ) : null}
                </ul>
              </article>
              <article className={styles.insightCard}>
                <h3>Alerts</h3>
                {!issues.length ? (
                  <p>No open opportunity anomalies in persisted state.</p>
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

      <section className={styles.bottom} aria-label="Opportunity monitoring">
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
                <dt>Blocked</dt>
                <dd>{metrics?.blocked ?? 0}</dd>
              </div>
              <div>
                <dt>Handed off</dt>
                <dd>{metrics?.handedOff ?? 0}</dd>
              </div>
            </dl>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Continuous rescoring</h2>
            <RefreshCw size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              Rankings and scores refresh automatically when discovery workers write ci_scores and
              ci_rankings. This page is observe-only.
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
                <dt>Approved</dt>
                <dd>{metrics?.approved ?? 0}</dd>
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
