'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Download,
  GitBranch,
  Lock,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
  XCircle,
} from 'lucide-react';
import type {
  GateCandidate,
  MandatoryGatesOverview,
} from '@/lib/idea-qualification/gates';
import { qualificationApi } from '@/apps/web/lib/qualification-api';
import styles from './mandatory-gates.module.css';

type TabId =
  | 'overview'
  | 'matrix'
  | 'table'
  | 'rules'
  | 'sequence'
  | 'dependencies'
  | 'explain'
  | 'remediation'
  | 'overrides'
  | 'alerts'
  | 'history'
  | 'bottlenecks'
  | 'performance'
  | 'recommendations'
  | 'governance'
  | 'analytics'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'matrix', label: 'Gates Matrix' },
  { id: 'table', label: 'Candidates' },
  { id: 'rules', label: 'Rule Catalog' },
  { id: 'sequence', label: 'Sequencing' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'explain', label: 'Explainability' },
  { id: 'remediation', label: 'Remediation' },
  { id: 'overrides', label: 'Overrides' },
  { id: 'alerts', label: 'Validation Alerts' },
  { id: 'history', label: 'Execution History' },
  { id: 'bottlenecks', label: 'Bottlenecks' },
  { id: 'performance', label: 'Gate Performance' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'governance', label: 'Governance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit' },
];

const EMPTY_COPY =
  'The Autonomous AI Decision Gate Centre evaluates every scored idea against non-negotiable governance, compliance, legal, ethical, quality, production, commercial, security, and business rules. Absolute thresholds cannot be overridden by a high total score. Candidates proceed to Qualified Ranking only when every mandatory gate is satisfied; otherwise they are halted, categorized, and routed for remediation without human intervention from this page.';

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'PASS':
    case 'PASSED':
    case 'PROCEED':
    case 'RUNNING':
    case 'LOW':
      return styles.toneReady;
    case 'FAIL':
    case 'FAILED':
    case 'BLOCKED':
    case 'HALT & REMEDIATE':
    case 'CRITICAL':
    case 'HIGH':
      return styles.toneBlocked;
    case 'REVIEW':
    case 'CONDITIONAL':
    case 'PENDING':
    case 'AWAIT EVALUATION':
    case 'WARNING':
    case 'OBSERVE_ONLY':
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

function formatMs(ms?: number | null) {
  if (ms == null) return 'UNMEAS.';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

function sparkBars(seed: number) {
  return [4, 7, 5, 9, 6, 10, 8].map((base, index) =>
    Math.max(3, ((base + seed + index * 2) % 10) + 3),
  );
}

function exportPayload(overview: MandatoryGatesOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mandatory-gates-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'id',
    'title',
    'outcome',
    'recommendation',
    'compliance',
    'passed',
    'failed',
    'blocking',
    'score',
    'gateStatus',
  ];
  const lines = [
    header.join(','),
    ...overview.candidates.map((item) =>
      [
        item.id,
        JSON.stringify(item.title),
        item.outcome,
        item.recommendation,
        item.complianceScore ?? '',
        item.passedCount,
        item.failedCount,
        item.blockingCount,
        item.overallScore ?? '',
        item.gateStatus,
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mandatory-gates-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function MandatoryGatesWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<MandatoryGatesOverview | null>(null);
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
        qualificationApi.gates(),
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
    () => [...new Set(candidates.map((item) => item.outcome))].sort(),
    [candidates],
  );

  const filtered = useMemo(
    () =>
      candidates.filter((item) => {
        if (statusFilter !== 'all' && item.outcome !== statusFilter) return false;
        if (!needle) return true;
        const haystack = [
          item.title,
          item.domain,
          item.outcome,
          item.recommendation,
          item.gateStatus,
          ...item.failedCriteria,
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
        label: 'Total Candidates',
        value: String(m?.totalCandidates ?? 0),
        meta: 'Stage 03 pool',
        accent: '#2563EB',
        icon: Scale,
        bars: sparkBars(m?.totalCandidates ?? 0),
        drill: 'table' as TabId,
      },
      {
        label: 'Passed Gates',
        value: String(m?.passedGates ?? 0),
        meta: 'All gates Pass',
        accent: '#22C55E',
        icon: CheckCircle2,
        bars: sparkBars(m?.passedGates ?? 0),
        drill: 'matrix' as TabId,
      },
      {
        label: 'Failed Gates',
        value: String(m?.failedGates ?? 0),
        meta: 'Halt & remediate',
        accent: '#EF4444',
        icon: XCircle,
        bars: sparkBars(m?.failedGates ?? 0),
        drill: 'remediation' as TabId,
      },
      {
        label: 'Conditional Approval',
        value: String(m?.conditionalApproval ?? 0),
        meta: 'Review path',
        accent: '#F59E0B',
        icon: AlertTriangle,
        bars: sparkBars(m?.conditionalApproval ?? 0),
        drill: 'overrides' as TabId,
      },
      {
        label: 'Blocked Items',
        value: String(m?.blockedItems ?? 0),
        meta: 'Blocking failures',
        accent: '#B91C1C',
        icon: Lock,
        bars: sparkBars(m?.blockedItems ?? 0),
        drill: 'alerts' as TabId,
      },
      {
        label: 'Compliance Score',
        value: m?.complianceScore != null ? `${m.complianceScore}%` : 'UNMEAS.',
        meta: 'Pass rate across gate cells',
        accent: '#0EA5E9',
        icon: ShieldCheck,
        bars: sparkBars(m?.complianceScore ?? 0),
        drill: 'performance' as TabId,
      },
      {
        label: 'Governance Health',
        value: m?.governanceHealth != null ? `${m.governanceHealth}%` : 'UNMEAS.',
        meta: 'Complete evaluations + audit',
        accent: '#7C3AED',
        icon: ShieldAlert,
        bars: sparkBars(m?.governanceHealth ?? 0),
        drill: 'governance' as TabId,
      },
      {
        label: 'Average Decision Time',
        value: formatMs(m?.averageDecisionTimeMs),
        meta: 'Score → gate evaluation',
        accent: '#14B8A6',
        icon: Timer,
        bars: sparkBars(m?.averageDecisionTimeMs ?? 0),
        drill: 'history' as TabId,
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
        <p className={styles.crumb}>Idea Qualification / Mandatory Gates</p>
        <h1 className={styles.title}>Autonomous AI Decision Gate Centre</h1>
        <section className={styles.unavailable}>
          <AlertTriangle size={18} aria-hidden />
          <div>
            <strong>Mandatory Gates unavailable</strong>
            <p>{overview?.reason || error || 'Unable to load gate ledger.'}</p>
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
            Content Lifecycle / 03 Idea Qualification / Mandatory Gates
          </p>
          <h1 className={styles.title}>Autonomous AI Decision Gate Centre</h1>
          <p className={styles.lede}>
            Apply absolute thresholds that a high total score cannot override — before Qualified
            Ranking.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 03 Gates</span>
          <span className={`${styles.badge} ${statusTone(overview.meta.cycleStatus)}`}>
            Cycle {overview.meta.cycleStatus}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Rules {overview.meta.ruleProfile}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous absolute gates</strong>
          Results come from persisted <code>iq_gate_results</code> and thresholds on{' '}
          <code>iq_scores</code>. When gate rows are absent, Pass/Fail is derived from persisted
          factors using the default / stored rule catalog — never invented. Override routes are
          observe-only; humans only use the global Start / Pause / Resume / Stop bar.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Gate KPIs">
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

      <section className={styles.lifecycle} aria-label="Gate pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Mandatory gate workflow</h2>
          <span>
            Score → Rules → Sequence → Validate → Explain → Alerts → Decision → Route → Audit →
            Ranking
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
            Mandatory gates evaluate after Qualification Scoring persists factor scores and
            thresholds.
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>{EMPTY_COPY}</h2>
            <p className={styles.lede}>
              Score Ready → Load Rules → Gate Sequencing → Validate Thresholds → Explain → Alerts →
              Pass/Fail/Review → Proceed or Remediate → Audit → Qualified Ranking.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Load</strong>
              Rule catalog
            </li>
            <li>
              <strong>2. Evaluate</strong>
              Absolute thresholds
            </li>
            <li>
              <strong>3. Halt</strong>
              Failures &amp; blocks
            </li>
            <li>
              <strong>4. Advance</strong>
              Ranking only if Pass
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Gates workspace">
        <aside className={styles.panel} aria-label="Gate Explorer">
          <div className={styles.panelHead}>
            <h2>Gate Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Candidate, domain, gate, outcome…"
              />
            </label>
            <label className={styles.field}>
              <span>Outcome</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All outcomes</option>
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
                        {item.passedCount}/{item.gates.length} pass · {item.recommendation}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.outcome)}`}>
                          {item.outcome}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Gate detail">
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
                      <dt>Outcome</dt>
                      <dd>
                        <span className={`${styles.chip} ${statusTone(selected.outcome)}`}>
                          {selected.outcome}
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
                      <dt>Compliance</dt>
                      <dd>
                        {selected.complianceScore != null
                          ? `${selected.complianceScore}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Score</dt>
                      <dd>{selected.overallScore ?? 'UNMEASURED'}</dd>
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
                      <dt>Passed / Failed</dt>
                      <dd>
                        {metrics?.passedGates ?? 0} / {metrics?.failedGates ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt>Conditional / Blocked</dt>
                      <dd>
                        {metrics?.conditionalApproval ?? 0} / {metrics?.blockedItems ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt>Proceed</dt>
                      <dd>{metrics?.proceedCount ?? 0}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'matrix' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Mandatory gates matrix · {selected.title}</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Gate</th>
                        <th>Status</th>
                        <th>Actual</th>
                        <th>Required</th>
                        <th>Blocking</th>
                        <th>Confidence</th>
                        <th>Reasoning</th>
                        <th>Evidence</th>
                        <th>Remediation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.gates.map((row) => (
                        <tr key={row.code}>
                          <td>{row.label}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                          <td>{row.actual ?? 'UNMEAS.'}</td>
                          <td>{display(row.required)}</td>
                          <td>{row.blocking ? 'Yes' : 'No'}</td>
                          <td>
                            {row.confidence != null ? `${row.confidence}%` : 'UNMEAS.'}
                          </td>
                          <td>{row.reasoning}</td>
                          <td>{display(row.evidence)}</td>
                          <td>{display(row.remediation)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'table' ? (
              <CandidateTable items={filtered} onSelect={setSelectedId} />
            ) : null}

            {tab === 'rules' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Configurable rule catalog (observe-only)</h3>
                  <p className={styles.lede}>
                    Thresholds reflect default gates
                    {overview.meta.ruleProfile === 'persisted'
                      ? ' with persisted iq_scores.thresholds_json overlays where present'
                      : ''}
                    . Editing rules is not available from this section view.
                  </p>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Code</th>
                        <th>Label</th>
                        <th>Category</th>
                        <th>Threshold</th>
                        <th>Required</th>
                        <th>Blocking</th>
                        <th>Depends on</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.ruleCatalog.map((row) => (
                        <tr key={row.code}>
                          <td>{row.sequence}</td>
                          <td>{row.code}</td>
                          <td>{row.label}</td>
                          <td>{row.category}</td>
                          <td>{row.threshold ?? '—'}</td>
                          <td>{row.required}</td>
                          <td>{row.blocking ? 'Yes' : 'No'}</td>
                          <td>{row.dependsOn.join(', ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'sequence' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Gate sequencing</h3>
                  <div className={styles.waterfall}>
                    {selected.gates.map((row, index) => (
                      <div key={row.code} className={styles.waterfallRow}>
                        <span>
                          {index + 1}. {row.label}
                        </span>
                        <div className={styles.radarBar}>
                          <i
                            className={styles.radarFill}
                            style={{
                              width: `${
                                row.status === 'Pass'
                                  ? 100
                                  : row.status === 'Fail' || row.status === 'Blocked'
                                    ? 35
                                    : row.status === 'Review'
                                      ? 60
                                      : 10
                              }%`,
                            }}
                          />
                        </div>
                        <strong>
                          <span className={`${styles.chip} ${statusTone(row.status)}`}>
                            {row.status}
                          </span>
                        </strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'dependencies' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    <GitBranch size={14} aria-hidden /> Dependency visualization
                  </h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>From</th>
                        <th>To</th>
                        <th>Edge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.dependencies.map((row) => (
                        <tr key={row.label}>
                          <td>{row.from}</td>
                          <td>{row.to}</td>
                          <td>{row.label}</td>
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
                    Explainable decision · <strong>{selected.recommendation}</strong>
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
                    · Policy {display(selected.policyVersion)} · Model{' '}
                    {display(selected.modelVersion)}
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

            {tab === 'remediation' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Recommended remediation</h3>
                  <p className={styles.lede}>
                    Failed criteria: {selected.failedCriteria.join(', ') || 'None'}
                  </p>
                  <ul className={styles.bulletList}>
                    {selected.remediations.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                  {!selected.remediations.length ? (
                    <p className={styles.lede}>No remediation required for this candidate.</p>
                  ) : null}
                </article>
              </div>
            ) : null}

            {tab === 'overrides' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Override requests (observe-only)</h3>
                  <p className={styles.lede}>
                    This page does not submit override tickets. Routes are shown for governance
                    transparency only.
                  </p>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Route</th>
                        <th>Reason</th>
                        <th>Priority</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.overrides.map((row) => (
                        <tr key={`${row.route}-${row.reason}`}>
                          <td>{row.route}</td>
                          <td>{row.reason}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(row.priority)}`}>
                              {row.priority}
                            </span>
                          </td>
                          <td>{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!selected.overrides.length ? (
                    <p className={styles.lede}>No override path indicated for this outcome.</p>
                  ) : null}
                </article>
              </div>
            ) : null}

            {tab === 'alerts' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Real-time validation alerts</h3>
                  <ul className={styles.bulletList}>
                    {(overview.notifications ?? []).map((row) => (
                      <li key={row.id}>
                        <span className={`${styles.chip} ${statusTone(row.severity)}`}>
                          {row.severity}
                        </span>{' '}
                        {row.message}
                      </li>
                    ))}
                  </ul>
                  {!overview.notifications.length ? (
                    <p className={styles.lede}>No gate validation alerts yet.</p>
                  ) : null}
                </article>
              </div>
            ) : null}

            {tab === 'history' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Execution history</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Decision latency</dt>
                      <dd>{formatMs(selected.decisionMs)}</dd>
                    </div>
                    <div>
                      <dt>Evaluated at</dt>
                      <dd>
                        {selected.evaluatedAt
                          ? new Date(selected.evaluatedAt).toLocaleString()
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{new Date(selected.updatedAt).toLocaleString()}</dd>
                    </div>
                  </dl>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Gate</th>
                        <th>Status</th>
                        <th>Evaluated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.gates.map((row) => (
                        <tr key={row.code}>
                          <td>{row.label}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                          <td>
                            {row.evaluatedAt
                              ? new Date(row.evaluatedAt).toLocaleString()
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'bottlenecks' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Bottleneck analysis</h3>
                  {!overview.analytics.bottlenecks.length ? (
                    <p className={styles.lede}>No failing gate bottlenecks detected.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Gate</th>
                          <th>Fail count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.analytics.bottlenecks.map((row) => (
                          <tr key={row.code}>
                            <td>
                              {row.label} ({row.code})
                            </td>
                            <td>{row.failCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'performance' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Gate performance analytics</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Gate</th>
                        <th>Pass</th>
                        <th>Fail</th>
                        <th>Review</th>
                        <th>Pass rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.analytics.gatePerformance.map((row) => (
                        <tr key={row.code}>
                          <td>{row.label}</td>
                          <td>{row.pass}</td>
                          <td>{row.fail}</td>
                          <td>{row.review}</td>
                          <td>
                            {row.passRate != null ? `${row.passRate}%` : 'UNMEAS.'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <h3 style={{ marginTop: 20 }}>Pass / fail trend by gate</h3>
                  <div className={styles.waterfall}>
                    {overview.analytics.passFailTrend.map((row) => {
                      const total = row.pass + row.fail || 1;
                      return (
                        <div key={row.label} className={styles.waterfallRow}>
                          <span>{row.label}</span>
                          <div className={styles.radarBar}>
                            <i
                              className={styles.radarFill}
                              style={{ width: `${(row.pass / total) * 100}%` }}
                            />
                          </div>
                          <strong>
                            {row.pass}P / {row.fail}F
                          </strong>
                        </div>
                      );
                    })}
                  </div>
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
                    <p className={styles.lede}>No recommendations until gates evaluate.</p>
                  ) : null}
                </article>
              </div>
            ) : null}

            {tab === 'governance' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Governance &amp; policy versioning</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Model versions</dt>
                      <dd>{overview.governance.modelVersions.join(', ') || '—'}</dd>
                    </div>
                    <div>
                      <dt>Policy versions</dt>
                      <dd>{overview.governance.policyVersions.join(', ') || '—'}</dd>
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
                      <dt>Override requests (shown)</dt>
                      <dd>{overview.governance.overrideRequests}</dd>
                    </div>
                    <div>
                      <dt>Default min total</dt>
                      <dd>{overview.governance.defaultGates.minimumTotal}</dd>
                    </div>
                    <div>
                      <dt>Default max risk</dt>
                      <dd>{overview.governance.defaultGates.maxRisk}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Approval workflow</h3>
                  <p className={styles.lede}>
                    Autonomous path: Pass → Qualified Ranking. Fail/Blocked → remediation queue.
                    Conditional → observe-only review route. No human approval actions on this page.
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'analytics' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Outcome distribution</h3>
                  <ul className={styles.bulletList}>
                    {overview.analytics.outcomeDistribution.map((row) => (
                      <li key={row.label}>
                        {row.label}: <strong>{row.count}</strong>
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Portfolio health</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Compliance</dt>
                      <dd>
                        {metrics?.complianceScore != null
                          ? `${metrics.complianceScore}%`
                          : 'UNMEAS.'}
                      </dd>
                    </div>
                    <div>
                      <dt>Governance</dt>
                      <dd>
                        {metrics?.governanceHealth != null
                          ? `${metrics.governanceHealth}%`
                          : 'UNMEAS.'}
                      </dd>
                    </div>
                    <div>
                      <dt>Avg decision</dt>
                      <dd>{formatMs(metrics?.averageDecisionTimeMs)}</dd>
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
                    <p className={styles.lede}>No gate-related audit events yet.</p>
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
              'rules',
              'alerts',
              'bottlenecks',
              'performance',
              'recommendations',
              'governance',
              'analytics',
              'audit',
            ].includes(tab) ? (
              <div className={styles.emptyInline}>
                <p>Select a candidate from the Gate Explorer to inspect this panel.</p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className={styles.panel} aria-label="Gate insights">
          <div className={styles.panelHead}>
            <h2>Insights</h2>
            <span>Observe only</span>
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightStack}>
              <article className={styles.insightCard}>
                <h3>
                  <ShieldCheck size={14} aria-hidden /> Decision
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
                  <CheckCircle2 size={14} aria-hidden /> Next step
                </h3>
                <p>
                  {selected?.recommendation === 'Proceed'
                    ? 'Eligible for Qualified Ranking (autonomous)'
                    : selected?.recommendation === 'Await Evaluation'
                      ? 'Await gate evaluation'
                      : 'Halt — remediate failed absolute gates'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>
                  <XCircle size={14} aria-hidden /> Failures
                </h3>
                <p>
                  {selected?.failedCount ?? 0} fail · {selected?.blockingCount ?? 0} blocking
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>
                  <BrainCircuit size={14} aria-hidden /> Policy
                </h3>
                <p>
                  {selected?.policyVersion ??
                    overview.meta.policyVersions[0] ??
                    'UNMEASURED'}
                </p>
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

function CandidateTable({
  items,
  onSelect,
}: {
  items: GateCandidate[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>Candidate gate table</h3>
        {!items.length ? (
          <p className={styles.lede}>No candidates in the filtered set.</p>
        ) : (
          <table className={styles.auditTable}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Outcome</th>
                <th>Recommendation</th>
                <th>Compliance</th>
                <th>Pass</th>
                <th>Fail</th>
                <th>Blocking</th>
                <th>Score</th>
                <th>Failed criteria</th>
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
                  <td>
                    <span className={`${styles.chip} ${statusTone(item.outcome)}`}>
                      {item.outcome}
                    </span>
                  </td>
                  <td>{item.recommendation}</td>
                  <td>
                    {item.complianceScore != null ? `${item.complianceScore}%` : '—'}
                  </td>
                  <td>{item.passedCount}</td>
                  <td>{item.failedCount}</td>
                  <td>{item.blockingCount}</td>
                  <td>{item.overallScore ?? '—'}</td>
                  <td>{item.failedCriteria.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </div>
  );
}
