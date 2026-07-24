'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Download,
  Gauge,
  Scale,
  Server,
  ShieldAlert,
  Sparkles,
  Timer,
  Wallet,
  Workflow,
  XCircle,
} from 'lucide-react';
import type {
  FeasibilityCandidate,
  ProductionFeasibilityOverview,
} from '@/lib/idea-qualification/feasibility';
import { qualificationApi } from '@/apps/web/lib/qualification-api';
import styles from './production-feasibility.module.css';

type TabId =
  | 'overview'
  | 'table'
  | 'score'
  | 'budget'
  | 'timeline'
  | 'resources'
  | 'technical'
  | 'legal'
  | 'research'
  | 'content'
  | 'simulation'
  | 'bottlenecks'
  | 'risks'
  | 'equipment'
  | 'dependencies'
  | 'staffing'
  | 'pipeline'
  | 'gantt'
  | 'financial'
  | 'scenarios'
  | 'explain'
  | 'recommendations'
  | 'governance'
  | 'analytics'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'table', label: 'Evaluation Table' },
  { id: 'score', label: 'Readiness Score' },
  { id: 'budget', label: 'Budget' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'resources', label: 'Resources' },
  { id: 'technical', label: 'Technical' },
  { id: 'legal', label: 'Legal' },
  { id: 'research', label: 'Research' },
  { id: 'content', label: 'Content' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'bottlenecks', label: 'Bottlenecks' },
  { id: 'risks', label: 'Risk Matrix' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'staffing', label: 'Staffing' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'gantt', label: 'Gantt' },
  { id: 'financial', label: 'Financial' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'explain', label: 'Explainability' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'governance', label: 'Governance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit' },
];

const EMPTY_COPY =
  'The Production Feasibility Engine automatically evaluates every qualified documentary idea to determine whether it can be successfully produced using available research, people, AI services, infrastructure, budget, legal rights, and production resources. Using predictive analytics, resource planning, cost estimation, scheduling models, risk analysis, and explainable AI, the engine generates a comprehensive Production Readiness Score, identifies constraints, forecasts timelines and costs, and recommends the most effective execution strategy. Once qualified ideas enter this stage, production readiness dashboards, feasibility analytics, and AI recommendations populate automatically.';

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'EXCELLENT':
    case 'GOOD':
    case 'PROCEED':
    case 'READY':
    case 'CLEAR':
    case 'COMPATIBLE':
    case 'LOW':
    case 'PLANNED':
    case 'TRACKED':
    case 'RUNNING':
      return styles.toneReady;
    case 'NOT_READY':
    case 'REJECT':
    case 'BLOCKED':
    case 'HIGH':
    case 'HIGH_RISK':
    case 'GAPS':
    case 'AT_RISK':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'MARGINAL':
    case 'REVISE SCOPE':
    case 'INCREASE BUDGET':
    case 'DELAY PRODUCTION':
    case 'PARTIAL':
    case 'MEDIUM':
    case 'ELEVATED':
    case 'PENDING':
    case 'WARNING':
    case 'UNMEASURED':
    case 'AWAIT SCORING':
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
  return [4, 7, 5, 9, 6, 10, 8].map((base, index) =>
    Math.max(3, ((base + seed + index * 2) % 10) + 3),
  );
}

function heatBar(days: number | null) {
  if (days == null) return '░'.repeat(8);
  const blocks = Math.max(1, Math.min(8, Math.round(days)));
  return `${'█'.repeat(blocks)}${'░'.repeat(8 - blocks)}`;
}

function exportPayload(overview: ProductionFeasibilityOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `feasibility-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'id',
    'title',
    'readiness',
    'budget',
    'days',
    'risk',
    'recommendation',
    'band',
  ];
  const lines = [
    header.join(','),
    ...overview.candidates.map((item) =>
      [
        item.id,
        JSON.stringify(item.title),
        item.productionReadiness ?? '',
        item.estimatedBudget ?? '',
        item.estimatedDurationDays ?? '',
        item.riskLevel,
        JSON.stringify(item.recommendation),
        item.readinessBand,
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `feasibility-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ProductionFeasibilityWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<ProductionFeasibilityOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
        qualificationApi.feasibility(),
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
  const needle = query.trim().toLowerCase();

  const statuses = useMemo(
    () => [...new Set(candidates.map((item) => item.readinessBand))].sort(),
    [candidates],
  );

  const filtered = useMemo(
    () =>
      candidates.filter((item) => {
        if (statusFilter !== 'all' && item.readinessBand !== statusFilter) return false;
        if (!needle) return true;
        const haystack = [
          item.title,
          item.domain,
          item.readinessBand,
          item.recommendation,
          item.riskLevel,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      }),
    [candidates, needle, statusFilter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    candidates.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const kpis = useMemo(() => {
    const m = metrics;
    return [
      {
        label: 'Production Readiness',
        value: m?.averageReadiness != null ? `${m.averageReadiness}%` : 'UNMEAS.',
        meta: 'feasibility factor avg',
        accent: '#2563EB',
        icon: ClipboardCheck,
        bars: sparkBars(m?.averageReadiness ?? 0),
        drill: 'score' as TabId,
      },
      {
        label: 'Estimated Budget',
        value: m?.estimatedBudget != null ? String(m.estimatedBudget) : 'UNMEAS.',
        meta: 'Persisted budget total only',
        accent: '#F59E0B',
        icon: Wallet,
        bars: sparkBars(m?.estimatedBudget ?? 0),
        drill: 'budget' as TabId,
      },
      {
        label: 'Estimated Duration',
        value: m?.estimatedDurationDays != null ? `${m.estimatedDurationDays}d` : 'UNMEAS.',
        meta: 'Persisted schedule days only',
        accent: '#0EA5E9',
        icon: CalendarClock,
        bars: sparkBars(m?.estimatedDurationDays ?? 0),
        drill: 'timeline' as TabId,
      },
      {
        label: 'Resource Availability',
        value: m?.resourceAvailability != null ? `${m.resourceAvailability}%` : 'UNMEAS.',
        meta: 'sourceAvailability / resources',
        accent: '#14B8A6',
        icon: Server,
        bars: sparkBars(m?.resourceAvailability ?? 0),
        drill: 'resources' as TabId,
      },
      {
        label: 'AI Confidence',
        value: m?.aiConfidence != null ? String(m.aiConfidence) : 'UNMEAS.',
        meta: 'Measured candidate confidence',
        accent: '#22C55E',
        icon: Gauge,
        bars: sparkBars(m?.aiConfidence ?? 0),
        drill: 'governance' as TabId,
      },
      {
        label: 'Technical Complexity',
        value: m?.technicalComplexity != null ? String(m.technicalComplexity) : 'UNMEAS.',
        meta: 'Nested complexity payload',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(m?.technicalComplexity ?? 0),
        drill: 'technical' as TabId,
      },
      {
        label: 'Legal Readiness',
        value: m?.legalReadiness != null ? `${m.legalReadiness}%` : 'UNMEAS.',
        meta: 'Legal / IP readiness',
        accent: '#F97316',
        icon: Scale,
        bars: sparkBars(m?.legalReadiness ?? 0),
        drill: 'legal' as TabId,
      },
      {
        label: 'Research Completion',
        value: m?.researchCompletion != null ? `${m.researchCompletion}%` : 'UNMEAS.',
        meta: 'Evidence / research signals',
        accent: '#2563EB',
        icon: CheckCircle2,
        bars: sparkBars(m?.researchCompletion ?? 0),
        drill: 'research' as TabId,
      },
      {
        label: 'Risk Level',
        value: String(m?.highRiskCount ?? 0),
        meta: 'HIGH risk candidates',
        accent: '#EF4444',
        icon: ShieldAlert,
        bars: sparkBars(m?.highRiskCount ?? 0),
        drill: 'risks' as TabId,
      },
      {
        label: 'Staffing Availability',
        value: m?.staffingAvailability != null ? `${m.staffingAvailability}%` : 'UNMEAS.',
        meta: 'Staffing payload when present',
        accent: '#0EA5E9',
        icon: Workflow,
        bars: sparkBars(m?.staffingAvailability ?? 0),
        drill: 'staffing' as TabId,
      },
      {
        label: 'Overall Recommendation',
        value: m?.proceedRate != null ? `${m.proceedRate}%` : 'UNMEAS.',
        meta: 'Proceed rate',
        accent: '#22C55E',
        icon: Sparkles,
        bars: sparkBars(m?.proceedRate ?? 0),
        drill: 'recommendations' as TabId,
      },
    ];
  }, [metrics]);

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35 },
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

  if (!overview?.available) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Idea Qualification / Production Feasibility</p>
        <h1 className={styles.title}>Enterprise Production Feasibility Centre</h1>
        <section className={styles.unavailable}>
          <AlertTriangle size={18} aria-hidden />
          <div>
            <strong>Production Feasibility unavailable</strong>
            <p>{overview?.reason || error || 'Unable to load feasibility ledger.'}</p>
          </div>
          <button type="button" className={styles.chip} onClick={() => void load()}>
            Retry
          </button>
        </section>
      </main>
    );
  }

  const showEmpty = !candidates.length;
  const showWaiting =
    !overview.meta.intakeStatus && overview.meta.cycleStatus === 'NOT_STARTED' && showEmpty;

  const poolOnlyTabs: TabId[] = [
    'table',
    'recommendations',
    'governance',
    'analytics',
    'audit',
  ];

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 03 Idea Qualification / Production Feasibility
          </p>
          <h1 className={styles.title}>Enterprise Production Feasibility Centre</h1>
          <p className={styles.lede}>
            Assess research, budget, schedule, provider, and resource constraints before Script &amp;
            Narrative.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 03 Feasibility</span>
          <span className={`${styles.badge} ${statusTone(overview?.meta.cycleStatus)}`}>
            Cycle {overview?.meta.cycleStatus ?? 'IDLE'}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Ready {overview?.metrics.readyCount ?? 0}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous production readiness</strong>
          Scores come from persisted <code>iq_scores.feasibility</code>,{' '}
          <code>sourceAvailability</code>, evidence checks, and risk assessments. Budget line items,
          day schedules, GPU hours, and scenario deltas stay UNMEASURED until those models write
          nested payloads. Proceed / Revise / Reject are engine recommendations only.
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

      <section
        className={`${styles.kpiGrid} ${styles.kpiGridDense}`}
        aria-label="Feasibility KPIs"
      >
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

      <section className={styles.lifecycle} aria-label="Feasibility pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Production feasibility workflow</h2>
          <span>
            Research → Resources → Budget → Timeline → Legal → Risk → Readiness → Proceed / Revise /
            Reject
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {(overview?.pipeline ?? []).map((stage) => (
            <div key={stage.key} className={styles.stage} data-state={stage.state}>
              <span className={styles.stageIcon}>
                <Workflow size={14} aria-hidden />
              </span>
              <strong>{stage.label}</strong>
            </div>
          ))}
        </div>
      </section>

      {showWaiting ? (
        <div className={styles.waitingBanner} role="status">
          <Timer size={18} aria-hidden />
          <div>
            <strong>Waiting for qualified candidates</strong>
            Feasibility scoring starts after Stage 03 candidates receive persisted feasibility
            factors and related production meta.
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>{EMPTY_COPY}</h2>
            <p className={styles.lede}>
              Qualified Idea → Research → Resources → Budget → Timeline → Legal → Risk → Production
              Readiness → Proceed / Revise / Reject.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Assess</strong>
              Research &amp; resources
            </li>
            <li>
              <strong>2. Forecast</strong>
              Budget &amp; schedule
            </li>
            <li>
              <strong>3. Verify</strong>
              Legal &amp; risk
            </li>
            <li>
              <strong>4. Decide</strong>
              Readiness gate
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Feasibility workspace">
        <aside className={styles.panel} aria-label="Feasibility Explorer">
          <div className={styles.panelHead}>
            <h2>Feasibility Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Candidate, domain, band, recommendation…"
              />
            </label>
            <label className={styles.field}>
              <span>Readiness band</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All bands</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No candidates match the current filters.</p>
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
                        setTab('explain');
                      }}
                    >
                      <span className={styles.explorerTitle}>{item.title}</span>
                      <span className={styles.explorerMeta}>
                        {item.productionReadiness != null
                          ? `${item.productionReadiness}%`
                          : 'UNMEAS.'}{' '}
                        · {item.recommendation}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.readinessBand)}`}>
                          {item.readinessBand}
                        </span>
                        <span className={`${styles.chip} ${statusTone(item.riskLevel)}`}>
                          {item.riskLevel}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Feasibility detail">
          <div className={styles.tabs} role="tablist">
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
            {tab === 'overview' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Candidate overview</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Title</dt>
                      <dd>{selected.title}</dd>
                    </div>
                    <div>
                      <dt>Domain</dt>
                      <dd>{selected.domain}</dd>
                    </div>
                    <div>
                      <dt>Readiness</dt>
                      <dd>
                        {selected.productionReadiness != null
                          ? `${selected.productionReadiness}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Band</dt>
                      <dd>
                        <span className={`${styles.chip} ${statusTone(selected.readinessBand)}`}>
                          {selected.readinessBand}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Recommendation</dt>
                      <dd>
                        <span className={`${styles.chip} ${statusTone(selected.recommendation)}`}>
                          {selected.recommendation}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>AI summary</h3>
                  <p>{selected.aiSummary}</p>
                  <ul className={styles.bulletList}>
                    {selected.explainability.slice(0, 6).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Pool snapshot</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Total</dt>
                      <dd>{metrics?.totalCandidates ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Ready</dt>
                      <dd>{metrics?.readyCount ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Revise</dt>
                      <dd>{metrics?.reviseCount ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Reject</dt>
                      <dd>{metrics?.rejectCount ?? 0}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'table' ? (
              <EvaluationTable items={filtered} onSelect={setSelectedId} />
            ) : null}

            {tab === 'score' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    Production Readiness{' '}
                    {selected.productionReadiness != null
                      ? `${selected.productionReadiness}%`
                      : 'UNMEASURED'}{' '}
                    <span className={`${styles.chip} ${statusTone(selected.readinessBand)}`}>
                      {selected.readinessBand}
                    </span>
                  </h3>
                  <p className={styles.lede}>
                    Confidence:{' '}
                    {selected.measuredConfidence
                      ? measured(selected.confidence)
                      : 'UNMEASURED'}
                  </p>
                  <div className={styles.waterfall}>
                    {selected.readinessBreakdown.map((row) => (
                      <div key={row.label} className={styles.waterfallRow}>
                        <span>{row.label}</span>
                        <div className={styles.radarBar}>
                          <i
                            className={styles.radarFill}
                            style={{
                              width: `${Math.max(0, Math.min(100, row.value ?? 0))}%`,
                            }}
                          />
                        </div>
                        <strong>{row.value != null ? `${row.value}%` : 'UNMEAS.'}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'budget' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Budget estimation engine</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Line item</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.budgetLines.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{row.amount != null ? String(row.amount) : 'UNMEASURED'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'timeline' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Timeline prediction</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Stage</th>
                        <th>Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.timeline.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{row.days != null ? String(row.days) : 'UNMEASURED'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'resources' && selected ? (
              <SignalList title="Resource availability" items={selected.resources} />
            ) : null}

            {tab === 'technical' && selected ? (
              <MetricBars title="Technical complexity" rows={selected.technical} />
            ) : null}

            {tab === 'legal' && selected ? (
              <SignalList title="Legal assessment" items={selected.legal} />
            ) : null}

            {tab === 'research' && selected ? (
              <SignalList title="Research availability" items={selected.research} />
            ) : null}

            {tab === 'content' && selected ? (
              <SignalList title="Content availability" items={selected.contentAvailability} />
            ) : null}

            {tab === 'simulation' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>AI production simulation</h3>
                  <dl className={styles.kv}>
                    {selected.simulation.map((row) => (
                      <div key={row.label}>
                        <dt>{row.label}</dt>
                        <dd>{measured(row.value)}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'bottlenecks' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Bottleneck analysis</h3>
                  <ul className={styles.bulletList}>
                    {selected.bottlenecks.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'risks' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Risk matrix</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Area</th>
                        <th>Risk</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.riskMatrix.map((row) => (
                        <tr key={row.area}>
                          <td>{row.area}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(row.risk)}`}>
                              {row.risk}
                            </span>
                          </td>
                          <td>{row.score ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'equipment' && selected ? (
              <SignalList title="Equipment readiness" items={selected.equipment} />
            ) : null}

            {tab === 'dependencies' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>External dependencies</h3>
                  <ul className={styles.bulletList}>
                    {selected.externalDependencies.map((row) => (
                      <li key={row.label}>
                        <span className={`${styles.chip} ${statusTone(row.status)}`}>
                          {row.status}
                        </span>{' '}
                        <strong>{row.label}</strong> — {row.detail}
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Production dependency graph</h3>
                  <ul className={styles.bulletList}>
                    {selected.dependencies.map((row) => (
                      <li key={row.label}>
                        <span className={`${styles.chip} ${statusTone(row.status)}`}>
                          {row.status}
                        </span>{' '}
                        <strong>{row.label}</strong> ({row.criticality}) — {row.detail}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'staffing' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Human resource planning</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Role</th>
                        <th>Needed</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.humanResources.map((row) => (
                        <tr key={row.role}>
                          <td>{row.role}</td>
                          <td>{row.needed ?? 'UNMEASURED'}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'pipeline' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Production pipeline compatibility</h3>
                  <ul className={styles.bulletList}>
                    {selected.pipelineCompatibility.map((row) => (
                      <li key={row.stage}>
                        <span className={`${styles.chip} ${statusTone(row.status)}`}>
                          {row.status}
                        </span>{' '}
                        {row.stage}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'gantt' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Executive timeline</h3>
                  <ul className={styles.bulletList}>
                    {selected.gantt.map((row) => (
                      <li key={row.label}>
                        <strong>{row.label}</strong>{' '}
                        <span aria-hidden>{heatBar(row.days)}</span>{' '}
                        {row.days != null ? `${row.days} days` : 'UNMEASURED'}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'financial' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Financial forecast</h3>
                  <dl className={styles.kv}>
                    {selected.financial.map((row) => (
                      <div key={row.label}>
                        <dt>{row.label}</dt>
                        <dd>{measured(row.value)}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'scenarios' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Scenario simulation</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Scenario</th>
                        <th>Readiness</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.scenarios.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>
                            {row.readiness != null ? `${row.readiness}%` : 'UNMEASURED'}
                          </td>
                          <td>{row.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'explain' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    Recommendation <strong>{selected.recommendation}</strong>
                  </h3>
                  <ul className={styles.bulletList}>
                    {selected.explainability.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className={styles.lede}>
                    Confidence:{' '}
                    {selected.measuredConfidence
                      ? measured(selected.confidence)
                      : 'UNMEASURED'}
                  </p>
                </article>
                <article className={styles.detailCard}>
                  <h3>Lifecycle</h3>
                  <ul className={styles.timeline}>
                    {selected.lifecycle.map((step) => (
                      <li key={step.key}>
                        <CircleDot size={14} aria-hidden />
                        <div>
                          <strong>{step.label}</strong>
                          <span>
                            {step.done ? 'Complete' : 'Pending'}
                            {step.at ? ` · ${new Date(step.at).toLocaleString()}` : ''}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'recommendations' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>AI recommendations</h3>
                  {(overview?.recommendations.length ?? 0) === 0 ? (
                    <p className={styles.lede}>No recommendations until candidates are scored.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Reason</th>
                          <th>Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview?.recommendations.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <span className={`${styles.chip} ${statusTone(item.action)}`}>
                                {item.action}
                              </span>
                            </td>
                            <td>{item.reason}</td>
                            <td>{item.priority}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
                {selected ? (
                  <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                    <h3>AI cost optimizer</h3>
                    <ul className={styles.bulletList}>
                      {selected.optimization.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </article>
                ) : null}
              </div>
            ) : null}

            {tab === 'governance' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>AI governance</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Model versions</dt>
                      <dd>
                        {overview?.governance.modelVersions.length
                          ? overview.governance.modelVersions.join(', ')
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Risk assessments</dt>
                      <dd>{overview?.governance.riskAssessments ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Decisions logged</dt>
                      <dd>{overview?.governance.decisionsLogged ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Audit events</dt>
                      <dd>{overview?.governance.auditEvents ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Data sources</dt>
                      <dd>
                        iq_candidates · iq_scores · iq_evidence_checks · iq_risk_assessments
                      </dd>
                    </div>
                    {selected ? (
                      <div>
                        <dt>Candidate model</dt>
                        <dd>{display(selected.modelVersion)}</dd>
                      </div>
                    ) : null}
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Continuous learning</h3>
                  <p className={styles.lede}>
                    Predicted vs actual cost, duration, quality, and risk remain UNMEASURED until
                    post-production outcomes are persisted.
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'analytics' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Readiness distribution</h3>
                  <ul className={styles.bulletList}>
                    {overview?.analytics.readinessDistribution.map((row) => (
                      <li key={row.label}>
                        {row.label}: {row.count}
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Risk distribution</h3>
                  <ul className={styles.bulletList}>
                    {overview?.analytics.riskDistribution.map((row) => (
                      <li key={row.label}>
                        {row.label}: {row.count}
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Recommendation mix</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.analytics.recommendationDistribution.length ?? 0) === 0 ? (
                      <li>No recommendations yet.</li>
                    ) : (
                      overview?.analytics.recommendationDistribution.map((row) => (
                        <li key={row.label}>
                          {row.label}: {row.count}
                        </li>
                      ))
                    )}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Domain readiness</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.analytics.domainReadiness.length ?? 0) === 0 ? (
                      <li>No scored domains yet.</li>
                    ) : (
                      overview?.analytics.domainReadiness.map((row) => (
                        <li key={row.label}>
                          {row.label}: {row.avgScore != null ? `${row.avgScore}%` : 'UNMEAS.'} (
                          {row.count})
                        </li>
                      ))
                    )}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Feasibility audit ledger</h3>
                  {(overview?.audit.length ?? 0) === 0 ? (
                    <p className={styles.lede}>No feasibility-related audit events persisted yet.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Action</th>
                          <th>Actor</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview?.audit.map((row) => (
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

            {!selected && !poolOnlyTabs.includes(tab) ? (
              <div className={styles.emptyInline}>
                <BrainCircuit size={18} aria-hidden />
                <p>Select a candidate to inspect production feasibility.</p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.insights}`} aria-label="AI Insights">
          <div className={styles.panelHead}>
            <h2>AI Insights</h2>
            <span>Observe only</span>
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightStack}>
              <article className={styles.insightCard}>
                <h3>Engine posture</h3>
                <p>
                  {metrics?.averageReadiness != null
                    ? `Pool average readiness ${metrics.averageReadiness}%.`
                    : 'Awaiting feasibility factor writes from the qualification cycle.'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Selected signal</h3>
                <p>
                  {selected
                    ? `${selected.title} · ${selected.recommendation}`
                    : 'No candidate selected.'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Notifications</h3>
                {(overview?.notifications.length ?? 0) === 0 ? (
                  <p>No feasibility alerts.</p>
                ) : (
                  <ul className={styles.bulletList}>
                    {overview?.notifications.slice(0, 6).map((note) => (
                      <li key={note.id}>
                        <span className={`${styles.chip} ${statusTone(note.severity)}`}>
                          {note.severity}
                        </span>{' '}
                        {note.message}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
              <article className={styles.insightCard}>
                <h3>
                  <CheckCircle2 size={14} aria-hidden /> Gate posture
                </h3>
                <p>
                  Ready {metrics?.readyCount ?? 0} · Revise {metrics?.reviseCount ?? 0} · Reject{' '}
                  {metrics?.rejectCount ?? 0}
                </p>
              </article>
              {(metrics?.highRiskCount ?? 0) > 0 ? (
                <article className={styles.insightCard}>
                  <h3>
                    <XCircle size={14} aria-hidden /> Risk pressure
                  </h3>
                  <p>{metrics?.highRiskCount} candidates at HIGH production risk.</p>
                </article>
              ) : null}
            </div>
          </div>
        </aside>
      </section>
    </motion.main>
  );
}

function MetricBars({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: number | null }>;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>{title}</h3>
        <div className={styles.waterfall}>
          {rows.map((row) => (
            <div key={row.label} className={styles.waterfallRow}>
              <span>{row.label}</span>
              <div className={styles.radarBar}>
                <i
                  className={styles.radarFill}
                  style={{ width: `${Math.max(0, Math.min(100, row.value ?? 0))}%` }}
                />
              </div>
              <strong>{row.value != null ? `${row.value}%` : 'UNMEAS.'}</strong>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function SignalList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; status: string; detail: string }>;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>{title}</h3>
        <ul className={styles.bulletList}>
          {items.map((item) => (
            <li key={item.label}>
              <span className={`${styles.chip} ${statusTone(item.status)}`}>{item.status}</span>{' '}
              <strong>{item.label}</strong> — {item.detail}
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}

function EvaluationTable({
  items,
  onSelect,
}: {
  items: FeasibilityCandidate[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>Production feasibility evaluation</h3>
        <table className={styles.auditTable}>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Readiness</th>
              <th>Budget</th>
              <th>Days</th>
              <th>Research</th>
              <th>Legal</th>
              <th>Risk</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {!items.length ? (
              <tr>
                <td colSpan={8}>
                  <div className={styles.emptyInline}>
                    <p>No candidates in the feasibility ledger.</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} onClick={() => onSelect(item.id)}>
                  <td>{item.title}</td>
                  <td>{item.productionReadiness ?? '—'}</td>
                  <td>{item.estimatedBudget ?? '—'}</td>
                  <td>{item.estimatedDurationDays ?? '—'}</td>
                  <td>{item.researchCompletion ?? '—'}</td>
                  <td>{item.legalReadiness ?? '—'}</td>
                  <td>{item.riskLevel}</td>
                  <td>{item.recommendation}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </article>
    </div>
  );
}
