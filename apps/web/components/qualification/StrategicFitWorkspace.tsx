'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Download,
  Gauge,
  Layers3,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Workflow,
  XCircle,
} from 'lucide-react';
import type {
  StrategicFitCandidate,
  StrategicFitOverview,
} from '@/lib/idea-qualification/strategic-fit';
import { qualificationApi } from '@/apps/web/lib/qualification-api';
import styles from './strategic-fit.module.css';

type TabId =
  | 'overview'
  | 'table'
  | 'score'
  | 'strategy'
  | 'objectives'
  | 'audience'
  | 'brand'
  | 'portfolio'
  | 'commercial'
  | 'risks'
  | 'production'
  | 'explain'
  | 'recommendations'
  | 'governance'
  | 'analytics'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'table', label: 'Evaluation Table' },
  { id: 'score', label: 'AI Score' },
  { id: 'strategy', label: 'Strategy Match' },
  { id: 'objectives', label: 'Objectives' },
  { id: 'audience', label: 'Audience' },
  { id: 'brand', label: 'Brand' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'risks', label: 'Risk' },
  { id: 'production', label: 'Production' },
  { id: 'explain', label: 'Explainability' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'governance', label: 'Governance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit' },
];

const EMPTY_COPY =
  'The Strategic Fit Engine automatically evaluates every qualified documentary candidate against the active Strategy Package, editorial objectives, audience priorities, commercial goals, portfolio diversity, production readiness, and enterprise governance policies. Each candidate receives an explainable AI strategic score, alignment breakdown, commercial assessment, portfolio impact analysis, and executive recommendation. Once qualified ideas enter this stage, strategic dashboards, portfolio analytics, AI decision explanations, and governance records will populate automatically.';

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED':
    case 'APPROVE IMMEDIATELY':
    case 'MATCH':
    case 'EVALUATED':
    case 'HIGH':
    case 'RUNNING':
    case 'QUALIFIED':
      return styles.toneReady;
    case 'REJECTED':
    case 'REJECT':
    case 'FAILED':
    case 'CRITICAL':
    case 'LOW':
      return styles.toneBlocked;
    case 'NEEDS_REVIEW':
    case 'ESCALATE TO EDITORIAL BOARD':
    case 'DELAY':
    case 'PARTIAL':
    case 'PENDING':
    case 'MEDIUM':
    case 'WARNING':
    case 'UNMEASURED':
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

function heatBar(sharePct: number) {
  const blocks = Math.max(1, Math.round(sharePct / 10));
  return '█'.repeat(blocks);
}

function exportPayload(overview: StrategicFitOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `strategic-fit-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'id',
    'title',
    'strategicScore',
    'brand',
    'audience',
    'commercial',
    'portfolio',
    'risk',
    'priority',
    'status',
  ];
  const lines = [
    header.join(','),
    ...overview.candidates.map((item) =>
      [
        item.id,
        JSON.stringify(item.title),
        item.strategicScore ?? '',
        item.brandAlignment ?? '',
        item.audienceAlignment ?? '',
        item.commercialValue ?? '',
        item.portfolioNeed ?? '',
        item.riskScore ?? '',
        item.priority,
        item.fitStatus,
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `strategic-fit-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function StrategicFitWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategicFitOverview | null>(null);
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
        qualificationApi.strategicFit(),
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
    () => [...new Set(candidates.map((item) => item.fitStatus))].sort(),
    [candidates],
  );

  const filtered = useMemo(
    () =>
      candidates.filter((item) => {
        if (statusFilter !== 'all' && item.fitStatus !== statusFilter) return false;
        if (!needle) return true;
        const haystack = [
          item.title,
          item.domain,
          item.audience,
          item.geography,
          item.fitStatus,
          item.recommendation,
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

  const maxHeat = Math.max(
    1,
    ...(overview?.portfolioHeatmap.map((item) => item.sharePct) ?? [1]),
  );

  const kpis = useMemo(() => {
    const m = metrics;
    return [
      {
        label: 'Total Candidates',
        value: String(m?.totalCandidates ?? 0),
        meta: 'Under strategic evaluation',
        accent: '#2563EB',
        icon: Layers3,
        bars: sparkBars(m?.totalCandidates ?? 0),
        drill: 'table' as TabId,
      },
      {
        label: 'Strategy Approved',
        value: String(m?.strategyApproved ?? 0),
        meta: 'Fit status APPROVED',
        accent: '#22C55E',
        icon: CheckCircle2,
        bars: sparkBars(m?.strategyApproved ?? 0),
        drill: 'table' as TabId,
      },
      {
        label: 'Needs Review',
        value: String(m?.needsReview ?? 0),
        meta: 'Escalate / mid-band scores',
        accent: '#F59E0B',
        icon: AlertTriangle,
        bars: sparkBars(m?.needsReview ?? 0),
        drill: 'recommendations' as TabId,
      },
      {
        label: 'Rejected',
        value: String(m?.rejected ?? 0),
        meta: 'Strategic reject / low fit',
        accent: '#EF4444',
        icon: XCircle,
        bars: sparkBars(m?.rejected ?? 0),
        drill: 'table' as TabId,
      },
      {
        label: 'Avg Strategic Score',
        value: m?.averageStrategicScore != null ? `${m.averageStrategicScore}%` : 'UNMEAS.',
        meta: 'strategicFit factor avg',
        accent: '#7C3AED',
        icon: Target,
        bars: sparkBars(m?.averageStrategicScore ?? 0),
        drill: 'score' as TabId,
      },
      {
        label: 'Commercial Potential',
        value: m?.commercialPotential != null ? `${m.commercialPotential}` : 'UNMEAS.',
        meta: 'From audience value factors',
        accent: '#F97316',
        icon: TrendingUp,
        bars: sparkBars(m?.commercialPotential ?? 0),
        drill: 'commercial' as TabId,
      },
      {
        label: 'Audience Alignment',
        value: m?.audienceAlignment != null ? `${m.audienceAlignment}%` : 'UNMEAS.',
        meta: 'audienceValue avg',
        accent: '#0EA5E9',
        icon: Gauge,
        bars: sparkBars(m?.audienceAlignment ?? 0),
        drill: 'audience' as TabId,
      },
      {
        label: 'Brand Alignment',
        value: m?.brandAlignment != null ? `${m.brandAlignment}%` : 'UNMEAS.',
        meta: 'Educational + strategic blend',
        accent: '#2563EB',
        icon: ShieldCheck,
        bars: sparkBars(m?.brandAlignment ?? 0),
        drill: 'brand' as TabId,
      },
      {
        label: 'Portfolio Coverage',
        value: m?.portfolioCoverage != null ? `${m.portfolioCoverage}%` : 'UNMEAS.',
        meta: 'Domain breadth proxy',
        accent: '#14B8A6',
        icon: Layers3,
        bars: sparkBars(m?.portfolioCoverage ?? 0),
        drill: 'portfolio' as TabId,
      },
      {
        label: 'Estimated ROI',
        value: m?.estimatedRoi != null ? `${m.estimatedRoi}%` : 'UNMEAS.',
        meta: 'No ROI model persisted',
        accent: '#94A3B8',
        icon: TrendingUp,
        bars: sparkBars(0),
        drill: 'commercial' as TabId,
      },
      {
        label: 'Production Priority',
        value: String(m?.productionPriorityHigh ?? 0),
        meta: 'HIGH priority candidates',
        accent: '#F59E0B',
        icon: Sparkles,
        bars: sparkBars(m?.productionPriorityHigh ?? 0),
        drill: 'production' as TabId,
      },
      {
        label: 'Executive Approval Rate',
        value: m?.executiveApprovalRate != null ? `${m.executiveApprovalRate}%` : 'UNMEAS.',
        meta: 'Approved / total',
        accent: '#22C55E',
        icon: Scale,
        bars: sparkBars(m?.executiveApprovalRate ?? 0),
        drill: 'governance' as TabId,
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

  if (error || (overview && !overview.available)) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Idea Qualification / Strategic Fit</p>
        <h1 className={styles.title}>Executive AI Strategic Decision Centre</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Strategic Fit unavailable</h2>
          <p>{error || overview?.reason}</p>
          <button type="button" className={styles.chip} onClick={() => void load()}>
            Retry connection
          </button>
        </section>
      </main>
    );
  }

  const showWaiting = !overview?.meta.intakeStatus;
  const showEmpty = Boolean(overview?.meta.intakeStatus) && candidates.length === 0;
  const scoreRows = selected
    ? [
        ['Brand Alignment', selected.brandAlignment],
        ['Audience Alignment', selected.audienceAlignment],
        ['Commercial Value', selected.commercialValue],
        ['Portfolio Need', selected.portfolioNeed],
        ['Risk (inverse concern)', selected.riskScore],
        ['Production Feasibility', selected.productionFeasibility],
      ]
    : [];

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 03 Idea Qualification / Strategic Fit
          </p>
          <h1 className={styles.title}>Executive AI Strategic Decision Centre</h1>
          <p className={styles.lede}>
            Measure alignment with the active Strategy Package and portfolio objectives before
            investing in Research & Evidence.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 03 Strategy</span>
          <span className={`${styles.badge} ${statusTone(overview?.meta.cycleStatus)}`}>
            Cycle {overview?.meta.cycleStatus ?? 'IDLE'}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Strategy {overview?.governance.strategyPackageVersion ?? '—'}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous strategic governance</strong>
          Fit scores come from persisted <code>iq_scores</code> factors and strategy package
          themes. ROI, platform forecasts, and scenario simulation stay UNMEASURED until those
          models are written. Approve/Hold/Reject are executed by the engine — this page explains
          them.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Strategic KPIs">
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

      <section className={styles.lifecycle} aria-label="Strategic fit pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Strategic decision workflow</h2>
          <span>
            Objectives → Brand → Audience → Commercial → Portfolio → Risk → Production → Score →
            Research
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
            <strong>Waiting for Strategy Package intake</strong>
            Strategic fit evaluation starts after an acknowledged Content Intelligence package
            linked to an active strategy version.
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>{EMPTY_COPY}</h2>
            <p className={styles.lede}>
              Candidate Qualified → Strategy Package → Objectives → Brand → Audience → Commercial →
              Portfolio → Risk → Strategic Decision → Research & Evidence.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Match</strong>
              Strategy package themes
            </li>
            <li>
              <strong>2. Score</strong>
              Multi-dimension fit
            </li>
            <li>
              <strong>3. Balance</strong>
              Portfolio gaps
            </li>
            <li>
              <strong>4. Decide</strong>
              Approve / review / reject
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Strategic fit workspace">
        <aside className={styles.panel} aria-label="Strategic Explorer">
          <div className={styles.panelHead}>
            <h2>Strategic Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Candidate, domain, audience, recommendation…"
              />
            </label>
            <label className={styles.field}>
              <span>Fit status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
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
                        {item.domain} · score{' '}
                        {item.strategicScore != null ? `${item.strategicScore}%` : 'UNMEAS.'} ·{' '}
                        {item.priority}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.fitStatus)}`}>
                          {item.fitStatus}
                        </span>
                        <span className={`${styles.chip} ${statusTone(item.recommendation)}`}>
                          {item.recommendation}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Strategic detail">
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
            {tab === 'overview' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Active strategy package</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Version</dt>
                      <dd>{overview?.governance.strategyPackageVersion ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Checksum</dt>
                      <dd>
                        <code>{overview?.meta.strategyChecksum ?? 'Not received'}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Themes</dt>
                      <dd>
                        {overview?.meta.strategyThemes.length
                          ? overview.meta.strategyThemes.join(' · ')
                          : 'UNMEASURED / not encoded in package_json'}
                      </dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Notifications</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.notifications ?? []).slice(0, 8).map((note) => (
                      <li key={note.id}>
                        <span className={`${styles.chip} ${statusTone(note.severity)}`}>
                          {note.severity}
                        </span>{' '}
                        {note.message}
                      </li>
                    ))}
                    {!overview?.notifications.length ? <li>No strategic alerts.</li> : null}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'table' ? (
              <FitTable
                items={filtered}
                onSelect={(id) => {
                  setSelectedId(id);
                  setTab('explain');
                }}
              />
            ) : null}

            {tab === 'score' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    Strategic score{' '}
                    {selected.strategicScore != null
                      ? `${selected.strategicScore}%`
                      : 'UNMEASURED'}
                  </h3>
                  <div className={styles.waterfall}>
                    {scoreRows.map(([label, value]) => (
                      <div key={String(label)} className={styles.waterfallRow}>
                        <span>{label}</span>
                        <div className={styles.radarBar}>
                          <div
                            className={styles.radarFill}
                            style={{
                              width: `${value != null ? Math.min(100, Number(value)) : 0}%`,
                            }}
                          />
                        </div>
                        <strong>{value != null ? String(value) : 'UNMEAS.'}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'strategy' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Strategy package matching</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Theme / field</th>
                        <th>Match</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.strategyMatches.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{measured(row.match)}{row.match != null ? '%' : ''}</td>
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

            {tab === 'objectives' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Objective alignment</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Objective</th>
                        <th>Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.objectiveAlignment.map((row) => (
                        <tr key={row.objective}>
                          <td>{row.objective}</td>
                          <td>
                            {row.match != null ? `${row.match}%` : 'UNMEASURED'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'audience' && selected ? (
              <KvPanel
                title="Audience alignment"
                rows={selected.audienceBreakdown.map((row) => ({
                  label: row.label,
                  value: row.value != null ? `${row.value}` : null,
                }))}
              />
            ) : null}

            {tab === 'brand' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Brand alignment</h3>
                  <ul className={styles.bulletList}>
                    {selected.brandChecks.map((check) => (
                      <li key={check.label}>
                        <span className={`${styles.chip} ${statusTone(check.status)}`}>
                          {check.status}
                        </span>{' '}
                        {check.label} — {check.detail}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'portfolio' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Portfolio heat map</h3>
                  <div className={styles.waterfall}>
                    {(overview?.portfolioHeatmap ?? []).map((item) => (
                      <div key={item.label} className={styles.waterfallRow}>
                        <span>{item.label}</span>
                        <div className={styles.radarBar}>
                          <div
                            className={styles.radarFill}
                            style={{ width: `${(item.sharePct / maxHeat) * 100}%` }}
                          />
                        </div>
                        <strong>
                          {heatBar(item.sharePct)} {item.sharePct}%
                        </strong>
                      </div>
                    ))}
                    {!overview?.portfolioHeatmap.length ? (
                      <p className={styles.lede}>No portfolio volume yet.</p>
                    ) : null}
                  </div>
                </article>
                <article className={styles.detailCard}>
                  <h3>Strategic gaps</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.portfolioGaps ?? []).map((gap) => (
                      <li key={gap.label}>
                        {gap.label} ({gap.sharePct}%) — {gap.recommendation}
                      </li>
                    ))}
                    {!overview?.portfolioGaps.length ? (
                      <li>No underrepresented domains detected yet.</li>
                    ) : null}
                  </ul>
                  <h3 style={{ marginTop: 16 }}>Geographic coverage</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.geographicCoverage ?? []).map((geo) => (
                      <li key={geo.label}>
                        {geo.label}: {geo.count}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'commercial' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>
                    Opportunity · {selected.opportunityValue}
                  </h3>
                  <dl className={styles.kv}>
                    {selected.commercial.map((row) => (
                      <div key={row.label}>
                        <dt>{row.label}</dt>
                        <dd>{measured(row.value)}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'risks' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Risk alignment</h3>
                  {!selected.risks.length ? (
                    <p className={styles.lede}>
                      No `iq_risk_assessments` rows. Factor risk: {measured(selected.riskScore)}.
                    </p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Severity</th>
                          <th>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.risks.map((risk) => (
                          <tr key={`${risk.category}-${risk.severity}`}>
                            <td>{risk.category}</td>
                            <td>{risk.severity}</td>
                            <td>{risk.score}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'production' && selected ? (
              <KvPanel title="Production readiness" rows={selected.production} />
            ) : null}

            {tab === 'explain' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    Strategic score{' '}
                    {selected.strategicScore != null
                      ? `${selected.strategicScore}%`
                      : 'UNMEASURED'}
                  </h3>
                  <p>{selected.aiSummary}</p>
                  <ul className={styles.bulletList}>
                    {selected.explainability.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Strategic timeline</h3>
                  <ul className={styles.timeline}>
                    {selected.lifecycle.map((step) => (
                      <li key={step.key}>
                        <CircleDot size={14} aria-hidden />
                        <div>
                          <strong>
                            {step.label}
                            {step.done ? ' ✓' : ''}
                          </strong>
                          <span>
                            {step.at ? new Date(step.at).toLocaleString() : 'Pending'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Executive decision panel</h3>
                  <p className={styles.lede}>
                    Observe-only. Engine recommendation:{' '}
                    <strong>{selected.recommendation}</strong>. Manual Approve / Hold / Reject /
                    Merge / Escalate actions are not exposed on stage pages.
                  </p>
                  <div className={styles.explorerBadges}>
                    <span className={`${styles.chip} ${statusTone(selected.fitStatus)}`}>
                      {selected.fitStatus}
                    </span>
                    <span className={`${styles.chip} ${statusTone(selected.priority)}`}>
                      Priority {selected.priority}
                    </span>
                    <span className={`${styles.chip} ${statusTone(selected.opportunityValue)}`}>
                      Opportunity {selected.opportunityValue}
                    </span>
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'recommendations' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>AI recommendation engine</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Reason</th>
                        <th>Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overview?.recommendations ?? []).map((item) => (
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
                </article>
              </div>
            ) : null}

            {tab === 'governance' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>AI governance</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Strategy package version</dt>
                      <dd>{measured(overview?.governance.strategyPackageVersion)}</dd>
                    </div>
                    <div>
                      <dt>Model versions</dt>
                      <dd>
                        {overview?.governance.modelVersions.length
                          ? overview.governance.modelVersions.join(', ')
                          : 'UNMEASURED'}
                      </dd>
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
                      <dt>Selected confidence</dt>
                      <dd>
                        {selected?.measuredConfidence
                          ? `${selected.confidence}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'analytics' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Fit status distribution</h3>
                  <ul className={styles.bulletList}>
                    {['APPROVED', 'NEEDS_REVIEW', 'REJECTED', 'PENDING'].map((status) => (
                      <li key={status}>
                        {status}:{' '}
                        {candidates.filter((item) => item.fitStatus === status).length}
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Opportunity value</h3>
                  <ul className={styles.bulletList}>
                    {['HIGH', 'MEDIUM', 'LOW', 'UNMEASURED'].map((value) => (
                      <li key={value}>
                        {value}:{' '}
                        {candidates.filter((item) => item.opportunityValue === value).length}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Strategic audit trail</h3>
                  {!overview?.audit.length ? (
                    <p className={styles.lede}>No strategy-related audit events persisted yet.</p>
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
                        {overview.audit.map((row) => (
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

            {[
              'score',
              'strategy',
              'objectives',
              'audience',
              'brand',
              'commercial',
              'risks',
              'production',
              'explain',
            ].includes(tab) && !selected ? (
              <div className={styles.emptyInline}>
                <Target size={22} aria-hidden />
                <p>Select a candidate to inspect strategic fit reasoning.</p>
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
                <h3>Selected candidate</h3>
                <p>{selected?.title ?? 'Select a candidate for XAI detail.'}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Fit decision</h3>
                <p>
                  {selected
                    ? `${selected.fitStatus} · ${
                        selected.strategicScore != null
                          ? `${selected.strategicScore}%`
                          : 'UNMEAS.'
                      }`
                    : '—'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Recommendation</h3>
                <p>{selected?.recommendation ?? '—'}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Why</h3>
                <ul className={styles.bulletList}>
                  {(selected?.explainability ?? ['—']).slice(0, 6).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </aside>
      </section>
    </motion.main>
  );
}

function KvPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string | null }>;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>{title}</h3>
        <dl className={styles.kv}>
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{measured(row.value)}</dd>
            </div>
          ))}
        </dl>
      </article>
    </div>
  );
}

function FitTable({
  items,
  onSelect,
}: {
  items: StrategicFitCandidate[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>Strategic fit evaluation</h3>
        <table className={styles.auditTable}>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Strategy Score</th>
              <th>Brand</th>
              <th>Audience</th>
              <th>Commercial</th>
              <th>Portfolio</th>
              <th>Risk</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} onClick={() => onSelect(item.id)}>
                <td>{item.title}</td>
                <td>
                  {item.strategicScore != null ? `${item.strategicScore}%` : 'UNMEAS.'}
                </td>
                <td>{measured(item.brandAlignment)}</td>
                <td>{measured(item.audienceAlignment)}</td>
                <td>{measured(item.commercialValue)}</td>
                <td>{measured(item.portfolioNeed)}</td>
                <td>{measured(item.riskScore)}</td>
                <td>{item.priority}</td>
                <td>{item.fitStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length ? (
          <div className={styles.emptyInline}>
            <p>No strategic evaluations to display.</p>
          </div>
        ) : null}
      </article>
    </div>
  );
}
