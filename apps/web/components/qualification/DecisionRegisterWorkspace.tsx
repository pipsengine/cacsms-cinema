'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Download,
  FileCheck2,
  Gavel,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
  XCircle,
} from 'lucide-react';
import type {
  DecisionRecord,
  DecisionRegisterOverview,
} from '@/lib/idea-qualification/decisions';
import { qualificationApi } from '@/apps/web/lib/qualification-api';
import styles from './decision-register.module.css';

type TabId =
  | 'overview'
  | 'table'
  | 'history'
  | 'factors'
  | 'evidence'
  | 'scores'
  | 'rules'
  | 'policy'
  | 'overrides'
  | 'approval'
  | 'signature'
  | 'versions'
  | 'timeline'
  | 'explain'
  | 'recommendations'
  | 'governance'
  | 'analytics'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'table', label: 'Decision Table' },
  { id: 'history', label: 'Decision History' },
  { id: 'factors', label: 'Factor Contribution' },
  { id: 'evidence', label: 'Evidence Trace' },
  { id: 'scores', label: 'Score Breakdown' },
  { id: 'rules', label: 'Governance Rules' },
  { id: 'policy', label: 'Policy References' },
  { id: 'overrides', label: 'Override Logs' },
  { id: 'approval', label: 'Approval Chain' },
  { id: 'signature', label: 'Digital Signature' },
  { id: 'versions', label: 'Version Compare' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'explain', label: 'Explainability' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'governance', label: 'Governance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit' },
];

const EMPTY_COPY =
  'The Autonomous AI Decision Governance Centre automatically records every qualification decision with full transparency, explainability, and governance. Qualify, Reject, Block, and Reassess outcomes are permanently written to the Decision Register with reasons, evidence, policy versions, model versions, and immutable audit events — then Approved ideas are routed to Selected Ideas without manual intervention from this page.';

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'QUALIFY':
    case 'APPROVED':
    case 'PASSED':
    case 'COMPLETE':
    case 'PERSISTED':
    case 'ELIGIBLE':
    case 'RUNNING':
    case 'BOUND':
    case 'SATISFIED':
    case 'WITHIN_LIMIT':
    case 'AUTONOMOUS':
    case 'RECORDED':
    case 'CLEAR':
      return styles.toneReady;
    case 'REJECT':
    case 'REJECTED':
    case 'BLOCK':
    case 'ESCALATED':
    case 'CRITICAL':
    case 'EXCEEDED_OR_BLOCKING':
    case 'FAILED':
      return styles.toneBlocked;
    case 'REASSESS':
    case 'DEFERRED':
    case 'PENDING':
    case 'OVERRIDDEN':
    case 'WARNING':
    case 'OBSERVE_ONLY':
    case 'UNMEASURED':
    case 'NOT_PASSED':
    case 'CANDIDATE_FIELD_ONLY':
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

function exportPayload(overview: DecisionRegisterOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `decision-register-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'candidateId',
    'title',
    'decision',
    'score',
    'confidence',
    'approval',
    'reason',
    'risk',
    'version',
    'timestamp',
    'model',
    'policy',
    'stage',
  ];
  const lines = [
    header.join(','),
    ...overview.records.map((item) =>
      [
        item.candidateId,
        JSON.stringify(item.title),
        item.finalDecision,
        item.qualificationScore ?? '',
        item.confidence ?? '',
        item.approvalStatus,
        JSON.stringify(item.decisionReason),
        item.riskAssessment.score ?? '',
        item.decisionVersion,
        item.timestamp,
        item.modelVersion ?? '',
        item.policyVersion ?? '',
        JSON.stringify(item.workflowStage),
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `decision-register-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DecisionRegisterWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<DecisionRegisterOverview | null>(null);
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
        qualificationApi.decisions(),
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
      const selected = targetId
        ? items.find((item) => item.id === targetId || item.candidateId === targetId)
        : items[0];
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

  const records = overview?.records ?? [];
  const metrics = overview?.metrics;
  const needle = query.trim().toLowerCase();

  const statuses = useMemo(
    () => [...new Set(records.map((item) => item.finalDecision))].sort(),
    [records],
  );

  const filtered = useMemo(
    () =>
      records.filter((item) => {
        if (statusFilter !== 'all' && item.finalDecision !== statusFilter) return false;
        if (!needle) return true;
        const haystack = [
          item.title,
          item.candidateId,
          item.finalDecision,
          item.approvalStatus,
          item.decisionReason,
          item.domain,
          item.workflowStage,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      }),
    [needle, records, statusFilter],
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

  const kpis = useMemo(() => {
    const m = metrics;
    return [
      {
        label: 'Approved Ideas',
        value: String(m?.approvedIdeas ?? 0),
        meta: 'QUALIFY decisions',
        accent: '#22C55E',
        icon: CheckCircle2,
        bars: sparkBars(m?.approvedIdeas ?? 0),
        drill: 'table' as TabId,
      },
      {
        label: 'Rejected Ideas',
        value: String(m?.rejectedIdeas ?? 0),
        meta: 'REJECT decisions',
        accent: '#EF4444',
        icon: XCircle,
        bars: sparkBars(m?.rejectedIdeas ?? 0),
        drill: 'table' as TabId,
      },
      {
        label: 'Deferred Reviews',
        value: String(m?.deferredReviews ?? 0),
        meta: 'REASSESS decisions',
        accent: '#F59E0B',
        icon: Timer,
        bars: sparkBars(m?.deferredReviews ?? 0),
        drill: 'history' as TabId,
      },
      {
        label: 'Escalated Decisions',
        value: String(m?.escalatedDecisions ?? 0),
        meta: 'BLOCK decisions',
        accent: '#B91C1C',
        icon: ShieldAlert,
        bars: sparkBars(m?.escalatedDecisions ?? 0),
        drill: 'overrides' as TabId,
      },
      {
        label: 'AI Confidence',
        value: m?.aiConfidence != null ? `${m.aiConfidence}%` : 'UNMEAS.',
        meta: 'Avg score confidence',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(m?.aiConfidence ?? 0),
        drill: 'explain' as TabId,
      },
      {
        label: 'Governance Compliance',
        value: m?.governanceCompliance != null ? `${m.governanceCompliance}%` : 'UNMEAS.',
        meta: 'Persisted iq_decisions coverage',
        accent: '#0EA5E9',
        icon: ShieldCheck,
        bars: sparkBars(m?.governanceCompliance ?? 0),
        drill: 'governance' as TabId,
      },
      {
        label: 'Override Requests',
        value: String(m?.overrideRequests ?? 0),
        meta: 'Human / override paths recorded',
        accent: '#F97316',
        icon: Gavel,
        bars: sparkBars(m?.overrideRequests ?? 0),
        drill: 'overrides' as TabId,
      },
      {
        label: 'Decision Accuracy',
        value: m?.decisionAccuracy != null ? `${m.decisionAccuracy}%` : 'UNMEAS.',
        meta: 'Register vs candidate.decision sync',
        accent: '#2563EB',
        icon: FileCheck2,
        bars: sparkBars(m?.decisionAccuracy ?? 0),
        drill: 'analytics' as TabId,
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
        <p className={styles.crumb}>Idea Qualification / Decision Register</p>
        <h1 className={styles.title}>Autonomous AI Decision Governance Centre</h1>
        <section className={styles.unavailable}>
          <AlertTriangle size={18} aria-hidden />
          <div>
            <strong>Decision Register unavailable</strong>
            <p>{overview?.reason || error || 'Unable to load decision ledger.'}</p>
          </div>
          <button type="button" className={styles.chip} onClick={() => void load()}>
            Retry
          </button>
        </section>
      </main>
    );
  }

  const showEmpty = !records.length;
  const showWaiting =
    !overview.meta.intakeStatus && overview.meta.cycleStatus === 'NOT_STARTED' && showEmpty;

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 03 Idea Qualification / Decision Register
          </p>
          <h1 className={styles.title}>Autonomous AI Decision Governance Centre</h1>
          <p className={styles.lede}>
            Retain explainable qualify, reject, block, and reassess decisions — then route Approved
            ideas to Selected Ideas.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 03 Decisions</span>
          <span className={`${styles.badge} ${statusTone(overview.meta.cycleStatus)}`}>
            Cycle {overview.meta.cycleStatus}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            {overview.metrics.totalDecisions} rows
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · immutable decision governance</strong>
          Decisions come from persisted <code>iq_decisions</code> (with candidate field fallback).
          Override and approval-chain panels are observe-only — this page does not create human
          approvals. Decision Accuracy stays UNMEASURED until register and candidate fields can be
          compared.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Decision KPIs">
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

      <section className={styles.lifecycle} aria-label="Decision pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Decision governance workflow</h2>
          <span>
            Rank → Evaluate → Explain → Govern → Register → Audit → Notify → Selected Ideas
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
            <strong>Waiting for qualification decisions</strong>
            The register populates when the autonomous cycle writes <code>iq_decisions</code> after
            ranking.
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>{EMPTY_COPY}</h2>
            <p className={styles.lede}>
              Ranking Complete → Evaluate Decision → Explain → Apply Governance → Write Register →
              Immutable Audit → Notify → Route to Selected Ideas.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Decide</strong>
              Qualify / Reject / Block / Reassess
            </li>
            <li>
              <strong>2. Explain</strong>
              Reasons &amp; evidence
            </li>
            <li>
              <strong>3. Govern</strong>
              Policy &amp; audit
            </li>
            <li>
              <strong>4. Route</strong>
              Selected Ideas
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Decision workspace">
        <aside className={styles.panel} aria-label="Decision Explorer">
          <div className={styles.panelHead}>
            <h2>Decision Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Candidate, decision, reason…"
              />
            </label>
            <label className={styles.field}>
              <span>Decision</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All decisions</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No decisions match the current filters.</p>
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
                        {item.finalDecision} · v{item.decisionVersion} ·{' '}
                        {item.qualificationScore ?? '—'}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.approvalStatus)}`}>
                          {item.approvalStatus}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Decision detail">
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
                  <h3>Decision overview</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Candidate ID</dt>
                      <dd>{selected.candidateId}</dd>
                    </div>
                    <div>
                      <dt>Title</dt>
                      <dd>{selected.title}</dd>
                    </div>
                    <div>
                      <dt>Final decision</dt>
                      <dd>
                        <span className={`${styles.chip} ${statusTone(selected.finalDecision)}`}>
                          {selected.finalDecision}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Approval</dt>
                      <dd>
                        <span className={`${styles.chip} ${statusTone(selected.approvalStatus)}`}>
                          {selected.approvalStatus}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Score / Confidence</dt>
                      <dd>
                        {selected.qualificationScore ?? 'UNMEAS.'} /{' '}
                        {selected.measuredConfidence
                          ? `${selected.confidence}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Workflow stage</dt>
                      <dd>{selected.workflowStage}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Explainable summary</h3>
                  <p>{selected.explainableSummary}</p>
                  <ul className={styles.bulletList}>
                    {selected.explainability.slice(0, 6).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Register snapshot</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Approved / Rejected</dt>
                      <dd>
                        {metrics?.approvedIdeas ?? 0} / {metrics?.rejectedIdeas ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt>Deferred / Escalated</dt>
                      <dd>
                        {metrics?.deferredReviews ?? 0} / {metrics?.escalatedDecisions ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt>Total decision rows</dt>
                      <dd>{metrics?.totalDecisions ?? 0}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'table' ? (
              <DecisionTable items={filtered} onSelect={setSelectedId} />
            ) : null}

            {tab === 'history' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Decision history</h3>
                  {!selected.history.length ? (
                    <p className={styles.lede}>
                      No <code>iq_decisions</code> history rows — showing candidate field only.
                    </p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Decision</th>
                          <th>Source</th>
                          <th>Policy</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.history.map((row) => (
                          <tr key={row.id}>
                            <td>{new Date(row.createdAt).toLocaleString()}</td>
                            <td>
                              <span className={`${styles.chip} ${statusTone(row.decision)}`}>
                                {row.decision}
                              </span>
                            </td>
                            <td>{row.source}</td>
                            <td>{display(row.policyVersion)}</td>
                            <td>{row.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'factors' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Factor contribution</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Factor</th>
                        <th>Value</th>
                        <th>Weight %</th>
                        <th>Contribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.factorContribution.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{row.value ?? 'UNMEAS.'}</td>
                          <td>{row.weight ?? '—'}</td>
                          <td>{row.contribution ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'evidence' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Evidence traceability</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Evidence</th>
                        <th>Status</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.supportingEvidence.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                          <td>{row.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className={styles.lede} style={{ marginTop: 12 }}>
                    Risk: {selected.riskAssessment.band} ·{' '}
                    {selected.riskAssessment.detail}
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'scores' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Score breakdown</h3>
                  <div className={styles.waterfall}>
                    {selected.scoreBreakdown.map((row) => (
                      <div key={row.label} className={styles.waterfallRow}>
                        <span>{row.label}</span>
                        <div className={styles.radarBar}>
                          <i
                            className={styles.radarFill}
                            style={{
                              width: `${Math.max(0, Math.min(100, Number(row.value) || 0))}%`,
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

            {tab === 'rules' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Governance rules applied</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Rule</th>
                        <th>Result</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.governanceRules.map((row) => (
                        <tr key={row.code}>
                          <td>{row.code}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(row.result)}`}>
                              {row.result}
                            </span>
                          </td>
                          <td>{row.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'policy' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Policy references</h3>
                  <ul className={styles.bulletList}>
                    {selected.policyReferences.map((ref) => (
                      <li key={ref}>{ref}</li>
                    ))}
                  </ul>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Policy version</dt>
                      <dd>{display(selected.policyVersion)}</dd>
                    </div>
                    <div>
                      <dt>Model version</dt>
                      <dd>{display(selected.modelVersion)}</dd>
                    </div>
                    <div>
                      <dt>Decision source</dt>
                      <dd>{selected.decisionSource}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'overrides' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Human override logs (observe-only)</h3>
                  {!selected.overrideLogs.length ? (
                    <p className={styles.lede}>No override paths recorded for this decision.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Actor</th>
                          <th>Action</th>
                          <th>Status</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.overrideLogs.map((row) => (
                          <tr key={`${row.at}-${row.action}-${row.actor}`}>
                            <td>{new Date(row.at).toLocaleString()}</td>
                            <td>{row.actor}</td>
                            <td>{row.action}</td>
                            <td>{row.status}</td>
                            <td>{row.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'approval' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Approval chain</h3>
                  <ul className={styles.timeline}>
                    {selected.approvalChain.map((step) => (
                      <li key={step.step}>
                        <CircleDot size={14} aria-hidden />
                        <div>
                          <strong>{step.step}</strong>
                          <span>
                            {step.actor} ·{' '}
                            <span className={`${styles.chip} ${statusTone(step.status)}`}>
                              {step.status}
                            </span>
                            {step.at ? ` · ${new Date(step.at).toLocaleString()}` : ''}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'signature' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Digital signature / integrity token</h3>
                  <p className={styles.lede}>
                    {selected.digitalSignature ??
                      'UNMEASURED — signature available after iq_decisions persistence'}
                  </p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Decision version</dt>
                      <dd>{selected.decisionVersion}</dd>
                    </div>
                    <div>
                      <dt>Timestamp</dt>
                      <dd>{new Date(selected.timestamp).toLocaleString()}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'versions' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Version comparison</h3>
                  {!selected.versionComparison.length ? (
                    <p className={styles.lede}>No versioned decision history to compare.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Version</th>
                          <th>Decision</th>
                          <th>Score</th>
                          <th>Source</th>
                          <th>Changed</th>
                          <th>At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.versionComparison.map((row) => (
                          <tr key={`${row.version}-${row.at}`}>
                            <td>v{row.version}</td>
                            <td>
                              <span className={`${styles.chip} ${statusTone(row.decision)}`}>
                                {row.decision}
                              </span>
                            </td>
                            <td>{row.score ?? '—'}</td>
                            <td>{row.source}</td>
                            <td>{row.changed ? 'Yes' : 'No'}</td>
                            <td>{new Date(row.at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'timeline' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Decision timeline</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Title</th>
                        <th>Decision</th>
                        <th>Approval</th>
                        <th>Stage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 40).map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.timestamp).toLocaleString()}</td>
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
                          <td>
                            <span className={`${styles.chip} ${statusTone(row.finalDecision)}`}>
                              {row.finalDecision}
                            </span>
                          </td>
                          <td>{row.approvalStatus}</td>
                          <td>{row.workflowStage}</td>
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
                    Explainable decision · <strong>{selected.finalDecision}</strong>
                  </h3>
                  <p>{selected.decisionReason}</p>
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
              </div>
            ) : null}

            {tab === 'recommendations' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Routing recommendations</h3>
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
                    <p className={styles.lede}>No recommendations until decisions persist.</p>
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
                      <dt>Policy versions</dt>
                      <dd>{overview.governance.policyVersions.join(', ') || '—'}</dd>
                    </div>
                    <div>
                      <dt>Decisions logged</dt>
                      <dd>{overview.governance.decisionsLogged}</dd>
                    </div>
                    <div>
                      <dt>Override count</dt>
                      <dd>{overview.governance.overrideCount}</dd>
                    </div>
                    <div>
                      <dt>Audit events</dt>
                      <dd>{overview.governance.auditEvents}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Compliance dashboard</h3>
                  <ul className={styles.bulletList}>
                    {overview.analytics.complianceDashboard.map((row) => (
                      <li key={row.label}>
                        {row.label}:{' '}
                        <strong>{row.value != null ? `${row.value}` : 'UNMEAS.'}</strong>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'analytics' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Decision distribution</h3>
                  <ul className={styles.bulletList}>
                    {overview.analytics.decisionDistribution.map((row) => (
                      <li key={row.label}>
                        {row.label}: <strong>{row.count}</strong>
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Approval trends</h3>
                  {!overview.analytics.approvalTrends.length ? (
                    <p className={styles.lede}>No daily decision trends yet.</p>
                  ) : (
                    <div className={styles.waterfall}>
                      {overview.analytics.approvalTrends.map((row) => (
                        <div key={row.label} className={styles.waterfallRow}>
                          <span>{row.label}</span>
                          <div className={styles.radarBar}>
                            <i
                              className={styles.radarFill}
                              style={{
                                width: `${Math.max(
                                  8,
                                  Math.min(
                                    100,
                                    ((row.approved + row.rejected) || 1) * 12,
                                  ),
                                )}%`,
                              }}
                            />
                          </div>
                          <strong>
                            {row.approved}A / {row.rejected}R
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
                <article className={styles.detailCard}>
                  <h3>Source mix</h3>
                  <ul className={styles.bulletList}>
                    {overview.analytics.sourceDistribution.map((row) => (
                      <li key={row.label}>
                        {row.label}: <strong>{row.count}</strong>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Immutable audit trail</h3>
                  {!overview.audit.length ? (
                    <p className={styles.lede}>No decision-related audit events yet.</p>
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
              'timeline',
              'recommendations',
              'governance',
              'analytics',
              'audit',
            ].includes(tab) ? (
              <div className={styles.emptyInline}>
                <p>Select a decision from the explorer to inspect this panel.</p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className={styles.panel} aria-label="Decision insights">
          <div className={styles.panelHead}>
            <h2>Insights</h2>
            <span>Observe only</span>
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightStack}>
              <article className={styles.insightCard}>
                <h3>
                  <Scale size={14} aria-hidden /> Decision
                </h3>
                <p>
                  {selected ? (
                    <span className={`${styles.chip} ${statusTone(selected.finalDecision)}`}>
                      {selected.finalDecision}
                    </span>
                  ) : (
                    '—'
                  )}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>
                  <ShieldCheck size={14} aria-hidden /> Next stage
                </h3>
                <p>
                  {selected?.finalDecision === 'QUALIFY'
                    ? 'Eligible for Selected Ideas (autonomous)'
                    : selected?.finalDecision === 'REASSESS'
                      ? 'Deferred — reassessment queue'
                      : selected?.finalDecision === 'BLOCK'
                        ? 'Escalated / blocked path'
                        : selected?.finalDecision === 'REJECT'
                          ? 'Closed — rejected'
                          : 'Await decision persistence'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>
                  <FileCheck2 size={14} aria-hidden /> Version
                </h3>
                <p>v{selected?.decisionVersion ?? 0}</p>
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

function DecisionTable({
  items,
  onSelect,
}: {
  items: DecisionRecord[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>Decision Register table</h3>
        {!items.length ? (
          <p className={styles.lede}>No decisions in the filtered set.</p>
        ) : (
          <table className={styles.auditTable}>
            <thead>
              <tr>
                <th>Candidate ID</th>
                <th>Title</th>
                <th>Final Decision</th>
                <th>Score</th>
                <th>Confidence</th>
                <th>Approval</th>
                <th>Reason</th>
                <th>Risk</th>
                <th>Version</th>
                <th>Timestamp</th>
                <th>Model</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button type="button" className={styles.chip} onClick={() => onSelect(item.id)}>
                      {item.candidateId.slice(0, 8)}…
                    </button>
                  </td>
                  <td>{item.title}</td>
                  <td>
                    <span className={`${styles.chip} ${statusTone(item.finalDecision)}`}>
                      {item.finalDecision}
                    </span>
                  </td>
                  <td>{item.qualificationScore ?? '—'}</td>
                  <td>{item.confidence ?? '—'}</td>
                  <td>{item.approvalStatus}</td>
                  <td>{item.decisionReason.slice(0, 80)}</td>
                  <td>
                    {item.riskAssessment.score ?? '—'} ({item.riskAssessment.band})
                  </td>
                  <td>v{item.decisionVersion}</td>
                  <td>{new Date(item.timestamp).toLocaleString()}</td>
                  <td>{display(item.modelVersion)}</td>
                  <td>{item.workflowStage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </div>
  );
}
