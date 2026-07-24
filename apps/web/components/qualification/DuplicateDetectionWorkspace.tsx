'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Copyright,
  Download,
  GitMerge,
  Layers3,
  Scale,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
  Workflow,
  XCircle,
} from 'lucide-react';
import type {
  DuplicateCandidate,
  DuplicateDetectionIQOverview,
} from '@/lib/idea-qualification/duplicates';
import { qualificationApi } from '@/apps/web/lib/qualification-api';
import styles from './duplicate-detection.module.css';

type TabId =
  | 'overview'
  | 'table'
  | 'semantic'
  | 'breakdown'
  | 'compare'
  | 'heatmap'
  | 'graph'
  | 'production'
  | 'research'
  | 'storyline'
  | 'geography'
  | 'timeline'
  | 'audience'
  | 'explain'
  | 'recommendations'
  | 'resolution'
  | 'governance'
  | 'analytics'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'table', label: 'Evaluation Table' },
  { id: 'semantic', label: 'Semantic Matches' },
  { id: 'breakdown', label: 'Similarity Breakdown' },
  { id: 'compare', label: 'Side-by-Side' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'graph', label: 'Knowledge Graph' },
  { id: 'production', label: 'Production Conflict' },
  { id: 'research', label: 'Research Overlap' },
  { id: 'storyline', label: 'Storyline' },
  { id: 'geography', label: 'Geography' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'audience', label: 'Audience' },
  { id: 'explain', label: 'Explainability' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'resolution', label: 'Resolution' },
  { id: 'governance', label: 'Governance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit' },
];

const EMPTY_COPY =
  'The Duplicate Detection Engine automatically compares every qualified documentary candidate against internal content libraries, active production pipelines, research repositories, approved storyboards, and trusted external knowledge sources. Using semantic embeddings, knowledge graph relationships, narrative analysis, and explainable AI, the engine identifies exact duplicates, near-duplicates, conceptual overlaps, and production conflicts before resources are committed. Each candidate receives a Duplicate Risk Score, semantic similarity analysis, overlap explanations, governance records, and AI recommendations. Once qualified ideas reach this stage, duplicate intelligence dashboards and comparison analytics populate automatically.';

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'UNIQUE':
    case 'PROCEED':
    case 'LOW':
    case 'CLEAR':
    case 'HIGH':
    case 'RUNNING':
      return styles.toneReady;
    case 'EXACT_DUPLICATE':
    case 'NEAR_DUPLICATE':
    case 'HIGH_SEMANTIC_OVERLAP':
    case 'REJECT':
    case 'CONFLICT':
    case 'BLOCKING':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'PARTIAL_OVERLAP':
    case 'RELATED_TOPIC':
    case 'COMPLEMENTARY_TOPIC':
    case 'MINOR REVISION':
    case 'MAJOR REVISION':
    case 'MERGE WITH EXISTING PROJECT':
    case 'MEDIUM':
    case 'WARNING':
    case 'PENDING':
    case 'UNMEASURED':
    case 'OBSERVED':
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

function heatBar(value: number | null) {
  if (value == null) return '░'.repeat(10);
  const blocks = Math.max(0, Math.min(10, Math.round(value / 10)));
  return `${'█'.repeat(blocks)}${'░'.repeat(10 - blocks)}`;
}

function exportPayload(overview: DuplicateDetectionIQOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `duplicates-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'id',
    'title',
    'duplicateRisk',
    'similarity',
    'class',
    'internal',
    'external',
    'recommendation',
    'riskLevel',
  ];
  const lines = [
    header.join(','),
    ...overview.candidates.map((item) =>
      [
        item.id,
        JSON.stringify(item.title),
        item.duplicateRisk ?? '',
        item.semanticSimilarity ?? '',
        item.duplicateClass,
        item.internalMatches,
        item.externalMatches,
        JSON.stringify(item.recommendation),
        item.riskLevel,
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `duplicates-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DuplicateDetectionWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<DuplicateDetectionIQOverview | null>(null);
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
        qualificationApi.duplicates(),
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
    () => [...new Set(candidates.map((item) => item.riskLevel))].sort(),
    [candidates],
  );

  const filtered = useMemo(
    () =>
      candidates.filter((item) => {
        if (statusFilter !== 'all' && item.riskLevel !== statusFilter) return false;
        if (!needle) return true;
        const haystack = [
          item.title,
          item.domain,
          item.duplicateClass,
          item.recommendation,
          item.geography,
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
        label: 'Duplicate Risk',
        value: m?.duplicateRisk != null ? `${m.duplicateRisk}%` : 'UNMEAS.',
        meta: 'Avg duplicate risk / similarity',
        accent: '#EF4444',
        icon: ShieldAlert,
        bars: sparkBars(m?.duplicateRisk ?? 0),
        drill: 'explain' as TabId,
      },
      {
        label: 'Semantic Similarity',
        value: m?.semanticSimilarity != null ? `${m.semanticSimilarity}%` : 'UNMEAS.',
        meta: 'duplicateSimilarity / checks',
        accent: '#F97316',
        icon: Layers3,
        bars: sparkBars(m?.semanticSimilarity ?? 0),
        drill: 'semantic' as TabId,
      },
      {
        label: 'Existing Coverage',
        value: m?.existingCoverage != null ? `${m.existingCoverage}%` : 'UNMEAS.',
        meta: 'Coverage / similarity proxy',
        accent: '#F59E0B',
        icon: Target,
        bars: sparkBars(m?.existingCoverage ?? 0),
        drill: 'breakdown' as TabId,
      },
      {
        label: 'Internal Matches',
        value: String(m?.internalMatches ?? 0),
        meta: 'Internal asset comparisons',
        accent: '#2563EB',
        icon: GitMerge,
        bars: sparkBars(m?.internalMatches ?? 0),
        drill: 'semantic' as TabId,
      },
      {
        label: 'External Matches',
        value: String(m?.externalMatches ?? 0),
        meta: 'External catalog comparisons',
        accent: '#0EA5E9',
        icon: Layers3,
        bars: sparkBars(m?.externalMatches ?? 0),
        drill: 'semantic' as TabId,
      },
      {
        label: 'Planned Project Matches',
        value: String(m?.plannedProjectMatches ?? 0),
        meta: 'Pipeline / planned assets',
        accent: '#7C3AED',
        icon: Workflow,
        bars: sparkBars(m?.plannedProjectMatches ?? 0),
        drill: 'production' as TabId,
      },
      {
        label: 'Knowledge Graph Overlap',
        value: m?.knowledgeGraphOverlap != null ? `${m.knowledgeGraphOverlap}%` : 'UNMEAS.',
        meta: 'KG overlap when persisted',
        accent: '#14B8A6',
        icon: BrainCircuit,
        bars: sparkBars(m?.knowledgeGraphOverlap ?? 0),
        drill: 'graph' as TabId,
      },
      {
        label: 'AI Confidence',
        value: m?.aiConfidence != null ? String(m.aiConfidence) : 'UNMEAS.',
        meta: 'Measured candidate confidence',
        accent: '#22C55E',
        icon: CheckCircle2,
        bars: sparkBars(m?.aiConfidence ?? 0),
        drill: 'governance' as TabId,
      },
      {
        label: 'Production Conflict',
        value: String(m?.productionConflicts ?? 0),
        meta: 'Candidates with conflict signals',
        accent: '#EF4444',
        icon: AlertTriangle,
        bars: sparkBars(m?.productionConflicts ?? 0),
        drill: 'production' as TabId,
      },
      {
        label: 'Copyright Risk',
        value: m?.copyrightRisk != null ? String(m.copyrightRisk) : 'UNMEAS.',
        meta: 'IP / copyright assessments',
        accent: '#F97316',
        icon: Copyright,
        bars: sparkBars(m?.copyrightRisk ?? 0),
        drill: 'explain' as TabId,
      },
      {
        label: 'Recommendation',
        value: m?.recommendationRate != null ? `${m.recommendationRate}%` : 'UNMEAS.',
        meta: 'Proceed rate',
        accent: '#2563EB',
        icon: Scale,
        bars: sparkBars(m?.recommendationRate ?? 0),
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
        <p className={styles.crumb}>Idea Qualification / Duplicate Detection</p>
        <h1 className={styles.title}>Enterprise Duplicate Intelligence Centre</h1>
        <section className={styles.unavailable}>
          <AlertTriangle size={18} aria-hidden />
          <div>
            <strong>Duplicate Detection unavailable</strong>
            <p>{overview?.reason || error || 'Unable to load duplicate ledger.'}</p>
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
            Content Lifecycle / 03 Idea Qualification / Duplicate Detection
          </p>
          <h1 className={styles.title}>Enterprise Duplicate Intelligence Centre</h1>
          <p className={styles.lede}>
            Block semantic overlap with published, planned, and in-production content before
            resources are committed.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 03 Duplicates</span>
          <span className={`${styles.badge} ${statusTone(overview?.meta.cycleStatus)}`}>
            Cycle {overview?.meta.cycleStatus ?? 'IDLE'}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Checks {overview?.governance.duplicateChecks ?? 0}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous duplicate governance</strong>
          Comparisons come from persisted <code>iq_duplicate_checks</code> and{' '}
          <code>duplicateSimilarity</code>. External catalog coverage, narrative/timeline overlap,
          and scenario simulation stay UNMEASURED until those payloads are written. Merge / Reject
          are engine recommendations only.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Duplicate KPIs">
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

      <section className={styles.lifecycle} aria-label="Duplicate pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Duplicate detection workflow</h2>
          <span>
            Embedding → Knowledge Graph → Internal → External → Similarity → Classification →
            Recommendation
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
            Duplicate detection starts after Stage 03 candidates receive persisted duplicate checks
            or duplicateSimilarity scores.
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>{EMPTY_COPY}</h2>
            <p className={styles.lede}>
              Candidate → Semantic Embedding → Knowledge Graph → Internal Search → External Search →
              Similarity Analysis → Classification → Proceed / Merge / Reject.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Embed</strong>
              Semantic comparison
            </li>
            <li>
              <strong>2. Search</strong>
              Internal + external
            </li>
            <li>
              <strong>3. Classify</strong>
              Duplicate class
            </li>
            <li>
              <strong>4. Recommend</strong>
              Proceed / merge / reject
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Duplicate workspace">
        <aside className={styles.panel} aria-label="Duplicate Explorer">
          <div className={styles.panelHead}>
            <h2>Duplicate Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Candidate, domain, class, recommendation…"
              />
            </label>
            <label className={styles.field}>
              <span>Duplicate risk</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All risk levels</option>
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
                        sim {item.semanticSimilarity ?? '—'} · {item.recommendation}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.riskLevel)}`}>
                          {item.riskLevel}
                        </span>
                        <span className={`${styles.chip} ${statusTone(item.duplicateClass)}`}>
                          {item.duplicateClass.replaceAll('_', ' ')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Duplicate detail">
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
                      <dt>Similarity</dt>
                      <dd>
                        {selected.semanticSimilarity != null
                          ? `${selected.semanticSimilarity}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Class</dt>
                      <dd>
                        <span className={`${styles.chip} ${statusTone(selected.duplicateClass)}`}>
                          {selected.duplicateClass.replaceAll('_', ' ')}
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
                      <dt>Unique</dt>
                      <dd>{metrics?.uniqueCount ?? 0}</dd>
                    </div>
                    <div>
                      <dt>High risk</dt>
                      <dd>{metrics?.highRiskCount ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Merge / Reject</dt>
                      <dd>
                        {metrics?.mergeCandidates ?? 0} / {metrics?.rejectCandidates ?? 0}
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'table' ? (
              <EvaluationTable items={filtered} onSelect={setSelectedId} />
            ) : null}

            {tab === 'semantic' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Semantic similarity matches</h3>
                  {!selected.matches.length ? (
                    <p className={styles.lede}>No iq_duplicate_checks persisted for this candidate.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Asset type</th>
                          <th>Scope</th>
                          <th>Similarity</th>
                          <th>Blocking</th>
                          <th>Model</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.matches.map((row) => (
                          <tr key={row.id}>
                            <td>{row.assetType}</td>
                            <td>{row.scope}</td>
                            <td>{row.similarity}%</td>
                            <td>{row.blocking ? 'Yes' : 'No'}</td>
                            <td>{row.modelVersion}</td>
                            <td>{display(row.explanation)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'breakdown' && selected ? (
              <MetricBars title="Similarity breakdown" rows={selected.similarityBreakdown} />
            ) : null}

            {tab === 'compare' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Side-by-side comparison</h3>
                  {!selected.closestMatch ? (
                    <p className={styles.lede}>No closest match available yet.</p>
                  ) : (
                    <>
                      <p className={styles.lede}>
                        <strong>{selected.title}</strong> vs{' '}
                        <strong>{selected.closestMatch.title}</strong>
                        {selected.closestMatch.similarity != null
                          ? ` · ${selected.closestMatch.similarity}% similarity`
                          : ' · similarity UNMEASURED'}
                      </p>
                      <table className={styles.auditTable}>
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th>Current idea</th>
                            <th>Closest match</th>
                            <th>Overlap</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.comparisonRows.map((row) => (
                            <tr key={row.field}>
                              <td>{row.field}</td>
                              <td>{row.current}</td>
                              <td>{row.match}</td>
                              <td>
                                <span className={`${styles.chip} ${statusTone(row.overlap)}`}>
                                  {row.overlap}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'heatmap' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Similarity heatmap</h3>
                  <ul className={styles.bulletList}>
                    {selected.similarityHeatmap.map((row) => (
                      <li key={row.label}>
                        <strong>{row.label}</strong>{' '}
                        <span aria-hidden>{heatBar(row.value)}</span>{' '}
                        {row.value != null ? `${row.value}%` : 'UNMEASURED'}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'graph' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Knowledge graph comparison</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Dimension</th>
                        <th>Overlap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.knowledgeGraph.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{row.overlap != null ? `${row.overlap}%` : 'UNMEASURED'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'production' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Internal production conflict</h3>
                  <ul className={styles.bulletList}>
                    {selected.productionConflicts.map((row) => (
                      <li key={row.label}>
                        <span className={`${styles.chip} ${statusTone(row.status)}`}>
                          {row.status}
                        </span>{' '}
                        <strong>{row.label}</strong> — {row.detail}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'research' && selected ? (
              <MetricBars title="Research overlap" rows={selected.researchOverlap} />
            ) : null}

            {tab === 'storyline' && selected ? (
              <MetricBars title="Storyline comparison" rows={selected.storyline} />
            ) : null}

            {tab === 'geography' && selected ? (
              <MetricBars title="Geographic duplication" rows={selected.geographicOverlap} />
            ) : null}

            {tab === 'timeline' && selected ? (
              <MetricBars title="Timeline duplication" rows={selected.timelineOverlap} />
            ) : null}

            {tab === 'audience' && selected ? (
              <MetricBars title="Audience duplication" rows={selected.audienceOverlap} />
            ) : null}

            {tab === 'explain' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    Duplicate Risk{' '}
                    {selected.duplicateRisk != null
                      ? `${selected.duplicateRisk}% (${selected.riskLevel})`
                      : 'UNMEASURED'}
                  </h3>
                  <ul className={styles.bulletList}>
                    {selected.explainability.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className={styles.lede}>
                    Recommendation: <strong>{selected.recommendation}</strong>
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
                    <h3>Duplicate resolution assistant</h3>
                    <ul className={styles.bulletList}>
                      {selected.optimization.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </article>
                ) : null}
              </div>
            ) : null}

            {tab === 'resolution' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Conflict resolution options</h3>
                  <p className={styles.lede}>
                    Options are observe-only. The autonomous engine executes Proceed / Merge /
                    Reject; stage pages do not expose human overrides.
                  </p>
                  <div className={styles.explorerBadges}>
                    {selected.resolutionOptions.map((option) => (
                      <span key={option} className={`${styles.chip} ${styles.toneDraft}`}>
                        {option}
                      </span>
                    ))}
                  </div>
                  <p className={styles.lede} style={{ marginTop: 12 }}>
                    Engine recommendation: <strong>{selected.recommendation}</strong>
                  </p>
                </article>
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
                      <dt>Embedding models</dt>
                      <dd>
                        {overview?.governance.embeddingModels.length
                          ? overview.governance.embeddingModels.join(', ')
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Duplicate checks</dt>
                      <dd>{overview?.governance.duplicateChecks ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Decisions logged</dt>
                      <dd>{overview?.governance.decisionsLogged ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Data sources</dt>
                      <dd>iq_candidates · iq_scores · iq_duplicate_checks · iq_risk_assessments</dd>
                    </div>
                    {selected ? (
                      <>
                        <div>
                          <dt>Candidate confidence</dt>
                          <dd>
                            {selected.measuredConfidence
                              ? measured(selected.confidence)
                              : 'UNMEASURED'}
                          </dd>
                        </div>
                        <div>
                          <dt>Embedding model</dt>
                          <dd>{display(selected.embeddingModel)}</dd>
                        </div>
                      </>
                    ) : null}
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Continuous learning</h3>
                  <p className={styles.lede}>
                    Predicted duplicate risk vs editorial outcomes (override rate, false
                    positives/negatives, production conflicts) remains UNMEASURED until feedback is
                    persisted.
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'analytics' ? (
              <div className={styles.detailGrid}>
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
                  <h3>Similarity bands</h3>
                  <ul className={styles.bulletList}>
                    {overview?.analytics.similarityBands.map((row) => (
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
                  <h3>Topic saturation</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.topicSaturation.length ?? 0) === 0 ? (
                      <li>No topic similarity yet.</li>
                    ) : (
                      overview?.topicSaturation.map((row) => (
                        <li key={row.label}>
                          {row.label}: avg sim{' '}
                          {row.avgSimilarity != null ? `${row.avgSimilarity}%` : 'UNMEAS.'} (
                          {row.count})
                        </li>
                      ))
                    )}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Duplicate classes</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.classDistribution.length ?? 0) === 0 ? (
                      <li>No classifications yet.</li>
                    ) : (
                      overview?.classDistribution.map((row) => (
                        <li key={row.label}>
                          <span className={`${styles.chip} ${statusTone(row.label)}`}>
                            {row.label.replaceAll('_', ' ')}
                          </span>{' '}
                          {row.count}
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
                  <h3>Duplicate audit ledger</h3>
                  {(overview?.audit.length ?? 0) === 0 ? (
                    <p className={styles.lede}>No duplicate-related audit events persisted yet.</p>
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
                <p>Select a candidate to inspect duplicate intelligence.</p>
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
                  {metrics?.semanticSimilarity != null
                    ? `Pool average semantic similarity ${metrics.semanticSimilarity}%.`
                    : 'Awaiting duplicate checks / duplicateSimilarity writes.'}
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
                  <p>No duplicate alerts.</p>
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
                  Unique {metrics?.uniqueCount ?? 0} · High risk {metrics?.highRiskCount ?? 0} ·
                  Merge {metrics?.mergeCandidates ?? 0}
                </p>
              </article>
              {(metrics?.highRiskCount ?? 0) > 0 ? (
                <article className={styles.insightCard}>
                  <h3>
                    <XCircle size={14} aria-hidden /> Overlap pressure
                  </h3>
                  <p>{metrics?.highRiskCount} candidates at high duplicate risk.</p>
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

function EvaluationTable({
  items,
  onSelect,
}: {
  items: DuplicateCandidate[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>Duplicate evaluation</h3>
        <table className={styles.auditTable}>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Risk</th>
              <th>Similarity</th>
              <th>Class</th>
              <th>Internal</th>
              <th>External</th>
              <th>Conflict</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {!items.length ? (
              <tr>
                <td colSpan={8}>
                  <div className={styles.emptyInline}>
                    <p>No candidates in the duplicate ledger.</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} onClick={() => onSelect(item.id)}>
                  <td>{item.title}</td>
                  <td>{item.duplicateRisk ?? '—'}</td>
                  <td>{item.semanticSimilarity ?? '—'}</td>
                  <td>{item.duplicateClass.replaceAll('_', ' ')}</td>
                  <td>{item.internalMatches}</td>
                  <td>{item.externalMatches}</td>
                  <td>{item.productionConflict ? 'Yes' : 'No'}</td>
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
