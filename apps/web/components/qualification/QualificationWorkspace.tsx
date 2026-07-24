'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
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
  Candidate,
  QualificationCandidateCard,
  QualificationOverview,
  SectionKey,
} from '@/lib/idea-qualification/contracts';
import { qualificationApi } from '@/apps/web/lib/qualification-api';
import { getSection } from '@/apps/web/lib/qualification-config';
import styles from './qualification.module.css';

type TabId =
  | 'overview'
  | 'queue'
  | 'radar'
  | 'explain'
  | 'risks'
  | 'evidence'
  | 'duplicates'
  | 'commercial'
  | 'production'
  | 'recommendations'
  | 'timeline'
  | 'governance'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'queue', label: 'Candidate Queue' },
  { id: 'radar', label: 'Score Radar' },
  { id: 'explain', label: 'Explainability' },
  { id: 'risks', label: 'Risk' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'duplicates', label: 'Duplicates' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'production', label: 'Production' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'governance', label: 'Governance' },
  { id: 'audit', label: 'Audit' },
];

const EMPTY_COPY =
  'The Autonomous Idea Qualification Engine continuously evaluates every content opportunity received from the Content Intelligence stage. Each candidate idea is automatically normalized, evidence-validated, strategy-aligned, originality-tested, audience-scored, commercially assessed, production-qualified, risk-evaluated, ranked, and prepared for Research & Evidence. Once the autonomous engine begins processing ideas, complete qualification analytics, explainable AI decisions, confidence scores, governance records, and production readiness insights will appear here.';

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'QUALIFIED':
    case 'SELECTED':
    case 'HANDED_OFF':
    case 'PASSED':
    case 'ACKNOWLEDGED':
    case 'COMPLETED':
    case 'RUNNING':
    case 'READY':
    case 'PROCEED':
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
    case 'QUEUED':
    case 'PENDING':
    case 'IDLE':
    case 'NEEDS EVIDENCE':
    case 'NEEDS RESEARCH':
    case 'DELAY':
    case 'MERGE':
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

function explainWhy(candidate: QualificationCandidateCard | null): string[] {
  if (!candidate) return [];
  const lines: string[] = [];
  const f = candidate.factors;
  if (f?.strategicFit != null) lines.push(`${f.strategicFit}% strategy alignment`);
  if (f?.audienceValue != null) lines.push(`${f.audienceValue}% audience demand`);
  if (f?.evidence != null) lines.push(`${f.evidence}% evidence quality`);
  if (f?.originality != null) lines.push(`${f.originality}% originality`);
  if (f?.educationalValue != null) lines.push(`${f.educationalValue}% educational value`);
  if (f?.feasibility != null) lines.push(`${f.feasibility}% production feasibility`);
  if (f?.visualPotential != null) lines.push(`${f.visualPotential}% visual potential`);
  if (f?.risk != null) lines.push(`Risk score ${f.risk}`);
  if (candidate.maxDuplicateSimilarity != null) {
    lines.push(
      candidate.maxDuplicateSimilarity < 65
        ? `No blocking duplicate (similarity ${candidate.maxDuplicateSimilarity}%)`
        : `Duplicate similarity ${candidate.maxDuplicateSimilarity}%`,
    );
  }
  if (candidate.decisionReason) lines.push(candidate.decisionReason);
  if (candidate.explanation) lines.push(candidate.explanation);
  if (!lines.length) {
    lines.push(
      candidate.measuredScore
        ? `Persisted score ${candidate.score} · gate ${candidate.gateStatus}`
        : 'No factor explanation persisted yet for this candidate',
    );
  }
  return lines;
}

function exportPayload(overview: QualificationOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `idea-qualification-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'id',
    'title',
    'status',
    'score',
    'confidence',
    'gateStatus',
    'decision',
    'nextAction',
  ];
  const lines = [
    header.join(','),
    ...overview.candidates.map((item) =>
      [
        item.id,
        JSON.stringify(item.title),
        item.status,
        item.score,
        item.confidence,
        item.gateStatus,
        item.decision ?? '',
        JSON.stringify(item.nextAction),
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `idea-qualification-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function QualificationWorkspace({ sectionKey }: { sectionKey?: SectionKey }) {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<QualificationOverview | null>(null);
  const [items, setItems] = useState<Candidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tab, setTab] = useState<TabId>('overview');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const section = sectionKey ? getSection(sectionKey) : undefined;
  const systemRunning = systemState === 'RUNNING';

  async function load(preferId?: string | null) {
    setBusy(true);
    setError('');
    try {
      const [next, dashboard] = await Promise.all([
        qualificationApi.overview(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      if (sectionKey) {
        setItems(await qualificationApi.list(sectionKey));
      } else {
        setItems([]);
      }
      const candidates = next.candidates ?? [];
      const targetId = preferId ?? selectedId;
      const selected = targetId
        ? candidates.find((item) => item.id === targetId)
        : candidates[0];
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
  }, [sectionKey]);

  useEffect(() => {
    if (sectionKey) return;
    const timer = window.setInterval(() => {
      void load(selectedId);
    }, systemRunning ? 3000 : 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemRunning, selectedId, sectionKey]);

  useEffect(() => {
    const onControlChanged = () => void load(selectedId);
    window.addEventListener('cacsms:system-control-changed', onControlChanged);
    return () => window.removeEventListener('cacsms:system-control-changed', onControlChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const candidates = overview?.candidates ?? [];
  const kpi = overview?.kpi;
  const needle = query.trim().toLowerCase();

  const statuses = useMemo(
    () => [...new Set(candidates.map((item) => item.status))].sort(),
    [candidates],
  );

  const filtered = useMemo(
    () =>
      candidates.filter((item) => {
        if (statusFilter !== 'all' && item.status !== statusFilter) return false;
        if (!needle) return true;
        const haystack = [
          item.title,
          item.summary,
          item.domain,
          item.audience,
          item.status,
          item.decision,
          item.nextAction,
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

  const maxRadar = Math.max(
    1,
    ...(overview?.radar.map((item) => item.value ?? 0) ?? [1]),
  );

  const kpis = useMemo(() => {
    const m = kpi;
    return [
      {
        label: 'Ideas Received',
        value: String(m?.ideasReceived ?? 0),
        meta: 'All candidate statuses',
        accent: '#2563EB',
        icon: Lightbulb,
        bars: sparkBars(m?.ideasReceived ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Ideas Passed',
        value: String(m?.ideasPassed ?? 0),
        meta: 'Qualified / selected / handed off',
        accent: '#22C55E',
        icon: CheckCircle2,
        bars: sparkBars(m?.ideasPassed ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Ideas Rejected',
        value: String(m?.ideasRejected ?? 0),
        meta: 'Rejected decisions',
        accent: '#EF4444',
        icon: ShieldAlert,
        bars: sparkBars(m?.ideasRejected ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Under Review',
        value: String(m?.underReview ?? 0),
        meta: 'Received / evaluating / blocked',
        accent: '#F59E0B',
        icon: Eye,
        bars: sparkBars(m?.underReview ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'AI Confidence',
        value: m?.aiConfidence != null ? `${m.aiConfidence}%` : 'UNMEAS.',
        meta: 'Avg persisted confidence',
        accent: '#7C3AED',
        icon: Gauge,
        bars: sparkBars(m?.aiConfidence ?? 0),
        drill: 'explain' as TabId,
      },
      {
        label: 'Evidence Sufficiency',
        value: m?.evidenceSufficiency != null ? `${m.evidenceSufficiency}%` : 'UNMEAS.',
        meta: 'Evidence checks / factors',
        accent: '#0EA5E9',
        icon: FileSearch,
        bars: sparkBars(m?.evidenceSufficiency ?? 0),
        drill: 'evidence' as TabId,
      },
      {
        label: 'Strategy Alignment',
        value: m?.strategyAlignment != null ? `${m.strategyAlignment}%` : 'UNMEAS.',
        meta: 'strategicFit factor avg',
        accent: '#2563EB',
        icon: Target,
        bars: sparkBars(m?.strategyAlignment ?? 0),
        drill: 'radar' as TabId,
      },
      {
        label: 'Originality Score',
        value: m?.originalityScore != null ? `${m.originalityScore}%` : 'UNMEAS.',
        meta: 'originality factor avg',
        accent: '#14B8A6',
        icon: Sparkles,
        bars: sparkBars(m?.originalityScore ?? 0),
        drill: 'duplicates' as TabId,
      },
      {
        label: 'Commercial Potential',
        value: m?.commercialPotential != null ? `${m.commercialPotential}%` : 'UNMEAS.',
        meta: 'Mapped from audience value',
        accent: '#F97316',
        icon: TrendingUp,
        bars: sparkBars(m?.commercialPotential ?? 0),
        drill: 'commercial' as TabId,
      },
      {
        label: 'Production Cost',
        value: m?.productionCost != null ? String(m.productionCost) : 'UNMEAS.',
        meta: 'No cost table yet',
        accent: '#94A3B8',
        icon: Layers3,
        bars: sparkBars(0),
        drill: 'production' as TabId,
      },
      {
        label: 'Estimated ROI',
        value: m?.estimatedRoi != null ? `${m.estimatedRoi}%` : 'UNMEAS.',
        meta: 'No ROI model persisted',
        accent: '#94A3B8',
        icon: Activity,
        bars: sparkBars(0),
        drill: 'commercial' as TabId,
      },
      {
        label: 'Audience Demand',
        value: m?.audienceDemand != null ? `${m.audienceDemand}%` : 'UNMEAS.',
        meta: 'audienceValue factor avg',
        accent: '#0EA5E9',
        icon: TrendingUp,
        bars: sparkBars(m?.audienceDemand ?? 0),
        drill: 'commercial' as TabId,
      },
      {
        label: 'Risk Score',
        value: m?.riskScore != null ? String(m.riskScore) : 'UNMEAS.',
        meta: 'Risk assessments / factors',
        accent: '#EF4444',
        icon: AlertTriangle,
        bars: sparkBars(m?.riskScore ?? 0),
        drill: 'risks' as TabId,
      },
      {
        label: 'Feasibility Score',
        value: m?.feasibilityScore != null ? `${m.feasibilityScore}%` : 'UNMEAS.',
        meta: 'feasibility factor avg',
        accent: '#22C55E',
        icon: ClipboardCheck,
        bars: sparkBars(m?.feasibilityScore ?? 0),
        drill: 'production' as TabId,
      },
      {
        label: 'Approval Rate',
        value: m?.approvalRate != null ? `${m.approvalRate}%` : 'UNMEAS.',
        meta: 'Passed / received',
        accent: '#2563EB',
        icon: ShieldCheck,
        bars: sparkBars(m?.approvalRate ?? 0),
        drill: 'governance' as TabId,
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
        drill: 'timeline' as TabId,
      },
    ];
  }, [kpi]);

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
        <p className={styles.crumb}>Content Lifecycle / 03 Idea Qualification</p>
        <h1 className={styles.title}>
          {section?.title ?? 'Idea Qualification Command Centre'}
        </h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Idea Qualification unavailable</h2>
          <p>{error || overview?.reason}</p>
          <button type="button" className={styles.chip} onClick={() => void load()}>
            Retry connection
          </button>
        </section>
      </main>
    );
  }

  if (section) {
    return (
      <main className={styles.page}>
        <header className={styles.titleRow}>
          <div>
            <p className={styles.crumb}>Idea Qualification / {section.title}</p>
            <h1 className={styles.title}>{section.title}</h1>
            <p className={styles.lede}>{section.description}</p>
          </div>
          <div className={styles.badges}>
            <span className={`${styles.badge} ${statusTone(overview?.cycle?.status)}`}>
              {overview?.cycle?.status ?? 'IDLE'}
            </span>
          </div>
        </header>
        <div className={styles.infoNotice} role="status">
          <Sparkles size={16} aria-hidden />
          <div>
            <strong>Observe only · section view</strong>
            Candidate rows are persisted Stage 03 records. Filters are local to this view.
          </div>
        </div>
        {items.length ? (
          <section className={styles.panel}>
            <div className={styles.tabBody}>
              <table className={styles.auditTable}>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Domain</th>
                    <th>Status</th>
                    <th>Gate</th>
                    <th>Score</th>
                    <th>Confidence</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.title}</strong>
                        <div className={styles.explorerMeta}>{item.summary}</div>
                      </td>
                      <td>{item.domain}</td>
                      <td>
                        <span className={`${styles.chip} ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>{item.gateStatus}</td>
                      <td>{item.score.toFixed(1)}</td>
                      <td>{item.confidence.toFixed(0)}%</td>
                      <td>{new Date(item.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className={styles.emptyHero} role="status">
            <div>
              <h2>{EMPTY_COPY}</h2>
              <p className={styles.lede}>
                This section populates automatically when the qualification cycle writes matching
                records.
              </p>
            </div>
          </section>
        )}
      </main>
    );
  }

  const showWaitingIntake = !overview?.intake;
  const showEmptyHero = Boolean(overview?.intake) && candidates.length === 0;
  const why = explainWhy(selected);

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>Content Lifecycle / 03 Idea Qualification</p>
          <h1 className={styles.title}>Idea Qualification Command Centre</h1>
          <p className={styles.lede}>
            Verify, score, gate and select only ideas that are strategically aligned,
            evidence-backed, original, feasible and safe.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 03 Gateway</span>
          <span className={`${styles.badge} ${statusTone(overview?.cycle?.status)}`}>
            {overview?.cycle?.status ?? 'NOT STARTED'}
          </span>
          <span className={`${styles.badge} ${statusTone(overview?.engine.status)}`}>
            Engine {overview?.engine.status ?? 'IDLE'}
          </span>
          <span className={`${styles.badge} ${statusTone(overview?.intake?.status)}`}>
            Intake {overview?.intake?.status ?? 'PENDING'}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous qualification</strong>
          KPIs and explainability are reconstructed from persisted <code>iq_*</code> tables.
          Production cost, ROI, and prompt versions stay UNMEASURED until those fields are written.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Qualification KPIs">
        {kpis.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              className={styles.kpiCard}
              style={{ ['--accent' as string]: card.accent }}
              title={card.meta}
              onClick={() => setTab(card.drill)}
            >
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>{card.label}</span>
                <Icon size={16} className={styles.kpiIcon} aria-hidden />
              </div>
              <div className={styles.kpiValue}>{card.value}</div>
              <div className={styles.kpiMeta}>
                <span>{card.meta}</span>
                <span className={styles.spark} aria-hidden>
                  {card.bars.map((height, index) => (
                    <i key={`${card.label}-${index}`} style={{ height: `${height}px` }} />
                  ))}
                </span>
              </div>
            </button>
          );
        })}
      </section>

      <section className={styles.lifecycle} aria-label="Autonomous qualification funnel">
        <div className={styles.lifecycleHead}>
          <h2>Autonomous qualification funnel</h2>
          <span>
            {overview?.intake
              ? `Intake ACK · cycle ${overview.cycle?.status ?? 'IDLE'}`
              : `Awaiting Content Intelligence package · system ${systemState}`}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {(overview?.funnel ?? []).map((stage) => (
            <div key={stage.key} className={styles.stage} data-state={stage.state}>
              <span className={styles.stageIcon}>
                <Workflow size={14} aria-hidden />
              </span>
              <strong>{stage.label}</strong>
              <span className={styles.pipelineMeta}>
                {stage.records} · fail {stage.failures} · conf {measured(stage.confidence)}
                {stage.successRate != null ? ` · ${stage.successRate}%` : ''}
                {stage.durationMs != null ? ` · ${stage.durationMs}ms` : ' · dur UNMEAS.'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {showWaitingIntake ? (
        <div className={styles.waitingBanner} role="status">
          <Timer size={18} aria-hidden />
          <div>
            <strong>Waiting for Content Intelligence intake</strong>
            Qualification activates after a checksum-verified intelligence package is acknowledged.
          </div>
        </div>
      ) : null}

      {showEmptyHero ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>{EMPTY_COPY}</h2>
            <p className={styles.lede}>
              Content Intelligence → Intake → Evidence → Strategy → Audience → Originality →
              Commercial → Production → Risk → Ranking → Research & Evidence.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Intake</strong>
              Normalize upstream opportunities
            </li>
            <li>
              <strong>2. Evidence</strong>
              Validate sources & sufficiency
            </li>
            <li>
              <strong>3. Align</strong>
              Strategy, audience, originality
            </li>
            <li>
              <strong>4. Qualify</strong>
              Score, gate, rank, hand off
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Qualification command workspace">
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
                placeholder="Idea, topic, audience, decision…"
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
                      <span className={styles.explorerTitle}>{item.title}</span>
                      <span className={styles.explorerMeta}>
                        {item.domain}
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
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Qualification detail">
          <div className={styles.tabs} role="tablist" aria-label="Qualification tabs">
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
                  <h3>AI Qualification Engine</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Status</dt>
                      <dd>{overview?.engine.status ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Current model</dt>
                      <dd>{measured(overview?.engine.currentModel)}</dd>
                    </div>
                    <div>
                      <dt>Reasoning engine</dt>
                      <dd>{overview?.engine.reasoningEngine ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Confidence</dt>
                      <dd>
                        {measured(overview?.engine.confidence)}
                        {overview?.engine.confidence != null ? '%' : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Knowledge sources</dt>
                      <dd>{overview?.engine.knowledgeSources ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Strategy version</dt>
                      <dd>{measured(overview?.engine.strategyVersion)}</dd>
                    </div>
                    <div>
                      <dt>Policy version</dt>
                      <dd>{measured(overview?.engine.policyVersion)}</dd>
                    </div>
                    <div>
                      <dt>Prompt / learning</dt>
                      <dd>
                        {measured(overview?.engine.promptVersion)} /{' '}
                        {measured(overview?.engine.learningVersion)}
                      </dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Blockers</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.blockers ?? []).map((blocker) => (
                      <li key={blocker.id}>
                        <span className={`${styles.chip} ${statusTone(blocker.severity)}`}>
                          {blocker.severity}
                        </span>{' '}
                        {blocker.message}
                      </li>
                    ))}
                    {!overview?.blockers?.length ? <li>No unresolved blockers.</li> : null}
                  </ul>
                </article>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Decision timeline</h3>
                  <ul className={styles.timeline}>
                    {(overview?.timeline ?? []).map((marker) => (
                      <li key={marker.key}>
                        <CircleDot size={14} aria-hidden />
                        <div>
                          <strong>
                            {marker.label}
                            {marker.done ? ' ✓' : ''}
                          </strong>
                          <span>
                            {marker.count} records ·{' '}
                            {marker.at ? new Date(marker.at).toLocaleString() : 'Pending'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'queue' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Top candidate ideas</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Idea</th>
                        <th>Score</th>
                        <th>Evidence</th>
                        <th>Confidence</th>
                        <th>Audience</th>
                        <th>Status</th>
                        <th>Next action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => {
                            setSelectedId(item.id);
                            setTab('explain');
                          }}
                        >
                          <td>{item.title}</td>
                          <td>{item.measuredScore ? item.score : 'UNMEAS.'}</td>
                          <td>
                            {item.evidencePassed}/{item.evidencePassed + item.evidenceFailed}
                          </td>
                          <td>
                            {item.measuredConfidence ? `${item.confidence}%` : 'UNMEAS.'}
                          </td>
                          <td>{display(item.audience)}</td>
                          <td>{item.status}</td>
                          <td>{item.nextAction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filtered.length ? (
                    <div className={styles.emptyInline}>
                      <p>No candidates in queue.</p>
                    </div>
                  ) : null}
                </article>
              </div>
            ) : null}

            {tab === 'radar' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Qualification score radar</h3>
                  <div className={styles.waterfall}>
                    {(overview?.radar ?? []).map((dim) => (
                      <div key={dim.key} className={styles.waterfallRow}>
                        <span>{dim.label}</span>
                        <div className={styles.radarBar}>
                          <div
                            className={styles.radarFill}
                            style={{
                              width: `${dim.value != null ? Math.min(100, (dim.value / maxRadar) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <strong>
                          {dim.value != null ? `${dim.value}` : 'UNMEAS.'}
                        </strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'explain' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Why this idea {selected.decision ?? selected.status}</h3>
                  <ul className={styles.bulletList}>
                    {why.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Confidence breakdown</h3>
                  <div className={styles.metricGrid}>
                    <div className={styles.metricTile}>
                      <span>Overall</span>
                      <strong>
                        {selected.measuredConfidence ? `${selected.confidence}%` : 'UNMEAS.'}
                      </strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Evidence</span>
                      <strong>{measured(selected.factors?.evidence)}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Strategy</span>
                      <strong>{measured(selected.factors?.strategicFit)}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Audience</span>
                      <strong>{measured(selected.factors?.audienceValue)}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Production</span>
                      <strong>{measured(selected.factors?.feasibility)}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Commercial</span>
                      <strong>{measured(selected.factors?.audienceValue)}</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.detailCard}>
                  <h3>Factor scores</h3>
                  <dl className={styles.kv}>
                    {Object.entries(selected.factors ?? {}).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                    {!selected.factors ? (
                      <div>
                        <dt>Factors</dt>
                        <dd>UNMEASURED</dd>
                      </div>
                    ) : null}
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'risks' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Risk assessment</h3>
                  {!overview?.risks.length ? (
                    <p className={styles.lede}>
                      No `iq_risk_assessments` rows yet. Categories such as legal, copyright,
                      safety, and production appear when assessments are persisted.
                    </p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Count</th>
                          <th>Avg score</th>
                          <th>Max severity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.risks.map((risk) => (
                          <tr key={risk.category}>
                            <td>{risk.category}</td>
                            <td>{risk.count}</td>
                            <td>{measured(risk.avgScore)}</td>
                            <td>{display(risk.maxSeverity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'evidence' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Evidence coverage</h3>
                  <div className={styles.metricGrid}>
                    <div className={styles.metricTile}>
                      <span>Total checks</span>
                      <strong>{overview?.evidenceCoverage.totalChecks ?? 0}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Passed</span>
                      <strong>{overview?.evidenceCoverage.passed ?? 0}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Failed</span>
                      <strong>{overview?.evidenceCoverage.failed ?? 0}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Blocking</span>
                      <strong>{overview?.evidenceCoverage.blocking ?? 0}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Coverage</span>
                      <strong>
                        {measured(overview?.evidenceCoverage.coveragePct)}
                        {overview?.evidenceCoverage.coveragePct != null ? '%' : ''}
                      </strong>
                    </div>
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'duplicates' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Duplicate analysis</h3>
                  <div className={styles.metricGrid}>
                    <div className={styles.metricTile}>
                      <span>Checks</span>
                      <strong>{overview?.duplicates.checks ?? 0}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Blocking</span>
                      <strong>{overview?.duplicates.blocking ?? 0}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Avg similarity</span>
                      <strong>
                        {measured(overview?.duplicates.avgSimilarity)}
                        {overview?.duplicates.avgSimilarity != null ? '%' : ''}
                      </strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Max similarity</span>
                      <strong>
                        {measured(overview?.duplicates.maxSimilarity)}
                        {overview?.duplicates.maxSimilarity != null ? '%' : ''}
                      </strong>
                    </div>
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'commercial' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Commercial evaluation</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Commercial potential</dt>
                      <dd>{measured(kpi?.commercialPotential)}</dd>
                    </div>
                    <div>
                      <dt>Audience demand</dt>
                      <dd>{measured(kpi?.audienceDemand)}</dd>
                    </div>
                    <div>
                      <dt>Estimated revenue / ROI</dt>
                      <dd>UNMEASURED</dd>
                    </div>
                    <div>
                      <dt>Production cost</dt>
                      <dd>UNMEASURED</dd>
                    </div>
                    <div>
                      <dt>Sponsorship / licensing</dt>
                      <dd>UNMEASURED</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'production' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Production readiness</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Feasibility</dt>
                      <dd>{measured(kpi?.feasibilityScore)}</dd>
                    </div>
                    <div>
                      <dt>Visual potential (selected)</dt>
                      <dd>{measured(selected?.factors?.visualPotential)}</dd>
                    </div>
                    <div>
                      <dt>Source availability</dt>
                      <dd>{measured(selected?.factors?.sourceAvailability)}</dd>
                    </div>
                    <div>
                      <dt>Timeline / resources / CGI</dt>
                      <dd>UNMEASURED</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'recommendations' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Recommendation engine</h3>
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
                  {!overview?.recommendations.length ? (
                    <p className={styles.lede}>No recommendations yet.</p>
                  ) : null}
                </article>
              </div>
            ) : null}

            {tab === 'timeline' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Autonomous decision history</h3>
                  <ul className={styles.timeline}>
                    {(overview?.timeline ?? []).map((marker) => (
                      <li key={marker.key}>
                        <CircleDot size={14} aria-hidden />
                        <div>
                          <strong>{marker.label}</strong>
                          <span>
                            {marker.done ? 'Completed' : 'Awaiting'} · {marker.count}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <h3 style={{ marginTop: 20 }}>Recent decisions</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Idea</th>
                        <th>Decision</th>
                        <th>Source</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overview?.decisions ?? []).map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.createdAt).toLocaleString()}</td>
                          <td>{row.title}</td>
                          <td>{row.decision}</td>
                          <td>{row.source}</td>
                          <td>{row.reason}</td>
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
                  <h3>Governance</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Audit events</dt>
                      <dd>{overview?.governance.auditEvents ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Decisions</dt>
                      <dd>{overview?.governance.decisions ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Digital signatures</dt>
                      <dd>{overview?.governance.digitalSignatures ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Immutable records</dt>
                      <dd>{overview?.governance.immutableRecords ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Policy version</dt>
                      <dd>{measured(overview?.governance.policyVersion)}</dd>
                    </div>
                    <div>
                      <dt>Intake checksum</dt>
                      <dd>
                        <code>{overview?.intake?.checksum ?? 'Not received'}</code>
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Qualification audit</h3>
                  {!overview?.audit.length ? (
                    <p className={styles.lede}>No qualification audit events persisted yet.</p>
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

            {tab === 'explain' && !selected ? (
              <div className={styles.emptyInline}>
                <Scale size={22} aria-hidden />
                <p>Select a candidate to inspect explainable qualification reasoning.</p>
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
                <h3>Decision</h3>
                <p>
                  {selected
                    ? `${selected.decision ?? selected.status} · ${selected.nextAction}`
                    : '—'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Why</h3>
                <ul className={styles.bulletList}>
                  {(why.length ? why : ['—']).slice(0, 6).map((line) => (
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
              <article className={styles.insightCard}>
                <h3>Knowledge chain</h3>
                <p>
                  Idea → Topics ({selected?.domain ?? '—'}) → Evidence (
                  {selected
                    ? `${selected.evidencePassed} pass / ${selected.evidenceFailed} fail`
                    : '—'}
                  ) → Audience ({selected?.audience ?? '—'}) → Strategy → Related ideas
                </p>
              </article>
            </div>
          </div>
        </aside>
      </section>
    </motion.main>
  );
}
