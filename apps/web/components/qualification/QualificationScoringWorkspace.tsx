'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Download,
  Eye,
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
  QualificationScoringOverview,
  ScoringCandidate,
} from '@/lib/idea-qualification/qualification-scoring';
import { qualificationApi } from '@/apps/web/lib/qualification-api';
import styles from './qualification-scoring.module.css';

type TabId =
  | 'overview'
  | 'table'
  | 'matrix'
  | 'score'
  | 'radar'
  | 'distribution'
  | 'contribution'
  | 'ranking'
  | 'improvements'
  | 'alerts'
  | 'gates'
  | 'explain'
  | 'versions'
  | 'recommendations'
  | 'governance'
  | 'analytics'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'table', label: 'Score Table' },
  { id: 'matrix', label: 'Scoring Matrix' },
  { id: 'score', label: 'Overall Score' },
  { id: 'radar', label: 'Radar' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'contribution', label: 'Contribution' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'improvements', label: 'Improvements' },
  { id: 'alerts', label: 'Threshold Alerts' },
  { id: 'gates', label: 'Gating Rules' },
  { id: 'explain', label: 'Explainability' },
  { id: 'versions', label: 'Version History' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'governance', label: 'Governance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit' },
];

const EMPTY_COPY =
  'The Autonomous Qualification Scoring Centre continuously calculates weighted qualification scores for every candidate idea using explainable AI. Each candidate is scored across strategy alignment, evidence quality, audience value, originality, visual potential, feasibility, and related factors with configurable weights, gate thresholds, and confidence. Scores recalculate automatically as upstream modules change so only production-ready ideas advance to Mandatory Gates.';

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'QUALIFIED':
    case 'EXCELLENT':
    case 'STRONG':
    case 'PASS':
    case 'PASSED':
    case 'RUNNING':
    case 'LOW':
      return styles.toneReady;
    case 'REJECTED':
    case 'WEAK':
    case 'FAIL':
    case 'FAILED':
    case 'CRITICAL':
    case 'HIGH':
      return styles.toneBlocked;
    case 'REVIEW REQUIRED':
    case 'MARGINAL':
    case 'AWAIT SCORING':
    case 'UNMEASURED':
    case 'WARNING':
    case 'PENDING':
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

function exportPayload(overview: QualificationScoringOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `qualification-scoring-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'id',
    'title',
    'overallScore',
    'confidence',
    'strategicFit',
    'evidence',
    'audienceValue',
    'originality',
    'visualPotential',
    'risk',
    'recommendation',
    'gateStatus',
  ];
  const lines = [
    header.join(','),
    ...overview.candidates.map((item) =>
      [
        item.id,
        JSON.stringify(item.title),
        item.overallScore ?? '',
        item.confidence ?? '',
        item.strategicFit ?? '',
        item.evidenceQuality ?? '',
        item.audienceValue ?? '',
        item.originality ?? '',
        item.visualPotential ?? '',
        item.riskScore ?? '',
        item.recommendation,
        item.gateStatus,
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `qualification-scoring-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function QualificationScoringWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<QualificationScoringOverview | null>(null);
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
        qualificationApi.scoring(),
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
    () => [...new Set(candidates.map((item) => item.recommendation))].sort(),
    [candidates],
  );

  const filtered = useMemo(
    () =>
      candidates.filter((item) => {
        if (statusFilter !== 'all' && item.recommendation !== statusFilter) return false;
        if (!needle) return true;
        const haystack = [
          item.title,
          item.domain,
          item.recommendation,
          item.scoreBand,
          item.geography,
          item.gateStatus,
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
        label: 'Overall Qualification Score',
        value: m?.overallQualificationScore != null ? `${m.overallQualificationScore}` : 'UNMEAS.',
        meta: 'Weighted portfolio average',
        accent: '#2563EB',
        icon: Gauge,
        bars: sparkBars(m?.overallQualificationScore ?? 0),
        drill: 'score' as TabId,
      },
      {
        label: 'AI Confidence',
        value: m?.aiConfidence != null ? `${m.aiConfidence}%` : 'UNMEAS.',
        meta: 'From iq_scores.confidence',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(m?.aiConfidence ?? 0),
        drill: 'explain' as TabId,
      },
      {
        label: 'Production Readiness',
        value: m?.productionReadiness != null ? `${m.productionReadiness}` : 'UNMEAS.',
        meta: 'Feasibility · sources · visual',
        accent: '#0EA5E9',
        icon: Layers3,
        bars: sparkBars(m?.productionReadiness ?? 0),
        drill: 'matrix' as TabId,
      },
      {
        label: 'Risk Score',
        value: m?.riskScore != null ? `${m.riskScore}` : 'UNMEAS.',
        meta: 'Lower is safer',
        accent: '#EF4444',
        icon: ShieldAlert,
        bars: sparkBars(m?.riskScore ?? 0),
        drill: 'matrix' as TabId,
      },
      {
        label: 'Strategy Alignment',
        value: m?.strategyAlignment != null ? `${m.strategyAlignment}` : 'UNMEAS.',
        meta: 'strategicFit factor',
        accent: '#22C55E',
        icon: Target,
        bars: sparkBars(m?.strategyAlignment ?? 0),
        drill: 'matrix' as TabId,
      },
      {
        label: 'Evidence Quality',
        value: m?.evidenceQuality != null ? `${m.evidenceQuality}` : 'UNMEAS.',
        meta: 'evidence factor',
        accent: '#F59E0B',
        icon: Eye,
        bars: sparkBars(m?.evidenceQuality ?? 0),
        drill: 'matrix' as TabId,
      },
      {
        label: 'Audience Value',
        value: m?.audienceValue != null ? `${m.audienceValue}` : 'UNMEAS.',
        meta: 'audienceValue factor',
        accent: '#14B8A6',
        icon: TrendingUp,
        bars: sparkBars(m?.audienceValue ?? 0),
        drill: 'contribution' as TabId,
      },
      {
        label: 'Originality',
        value: m?.originality != null ? `${m.originality}` : 'UNMEAS.',
        meta: 'originality factor',
        accent: '#A855F7',
        icon: Sparkles,
        bars: sparkBars(m?.originality ?? 0),
        drill: 'radar' as TabId,
      },
      {
        label: 'Visual Potential',
        value: m?.visualPotential != null ? `${m.visualPotential}` : 'UNMEAS.',
        meta: 'visualPotential factor',
        accent: '#F97316',
        icon: Layers3,
        bars: sparkBars(m?.visualPotential ?? 0),
        drill: 'radar' as TabId,
      },
      {
        label: 'Final Recommendation',
        value: m?.finalRecommendation ?? 'UNMEAS.',
        meta: `${m?.qualifiedCount ?? 0} Q · ${m?.reviewCount ?? 0} R · ${m?.rejectedCount ?? 0} X`,
        accent: '#2563EB',
        icon: Scale,
        bars: sparkBars(m?.qualifiedCount ?? 0),
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
        <p className={styles.crumb}>Idea Qualification / Qualification Scoring</p>
        <h1 className={styles.title}>Autonomous Qualification Scoring Centre</h1>
        <section className={styles.unavailable}>
          <AlertTriangle size={18} aria-hidden />
          <div>
            <strong>Qualification Scoring unavailable</strong>
            <p>{overview?.reason || error || 'Unable to load scoring ledger.'}</p>
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

  const matrixRows = selected?.matrix ?? overview.scoringCriteria;

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 03 Idea Qualification / Qualification Scoring
          </p>
          <h1 className={styles.title}>Autonomous Qualification Scoring Centre</h1>
          <p className={styles.lede}>
            Persist factor scores, weights, model versions, and explainable recommendations before
            Mandatory Gates.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 03 Scoring</span>
          <span className={`${styles.badge} ${statusTone(overview.meta.cycleStatus)}`}>
            Cycle {overview.meta.cycleStatus}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Weights {overview.meta.weightProfile}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous weighted scoring</strong>
          Scores come from persisted <code>iq_scores</code> (factors, weights, thresholds, total,
          confidence, explanation) and <code>iq_gate_results</code>. Recommendations are
          observe-only — humans use the global Start / Pause / Resume / Stop bar only. Continuous
          recalculation runs with the autonomous cycle.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Scoring KPIs">
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

      <section className={styles.lifecycle} aria-label="Scoring pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Qualification scoring workflow</h2>
          <span>
            Factors → Weights → Normalize → Score → Gates → Explain → Alerts → Recommend → Recalc →
            Mandatory Gates
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {(overview.pipeline ?? []).map((stage) => (
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
            <strong>Waiting for scored candidates</strong>
            Weighted scoring starts after Stage 03 candidates receive persisted{' '}
            <code>iq_scores</code> rows from the qualification cycle.
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>{EMPTY_COPY}</h2>
            <p className={styles.lede}>
              Factor Collection → Weight Application → Normalization → Score Calculation → Gate
              Evaluation → Explainability → Threshold Alerts → Final Recommendation → Continuous
              Recalculation → Advance to Mandatory Gates.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Collect</strong>
              Factor scores
            </li>
            <li>
              <strong>2. Weight</strong>
              Configurable model
            </li>
            <li>
              <strong>3. Gate</strong>
              Threshold rules
            </li>
            <li>
              <strong>4. Advance</strong>
              Mandatory Gates
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Scoring workspace">
        <aside className={styles.panel} aria-label="Score Explorer">
          <div className={styles.panelHead}>
            <h2>Score Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Candidate, domain, recommendation…"
              />
            </label>
            <label className={styles.field}>
              <span>Recommendation</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All recommendations</option>
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
                        score {item.overallScore ?? '—'} · {item.recommendation}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.scoreBand)}`}>
                          {item.scoreBand}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Scoring detail">
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
                      <dt>Overall score</dt>
                      <dd>{selected.overallScore ?? 'UNMEASURED'}</dd>
                    </div>
                    <div>
                      <dt>Band</dt>
                      <dd>
                        <span className={`${styles.chip} ${statusTone(selected.scoreBand)}`}>
                          {selected.scoreBand}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Recommendation</dt>
                      <dd>
                        <span
                          className={`${styles.chip} ${statusTone(selected.recommendation)}`}
                        >
                          {selected.recommendation}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Gate status</dt>
                      <dd>{selected.gateStatus}</dd>
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
                      <dt>Scored</dt>
                      <dd>{metrics?.scoredCandidates ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Qualified</dt>
                      <dd>{metrics?.qualifiedCount ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Review / Rejected</dt>
                      <dd>
                        {metrics?.reviewCount ?? 0} / {metrics?.rejectedCount ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt>Gate pass rate</dt>
                      <dd>
                        {metrics?.gatePassRate != null ? `${metrics.gatePassRate}%` : 'UNMEAS.'}
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'overview' && !selected && showEmpty ? (
              <div className={styles.emptyInline}>
                <p>Select a candidate once scoring records appear.</p>
              </div>
            ) : null}

            {tab === 'table' ? (
              <ScoreTable items={filtered} onSelect={setSelectedId} />
            ) : null}

            {tab === 'matrix' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    Intelligent scoring matrix
                    {selected ? ` · ${selected.title}` : ' · portfolio averages'}
                  </h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Criterion</th>
                        <th>Weight %</th>
                        <th>Score</th>
                        <th>Contribution</th>
                        <th>Threshold</th>
                        <th>Gate</th>
                        <th>Confidence</th>
                        <th>Trend</th>
                        <th>Explanation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrixRows.map((row) => (
                        <tr key={row.key}>
                          <td>{row.label}</td>
                          <td>{row.weight ?? '—'}</td>
                          <td>{row.rawScore ?? 'UNMEAS.'}</td>
                          <td>{row.contribution ?? '—'}</td>
                          <td>{row.threshold ?? '—'}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(row.gateStatus)}`}>
                              {row.gateStatus}
                            </span>
                          </td>
                          <td>
                            {row.confidence != null ? `${row.confidence}%` : 'UNMEAS.'}
                          </td>
                          <td>{row.trend}</td>
                          <td>{row.explanation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'score' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    Overall Qualification Score{' '}
                    {selected.overallScore != null ? selected.overallScore : 'UNMEASURED'}{' '}
                    <span className={`${styles.chip} ${statusTone(selected.scoreBand)}`}>
                      {selected.scoreBand}
                    </span>
                  </h3>
                  <p className={styles.lede}>
                    AI Confidence:{' '}
                    {selected.measuredConfidence
                      ? measured(selected.confidence)
                      : 'UNMEASURED'}{' '}
                    · Model {display(selected.modelVersion)} · Min total{' '}
                    {overview.governance.defaultMinimumTotal}
                  </p>
                  <div className={styles.waterfall}>
                    {[
                      ['Strategy', selected.strategicFit],
                      ['Evidence', selected.evidenceQuality],
                      ['Audience', selected.audienceValue],
                      ['Originality', selected.originality],
                      ['Visual', selected.visualPotential],
                      ['Feasibility', selected.feasibility],
                      ['Risk (↓)', selected.riskScore],
                      ['Readiness', selected.productionReadiness],
                    ].map(([label, value]) => (
                      <div key={String(label)} className={styles.waterfallRow}>
                        <span>{label}</span>
                        <div className={styles.radarBar}>
                          <i
                            className={styles.radarFill}
                            style={{
                              width: `${Math.max(0, Math.min(100, Number(value) || 0))}%`,
                            }}
                          />
                        </div>
                        <strong>{value != null ? value : 'UNMEAS.'}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'radar' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Factor radar</h3>
                  <div className={styles.waterfall}>
                    {selected.radar.map((row) => (
                      <div key={row.key} className={styles.waterfallRow}>
                        <span>{row.label}</span>
                        <div className={styles.radarBar}>
                          <i
                            className={styles.radarFill}
                            style={{
                              width: `${Math.max(0, Math.min(100, row.value ?? 0))}%`,
                            }}
                          />
                        </div>
                        <strong>{row.value ?? 'UNMEAS.'}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'distribution' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Score distribution</h3>
                  <div className={styles.waterfall}>
                    {overview.analytics.scoreDistribution.map((row) => (
                      <div key={row.label} className={styles.waterfallRow}>
                        <span>{row.label}</span>
                        <div className={styles.radarBar}>
                          <i
                            className={styles.radarFill}
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(
                                  100,
                                  candidates.length
                                    ? (row.count / candidates.length) * 100
                                    : 0,
                                ),
                              )}%`,
                            }}
                          />
                        </div>
                        <strong>{row.count}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'contribution' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Factor contribution</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Factor</th>
                        <th>Weight %</th>
                        <th>Avg score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.analytics.factorContribution.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{row.weight}</td>
                          <td>{row.avgScore ?? 'UNMEASURED'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'ranking' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Ranking preview (by overall score)</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Title</th>
                        <th>Score</th>
                        <th>Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.analytics.rankingPreview.map((row, index) => (
                        <tr key={row.id}>
                          <td>{index + 1}</td>
                          <td>
                            <button
                              type="button"
                              className={styles.chip}
                              onClick={() => {
                                setSelectedId(row.id);
                                setTab('explain');
                              }}
                            >
                              {row.title}
                            </button>
                          </td>
                          <td>{row.score ?? '—'}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(row.recommendation)}`}>
                              {row.recommendation}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!overview.analytics.rankingPreview.length ? (
                    <p className={styles.lede}>No scored candidates to rank yet.</p>
                  ) : null}
                </article>
              </div>
            ) : null}

            {tab === 'improvements' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Mandatory improvement actions</h3>
                  <ul className={styles.bulletList}>
                    {selected.improvements.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'alerts' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Threshold alerts</h3>
                  {!selected.thresholdAlerts.length ? (
                    <p className={styles.lede}>No gate threshold breaches for this candidate.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Severity</th>
                          <th>Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.thresholdAlerts.map((row) => (
                          <tr key={`${row.code}-${row.message}`}>
                            <td>{row.code}</td>
                            <td>
                              <span className={`${styles.chip} ${statusTone(row.severity)}`}>
                                {row.severity}
                              </span>
                            </td>
                            <td>{row.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'gates' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Gating rules</h3>
                  {!selected.gateResults.length ? (
                    <p className={styles.lede}>
                      No <code>iq_gate_results</code> rows yet. Candidate gate status:{' '}
                      {selected.gateStatus}.
                    </p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Gate</th>
                          <th>Actual</th>
                          <th>Required</th>
                          <th>Status</th>
                          <th>Blocking</th>
                          <th>Explanation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.gateResults.map((row) => (
                          <tr key={`${row.code}-${row.status}-${row.actual}`}>
                            <td>{row.code}</td>
                            <td>{row.actual ?? '—'}</td>
                            <td>{display(row.required)}</td>
                            <td>
                              <span className={`${styles.chip} ${statusTone(row.status)}`}>
                                {row.status}
                              </span>
                            </td>
                            <td>{row.blocking ? 'Yes' : 'No'}</td>
                            <td>{display(row.explanation)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'explain' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    Decision panel · <strong>{selected.recommendation}</strong>
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
                    {selected.explanation ? ` · ${selected.explanation}` : ''}
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

            {tab === 'versions' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Score version history</h3>
                  {!selected.versionHistory.length ? (
                    <p className={styles.lede}>No historical iq_scores versions for this candidate.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Model</th>
                          <th>Total</th>
                          <th>Confidence</th>
                          <th>Scored at</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.versionHistory.map((row) => (
                          <tr key={row.scoreId}>
                            <td>{row.modelVersion}</td>
                            <td>{row.totalScore}</td>
                            <td>{row.confidence}</td>
                            <td>{new Date(row.scoredAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'recommendations' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>AI recommendations</h3>
                  <ul className={styles.bulletList}>
                    {(overview.recommendations ?? []).map((row) => (
                      <li key={row.id}>
                        <strong>{row.action}</strong> — {row.reason}{' '}
                        <span className={`${styles.chip} ${statusTone(row.priority)}`}>
                          {row.priority}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {!overview.recommendations.length ? (
                    <p className={styles.lede}>No recommendations until scores persist.</p>
                  ) : null}
                </article>
              </div>
            ) : null}

            {tab === 'governance' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Governance</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Model versions</dt>
                      <dd>{overview.governance.modelVersions.join(', ') || '—'}</dd>
                    </div>
                    <div>
                      <dt>Scores persisted</dt>
                      <dd>{overview.governance.scoresPersisted}</dd>
                    </div>
                    <div>
                      <dt>Gate results</dt>
                      <dd>{overview.governance.gateResults}</dd>
                    </div>
                    <div>
                      <dt>Decisions logged</dt>
                      <dd>{overview.governance.decisionsLogged}</dd>
                    </div>
                    <div>
                      <dt>Default min total</dt>
                      <dd>{overview.governance.defaultMinimumTotal}</dd>
                    </div>
                    <div>
                      <dt>Weight profile</dt>
                      <dd>{overview.meta.weightProfile}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Notifications</h3>
                  <ul className={styles.bulletList}>
                    {(overview.notifications ?? []).slice(0, 12).map((row) => (
                      <li key={row.id}>
                        <span className={`${styles.chip} ${statusTone(row.severity)}`}>
                          {row.severity}
                        </span>{' '}
                        {row.message}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'analytics' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Recommendation mix</h3>
                  <ul className={styles.bulletList}>
                    {overview.analytics.recommendationDistribution.map((row) => (
                      <li key={row.label}>
                        {row.label}: <strong>{row.count}</strong>
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Score bands</h3>
                  <ul className={styles.bulletList}>
                    {overview.analytics.scoreDistribution.map((row) => (
                      <li key={row.label}>
                        {row.label}: <strong>{row.count}</strong>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Audit trail</h3>
                  {!overview.audit.length ? (
                    <p className={styles.lede}>No scoring-related audit events yet.</p>
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

            {!selected &&
            !['table', 'distribution', 'contribution', 'ranking', 'recommendations', 'governance', 'analytics', 'audit', 'matrix'].includes(
              tab,
            ) ? (
              <div className={styles.emptyInline}>
                <p>Select a candidate from the Score Explorer to inspect this panel.</p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className={styles.panel} aria-label="Scoring insights">
          <div className={styles.panelHead}>
            <h2>Insights</h2>
            <span>Observe only</span>
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightStack}>
              <article className={styles.insightCard}>
                <h3>
                  <ShieldCheck size={14} aria-hidden /> Recommendation
                </h3>
                <p>
                  {selected ? (
                    <span className={`${styles.chip} ${statusTone(selected.recommendation)}`}>
                      {selected.recommendation}
                    </span>
                  ) : (
                    '—'
                  )}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>
                  <CheckCircle2 size={14} aria-hidden /> Next gate
                </h3>
                <p>
                  {selected?.recommendation === 'Qualified'
                    ? 'Eligible for Mandatory Gates (autonomous advance)'
                    : selected?.recommendation === 'Await Scoring'
                      ? 'Await iq_scores persistence'
                      : 'Resolve score gaps / gate failures before gates'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>
                  <XCircle size={14} aria-hidden /> Alerts
                </h3>
                <p>{selected?.thresholdAlerts.length ?? 0} threshold alert(s)</p>
              </article>
              <article className={styles.insightCard}>
                <h3>
                  <BrainCircuit size={14} aria-hidden /> Model
                </h3>
                <p>{selected?.modelVersion ?? overview.meta.modelVersions[0] ?? 'UNMEASURED'}</p>
              </article>
            </div>
          </div>
        </aside>
      </section>

      {error ? (
        <p className={styles.errorBanner} role="alert">
          {error}
        </p>
      ) : null}
    </motion.main>
  );
}

function ScoreTable({
  items,
  onSelect,
}: {
  items: ScoringCandidate[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>Candidate score table</h3>
        {!items.length ? (
          <p className={styles.lede}>No candidates in the filtered set.</p>
        ) : (
          <table className={styles.auditTable}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Score</th>
                <th>Confidence</th>
                <th>Strategy</th>
                <th>Evidence</th>
                <th>Audience</th>
                <th>Originality</th>
                <th>Visual</th>
                <th>Risk</th>
                <th>Recommendation</th>
                <th>Gate</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button type="button" className={styles.chip} onClick={() => onSelect(item.id)}>
                      {item.title}
                    </button>
                  </td>
                  <td>{item.overallScore ?? '—'}</td>
                  <td>{item.confidence ?? '—'}</td>
                  <td>{item.strategicFit ?? '—'}</td>
                  <td>{item.evidenceQuality ?? '—'}</td>
                  <td>{item.audienceValue ?? '—'}</td>
                  <td>{item.originality ?? '—'}</td>
                  <td>{item.visualPotential ?? '—'}</td>
                  <td>{item.riskScore ?? '—'}</td>
                  <td>
                    <span className={`${styles.chip} ${statusTone(item.recommendation)}`}>
                      {item.recommendation}
                    </span>
                  </td>
                  <td>{item.gateStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </div>
  );
}
