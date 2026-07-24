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
  FileSearch,
  Gauge,
  GitBranch,
  Layers3,
  ListOrdered,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Workflow,
} from 'lucide-react';
import type {
  OpportunityScoreRecord,
  OpportunityScoringOverview,
} from '@/lib/content-intelligence/opportunity-scoring';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import styles from './opportunity-scoring.module.css';

type TabId =
  | 'overview'
  | 'table'
  | 'breakdown'
  | 'formula'
  | 'recommendations'
  | 'thresholds'
  | 'portfolio'
  | 'simulator'
  | 'history'
  | 'audit'
  | 'compare';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'table', label: 'Scoring Table' },
  { id: 'breakdown', label: 'Breakdown' },
  { id: 'formula', label: 'Formula' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'thresholds', label: 'Thresholds' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'simulator', label: 'Simulator' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
  { id: 'compare', label: 'Compare' },
];

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'PASSED':
    case 'VERIFIED':
    case 'COMPLETED':
    case 'RUNNING':
    case 'ACKNOWLEDGED':
    case 'SELECTED':
    case 'READY':
    case 'SCORED':
    case 'CLEAR':
    case 'ACTIVE':
    case 'FAST_TRACK':
    case 'IMMEDIATE_PRODUCTION':
      return styles.toneReady;
    case 'FAILED':
    case 'REJECTED':
    case 'BLOCKED':
    case 'REJECT':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'PENDING':
    case 'WAITING':
    case 'WAIT':
    case 'SCORING':
    case 'WARNING':
    case 'RESEARCH_MORE':
    case 'NEEDS_VERIFICATION':
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

function packageLabel(overview: OpportunityScoringOverview | null, systemRunning: boolean) {
  if (overview?.run?.status === 'FAILED') return 'Failed';
  if ((overview?.metrics.awaitingScoring ?? 0) > 0 && (systemRunning || overview?.run?.status === 'RUNNING')) {
    return 'Scoring';
  }
  if ((overview?.metrics.readyForRanking ?? 0) > 0) return 'Ready';
  if ((overview?.metrics.scored ?? 0) > 0) return 'Scored';
  if ((overview?.metrics.awaitingScoring ?? 0) > 0) return 'Awaiting';
  if (overview?.strategy) return 'Waiting';
  return 'Empty';
}

function matchesRecord(
  item: OpportunityScoreRecord,
  needle: string,
  status: string,
  category: string,
  audience: string,
  recommendation: string,
  scoreBand: string,
) {
  if (status !== 'all' && item.status !== status && item.gateStatus !== status) return false;
  if (category !== 'all' && item.domain !== category) return false;
  if (audience !== 'all' && (item.audience ?? '') !== audience) return false;
  if (recommendation !== 'all' && item.recommendation !== recommendation) return false;
  if (scoreBand === 'elite' && !(item.measuredScore && item.opportunityScore >= 90)) return false;
  if (scoreBand === 'excellent' && !(item.measuredScore && item.opportunityScore >= 80 && item.opportunityScore < 90)) {
    return false;
  }
  if (scoreBand === 'good' && !(item.measuredScore && item.opportunityScore >= 70 && item.opportunityScore < 80)) {
    return false;
  }
  if (scoreBand === 'moderate' && !(item.measuredScore && item.opportunityScore >= 60 && item.opportunityScore < 70)) {
    return false;
  }
  if (scoreBand === 'weak' && !(item.measuredScore && item.opportunityScore >= 40 && item.opportunityScore < 60)) {
    return false;
  }
  if (scoreBand === 'reject' && !(item.measuredScore && item.opportunityScore < 40)) return false;
  if (scoreBand === 'unmeasured' && item.measuredScore) return false;
  if (!needle) return true;
  const haystack = [
    item.title,
    item.summary,
    item.domain,
    item.audience,
    item.geography,
    item.status,
    item.recommendation,
    item.opportunityId,
    ...item.evidenceSubjects,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function simulateScore(
  item: OpportunityScoreRecord,
  deltas: { competition: number; audience: number; cost: number; evidence: number },
) {
  if (!item.measuredScore) return null;
  let score = item.opportunityScore;
  score -= deltas.competition * 0.15;
  score += deltas.audience * 0.2;
  score -= deltas.cost * 0.1;
  score += deltas.evidence * 0.18;
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

function exportPayload(overview: OpportunityScoringOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `opportunity-scoring-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'id',
    'title',
    'domain',
    'score',
    'confidence',
    'recommendation',
    'gateStatus',
    'modelVersion',
  ];
  const lines = [
    header.join(','),
    ...overview.records.map((item) =>
      [
        item.id,
        JSON.stringify(item.title),
        JSON.stringify(item.domain),
        item.measuredScore ? item.opportunityScore : '',
        item.measuredConfidence ? item.confidence : '',
        item.recommendation,
        item.gateStatus ?? '',
        item.modelVersion ?? '',
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `opportunity-scoring-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function OpportunityScoringWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<OpportunityScoringOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [recommendationFilter, setRecommendationFilter] = useState('all');
  const [scoreBand, setScoreBand] = useState('all');
  const [tab, setTab] = useState<TabId>('overview');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [sim, setSim] = useState({ competition: 0, audience: 0, cost: 0, evidence: 0 });

  const systemRunning = systemState === 'RUNNING';

  async function load(preferId?: string | null) {
    setBusy(true);
    setError('');
    try {
      const [next, dashboard] = await Promise.all([
        intelligenceApi.scoring(),
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
  const meta = overview?.meta;
  const needle = query.trim().toLowerCase();

  const statuses = useMemo(() => {
    const values = new Set<string>();
    for (const item of records) {
      values.add(item.status);
      if (item.gateStatus) values.add(item.gateStatus);
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
  const recommendations = useMemo(
    () => [...new Set(records.map((item) => item.recommendation))].sort(),
    [records],
  );

  const filtered = useMemo(
    () =>
      records.filter((item) =>
        matchesRecord(
          item,
          needle,
          statusFilter,
          categoryFilter,
          audienceFilter,
          recommendationFilter,
          scoreBand,
        ),
      ),
    [
      records,
      needle,
      statusFilter,
      categoryFilter,
      audienceFilter,
      recommendationFilter,
      scoreBand,
    ],
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

  const compareItems = useMemo(
    () =>
      compareIds
        .map((id) => records.find((item) => item.id === id))
        .filter((item): item is OpportunityScoreRecord => Boolean(item)),
    [compareIds, records],
  );

  const simulated = selected ? simulateScore(selected, sim) : null;
  const stageStatus = packageLabel(overview, systemRunning);
  const distribution = overview?.scoreDistribution ?? [];
  const maxBucket = Math.max(1, ...distribution.map((item) => item.count));

  const kpis = useMemo(() => {
    const m = metrics;
    const last = meta?.lastScoringCycle
      ? new Date(meta.lastScoringCycle).toLocaleString()
      : 'No cycle yet';
    return [
      {
        label: 'Candidates Awaiting Scoring',
        value: String(m?.awaitingScoring ?? 0),
        meta: `Last run · ${last}`,
        accent: '#F59E0B',
        icon: Timer,
        bars: sparkBars(m?.awaitingScoring ?? 0),
        drill: 'table' as TabId,
      },
      {
        label: 'Scored Candidates',
        value: String(m?.scored ?? 0),
        meta: 'Persisted ci_scores',
        accent: '#2563EB',
        icon: Gauge,
        bars: sparkBars(m?.scored ?? 0),
        drill: 'table' as TabId,
      },
      {
        label: 'Average Opportunity Score',
        value: m?.avgOpportunityScore != null ? String(m.avgOpportunityScore) : 'UNMEAS.',
        meta: 'Mean of measured total_score',
        accent: '#7C3AED',
        icon: Target,
        bars: sparkBars(m?.avgOpportunityScore ?? 0),
        drill: 'breakdown' as TabId,
      },
      {
        label: 'Highest Score',
        value: m?.highestScore != null ? String(m.highestScore) : 'UNMEAS.',
        meta: 'Max measured score',
        accent: '#22C55E',
        icon: Trophy,
        bars: sparkBars(m?.highestScore ?? 0),
        drill: 'table' as TabId,
      },
      {
        label: 'Lowest Score',
        value: m?.lowestScore != null ? String(m.lowestScore) : 'UNMEAS.',
        meta: 'Min measured score',
        accent: '#EF4444',
        icon: AlertTriangle,
        bars: sparkBars(m?.lowestScore ?? 0),
        drill: 'table' as TabId,
      },
      {
        label: 'AI Confidence',
        value: m?.aiConfidence != null ? String(m.aiConfidence) : 'UNMEAS.',
        meta:
          (m?.measuredAiConfidence ?? 0) > 0
            ? `${m?.measuredAiConfidence} measured`
            : 'No confidence ≥ 1',
        accent: '#0EA5E9',
        icon: BrainCircuit,
        bars: sparkBars(m?.aiConfidence ?? 0),
        drill: 'overview' as TabId,
      },
      {
        label: 'Evidence Confidence',
        value: m?.evidenceConfidence != null ? String(m.evidenceConfidence) : 'UNMEAS.',
        meta:
          (m?.measuredEvidenceConfidence ?? 0) > 0
            ? `${m?.measuredEvidenceConfidence} factor rows`
            : 'No evidence factor',
        accent: '#14B8A6',
        icon: FileSearch,
        bars: sparkBars(m?.evidenceConfidence ?? 0),
        drill: 'breakdown' as TabId,
      },
      {
        label: 'Business Impact Score',
        value: m?.businessImpact != null ? String(m.businessImpact) : 'UNMEAS.',
        meta:
          (m?.measuredBusinessImpact ?? 0) > 0
            ? `${m?.measuredBusinessImpact} measured`
            : 'No business impact factor',
        accent: '#F97316',
        icon: Activity,
        bars: sparkBars(m?.businessImpact ?? 0),
        drill: 'recommendations' as TabId,
      },
      {
        label: 'Audience Demand Score',
        value: m?.audienceDemand != null ? String(m.audienceDemand) : 'UNMEAS.',
        meta:
          (m?.measuredAudienceDemand ?? 0) > 0
            ? `${m?.measuredAudienceDemand} measured`
            : 'No demand factor',
        accent: '#8B5CF6',
        icon: Layers3,
        bars: sparkBars(m?.audienceDemand ?? 0),
        drill: 'formula' as TabId,
      },
      {
        label: 'Production Readiness',
        value: m?.productionReadiness != null ? String(m.productionReadiness) : 'UNMEAS.',
        meta:
          (m?.measuredProductionReadiness ?? 0) > 0
            ? `${m?.measuredProductionReadiness} measured`
            : 'No feasibility factor',
        accent: '#64748B',
        icon: Workflow,
        bars: sparkBars(m?.productionReadiness ?? 0),
        drill: 'portfolio' as TabId,
      },
      {
        label: 'Strategic Alignment',
        value: m?.strategicAlignment != null ? String(m.strategicAlignment) : 'UNMEAS.',
        meta:
          (m?.measuredStrategicAlignment ?? 0) > 0
            ? `${m?.measuredStrategicAlignment} measured`
            : 'No strategicFit factor',
        accent: '#2563EB',
        icon: CheckCircle2,
        bars: sparkBars(m?.strategicAlignment ?? 0),
        drill: 'thresholds' as TabId,
      },
      {
        label: 'Ready for Ranking',
        value: String(m?.readyForRanking ?? 0),
        meta: 'Score ≥ 60 · gates clear',
        accent: '#22C55E',
        icon: GitBranch,
        bars: sparkBars(m?.readyForRanking ?? 0),
        drill: 'recommendations' as TabId,
      },
    ];
  }, [metrics, meta]);

  const radarDims = selected
    ? [
        { label: 'Demand', value: selected.audienceDemand },
        { label: 'Novelty', value: selected.novelty },
        { label: 'Authority', value: selected.evidenceQuality },
        { label: 'Business', value: selected.businessImpact },
        { label: 'Risk', value: selected.risk },
        { label: 'Production', value: selected.productionReadiness },
        { label: 'SEO', value: selected.seo },
        { label: 'Strategic', value: selected.strategicAlignment },
        { label: 'Audience', value: selected.audienceDemand },
        { label: 'Portfolio', value: selected.portfolioFit },
      ]
    : [];

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
          Content Lifecycle / 02 Content Intelligence / Opportunity Scoring
        </p>
        <h1 className={styles.title}>Opportunity Scoring Engine</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Opportunity scoring unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  const issues = overview?.issues ?? [];
  const audit = overview?.audit ?? [];
  const showEmptyHero = Boolean(overview?.strategy) && records.length === 0;
  const showWaitingStrategy = !overview?.strategy;

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 02 Content Intelligence / Opportunity Scoring
          </p>
          <h1 className={styles.title}>Opportunity Scoring Engine</h1>
          <p className={styles.lede}>
            Automatically evaluate every candidate opportunity using explainable AI scoring,
            strategic weighting, evidence confidence, business impact prediction, production
            feasibility and portfolio optimization.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 02</span>
          <span className={`${styles.badge} ${statusTone(stageStatus)}`}>{stageStatus}</span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Last cycle{' '}
            {meta?.lastScoringCycle
              ? new Date(meta.lastScoringCycle).toLocaleString()
              : 'UNMEASURED'}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Avg confidence {measured(meta?.avgConfidence)}
          </span>
          <span className={`${styles.badge} ${styles.toneAi}`}>
            Model {display(meta?.scoringModelVersion)}
          </span>
          <span className={`${styles.badge} ${statusTone(overview?.strategy?.status)}`}>
            Strategy v{overview?.strategy?.versionNumber ?? '—'}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Rate {measured(meta?.processingRate)}
            {meta?.processingRate != null ? '/hr' : ''}
          </span>
          <span className={`${styles.badge} ${statusTone(meta?.queueStatus)}`}>
            Queue {display(meta?.queueStatus)}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous scoring</strong>
          Scores, weights, gates, and explanations come from persisted <code>ci_scores</code>.
          Missing factors remain UNMEASURED — never fabricated.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Scoring KPI summary">
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

      <section className={styles.lifecycle} aria-label="Autonomous scoring pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Autonomous scoring pipeline</h2>
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
                {stage.recordsProcessed} rec · conf {measured(stage.aiConfidence)} · fail{' '}
                {stage.failures}
                {stage.successRate != null ? ` · ${stage.successRate}%` : ''}
                {stage.durationMs != null ? ` · ${stage.durationMs}ms` : ' · dur UNMEAS.'}
                {stage.retries != null ? ` · retry ${stage.retries}` : ''}
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
            Scoring starts after an acknowledged Strategy package and Candidate Ideas are available
            for autonomous evaluation.
          </div>
        </div>
      ) : null}

      {showEmptyHero ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>Opportunity scoring will begin automatically once Candidate Ideas have been verified.</h2>
            <p className={styles.lede}>
              While Running, the engine loads candidates, aggregates evidence, extracts features,
              applies weighted multi-factor scoring, calibrates confidence, optimizes portfolio
              balance, and queues ready ideas for Ranking & Selection.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Load candidates</strong>
              From verified Candidate Ideas
            </li>
            <li>
              <strong>2. Score autonomously</strong>
              Weighted factors + gate thresholds
            </li>
            <li>
              <strong>3. Explain & recommend</strong>
              XAI breakdown persisted to ci_scores
            </li>
            <li>
              <strong>4. Notify ranking</strong>
              Ready candidates enter Ranking Queue
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Opportunity scoring workspace">
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
                placeholder="Search candidates, topics, IDs…"
                aria-label="Search opportunity scoring"
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
              <span>Recommendation</span>
              <select
                value={recommendationFilter}
                onChange={(event) => setRecommendationFilter(event.target.value)}
                aria-label="Filter by recommendation"
              >
                <option value="all">All recommendations</option>
                {recommendations.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Score band</span>
              <select
                value={scoreBand}
                onChange={(event) => setScoreBand(event.target.value)}
                aria-label="Filter by score band"
              >
                <option value="all">All bands</option>
                <option value="elite">Elite 90–100</option>
                <option value="excellent">Excellent 80–89</option>
                <option value="good">Good 70–79</option>
                <option value="moderate">Moderate 60–69</option>
                <option value="weak">Weak 40–59</option>
                <option value="reject">Reject &lt;40</option>
                <option value="unmeasured">Unmeasured</option>
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
                        setCompareIds((prev) =>
                          prev.includes(item.id)
                            ? prev
                            : [...prev.slice(-2), item.id],
                        );
                      }}
                    >
                      <span className={styles.explorerTitle}>{item.title}</span>
                      <span className={styles.explorerMeta}>
                        {item.domain}
                        {item.audience ? ` · ${item.audience}` : ''}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.recommendation)}`}>
                          {item.recommendation}
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

        <section className={`${styles.panel} ${styles.center}`} aria-label="Scoring intelligence">
          <div className={styles.tabs} role="tablist" aria-label="Scoring tabs">
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
            tab !== 'table' &&
            tab !== 'formula' &&
            tab !== 'thresholds' &&
            tab !== 'compare' ? (
              <div className={styles.emptyInline}>
                <Layers3 size={22} aria-hidden />
                <p>
                  {overview?.strategy
                    ? 'Select a candidate to inspect explainable scoring, contributions, and recommendations.'
                    : 'Persisted candidates appear after discovery writes opportunities.'}
                </p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Overall score</h3>
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
                      <dt>AI confidence</dt>
                      <dd>
                        {selected.measuredConfidence
                          ? Math.round(selected.confidence as number)
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Gate</dt>
                      <dd>
                        {display(selected.gateStatus)}
                        {selected.gateFailures.length
                          ? ` · ${selected.gateFailures.join(', ')}`
                          : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Recommendation</dt>
                      <dd>{selected.recommendation}</dd>
                    </div>
                    <div>
                      <dt>Rank preview</dt>
                      <dd>
                        {selected.rankPreview != null
                          ? `#${selected.rankPreview}`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Model</dt>
                      <dd>{display(selected.modelVersion)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Why AI assigned this score</h3>
                  <p>
                    {selected.explanation ??
                      selected.recommendationReason ??
                      'No natural-language explanation persisted for this score row.'}
                  </p>
                  <h3>Positive factors</h3>
                  <ul className={styles.bulletList}>
                    {selected.positiveFactors.length ? (
                      selected.positiveFactors.map((factor) => <li key={factor}>{factor}</li>)
                    ) : (
                      <li>UNMEASURED — no weighted contributions persisted</li>
                    )}
                  </ul>
                  <h3>Negative factors</h3>
                  <ul className={styles.bulletList}>
                    {selected.negativeFactors.length ? (
                      selected.negativeFactors.map((factor) => <li key={factor}>{factor}</li>)
                    ) : (
                      <li>None flagged from persisted risk/competition/cost factors</li>
                    )}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Missing evidence & signals</h3>
                  <ul className={styles.bulletList}>
                    {selected.missingEvidence.length ? (
                      selected.missingEvidence.map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li>No missing core factors detected</li>
                    )}
                  </ul>
                  <h3>Supporting signals</h3>
                  <ul className={styles.bulletList}>
                    {selected.evidenceSubjects.length ? (
                      selected.evidenceSubjects.map((subject) => <li key={subject}>{subject}</li>)
                    ) : (
                      <li>No linked signal subjects</li>
                    )}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'table' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Candidate scoring table</h3>
                  {!filtered.length ? (
                    <p className={styles.lede}>No rows to display.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Candidate</th>
                          <th scope="col">Category</th>
                          <th scope="col">Audience</th>
                          <th scope="col">Score</th>
                          <th scope="col">Demand</th>
                          <th scope="col">Evidence</th>
                          <th scope="col">Confidence</th>
                          <th scope="col">Risk</th>
                          <th scope="col">Fit</th>
                          <th scope="col">Rec</th>
                          <th scope="col">Rank</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice(0, 50).map((item) => (
                          <tr key={item.id}>
                            <td>{item.title}</td>
                            <td>{item.domain}</td>
                            <td>{display(item.audience)}</td>
                            <td>
                              {item.measuredScore
                                ? item.opportunityScore.toFixed(1)
                                : 'UNMEASURED'}
                            </td>
                            <td>{measured(item.audienceDemand)}</td>
                            <td>{measured(item.evidenceQuality)}</td>
                            <td>
                              {item.measuredConfidence
                                ? Math.round(item.confidence as number)
                                : 'UNMEASURED'}
                            </td>
                            <td>{measured(item.risk)}</td>
                            <td>{measured(item.strategicAlignment)}</td>
                            <td>{item.recommendation}</td>
                            <td>
                              {item.rankPreview != null ? `#${item.rankPreview}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
                <article className={styles.detailCard}>
                  <h3>Score distribution</h3>
                  <div
                    className={styles.spark}
                    aria-hidden
                    style={{ height: 56, alignItems: 'flex-end', gap: 8 }}
                  >
                    {distribution.map((item) => (
                      <i
                        key={item.band}
                        title={`${item.label} ${item.band}: ${item.count}`}
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
                  <p className={styles.lede}>
                    {distribution
                      .map((item) => `${item.label} ${item.band} (${item.count})`)
                      .join(' · ') || 'No measured scores'}
                  </p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'breakdown' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Radar dimensions</h3>
                  <div className={styles.radarGrid}>
                    {radarDims.map((dim) => (
                      <div key={dim.label} className={styles.radarRow}>
                        <span>{dim.label}</span>
                        <strong>{measured(dim.value)}</strong>
                        <div className={styles.radarBar}>
                          <div
                            className={styles.radarFill}
                            style={{ width: `${Math.min(100, dim.value ?? 0)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
                <article className={styles.detailCard}>
                  <h3>Weighted contribution (waterfall)</h3>
                  {!selected.contributions.length ? (
                    <p className={styles.lede}>
                      No factor×weight contributions persisted for this score.
                    </p>
                  ) : (
                    <div className={styles.waterfall}>
                      {selected.contributions.slice(0, 12).map((row) => (
                        <div key={row.factor} className={styles.waterfallRow}>
                          <span>{row.factor}</span>
                          <div className={styles.radarBar}>
                            <div
                              className={styles.radarFill}
                              style={{
                                width: `${Math.min(100, Math.abs(row.contribution))}%`,
                              }}
                            />
                          </div>
                          <strong>{row.contribution}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
                <article className={styles.detailCard}>
                  <h3>Risk & production</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Risk</dt>
                      <dd>{measured(selected.risk)}</dd>
                    </div>
                    <div>
                      <dt>Production readiness</dt>
                      <dd>{measured(selected.productionReadiness)}</dd>
                    </div>
                    <div>
                      <dt>Production cost</dt>
                      <dd>{measured(selected.productionCost)}</dd>
                    </div>
                    <div>
                      <dt>ROI</dt>
                      <dd>{measured(selected.roi)}</dd>
                    </div>
                    <div>
                      <dt>Verification</dt>
                      <dd>
                        passed {selected.verificationPassed} · failed {selected.verificationFailed}
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'formula' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Opportunity score formula factors</h3>
                  <p className={styles.lede}>
                    Transparent multi-factor model. Persisted weights override platform defaults
                    when present in <code>weights_json</code>.
                  </p>
                  <div className={styles.radarGrid}>
                    {(overview?.formulaFactors ?? []).map((factor) => (
                      <div key={factor} className={styles.radarRow}>
                        <span>{factor}</span>
                        <strong>
                          {selected?.weights[factor] != null
                            ? selected.weights[factor]
                            : overview?.defaultWeights[factor] != null
                              ? `${overview.defaultWeights[factor]} (default)`
                              : 'configurable'}
                        </strong>
                      </div>
                    ))}
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
                        <th scope="col">Candidate</th>
                        <th scope="col">Recommendation</th>
                        <th scope="col">Reason</th>
                        <th scope="col">Score</th>
                        <th scope="col">Confidence</th>
                        <th scope="col">ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 40).map((item) => (
                        <tr key={item.id}>
                          <td>{item.title}</td>
                          <td>{item.recommendation}</td>
                          <td>{item.recommendationReason}</td>
                          <td>
                            {item.measuredScore
                              ? item.opportunityScore.toFixed(1)
                              : 'UNMEASURED'}
                          </td>
                          <td>
                            {item.measuredConfidence
                              ? Math.round(item.confidence as number)
                              : 'UNMEASURED'}
                          </td>
                          <td>{measured(item.roi)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'thresholds' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Threshold engine</h3>
                  <p className={styles.lede}>
                    Source: {overview?.thresholds.source} (shared scoring gates module). Below
                    threshold → automatic reject or return to prior stage via workers.
                  </p>
                  <dl className={styles.kv}>
                    {overview?.thresholds
                      ? (
                          [
                            ['Minimum Score', overview.thresholds.minimumScore],
                            ['Minimum Confidence', overview.thresholds.minimumConfidence],
                            ['Minimum Evidence', overview.thresholds.minimumEvidence],
                            ['Maximum Risk', overview.thresholds.maximumRisk],
                            ['Minimum Audience Demand', overview.thresholds.minimumAudienceDemand],
                            ['Maximum Competition', overview.thresholds.maximumCompetition],
                            ['Minimum Strategic Fit', overview.thresholds.minimumStrategicFit],
                            ['Minimum Business Impact', overview.thresholds.minimumBusinessImpact],
                            ['Minimum ROI', overview.thresholds.minimumRoi],
                          ] as Array<[string, number]>
                        ).map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))
                      : null}
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Selected vs thresholds</h3>
                  {selected ? (
                    <ul className={styles.bulletList}>
                      <li>
                        Score {selected.measuredScore ? selected.opportunityScore : 'UNMEASURED'} vs
                        min {overview?.thresholds.minimumScore}
                      </li>
                      <li>
                        Confidence{' '}
                        {selected.measuredConfidence ? selected.confidence : 'UNMEASURED'} vs min{' '}
                        {overview?.thresholds.minimumConfidence}
                      </li>
                      <li>
                        Evidence {measured(selected.evidenceQuality)} vs min{' '}
                        {overview?.thresholds.minimumEvidence}
                      </li>
                      <li>
                        Risk {measured(selected.risk)} vs max {overview?.thresholds.maximumRisk}
                      </li>
                      <li>
                        Gate failures:{' '}
                        {selected.gateFailures.length
                          ? selected.gateFailures.join(', ')
                          : 'none'}
                      </li>
                    </ul>
                  ) : (
                    <p className={styles.lede}>Select a candidate to compare against thresholds.</p>
                  )}
                </article>
              </div>
            ) : null}

            {selected && tab === 'portfolio' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Portfolio impact</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Portfolio fit</dt>
                      <dd>{measured(selected.portfolioFit)}</dd>
                    </div>
                    <div>
                      <dt>Domain</dt>
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
                      <dt>Ready for ranking (portfolio)</dt>
                      <dd>{metrics?.readyForRanking ?? 0}</dd>
                    </div>
                  </dl>
                  <p className={styles.lede}>
                    Diversity, saturation, and budget balances stay UNMEASURED unless workers
                    persist them in factor or portfolio payloads.
                  </p>
                </article>
                <article className={styles.detailCard}>
                  <h3>Evidence correlation</h3>
                  <ul className={styles.bulletList}>
                    <li>Candidate → {selected.title}</li>
                    <li>Evidence links → {selected.evidenceCount}</li>
                    <li>Verification passed → {selected.verificationPassed}</li>
                    <li>
                      Signals →{' '}
                      {selected.evidenceSubjects.length
                        ? selected.evidenceSubjects.join('; ')
                        : 'UNMEASURED'}
                    </li>
                  </ul>
                </article>
              </div>
            ) : null}

            {selected && tab === 'simulator' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Scenario simulator</h3>
                  <p className={styles.lede}>
                    Local what-if on the selected candidate’s persisted score. Deltas adjust the
                    measured score using published weight hints — results are not written unless
                    workers re-score.
                  </p>
                  <div className={styles.simControls}>
                    {(
                      [
                        ['competition', 'If competition increases'],
                        ['audience', 'If audience demand changes'],
                        ['cost', 'If production cost changes'],
                        ['evidence', 'If evidence improves'],
                      ] as Array<[keyof typeof sim, string]>
                    ).map(([key, label]) => (
                      <label key={key} className={styles.field}>
                        <span>
                          {label}: {sim[key]}
                        </span>
                        <input
                          type="range"
                          min={-40}
                          max={40}
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
                  <h3>Recalculated score</h3>
                  <div className={styles.simResult}>
                    <p>
                      Baseline:{' '}
                      <strong>
                        {selected.measuredScore
                          ? selected.opportunityScore.toFixed(1)
                          : 'UNMEASURED'}
                      </strong>
                    </p>
                    <p>
                      Simulated: <strong>{simulated != null ? simulated : 'UNMEASURED'}</strong>
                    </p>
                    <p className={styles.lede}>
                      Strategy-change scenarios require a new Strategy package and worker re-score.
                    </p>
                  </div>
                </article>
              </div>
            ) : null}

            {selected && tab === 'history' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Score history</h3>
                  {!selected.history.length ? (
                    <p className={styles.lede}>No historical ci_scores rows for this candidate.</p>
                  ) : (
                    <ul className={styles.timeline}>
                      {selected.history.map((row, index) => {
                        const previous = selected.history[index + 1];
                        return (
                          <li key={row.scoreId}>
                            <CircleDot size={14} aria-hidden />
                            <div>
                              <strong>
                                {row.totalScore}
                                {previous
                                  ? ` (was ${previous.totalScore})`
                                  : ' (initial / latest)'}
                              </strong>
                              <span>
                                {new Date(row.scoredAt).toLocaleString()} · {row.gateStatus} · model{' '}
                                {row.modelVersion}
                                {row.explanation ? ` · ${row.explanation.slice(0, 120)}` : ''}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Audit trail</h3>
                  {!audit.length ? (
                    <p className={styles.lede}>No scoring-related audit events persisted yet.</p>
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

            {tab === 'compare' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Comparison workspace</h3>
                  {compareItems.length < 2 ? (
                    <p className={styles.lede}>
                      Select at least two candidates from the explorer to compare.
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
                            [
                              'Score',
                              (item: OpportunityScoreRecord) =>
                                item.measuredScore
                                  ? item.opportunityScore.toFixed(1)
                                  : 'UNMEASURED',
                            ],
                            [
                              'Confidence',
                              (item: OpportunityScoreRecord) => measured(item.confidence),
                            ],
                            [
                              'Demand',
                              (item: OpportunityScoreRecord) => measured(item.audienceDemand),
                            ],
                            [
                              'Strategic fit',
                              (item: OpportunityScoreRecord) =>
                                measured(item.strategicAlignment),
                            ],
                            ['Risk', (item: OpportunityScoreRecord) => measured(item.risk)],
                            ['ROI', (item: OpportunityScoreRecord) => measured(item.roi)],
                            [
                              'Recommendation',
                              (item: OpportunityScoreRecord) => item.recommendation,
                            ],
                          ] as Array<[string, (item: OpportunityScoreRecord) => string]>
                        ).map(([label, getter]) => (
                          <tr key={label}>
                            <td>{label}</td>
                            {compareItems.map((item) => (
                              <td key={`${label}-${item.id}`}>{getter(item)}</td>
                            ))}
                          </tr>
                        ))}
                        <tr>
                          <td>Winner</td>
                          {(() => {
                            const measuredItems = compareItems.filter((item) => item.measuredScore);
                            const winner = measuredItems.sort(
                              (a, b) => b.opportunityScore - a.opportunityScore,
                            )[0];
                            return compareItems.map((item) => (
                              <td key={`winner-${item.id}`}>
                                {winner && item.id === winner.id ? 'Winner' : '—'}
                              </td>
                            ));
                          })()}
                        </tr>
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
                <h3>Model reasoning</h3>
                <p>
                  {selected?.explanation ??
                    selected?.recommendationReason ??
                    'Select a scored candidate to view persisted XAI explanation.'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Recommended action</h3>
                <p>
                  {selected
                    ? `${selected.recommendation} — ${selected.recommendationReason}`
                    : `Ready for ranking: ${metrics?.readyForRanking ?? 0}`}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Notifications</h3>
                <ul className={styles.bulletList}>
                  {(metrics?.readyForRanking ?? 0) > 0 ? (
                    <li>Ready for ranking: {metrics?.readyForRanking}</li>
                  ) : null}
                  {(metrics?.awaitingScoring ?? 0) > 0 ? (
                    <li>Awaiting scoring: {metrics?.awaitingScoring}</li>
                  ) : null}
                  {issues.slice(0, 5).map((issue) => (
                    <li key={issue.id}>
                      [{issue.severity}] {issue.message}
                    </li>
                  ))}
                  {!issues.length && (metrics?.awaitingScoring ?? 0) === 0 ? (
                    <li>No open scoring alerts in persisted state.</li>
                  ) : null}
                </ul>
              </article>
              <article className={styles.insightCard}>
                <h3>AI learning</h3>
                <dl className={styles.kv}>
                  <div>
                    <dt>Model version</dt>
                    <dd>{display(meta?.scoringModelVersion)}</dd>
                  </div>
                  <div>
                    <dt>Training dataset</dt>
                    <dd>UNMEASURED</dd>
                  </div>
                  <div>
                    <dt>Prediction accuracy</dt>
                    <dd>UNMEASURED</dd>
                  </div>
                  <div>
                    <dt>Calibration</dt>
                    <dd>{measured(meta?.avgConfidence)}</dd>
                  </div>
                </dl>
              </article>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.bottom} aria-label="Scoring monitoring">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Automation</h2>
            <ListOrdered size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              On Start, workers load candidates, aggregate evidence, extract features, score,
              adjust risk, calibrate confidence, optimize portfolio, recommend, persist{' '}
              <code>ci_scores</code>, and notify Ranking. This page is observe-only.
            </p>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Next stage</h2>
            <RefreshCw size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Ready for Ranking & Selection</dt>
                <dd>{metrics?.readyForRanking ?? 0}</dd>
              </div>
              <div>
                <dt>Queue</dt>
                <dd>{display(meta?.queueStatus)}</dd>
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
