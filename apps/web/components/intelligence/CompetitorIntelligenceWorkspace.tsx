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
  Eye,
  Gauge,
  GitBranch,
  Layers3,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Swords,
  Target,
  Timer,
} from 'lucide-react';
import type {
  CompetitorIntelligenceOverview,
  CompetitorRecord,
  CompetitorStatus,
} from '@/lib/content-intelligence/competitors';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import styles from './competitor-intelligence.module.css';

type TabId =
  | 'overview'
  | 'competitors'
  | 'benchmarking'
  | 'coverage'
  | 'gaps'
  | 'trends'
  | 'opportunities'
  | 'history'
  | 'audit';

type StatusFilter = 'all' | CompetitorStatus;

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'competitors', label: 'Competitors' },
  { id: 'benchmarking', label: 'Benchmarking' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'gaps', label: 'Content Gaps' },
  { id: 'trends', label: 'Trends' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'discover', label: 'Discover', icon: Compass },
  { key: 'monitor', label: 'Monitor', icon: Eye },
  { key: 'compare', label: 'Compare', icon: Swords },
  { key: 'benchmark', label: 'Benchmark', icon: Gauge },
  { key: 'gaps', label: 'Detect Gaps', icon: Target },
  { key: 'recommend', label: 'Recommend', icon: Sparkles },
  { key: 'handoff', label: 'Handoff', icon: GitBranch },
] as const;

function statusTone(status?: string | null) {
  switch (status) {
    case 'ACTIVE':
    case 'MONITORING':
    case 'COMPLETED':
    case 'RUNNING':
    case 'ACKNOWLEDGED':
    case 'Completed':
    case 'Active':
    case 'Healthy':
      return styles.toneReady;
    case 'WARNING':
    case 'FAILED':
    case 'ARCHIVED':
    case 'Failed':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'Waiting':
    case 'Analysing':
    case 'UNKNOWN':
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

function matchesCompetitor(
  item: CompetitorRecord,
  needle: string,
  status: StatusFilter,
  platform: string,
  region: string,
  niche: string,
) {
  if (status !== 'all' && item.status !== status) return false;
  if (platform !== 'all' && (item.platform ?? '') !== platform) return false;
  if (region !== 'all' && (item.region ?? '') !== region) return false;
  if (niche !== 'all' && (item.niche ?? '') !== niche) return false;
  if (!needle) return true;
  const haystack = [
    item.name,
    item.summary,
    item.platform,
    item.region,
    item.niche,
    item.status,
    ...item.contentCategories,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function lifecycleState(
  index: number,
  overview: CompetitorIntelligenceOverview | null,
  systemRunning: boolean,
) {
  const count = overview?.competitors.length ?? 0;
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

function packageLabel(overview: CompetitorIntelligenceOverview | null, systemRunning: boolean) {
  if ((overview?.competitors.length ?? 0) > 0 && overview?.run?.status === 'COMPLETED') {
    return 'Active';
  }
  if (overview?.run?.status === 'RUNNING' || systemRunning) {
    return (overview?.competitors.length ?? 0) > 0 ? 'Analysing' : 'Discovering';
  }
  if (overview?.run?.status === 'FAILED') return 'Failed';
  if ((overview?.metrics.warningCount ?? 0) > 0 || (overview?.metrics.highThreat ?? 0) > 0) {
    return 'Warning';
  }
  if ((overview?.competitors.length ?? 0) > 0) return 'Active';
  if (overview?.strategy) return 'Waiting';
  return 'Empty';
}

export function CompetitorIntelligenceWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<CompetitorIntelligenceOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [nicheFilter, setNicheFilter] = useState('all');
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
        intelligenceApi.competitors(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const items = next.competitors ?? [];
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

  const competitors = overview?.competitors ?? [];
  const metrics = overview?.metrics;
  const needle = query.trim().toLowerCase();

  const platforms = useMemo(
    () => [...new Set(competitors.map((item) => item.platform).filter(Boolean) as string[])].sort(),
    [competitors],
  );
  const regions = useMemo(
    () => [...new Set(competitors.map((item) => item.region).filter(Boolean) as string[])].sort(),
    [competitors],
  );
  const niches = useMemo(
    () => [...new Set(competitors.map((item) => item.niche).filter(Boolean) as string[])].sort(),
    [competitors],
  );

  const filtered = useMemo(
    () =>
      competitors.filter((item) =>
        matchesCompetitor(item, needle, statusFilter, platformFilter, regionFilter, nicheFilter),
      ),
    [competitors, needle, statusFilter, platformFilter, regionFilter, nicheFilter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    competitors.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const kpis = useMemo(() => {
    const count = metrics?.competitors ?? 0;
    const monitored = metrics?.monitoredSources ?? 0;
    const gaps = metrics?.gaps ?? 0;
    const opportunities = metrics?.opportunities ?? 0;
    const measuredCoverage = (metrics?.measuredCoverage ?? 0) > 0;
    const measuredThreat = (metrics?.measuredThreat ?? 0) > 0;
    return [
      {
        label: 'Competitors',
        value: String(count),
        meta: 'Distinct COMPETITOR signals',
        accent: '#2563EB',
        icon: Swords,
        bars: sparkBars(count),
      },
      {
        label: 'Monitored Sources',
        value: String(monitored),
        meta: 'Relevant registry sources',
        accent: '#0EA5E9',
        icon: Radio,
        bars: sparkBars(monitored),
      },
      {
        label: 'Coverage',
        value: measuredCoverage ? String(metrics?.coverage ?? 0) : 'UNMEAS.',
        meta: measuredCoverage
          ? `${metrics?.measuredCoverage} measured coverage scores`
          : 'No coverage metadata yet',
        accent: '#22C55E',
        icon: Compass,
        bars: sparkBars(metrics?.coverage ?? 0),
      },
      {
        label: 'Gaps',
        value: String(gaps),
        meta: 'Whitespace opportunities listed',
        accent: '#F59E0B',
        icon: Target,
        bars: sparkBars(gaps),
      },
      {
        label: 'Threat Score',
        value: measuredThreat ? String(metrics?.threatScore ?? 0) : 'UNMEAS.',
        meta: measuredThreat
          ? `${metrics?.measuredThreat} measured threat scores`
          : 'No threat metadata yet',
        accent: '#EF4444',
        icon: AlertTriangle,
        bars: sparkBars(metrics?.threatScore ?? 0),
      },
      {
        label: 'Opportunities',
        value: String(opportunities),
        meta: 'Linked opportunity signals',
        accent: '#7C3AED',
        icon: Sparkles,
        bars: sparkBars(opportunities),
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
        <p className={styles.crumb}>
          Content Lifecycle / 02 Content Intelligence / Competitor Intelligence
        </p>
        <h1 className={styles.title}>Competitor Intelligence</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Competitor intelligence unavailable</h2>
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
            Content Lifecycle / 02 Content Intelligence / Competitor Intelligence
          </p>
          <h1 className={styles.title}>Competitor Intelligence</h1>
          <p className={styles.lede}>
            Continuously monitor competitors, benchmark coverage, and surface whitespace
            opportunities without copying protected content — ready for Stage 03.
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
          Competitor intelligence is derived from persisted COMPETITOR signals. Engagement, SEO,
          threat, and benchmark scores stay UNMEASURED unless workers write metadata. Do not copy
          protected competitor content.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Competitor KPI summary">
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

      <section className={styles.lifecycle} aria-label="Competitor lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Competitor lifecycle</h2>
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
            Competitor monitoring begins after an acknowledged Strategy package and discovery
            persists COMPETITOR signals.
          </div>
        </div>
      ) : null}

      {overview?.strategy && competitors.length === 0 ? (
        <div className={styles.waitingBanner} role="status">
          <Activity size={18} aria-hidden />
          <div>
            <strong>Discovering competitors</strong>
            No COMPETITOR signals are persisted yet. This workspace updates when discovery writes
            verified competitor evidence.
          </div>
        </div>
      ) : null}

      <section className={styles.workspace} aria-label="Competitor intelligence workspace">
        <aside className={styles.panel} aria-label="Competitor Explorer">
          <div className={styles.panelHead}>
            <h2>Competitor Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search competitors, platforms, niches…"
                aria-label="Search competitor intelligence"
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
                <option value="MONITORING">Monitoring</option>
                <option value="WARNING">Warning</option>
                <option value="ARCHIVED">Archived</option>
                <option value="UNKNOWN">Unknown</option>
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
              <span>Niche</span>
              <select
                value={nicheFilter}
                onChange={(event) => setNicheFilter(event.target.value)}
                aria-label="Filter by niche"
              >
                <option value="all">All niches</option>
                {niches.map((niche) => (
                  <option key={niche} value={niche}>
                    {niche}
                  </option>
                ))}
              </select>
            </label>

            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No persisted competitors match the current filters.</p>
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
                      <span className={styles.explorerTitle}>{item.name}</span>
                      <span className={styles.explorerMeta}>
                        {item.platform ?? 'Platform UNMEAS.'} · {item.niche ?? 'Niche UNMEAS.'}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                        <span className={styles.chip}>
                          Threat {item.threatScore != null ? item.threatScore : 'UNMEAS.'}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Competitor Intelligence">
          <div className={styles.tabs} role="tablist" aria-label="Competitor tabs">
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
            tab !== 'competitors' &&
            tab !== 'coverage' ? (
              <div className={styles.emptyInline}>
                <Layers3 size={22} aria-hidden />
                <p>
                  {overview?.strategy
                    ? 'Select a competitor to inspect benchmarks, gaps, and recommendations.'
                    : 'Persisted competitors appear after discovery writes COMPETITOR signals.'}
                </p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Competitor profile</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Name</dt>
                      <dd>{selected.name}</dd>
                    </div>
                    <div>
                      <dt>Platform</dt>
                      <dd>{display(selected.platform)}</dd>
                    </div>
                    <div>
                      <dt>Region</dt>
                      <dd>{display(selected.region)}</dd>
                    </div>
                    <div>
                      <dt>Niche</dt>
                      <dd>{display(selected.niche)}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{selected.status}</dd>
                    </div>
                    <div>
                      <dt>Publishing frequency</dt>
                      <dd>{measured(selected.publishingFrequency)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Market signals</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Engagement</dt>
                      <dd>{measured(selected.engagement)}</dd>
                    </div>
                    <div>
                      <dt>SEO visibility</dt>
                      <dd>{measured(selected.seoVisibility)}</dd>
                    </div>
                    <div>
                      <dt>Audience overlap</dt>
                      <dd>{measured(selected.audienceOverlap)}</dd>
                    </div>
                    <div>
                      <dt>Trend adoption</dt>
                      <dd>{measured(selected.trendAdoption)}</dd>
                    </div>
                    <div>
                      <dt>Coverage</dt>
                      <dd>{measured(selected.coverageScore)}</dd>
                    </div>
                    <div>
                      <dt>Threat score</dt>
                      <dd>{measured(selected.threatScore)}</dd>
                    </div>
                    <div>
                      <dt>Benchmark</dt>
                      <dd>{measured(selected.benchmarkScore)}</dd>
                    </div>
                    <div>
                      <dt>Similarity</dt>
                      <dd>{measured(selected.similarityScore)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Summary</h3>
                  <p>{selected.summary}</p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Categories</dt>
                      <dd>
                        {selected.contentCategories.length
                          ? selected.contentCategories.join('; ')
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>{display(selected.sourceName)}</dd>
                    </div>
                    <div>
                      <dt>Evidence</dt>
                      <dd>{display(selected.evidenceUrl)}</dd>
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
              </div>
            ) : null}

            {tab === 'competitors' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Competitor comparison</h3>
                  {!filtered.length ? (
                    <p className={styles.lede}>No competitors to compare.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Competitor</th>
                          <th scope="col">Platform</th>
                          <th scope="col">Threat</th>
                          <th scope="col">Coverage</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice(0, 25).map((item) => (
                          <tr key={item.id}>
                            <td>{item.name}</td>
                            <td>{display(item.platform)}</td>
                            <td>{measured(item.threatScore)}</td>
                            <td>{measured(item.coverageScore)}</td>
                            <td>{item.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {selected && tab === 'benchmarking' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Benchmark scoring</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Benchmark score</dt>
                      <dd>{measured(selected.benchmarkScore)}</dd>
                    </div>
                    <div>
                      <dt>Similarity analysis</dt>
                      <dd>{measured(selected.similarityScore)}</dd>
                    </div>
                    <div>
                      <dt>Threat</dt>
                      <dd>{measured(selected.threatScore)}</dd>
                    </div>
                  </dl>
                  <div
                    className={styles.spark}
                    aria-hidden
                    style={{ height: 40, alignItems: 'flex-end', gap: 6, marginTop: 12 }}
                  >
                    {[
                      selected.engagement,
                      selected.seoVisibility,
                      selected.audienceOverlap,
                      selected.trendAdoption,
                      selected.coverageScore,
                      selected.benchmarkScore,
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
                </article>
                <article className={styles.detailCard}>
                  <h3>Strengths & weaknesses</h3>
                  <p>
                    <strong>Strengths:</strong>{' '}
                    {selected.strengths.length ? selected.strengths.join('; ') : 'UNMEASURED'}
                  </p>
                  <p>
                    <strong>Weaknesses:</strong>{' '}
                    {selected.weaknesses.length ? selected.weaknesses.join('; ') : 'UNMEASURED'}
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'coverage' ? (
              <div className={styles.detailGrid}>
                {filtered.length === 0 ? (
                  <div className={styles.emptyInline}>
                    <p>No coverage heatmap data persisted yet.</p>
                  </div>
                ) : (
                  filtered.slice(0, 12).map((item) => (
                    <article key={item.id} className={styles.detailCard}>
                      <h3>{item.name}</h3>
                      <dl className={styles.kv}>
                        <div>
                          <dt>Coverage</dt>
                          <dd>{measured(item.coverageScore)}</dd>
                        </div>
                        <div>
                          <dt>Audience overlap</dt>
                          <dd>{measured(item.audienceOverlap)}</dd>
                        </div>
                        <div>
                          <dt>SEO</dt>
                          <dd>{measured(item.seoVisibility)}</dd>
                        </div>
                      </dl>
                      <div
                        className={styles.spark}
                        aria-hidden
                        style={{ height: 24, marginTop: 8 }}
                      >
                        <i
                          style={{
                            height: `${Math.max(4, Math.min(20, (item.coverageScore ?? 0) / 5))}px`,
                            width: '100%',
                            borderRadius: 6,
                            background: 'var(--primary)',
                            display: 'block',
                            opacity: item.coverageScore == null ? 0.25 : 1,
                          }}
                        />
                      </div>
                    </article>
                  ))
                )}
              </div>
            ) : null}

            {selected && tab === 'gaps' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Content gaps / whitespace</h3>
                  {selected.whitespaceOpportunities.length ? (
                    <ul className={styles.bulletList}>
                      {selected.whitespaceOpportunities.map((gap) => (
                        <li key={gap}>{gap}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.lede}>
                      No whitespace opportunities persisted for this competitor.
                    </p>
                  )}
                </article>
              </div>
            ) : null}

            {selected && tab === 'trends' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Trend comparison</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Trend adoption</dt>
                      <dd>{measured(selected.trendAdoption)}</dd>
                    </div>
                    <div>
                      <dt>Publishing cadence</dt>
                      <dd>{measured(selected.publishingFrequency)}</dd>
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
                </article>
                <article className={styles.detailCard}>
                  <h3>Explainability</h3>
                  <p>
                    Trend adoption and cadence are shown only from persisted metadata. No synthetic
                    engagement curves are invented on this page.
                  </p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'opportunities' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Strategic opportunities</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Linked opportunities</dt>
                      <dd>{selected.opportunityCount}</dd>
                    </div>
                    <div>
                      <dt>Global linked count</dt>
                      <dd>{metrics?.opportunities ?? 0}</dd>
                    </div>
                  </dl>
                  {selected.recommendations.length ? (
                    <ul className={styles.bulletList}>
                      {selected.recommendations.map((rec) => (
                        <li key={rec}>{rec}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.lede}>No strategic recommendations persisted yet.</p>
                  )}
                </article>
                <article className={styles.detailCard}>
                  <h3>Stage 03 readiness</h3>
                  <p>
                    Whitespace and linked opportunities feed topic scoring and Idea Qualification
                    handoff. Protected competitor content must not be copied.
                  </p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'history' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Monitoring timeline</h3>
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
                    <p className={styles.lede}>No competitor-related audit events persisted yet.</p>
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
                <h3>Market position</h3>
                <p>
                  Coverage {measured(selected?.coverageScore)} · overlap{' '}
                  {measured(selected?.audienceOverlap)}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Risks</h3>
                <p>
                  Threat {measured(selected?.threatScore)} ·{' '}
                  {metrics?.highThreat ?? 0} high-threat competitor(s)
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Recommendations</h3>
                <ul className={styles.bulletList}>
                  {!overview?.strategy ? (
                    <li>Acknowledge Strategy package to unlock competitor monitoring.</li>
                  ) : null}
                  {overview?.strategy && competitors.length === 0 ? (
                    <li>Keep system RUNNING until discovery persists COMPETITOR signals.</li>
                  ) : null}
                  {(metrics?.highThreat ?? 0) > 0 ? (
                    <li>Prioritise high-threat competitors for whitespace planning.</li>
                  ) : null}
                  {(metrics?.gaps ?? 0) > 0 ? (
                    <li>Convert whitespace gaps into topic opportunities for Stage 03.</li>
                  ) : null}
                  {(metrics?.opportunities ?? 0) > 0 ? (
                    <li>Linked opportunities are ready for scoring and Idea Qualification.</li>
                  ) : null}
                </ul>
              </article>
              <article className={styles.insightCard}>
                <h3>Alerts</h3>
                {!issues.length ? (
                  <p>No open competitor anomalies in persisted state.</p>
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

      <section className={styles.bottom} aria-label="Competitor monitoring">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Health monitoring</h2>
            <AlertTriangle size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Warnings</dt>
                <dd>{metrics?.warningCount ?? 0}</dd>
              </div>
              <div>
                <dt>High threat</dt>
                <dd>{metrics?.highThreat ?? 0}</dd>
              </div>
              <div>
                <dt>Gaps</dt>
                <dd>{metrics?.gaps ?? 0}</dd>
              </div>
            </dl>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Continuous monitoring</h2>
            <RefreshCw size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              Competitor profiles refresh automatically when discovery writes new COMPETITOR
              signals. This page is observe-only and must not copy protected works.
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
                <dt>Linked opportunities</dt>
                <dd>{metrics?.opportunities ?? 0}</dd>
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
