'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Compass,
  FileSearch,
  Gauge,
  GitBranch,
  Layers3,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
} from 'lucide-react';
import type {
  GapSeverity,
  GapStatus,
  KnowledgeGapRecord,
  KnowledgeGapsOverview,
} from '@/lib/content-intelligence/knowledge-gaps';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import styles from './knowledge-gaps.module.css';

type TabId =
  | 'overview'
  | 'analysis'
  | 'coverage'
  | 'opportunity'
  | 'reasoning'
  | 'dependencies'
  | 'history'
  | 'audit';

type SeverityFilter = 'all' | GapSeverity;
type StatusFilter = 'all' | GapStatus;

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'analysis', label: 'Gap Analysis' },
  { id: 'coverage', label: 'Coverage Matrix' },
  { id: 'opportunity', label: 'Opportunity Assessment' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'compare', label: 'Compare', icon: Compass },
  { key: 'detect', label: 'Detect', icon: FileSearch },
  { key: 'analyse', label: 'Analyse', icon: Activity },
  { key: 'prioritise', label: 'Prioritise', icon: Target },
  { key: 'validate', label: 'Validate', icon: CheckCircle2 },
  { key: 'recommend', label: 'Recommend', icon: Sparkles },
  { key: 'handoff', label: 'Handoff', icon: GitBranch },
] as const;

function statusTone(status?: string | null) {
  switch (status) {
    case 'OPEN':
    case 'VALIDATED':
    case 'RECOMMENDED':
    case 'HANDED_OFF':
    case 'COMPLETED':
    case 'RUNNING':
    case 'ACKNOWLEDGED':
    case 'LOW':
    case 'Completed':
    case 'Healthy':
      return styles.toneReady;
    case 'CRITICAL':
    case 'HIGH':
    case 'FAILED':
    case 'ARCHIVED':
    case 'Failed':
      return styles.toneBlocked;
    case 'MEDIUM':
    case 'ANALYSING':
    case 'WARNING':
    case 'UNKNOWN':
    case 'Waiting':
    case 'Comparing':
    case 'Analysing':
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

function matchesGap(
  item: KnowledgeGapRecord,
  needle: string,
  severity: SeverityFilter,
  status: StatusFilter,
  domain: string,
  audience: string,
  geography: string,
  language: string,
) {
  if (severity !== 'all' && item.severity !== severity) return false;
  if (status !== 'all' && item.status !== status) return false;
  if (domain !== 'all' && (item.domain ?? 'Unspecified domain') !== domain) return false;
  if (audience !== 'all' && (item.audience ?? '') !== audience) return false;
  if (geography !== 'all' && (item.geography ?? '') !== geography) return false;
  if (language !== 'all' && (item.language ?? '') !== language) return false;
  if (!needle) return true;
  const haystack = [
    item.topic,
    item.summary,
    item.domain,
    item.audience,
    item.geography,
    item.language,
    item.severity,
    item.status,
    item.missingKnowledge,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function lifecycleState(
  index: number,
  overview: KnowledgeGapsOverview | null,
  systemRunning: boolean,
) {
  const count = overview?.metrics.knowledgeGaps ?? 0;
  const runStatus = overview?.run?.status;
  const hasPackage = Boolean(overview?.strategy);

  if (count > 0 && runStatus === 'COMPLETED') {
    return index <= 5 ? 'done' : index === 6 ? 'active' : 'pending';
  }
  if (count > 0 && (runStatus === 'RUNNING' || systemRunning)) {
    if (index <= 2) return 'done';
    if (index === 3) return 'active';
    return 'pending';
  }
  if (count > 0) {
    if (index <= 2) return 'done';
    if (index === 3) return 'active';
    return 'pending';
  }
  if (hasPackage || systemRunning || runStatus === 'RUNNING' || runStatus === 'QUEUED') {
    return index === 0 ? 'active' : 'pending';
  }
  return 'pending';
}

function packageLabel(overview: KnowledgeGapsOverview | null, systemRunning: boolean) {
  if ((overview?.metrics.knowledgeGaps ?? 0) > 0 && overview?.run?.status === 'COMPLETED') {
    return 'Completed';
  }
  if (overview?.run?.status === 'RUNNING' || systemRunning) {
    return (overview?.metrics.knowledgeGaps ?? 0) > 0 ? 'Analysing' : 'Comparing';
  }
  if (overview?.run?.status === 'FAILED') return 'Failed';
  if ((overview?.metrics.criticalGaps ?? 0) > 0) return 'Warning';
  if ((overview?.metrics.knowledgeGaps ?? 0) > 0) return 'Healthy';
  if (overview?.strategy) return 'Waiting';
  return 'Empty';
}

export function KnowledgeGapsWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<KnowledgeGapsOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [domainFilter, setDomainFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [geographyFilter, setGeographyFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
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
        intelligenceApi.knowledgeGaps(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const items = next.gaps ?? [];
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

  const gaps = overview?.gaps ?? [];
  const metrics = overview?.metrics;
  const matrix = overview?.coverageMatrix ?? [];
  const needle = query.trim().toLowerCase();

  const domains = useMemo(
    () =>
      [...new Set(gaps.map((item) => item.domain?.trim() || 'Unspecified domain'))].sort(),
    [gaps],
  );
  const audiences = useMemo(
    () => [...new Set(gaps.map((item) => item.audience).filter(Boolean) as string[])].sort(),
    [gaps],
  );
  const geographies = useMemo(
    () => [...new Set(gaps.map((item) => item.geography).filter(Boolean) as string[])].sort(),
    [gaps],
  );
  const languages = useMemo(
    () => [...new Set(gaps.map((item) => item.language).filter(Boolean) as string[])].sort(),
    [gaps],
  );

  const filtered = useMemo(
    () =>
      gaps.filter((item) =>
        matchesGap(
          item,
          needle,
          severityFilter,
          statusFilter,
          domainFilter,
          audienceFilter,
          geographyFilter,
          languageFilter,
        ),
      ),
    [
      gaps,
      needle,
      severityFilter,
      statusFilter,
      domainFilter,
      audienceFilter,
      geographyFilter,
      languageFilter,
    ],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    gaps.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const kpis = useMemo(() => {
    const knowledgeGaps = metrics?.knowledgeGaps ?? 0;
    const criticalGaps = metrics?.criticalGaps ?? 0;
    const coverageScore = metrics?.coverageScore ?? 0;
    const opportunityScore = metrics?.opportunityScore ?? 0;
    const researchReadiness = metrics?.researchReadiness ?? 0;
    const measuredConfidence = (metrics?.measuredConfidence ?? 0) > 0;
    return [
      {
        label: 'Knowledge Gaps',
        value: String(knowledgeGaps),
        meta: 'Persisted KNOWLEDGE_GAP / SEARCH_GAP signals',
        accent: '#2563EB',
        icon: FileSearch,
        bars: sparkBars(knowledgeGaps),
      },
      {
        label: 'Critical Gaps',
        value: String(criticalGaps),
        meta: 'Severity = CRITICAL',
        accent: '#EF4444',
        icon: AlertTriangle,
        bars: sparkBars(criticalGaps),
      },
      {
        label: 'Coverage Score',
        value: withCoverageLabel(coverageScore, knowledgeGaps),
        meta:
          knowledgeGaps === 0
            ? 'No gaps yet'
            : coverageScore === 0 && knowledgeGaps > 0
              ? 'No measured coverage values'
              : 'Avg measured evidence coverage',
        accent: '#0EA5E9',
        icon: Compass,
        bars: sparkBars(coverageScore),
      },
      {
        label: 'Opportunity Score',
        value: `${opportunityScore}%`,
        meta: 'Gaps linked to opportunities',
        accent: '#F59E0B',
        icon: Target,
        bars: sparkBars(opportunityScore),
      },
      {
        label: 'AI Confidence',
        value: measuredConfidence ? String(metrics?.avgConfidence ?? 0) : 'UNMEAS.',
        meta: measuredConfidence
          ? `${metrics?.measuredConfidence} measured signal scores`
          : 'No measured confidence ≥ 1',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(metrics?.avgConfidence ?? 0),
      },
      {
        label: 'Research Readiness',
        value: `${researchReadiness}%`,
        meta: 'Validated / recommended / linked mix',
        accent: '#22C55E',
        icon: Gauge,
        bars: sparkBars(researchReadiness),
      },
    ];
  }, [metrics]);

  const stageStatus = packageLabel(overview, systemRunning);

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
        <p className={styles.crumb}>Content Lifecycle / 02 Content Intelligence / Knowledge Gaps</p>
        <h1 className={styles.title}>Knowledge Gap Intelligence</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Knowledge gaps unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  const issues = overview?.issues ?? [];
  const audit = overview?.audit ?? [];

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>Content Lifecycle / 02 Content Intelligence / Knowledge Gaps</p>
          <h1 className={styles.title}>Knowledge Gap Intelligence</h1>
          <p className={styles.lede}>
            Autonomously identify strategic knowledge deficiencies against the Knowledge Universe
            and prioritise evidence-backed research opportunities for Stage 03.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 02</span>
          <span className={`${styles.badge} ${styles.toneAi}`}>System Managed</span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Observe Only</span>
          <span className={`${styles.badge} ${statusTone(stageStatus)}`}>{stageStatus}</span>
          <span className={`${styles.badge} ${statusTone(overview?.strategy?.status)}`}>
            Strategy v{overview?.strategy?.versionNumber ?? '—'}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only</strong>
          Knowledge gaps are derived from persisted KNOWLEDGE_GAP and SEARCH_GAP signals. Coverage,
          demand, and impact scores stay UNMEASURED unless workers write them.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Knowledge gap KPI summary">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article
              key={kpi.label}
              className={styles.kpiCard}
              style={{ ['--accent' as string]: kpi.accent }}
              title={kpi.meta}
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
            </article>
          );
        })}
      </section>

      <section className={styles.lifecycle} aria-label="Knowledge gap lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Gap lifecycle</h2>
          <span>
            {overview?.strategy
              ? `Package ACK · run ${overview.run?.status ?? 'IDLE'}`
              : `Awaiting Strategy package · system ${systemState}`}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {LIFECYCLE.map((stage, index) => {
            const Icon = stage.icon;
            const state = lifecycleState(index, overview, systemRunning);
            return (
              <div key={stage.key} className={styles.stage} data-state={state}>
                <span className={styles.stageIcon}>
                  <Icon size={16} aria-hidden />
                </span>
                <strong>{stage.label}</strong>
              </div>
            );
          })}
        </div>
      </section>

      {!overview?.strategy ? (
        <div className={styles.waitingBanner} role="status">
          <Timer size={18} aria-hidden />
          <div>
            <strong>Waiting for Strategy activation</strong>
            Gaps appear after an acknowledged Strategy package and discovery persists knowledge-gap
            signals against the Knowledge Universe.
          </div>
        </div>
      ) : null}

      {overview?.strategy && gaps.length === 0 ? (
        <div className={styles.waitingBanner} role="status">
          <Activity size={18} aria-hidden />
          <div>
            <strong>Comparing knowledge coverage</strong>
            No KNOWLEDGE_GAP or SEARCH_GAP signals are persisted yet. This workspace updates when
            discovery writes verified evidence.
          </div>
        </div>
      ) : null}

      <section className={styles.workspace} aria-label="Knowledge intelligence workspace">
        <aside className={styles.panel} aria-label="Gap Explorer">
          <div className={styles.panelHead}>
            <h2>Gap Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search topics, domains, audiences…"
                aria-label="Search knowledge gaps"
              />
            </label>
            <label className={styles.field}>
              <span>Severity</span>
              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}
                aria-label="Filter by severity"
              >
                <option value="all">All severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="ANALYSING">Analysing</option>
                <option value="VALIDATED">Validated</option>
                <option value="RECOMMENDED">Recommended</option>
                <option value="HANDED_OFF">Handed off</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Domain</span>
              <select
                value={domainFilter}
                onChange={(event) => setDomainFilter(event.target.value)}
                aria-label="Filter by domain"
              >
                <option value="all">All domains</option>
                {domains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
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
              <span>Geography</span>
              <select
                value={geographyFilter}
                onChange={(event) => setGeographyFilter(event.target.value)}
                aria-label="Filter by geography"
              >
                <option value="all">All geographies</option>
                {geographies.map((geography) => (
                  <option key={geography} value={geography}>
                    {geography}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Language</span>
              <select
                value={languageFilter}
                onChange={(event) => setLanguageFilter(event.target.value)}
                aria-label="Filter by language"
              >
                <option value="all">All languages</option>
                {languages.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </label>

            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No persisted knowledge gaps match the current filters.</p>
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
                      }}
                    >
                      <span className={styles.explorerTitle}>{item.topic}</span>
                      <span className={styles.explorerMeta}>
                        {item.domain ?? 'Unspecified domain'} · {item.signalType}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.severity)}`}>
                          {item.severity}
                        </span>
                        <span className={`${styles.chip} ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Knowledge Intelligence">
          <div className={styles.tabs} role="tablist" aria-label="Knowledge intelligence tabs">
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
            {!selected && tab !== 'audit' && tab !== 'dependencies' && tab !== 'coverage' ? (
              <div className={styles.emptyInline}>
                <Layers3 size={22} aria-hidden />
                <p>
                  {overview?.strategy
                    ? 'Select a gap to inspect coverage, opportunity, and recommendations.'
                    : 'Persisted gaps appear after discovery writes KNOWLEDGE_GAP signals.'}
                </p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Gap profile</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Topic</dt>
                      <dd>{selected.topic}</dd>
                    </div>
                    <div>
                      <dt>Domain</dt>
                      <dd>{display(selected.domain)}</dd>
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
                      <dt>Language</dt>
                      <dd>{display(selected.language)}</dd>
                    </div>
                    <div>
                      <dt>Severity</dt>
                      <dd>{selected.severity}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{selected.status}</dd>
                    </div>
                    <div>
                      <dt>Priority</dt>
                      <dd>{measured(selected.priority)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Coverage & demand</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Evidence coverage</dt>
                      <dd>{measured(selected.evidenceCoverage)}</dd>
                    </div>
                    <div>
                      <dt>Demand score</dt>
                      <dd>{measured(selected.demandScore)}</dd>
                    </div>
                    <div>
                      <dt>Strategic importance</dt>
                      <dd>{measured(selected.strategicImportance)}</dd>
                    </div>
                    <div>
                      <dt>Business impact</dt>
                      <dd>{measured(selected.businessImpact)}</dd>
                    </div>
                    <div>
                      <dt>Confidence</dt>
                      <dd>
                        {selected.measuredConfidence
                          ? `${Math.round(selected.confidence)}`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Linked opportunities</dt>
                      <dd>{selected.opportunityCount}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Missing knowledge</h3>
                  <p>{selected.missingKnowledge ?? selected.summary}</p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Source</dt>
                      <dd>{display(selected.sourceName)}</dd>
                    </div>
                    <div>
                      <dt>Evidence URL</dt>
                      <dd>{display(selected.evidenceUrl)}</dd>
                    </div>
                    <div>
                      <dt>Competitors covering</dt>
                      <dd>
                        {selected.competitorsCovering.length
                          ? selected.competitorsCovering.join('; ')
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {selected && tab === 'analysis' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Gap analysis</h3>
                  <p>{selected.summary}</p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Signal type</dt>
                      <dd>{selected.signalType}</dd>
                    </div>
                    <div>
                      <dt>Supporting evidence</dt>
                      <dd>
                        {selected.supportingEvidence.length
                          ? selected.supportingEvidence.join('; ')
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Freshness</dt>
                      <dd>
                        {selected.freshnessHours != null
                          ? `${selected.freshnessHours}h`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Recommended actions</h3>
                  {selected.recommendedActions.length ? (
                    <ul className={styles.bulletList}>
                      {selected.recommendedActions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.lede}>No recommended actions persisted yet.</p>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'coverage' ? (
              <div className={styles.detailGrid}>
                {!matrix.length ? (
                  <div className={styles.emptyInline}>
                    <p>No domain coverage matrix data persisted yet.</p>
                  </div>
                ) : (
                  matrix.map((row) => (
                    <article key={row.domain} className={styles.detailCard}>
                      <h3>{row.domain}</h3>
                      <dl className={styles.kv}>
                        <div>
                          <dt>Gaps</dt>
                          <dd>{row.gapCount}</dd>
                        </div>
                        <div>
                          <dt>Avg coverage</dt>
                          <dd>
                            {row.avgCoverage != null ? `${row.avgCoverage}` : 'UNMEASURED'}
                          </dd>
                        </div>
                        <div>
                          <dt>Critical</dt>
                          <dd>{row.critical}</dd>
                        </div>
                      </dl>
                      <div
                        className={styles.spark}
                        aria-hidden
                        title={`Coverage ${row.avgCoverage ?? 'UNMEASURED'}`}
                        style={{ height: 28, alignItems: 'flex-end', marginTop: 10 }}
                      >
                        <i
                          style={{
                            height: `${Math.max(4, Math.min(24, (row.avgCoverage ?? 0) / 4))}px`,
                            width: '100%',
                            borderRadius: 6,
                            background: 'var(--primary)',
                            display: 'block',
                            opacity: row.avgCoverage == null ? 0.25 : 1,
                          }}
                        />
                      </div>
                    </article>
                  ))
                )}
              </div>
            ) : null}

            {selected && tab === 'opportunity' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Opportunity assessment</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Downstream opportunities</dt>
                      <dd>{selected.opportunityCount}</dd>
                    </div>
                    <div>
                      <dt>Global opportunity score</dt>
                      <dd>{metrics?.opportunityScore ?? 0}%</dd>
                    </div>
                    <div>
                      <dt>Research readiness</dt>
                      <dd>{metrics?.researchReadiness ?? 0}%</dd>
                    </div>
                    <div>
                      <dt>Demand correlation</dt>
                      <dd>{measured(selected.demandScore)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Handoff path</h3>
                  <p>
                    Validated gaps with linked opportunities feed candidate generation, verification,
                    and Stage 03 Idea Qualification.
                  </p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Why this gap exists</h3>
                  <p>{selected.summary}</p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Comparison logic</dt>
                      <dd>
                        Detected as {selected.signalType} against Strategy v
                        {overview?.strategy?.versionNumber ?? '—'} / Knowledge Universe coverage
                      </dd>
                    </div>
                    <div>
                      <dt>Confidence basis</dt>
                      <dd>
                        {selected.measuredConfidence
                          ? `Persisted signal confidence ${Math.round(selected.confidence)}`
                          : 'UNMEASURED (confidence < 1 or absent)'}
                      </dd>
                    </div>
                    <div>
                      <dt>Evidence quality</dt>
                      <dd>
                        Coverage {measured(selected.evidenceCoverage)} · source{' '}
                        {display(selected.sourceName)}
                      </dd>
                    </div>
                    <div>
                      <dt>Audience demand</dt>
                      <dd>{measured(selected.demandScore)}</dd>
                    </div>
                    <div>
                      <dt>Strategic alignment</dt>
                      <dd>
                        Importance {measured(selected.strategicImportance)} · run{' '}
                        {selected.runId.slice(0, 8)}…
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'dependencies' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Upstream</h3>
                  <ul className={styles.bulletList}>
                    <li>Stage 01 Strategy package (ACK)</li>
                    <li>Knowledge Universe / domain taxonomy</li>
                    <li>Discovery, trends, audience demand signals</li>
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Downstream</h3>
                  <ul className={styles.bulletList}>
                    <li>Topic opportunities & candidates</li>
                    <li>Research & evidence planning</li>
                    <li>Stage 03 Idea Qualification</li>
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Version reference</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Strategy</dt>
                      <dd>v{overview?.strategy?.versionNumber ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Latest run</dt>
                      <dd>{display(overview?.run?.id?.slice(0, 8))}</dd>
                    </div>
                    <div>
                      <dt>Selected gap</dt>
                      <dd>{display(selected?.id?.slice(0, 8))}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {selected && tab === 'history' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Gap timeline</h3>
                  <ul className={styles.timeline}>
                    <li>
                      <CircleDot size={14} aria-hidden />
                      <div>
                        <strong>Signal created</strong>
                        <span>{new Date(selected.createdAt).toLocaleString()}</span>
                      </div>
                    </li>
                    <li>
                      <Activity size={14} aria-hidden />
                      <div>
                        <strong>Observed</strong>
                        <span>
                          {selected.observedAt
                            ? new Date(selected.observedAt).toLocaleString()
                            : 'Not supplied'}
                        </span>
                      </div>
                    </li>
                    <li>
                      <CheckCircle2 size={14} aria-hidden />
                      <div>
                        <strong>Current status</strong>
                        <span>
                          {selected.status} · {selected.severity}
                        </span>
                      </div>
                    </li>
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Audit trail</h3>
                  {!audit.length ? (
                    <p className={styles.lede}>No gap-related audit events persisted yet.</p>
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
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.insights}`} aria-label="AI Insights">
          <div className={styles.panelHead}>
            <h2>AI Insights</h2>
            <BrainCircuit size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightStack}>
              <article className={styles.insightCard}>
                <h3>Gap severity</h3>
                <p>{selected?.severity ?? '—'}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Business impact</h3>
                <p>{measured(selected?.businessImpact)}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Confidence</h3>
                <p>
                  {selected?.measuredConfidence
                    ? `${Math.round(selected.confidence)}`
                    : (metrics?.measuredConfidence ?? 0) > 0
                      ? `${metrics?.avgConfidence}% average`
                      : 'UNMEASURED'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Recommendations</h3>
                <ul className={styles.bulletList}>
                  {!overview?.strategy ? (
                    <li>Acknowledge an active Strategy package to unlock gap detection.</li>
                  ) : null}
                  {overview?.strategy && gaps.length === 0 ? (
                    <li>Keep the system RUNNING until discovery persists gap signals.</li>
                  ) : null}
                  {(metrics?.criticalGaps ?? 0) > 0 ? (
                    <li>Prioritise critical gaps for research and candidate generation.</li>
                  ) : null}
                  {(metrics?.missingEvidence ?? 0) > 0 ? (
                    <li>Attach sources before treating gaps as validated opportunities.</li>
                  ) : null}
                  {(metrics?.duplicateGaps ?? 0) > 0 ? (
                    <li>Deduplicate overlapping gap topics before scoring.</li>
                  ) : null}
                  {(metrics?.opportunityScore ?? 0) > 0 ? (
                    <li>Mapped gaps are ready for Stage 03 Idea Qualification review.</li>
                  ) : null}
                </ul>
              </article>
              <article className={styles.insightCard}>
                <h3>Detected issues</h3>
                {!issues.length ? (
                  <p>No open knowledge-gap anomalies in persisted state.</p>
                ) : (
                  <ul className={styles.bulletList}>
                    {issues.slice(0, 6).map((issue) => (
                      <li key={issue.id}>
                        [{issue.severity}] {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.bottom} aria-label="Knowledge gap monitoring">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Health monitoring</h2>
            <AlertTriangle size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Weak coverage</dt>
                <dd>{metrics?.weakCoverage ?? 0}</dd>
              </div>
              <div>
                <dt>Stale knowledge</dt>
                <dd>{metrics?.staleKnowledge ?? 0}</dd>
              </div>
              <div>
                <dt>Missing evidence</dt>
                <dd>{metrics?.missingEvidence ?? 0}</dd>
              </div>
              <div>
                <dt>Duplicate gaps</dt>
                <dd>{metrics?.duplicateGaps ?? 0}</dd>
              </div>
            </dl>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Re-evaluation</h2>
            <RefreshCw size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              Gaps re-evaluate automatically when discovery writes new KNOWLEDGE_GAP / SEARCH_GAP
              signals or metadata. This page is observe-only.
            </p>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Performance</h2>
            <CheckCircle2 size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Coverage score</dt>
                <dd>{metrics?.coverageScore ?? 0}</dd>
              </div>
              <div>
                <dt>Research readiness</dt>
                <dd>{metrics?.researchReadiness ?? 0}%</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>
                  {overview?.lastUpdated
                    ? new Date(overview.lastUpdated).toLocaleString()
                    : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </article>
      </section>
    </motion.main>
  );
}

function withCoverageLabel(coverageScore: number, knowledgeGaps: number) {
  if (knowledgeGaps === 0) return '0';
  if (coverageScore === 0) return 'UNMEAS.';
  return String(coverageScore);
}
