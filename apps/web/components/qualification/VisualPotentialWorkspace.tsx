'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  Aperture,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Clapperboard,
  Download,
  Film,
  Gauge,
  Image,
  Map,
  Sparkles,
  Timer,
  Workflow,
  XCircle,
} from 'lucide-react';
import type {
  VisualPotentialCandidate,
  VisualPotentialOverview,
} from '@/lib/idea-qualification/visual-potential';
import { qualificationApi } from '@/apps/web/lib/qualification-api';
import styles from './visual-potential.module.css';

type TabId =
  | 'overview'
  | 'table'
  | 'score'
  | 'scenes'
  | 'assets'
  | 'prediction'
  | 'cinema'
  | 'storyboard'
  | 'geography'
  | 'historical'
  | 'imagegen'
  | 'animation'
  | 'characters'
  | 'environments'
  | 'diversity'
  | 'suggestions'
  | 'risks'
  | 'complexity'
  | 'heatmap'
  | 'timeline'
  | 'readiness'
  | 'formats'
  | 'explain'
  | 'recommendations'
  | 'governance'
  | 'analytics'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'table', label: 'Evaluation Table' },
  { id: 'score', label: 'Visual Score' },
  { id: 'scenes', label: 'Scene Opportunities' },
  { id: 'assets', label: 'Visual Assets' },
  { id: 'prediction', label: 'Scene Prediction' },
  { id: 'cinema', label: 'Cinematography' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'geography', label: 'Geography' },
  { id: 'historical', label: 'Historical' },
  { id: 'imagegen', label: 'AI Image Gen' },
  { id: 'animation', label: 'Animation' },
  { id: 'characters', label: 'Characters' },
  { id: 'environments', label: 'Environments' },
  { id: 'diversity', label: 'Diversity' },
  { id: 'suggestions', label: 'Suggestions' },
  { id: 'risks', label: 'Visual Risks' },
  { id: 'complexity', label: 'Complexity' },
  { id: 'heatmap', label: 'Story Heatmap' },
  { id: 'timeline', label: 'Visual Timeline' },
  { id: 'readiness', label: 'Readiness' },
  { id: 'formats', label: 'Multi-Format' },
  { id: 'explain', label: 'Explainability' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'governance', label: 'Governance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit' },
];

const EMPTY_COPY =
  'The Visual Potential Engine automatically evaluates whether each qualified documentary idea can be transformed into compelling cinematic storytelling. It analyses scene opportunities, historical reconstruction possibilities, geographic visualization, AI image generation readiness, animation requirements, archive availability, interview potential, and cinematographic richness. Using predictive visual intelligence and explainable AI, the engine generates a Visual Potential Score, estimates production complexity, recommends the most effective visual approach, and identifies any limitations before the project enters Script & Narrative and Storyboarding. Once qualified ideas reach this stage, visual analytics, scene forecasts, storyboard recommendations, and AI-generated production insights populate automatically.';

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'EXCELLENT':
    case 'GOOD':
    case 'PROCEED':
    case 'STRONG':
    case 'DETECTED':
    case 'RECOMMENDED':
    case 'EVALUATED':
    case 'OBSERVED':
    case 'SCORED':
    case 'LOW':
    case 'RUNNING':
      return styles.toneReady;
    case 'NOT_READY':
    case 'REJECT':
    case 'WEAK':
    case 'HIGH':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'MARGINAL':
    case 'REVISE VISUAL APPROACH':
    case 'INCREASE ANIMATION':
    case 'ACQUIRE ARCHIVE ASSETS':
    case 'MODERATE':
    case 'ELEVATED':
    case 'PENDING':
    case 'PENDING_MODEL':
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

function heatBar(value: number | null) {
  if (value == null) return '░'.repeat(10);
  const blocks = Math.max(0, Math.min(10, Math.round(value / 10)));
  return `${'█'.repeat(blocks)}${'░'.repeat(10 - blocks)}`;
}

function exportPayload(overview: VisualPotentialOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `visual-potential-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'id',
    'title',
    'visualScore',
    'sceneCoverage',
    'archive',
    'animation',
    'band',
    'recommendation',
  ];
  const lines = [
    header.join(','),
    ...overview.candidates.map((item) =>
      [
        item.id,
        JSON.stringify(item.title),
        item.visualPotentialScore ?? '',
        item.sceneCoverage ?? '',
        item.archiveFootageAvailability ?? '',
        item.animationRequirement ?? '',
        item.readinessBand,
        JSON.stringify(item.recommendation),
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `visual-potential-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function VisualPotentialWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<VisualPotentialOverview | null>(null);
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
        qualificationApi.visualPotential(),
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
        label: 'Visual Potential Score',
        value: m?.averageVisualPotential != null ? `${m.averageVisualPotential}%` : 'UNMEAS.',
        meta: 'visualPotential factor avg',
        accent: '#2563EB',
        icon: Aperture,
        bars: sparkBars(m?.averageVisualPotential ?? 0),
        drill: 'score' as TabId,
      },
      {
        label: 'Scene Coverage',
        value: m?.sceneCoverage != null ? `${m.sceneCoverage}%` : 'UNMEAS.',
        meta: 'Scene coverage signals',
        accent: '#0EA5E9',
        icon: Film,
        bars: sparkBars(m?.sceneCoverage ?? 0),
        drill: 'scenes' as TabId,
      },
      {
        label: 'AI Image Readiness',
        value: m?.aiImageReadiness != null ? `${m.aiImageReadiness}%` : 'UNMEAS.',
        meta: 'Nested image-gen readiness',
        accent: '#7C3AED',
        icon: Image,
        bars: sparkBars(m?.aiImageReadiness ?? 0),
        drill: 'imagegen' as TabId,
      },
      {
        label: 'Archive Footage',
        value:
          m?.archiveFootageAvailability != null
            ? `${m.archiveFootageAvailability}%`
            : 'UNMEAS.',
        meta: 'Archive / source availability',
        accent: '#F59E0B',
        icon: Clapperboard,
        bars: sparkBars(m?.archiveFootageAvailability ?? 0),
        drill: 'assets' as TabId,
      },
      {
        label: 'Animation Requirement',
        value: m?.animationRequirement != null ? `${m.animationRequirement}%` : 'UNMEAS.',
        meta: 'Animation need signal',
        accent: '#14B8A6',
        icon: Sparkles,
        bars: sparkBars(m?.animationRequirement ?? 0),
        drill: 'animation' as TabId,
      },
      {
        label: 'Map Opportunity',
        value: m?.mapOpportunity != null ? `${m.mapOpportunity}%` : 'UNMEAS.',
        meta: 'Map / regional visual opportunity',
        accent: '#22C55E',
        icon: Map,
        bars: sparkBars(m?.mapOpportunity ?? 0),
        drill: 'geography' as TabId,
      },
      {
        label: 'Timeline Opportunity',
        value: m?.timelineOpportunity != null ? `${m.timelineOpportunity}%` : 'UNMEAS.',
        meta: 'Timeline visualization signal',
        accent: '#F97316',
        icon: Timer,
        bars: sparkBars(m?.timelineOpportunity ?? 0),
        drill: 'timeline' as TabId,
      },
      {
        label: 'Character Visualization',
        value:
          m?.characterVisualization != null ? `${m.characterVisualization}%` : 'UNMEAS.',
        meta: 'Character visualization payload',
        accent: '#2563EB',
        icon: Gauge,
        bars: sparkBars(m?.characterVisualization ?? 0),
        drill: 'characters' as TabId,
      },
      {
        label: 'Geographic Visualization',
        value:
          m?.geographicVisualization != null
            ? `${m.geographicVisualization}%`
            : 'UNMEAS.',
        meta: 'Geographic visual signal',
        accent: '#0EA5E9',
        icon: Map,
        bars: sparkBars(m?.geographicVisualization ?? 0),
        drill: 'geography' as TabId,
      },
      {
        label: 'Historical Reconstruction',
        value:
          m?.historicalReconstruction != null
            ? `${m.historicalReconstruction}%`
            : 'UNMEAS.',
        meta: 'Reconstruction readiness',
        accent: '#7C3AED',
        icon: Film,
        bars: sparkBars(m?.historicalReconstruction ?? 0),
        drill: 'historical' as TabId,
      },
      {
        label: 'Cinematic Quality',
        value: m?.cinematicQuality != null ? `${m.cinematicQuality}%` : 'UNMEAS.',
        meta: 'Cinematic quality prediction',
        accent: '#EF4444',
        icon: Aperture,
        bars: sparkBars(m?.cinematicQuality ?? 0),
        drill: 'cinema' as TabId,
      },
      {
        label: 'Overall Recommendation',
        value: m?.proceedRate != null ? `${m.proceedRate}%` : 'UNMEAS.',
        meta: 'Proceed rate',
        accent: '#22C55E',
        icon: CheckCircle2,
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
        <p className={styles.crumb}>Idea Qualification / Visual Potential</p>
        <h1 className={styles.title}>Enterprise Visual Intelligence Centre</h1>
        <section className={styles.unavailable}>
          <AlertTriangle size={18} aria-hidden />
          <div>
            <strong>Visual Potential unavailable</strong>
            <p>{overview?.reason || error || 'Unable to load visual potential ledger.'}</p>
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
            Content Lifecycle / 03 Idea Qualification / Visual Potential
          </p>
          <h1 className={styles.title}>Enterprise Visual Intelligence Centre</h1>
          <p className={styles.lede}>
            Verify that the idea can support credible scenes, evidence, and cinematography before
            Script &amp; Narrative.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 03 Visual</span>
          <span className={`${styles.badge} ${statusTone(overview?.meta.cycleStatus)}`}>
            Cycle {overview?.meta.cycleStatus ?? 'IDLE'}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Strong {overview?.metrics.excellentCount ?? 0}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous visual readiness</strong>
          Scores come from persisted <code>iq_scores.visualPotential</code> and optional nested
          visual meta. Scene counts, shot inventories, rendering hours, and engagement predictors
          stay UNMEASURED until those models write payloads. Proceed / Revise / Reject are engine
          recommendations only.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Visual KPIs">
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

      <section className={styles.lifecycle} aria-label="Visual potential pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Visual potential workflow</h2>
          <span>
            Scenes → Assets → Cinematography → Animation → Storyboard → Complexity → Score →
            Proceed / Revise / Reject
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
            Visual scoring starts after Stage 03 candidates receive persisted visualPotential
            factors and related visual meta.
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>{EMPTY_COPY}</h2>
            <p className={styles.lede}>
              Qualified Idea → Scene Discovery → Visual Assets → Cinematography → Animation →
              Storyboard → Complexity → Visual Potential Score → Proceed / Revise / Reject.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Discover</strong>
              Scene opportunities
            </li>
            <li>
              <strong>2. Assess</strong>
              Assets &amp; cinematography
            </li>
            <li>
              <strong>3. Plan</strong>
              Animation &amp; storyboard
            </li>
            <li>
              <strong>4. Decide</strong>
              Visual readiness gate
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Visual potential workspace">
        <aside className={styles.panel} aria-label="Visual Explorer">
          <div className={styles.panelHead}>
            <h2>Visual Explorer</h2>
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
                        {item.visualPotentialScore != null
                          ? `${item.visualPotentialScore}%`
                          : 'UNMEAS.'}{' '}
                        · {item.recommendation}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.readinessBand)}`}>
                          {item.readinessBand}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Visual detail">
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
                      <dt>Visual score</dt>
                      <dd>
                        {selected.visualPotentialScore != null
                          ? `${selected.visualPotentialScore}%`
                          : 'UNMEASURED'}
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
                      <dt>Strong</dt>
                      <dd>{metrics?.excellentCount ?? 0}</dd>
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
                    Visual Potential{' '}
                    {selected.visualPotentialScore != null
                      ? `${selected.visualPotentialScore}%`
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
                  <MetricBars inline rows={selected.productionReadiness} />
                </article>
              </div>
            ) : null}

            {tab === 'scenes' && selected ? (
              <SignalList title="Scene opportunity detection" items={selected.sceneOpportunities} />
            ) : null}

            {tab === 'assets' && selected ? (
              <>
                <SignalList title="Visual asset availability" items={selected.visualAssets} />
                <div className={styles.detailGrid}>
                  <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                    <h3>Asset recommendation engine</h3>
                    <ul className={styles.bulletList}>
                      {selected.assetRecommendations.map((row) => (
                        <li key={row.label}>
                          <span className={`${styles.chip} ${statusTone(row.status)}`}>
                            {row.status}
                          </span>{' '}
                          {row.label}
                        </li>
                      ))}
                    </ul>
                  </article>
                </div>
              </>
            ) : null}

            {tab === 'prediction' && selected ? (
              <MetricBars title="AI scene prediction" rows={selected.scenePrediction} />
            ) : null}

            {tab === 'cinema' && selected ? (
              <MetricBars title="Cinematography assessment" rows={selected.cinematography} />
            ) : null}

            {tab === 'storyboard' && selected ? (
              <MetricBars title="Storyboard readiness" rows={selected.storyboard} />
            ) : null}

            {tab === 'geography' && selected ? (
              <SignalList title="Geographic visualization" items={selected.geographic} />
            ) : null}

            {tab === 'historical' && selected ? (
              <SignalList title="Historical reconstruction" items={selected.historical} />
            ) : null}

            {tab === 'imagegen' && selected ? (
              <MetricBars title="AI image generation readiness" rows={selected.imageGeneration} />
            ) : null}

            {tab === 'animation' && selected ? (
              <SignalList title="Animation opportunities" items={selected.animation} />
            ) : null}

            {tab === 'characters' && selected ? (
              <SignalList title="Character visualization" items={selected.characters} />
            ) : null}

            {tab === 'environments' && selected ? (
              <SignalList title="Environment analysis" items={selected.environments} />
            ) : null}

            {tab === 'diversity' && selected ? (
              <MetricBars title="Visual diversity" rows={selected.visualDiversity} />
            ) : null}

            {tab === 'suggestions' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>AI production suggestions</h3>
                  <ul className={styles.bulletList}>
                    {selected.suggestions.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'risks' && selected ? (
              <SignalList title="Visual risk assessment" items={selected.visualRisks} />
            ) : null}

            {tab === 'complexity' && selected ? (
              <MetricBars title="Production complexity" rows={selected.productionComplexity} />
            ) : null}

            {tab === 'heatmap' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Storytelling heat map</h3>
                  <ul className={styles.bulletList}>
                    {selected.storytellingHeatmap.map((row) => (
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

            {tab === 'timeline' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Visual timeline</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Phase</th>
                        <th>Treatment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.visualTimeline.map((row) => (
                        <tr key={row.phase}>
                          <td>{row.phase}</td>
                          <td>{row.treatment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'readiness' && selected ? (
              <MetricBars title="Production readiness" rows={selected.productionReadiness} />
            ) : null}

            {tab === 'formats' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Multi-format production readiness</h3>
                  <ul className={styles.bulletList}>
                    {selected.multiFormat.map((row) => (
                      <li key={row.format}>
                        <span className={`${styles.chip} ${statusTone(row.status)}`}>
                          {row.status}
                        </span>{' '}
                        <strong>{row.format}</strong> — {row.detail}
                      </li>
                    ))}
                  </ul>
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
              </div>
            ) : null}

            {tab === 'governance' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>AI governance</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Visual model versions</dt>
                      <dd>
                        {overview?.governance.modelVersions.length
                          ? overview.governance.modelVersions.join(', ')
                          : '—'}
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
                      <dt>Data sources</dt>
                      <dd>iq_candidates · iq_scores · iq_risk_assessments · iq_audit_events</dd>
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
                    Predicted vs actual visual quality, scene count, animation usage, cost, and
                    engagement remain UNMEASURED until post-production outcomes are persisted.
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
                  <h3>Domain visual strength</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.analytics.domainVisuals.length ?? 0) === 0 ? (
                      <li>No scored domains yet.</li>
                    ) : (
                      overview?.analytics.domainVisuals.map((row) => (
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
                  <h3>Visual audit ledger</h3>
                  {(overview?.audit.length ?? 0) === 0 ? (
                    <p className={styles.lede}>No visual-related audit events persisted yet.</p>
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
                <p>Select a candidate to inspect visual potential.</p>
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
                  {metrics?.averageVisualPotential != null
                    ? `Pool average visual potential ${metrics.averageVisualPotential}%.`
                    : 'Awaiting visualPotential factor writes from the qualification cycle.'}
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
                  <p>No visual alerts.</p>
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
                  Strong {metrics?.excellentCount ?? 0} · Revise {metrics?.reviseCount ?? 0} ·
                  Reject {metrics?.rejectCount ?? 0}
                </p>
              </article>
              {(metrics?.rejectCount ?? 0) > 0 ? (
                <article className={styles.insightCard}>
                  <h3>
                    <XCircle size={14} aria-hidden /> Visual pressure
                  </h3>
                  <p>{metrics?.rejectCount} candidates below visual readiness thresholds.</p>
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
  inline,
}: {
  title?: string;
  rows: Array<{ label: string; value: number | null }>;
  inline?: boolean;
}) {
  const body = (
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
  );
  if (inline) return body;
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>{title}</h3>
        {body}
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
  items: VisualPotentialCandidate[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>Visual potential evaluation</h3>
        <table className={styles.auditTable}>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Visual Score</th>
              <th>Scenes</th>
              <th>Archive</th>
              <th>Animation</th>
              <th>Maps</th>
              <th>Band</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {!items.length ? (
              <tr>
                <td colSpan={8}>
                  <div className={styles.emptyInline}>
                    <p>No candidates in the visual potential ledger.</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} onClick={() => onSelect(item.id)}>
                  <td>{item.title}</td>
                  <td>{item.visualPotentialScore ?? '—'}</td>
                  <td>{item.sceneCoverage ?? '—'}</td>
                  <td>{item.archiveFootageAvailability ?? '—'}</td>
                  <td>{item.animationRequirement ?? '—'}</td>
                  <td>{item.mapOpportunity ?? '—'}</td>
                  <td>{item.readinessBand}</td>
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
