'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Gauge,
  GitBranch,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
} from 'lucide-react';
import type { StrategyOverview } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  dependencyChain,
  filterValidationResults,
  handoffReady,
  resultStatus,
  sectionLabel,
  synthesizeChecksFromOverview,
  validationStats,
  type ValidationFilter,
  type ValidationResultRow,
} from '@/apps/web/lib/strategy-validation';
import styles from './validation-intel.module.css';

type TabId =
  | 'overview'
  | 'results'
  | 'rules'
  | 'dependencies'
  | 'reasoning'
  | 'recommendations'
  | 'history'
  | 'audit';

type AuditRow = {
  id: string;
  action: string;
  actorType: string;
  createdAt: string;
  reason: string | null;
};

type ValidationPayload = {
  run: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    summary: Record<string, unknown> | null;
  } | null;
  results: ValidationResultRow[];
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'results', label: 'Validation Results' },
  { id: 'rules', label: 'Rule Checks' },
  { id: 'dependencies', label: 'Dependency Analysis' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'validate', label: 'Validate', icon: ClipboardCheck },
  { key: 'verify', label: 'Verify', icon: FileSearch },
  { key: 'crosscheck', label: 'Cross-check', icon: GitBranch },
  { key: 'resolve', label: 'Resolve', icon: AlertTriangle },
  { key: 'approve', label: 'Approve', icon: ShieldCheck },
  { key: 'handoff', label: 'Handoff', icon: Workflow },
] as const;

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'COMPLETED':
    case 'PASSED':
    case 'Completed':
    case 'ACKNOWLEDGED':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'Failed':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'QUEUED':
    case 'PAUSED':
    case 'WARNING':
    case 'Running':
    case 'RUNNING':
    case 'PARTIAL':
    case 'INFO':
      return styles.toneWarning;
    default:
      return styles.toneDraft;
  }
}

function display(value?: string | null) {
  if (!value) return '—';
  if (value === 'UNMEASURED') return 'UNMEASURED';
  return value;
}

function sparkBars(seed: number) {
  return [4, 7, 5, 9, 6, 10, 8].map((base, index) => Math.max(3, ((base + seed + index * 2) % 10) + 3));
}

function lifecycleState(
  index: number,
  overview: StrategyOverview,
  systemRunning: boolean,
  stats: ReturnType<typeof validationStats>,
  readyForHandoff: boolean,
) {
  const validated = Boolean(overview.lastValidatedAt) || overview.status === 'READY' || overview.status === 'ACTIVE';
  if (readyForHandoff || overview.handoffStatus === 'ACKNOWLEDGED') return 'done';
  if (overview.status === 'ACTIVE') {
    return index < 5 ? 'done' : index === 5 ? 'active' : 'pending';
  }
  if (overview.status === 'READY' && stats.blocking === 0) {
    if (index < 4) return 'done';
    if (index === 4) return 'active';
    return 'pending';
  }
  if (validated && stats.blocking > 0) {
    if (index < 2) return 'done';
    if (index === 2) return 'done';
    if (index === 3) return 'active';
    return 'pending';
  }
  if (validated && stats.warnings > 0) {
    if (index < 2) return 'done';
    if (index === 2) return 'active';
    return 'pending';
  }
  if (systemRunning || overview.autonomyRun?.status === 'RUNNING') {
    if (index === 0) return 'active';
    return 'pending';
  }
  if (overview.status === 'INVALID') {
    return index === 0 ? 'done' : index === 3 ? 'active' : 'pending';
  }
  return index === 0 ? 'active' : 'pending';
}

export function ValidationWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [validation, setValidation] = useState<ValidationPayload>({ run: null, results: [] });
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ValidationFilter>('all');
  const [tab, setTab] = useState<TabId>('overview');
  const [busy, setBusy] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const run = overview?.autonomyRun ?? null;
  const systemRunning = systemState === 'RUNNING';

  async function load(preferId?: string | null) {
    setBusy(true);
    setError('');
    try {
      const [next, dashboard] = await Promise.all([
        strategyApi.overview(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      if (!next.available || !next.versionId) {
        setValidation({ run: null, results: [] });
        setAudit([]);
        return;
      }
      const [validationPayload, auditRows] = await Promise.all([
        strategyApi.validation(next.versionId).catch(() => ({ run: null, results: [] })),
        strategyApi.audit(next.versionId).catch(() => [] as AuditRow[]),
      ]);
      const results =
        validationPayload.results.length > 0
          ? validationPayload.results
          : synthesizeChecksFromOverview(next);
      setValidation({ run: validationPayload.run, results });
      setAudit(auditRows);
      const targetId = preferId ?? selectedId;
      const selected = targetId ? results.find((item) => item.id === targetId) : results[0];
      setSelectedId(selected?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unavailable');
    } finally {
      setBusy(false);
    }
  }

  async function rerunValidation() {
    if (!overview?.versionId || rerunning) return;
    setRerunning(true);
    setError('');
    try {
      await strategyApi.validate(overview.versionId);
      await load(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setRerunning(false);
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

  const results = validation.results;
  const stats = useMemo(() => validationStats(results), [results]);
  const readyForHandoff = overview ? handoffReady(overview, results) : false;

  const filtered = useMemo(
    () => filterValidationResults(results, query, filter),
    [results, query, filter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    results.find((item) => item.id === selectedId) ??
    null;

  const kpis = useMemo(
    () => [
      {
        label: 'Overall Readiness',
        value: `${overview?.readiness ?? 0}%`,
        meta: overview?.status ? `Package ${overview.status}` : 'Package readiness',
        accent: '#2563EB',
        icon: Gauge,
        bars: sparkBars(overview?.readiness ?? 0),
      },
      {
        label: 'Passed Checks',
        value: String(stats.passed),
        meta: `${stats.total} total checks`,
        accent: '#16A34A',
        icon: CheckCircle2,
        bars: sparkBars(stats.passed),
      },
      {
        label: 'Failed Checks',
        value: String(stats.failed),
        meta: `${stats.critical} critical`,
        accent: '#DC2626',
        icon: ShieldAlert,
        bars: sparkBars(stats.failed),
      },
      {
        label: 'Warnings',
        value: String(stats.warnings),
        meta: 'Non-blocking findings',
        accent: '#D97706',
        icon: AlertTriangle,
        bars: sparkBars(stats.warnings),
      },
      {
        label: 'AI Confidence',
        value: 'UNMEAS.',
        meta: 'No fabricated validation confidence',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(3),
      },
      {
        label: 'Handoff Readiness',
        value: readyForHandoff ? 'READY' : 'BLOCKED',
        meta: overview?.handoffStatus
          ? `Handoff ${overview.handoffStatus}`
          : `${stats.blocking} blockers`,
        accent: readyForHandoff ? '#0F766E' : '#B45309',
        icon: Workflow,
        bars: sparkBars(readyForHandoff ? 10 : 2),
      },
    ],
    [overview?.readiness, overview?.status, overview?.handoffStatus, stats, readyForHandoff],
  );

  const packageStatus =
    overview?.status === 'ACTIVE'
      ? 'Completed'
      : overview?.status === 'READY'
        ? 'Validated'
        : systemRunning
          ? 'Running'
          : overview?.status === 'INVALID'
            ? 'Failed'
            : validation.run
              ? 'Partial'
              : 'Waiting';

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
      };

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

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

  if (error && !overview?.available) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Strategy & Fields / Strategy Validation</p>
        <h1 className={styles.title}>Strategy Validation</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Strategy service unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  if (!overview?.available) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Strategy & Fields / Strategy Validation</p>
        <h1 className={styles.title}>Strategy Validation</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Strategy service unavailable</h2>
          <p>{overview?.reason}</p>
        </section>
      </main>
    );
  }

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>Strategy & Fields / Strategy Validation</p>
          <h1 className={styles.title}>Strategy Validation</h1>
          <p className={styles.lede}>
            Autonomous mandatory, stub, dependency, and handoff checks across all Stage 01 modules —
            readiness gate for Content Intelligence.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 01</span>
          <span className={`${styles.badge} ${styles.toneAi}`}>System Owned</span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Observe Only</span>
          <span className={`${styles.badge} ${statusTone(packageStatus)}`}>{packageStatus}</span>
          <span className={`${styles.badge} ${statusTone(overview.status)}`}>
            v{overview.versionNumber ?? '—'}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
          {overview.versionId ? (
            <button
              type="button"
              className={`${styles.badge} ${styles.toneDraft}`}
              style={{ cursor: rerunning ? 'wait' : 'pointer', borderStyle: 'dashed' }}
              onClick={() => void rerunValidation()}
              disabled={rerunning}
              title="Optional administrator re-run of persisted validation"
            >
              <RefreshCw size={12} aria-hidden /> {rerunning ? 'Validating…' : 'Re-run Validation'}
            </button>
          ) : null}
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only</strong>
          Validation runs automatically after Stage 01 section reconciliation. This workspace
          inspects persisted checks and handoff readiness. Optional Re-run Validation is for
          administrators only.
          {overview.lastValidatedAt
            ? ` Last validated ${new Date(overview.lastValidatedAt).toLocaleString()}.`
            : ' Not yet validated.'}
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      {error ? (
        <div className={styles.infoNotice} role="alert">
          <AlertTriangle size={16} aria-hidden />
          <div>
            <strong>Validation action failed</strong>
            {error}
          </div>
        </div>
      ) : null}

      <section className={styles.kpiGrid} aria-label="Validation KPI summary">
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

      <section className={styles.lifecycle} aria-label="Validation lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Validation lifecycle</h2>
          <span>
            {systemRunning
              ? 'Stage 01 running — validation will follow reconciliation'
              : `System ${systemState} · package ${overview.status}`}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {LIFECYCLE.map((stage, index) => {
            const Icon = stage.icon;
            const state = lifecycleState(index, overview, systemRunning, stats, readyForHandoff);
            return (
              <div key={stage.key} className={styles.stage} data-state={state}>
                <span className={styles.stageIcon}>
                  <Icon size={14} aria-hidden />
                </span>
                <strong>{stage.label}</strong>
                <span>
                  {state === 'done' ? 'Completed' : state === 'active' ? 'Running' : 'Waiting'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {!validation.run && !overview.lastValidatedAt ? (
        <section className={styles.waiting} aria-label="Awaiting autonomous validation">
          <div className={styles.waitingIcon}>
            <ClipboardCheck size={24} aria-hidden />
          </div>
          <h3>Awaiting Autonomous Strategy Validation</h3>
          <p>
            Validation runs automatically after Stage 01 reconciles all modules. Derived readiness
            checks below reflect current package state until a persisted validation run exists.
          </p>
          <div className={styles.waitingChecklist}>
            <div>
              <strong>System</strong>
              {systemState}
            </div>
            <div>
              <strong>Package</strong>
              {overview.status}
            </div>
            <div>
              <strong>Autonomy run</strong>
              {run?.status ?? 'IDLE'}
            </div>
            <div>
              <strong>Expected sequence</strong>
              Reconcile → Validate → Approve → Handoff
            </div>
          </div>
          <div className={styles.ghostCards} aria-hidden>
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
          </div>
        </section>
      ) : null}

      {systemRunning && !validation.run ? (
        <section className={styles.infoNotice} role="status" aria-live="polite">
          <Timer size={16} aria-hidden />
          <div>
            <strong>Live Stage 01 execution in progress</strong>
            Validation will persist automatically after section reconciliation completes. Explorer
            updates from package readiness meanwhile.
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Validation Explorer">
          <div className={styles.panelHead}>
            <h2>Validation Explorer</h2>
            <p>
              {results.length} checks
              {filtered.length !== results.length ? ` · ${filtered.length} shown` : ''} ·
              {validation.run ? ' persisted run' : ' derived readiness'}
            </p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter validation checks…"
              aria-label="Search validation checks"
            />
            <div className={styles.chips} role="group" aria-label="Validation filters">
              {(
                [
                  ['all', 'All'],
                  ['failed', 'Failed'],
                  ['warnings', 'Warnings'],
                  ['passed', 'Passed'],
                  ['critical', 'Critical'],
                  ['blocking', 'Blocking'],
                  ['mandatory', 'Mandatory'],
                  ['handoff', 'Handoff'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.chip} ${filter === id ? styles.chipActive : ''}`}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {filtered.length ? (
            <ul className={styles.explorerList}>
              {filtered.map((result) => {
                const active = result.id === selectedId;
                const status = resultStatus(result);
                return (
                  <li key={result.id}>
                    <button
                      type="button"
                      className={`${styles.objCard} ${active ? styles.objCardActive : ''}`}
                      onClick={() => setSelectedId(result.id)}
                    >
                      <div className={styles.objCardTop}>
                        <strong>{result.ruleCode}</strong>
                        <em className={`${styles.badge} ${statusTone(status)}`}>{status}</em>
                      </div>
                      <div className={styles.objMeta}>
                        <span className={`${styles.pill} ${statusTone(result.severity)}`}>
                          {result.severity}
                        </span>
                        <span className={styles.pill}>{sectionLabel(result.sectionKey)}</span>
                        {result.blocking ? <span className={styles.pill}>Blocking</span> : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.empty}>
              <h3>No matching checks</h3>
              <p>Adjust filters or wait for Stage 01 validation to persist results.</p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Validation Intelligence">
          <div className={styles.panelHead}>
            <h2>{selected?.ruleCode || 'Validation Intelligence'}</h2>
            <p>
              Explainable check outcome, module impact, and remediation for the selected validation
              rule.
            </p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Validation tabs">
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
            {!selected ? (
              <div className={styles.empty}>
                <h3>No check selected</h3>
                <p>Persisted or derived validation checks appear when the package is available.</p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Check identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Rule code</span>
                      <strong>{selected.ruleCode}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Module</span>
                      <strong>{sectionLabel(selected.sectionKey)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Severity</span>
                      <strong>{selected.severity}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Status</span>
                      <strong>{resultStatus(selected)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Blocking</span>
                      <strong>{selected.blocking ? 'YES' : 'NO'}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Rule version</span>
                      <strong>{selected.ruleVersion}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Checked at</span>
                      <strong>{new Date(selected.checkedAt).toLocaleString()}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Auto-fix</span>
                      <strong>
                        {selected.ruleCode.startsWith('STUB_ONLY')
                          ? 'YES — Stage 01 reconcile'
                          : selected.passed
                            ? 'N/A'
                            : 'PARTIAL — autonomy Start'}
                      </strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Outcome</h3>
                  <p>{display(selected.explanation)}</p>
                  <div className={styles.gateGrid} aria-label="Validation outcome gates">
                    {[
                      ['Presence', selected.ruleCode.startsWith('REQUIRED_') ? resultStatus(selected) : 'N/A'],
                      ['Stub quality', selected.ruleCode.startsWith('STUB_ONLY') ? resultStatus(selected) : '—'],
                      ['Blocking', selected.blocking ? 'YES' : 'NO'],
                      ['Handoff impact', selected.blocking && !selected.passed ? 'Blocks' : 'Clear'],
                    ].map(([label, value]) => (
                      <div key={String(label)} className={styles.gateChip} data-done={value === 'PASSED' || value === 'Clear' || value === 'NO'}>
                        <strong>{label}</strong>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Package health</h3>
                  <div className={styles.scoreRow}>
                    {[
                      ['Readiness', overview.readiness ?? 0],
                      ['Passed share', stats.total ? Math.round((stats.passed / stats.total) * 100) : 0],
                      ['Blockers free', Math.max(0, 100 - stats.blocking * 8)],
                      ['Handoff', readyForHandoff ? 100 : 0],
                    ].map(([label, value]) => (
                      <div key={String(label)} className={styles.metricTile}>
                        <span className={styles.kpiLabel}>{label}</span>
                        <div
                          className={styles.ring}
                          style={{ ['--p' as string]: Number(value) }}
                          aria-hidden
                        />
                        <strong>{Number(value)}%</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'results' ? (
              <article className={styles.sectionCard}>
                <h3>Validation results</h3>
                <div className={styles.ladderStack} aria-label="Validation results matrix">
                  {filtered.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className={`${styles.ladderRung} ${result.id === selectedId ? styles.ladderRungActive : ''}`}
                      data-state={resultStatus(result)}
                      onClick={() => setSelectedId(result.id)}
                    >
                      <span className={styles.ladderRank}>
                        {result.passed ? '✓' : result.severity === 'WARNING' ? '!' : '×'}
                      </span>
                      <div className={styles.ladderCopy}>
                        <strong>{result.ruleCode}</strong>
                        <span>
                          {sectionLabel(result.sectionKey)} · {result.severity}
                        </span>
                      </div>
                      <em className={`${styles.badge} ${statusTone(resultStatus(result))}`}>
                        {resultStatus(result)}
                      </em>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'rules' ? (
              <article className={styles.sectionCard}>
                <h3>Rule check detail</h3>
                <div className={styles.groupList}>
                  <div className={styles.groupItem}>
                    <span>Expected</span>
                    <b>
                      {selected.ruleCode.startsWith('REQUIRED_')
                        ? '≥1 ACTIVE non-archived record'
                        : selected.ruleCode.startsWith('STUB_ONLY')
                          ? 'At least one reconciled system policy record'
                          : selected.ruleCode.includes('HANDOFF')
                            ? 'All mandatory modules policy-ready'
                            : 'See explanation'}
                    </b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Actual</span>
                    <b>{display(selected.explanation)}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Impact</span>
                    <b>
                      {selected.blocking && !selected.passed
                        ? 'Blocks READY status and Content Intelligence handoff'
                        : selected.passed
                          ? 'No blocking impact'
                          : 'Warning — monitor before handoff'}
                    </b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Recommendation</span>
                    <b>{display(selected.recommendation)}</b>
                  </div>
                </div>
              </article>
            ) : null}

            {selected && tab === 'dependencies' ? (
              <article className={styles.sectionCard}>
                <h3>Dependency chain</h3>
                <div className={styles.depChain}>
                  {dependencyChain(selected.sectionKey).map((item, index) => (
                    <span key={item} style={{ display: 'contents' }}>
                      {index > 0 ? <span className={styles.depArrow}>→</span> : null}
                      <span className={styles.depNode}>{item}</span>
                    </span>
                  ))}
                </div>
                <div className={styles.groupList} style={{ marginTop: 14 }}>
                  <div className={styles.groupItem}>
                    <span>Blocking failures</span>
                    <b>{stats.blocking}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Failed modules</span>
                    <b>
                      {
                        new Set(
                          results
                            .filter((item) => !item.passed && item.sectionKey)
                            .map((item) => item.sectionKey),
                        ).size
                      }
                    </b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Configured sections</span>
                    <b>{overview.metrics?.configuredSections ?? '—'}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>CI handoff metric</span>
                    <b>{overview.metrics?.contentIntelligenceHandoff ? 'ACK' : 'Pending'}</b>
                  </div>
                </div>
              </article>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Why this check {selected.passed ? 'passed' : 'failed'}</h3>
                  <p>
                    {selected.passed
                      ? `Rule ${selected.ruleCode} evaluated successfully for ${sectionLabel(selected.sectionKey)}.`
                      : `Rule ${selected.ruleCode} did not meet the expected condition for ${sectionLabel(selected.sectionKey)}.`}{' '}
                    {selected.explanation}
                  </p>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Decision factors</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Confidence</span>
                      <strong>UNMEASURED</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Evidence source</span>
                      <strong>
                        {validation.run ? 'Persisted validation run' : 'Derived package readiness'}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Downstream impact</span>
                      <strong>
                        {selected.blocking && !selected.passed
                          ? 'Content Intelligence handoff blocked'
                          : 'Handoff path clear for this rule'}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Run status</span>
                      <strong>{validation.run?.status ?? 'NO_RUN'}</strong>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'recommendations' ? (
              <article className={styles.sectionCard}>
                <h3>Remediation</h3>
                <p>{display(selected.recommendation)}</p>
                <div className={styles.xai} style={{ marginTop: 12 }}>
                  <h3>Package recommendations</h3>
                  <ul>
                    <li>
                      {stats.blocking
                        ? `Resolve ${stats.blocking} blocking check(s) before handoff.`
                        : 'No blocking checks remain.'}
                    </li>
                    <li>
                      {stats.warnings
                        ? `Review ${stats.warnings} warning(s) — typically stub-only sections pending reconcile.`
                        : 'No stub-only warnings.'}
                    </li>
                    <li>
                      Use global Start for Stage 01 autonomy; use Re-run Validation only after
                      reconcile completes.
                    </li>
                  </ul>
                </div>
              </article>
            ) : null}

            {selected && tab === 'history' ? (
              <article className={styles.sectionCard}>
                <h3>Validation timeline</h3>
                <ul className={styles.timeline}>
                  <li>
                    <span className={styles.dot} aria-hidden />
                    <div>
                      <strong>Latest run</strong>
                      <p>
                        {validation.run
                          ? `${validation.run.status} · started ${new Date(validation.run.startedAt).toLocaleString()}`
                          : 'No persisted validation run yet'}
                      </p>
                    </div>
                  </li>
                  <li>
                    <span className={styles.dot} aria-hidden />
                    <div>
                      <strong>Package last validated</strong>
                      <p>
                        {overview.lastValidatedAt
                          ? new Date(overview.lastValidatedAt).toLocaleString()
                          : 'Not yet validated'}
                      </p>
                    </div>
                  </li>
                  <li>
                    <span className={styles.dot} aria-hidden />
                    <div>
                      <strong>Current package</strong>
                      <p>
                        v{overview.versionNumber ?? '—'} · {overview.status} · readiness{' '}
                        {overview.readiness ?? 0}%
                      </p>
                    </div>
                  </li>
                </ul>
              </article>
            ) : null}

            {tab === 'audit' ? (
              <article className={styles.sectionCard}>
                <h3>Audit trail</h3>
                {audit.length ? (
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Actor</th>
                        <th>Action</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.slice(0, 12).map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.createdAt).toLocaleString()}</td>
                          <td>{row.actorType}</td>
                          <td>{row.action}</td>
                          <td>{row.reason ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No audit events persisted for this version yet.</p>
                )}
              </article>
            ) : null}
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.insights}`} aria-label="AI Insights">
          <div className={styles.scoreHero}>
            <span className={styles.kpiLabel}>AI Insights</span>
            <strong>{overview.readiness ?? 0}%</strong>
            <span className={`${styles.badge} ${styles.toneAi}`}>
              <BrainCircuit size={12} aria-hidden /> Validation agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Overall health</span>
              <b>
                {stats.blocking
                  ? 'BLOCKED'
                  : stats.warnings
                    ? 'WARNING'
                    : stats.passed
                      ? 'HEALTHY'
                      : 'WAITING'}
              </b>
            </div>
            <div className={styles.insightRow}>
              <span>Readiness score</span>
              <b>{overview.readiness ?? 0}%</b>
            </div>
            <div className={styles.insightRow}>
              <span>Critical blockers</span>
              <b>{stats.blocking}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Handoff</span>
              <b>{readyForHandoff ? 'READY' : 'BLOCKED'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>AI confidence</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Selected rule</span>
              <b>{selected?.ruleCode ?? '—'}</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>Optimization recommendations</h3>
            <ul>
              <li>
                {stats.failed
                  ? `Materialise ${stats.failed} failed mandatory module(s) via Stage 01 Start.`
                  : 'Mandatory presence checks are passing.'}
              </li>
              <li>
                {stats.warnings
                  ? `Reconcile ${stats.warnings} stub-only section(s) into system policy records.`
                  : 'No stub-only warnings detected.'}
              </li>
              <li>
                {readyForHandoff
                  ? 'Package is eligible for Content Intelligence handoff after activation.'
                  : 'Do not hand off to Stage 02 until blockers are clear.'}
              </li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Validation health axes">
            {[
              ['Readiness', overview.readiness ?? 0],
              ['Passed', stats.total ? Math.round((stats.passed / stats.total) * 100) : 0],
              ['Clear blockers', Math.max(0, 100 - stats.blocking * 8)],
              ['Warnings free', Math.max(0, 100 - stats.warnings * 10)],
              ['Handoff', readyForHandoff ? 100 : 15],
              ['Configured', overview.metrics?.configuredSections
                ? Math.round(((overview.metrics.configuredSections as number) / 13) * 100)
                : 0],
            ].map(([label, value]) => (
              <div key={label} className={styles.radarItem}>
                <span>{label}</span>
                <div className={styles.radarBar}>
                  <i style={{ width: `${Math.max(0, Math.min(100, Number(value)))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section className={styles.bottom} aria-label="Timeline activity and audit">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Execution timeline</h2>
            <p>Persisted Stage 01 validation milestones</p>
          </div>
          <div className={styles.tabBody}>
            <ul className={styles.timeline}>
              <li>
                <span className={styles.dot} aria-hidden />
                <div>
                  <strong>Strategy version</strong>
                  <p>
                    v{overview.versionNumber ?? '—'} · {overview.status}
                  </p>
                </div>
              </li>
              <li>
                <span className={styles.dot} aria-hidden />
                <div>
                  <strong>Validation persistence</strong>
                  <p>
                    {stats.passed} passed · {stats.failed} failed · {stats.warnings} warnings
                  </p>
                </div>
              </li>
              <li>
                <span className={styles.dot} aria-hidden />
                <div>
                  <strong>System control</strong>
                  <p>{systemState}</p>
                </div>
              </li>
            </ul>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Live activity</h2>
            <p>Current autonomy posture</p>
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightRow}>
              <span>Run status</span>
              <b>{run?.status ?? 'IDLE'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Validation run</span>
              <b>{validation.run?.status ?? 'NONE'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Activity size={12} aria-hidden /> Agent
              </span>
              <b>Strategy Validation</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <AlertTriangle size={12} aria-hidden /> Blockers
              </span>
              <b>{stats.blocking}</b>
            </div>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Recent audit</h2>
            <p>Latest strategy events</p>
          </div>
          <div className={styles.tabBody}>
            {audit.slice(0, 5).map((row) => (
              <div key={row.id} className={styles.insightRow}>
                <span>{row.action}</span>
                <b>{row.actorType}</b>
              </div>
            ))}
            {!audit.length ? <p className={styles.empty}>No events yet.</p> : null}
          </div>
        </article>
      </section>
    </motion.main>
  );
}
