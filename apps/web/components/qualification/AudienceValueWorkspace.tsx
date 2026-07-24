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
  Globe2,
  GraduationCap,
  Layers3,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Users,
  Workflow,
  XCircle,
} from 'lucide-react';
import type {
  AudienceValueCandidate,
  AudienceValueOverview,
} from '@/lib/idea-qualification/audience-value';
import { qualificationApi } from '@/apps/web/lib/qualification-api';
import styles from './audience-value.module.css';

type TabId =
  | 'overview'
  | 'table'
  | 'score'
  | 'segments'
  | 'personas'
  | 'demand'
  | 'education'
  | 'engagement'
  | 'retention'
  | 'commercial'
  | 'accessibility'
  | 'geography'
  | 'platforms'
  | 'knowledge'
  | 'explain'
  | 'recommendations'
  | 'governance'
  | 'analytics'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'table', label: 'Evaluation Table' },
  { id: 'score', label: 'AI Score' },
  { id: 'segments', label: 'Segmentation' },
  { id: 'personas', label: 'Personas' },
  { id: 'demand', label: 'Demand' },
  { id: 'education', label: 'Educational' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'retention', label: 'Retention' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'geography', label: 'Geography' },
  { id: 'platforms', label: 'Platforms' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'explain', label: 'Explainability' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'governance', label: 'Governance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit' },
];

const EMPTY_COPY =
  'The Audience Value Engine automatically evaluates every qualified documentary candidate to determine the measurable value it will deliver to its intended audiences. The engine predicts educational impact, engagement, audience demand, commercial appeal, accessibility, platform suitability, retention, and long-term knowledge contribution. Each candidate receives an explainable AI Audience Value Score with detailed reasoning, audience segmentation, demand forecasting, and optimization recommendations. When candidate ideas arrive from previous qualification steps, this view will populate automatically with dashboards, analytics, predictive insights, and governance records.';

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'HIGH_VALUE':
    case 'APPROVE FOR AUDIENCE GATE':
    case 'EVALUATED':
    case 'HIGH':
    case 'RUNNING':
    case 'QUALIFIED':
      return styles.toneReady;
    case 'LOW_VALUE':
    case 'REJECT':
    case 'FAILED':
    case 'CRITICAL':
    case 'LOW':
      return styles.toneBlocked;
    case 'NEEDS_OPTIMIZATION':
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

function exportPayload(overview: AudienceValueOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `audience-value-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'id',
    'title',
    'audienceValue',
    'educational',
    'commercial',
    'engagement',
    'accessibility',
    'retention',
    'priority',
    'status',
  ];
  const lines = [
    header.join(','),
    ...overview.candidates.map((item) =>
      [
        item.id,
        JSON.stringify(item.title),
        item.audienceValueScore ?? '',
        item.educationalValue ?? '',
        item.commercialAppeal ?? '',
        item.engagementPotential ?? '',
        item.accessibilityScore ?? '',
        item.retentionScore ?? '',
        item.priority,
        item.valueStatus,
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `audience-value-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AudienceValueWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<AudienceValueOverview | null>(null);
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
        qualificationApi.audienceValue(),
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
    () => [...new Set(candidates.map((item) => item.valueStatus))].sort(),
    [candidates],
  );

  const filtered = useMemo(
    () =>
      candidates.filter((item) => {
        if (statusFilter !== 'all' && item.valueStatus !== statusFilter) return false;
        if (!needle) return true;
        const haystack = [
          item.title,
          item.domain,
          item.audience,
          item.geography,
          item.valueStatus,
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
        label: 'Audience Value Score',
        value: m?.averageAudienceValue != null ? `${m.averageAudienceValue}%` : 'UNMEAS.',
        meta: 'audienceValue factor avg',
        accent: '#2563EB',
        icon: Target,
        bars: sparkBars(m?.averageAudienceValue ?? 0),
        drill: 'score' as TabId,
      },
      {
        label: 'Predicted Reach',
        value: m?.predictedReach != null ? String(m.predictedReach) : 'UNMEAS.',
        meta: 'Nested reach model only',
        accent: '#0EA5E9',
        icon: Globe2,
        bars: sparkBars(m?.predictedReach ?? 0),
        drill: 'demand' as TabId,
      },
      {
        label: 'Estimated Watch Time',
        value: m?.estimatedWatchTime != null ? String(m.estimatedWatchTime) : 'UNMEAS.',
        meta: 'No fabricated watch curves',
        accent: '#F97316',
        icon: Timer,
        bars: sparkBars(m?.estimatedWatchTime ?? 0),
        drill: 'engagement' as TabId,
      },
      {
        label: 'Audience Satisfaction',
        value: m?.audienceSatisfaction != null ? `${m.audienceSatisfaction}%` : 'UNMEAS.',
        meta: 'Persisted satisfaction only',
        accent: '#22C55E',
        icon: Gauge,
        bars: sparkBars(m?.audienceSatisfaction ?? 0),
        drill: 'explain' as TabId,
      },
      {
        label: 'Educational Impact',
        value: m?.educationalImpact != null ? `${m.educationalImpact}%` : 'UNMEAS.',
        meta: 'educationalValue avg',
        accent: '#7C3AED',
        icon: GraduationCap,
        bars: sparkBars(m?.educationalImpact ?? 0),
        drill: 'education' as TabId,
      },
      {
        label: 'Commercial Appeal',
        value: m?.commercialAppeal != null ? String(m.commercialAppeal) : 'UNMEAS.',
        meta: 'Commercial / audience factors',
        accent: '#F59E0B',
        icon: TrendingUp,
        bars: sparkBars(m?.commercialAppeal ?? 0),
        drill: 'commercial' as TabId,
      },
      {
        label: 'Viral Potential',
        value: m?.viralPotential != null ? String(m.viralPotential) : 'UNMEAS.',
        meta: 'Nested virality only',
        accent: '#EF4444',
        icon: Sparkles,
        bars: sparkBars(m?.viralPotential ?? 0),
        drill: 'engagement' as TabId,
      },
      {
        label: 'Audience Diversity',
        value: m?.audienceDiversity != null ? `${m.audienceDiversity}%` : 'UNMEAS.',
        meta: 'Diversity payload when present',
        accent: '#14B8A6',
        icon: Users,
        bars: sparkBars(m?.audienceDiversity ?? 0),
        drill: 'segments' as TabId,
      },
      {
        label: 'Accessibility Score',
        value: m?.accessibilityScore != null ? `${m.accessibilityScore}%` : 'UNMEAS.',
        meta: 'Accessibility model output',
        accent: '#2563EB',
        icon: ShieldCheck,
        bars: sparkBars(m?.accessibilityScore ?? 0),
        drill: 'accessibility' as TabId,
      },
      {
        label: 'Global Coverage',
        value: m?.globalCoverage != null ? `${m.globalCoverage}%` : 'UNMEAS.',
        meta: 'Coverage factor when persisted',
        accent: '#0EA5E9',
        icon: Globe2,
        bars: sparkBars(m?.globalCoverage ?? 0),
        drill: 'geography' as TabId,
      },
      {
        label: 'Audience Retention',
        value: m?.audienceRetention != null ? `${m.audienceRetention}%` : 'UNMEAS.',
        meta: 'Retention / completion factors',
        accent: '#22C55E',
        icon: Gauge,
        bars: sparkBars(m?.audienceRetention ?? 0),
        drill: 'retention' as TabId,
      },
      {
        label: 'Recommendation Score',
        value: m?.recommendationScore != null ? `${m.recommendationScore}%` : 'UNMEAS.',
        meta: 'Aligned to audience value avg',
        accent: '#7C3AED',
        icon: Scale,
        bars: sparkBars(m?.recommendationScore ?? 0),
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
        <p className={styles.crumb}>Idea Qualification / Audience Value</p>
        <h1 className={styles.title}>Enterprise Audience Intelligence Centre</h1>
        <section className={styles.unavailable}>
          <AlertTriangle size={18} aria-hidden />
          <div>
            <strong>Audience Value unavailable</strong>
            <p>{overview?.reason || error || 'Unable to load audience value ledger.'}</p>
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
        ['Educational Value', selected.educationalValue],
        ['Commercial Appeal', selected.commercialAppeal],
        ['Engagement Potential', selected.engagementPotential],
        ['Retention', selected.retentionScore],
        ['Accessibility', selected.accessibilityScore],
        ['Regional Relevance', selected.regionalRelevance],
        ['Visual Potential', selected.visualPotential],
      ]
    : [];

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 03 Idea Qualification / Audience Value
          </p>
          <h1 className={styles.title}>Enterprise Audience Intelligence Centre</h1>
          <p className={styles.lede}>
            Assess demand, usefulness, learning outcomes, and measurable audience benefit before
            Research & Evidence.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 03 Audience</span>
          <span className={`${styles.badge} ${statusTone(overview?.meta.cycleStatus)}`}>
            Cycle {overview?.meta.cycleStatus ?? 'IDLE'}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Model {overview?.meta.audienceModelVersion ?? '—'}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous audience valuation</strong>
          Scores come from persisted <code>iq_scores</code> factors (
          <code>audienceValue</code>, <code>educationalValue</code>,{' '}
          <code>regionalRelevance</code>). CTR, watch curves, sentiment, and platform forecasts stay
          UNMEASURED until those models write nested payloads. No human Approve/Reject on this page.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Audience KPIs">
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

      <section className={styles.lifecycle} aria-label="Audience value pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Audience value workflow</h2>
          <span>
            Identify → Segment → Educational → Commercial → Engagement → Accessibility → Score →
            Approval
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
            Audience valuation starts after Stage 03 candidates receive persisted audience scoring
            from the qualification cycle.
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>{EMPTY_COPY}</h2>
            <p className={styles.lede}>
              Qualified Candidate → Audience Identification → Segmentation → Educational Impact →
              Commercial Value → Engagement Prediction → Accessibility → Audience Value Score →
              Approval.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Identify</strong>
              Target audiences
            </li>
            <li>
              <strong>2. Score</strong>
              Multi-dimension value
            </li>
            <li>
              <strong>3. Forecast</strong>
              Engagement & retention
            </li>
            <li>
              <strong>4. Optimize</strong>
              Accessibility & narrative
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Audience value workspace">
        <aside className={styles.panel} aria-label="Audience Explorer">
          <div className={styles.panelHead}>
            <h2>Audience Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Candidate, audience, geography, recommendation…"
              />
            </label>
            <label className={styles.field}>
              <span>Value status</span>
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
                        {item.audience ?? 'Unspecified'} ·{' '}
                        {item.audienceValueScore != null
                          ? `${item.audienceValueScore}%`
                          : 'UNMEAS.'}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.valueStatus)}`}>
                          {item.valueStatus}
                        </span>
                        <span className={`${styles.chip} ${statusTone(item.priority)}`}>
                          {item.priority}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Audience detail">
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
                      <dt>Audience</dt>
                      <dd>{display(selected.audience)}</dd>
                    </div>
                    <div>
                      <dt>Geography</dt>
                      <dd>{display(selected.geography)}</dd>
                    </div>
                    <div>
                      <dt>Domain</dt>
                      <dd>{selected.domain}</dd>
                    </div>
                    <div>
                      <dt>Audience value</dt>
                      <dd>
                        {selected.audienceValueScore != null
                          ? `${selected.audienceValueScore}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <span className={`${styles.chip} ${statusTone(selected.valueStatus)}`}>
                          {selected.valueStatus}
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
                      <dt>Total candidates</dt>
                      <dd>{metrics?.totalCandidates ?? 0}</dd>
                    </div>
                    <div>
                      <dt>High value</dt>
                      <dd>{metrics?.highValue ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Needs optimization</dt>
                      <dd>{metrics?.needsOptimization ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Low value</dt>
                      <dd>{metrics?.lowValue ?? 0}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'table' ? <EvaluationTable items={filtered} onSelect={setSelectedId} /> : null}

            {tab === 'score' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    Audience Value{' '}
                    {selected.audienceValueScore != null
                      ? `${selected.audienceValueScore}%`
                      : 'UNMEASURED'}
                  </h3>
                  <div className={styles.waterfall}>
                    {scoreRows.map(([label, value]) => (
                      <div key={String(label)} className={styles.waterfallRow}>
                        <span>{label}</span>
                        <div className={styles.radarBar}>
                          <i
                            className={styles.radarFill}
                            style={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%` }}
                          />
                        </div>
                        <strong>{value != null ? `${value}%` : 'UNMEAS.'}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'segments' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Audience segmentation</h3>
                  {(overview?.segmentDistribution.length ?? 0) === 0 ? (
                    <p className={styles.lede}>No audience labels persisted yet.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Segment</th>
                          <th>Candidates</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview?.segmentDistribution.map((row) => (
                          <tr key={row.label}>
                            <td>{row.label}</td>
                            <td>{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'personas' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Persona matching</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Persona</th>
                        <th>Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.personas.map((row) => (
                        <tr key={row.persona}>
                          <td>{row.persona}</td>
                          <td>{row.match != null ? `${row.match}%` : 'UNMEASURED'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'demand' && selected ? (
              <MetricBars title="Audience demand analysis" rows={selected.demand} />
            ) : null}

            {tab === 'education' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Educational impact</h3>
                  <div className={styles.waterfall}>
                    {selected.educational.map((row) => (
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
                <article className={styles.detailCard}>
                  <h3>Learning outcome matrix</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Learning objective</th>
                        <th>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.learningOutcomes.map((row) => (
                        <tr key={row.objective}>
                          <td>{row.objective}</td>
                          <td>
                            {row.confidence != null ? `${row.confidence}%` : 'UNMEASURED'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'engagement' && selected ? (
              <MetricBars title="Engagement prediction" rows={selected.engagement} />
            ) : null}

            {tab === 'retention' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Retention forecast</h3>
                  <p className={styles.lede}>
                    Curve points stay UNMEASURED unless a retention payload is persisted on{' '}
                    <code>iq_scores</code>.
                  </p>
                  <div className={styles.waterfall}>
                    {selected.retentionCurve.map((point) => (
                      <div key={point.minute} className={styles.waterfallRow}>
                        <span>{point.minute} min</span>
                        <div className={styles.radarBar}>
                          <i
                            className={styles.radarFill}
                            style={{
                              width: `${Math.max(0, Math.min(100, point.retentionPct ?? 0))}%`,
                            }}
                          />
                        </div>
                        <strong>
                          {point.retentionPct != null ? `${point.retentionPct}%` : 'UNMEAS.'}
                        </strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'commercial' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Commercial audience value</h3>
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

            {tab === 'accessibility' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Accessibility analysis</h3>
                  <ul className={styles.bulletList}>
                    {selected.accessibility.map((check) => (
                      <li key={check.label}>
                        <span className={`${styles.chip} ${statusTone(check.status)}`}>
                          {check.status}
                        </span>{' '}
                        <strong>{check.label}</strong> — {check.detail}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'geography' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Geographic coverage</h3>
                  {(overview?.geographicCoverage.length ?? 0) === 0 ? (
                    <p className={styles.lede}>No geography labels persisted.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Region</th>
                          <th>Candidates</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview?.geographicCoverage.map((row) => (
                          <tr key={row.label}>
                            <td>{row.label}</td>
                            <td>{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
                {selected ? (
                  <article className={styles.detailCard}>
                    <h3>Candidate geography</h3>
                    <ul className={styles.bulletList}>
                      {selected.geographyBreakdown.map((row) => (
                        <li key={row.label}>
                          {row.label}: {row.value != null ? `${row.value}%` : 'UNMEASURED'}
                        </li>
                      ))}
                    </ul>
                  </article>
                ) : null}
              </div>
            ) : null}

            {tab === 'platforms' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Platform suitability</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Platform</th>
                        <th>Suitability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.platforms.map((row) => (
                        <tr key={row.platform}>
                          <td>{row.platform}</td>
                          <td>
                            {row.suitability != null ? `${row.suitability}%` : 'UNMEASURED'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'knowledge' && selected ? (
              <div className={styles.detailGrid}>
                <MetricBars title="Knowledge value" rows={selected.knowledge} />
                <article className={styles.detailCard}>
                  <h3>Sentiment prediction</h3>
                  <ul className={styles.bulletList}>
                    {selected.sentiment.map((row) => (
                      <li key={row.label}>
                        {row.label}: {row.value != null ? `${row.value}%` : 'UNMEASURED'}
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Audience heatmaps</h3>
                  {selected.heatmaps.map((heat) => (
                    <div key={heat.dimension} style={{ marginBottom: 16 }}>
                      <strong>{heat.dimension}</strong>
                      <ul className={styles.bulletList}>
                        {heat.buckets.map((bucket) => (
                          <li key={`${heat.dimension}-${bucket.label}`}>
                            {bucket.label}:{' '}
                            {bucket.value != null ? `${bucket.value}%` : 'UNMEASURED'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </article>
              </div>
            ) : null}

            {tab === 'explain' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    Audience Score{' '}
                    {selected.audienceValueScore != null
                      ? `${selected.audienceValueScore}%`
                      : 'UNMEASURED'}
                  </h3>
                  <ul className={styles.bulletList}>
                    {selected.explainability.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Audience lifecycle</h3>
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
                  <h3>Engine recommendation</h3>
                  <p className={styles.lede}>
                    <strong>{selected.recommendation}</strong>. Manual Approve / Hold / Reject
                    actions are not exposed on stage pages.
                  </p>
                  <div className={styles.explorerBadges}>
                    <span className={`${styles.chip} ${statusTone(selected.valueStatus)}`}>
                      {selected.valueStatus}
                    </span>
                    <span className={`${styles.chip} ${statusTone(selected.priority)}`}>
                      {selected.priority}
                    </span>
                  </div>
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
                    <h3>Value optimization assistant</h3>
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
                      <dt>Audience model version</dt>
                      <dd>{display(overview?.governance.audienceModelVersion)}</dd>
                    </div>
                    <div>
                      <dt>Model versions</dt>
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
                      <dd>iq_candidates · iq_scores · iq_audit_events</dd>
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
                      </>
                    ) : null}
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Continuous learning</h3>
                  <p className={styles.lede}>
                    Predicted vs actual watch time, completion, growth, revenue, and learning impact
                    remain UNMEASURED until post-publication feedback is persisted.
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'analytics' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Value distribution</h3>
                  <ul className={styles.bulletList}>
                    {overview?.analytics.valueDistribution.map((row) => (
                      <li key={row.label}>
                        {row.label}: {row.count}
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Domain demand</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.analytics.domainDemand.length ?? 0) === 0 ? (
                      <li>No scored domains yet.</li>
                    ) : (
                      overview?.analytics.domainDemand.map((row) => (
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
                  <h3>Audience audit ledger</h3>
                  {(overview?.audit.length ?? 0) === 0 ? (
                    <p className={styles.lede}>No audience-related audit events persisted yet.</p>
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

            {!selected && tab !== 'table' && tab !== 'segments' && tab !== 'geography' && tab !== 'recommendations' && tab !== 'governance' && tab !== 'analytics' && tab !== 'audit' ? (
              <div className={styles.emptyInline}>
                <BrainCircuit size={18} aria-hidden />
                <p>Select a candidate to inspect audience valuation detail.</p>
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
                  {metrics?.averageAudienceValue != null
                    ? `Pool average audience value ${metrics.averageAudienceValue}%.`
                    : 'Awaiting audienceValue factor writes from the qualification cycle.'}
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
                  <p>No audience alerts.</p>
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
                  High value {metrics?.highValue ?? 0} · Optimize {metrics?.needsOptimization ?? 0}{' '}
                  · Low {metrics?.lowValue ?? 0}
                </p>
              </article>
              {(metrics?.lowValue ?? 0) > 0 ? (
                <article className={styles.insightCard}>
                  <h3>
                    <XCircle size={14} aria-hidden /> Low-value pressure
                  </h3>
                  <p>{metrics?.lowValue} candidates scored below audience thresholds.</p>
                </article>
              ) : null}
              <article className={styles.insightCard}>
                <h3>
                  <Layers3 size={14} aria-hidden /> Segments observed
                </h3>
                <p>{overview?.segmentDistribution.length ?? 0} audience segment labels in pool.</p>
              </article>
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
  items: AudienceValueCandidate[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>Audience value evaluation</h3>
        <table className={styles.auditTable}>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Audience Score</th>
              <th>Educational</th>
              <th>Commercial</th>
              <th>Engagement</th>
              <th>Accessibility</th>
              <th>Retention</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!items.length ? (
              <tr>
                <td colSpan={9}>
                  <div className={styles.emptyInline}>
                    <p>No candidates in the audience value ledger.</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} onClick={() => onSelect(item.id)}>
                  <td>{item.title}</td>
                  <td>{item.audienceValueScore ?? '—'}</td>
                  <td>{item.educationalValue ?? '—'}</td>
                  <td>{item.commercialAppeal ?? '—'}</td>
                  <td>{item.engagementPotential ?? '—'}</td>
                  <td>{item.accessibilityScore ?? '—'}</td>
                  <td>{item.retentionScore ?? '—'}</td>
                  <td>{item.priority}</td>
                  <td>
                    <span className={`${styles.chip} ${statusTone(item.valueStatus)}`}>
                      {item.valueStatus}
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
