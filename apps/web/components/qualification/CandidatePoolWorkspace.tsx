'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Download,
  Eye,
  FileSearch,
  Gauge,
  Layers3,
  Lightbulb,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Workflow,
} from 'lucide-react';
import type {
  CandidatePoolOverview,
  PoolCandidate,
} from '@/lib/idea-qualification/candidate-pool';
import { qualificationApi } from '@/apps/web/lib/qualification-api';
import styles from './candidate-pool.module.css';

type TabId =
  | 'overview'
  | 'grid'
  | 'scorecard'
  | 'explain'
  | 'lifecycle'
  | 'knowledge'
  | 'audience'
  | 'commercial'
  | 'production'
  | 'risks'
  | 'compare'
  | 'recommendations'
  | 'analytics'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'grid', label: 'Candidate Grid' },
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'explain', label: 'Explainability' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'audience', label: 'Audience' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'production', label: 'Production' },
  { id: 'risks', label: 'Risk' },
  { id: 'compare', label: 'Compare' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit' },
];

const EMPTY_COPY =
  'The Candidate Pool is the central workspace where every intelligence-derived idea is evaluated before progressing to Research & Evidence. As verified candidate packages arrive from Content Intelligence, each idea is automatically assessed for strategic alignment, evidence quality, originality, audience value, commercial potential, production feasibility, visual richness, and overall readiness. Once processing begins, this page will present ranked candidates, explainable AI decisions, qualification analytics, governance records, and recommendations for the next stage of the autonomous content lifecycle.';

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'QUALIFIED':
    case 'SELECTED':
    case 'HANDED_OFF':
    case 'PASSED':
    case 'PROCEED TO RESEARCH':
    case 'RUNNING':
    case 'ACKNOWLEDGED':
      return styles.toneReady;
    case 'REJECTED':
    case 'FAILED':
    case 'BLOCKED':
    case 'CRITICAL':
    case 'REJECT':
      return styles.toneBlocked;
    case 'RECEIVED':
    case 'NORMALISING':
    case 'EVALUATING':
    case 'PENDING':
    case 'WARNING':
    case 'REQUEST MORE EVIDENCE':
    case 'DELAY':
    case 'ESCALATE FOR REVIEW':
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

function exportPayload(overview: CandidatePoolOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `candidate-pool-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'rank',
    'title',
    'topic',
    'status',
    'score',
    'confidence',
    'strategyFit',
    'nextStage',
  ];
  const lines = [
    header.join(','),
    ...overview.candidates.map((item) =>
      [
        item.rank ?? '',
        JSON.stringify(item.title),
        JSON.stringify(item.topic),
        item.status,
        item.score,
        item.confidence,
        item.strategyFit ?? '',
        JSON.stringify(item.nextStage),
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `candidate-pool-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CandidatePoolWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<CandidatePoolOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
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
        qualificationApi.candidatePool(),
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
    () => [...new Set(candidates.map((item) => item.status))].sort(),
    [candidates],
  );
  const topics = useMemo(
    () => [...new Set(candidates.map((item) => item.topic))].sort(),
    [candidates],
  );

  const filtered = useMemo(
    () =>
      candidates.filter((item) => {
        if (statusFilter !== 'all' && item.status !== statusFilter) return false;
        if (topicFilter !== 'all' && item.topic !== topicFilter) return false;
        if (!needle) return true;
        const haystack = [
          item.title,
          item.summary,
          item.topic,
          item.audience,
          item.region,
          item.status,
          item.discoveryRunId,
          item.strategyVersionId,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      }),
    [candidates, needle, statusFilter, topicFilter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    candidates.find((item) => item.id === selectedId) ??
    null;
  const compare =
    candidates.find((item) => item.id === compareId && item.id !== selected?.id) ?? null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const maxTopic = Math.max(
    1,
    ...(overview?.analytics.topicDistribution.map((item) => item.count) ?? [1]),
  );

  const kpis = useMemo(() => {
    const m = metrics;
    return [
      {
        label: 'Total Candidate Ideas',
        value: String(m?.totalCandidates ?? 0),
        meta: 'Persisted iq_candidates',
        accent: '#2563EB',
        icon: Lightbulb,
        bars: sparkBars(m?.totalCandidates ?? 0),
        drill: 'grid' as TabId,
      },
      {
        label: 'New Today',
        value: String(m?.newToday ?? 0),
        meta: 'Created since UTC midnight',
        accent: '#0EA5E9',
        icon: Sparkles,
        bars: sparkBars(m?.newToday ?? 0),
        drill: 'grid' as TabId,
      },
      {
        label: 'Under Qualification',
        value: String(m?.underQualification ?? 0),
        meta: 'Received / normalising / evaluating',
        accent: '#F59E0B',
        icon: Eye,
        bars: sparkBars(m?.underQualification ?? 0),
        drill: 'grid' as TabId,
      },
      {
        label: 'Passed',
        value: String(m?.passed ?? 0),
        meta: 'Qualified / selected / handed off',
        accent: '#22C55E',
        icon: CheckCircle2,
        bars: sparkBars(m?.passed ?? 0),
        drill: 'grid' as TabId,
      },
      {
        label: 'Rejected',
        value: String(m?.rejected ?? 0),
        meta: 'Rejected status',
        accent: '#EF4444',
        icon: ShieldAlert,
        bars: sparkBars(m?.rejected ?? 0),
        drill: 'grid' as TabId,
      },
      {
        label: 'Escalated',
        value: String(m?.escalated ?? 0),
        meta: 'Blocked candidates',
        accent: '#F97316',
        icon: AlertTriangle,
        bars: sparkBars(m?.escalated ?? 0),
        drill: 'risks' as TabId,
      },
      {
        label: 'Awaiting Evidence',
        value: String(m?.awaitingEvidence ?? 0),
        meta: 'Weak or missing evidence checks',
        accent: '#F59E0B',
        icon: FileSearch,
        bars: sparkBars(m?.awaitingEvidence ?? 0),
        drill: 'scorecard' as TabId,
      },
      {
        label: 'AI Confidence',
        value: m?.aiConfidence != null ? `${m.aiConfidence}%` : 'UNMEAS.',
        meta: 'Avg measured confidence',
        accent: '#7C3AED',
        icon: Gauge,
        bars: sparkBars(m?.aiConfidence ?? 0),
        drill: 'explain' as TabId,
      },
      {
        label: 'Avg Qualification Time',
        value:
          m?.averageQualificationTimeMs != null
            ? `${Math.round(m.averageQualificationTimeMs / 1000)}s`
            : 'UNMEAS.',
        meta: 'Created → updated on closed ideas',
        accent: '#64748B',
        icon: Timer,
        bars: sparkBars(m?.averageQualificationTimeMs ?? 0),
        drill: 'analytics' as TabId,
      },
      {
        label: 'Commercial Score',
        value: m?.commercialScore != null ? `${m.commercialScore}` : 'UNMEAS.',
        meta: 'From audience value factors',
        accent: '#F97316',
        icon: TrendingUp,
        bars: sparkBars(m?.commercialScore ?? 0),
        drill: 'commercial' as TabId,
      },
      {
        label: 'Production Readiness',
        value: m?.productionReadiness != null ? `${m.productionReadiness}` : 'UNMEAS.',
        meta: 'Feasibility factor avg',
        accent: '#14B8A6',
        icon: ClipboardList,
        bars: sparkBars(m?.productionReadiness ?? 0),
        drill: 'production' as TabId,
      },
      {
        label: 'Strategy Alignment',
        value: m?.strategyAlignment != null ? `${m.strategyAlignment}%` : 'UNMEAS.',
        meta: 'strategicFit avg',
        accent: '#2563EB',
        icon: Target,
        bars: sparkBars(m?.strategyAlignment ?? 0),
        drill: 'scorecard' as TabId,
      },
      {
        label: 'Audience Match',
        value: m?.audienceMatch != null ? `${m.audienceMatch}%` : 'UNMEAS.',
        meta: 'audienceValue avg',
        accent: '#0EA5E9',
        icon: TrendingUp,
        bars: sparkBars(m?.audienceMatch ?? 0),
        drill: 'audience' as TabId,
      },
      {
        label: 'Duplicate Rate',
        value: m?.duplicateRate != null ? `${m.duplicateRate}%` : 'UNMEAS.',
        meta: 'Similarity ≥ 65%',
        accent: '#EF4444',
        icon: Layers3,
        bars: sparkBars(m?.duplicateRate ?? 0),
        drill: 'analytics' as TabId,
      },
      {
        label: 'Research Ready',
        value: String(m?.researchReady ?? 0),
        meta: 'Qualified / selected / handed off',
        accent: '#22C55E',
        icon: ShieldCheck,
        bars: sparkBars(m?.researchReady ?? 0),
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

  if (error || (overview && !overview.available)) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Idea Qualification / Candidate Pool</p>
        <h1 className={styles.title}>Candidate Pool Command Workspace</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Candidate Pool unavailable</h2>
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
  const scorecardRows = selected
    ? [
        ['Strategy Fit', selected.strategyFit],
        ['Audience Value', selected.audienceValue],
        ['Originality', selected.originality],
        ['Evidence Quality', selected.evidenceQuality],
        ['Commercial Value', selected.commercialValue],
        ['Production Readiness', selected.productionReadiness],
        ['Visual Potential', selected.visualPotential],
        ['Evergreen Potential', selected.evergreenPotential],
        ['Educational Value', selected.educationalValue],
        ['Risk Score', selected.riskScore],
      ]
    : [];

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 03 Idea Qualification / Candidate Pool
          </p>
          <h1 className={styles.title}>Candidate Pool Command Workspace</h1>
          <p className={styles.lede}>
            Inspect every received idea without losing source-run traceability — ranked,
            explainable, and ready for Research & Evidence when qualification completes.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 03 Pool</span>
          <span className={`${styles.badge} ${statusTone(overview?.meta.cycleStatus)}`}>
            Cycle {overview?.meta.cycleStatus ?? 'IDLE'}
          </span>
          <span className={`${styles.badge} ${statusTone(overview?.meta.intakeStatus)}`}>
            Intake {overview?.meta.intakeStatus ?? 'PENDING'}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous qualification queue</strong>
          Candidates are reconstructed from persisted <code>iq_candidates</code> with scores,
          evidence, duplicates, and risks. Commercial forecasts and audience personas stay
          UNMEASURED until those fields are written.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Candidate KPIs">
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

      <section className={styles.lifecycle} aria-label="Qualification branch pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Qualification evaluation flow</h2>
          <span>
            Intake → Pool → Evidence → Fit → Audience → Originality → Duplicates → Feasibility →
            Visual → Research
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
            <strong>Waiting for Intelligence Intake</strong>
            The candidate pool opens after a checksum-verified Content Intelligence package is
            acknowledged.
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>{EMPTY_COPY}</h2>
            <p className={styles.lede}>
              Content Intelligence → Intake → Candidate Pool → Evidence / Fit / Audience /
              Originality / Feasibility / Visual → Research & Evidence.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Rank</strong>
              Pool every received idea
            </li>
            <li>
              <strong>2. Score</strong>
              Strategy, evidence, audience
            </li>
            <li>
              <strong>3. Explain</strong>
              AI qualification reasons
            </li>
            <li>
              <strong>4. Promote</strong>
              Research-ready concepts
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Candidate pool workspace">
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
                placeholder="Title, topic, audience, run, strategy…"
              />
            </label>
            <label className={styles.field}>
              <span>Status</span>
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
            <label className={styles.field}>
              <span>Topic</span>
              <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}>
                <option value="all">All topics</option>
                {topics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
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
                        setTab('explain');
                      }}
                    >
                      <span className={styles.explorerTitle}>
                        #{item.rank ?? '—'} {item.title}
                      </span>
                      <span className={styles.explorerMeta}>
                        {item.topic}
                        {item.audience ? ` · ${item.audience}` : ''} · score{' '}
                        {item.measuredScore ? item.score : 'UNMEAS.'}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                        <span className={`${styles.chip} ${statusTone(item.gateStatus)}`}>
                          {item.gateStatus}
                        </span>
                        <button
                          type="button"
                          className={styles.chip}
                          onClick={(event) => {
                            event.stopPropagation();
                            setCompareId(item.id === compareId ? null : item.id);
                            setTab('compare');
                          }}
                        >
                          {compareId === item.id ? 'Comparing' : 'Compare'}
                        </button>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Candidate detail">
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
                    {!overview?.notifications.length ? <li>No pool alerts.</li> : null}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Topic distribution</h3>
                  <div className={styles.waterfall}>
                    {(overview?.analytics.topicDistribution ?? []).map((item) => (
                      <div key={item.label} className={styles.waterfallRow}>
                        <span>{item.label}</span>
                        <div className={styles.radarBar}>
                          <div
                            className={styles.radarFill}
                            style={{ width: `${(item.count / maxTopic) * 100}%` }}
                          />
                        </div>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                    {!overview?.analytics.topicDistribution.length ? (
                      <p className={styles.lede}>No topic volume yet.</p>
                    ) : null}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'grid' ? (
              <CandidateGrid
                items={filtered}
                onSelect={(id) => {
                  setSelectedId(id);
                  setTab('explain');
                }}
              />
            ) : null}

            {tab === 'scorecard' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Qualification scorecard · {selected.title}</h3>
                  <div className={styles.waterfall}>
                    {scorecardRows.map(([label, value]) => (
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

            {tab === 'explain' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>AI summary</h3>
                  <p>{selected.aiSummary}</p>
                </article>
                <article className={styles.detailCard}>
                  <h3>Basic information</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Title</dt>
                      <dd>{selected.title}</dd>
                    </div>
                    <div>
                      <dt>Executive summary</dt>
                      <dd>{selected.summary}</dd>
                    </div>
                    <div>
                      <dt>Topic / category</dt>
                      <dd>
                        {selected.topic}
                        {selected.subcategory ? ` / ${selected.subcategory}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Region / language</dt>
                      <dd>
                        {display(selected.region)} / {measured(selected.language)}
                      </dd>
                    </div>
                    <div>
                      <dt>Documentary type</dt>
                      <dd>{measured(selected.formatHint)}</dd>
                    </div>
                    <div>
                      <dt>Discovery run</dt>
                      <dd>{display(selected.discoveryRunId)}</dd>
                    </div>
                    <div>
                      <dt>Strategy version</dt>
                      <dd>
                        {selected.strategyVersionNumber != null
                          ? `v${selected.strategyVersionNumber}`
                          : measured(selected.strategyVersionId)}
                      </dd>
                    </div>
                    <div>
                      <dt>Estimated duration</dt>
                      <dd>UNMEASURED</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>
                    Why score{' '}
                    {selected.measuredScore ? selected.score : 'UNMEASURED'}
                  </h3>
                  <ul className={styles.bulletList}>
                    {selected.explainability.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'lifecycle' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Candidate lifecycle</h3>
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
              </div>
            ) : null}

            {tab === 'knowledge' && selected ? (
              <KvPanel title="Knowledge graph links" rows={selected.knowledge} />
            ) : null}
            {tab === 'audience' && selected ? (
              <KvPanel title="Audience intelligence" rows={selected.audienceIntel} />
            ) : null}
            {tab === 'commercial' && selected ? (
              <KvPanel title="Commercial intelligence" rows={selected.commercial} />
            ) : null}
            {tab === 'production' && selected ? (
              <KvPanel title="Production readiness" rows={selected.production} />
            ) : null}

            {tab === 'risks' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Risk analysis</h3>
                  {!selected.risks.length ? (
                    <p className={styles.lede}>
                      No `iq_risk_assessments` for this candidate. Factor risk:{' '}
                      {measured(selected.riskScore)}.
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

            {tab === 'compare' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Candidate comparison</h3>
                  {selected && compare ? (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Selected</th>
                          <th>Compare</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            ['Title', selected.title, compare.title],
                            ['Strategy Fit', selected.strategyFit, compare.strategyFit],
                            ['Audience Value', selected.audienceValue, compare.audienceValue],
                            ['Originality', selected.originality, compare.originality],
                            ['Evidence', selected.evidenceQuality, compare.evidenceQuality],
                            ['Commercial', selected.commercialValue, compare.commercialValue],
                            [
                              'Production',
                              selected.productionReadiness,
                              compare.productionReadiness,
                            ],
                            ['Risk', selected.riskScore, compare.riskScore],
                            ['Overall Score', selected.score, compare.score],
                          ] as Array<[string, string | number | null, string | number | null]>
                        ).map(([label, a, b]) => (
                          <tr key={label}>
                            <td>{label}</td>
                            <td>{display(a)}</td>
                            <td>{display(b)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className={styles.lede}>
                      Select a candidate, then use Compare on another row in the explorer.
                    </p>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'recommendations' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>AI recommendations</h3>
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

            {tab === 'analytics' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Status distribution</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.analytics.statusDistribution ?? []).map((item) => (
                      <li key={item.label}>
                        {item.label}: {item.count}
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Confidence distribution</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.analytics.confidenceBuckets ?? []).map((item) => (
                      <li key={item.label}>
                        {item.label}: {item.count}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'audit' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Candidate audit trail</h3>
                  {!selected.audit.length ? (
                    <p className={styles.lede}>
                      No candidate-scoped audit events yet. Model version:{' '}
                      {measured(selected.modelVersion)}.
                    </p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Action</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.audit.map((row) => (
                          <tr key={`${row.action}-${row.at}`}>
                            <td>{new Date(row.at).toLocaleString()}</td>
                            <td>{row.action}</td>
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
              'scorecard',
              'explain',
              'lifecycle',
              'knowledge',
              'audience',
              'commercial',
              'production',
              'risks',
              'audit',
            ].includes(tab) && !selected ? (
              <div className={styles.emptyInline}>
                <Scale size={22} aria-hidden />
                <p>Select a candidate to inspect scorecards, explainability, and readiness.</p>
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
                <h3>Selected idea</h3>
                <p>{selected?.title ?? 'Select a candidate for XAI detail.'}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Decision / next</h3>
                <p>
                  {selected
                    ? `${selected.decision ?? selected.status} → ${selected.nextStage}`
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
              <article className={styles.insightCard}>
                <h3>Confidence</h3>
                <p>
                  {selected?.measuredConfidence
                    ? `${selected.confidence}%`
                    : 'UNMEASURED'}
                </p>
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

function CandidateGrid({
  items,
  onSelect,
}: {
  items: PoolCandidate[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>Candidate grid</h3>
        <table className={styles.auditTable}>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Candidate</th>
              <th>Topic</th>
              <th>Strategy Fit</th>
              <th>Audience</th>
              <th>Originality</th>
              <th>Evidence</th>
              <th>Confidence</th>
              <th>Status</th>
              <th>Next Stage</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} onClick={() => onSelect(item.id)}>
                <td>{display(item.rank)}</td>
                <td>{item.title}</td>
                <td>{item.topic}</td>
                <td>{measured(item.strategyFit)}</td>
                <td>{display(item.audience)}</td>
                <td>{measured(item.originality)}</td>
                <td>
                  {item.evidencePassed}/{item.evidencePassed + item.evidenceFailed}
                </td>
                <td>{item.measuredConfidence ? `${item.confidence}%` : 'UNMEAS.'}</td>
                <td>{item.status}</td>
                <td>{item.nextStage}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length ? (
          <div className={styles.emptyInline}>
            <p>No candidates to display.</p>
          </div>
        ) : null}
      </article>
    </div>
  );
}
