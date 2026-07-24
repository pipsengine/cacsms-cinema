'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Download,
  FileSearch,
  Fingerprint,
  Gauge,
  History,
  Layers3,
  Link2,
  Lock,
  Scale,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
} from 'lucide-react';
import type {
  AuditEventRecord,
  IntelligenceAuditOverview,
} from '@/lib/content-intelligence/audit';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import styles from './intelligence-audit.module.css';

type TabId =
  | 'overview'
  | 'events'
  | 'explain'
  | 'chain'
  | 'evidence'
  | 'governance'
  | 'timeline'
  | 'analytics'
  | 'learning'
  | 'policy'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'events', label: 'Events' },
  { id: 'explain', label: 'Explain' },
  { id: 'chain', label: 'Chain' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'governance', label: 'Governance' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'learning', label: 'Learning' },
  { id: 'policy', label: 'Policy' },
  { id: 'audit', label: 'Audit' },
];

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'RECORDED':
    case 'VERIFIED':
    case 'INTEGRITY_OK':
    case 'SIGNED':
    case 'OBSERVED':
    case 'EVALUATED':
    case 'COMPLIANT':
    case 'APPEND_ONLY':
    case 'MONITORING':
    case 'RECORDING':
    case 'HEALTHY':
    case 'COMPLETED':
    case 'RUNNING':
    case 'ACKNOWLEDGED':
    case 'ACTIVE_OK':
      return styles.toneReady;
    case 'INTEGRITY_FAIL':
    case 'VIOLATION':
    case 'CRITICAL':
    case 'FAILED':
    case 'BLOCKED':
    case 'UNAVAILABLE':
      return styles.toneBlocked;
    case 'PENDING':
    case 'WARNING':
    case 'DEGRADED':
    case 'AWAITING_STRATEGY':
    case 'IDLE':
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
  return [4, 7, 5, 9, 6, 10, 8].map((base, index) => Math.max(3, ((base + seed + index * 2) % 10) + 3));
}

function packageLabel(overview: IntelligenceAuditOverview | null, systemRunning: boolean) {
  if (!overview?.strategy) return 'Empty';
  if ((overview.metrics.policyViolations ?? 0) > 0) return 'Violation';
  if (overview.meta.ledgerStatus === 'APPEND_ONLY' && (overview.events.length ?? 0) > 0) {
    return overview.governance.policyCompliance === 100 ? 'Compliant' : 'Recording';
  }
  if (systemRunning || overview.run?.status === 'RUNNING') return 'Recording';
  if ((overview.events.length ?? 0) > 0) return 'Recording';
  if (overview.strategy) return 'Monitoring';
  return 'Empty';
}

function matchesEvent(
  item: AuditEventRecord,
  needle: string,
  category: string,
  actorType: string,
  module: string,
) {
  if (category !== 'all' && item.category !== category) return false;
  if (actorType !== 'all' && item.actorType !== actorType) return false;
  if (module !== 'all' && item.module !== module) return false;
  if (!needle) return true;
  const haystack = [
    item.id,
    item.action,
    item.module,
    item.submodule,
    item.actor,
    item.decision,
    item.reason,
    item.correlationId,
    item.category,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function shortSig(value?: string | null) {
  if (!value) return '—';
  if (value.length <= 22) return value;
  return `${value.slice(0, 14)}…${value.slice(-6)}`;
}

function pctLabel(value?: number | null) {
  if (value == null) return 'UNMEAS.';
  return `${value}%`;
}

function exportPayload(overview: IntelligenceAuditOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `intelligence-audit-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'id',
    'timestamp',
    'module',
    'action',
    'actor',
    'actorType',
    'category',
    'confidence',
    'status',
    'signature',
  ];
  const lines = [
    header.join(','),
    ...overview.events.map((item) =>
      [
        item.id,
        item.timestamp,
        JSON.stringify(item.module),
        JSON.stringify(item.action),
        JSON.stringify(item.actor),
        item.actorType,
        JSON.stringify(item.category),
        item.confidence ?? '',
        item.status,
        JSON.stringify(item.digitalSignature),
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `intelligence-audit-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function IntelligenceAuditWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<IntelligenceAuditOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [actorTypeFilter, setActorTypeFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
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
        intelligenceApi.audit(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const items = next.events ?? [];
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

  const events = overview?.events ?? [];
  const metrics = overview?.metrics;
  const meta = overview?.meta;
  const governance = overview?.governance;
  const needle = query.trim().toLowerCase();

  const categories = useMemo(
    () => [...new Set(events.map((item) => item.category))].sort(),
    [events],
  );
  const actorTypes = useMemo(
    () => [...new Set(events.map((item) => item.actorType))].sort(),
    [events],
  );
  const modules = useMemo(
    () => [...new Set(events.map((item) => item.module))].sort(),
    [events],
  );

  const filtered = useMemo(
    () =>
      events.filter((item) =>
        matchesEvent(item, needle, categoryFilter, actorTypeFilter, moduleFilter),
      ),
    [events, needle, categoryFilter, actorTypeFilter, moduleFilter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    events.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const stageStatus = packageLabel(overview, systemRunning);
  const maxCategory = Math.max(1, ...(overview?.categories.map((item) => item.count) ?? [1]));

  const kpis = useMemo(() => {
    const m = metrics;
    return [
      {
        label: 'Total Audit Events',
        value: String(m?.totalAuditEvents ?? 0),
        meta: 'Persisted ci_audit_events',
        accent: '#2563EB',
        icon: ScrollText,
        bars: sparkBars(m?.totalAuditEvents ?? 0),
        drill: 'events' as TabId,
      },
      {
        label: 'AI Decisions',
        value: String(m?.aiDecisions ?? 0),
        meta: 'AI / service / system actors',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(m?.aiDecisions ?? 0),
        drill: 'explain' as TabId,
      },
      {
        label: 'Evidence Records',
        value: String(m?.evidenceRecords ?? 0),
        meta: 'Verification rows linked',
        accent: '#0EA5E9',
        icon: FileSearch,
        bars: sparkBars(m?.evidenceRecords ?? 0),
        drill: 'evidence' as TabId,
      },
      {
        label: 'Policy Violations',
        value: String(m?.policyViolations ?? 0),
        meta: 'Policy category failures',
        accent: '#EF4444',
        icon: ShieldAlert,
        bars: sparkBars(m?.policyViolations ?? 0),
        drill: 'policy' as TabId,
      },
      {
        label: 'Recovered Jobs',
        value: String(m?.recoveredJobs ?? 0),
        meta: 'Resolved blockers + retried jobs',
        accent: '#14B8A6',
        icon: CheckCircle2,
        bars: sparkBars(m?.recoveredJobs ?? 0),
        drill: 'timeline' as TabId,
      },
      {
        label: 'Autonomous Decisions',
        value: String(m?.autonomousDecisions ?? 0),
        meta: 'Non-human ledger actors',
        accent: '#8B5CF6',
        icon: Workflow,
        bars: sparkBars(m?.autonomousDecisions ?? 0),
        drill: 'chain' as TabId,
      },
      {
        label: 'Human Overrides',
        value: String(m?.humanOverrides ?? 0),
        meta: 'Human / operator actors',
        accent: '#F59E0B',
        icon: Scale,
        bars: sparkBars(m?.humanOverrides ?? 0),
        drill: 'governance' as TabId,
      },
      {
        label: 'AI Confidence',
        value: m?.aiConfidence != null ? String(m.aiConfidence) : 'UNMEAS.',
        meta: 'Mean persisted confidence',
        accent: '#8B5CF6',
        icon: BrainCircuit,
        bars: sparkBars(m?.aiConfidence ?? 0),
        drill: 'explain' as TabId,
      },
      {
        label: 'Avg Decision Time',
        value:
          m?.averageDecisionTimeMs != null
            ? `${Math.round(m.averageDecisionTimeMs)}ms`
            : 'UNMEAS.',
        meta: 'From duration payloads',
        accent: '#0EA5E9',
        icon: Gauge,
        bars: sparkBars(m?.averageDecisionTimeMs ?? 0),
        drill: 'analytics' as TabId,
      },
      {
        label: 'Decision Accuracy',
        value: m?.decisionAccuracy != null ? `${m.decisionAccuracy}%` : 'UNMEAS.',
        meta: 'No accuracy labels persisted',
        accent: '#94A3B8',
        icon: Activity,
        bars: sparkBars(m?.decisionAccuracy ?? 0),
        drill: 'analytics' as TabId,
      },
      {
        label: 'Workflow Compliance',
        value: pctLabel(m?.workflowCompliance),
        meta: 'Timeline coverage share',
        accent: '#22C55E',
        icon: Workflow,
        bars: sparkBars(m?.workflowCompliance ?? 0),
        drill: 'governance' as TabId,
      },
      {
        label: 'Audit Integrity',
        value: pctLabel(m?.auditIntegrity),
        meta: 'SHA-256 hash coverage',
        accent: '#14B8A6',
        icon: Fingerprint,
        bars: sparkBars(m?.auditIntegrity ?? 0),
        drill: 'audit' as TabId,
      },
      {
        label: 'Digital Signatures',
        value: String(m?.digitalSignatures ?? 0),
        meta: 'Signed ledger entries',
        accent: '#2563EB',
        icon: Lock,
        bars: sparkBars(m?.digitalSignatures ?? 0),
        drill: 'audit' as TabId,
      },
      {
        label: 'Immutable Records',
        value: String(m?.immutableRecords ?? 0),
        meta: 'Append-only event count',
        accent: '#64748B',
        icon: Layers3,
        bars: sparkBars(m?.immutableRecords ?? 0),
        drill: 'events' as TabId,
      },
      {
        label: 'Model Versions',
        value: m?.modelVersions != null ? String(m.modelVersions) : 'UNMEAS.',
        meta: 'Distinct model strings',
        accent: '#94A3B8',
        icon: BrainCircuit,
        bars: sparkBars(m?.modelVersions ?? 0),
        drill: 'analytics' as TabId,
      },
      {
        label: 'Knowledge Changes',
        value: String(m?.knowledgeChanges ?? 0),
        meta: 'Knowledge / graph events',
        accent: '#F97316',
        icon: History,
        bars: sparkBars(m?.knowledgeChanges ?? 0),
        drill: 'learning' as TabId,
      },
    ];
  }, [metrics]);

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
        <p className={styles.crumb}>
          Content Lifecycle / 02 Content Intelligence / Intelligence Audit
        </p>
        <h1 className={styles.title}>Autonomous Intelligence Audit & Explainability Centre</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Intelligence audit unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  const issues = overview?.issues ?? [];
  const showEmptyHero = Boolean(overview?.strategy) && events.length === 0;
  const showWaitingStrategy = !overview?.strategy;
  const confidenceGauges = selected
    ? [
        { label: 'Overall', value: selected.confidenceBreakdown.overall },
        { label: 'Evidence', value: selected.confidenceBreakdown.evidence },
        { label: 'Knowledge', value: selected.confidenceBreakdown.knowledge },
        { label: 'Model', value: selected.confidenceBreakdown.model },
        { label: 'Prompt', value: selected.confidenceBreakdown.prompt },
        { label: 'Ranking', value: selected.confidenceBreakdown.ranking },
        { label: 'Portfolio', value: selected.confidenceBreakdown.portfolio },
      ]
    : [];

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 02 Content Intelligence / Intelligence Audit
          </p>
          <h1 className={styles.title}>Autonomous Intelligence Audit & Explainability Centre</h1>
          <p className={styles.lede}>
            Inspect immutable AI decisions, reasoning chains, evidence lineage, confidence
            calculations, policy compliance, and autonomous workflow history across the complete
            Content Intelligence lifecycle.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 02 Governance</span>
          <span className={`${styles.badge} ${statusTone(meta?.ledgerStatus)}`}>
            {display(meta?.ledgerStatus)}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Integrity {pctLabel(meta?.integrityPct)}
          </span>
          <span className={`${styles.badge} ${statusTone(overview?.strategy?.status)}`}>
            Strategy v{overview?.strategy?.versionNumber ?? '—'}
          </span>
          <span className={`${styles.badge} ${statusTone(stageStatus)}`}>{stageStatus}</span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · immutable ledger</strong>
          Events from <code>ci_audit_events</code> with SHA-256 integrity hashes. No fabricated
          metrics.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Audit KPI summary">
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

      <section className={styles.lifecycle} aria-label="Intelligence decision chain">
        <div className={styles.lifecycleHead}>
          <h2>Intelligence decision chain</h2>
          <span>
            {overview?.strategy
              ? `Package ACK · run ${overview.run?.status ?? 'IDLE'}`
              : `Awaiting Strategy package · system ${systemState}`}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {(overview?.decisionChain ?? []).map((stage) => (
            <div key={stage.key} className={styles.stage} data-state={stage.state}>
              <span className={styles.stageIcon}>
                <Workflow size={14} aria-hidden />
              </span>
              <strong>{stage.label}</strong>
              <span className={styles.pipelineMeta}>
                {stage.records} · conf {measured(stage.confidence)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {showWaitingStrategy ? (
        <div className={styles.waitingBanner} role="status">
          <Timer size={18} aria-hidden />
          <div>
            <strong>Waiting for Strategy activation</strong>
            Immutable audit recording activates with an acknowledged Strategy package and
            Content Intelligence workers.
          </div>
        </div>
      ) : null}

      {showEmptyHero ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>
              Every autonomous decision, AI reasoning step, evidence validation, confidence
              calculation, policy evaluation, recovery event, and workflow transition performed
              during Content Intelligence is permanently recorded here. Once the engine starts, this
              page becomes the immutable intelligence ledger for complete transparency, governance,
              explainability, compliance, and forensic traceability.
            </h2>
            <p className={styles.lede}>
              Record → explain → verify integrity → govern — with SHA-256 hashes and no fabricated
              metrics.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Record</strong>
              Append-only ledger events
            </li>
            <li>
              <strong>2. Explain</strong>
              Reasoning + confidence
            </li>
            <li>
              <strong>3. Verify integrity</strong>
              SHA-256 signatures
            </li>
            <li>
              <strong>4. Govern</strong>
              Policy + compliance
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Intelligence audit workspace">
        <aside className={styles.panel} aria-label="Audit Explorer">
          <div className={styles.panelHead}>
            <h2>Audit Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search audit ledger…"
                aria-label="Search intelligence audit"
              />
            </label>
            <label className={styles.field}>
              <span>Category</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Filter by category"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Actor type</span>
              <select
                value={actorTypeFilter}
                onChange={(event) => setActorTypeFilter(event.target.value)}
                aria-label="Filter by actor type"
              >
                <option value="all">All actors</option>
                {actorTypes.map((actorType) => (
                  <option key={actorType} value={actorType}>
                    {actorType}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Module</span>
              <select
                value={moduleFilter}
                onChange={(event) => setModuleFilter(event.target.value)}
                aria-label="Filter by module"
              >
                <option value="all">All modules</option>
                {modules.map((module) => (
                  <option key={module} value={module}>
                    {module}
                  </option>
                ))}
              </select>
            </label>

            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No persisted audit events match the current filters.</p>
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
                      <span className={styles.explorerTitle}>{item.decision.slice(0, 80)}</span>
                      <span className={styles.explorerMeta}>
                        {item.module} · {item.action}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.category)}`}>
                          {item.category}
                        </span>
                        <span className={`${styles.chip} ${statusTone(item.actorType)}`}>
                          {item.actorType}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Audit intelligence">
          <div className={styles.tabs} role="tablist" aria-label="Audit tabs">
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
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Lifecycle timeline markers</h3>
                  <ul className={styles.timeline}>
                    {(overview?.timeline ?? []).map((step) => (
                      <li key={step.key}>
                        <CircleDot size={14} aria-hidden />
                        <div>
                          <strong>
                            {step.label}
                            {step.done ? ' ✓' : ''}
                          </strong>
                          <span>
                            {step.count} events ·{' '}
                            {step.at ? new Date(step.at).toLocaleString() : 'Pending / UNMEASURED'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Category distribution</h3>
                  <div className={styles.waterfall}>
                    {(overview?.categories ?? []).slice(0, 10).map((item) => (
                      <div key={item.category} className={styles.waterfallRow}>
                        <span>{item.category}</span>
                        <div className={styles.radarBar}>
                          <div
                            className={styles.radarFill}
                            style={{
                              width: `${Math.min(100, (item.count / maxCategory) * 100)}%`,
                            }}
                          />
                        </div>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                    {!overview?.categories.length ? (
                      <p className={styles.lede}>No category counts yet.</p>
                    ) : null}
                  </div>
                </article>
                <article className={styles.detailCard}>
                  <h3>Governance summary</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Compliance</dt>
                      <dd>{pctLabel(governance?.complianceScore)}</dd>
                    </div>
                    <div>
                      <dt>Audit coverage</dt>
                      <dd>{pctLabel(governance?.auditCoverage)}</dd>
                    </div>
                    <div>
                      <dt>Transparency</dt>
                      <dd>{pctLabel(governance?.decisionTransparency)}</dd>
                    </div>
                    <div>
                      <dt>Explainability</dt>
                      <dd>{pctLabel(governance?.explainabilityScore)}</dd>
                    </div>
                    <div>
                      <dt>Evidence quality</dt>
                      <dd>{pctLabel(governance?.evidenceQuality)}</dd>
                    </div>
                    <div>
                      <dt>Governance health</dt>
                      <dd>{pctLabel(governance?.governanceHealth)}</dd>
                    </div>
                    <div>
                      <dt>Risk exposure</dt>
                      <dd>{measured(governance?.riskExposure)}</dd>
                    </div>
                    <div>
                      <dt>Policy compliance</dt>
                      <dd>{pctLabel(governance?.policyCompliance)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Issues</h3>
                  <ul className={styles.bulletList}>
                    {issues.slice(0, 8).map((issue) => (
                      <li key={issue.id}>
                        [{issue.severity}] {issue.message}
                      </li>
                    ))}
                    {!issues.length ? <li>No open governance issues.</li> : null}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'events' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Audit event ledger</h3>
                  {!filtered.length ? (
                    <p className={styles.lede}>No events in the current filter set.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">ID</th>
                          <th scope="col">Time</th>
                          <th scope="col">Module</th>
                          <th scope="col">Action</th>
                          <th scope="col">Actor</th>
                          <th scope="col">Confidence</th>
                          <th scope="col">Signature</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice(0, 50).map((item) => (
                          <tr
                            key={item.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              setSelectedId(item.id);
                              setTab('explain');
                            }}
                          >
                            <td>{item.id.slice(0, 18)}</td>
                            <td>{new Date(item.timestamp).toLocaleString()}</td>
                            <td>{item.module}</td>
                            <td>{item.action}</td>
                            <td>
                              {item.actor} · {item.actorType}
                            </td>
                            <td>{measured(item.confidence)}</td>
                            <td>{shortSig(item.digitalSignature)}</td>
                            <td>{item.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {selected && tab === 'explain' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Explainability report</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Summary</dt>
                      <dd>{selected.explainability.summary}</dd>
                    </div>
                    <div>
                      <dt>Reasoning</dt>
                      <dd>{selected.explainability.reasoning}</dd>
                    </div>
                    <div>
                      <dt>Risk analysis</dt>
                      <dd>{selected.explainability.riskAnalysis}</dd>
                    </div>
                    <div>
                      <dt>Expected outcome</dt>
                      <dd>{selected.explainability.expectedOutcome}</dd>
                    </div>
                    <div>
                      <dt>Actual outcome</dt>
                      <dd>{selected.explainability.actualOutcome}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Step-by-step</h3>
                  <ul className={styles.bulletList}>
                    {selected.explainability.stepByStep.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Evidence used</h3>
                  <ul className={styles.bulletList}>
                    {selected.explainability.evidenceUsed.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Confidence breakdown</h3>
                  <div className={styles.waterfall}>
                    {confidenceGauges.map((gauge) => (
                      <div key={gauge.label} className={styles.waterfallRow}>
                        <span>{gauge.label}</span>
                        <div className={styles.radarBar}>
                          <div
                            className={styles.radarFill}
                            style={{
                              width: `${Math.min(100, Math.max(0, gauge.value ?? 0))}%`,
                              opacity: gauge.value == null ? 0.25 : 1,
                            }}
                          />
                        </div>
                        <strong>{measured(gauge.value)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
                <article className={styles.detailCard}>
                  <h3>Alternatives & policy</h3>
                  <ul className={styles.bulletList}>
                    {selected.explainability.alternatives.map((step) => (
                      <li key={`alt-${step}`}>{step}</li>
                    ))}
                    {selected.explainability.policyChecks.map((step) => (
                      <li key={`pol-${step}`}>{step}</li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {selected && tab === 'chain' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Selected decision chain</h3>
                  <ul className={styles.timeline}>
                    {selected.decisionChain.map((step) => (
                      <li key={step.key}>
                        <CircleDot size={14} aria-hidden />
                        <div>
                          <strong>
                            {step.label}
                            {step.done ? ' ✓' : ''}
                          </strong>
                          <span>{step.done ? 'Reached' : 'Not yet reached'}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Lifecycle decision chain</h3>
                  <ul className={styles.timeline}>
                    {(overview?.decisionChain ?? []).map((step) => (
                      <li key={step.key}>
                        <CircleDot size={14} aria-hidden />
                        <div>
                          <strong>
                            {step.label} · {step.state}
                          </strong>
                          <span>
                            {step.records} records · conf {measured(step.confidence)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {selected && tab === 'evidence' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Evidence & lineage</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Evidence</dt>
                      <dd>{display(selected.evidence)}</dd>
                    </div>
                    <div>
                      <dt>Opportunity</dt>
                      <dd>{display(selected.opportunityId)}</dd>
                    </div>
                    <div>
                      <dt>Run</dt>
                      <dd>{display(selected.runId)}</dd>
                    </div>
                    <div>
                      <dt>Correlation</dt>
                      <dd>{display(selected.correlationId)}</dd>
                    </div>
                    <div>
                      <dt>Request</dt>
                      <dd>{display(selected.requestId)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Inputs</h3>
                  <p className={styles.lede}>{display(selected.inputs)}</p>
                </article>
                <article className={styles.detailCard}>
                  <h3>Outputs</h3>
                  <p className={styles.lede}>{display(selected.outputs)}</p>
                </article>
                <article className={styles.detailCard}>
                  <h3>Versions</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Strategy</dt>
                      <dd>{display(selected.versions.strategy)}</dd>
                    </div>
                    <div>
                      <dt>Knowledge</dt>
                      <dd>{display(selected.versions.knowledge)}</dd>
                    </div>
                    <div>
                      <dt>Prompt</dt>
                      <dd>{display(selected.versions.prompt)}</dd>
                    </div>
                    <div>
                      <dt>Model</dt>
                      <dd>{display(selected.versions.model)}</dd>
                    </div>
                    <div>
                      <dt>Policy</dt>
                      <dd>{display(selected.versions.policy)}</dd>
                    </div>
                    <div>
                      <dt>Graph</dt>
                      <dd>{display(selected.versions.graph)}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'governance' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Governance metrics</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Compliance score</dt>
                      <dd>{pctLabel(governance?.complianceScore)}</dd>
                    </div>
                    <div>
                      <dt>Audit coverage</dt>
                      <dd>{pctLabel(governance?.auditCoverage)}</dd>
                    </div>
                    <div>
                      <dt>Decision transparency</dt>
                      <dd>{pctLabel(governance?.decisionTransparency)}</dd>
                    </div>
                    <div>
                      <dt>Explainability score</dt>
                      <dd>{pctLabel(governance?.explainabilityScore)}</dd>
                    </div>
                    <div>
                      <dt>Evidence quality</dt>
                      <dd>{pctLabel(governance?.evidenceQuality)}</dd>
                    </div>
                    <div>
                      <dt>Governance health</dt>
                      <dd>{pctLabel(governance?.governanceHealth)}</dd>
                    </div>
                    <div>
                      <dt>Risk exposure</dt>
                      <dd>{measured(governance?.riskExposure)}</dd>
                    </div>
                    <div>
                      <dt>Policy compliance</dt>
                      <dd>{pctLabel(governance?.policyCompliance)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Policy checks</h3>
                  {!(overview?.policyChecks.length) ? (
                    <p className={styles.lede}>No policy checks persisted.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Policy</th>
                          <th scope="col">Status</th>
                          <th scope="col">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.policyChecks.map((item) => (
                          <tr key={item.id}>
                            <td>{item.policy}</td>
                            <td>{item.status}</td>
                            <td>{item.detail}</td>
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
                  <h3>Intelligence timeline</h3>
                  <ul className={styles.timeline}>
                    {(overview?.timeline ?? []).map((step) => (
                      <li key={step.key}>
                        <CircleDot size={14} aria-hidden />
                        <div>
                          <strong>
                            {step.label}
                            {step.done ? ' ✓' : ''}
                          </strong>
                          <span>
                            {step.count} ·{' '}
                            {step.at ? new Date(step.at).toLocaleString() : 'Pending / UNMEASURED'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {!overview?.timeline.length ? (
                    <p className={styles.lede}>No timeline markers yet.</p>
                  ) : null}
                </article>
              </div>
            ) : null}

            {tab === 'analytics' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>KPI highlights</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Total events</dt>
                      <dd>{metrics?.totalAuditEvents ?? 0}</dd>
                    </div>
                    <div>
                      <dt>AI decisions</dt>
                      <dd>{metrics?.aiDecisions ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Autonomous</dt>
                      <dd>{metrics?.autonomousDecisions ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Human overrides</dt>
                      <dd>{metrics?.humanOverrides ?? 0}</dd>
                    </div>
                    <div>
                      <dt>AI confidence</dt>
                      <dd>{measured(metrics?.aiConfidence)}</dd>
                    </div>
                    <div>
                      <dt>Avg decision time</dt>
                      <dd>
                        {metrics?.averageDecisionTimeMs != null
                          ? `${Math.round(metrics.averageDecisionTimeMs)}ms`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Decision accuracy</dt>
                      <dd>{measured(metrics?.decisionAccuracy)}</dd>
                    </div>
                    <div>
                      <dt>Model versions</dt>
                      <dd>{measured(metrics?.modelVersions)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Category counts</h3>
                  <div className={styles.waterfall}>
                    {(overview?.categories ?? []).map((item) => (
                      <div key={item.category} className={styles.waterfallRow}>
                        <span>{item.category}</span>
                        <div className={styles.radarBar}>
                          <div
                            className={styles.radarFill}
                            style={{
                              width: `${Math.min(100, (item.count / maxCategory) * 100)}%`,
                            }}
                          />
                        </div>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'learning' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Learning observations</h3>
                  {!(overview?.learning.length) ? (
                    <p className={styles.lede}>No learning observations persisted yet.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">When</th>
                          <th scope="col">Observation</th>
                          <th scope="col">Improvement</th>
                          <th scope="col">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.learning.map((item) => (
                          <tr key={item.id}>
                            <td>{new Date(item.at).toLocaleString()}</td>
                            <td>{item.observation}</td>
                            <td>{item.improvement}</td>
                            <td>{measured(item.confidenceGain)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'policy' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Policy evaluation</h3>
                  {!(overview?.policyChecks.length) ? (
                    <p className={styles.lede}>No policy checks available.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Policy</th>
                          <th scope="col">Status</th>
                          <th scope="col">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.policyChecks.map((item) => (
                          <tr key={item.id}>
                            <td>{item.policy}</td>
                            <td>
                              <span className={`${styles.chip} ${statusTone(item.status)}`}>
                                {item.status}
                              </span>
                            </td>
                            <td>{item.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <p className={styles.lede} style={{ marginTop: 12 }}>
                    Policy violations recorded: {metrics?.policyViolations ?? 0}
                  </p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Integrity fields</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Content hash</dt>
                      <dd>{selected.contentHash}</dd>
                    </div>
                    <div>
                      <dt>Digital signature</dt>
                      <dd>{selected.digitalSignature}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{selected.status}</dd>
                    </div>
                    <div>
                      <dt>Correlation</dt>
                      <dd>{display(selected.correlationId)}</dd>
                    </div>
                    <div>
                      <dt>Request</dt>
                      <dd>{display(selected.requestId)}</dd>
                    </div>
                    <div>
                      <dt>Duration</dt>
                      <dd>
                        {selected.durationMs != null ? `${selected.durationMs}ms` : 'UNMEASURED'}
                      </dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Version lineage</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Strategy</dt>
                      <dd>{display(selected.strategyVersion ?? selected.versions.strategy)}</dd>
                    </div>
                    <div>
                      <dt>Knowledge</dt>
                      <dd>{display(selected.knowledgeVersion)}</dd>
                    </div>
                    <div>
                      <dt>Prompt</dt>
                      <dd>{display(selected.promptVersion)}</dd>
                    </div>
                    <div>
                      <dt>Model</dt>
                      <dd>{display(selected.model)}</dd>
                    </div>
                    <div>
                      <dt>AI agent</dt>
                      <dd>{display(selected.aiAgent)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Change history</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Previous value</dt>
                      <dd>{display(selected.previousValue)}</dd>
                    </div>
                    <div>
                      <dt>New value</dt>
                      <dd>{display(selected.newValue)}</dd>
                    </div>
                    <div>
                      <dt>Reason</dt>
                      <dd>{display(selected.reason)}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {!selected &&
            (tab === 'explain' || tab === 'chain' || tab === 'evidence' || tab === 'audit') ? (
              <div className={styles.emptyInline}>
                <Layers3 size={22} aria-hidden />
                <p>Select an audit event to inspect explainability, chain, evidence, and integrity.</p>
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
                <h3>What happened</h3>
                <p>{selected?.explainability.summary ?? 'Select an event for XAI detail.'}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Why</h3>
                <p>{selected?.explainability.reasoning ?? '—'}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Decision</h3>
                <p>
                  {selected
                    ? `${selected.decision} · ${selected.action} · ${selected.module}`
                    : `Events ${metrics?.totalAuditEvents ?? 0} · integrity ${pctLabel(metrics?.auditIntegrity)}`}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Confidence</h3>
                <p>
                  {selected
                    ? `Overall ${measured(selected.confidence)} · breakdown ${measured(selected.confidenceBreakdown.overall)}`
                    : measured(metrics?.aiConfidence)}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Alternatives</h3>
                <ul className={styles.bulletList}>
                  {(selected?.explainability.alternatives ?? []).slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                  {!selected?.explainability.alternatives.length ? (
                    <li>No alternate branches on selection.</li>
                  ) : null}
                </ul>
              </article>
              <article className={styles.insightCard}>
                <h3>Preventive / policy notes</h3>
                <ul className={styles.bulletList}>
                  {(selected?.explainability.policyChecks ?? []).slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                  {issues.slice(0, 3).map((issue) => (
                    <li key={issue.id}>
                      [{issue.severity}] {issue.message}
                    </li>
                  ))}
                  {!selected && !issues.length ? <li>No open policy notes.</li> : null}
                </ul>
              </article>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.bottom} aria-label="Audit monitoring">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Ledger</h2>
            <Lock size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              Append-only observation of <code>ci_audit_events</code> with derived SHA-256 content
              hashes. This page does not mutate autonomous decisions.
            </p>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Coverage</h2>
            <Link2 size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Coverage</dt>
                <dd>{pctLabel(meta?.coveragePct)}</dd>
              </div>
              <div>
                <dt>Last event</dt>
                <dd>
                  {meta?.lastEventAt ? new Date(meta.lastEventAt).toLocaleString() : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Last updated</h2>
            <ShieldCheck size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              {overview?.lastUpdated
                ? new Date(overview.lastUpdated).toLocaleString()
                : '—'}
            </p>
          </div>
        </article>
      </section>
    </motion.main>
  );
}
