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
  Fingerprint,
  Gauge,
  Layers3,
  Lightbulb,
  Scale,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
  Workflow,
  XCircle,
} from 'lucide-react';
import type {
  OriginalityCandidate,
  OriginalityOverview,
} from '@/lib/idea-qualification/originality';
import { qualificationApi } from '@/apps/web/lib/qualification-api';
import styles from './originality.module.css';

type TabId =
  | 'overview'
  | 'table'
  | 'score'
  | 'semantic'
  | 'coverage'
  | 'novelty'
  | 'perspective'
  | 'knowledge'
  | 'copyright'
  | 'graph'
  | 'heatmap'
  | 'duplicates'
  | 'gaps'
  | 'innovation'
  | 'competitive'
  | 'explain'
  | 'recommendations'
  | 'governance'
  | 'analytics'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'table', label: 'Evaluation Table' },
  { id: 'score', label: 'AI Score' },
  { id: 'semantic', label: 'Semantic' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'novelty', label: 'Novelty' },
  { id: 'perspective', label: 'Perspective' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'copyright', label: 'Copyright' },
  { id: 'graph', label: 'Knowledge Graph' },
  { id: 'heatmap', label: 'Novelty Heatmap' },
  { id: 'duplicates', label: 'Duplicate Class' },
  { id: 'gaps', label: 'Research Gaps' },
  { id: 'innovation', label: 'Innovation' },
  { id: 'competitive', label: 'Competitive' },
  { id: 'explain', label: 'Explainability' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'governance', label: 'Governance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit' },
];

const EMPTY_COPY =
  'The Originality Analysis Engine automatically evaluates every qualified documentary candidate to determine its novelty, distinctiveness, knowledge contribution, semantic uniqueness, and intellectual property compliance. The engine compares each idea against internal content libraries, external publications, knowledge graphs, research repositories, and publicly available documentary sources to identify overlaps, uncover unique perspectives, and measure genuine innovation. Each candidate receives an explainable AI Originality Score, semantic similarity analysis, copyright assessment, novelty insights, and editorial recommendations. Once qualified ideas enter this stage, originality dashboards, comparison analytics, governance records, and AI explanations will populate automatically.';

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'ORIGINAL':
    case 'COMPLETELY_ORIGINAL':
    case 'STRONG':
    case 'LOW':
    case 'PROCEED — DISTINCTIVE CONTRIBUTION':
    case 'EDITORIAL CLEAR — DISTINCTIVE ANGLE':
    case 'OBSERVED':
    case 'EVALUATED':
    case 'HIGH':
    case 'RUNNING':
      return styles.toneReady;
    case 'OVERLAP_RISK':
    case 'EXACT_DUPLICATE':
    case 'HIGH_SEMANTIC_OVERLAP':
    case 'HIGH_RISK':
    case 'CRITICAL':
    case 'REJECT — EXACT DUPLICATE':
    case 'WEAK':
      return styles.toneBlocked;
    case 'NEEDS_DIFFERENTIATION':
    case 'MODERATE_OVERLAP':
    case 'RELATED_TOPIC':
    case 'COMPLEMENTARY_TOPIC':
    case 'PENDING':
    case 'MODERATE':
    case 'ELEVATED':
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

function heatBar(value: number | null) {
  if (value == null) return '░'.repeat(10);
  const blocks = Math.max(0, Math.min(10, Math.round(value / 10)));
  return `${'█'.repeat(blocks)}${'░'.repeat(10 - blocks)}`;
}

function exportPayload(overview: OriginalityOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `originality-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'id',
    'title',
    'originality',
    'novelty',
    'similarity',
    'knowledge',
    'copyright',
    'class',
    'status',
  ];
  const lines = [
    header.join(','),
    ...overview.candidates.map((item) =>
      [
        item.id,
        JSON.stringify(item.title),
        item.originalityScore ?? '',
        item.noveltyIndex ?? '',
        item.similarityIndex ?? '',
        item.knowledgeContribution ?? '',
        item.copyrightRisk ?? '',
        item.duplicateClass,
        item.originalityStatus,
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `originality-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function OriginalityWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<OriginalityOverview | null>(null);
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
        qualificationApi.originality(),
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
    () => [...new Set(candidates.map((item) => item.originalityStatus))].sort(),
    [candidates],
  );

  const filtered = useMemo(
    () =>
      candidates.filter((item) => {
        if (statusFilter !== 'all' && item.originalityStatus !== statusFilter) return false;
        if (!needle) return true;
        const haystack = [
          item.title,
          item.domain,
          item.geography,
          item.originalityStatus,
          item.duplicateClass,
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

  const kpis = useMemo(() => {
    const m = metrics;
    return [
      {
        label: 'Originality Score',
        value: m?.averageOriginality != null ? `${m.averageOriginality}%` : 'UNMEAS.',
        meta: 'originality factor avg',
        accent: '#2563EB',
        icon: Fingerprint,
        bars: sparkBars(m?.averageOriginality ?? 0),
        drill: 'score' as TabId,
      },
      {
        label: 'Novelty Index',
        value: m?.noveltyIndex != null ? `${m.noveltyIndex}%` : 'UNMEAS.',
        meta: 'Novelty / originality signals',
        accent: '#7C3AED',
        icon: Lightbulb,
        bars: sparkBars(m?.noveltyIndex ?? 0),
        drill: 'novelty' as TabId,
      },
      {
        label: 'Similarity Index',
        value: m?.similarityIndex != null ? `${m.similarityIndex}%` : 'UNMEAS.',
        meta: 'duplicateSimilarity / checks',
        accent: '#EF4444',
        icon: Layers3,
        bars: sparkBars(m?.similarityIndex ?? 0),
        drill: 'semantic' as TabId,
      },
      {
        label: 'Knowledge Contribution',
        value: m?.knowledgeContribution != null ? `${m.knowledgeContribution}%` : 'UNMEAS.',
        meta: 'educational / knowledge factors',
        accent: '#0EA5E9',
        icon: BrainCircuit,
        bars: sparkBars(m?.knowledgeContribution ?? 0),
        drill: 'knowledge' as TabId,
      },
      {
        label: 'Unique Perspective',
        value: m?.uniquePerspective != null ? `${m.uniquePerspective}%` : 'UNMEAS.',
        meta: 'Nested perspective payload',
        accent: '#14B8A6',
        icon: Target,
        bars: sparkBars(m?.uniquePerspective ?? 0),
        drill: 'perspective' as TabId,
      },
      {
        label: 'Copyright Risk',
        value: m?.copyrightRisk != null ? String(m.copyrightRisk) : 'UNMEAS.',
        meta: 'IP / copyright risk assessments',
        accent: '#F97316',
        icon: Copyright,
        bars: sparkBars(m?.copyrightRisk ?? 0),
        drill: 'copyright' as TabId,
      },
      {
        label: 'Existing Coverage',
        value: m?.existingCoverage != null ? `${m.existingCoverage}%` : 'UNMEAS.',
        meta: 'Coverage / similarity proxy',
        accent: '#F59E0B',
        icon: Gauge,
        bars: sparkBars(m?.existingCoverage ?? 0),
        drill: 'coverage' as TabId,
      },
      {
        label: 'Innovation Score',
        value: m?.innovationScore != null ? `${m.innovationScore}%` : 'UNMEAS.',
        meta: 'Innovation blend when measured',
        accent: '#22C55E',
        icon: Sparkles,
        bars: sparkBars(m?.innovationScore ?? 0),
        drill: 'innovation' as TabId,
      },
      {
        label: 'Research Uniqueness',
        value: m?.researchUniqueness != null ? `${m.researchUniqueness}%` : 'UNMEAS.',
        meta: 'Research uniqueness signals',
        accent: '#2563EB',
        icon: Lightbulb,
        bars: sparkBars(m?.researchUniqueness ?? 0),
        drill: 'gaps' as TabId,
      },
      {
        label: 'AI Confidence',
        value: m?.aiConfidence != null ? String(m.aiConfidence) : 'UNMEAS.',
        meta: 'Measured candidate confidence',
        accent: '#7C3AED',
        icon: ShieldAlert,
        bars: sparkBars(m?.aiConfidence ?? 0),
        drill: 'governance' as TabId,
      },
      {
        label: 'Editorial Recommendation',
        value:
          m?.editorialRecommendationRate != null
            ? `${m.editorialRecommendationRate}%`
            : 'UNMEAS.',
        meta: 'ORIGINAL / total',
        accent: '#22C55E',
        icon: Scale,
        bars: sparkBars(m?.editorialRecommendationRate ?? 0),
        drill: 'recommendations' as TabId,
      },
      {
        label: 'Production Readiness',
        value: m?.productionReadiness != null ? `${m.productionReadiness}%` : 'UNMEAS.',
        meta: 'feasibility factor avg',
        accent: '#0EA5E9',
        icon: CheckCircle2,
        bars: sparkBars(m?.productionReadiness ?? 0),
        drill: 'explain' as TabId,
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
        <p className={styles.crumb}>Idea Qualification / Originality Analysis</p>
        <h1 className={styles.title}>Enterprise Originality Intelligence Centre</h1>
        <section className={styles.unavailable}>
          <AlertTriangle size={18} aria-hidden />
          <div>
            <strong>Originality Analysis unavailable</strong>
            <p>{overview?.reason || error || 'Unable to load originality ledger.'}</p>
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

  const scoreRows = selected
    ? [
        ['Novelty', selected.noveltyIndex],
        ['Perspective', selected.uniquePerspective],
        ['Knowledge Contribution', selected.knowledgeContribution],
        ['Similarity Risk', selected.similarityIndex],
        ['Innovation', selected.innovationScore],
        ['Research Uniqueness', selected.researchUniqueness],
      ]
    : [];

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
            Content Lifecycle / 03 Idea Qualification / Originality Analysis
          </p>
          <h1 className={styles.title}>Enterprise Originality Intelligence Centre</h1>
          <p className={styles.lede}>
            Evaluate novelty, distinct angle, and contribution beyond existing coverage — not just
            plagiarism.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 03 Originality</span>
          <span className={`${styles.badge} ${statusTone(overview?.meta.cycleStatus)}`}>
            Cycle {overview?.meta.cycleStatus ?? 'IDLE'}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Embed {overview?.meta.embeddingModels[0] ?? '—'}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous originality governance</strong>
          Scores come from persisted <code>iq_scores.originality</code>,{' '}
          <code>duplicateSimilarity</code>, and <code>iq_duplicate_checks</code>. External catalog
          coverage, scenario simulation, and post-publication learning stay UNMEASURED until those
          payloads are written. No human Approve/Reject on this page.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Originality KPIs">
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

      <section className={styles.lifecycle} aria-label="Originality pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Originality workflow</h2>
          <span>
            Semantic → Knowledge Graph → Coverage → Novelty → Copyright → Knowledge → Score →
            Proceed
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
            Originality analysis starts after Stage 03 candidates receive persisted originality
            scores and/or duplicate checks.
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>{EMPTY_COPY}</h2>
            <p className={styles.lede}>
              Qualified Candidate → Semantic Comparison → Knowledge Graph → Coverage → Novelty →
              Copyright → Knowledge Contribution → Originality Score → Proceed.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Compare</strong>
              Semantic similarity
            </li>
            <li>
              <strong>2. Detect</strong>
              Novelty signals
            </li>
            <li>
              <strong>3. Protect</strong>
              Copyright / IP
            </li>
            <li>
              <strong>4. Decide</strong>
              Originality gate
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Originality workspace">
        <aside className={styles.panel} aria-label="Originality Explorer">
          <div className={styles.panelHead}>
            <h2>Originality Explorer</h2>
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
              <span>Originality status</span>
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
                        {item.originalityScore != null
                          ? `${item.originalityScore}%`
                          : 'UNMEAS.'}{' '}
                        · sim {item.similarityIndex ?? '—'}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.originalityStatus)}`}>
                          {item.originalityStatus}
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

        <section className={`${styles.panel} ${styles.center}`} aria-label="Originality detail">
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
                      <dt>Geography</dt>
                      <dd>{display(selected.geography)}</dd>
                    </div>
                    <div>
                      <dt>Originality</dt>
                      <dd>
                        {selected.originalityScore != null
                          ? `${selected.originalityScore}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Duplicate class</dt>
                      <dd>
                        <span className={`${styles.chip} ${statusTone(selected.duplicateClass)}`}>
                          {selected.duplicateClass.replaceAll('_', ' ')}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <span
                          className={`${styles.chip} ${statusTone(selected.originalityStatus)}`}
                        >
                          {selected.originalityStatus}
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
                      <dt>Original</dt>
                      <dd>{metrics?.originalCount ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Needs differentiation</dt>
                      <dd>{metrics?.needsDifferentiation ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Overlap risk</dt>
                      <dd>{metrics?.overlapRisk ?? 0}</dd>
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
                    Originality{' '}
                    {selected.originalityScore != null
                      ? `${selected.originalityScore}%`
                      : 'UNMEASURED'}
                  </h3>
                  <div className={styles.waterfall}>
                    {scoreRows.map(([label, value]) => (
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
                        <strong>{value != null ? `${value}%` : 'UNMEAS.'}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'semantic' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Semantic similarity engine</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Similarity</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.semanticSources.map((row) => (
                        <tr key={`${row.source}-${row.detail}`}>
                          <td>{row.source}</td>
                          <td>
                            {row.similarity != null ? `${row.similarity}%` : 'UNMEASURED'}
                          </td>
                          <td>{row.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'coverage' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Existing coverage analysis</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Coverage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.coverage.map((row) => (
                        <tr key={row.source}>
                          <td>{row.source}</td>
                          <td>{row.coverage != null ? `${row.coverage}%` : 'UNMEASURED'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'novelty' && selected ? (
              <SignalList title="Novelty detection" items={selected.noveltySignals} />
            ) : null}

            {tab === 'perspective' && selected ? (
              <SignalList title="Perspective analysis" items={selected.perspectives} />
            ) : null}

            {tab === 'knowledge' && selected ? (
              <MetricBars title="Knowledge contribution" rows={selected.knowledge} />
            ) : null}

            {tab === 'copyright' && selected ? (
              <SignalList title="Copyright & IP risk" items={selected.copyright} />
            ) : null}

            {tab === 'graph' && selected ? (
              <SignalList title="Knowledge graph comparison" items={selected.knowledgeGraph} />
            ) : null}

            {tab === 'heatmap' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Novelty heatmap</h3>
                  <ul className={styles.bulletList}>
                    {selected.noveltyHeatmap.map((row) => (
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

            {tab === 'duplicates' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Duplicate intelligence (pool)</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.duplicateClassDistribution.length ?? 0) === 0 ? (
                      <li>No classifications yet.</li>
                    ) : (
                      overview?.duplicateClassDistribution.map((row) => (
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
                {selected ? (
                  <article className={styles.detailCard}>
                    <h3>Selected comparisons</h3>
                    {!selected.duplicates.length ? (
                      <p className={styles.lede}>No iq_duplicate_checks for this candidate.</p>
                    ) : (
                      <table className={styles.auditTable}>
                        <thead>
                          <tr>
                            <th>Asset type</th>
                            <th>Similarity</th>
                            <th>Blocking</th>
                            <th>Model</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.duplicates.map((row) => (
                            <tr key={row.id}>
                              <td>{row.assetType}</td>
                              <td>{row.similarity}%</td>
                              <td>{row.blocking ? 'Yes' : 'No'}</td>
                              <td>{row.modelVersion}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </article>
                ) : null}
              </div>
            ) : null}

            {tab === 'gaps' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Research gap detection</h3>
                  <ul className={styles.bulletList}>
                    {selected.researchGaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'innovation' && selected ? (
              <MetricBars title="Innovation assessment" rows={selected.innovation} />
            ) : null}

            {tab === 'competitive' && selected ? (
              <MetricBars title="Competitive originality benchmark" rows={selected.competitive} />
            ) : null}

            {tab === 'explain' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    Originality Score{' '}
                    {selected.originalityScore != null
                      ? `${selected.originalityScore}%`
                      : 'UNMEASURED'}
                  </h3>
                  <ul className={styles.bulletList}>
                    {selected.explainability.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
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
                <article className={styles.detailCard}>
                  <h3>Editorial recommendation</h3>
                  <p className={styles.lede}>
                    <strong>{selected.editorialRecommendation}</strong>
                  </p>
                  <p className={styles.lede}>
                    Engine action: <strong>{selected.recommendation}</strong>. Manual overrides are
                    not exposed on stage pages.
                  </p>
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
                    <h3>Innovation opportunity engine</h3>
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
                      <dt>Audit events</dt>
                      <dd>{overview?.governance.auditEvents ?? 0}</dd>
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
                          <dt>Candidate model</dt>
                          <dd>{display(selected.modelVersion)}</dd>
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
                    Predicted vs actual originality (viewer feedback, citations, media mentions,
                    educational adoption) remains UNMEASURED until post-publication outcomes are
                    persisted.
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'analytics' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Originality distribution</h3>
                  <ul className={styles.bulletList}>
                    {overview?.analytics.originalityDistribution.map((row) => (
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
                  <h3>Copyright risk bands</h3>
                  <ul className={styles.bulletList}>
                    {overview?.analytics.copyrightRiskBands.map((row) => (
                      <li key={row.label}>
                        {row.label}: {row.count}
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Novelty by domain</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.domainNovelty.length ?? 0) === 0 ? (
                      <li>No scored domains yet.</li>
                    ) : (
                      overview?.domainNovelty.map((row) => (
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
                  <h3>Originality audit ledger</h3>
                  {(overview?.audit.length ?? 0) === 0 ? (
                    <p className={styles.lede}>No originality-related audit events persisted yet.</p>
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
                <p>Select a candidate to inspect originality detail.</p>
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
                  {metrics?.averageOriginality != null
                    ? `Pool average originality ${metrics.averageOriginality}%.`
                    : 'Awaiting originality factor / duplicate-check writes.'}
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
                  <p>No originality alerts.</p>
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
                  Original {metrics?.originalCount ?? 0} · Differentiate{' '}
                  {metrics?.needsDifferentiation ?? 0} · Overlap {metrics?.overlapRisk ?? 0}
                </p>
              </article>
              {(metrics?.overlapRisk ?? 0) > 0 ? (
                <article className={styles.insightCard}>
                  <h3>
                    <XCircle size={14} aria-hidden /> Overlap pressure
                  </h3>
                  <p>{metrics?.overlapRisk} candidates flagged for semantic / duplicate risk.</p>
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
  items: OriginalityCandidate[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>Originality evaluation</h3>
        <table className={styles.auditTable}>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Originality</th>
              <th>Novelty</th>
              <th>Similarity</th>
              <th>Knowledge</th>
              <th>Copyright</th>
              <th>Class</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!items.length ? (
              <tr>
                <td colSpan={8}>
                  <div className={styles.emptyInline}>
                    <p>No candidates in the originality ledger.</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} onClick={() => onSelect(item.id)}>
                  <td>{item.title}</td>
                  <td>{item.originalityScore ?? '—'}</td>
                  <td>{item.noveltyIndex ?? '—'}</td>
                  <td>{item.similarityIndex ?? '—'}</td>
                  <td>{item.knowledgeContribution ?? '—'}</td>
                  <td>{item.copyrightRisk ?? '—'}</td>
                  <td>{item.duplicateClass.replaceAll('_', ' ')}</td>
                  <td>
                    <span className={`${styles.chip} ${statusTone(item.originalityStatus)}`}>
                      {item.originalityStatus}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </article>
    </div>
  );
}
