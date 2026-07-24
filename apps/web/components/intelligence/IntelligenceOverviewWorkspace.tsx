'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Compass,
  FileSearch,
  Gauge,
  Layers3,
  Radio,
  ShieldAlert,
  Sparkles,
  Timer,
  Workflow,
} from 'lucide-react';
import type { IntelligenceOverview, Opportunity } from '@/lib/content-intelligence/contracts';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import { contentIntelligenceNavigation } from '@/apps/web/lib/content-intelligence-navigation';
import styles from './intelligence-overview.module.css';

type TabId =
  | 'overview'
  | 'pipeline'
  | 'ranking'
  | 'verification'
  | 'reasoning'
  | 'dependencies'
  | 'history'
  | 'audit';

type FilterId = 'all' | 'verified' | 'qualified' | 'blocked' | 'discovered' | 'handed_off';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'pipeline', label: 'Discovery Pipeline' },
  { id: 'ranking', label: 'Opportunity Ranking' },
  { id: 'verification', label: 'Verification' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'collect', label: 'Collect', icon: Radio },
  { key: 'discover', label: 'Discover', icon: Compass },
  { key: 'analyse', label: 'Analyse', icon: Layers3 },
  { key: 'verify', label: 'Verify', icon: FileSearch },
  { key: 'score', label: 'Score', icon: Gauge },
  { key: 'rank', label: 'Rank', icon: CheckCircle2 },
  { key: 'handoff', label: 'Handoff', icon: Workflow },
] as const;

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'COMPLETED':
    case 'ACKNOWLEDGED':
    case 'QUALIFIED':
    case 'VERIFIED':
    case 'HANDED_OFF':
    case 'Completed':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'REJECTED':
    case 'Failed':
      return styles.toneBlocked;
    case 'QUEUED':
    case 'RUNNING':
    case 'WAITING':
    case 'PARTIAL':
    case 'ENRICHING':
    case 'DISCOVERED':
    case 'WARNING':
    case 'Running':
      return styles.toneWarning;
    default:
      return styles.toneDraft;
  }
}

function sparkBars(seed: number) {
  return [4, 7, 5, 9, 6, 10, 8].map((base, index) => Math.max(3, ((base + seed + index * 2) % 10) + 3));
}

function lifecycleState(
  index: number,
  overview: IntelligenceOverview,
  systemRunning: boolean,
) {
  const pipeline = overview.pipeline ?? [];
  const counts = pipeline.map((item) => item.count);
  const hasPackage = Boolean(overview.strategy);
  const run = overview.run?.status;
  const handoff = (overview.metrics?.handoffs ?? 0) > 0;

  if (handoff || run === 'COMPLETED') {
    return index <= 6 ? 'done' : 'pending';
  }
  if (run === 'FAILED' || run === 'BLOCKED') {
    return index <= 2 ? 'done' : index === 3 ? 'active' : 'pending';
  }
  if ((counts[5] ?? 0) > 0) {
    return index <= 5 ? 'done' : index === 6 ? 'active' : 'pending';
  }
  if ((counts[3] ?? 0) > 0 || (counts[4] ?? 0) > 0) {
    return index <= 3 ? 'done' : index === 4 ? 'active' : 'pending';
  }
  if ((counts[2] ?? 0) > 0) {
    return index <= 2 ? 'done' : index === 3 ? 'active' : 'pending';
  }
  if ((counts[1] ?? 0) > 0) {
    return index <= 1 ? 'done' : index === 2 ? 'active' : 'pending';
  }
  if ((counts[0] ?? 0) > 0 || run === 'RUNNING' || run === 'QUEUED' || systemRunning) {
    if (index === 0) return 'active';
    if (index === 1 && (run === 'RUNNING' || systemRunning)) return 'active';
    return 'pending';
  }
  if (hasPackage) {
    return index === 0 ? 'active' : 'pending';
  }
  return 'pending';
}

function confidenceLabel(value: number, measured: boolean): string {
  if (!measured || value <= 0) return 'UNMEASURED';
  return `${Math.round(value)}%`;
}

function matchesOpportunity(item: Opportunity, needle: string, filter: FilterId): boolean {
  if (filter === 'verified' && item.status !== 'VERIFIED') return false;
  if (filter === 'qualified' && item.status !== 'QUALIFIED') return false;
  if (filter === 'blocked' && item.status !== 'BLOCKED' && item.status !== 'REJECTED') return false;
  if (filter === 'discovered' && item.status !== 'DISCOVERED' && item.status !== 'ENRICHING')
    return false;
  if (filter === 'handed_off' && item.status !== 'HANDED_OFF') return false;
  if (!needle) return true;
  const haystack = [
    item.title,
    item.summary,
    item.domain,
    item.geography,
    item.audience,
    item.status,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function IntelligenceOverviewWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<IntelligenceOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
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
        intelligenceApi.overview(),
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
  const metrics = overview?.metrics ?? {};
  const pipeline = overview?.pipeline ?? [];
  const measuredConfidence = (metrics.measuredConfidence ?? 0) > 0;
  const needle = query.trim().toLowerCase();

  const filtered = useMemo(
    () => opportunities.filter((item) => matchesOpportunity(item, needle, filter)),
    [opportunities, needle, filter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    opportunities.find((item) => item.id === selectedId) ??
    null;

  const verified =
    (metrics.verified ?? 0) + (metrics.qualified ?? 0) + (metrics.handed_off ?? 0);
  const candidates = metrics.candidates ?? opportunities.length;
  const sources = metrics.sources ?? 0;
  const signals = metrics.signals ?? 0;
  const pipelineHealth = metrics.pipelineHealth ?? overview?.readiness ?? 0;

  const kpis = useMemo(
    () => [
      {
        label: 'Sources',
        value: String(sources),
        meta: 'Persisted source registry',
        accent: '#2563EB',
        icon: Radio,
        bars: sparkBars(sources),
      },
      {
        label: 'Signals',
        value: String(signals),
        meta: 'Discovery signals captured',
        accent: '#0284C7',
        icon: Activity,
        bars: sparkBars(signals),
      },
      {
        label: 'Candidate Topics',
        value: String(candidates),
        meta: 'ci_opportunities rows',
        accent: '#0F766E',
        icon: Layers3,
        bars: sparkBars(candidates),
      },
      {
        label: 'Verified Opportunities',
        value: String(verified),
        meta: 'Verified + qualified + handed off',
        accent: '#16A34A',
        icon: CheckCircle2,
        bars: sparkBars(verified),
      },
      {
        label: 'AI Confidence',
        value: measuredConfidence ? `${metrics.avgConfidence ?? 0}%` : 'UNMEAS.',
        meta: measuredConfidence
          ? 'Average measured opportunity confidence'
          : 'No measured confidence persisted',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(measuredConfidence ? Number(metrics.avgConfidence ?? 0) : 2),
      },
      {
        label: 'Pipeline Health',
        value: `${pipelineHealth}%`,
        meta: `${pipeline.filter((item) => item.count > 0).length}/${pipeline.length || 8} stages with data`,
        accent: '#D97706',
        icon: Gauge,
        bars: sparkBars(pipelineHealth),
      },
    ],
    [sources, signals, candidates, verified, measuredConfidence, metrics.avgConfidence, pipelineHealth, pipeline],
  );

  const packageStatus =
    overview?.run?.status === 'COMPLETED'
      ? 'Completed'
      : overview?.run?.status === 'RUNNING' || systemRunning
        ? 'Running'
        : overview?.run?.status === 'FAILED'
          ? 'Failed'
          : overview?.run?.status === 'PARTIAL'
            ? 'Partial'
            : overview?.strategy
              ? 'Waiting'
              : 'Empty';

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
      };

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

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

  if (error || !overview?.available) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Content Lifecycle / 02 Content Intelligence</p>
        <h1 className={styles.title}>Content Intelligence Command Centre</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Content Intelligence unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>Content Lifecycle / 02 Content Intelligence</p>
          <h1 className={styles.title}>Content Intelligence Command Centre</h1>
          <p className={styles.lede}>
            Autonomously transform an activated Strategy package into verified, ranked content
            opportunities ready for Stage 03 – Idea Qualification.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 02</span>
          <span className={`${styles.badge} ${styles.toneAi}`}>System Driven</span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Observe Only</span>
          <span className={`${styles.badge} ${statusTone(packageStatus)}`}>{packageStatus}</span>
          <span className={`${styles.badge} ${statusTone(overview.strategy?.status)}`}>
            Strategy v{overview.strategy?.versionNumber ?? '—'}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only</strong>
          Content Intelligence starts automatically after a validated Strategy package is activated
          and acknowledged. Use global Start/Stop only — this page does not create or edit records.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Intelligence KPI summary">
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

      <section className={styles.lifecycle} aria-label="Intelligence lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Intelligence lifecycle</h2>
          <span>
            {systemRunning || overview.run?.status === 'RUNNING'
              ? 'Stage 02 running — discovery pipeline active'
              : `System ${systemState} · run ${overview.run?.status ?? 'IDLE'}`}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {LIFECYCLE.map((stage, index) => {
            const Icon = stage.icon;
            const state = lifecycleState(index, overview, systemRunning);
            return (
              <div key={stage.key} className={styles.stage} data-state={state}>
                <span className={styles.stageIcon}>
                  <Icon size={14} aria-hidden />
                </span>
                <strong>{stage.label}</strong>
                <span>
                  {state === 'done' ? 'Completed' : state === 'active' ? 'Running' : 'Waiting'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {!overview.strategy ? (
        <section className={styles.waiting} aria-label="Awaiting strategy package">
          <div className={styles.waitingIcon}>
            <Workflow size={24} aria-hidden />
          </div>
          <h3>Awaiting Activated Strategy Package</h3>
          <p>
            Content Intelligence begins after Stage 01 activates a READY strategy and the package is
            acknowledged. Start the system globally to advance Stage 01, then this stage consumes
            the package automatically.
          </p>
          <div className={styles.waitingChecklist}>
            <div>
              <strong>System</strong>
              {systemState}
            </div>
            <div>
              <strong>Strategy package</strong>
              Not acknowledged
            </div>
            <div>
              <strong>Discovery run</strong>
              {overview.run?.status ?? 'IDLE'}
            </div>
            <div>
              <strong>Expected sequence</strong>
              Activate → Acknowledge → Discover → Rank → Handoff
            </div>
          </div>
        </section>
      ) : null}

      {overview.strategy && !opportunities.length ? (
        <section className={styles.infoNotice} role="status" aria-live="polite">
          <Timer size={16} aria-hidden />
          <div>
            <strong>
              {overview.run?.status === 'RUNNING' || overview.run?.status === 'QUEUED'
                ? 'Live intelligence generation in progress'
                : 'Strategy package acknowledged — awaiting discovery output'}
            </strong>
            Pipeline counts update from persisted tables as the discovery worker writes sources,
            signals, and opportunities.
          </div>
        </section>
      ) : null}

      <section className={styles.panel} aria-label="Interactive discovery pipeline">
        <div className={styles.panelHead}>
          <h2>Discovery pipeline dashboard</h2>
          <p>
            Real-time stage throughput from persisted CI tables · health {pipelineHealth}%
            {overview.run?.failureReason ? ` · ${overview.run.failureReason}` : ''}
          </p>
        </div>
        <div className={styles.tabBody}>
          <div className={styles.ladderStack} aria-label="Pipeline stages">
            {pipeline.map((stage) => (
              <div key={stage.stage} className={styles.ladderRung} data-state={stage.status}>
                <span className={styles.ladderRank}>{stage.count}</span>
                <div className={styles.ladderCopy}>
                  <strong>{stage.label}</strong>
                  <span>
                    Queue depth {stage.count} · status {stage.status}
                    {stage.count === 0 ? ' · bottleneck risk if upstream is active' : ''}
                  </span>
                  <div className={styles.radarBar} aria-hidden>
                    <i
                      style={{
                        width: `${Math.max(4, Math.min(100, stage.count === 0 ? 4 : 12 + stage.count * 8))}%`,
                      }}
                    />
                  </div>
                </div>
                <em className={`${styles.badge} ${statusTone(stage.status)}`}>{stage.status}</em>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Intelligence Explorer">
          <div className={styles.panelHead}>
            <h2>Intelligence Explorer</h2>
            <p>
              {opportunities.length} opportunities
              {filtered.length !== opportunities.length ? ` · ${filtered.length} shown` : ''}
            </p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter topics, domains, audiences…"
              aria-label="Search opportunities"
            />
            <div className={styles.chips} role="group" aria-label="Opportunity filters">
              {(
                [
                  ['all', 'All'],
                  ['discovered', 'Discovered'],
                  ['verified', 'Verified'],
                  ['qualified', 'Qualified'],
                  ['handed_off', 'Handed off'],
                  ['blocked', 'Blocked'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.chip} ${filter === id ? styles.chipActive : ''}`}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {filtered.length ? (
            <ul className={styles.explorerList}>
              {filtered.map((item) => {
                const active = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`${styles.objCard} ${active ? styles.objCardActive : ''}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div className={styles.objCardTop}>
                        <strong>{item.title}</strong>
                        <em className={`${styles.badge} ${statusTone(item.status)}`}>
                          {item.status}
                        </em>
                      </div>
                      <div className={styles.objMeta}>
                        <span className={styles.pill}>{item.domain}</span>
                        {item.geography ? <span className={styles.pill}>{item.geography}</span> : null}
                        <span className={styles.pill}>Score {item.score.toFixed(1)}</span>
                        <span className={styles.pill}>
                          {confidenceLabel(item.confidence, item.confidence > 0)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.empty}>
              <h3>
                {overview.strategy
                  ? systemRunning || overview.run?.status === 'RUNNING'
                    ? 'Discovery in progress'
                    : 'No opportunities yet'
                  : 'Waiting for strategy'}
              </h3>
              <p>
                {overview.strategy
                  ? 'Persisted opportunities appear here after discovery and verification write to the database.'
                  : 'Acknowledge an activated Strategy package to unlock Stage 02 exploration.'}
              </p>
            </div>
          )}
          <div className={styles.xai} style={{ margin: 16 }}>
            <h3>Module navigation</h3>
            <ul>
              {contentIntelligenceNavigation.slice(1, 9).map((item) => (
                <li key={item.id}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Intelligence Workspace">
          <div className={styles.panelHead}>
            <h2>{selected?.title || 'Intelligence Workspace'}</h2>
            <p>
              Evidence-backed opportunity detail, ranking context, and explainability for Stage 03
              handoff readiness.
            </p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Intelligence tabs">
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
            {!selected && tab !== 'pipeline' && tab !== 'audit' && tab !== 'dependencies' ? (
              <div className={styles.empty}>
                <h3>No opportunity selected</h3>
                <p>
                  Ranked opportunities appear automatically when discovery persists candidates.
                </p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Opportunity identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Title</span>
                      <strong>{selected.title}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Status</span>
                      <strong>{selected.status}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Domain</span>
                      <strong>{selected.domain}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Geography</span>
                      <strong>{selected.geography ?? '—'}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Audience</span>
                      <strong>{selected.audience ?? '—'}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Score</span>
                      <strong>{selected.score.toFixed(2)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Confidence</span>
                      <strong>
                        {confidenceLabel(selected.confidence, selected.confidence > 0)}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Created</span>
                      <strong>{new Date(selected.createdAt).toLocaleString()}</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Summary</h3>
                  <p>{selected.summary}</p>
                </article>
              </>
            ) : null}

            {tab === 'pipeline' ? (
              <article className={styles.sectionCard}>
                <h3>Discovery pipeline detail</h3>
                <div className={styles.groupList}>
                  {pipeline.map((stage) => (
                    <div key={stage.stage} className={styles.groupItem}>
                      <span>{stage.label}</span>
                      <b>
                        {stage.count} · {stage.status}
                      </b>
                    </div>
                  ))}
                  <div className={styles.groupItem}>
                    <span>Run</span>
                    <b>{overview.run?.status ?? 'IDLE'}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Failed jobs</span>
                    <b>{metrics.failedJobs ?? 0}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Estimated completion</span>
                    <b>
                      {overview.run?.completedAt
                        ? new Date(overview.run.completedAt).toLocaleString()
                        : overview.run?.status === 'RUNNING'
                          ? 'In progress — UNMEASURED ETA'
                          : 'UNMEASURED'}
                    </b>
                  </div>
                </div>
              </article>
            ) : null}

            {selected && tab === 'ranking' ? (
              <article className={styles.sectionCard}>
                <h3>Opportunity ranking</h3>
                <div className={styles.ladderStack}>
                  {filtered.slice(0, 20).map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`${styles.ladderRung} ${item.id === selectedId ? styles.ladderRungActive : ''}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <span className={styles.ladderRank}>#{index + 1}</span>
                      <div className={styles.ladderCopy}>
                        <strong>{item.title}</strong>
                        <span>
                          {item.domain} · score {item.score.toFixed(1)} ·{' '}
                          {confidenceLabel(item.confidence, item.confidence > 0)}
                        </span>
                      </div>
                      <em className={`${styles.badge} ${statusTone(item.status)}`}>{item.status}</em>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'verification' ? (
              <article className={styles.sectionCard}>
                <h3>Verification posture</h3>
                <div className={styles.groupList}>
                  <div className={styles.groupItem}>
                    <span>Verification records</span>
                    <b>{metrics.verification ?? 0}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Opportunity status</span>
                    <b>{selected.status}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Evidence confidence</span>
                    <b>{confidenceLabel(selected.confidence, selected.confidence > 0)}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Open blockers</span>
                    <b>{metrics.openBlockers ?? overview.blockers?.length ?? 0}</b>
                  </div>
                </div>
                <p style={{ marginTop: 12, color: 'var(--muted)' }}>
                  Detailed verification rules live under Evidence Verification once rows persist in
                  ci_verifications.
                </p>
              </article>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Why this opportunity exists</h3>
                  <p>
                    Discovered under Strategy v{overview.strategy?.versionNumber ?? '—'} for domain{' '}
                    {selected.domain}
                    {selected.geography ? ` in ${selected.geography}` : ''}
                    {selected.audience ? ` targeting ${selected.audience}` : ''}.{' '}
                    {selected.summary}
                  </p>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Decision factors</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Strategic alignment</span>
                      <strong>Score {selected.score.toFixed(2)} (persisted)</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Confidence</span>
                      <strong>
                        {confidenceLabel(selected.confidence, selected.confidence > 0)}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Package checksum</span>
                      <strong>
                        {overview.strategy?.checksum
                          ? `${overview.strategy.checksum.slice(0, 16)}…`
                          : '—'}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Downstream</span>
                      <strong>Stage 03 – Idea Qualification</strong>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {tab === 'dependencies' ? (
              <article className={styles.sectionCard}>
                <h3>Upstream & downstream</h3>
                <div className={styles.depChain}>
                  {[
                    'strategy-package',
                    'sources',
                    'signals',
                    'candidates',
                    'verification',
                    'ranking',
                    'idea-qualification',
                  ].map((item, index) => (
                    <span key={item} style={{ display: 'contents' }}>
                      {index > 0 ? <span className={styles.depArrow}>→</span> : null}
                      <span className={styles.depNode}>{item}</span>
                    </span>
                  ))}
                </div>
                <div className={styles.groupList} style={{ marginTop: 14 }}>
                  <div className={styles.groupItem}>
                    <span>Strategy package</span>
                    <b>{overview.strategy?.status ?? 'Missing'}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Handoffs acknowledged</span>
                    <b>{metrics.handoffs ?? 0}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Open blockers</span>
                    <b>{overview.blockers?.length ?? 0}</b>
                  </div>
                </div>
              </article>
            ) : null}

            {selected && tab === 'history' ? (
              <article className={styles.sectionCard}>
                <h3>Run timeline</h3>
                <ul className={styles.timeline}>
                  <li>
                    <span className={styles.dot} aria-hidden />
                    <div>
                      <strong>Opportunity created</strong>
                      <p>{new Date(selected.createdAt).toLocaleString()}</p>
                    </div>
                  </li>
                  <li>
                    <span className={styles.dot} aria-hidden />
                    <div>
                      <strong>Discovery run</strong>
                      <p>
                        {overview.run
                          ? `${overview.run.status} · started ${new Date(overview.run.startedAt).toLocaleString()}`
                          : 'No run'}
                      </p>
                    </div>
                  </li>
                  <li>
                    <span className={styles.dot} aria-hidden />
                    <div>
                      <strong>Strategy package</strong>
                      <p>
                        v{overview.strategy?.versionNumber ?? '—'} ·{' '}
                        {overview.strategy?.status ?? '—'}
                      </p>
                    </div>
                  </li>
                </ul>
              </article>
            ) : null}

            {tab === 'audit' ? (
              <article className={styles.sectionCard}>
                <h3>Intelligence audit</h3>
                {overview.audit?.length ? (
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Actor</th>
                        <th>Action</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.audit.map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.createdAt).toLocaleString()}</td>
                          <td>{row.actorType}</td>
                          <td>{row.action}</td>
                          <td>{row.reason ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No CI audit events persisted yet.</p>
                )}
              </article>
            ) : null}
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.insights}`} aria-label="AI Insights">
          <div className={styles.scoreHero}>
            <span className={styles.kpiLabel}>AI Insights</span>
            <strong>
              {selected
                ? selected.score.toFixed(1)
                : measuredConfidence
                  ? `${metrics.avgConfidence}%`
                  : '—'}
            </strong>
            <span className={`${styles.badge} ${styles.toneAi}`}>
              <BrainCircuit size={12} aria-hidden /> Intelligence agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Opportunity score</span>
              <b>{selected ? selected.score.toFixed(2) : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Trend strength</span>
              <b>{signals ? `${signals} signals` : 'UNMEASURED'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Confidence</span>
              <b>
                {selected
                  ? confidenceLabel(selected.confidence, selected.confidence > 0)
                  : measuredConfidence
                    ? `${metrics.avgConfidence}%`
                    : 'UNMEASURED'}
              </b>
            </div>
            <div className={styles.insightRow}>
              <span>Strategic alignment</span>
              <b>
                {overview.strategy
                  ? `v${overview.strategy.versionNumber} ACK`
                  : 'No package'}
              </b>
            </div>
            <div className={styles.insightRow}>
              <span>Pipeline health</span>
              <b>{pipelineHealth}%</b>
            </div>
            <div className={styles.insightRow}>
              <span>Blockers</span>
              <b>{overview.blockers?.length ?? 0}</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>Recommendations</h3>
            <ul>
              <li>
                {!overview.strategy
                  ? 'Complete Stage 01 activation so CI can acknowledge the strategy package.'
                  : overview.strategy
                    ? 'Strategy package is acknowledged.'
                    : null}
              </li>
              <li>
                {(overview.blockers?.length ?? 0) > 0
                  ? `Resolve ${overview.blockers!.length} open blocker(s) before qualification handoff.`
                  : 'No open CI blockers persisted.'}
              </li>
              <li>
                {verified
                  ? `${verified} verified/qualified opportunities available for Stage 03.`
                  : 'Await verification and scoring before Idea Qualification handoff.'}
              </li>
            </ul>
          </div>
          {(overview.blockers?.length ?? 0) > 0 ? (
            <div className={styles.xai}>
              <h3>Blockers</h3>
              <ul>
                {overview.blockers!.slice(0, 5).map((blocker) => (
                  <li key={blocker.id}>
                    [{blocker.severity}] {blocker.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className={styles.radar} aria-label="Intelligence health axes">
            {[
              ['Sources', Math.min(100, sources * 10)],
              ['Signals', Math.min(100, signals * 5)],
              ['Candidates', Math.min(100, candidates * 4)],
              ['Verified', Math.min(100, verified * 8)],
              ['Pipeline', pipelineHealth],
              ['Confidence', measuredConfidence ? Number(metrics.avgConfidence ?? 0) : 0],
            ].map(([label, value]) => (
              <div key={label} className={styles.radarItem}>
                <span>{label}</span>
                <div className={styles.radarBar}>
                  <i style={{ width: `${Math.max(0, Math.min(100, Number(value)))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section className={styles.bottom} aria-label="Activity and audit">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Execution timeline</h2>
            <p>Persisted Stage 02 milestones</p>
          </div>
          <div className={styles.tabBody}>
            <ul className={styles.timeline}>
              <li>
                <span className={styles.dot} aria-hidden />
                <div>
                  <strong>Strategy package</strong>
                  <p>
                    v{overview.strategy?.versionNumber ?? '—'} ·{' '}
                    {overview.strategy?.status ?? 'not received'}
                  </p>
                </div>
              </li>
              <li>
                <span className={styles.dot} aria-hidden />
                <div>
                  <strong>Discovery run</strong>
                  <p>{overview.run?.status ?? 'IDLE'}</p>
                </div>
              </li>
              <li>
                <span className={styles.dot} aria-hidden />
                <div>
                  <strong>Pipeline</strong>
                  <p>
                    {candidates} candidates · {verified} verified · {metrics.handoffs ?? 0} handoffs
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Live activity</h2>
            <p>Current autonomy posture</p>
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightRow}>
              <span>System</span>
              <b>{systemState}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Activity size={12} aria-hidden /> Run
              </span>
              <b>{overview.run?.status ?? 'IDLE'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <AlertTriangle size={12} aria-hidden /> Blockers
              </span>
              <b>{overview.blockers?.length ?? 0}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <CircleDot size={12} aria-hidden /> Health
              </span>
              <b>{pipelineHealth}%</b>
            </div>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Recent audit</h2>
            <p>CI audit events</p>
          </div>
          <div className={styles.tabBody}>
            {(overview.audit ?? []).slice(0, 5).map((row) => (
              <div key={row.id} className={styles.insightRow}>
                <span>{row.action}</span>
                <b>{row.actorType}</b>
              </div>
            ))}
            {!overview.audit?.length ? <p className={styles.empty}>No events yet.</p> : null}
          </div>
        </article>
      </section>
    </motion.main>
  );
}
