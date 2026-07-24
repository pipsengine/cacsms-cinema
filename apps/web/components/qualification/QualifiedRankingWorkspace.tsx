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
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Workflow,
  Trophy,
} from 'lucide-react';
import type {
  QualifiedRankingOverview,
  RankingCandidate,
} from '@/lib/idea-qualification/ranking';
import { qualificationApi } from '@/apps/web/lib/qualification-api';
import styles from './qualified-ranking.module.css';

type TabId =
  | 'overview'
  | 'table'
  | 'weights'
  | 'portfolio'
  | 'compare'
  | 'heatmap'
  | 'scenarios'
  | 'sensitivity'
  | 'explain'
  | 'tiebreak'
  | 'timeline'
  | 'distribution'
  | 'recommendations'
  | 'governance'
  | 'analytics'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'table', label: 'Ranking Table' },
  { id: 'weights', label: 'Weight Model' },
  { id: 'portfolio', label: 'Portfolio Balance' },
  { id: 'compare', label: 'Comparison' },
  { id: 'heatmap', label: 'Score Heatmap' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'sensitivity', label: 'Sensitivity' },
  { id: 'explain', label: 'Explainability' },
  { id: 'tiebreak', label: 'Tie-breakers' },
  { id: 'timeline', label: 'Decision Timeline' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'governance', label: 'Governance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit' },
];

const EMPTY_COPY =
  'The Autonomous AI Ranking & Prioritization Centre ranks only candidates that have successfully passed all mandatory qualification gates. Multi-factor AI optimization applies configurable weights, portfolio diversity caps, and explainable tie-breakers so the highest-value production-ready ideas are continuously prioritized and automatically forwarded to the Decision Register — without drag-and-drop or manual reordering on this page.';

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'RECOMMEND FOR PRODUCTION':
    case 'P1':
    case 'PASSED':
    case 'PASS':
    case 'RUNNING':
    case 'PRODUCTION READY':
      return styles.toneReady;
    case 'NOT ELIGIBLE':
    case 'DEFER':
    case 'P4':
    case 'FAILED':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'HOLD FOR PORTFOLIO BALANCE':
    case 'AWAIT RANKING':
    case 'P2':
    case 'P3':
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

function sparkBars(seed: number) {
  return [4, 7, 5, 9, 6, 10, 8].map((base, index) =>
    Math.max(3, ((base + seed + index * 2) % 10) + 3),
  );
}

function exportPayload(overview: QualifiedRankingOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `qualified-ranking-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'rank',
    'id',
    'title',
    'score',
    'strategy',
    'audience',
    'originality',
    'evidence',
    'feasibility',
    'commercial',
    'risk',
    'confidence',
    'priority',
    'recommendation',
  ];
  const lines = [
    header.join(','),
    ...overview.candidates.map((item) =>
      [
        item.finalRank ?? '',
        item.id,
        JSON.stringify(item.title),
        item.compositeScore ?? '',
        item.strategicFit ?? '',
        item.audienceValue ?? '',
        item.originality ?? '',
        item.evidenceQuality ?? '',
        item.productionFeasibility ?? '',
        item.commercialPotential ?? '',
        item.riskLevel ?? '',
        item.confidence ?? '',
        item.priorityLevel,
        item.recommendation,
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `qualified-ranking-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function QualifiedRankingWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<QualifiedRankingOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);
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
        qualificationApi.ranking(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const items = next.candidates ?? [];
      const preferredPool = eligibleOnly
        ? items.filter(
            (item) =>
              /PASS/i.test(item.gateStatus) || item.finalRank != null,
          )
        : items;
      const targetId = preferId ?? selectedId;
      const selected = targetId
        ? items.find((item) => item.id === targetId)
        : preferredPool[0] ?? items[0];
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
        if (eligibleOnly && !/PASS/i.test(item.gateStatus) && item.finalRank == null) {
          return false;
        }
        if (statusFilter !== 'all' && item.recommendation !== statusFilter) return false;
        if (!needle) return true;
        const haystack = [
          item.title,
          item.domain,
          item.recommendation,
          item.priorityLevel,
          item.geography,
          String(item.finalRank ?? ''),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      }),
    [candidates, eligibleOnly, needle, statusFilter],
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

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 4) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }

  const compareRows = useMemo(
    () => candidates.filter((item) => compareIds.includes(item.id)),
    [candidates, compareIds],
  );

  const kpis = useMemo(() => {
    const m = metrics;
    return [
      {
        label: 'Total Qualified Ideas',
        value: String(m?.totalQualifiedIdeas ?? 0),
        meta: 'Gate-passed or ranked',
        accent: '#2563EB',
        icon: Scale,
        bars: sparkBars(m?.totalQualifiedIdeas ?? 0),
        drill: 'table' as TabId,
      },
      {
        label: 'Top-Ranked Candidates',
        value: String(m?.topRankedCandidates ?? 0),
        meta: 'Ranks 1–5',
        accent: '#F59E0B',
        icon: Trophy,
        bars: sparkBars(m?.topRankedCandidates ?? 0),
        drill: 'table' as TabId,
      },
      {
        label: 'Production Ready',
        value: String(m?.productionReady ?? 0),
        meta: 'Feasibility · risk · score bands',
        accent: '#22C55E',
        icon: CheckCircle2,
        bars: sparkBars(m?.productionReady ?? 0),
        drill: 'portfolio' as TabId,
      },
      {
        label: 'Average Qualification Score',
        value:
          m?.averageQualificationScore != null
            ? `${m.averageQualificationScore}`
            : 'UNMEAS.',
        meta: 'Composite among qualified',
        accent: '#0EA5E9',
        icon: Gauge,
        bars: sparkBars(m?.averageQualificationScore ?? 0),
        drill: 'distribution' as TabId,
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
        label: 'Portfolio Diversity',
        value: m?.portfolioDiversity != null ? `${m.portfolioDiversity}%` : 'UNMEAS.',
        meta: 'Unique domains / qualified',
        accent: '#14B8A6',
        icon: Layers3,
        bars: sparkBars(m?.portfolioDiversity ?? 0),
        drill: 'portfolio' as TabId,
      },
      {
        label: 'Estimated ROI',
        value: m?.estimatedRoi != null ? `${m.estimatedRoi}` : 'UNMEAS.',
        meta: 'From portfolio_effect_json',
        accent: '#F97316',
        icon: TrendingUp,
        bars: sparkBars(m?.estimatedRoi ?? 0),
        drill: 'portfolio' as TabId,
      },
      {
        label: 'Recommended for Production',
        value: String(m?.recommendedForProduction ?? 0),
        meta: 'Forward to Decision Register',
        accent: '#2563EB',
        icon: Target,
        bars: sparkBars(m?.recommendedForProduction ?? 0),
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
        <p className={styles.crumb}>Idea Qualification / Qualified Ranking</p>
        <h1 className={styles.title}>Autonomous AI Ranking &amp; Prioritization Centre</h1>
        <section className={styles.unavailable}>
          <AlertTriangle size={18} aria-hidden />
          <div>
            <strong>Qualified Ranking unavailable</strong>
            <p>{overview?.reason || error || 'Unable to load ranking ledger.'}</p>
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

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 03 Idea Qualification / Qualified Ranking
          </p>
          <h1 className={styles.title}>Autonomous AI Ranking &amp; Prioritization Centre</h1>
          <p className={styles.lede}>
            Rank only gate-passing ideas using portfolio-aware constraints — then forward to the
            Decision Register.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 03 Ranking</span>
          <span className={`${styles.badge} ${statusTone(overview.meta.cycleStatus)}`}>
            Cycle {overview.meta.cycleStatus}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            {overview.meta.rankingModel}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · drag-free autonomous prioritization</strong>
          Ranks come from persisted <code>iq_rankings</code>. When missing, provisional
          portfolio-aware order is derived from gate-passed composite scores (diversity cap{' '}
          {overview.meta.diversityCap} per domain|geography) — never invented ROI or ranks without
          upstream data. No manual reordering on this page.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Ranking KPIs">
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

      <section className={styles.lifecycle} aria-label="Ranking pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Qualified ranking workflow</h2>
          <span>
            Gates → Scores → Weights → Diversity → Constraints → Tie-break → Rank → Explain →
            Re-rank → Decision Register
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
            <strong>Waiting for gate-passed candidates</strong>
            Ranking starts after Mandatory Gates pass and composite scores are persisted.
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>{EMPTY_COPY}</h2>
            <p className={styles.lede}>
              Gate Filter → Composite Scores → Weighted Model → Portfolio Diversity → Constraints →
              Tie-break → Final Rank → Explainability → Auto Re-rank → Decision Register.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Filter</strong>
              Gate-passed only
            </li>
            <li>
              <strong>2. Optimize</strong>
              Multi-factor weights
            </li>
            <li>
              <strong>3. Balance</strong>
              Portfolio diversity
            </li>
            <li>
              <strong>4. Forward</strong>
              Decision Register
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Ranking workspace">
        <aside className={styles.panel} aria-label="Rank Explorer">
          <div className={styles.panelHead}>
            <h2>Rank Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Title, domain, rank, priority…"
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
            <label className={styles.field}>
              <span>
                <input
                  type="checkbox"
                  checked={eligibleOnly}
                  onChange={(event) => setEligibleOnly(event.target.checked)}
                />{' '}
                Gate-passed / ranked only
              </span>
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
                      <span className={styles.explorerTitle}>
                        {item.finalRank != null ? `#${item.finalRank} · ` : ''}
                        {item.title}
                      </span>
                      <span className={styles.explorerMeta}>
                        score {item.compositeScore ?? '—'} · {item.priorityLevel}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.recommendation)}`}>
                          {item.recommendation}
                        </span>
                        <span
                          className={styles.chip}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleCompare(item.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              toggleCompare(item.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          {compareIds.includes(item.id) ? 'Compared' : 'Compare'}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Ranking detail">
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
                      <dt>Final rank</dt>
                      <dd>{selected.finalRank ?? 'UNMEASURED'}</dd>
                    </div>
                    <div>
                      <dt>Composite score</dt>
                      <dd>{selected.compositeScore ?? 'UNMEASURED'}</dd>
                    </div>
                    <div>
                      <dt>Priority</dt>
                      <dd>
                        <span className={`${styles.chip} ${statusTone(selected.priorityLevel)}`}>
                          {selected.priorityLevel}
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
                      <dt>Production ready</dt>
                      <dd>{selected.productionReady ? 'Yes' : 'No'}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>AI summary</h3>
                  <ul className={styles.bulletList}>
                    {selected.explainability.slice(0, 8).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Pool snapshot</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Qualified</dt>
                      <dd>{metrics?.totalQualifiedIdeas ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Ranked</dt>
                      <dd>{metrics?.rankedCount ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Eligible unranked</dt>
                      <dd>{metrics?.eligibleUnranked ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Recommended</dt>
                      <dd>{metrics?.recommendedForProduction ?? 0}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'table' ? (
              <RankingTable items={filtered} onSelect={setSelectedId} />
            ) : null}

            {tab === 'weights' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Configurable weighted ranking model (observe-only)</h3>
                  <p className={styles.lede}>
                    Weights reflect the default qualification model. Editing weights is not available
                    from this section view; re-ranking occurs autonomously when upstream scores
                    change.
                  </p>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Factor</th>
                        <th>Weight %</th>
                        {selected ? <th>Selected value</th> : null}
                        {selected ? <th>Contribution</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {overview.weightModel.map((row) => {
                        const factor = selected?.rankingFactors.find((f) => f.label === row.label);
                        return (
                          <tr key={row.key}>
                            <td>{row.label}</td>
                            <td>{row.weight}</td>
                            {selected ? <td>{factor?.value ?? 'UNMEAS.'}</td> : null}
                            {selected ? <td>{factor?.contribution ?? '—'}</td> : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'portfolio' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Portfolio effect</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Diversity impact</dt>
                      <dd>{selected.portfolioEffect.diversityImpact ?? 'UNMEASURED'}</dd>
                    </div>
                    <div>
                      <dt>Budget fit</dt>
                      <dd>{selected.portfolioEffect.budgetFit ?? 'UNMEASURED'}</dd>
                    </div>
                    <div>
                      <dt>Schedule fit</dt>
                      <dd>{selected.portfolioEffect.scheduleFit ?? 'UNMEASURED'}</dd>
                    </div>
                    <div>
                      <dt>Resource fit</dt>
                      <dd>{selected.portfolioEffect.resourceFit ?? 'UNMEASURED'}</dd>
                    </div>
                    <div>
                      <dt>Estimated ROI</dt>
                      <dd>{selected.portfolioEffect.estimatedRoi ?? 'UNMEASURED'}</dd>
                    </div>
                  </dl>
                  <ul className={styles.bulletList}>
                    {selected.portfolioEffect.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Category diversity</h3>
                  <ul className={styles.bulletList}>
                    {overview.analytics.domainDiversity.slice(0, 10).map((row) => (
                      <li key={row.label}>
                        {row.label}: {row.count} · avg {row.avgScore ?? 'UNMEAS.'}
                      </li>
                    ))}
                  </ul>
                  <p className={styles.lede}>
                    Diversity cap: {overview.meta.diversityCap} per domain|geography
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'compare' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Comparison mode (up to 4)</h3>
                  {!compareRows.length ? (
                    <p className={styles.lede}>
                      Use Compare on explorer cards to add candidates.
                    </p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Metric</th>
                          {compareRows.map((row) => (
                            <th key={row.id}>{row.title}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            ['Rank', (c: RankingCandidate) => c.finalRank],
                            ['Score', (c: RankingCandidate) => c.compositeScore],
                            ['Strategy', (c: RankingCandidate) => c.strategicFit],
                            ['Audience', (c: RankingCandidate) => c.audienceValue],
                            ['Originality', (c: RankingCandidate) => c.originality],
                            ['Evidence', (c: RankingCandidate) => c.evidenceQuality],
                            ['Feasibility', (c: RankingCandidate) => c.productionFeasibility],
                            ['Commercial', (c: RankingCandidate) => c.commercialPotential],
                            ['Risk', (c: RankingCandidate) => c.riskLevel],
                            ['Confidence', (c: RankingCandidate) => c.confidence],
                            ['Priority', (c: RankingCandidate) => c.priorityLevel],
                          ] as Array<[string, (c: RankingCandidate) => string | number | null]>
                        ).map(([label, getter]) => (
                          <tr key={label}>
                            <td>{label}</td>
                            {compareRows.map((row) => (
                              <td key={`${row.id}-${label}`}>{display(getter(row))}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'heatmap' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Score heatmap · {selected.title}</h3>
                  <div className={styles.waterfall}>
                    {selected.heatmap.map((row) => (
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
                        <strong>{row.value ?? 'UNMEAS.'}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'scenarios' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Scenario simulation</h3>
                  <p className={styles.lede}>
                    Non-baseline rows are derived previews from persisted factors — not alternate
                    persisted rankings.
                  </p>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Scenario</th>
                        <th>Rank</th>
                        <th>Score</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.scenarios.map((row) => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td>{row.rank ?? 'UNMEAS.'}</td>
                          <td>{row.score ?? 'UNMEAS.'}</td>
                          <td>{row.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'sensitivity' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Sensitivity analysis</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Factor</th>
                        <th>Delta</th>
                        <th>Effect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.sensitivity.map((row) => (
                        <tr key={row.factor}>
                          <td>{row.factor}</td>
                          <td>{row.delta}</td>
                          <td>{row.effect}</td>
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
                    Explainable ranking · <strong>{selected.recommendation}</strong>
                  </h3>
                  <ul className={styles.bulletList}>
                    {selected.explainability.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className={styles.lede}>
                    Confidence:{' '}
                    {selected.measuredConfidence
                      ? `${selected.confidence}%`
                      : 'UNMEASURED'}{' '}
                    · Model {display(selected.modelVersion)}
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

            {tab === 'tiebreak' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Tie-breaking logic</h3>
                  <ol className={styles.bulletList}>
                    {selected.tieBreakers.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ol>
                </article>
              </div>
            ) : null}

            {tab === 'timeline' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Decision timeline</h3>
                  {!overview.analytics.rankTimeline.length ? (
                    <p className={styles.lede}>No ranked candidates yet.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Title</th>
                          <th>Ranked at</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.analytics.rankTimeline.map((row) => (
                          <tr key={row.id}>
                            <td>#{row.rank}</td>
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
                            <td>{new Date(row.rankedAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'distribution' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
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
                <article className={styles.detailCard}>
                  <h3>Priority distribution</h3>
                  <ul className={styles.bulletList}>
                    {overview.analytics.priorityDistribution.map((row) => (
                      <li key={row.label}>
                        {row.label}: <strong>{row.count}</strong>
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
                    <p className={styles.lede}>No ranking recommendations yet.</p>
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
                      <dt>Rankings persisted</dt>
                      <dd>{overview.governance.rankingsPersisted}</dd>
                    </div>
                    <div>
                      <dt>Decisions logged</dt>
                      <dd>{overview.governance.decisionsLogged}</dd>
                    </div>
                    <div>
                      <dt>Diversity cap</dt>
                      <dd>{overview.governance.diversityCap}</dd>
                    </div>
                    <div>
                      <dt>Ranking model</dt>
                      <dd>{overview.meta.rankingModel}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Approvals</h3>
                  <p className={styles.lede}>
                    Autonomous path: Recommend for Production → Decision Register. Portfolio holds
                    and defers remain observe-only on this page.
                  </p>
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
                  <h3>Trend snapshot</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Top 5 ranked</dt>
                      <dd>{metrics?.topRankedCandidates ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Production ready</dt>
                      <dd>{metrics?.productionReady ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Portfolio diversity</dt>
                      <dd>
                        {metrics?.portfolioDiversity != null
                          ? `${metrics.portfolioDiversity}%`
                          : 'UNMEAS.'}
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Immutable audit trail</h3>
                  {!overview.audit.length ? (
                    <p className={styles.lede}>No ranking-related audit events yet.</p>
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
            ![
              'table',
              'weights',
              'compare',
              'timeline',
              'distribution',
              'recommendations',
              'governance',
              'analytics',
              'audit',
            ].includes(tab) ? (
              <div className={styles.emptyInline}>
                <p>Select a candidate from the Rank Explorer to inspect this panel.</p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className={styles.panel} aria-label="Ranking insights">
          <div className={styles.panelHead}>
            <h2>Insights</h2>
            <span>Observe only</span>
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightStack}>
              <article className={styles.insightCard}>
                <h3>
                  <Trophy size={14} aria-hidden /> Rank
                </h3>
                <p>{selected?.finalRank != null ? `#${selected.finalRank}` : 'UNMEASURED'}</p>
              </article>
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
                  <Target size={14} aria-hidden /> Next stage
                </h3>
                <p>
                  {selected?.recommendation === 'Recommend for Production'
                    ? 'Eligible for Decision Register (autonomous)'
                    : selected?.recommendation === 'Hold for Portfolio Balance'
                      ? 'Held for diversity / portfolio balance'
                      : 'Await ranking or eligibility'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>
                  <BrainCircuit size={14} aria-hidden /> Model
                </h3>
                <p>{selected?.modelVersion ?? overview.meta.rankingModel}</p>
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

function RankingTable({
  items,
  onSelect,
}: {
  items: RankingCandidate[];
  onSelect: (id: string) => void;
}) {
  const sorted = [...items].sort((a, b) => {
    if (a.finalRank == null && b.finalRank == null) {
      return (b.compositeScore ?? 0) - (a.compositeScore ?? 0);
    }
    if (a.finalRank == null) return 1;
    if (b.finalRank == null) return -1;
    return a.finalRank - b.finalRank;
  });

  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>Intelligent ranking table</h3>
        {!sorted.length ? (
          <p className={styles.lede}>No candidates in the filtered set.</p>
        ) : (
          <table className={styles.auditTable}>
            <thead>
              <tr>
                <th>Final Rank</th>
                <th>Title</th>
                <th>Composite</th>
                <th>Strategy</th>
                <th>Audience</th>
                <th>Originality</th>
                <th>Evidence</th>
                <th>Feasibility</th>
                <th>Commercial</th>
                <th>Risk</th>
                <th>Confidence</th>
                <th>Priority</th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <tr key={item.id}>
                  <td>{item.finalRank ?? '—'}</td>
                  <td>
                    <button type="button" className={styles.chip} onClick={() => onSelect(item.id)}>
                      {item.title}
                    </button>
                  </td>
                  <td>{item.compositeScore ?? '—'}</td>
                  <td>{item.strategicFit ?? '—'}</td>
                  <td>{item.audienceValue ?? '—'}</td>
                  <td>{item.originality ?? '—'}</td>
                  <td>{item.evidenceQuality ?? '—'}</td>
                  <td>{item.productionFeasibility ?? '—'}</td>
                  <td>{item.commercialPotential ?? '—'}</td>
                  <td>{item.riskLevel ?? '—'}</td>
                  <td>{item.confidence ?? '—'}</td>
                  <td>
                    <span className={`${styles.chip} ${statusTone(item.priorityLevel)}`}>
                      {item.priorityLevel}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.chip} ${statusTone(item.recommendation)}`}>
                      {item.recommendation}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </div>
  );
}
