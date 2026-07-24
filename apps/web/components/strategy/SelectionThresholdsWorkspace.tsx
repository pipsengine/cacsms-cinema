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
  Scale,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  configDisplay,
  DECISION_FIELDS,
  decisionAction,
  fieldLabel,
  filterThresholdRecords,
  isMandatory,
  isThresholdRule,
  isThresholdStub,
  RULE_CORE_FIELDS,
  ruleCategory,
  ruleCategoryLabel,
  thresholdCoverage,
  thresholdExpression,
  thresholdIssues,
  thresholdSubtitle,
  type ThresholdFilter,
} from '@/apps/web/lib/strategy-thresholds';
import styles from './selection-thresholds-intel.module.css';

type TabId =
  | 'overview'
  | 'rules'
  | 'matrix'
  | 'evaluation'
  | 'reasoning'
  | 'dependencies'
  | 'history'
  | 'audit';

type AuditRow = {
  id: string;
  action: string;
  actorType: string;
  createdAt: string;
  reason: string | null;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'rules', label: 'Decision Rules' },
  { id: 'matrix', label: 'Threshold Matrix' },
  { id: 'evaluation', label: 'Rule Evaluation' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'define', label: 'Define', icon: Compass },
  { key: 'evaluate', label: 'Evaluate', icon: FileSearch },
  { key: 'validate', label: 'Validate', icon: CheckCircle2 },
  { key: 'apply', label: 'Apply', icon: SlidersHorizontal },
  { key: 'monitor', label: 'Monitor', icon: Gauge },
  { key: 'persist', label: 'Persist', icon: CircleDot },
  { key: 'handoff', label: 'Handoff', icon: GitBranch },
] as const;

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'COMPLETED':
    case 'RUNNING':
    case 'Completed':
    case 'ACCEPT':
    case 'YES':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'Failed':
    case 'REJECT':
      return styles.toneBlocked;
    case 'QUEUED':
    case 'PAUSED':
    case 'WARNING':
    case 'Running':
    case 'REVIEW':
    case 'ESCALATE':
    case 'HOLD':
    case 'REGENERATE':
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
  systemRunning: boolean,
  runStatus?: string | null,
  versionStatus?: string,
  ruleCount?: number,
) {
  if ((ruleCount ?? 0) > 0 && (versionStatus === 'ACTIVE' || versionStatus === 'READY')) {
    return 'done';
  }
  if ((ruleCount ?? 0) > 0) {
    return index <= 5 ? 'done' : index === 6 ? 'active' : 'pending';
  }
  if (runStatus === 'RUNNING' || runStatus === 'QUEUED' || systemRunning) {
    if (index === 0) return 'active';
    return 'pending';
  }
  if (versionStatus === 'DRAFT' || versionStatus === 'INVALID') {
    return index === 0 ? 'active' : 'pending';
  }
  return 'pending';
}

export function SelectionThresholdsWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ThresholdFilter>('all');
  const [tab, setTab] = useState<TabId>('overview');
  const [busy, setBusy] = useState(true);
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
        setRecords([]);
        setAudit([]);
        return;
      }
      const [list, auditRows] = await Promise.all([
        strategyApi.list(next.versionId, 'selection-thresholds'),
        strategyApi.audit(next.versionId).catch(() => [] as AuditRow[]),
      ]);
      const live = list.filter((record) => record.status !== 'ARCHIVED');
      setRecords(live);
      setAudit(auditRows);
      const targetId = preferId ?? selectedId;
      const selected = targetId ? live.find((item) => item.id === targetId) : live[0];
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

  const policyRules = useMemo(() => records.filter(isThresholdRule), [records]);
  const issues = useMemo(() => thresholdIssues(records), [records]);
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const record of records) set.add(ruleCategory(record));
    return [...set];
  }, [records]);

  const activeThresholds = records.filter(
    (item) => item.status === 'ACTIVE' || item.status === 'READY',
  ).length;
  const mandatoryCount = records.filter(isMandatory).length;
  const avgCoverage = records.length
    ? Math.round(records.reduce((sum, item) => sum + thresholdCoverage(item), 0) / records.length)
    : 0;
  const validationScore = records.length
    ? Math.round((activeThresholds / records.length) * 100)
    : 0;
  const pendingOptimizations = issues.thinRules.length + issues.missingDecision.length;

  const kpis = useMemo(
    () => [
      {
        label: 'Active Thresholds',
        value: String(activeThresholds || policyRules.length || records.length),
        meta: 'ACTIVE / READY decision gates',
        accent: '#2563EB',
        icon: SlidersHorizontal,
        bars: sparkBars(activeThresholds || policyRules.length),
      },
      {
        label: 'AI Confidence',
        value: 'UNMEAS.',
        meta: 'No fabricated accuracy scores',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(3),
      },
      {
        label: 'Rule Coverage',
        value: `${avgCoverage}%`,
        meta: `${categories.length} rule categories`,
        accent: '#0284C7',
        icon: Scale,
        bars: sparkBars(avgCoverage),
      },
      {
        label: 'Validation Score',
        value: `${validationScore}%`,
        meta: overview?.readiness != null ? `Package ${overview.readiness}%` : 'Active-rule share',
        accent: '#16A34A',
        icon: CheckCircle2,
        bars: sparkBars(validationScore),
      },
      {
        label: 'Decision Accuracy',
        value: 'UNMEAS.',
        meta: 'Await measured selection outcomes',
        accent: '#D97706',
        icon: Gauge,
        bars: sparkBars(2),
      },
      {
        label: 'Pending Optimizations',
        value: String(pendingOptimizations),
        meta: `${mandatoryCount} mandatory gates`,
        accent: '#0F766E',
        icon: AlertTriangle,
        bars: sparkBars(pendingOptimizations),
      },
    ],
    [
      activeThresholds,
      policyRules.length,
      records.length,
      avgCoverage,
      categories.length,
      validationScore,
      overview?.readiness,
      pendingOptimizations,
      mandatoryCount,
    ],
  );

  const explorerSource = useMemo(() => {
    const live = records.filter((record) => !isThresholdStub(record));
    const policy = live.filter(isThresholdRule);
    return policy.length > 0 ? policy : live.length > 0 ? live : records;
  }, [records]);

  const filtered = useMemo(
    () => filterThresholdRecords(explorerSource, query, filter),
    [explorerSource, query, filter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    records.find((item) => item.id === selectedId) ??
    null;
  const config = selected?.configuration ?? {};
  const selectedAction = selected ? decisionAction(selected) : 'UNDECLARED';
  const selectedCoverage = selected ? thresholdCoverage(selected) : 0;

  const packageStatus =
    overview?.status === 'ACTIVE'
      ? 'Completed'
      : overview?.status === 'READY'
        ? 'Validated'
        : systemRunning
          ? 'Running'
          : overview?.status === 'INVALID'
            ? 'Failed'
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

  if (error || !overview?.available) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Strategy & Fields / Autonomous Selection Thresholds</p>
        <h1 className={styles.title}>Autonomous Selection Thresholds</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Strategy service unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>Strategy & Fields / Autonomous Selection Thresholds</p>
          <h1 className={styles.title}>Autonomous Selection Thresholds</h1>
          <p className={styles.lede}>
            Autonomously governed decision gates defining accept, reject, review, regenerate, and
            escalate criteria for CACSMS content selection.
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
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only</strong>
          Selection thresholds are generated automatically during Stage 01. This workspace provides
          decision-rule exploration, matrix evaluation, and audit visibility only — no manual
          create, edit, or delete.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Threshold KPI summary">
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

      <section className={styles.lifecycle} aria-label="Threshold lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Threshold lifecycle</h2>
          <span>
            {systemRunning
              ? 'Stage 01 running — threshold definition active'
              : `System ${systemState} · package ${overview.status}`}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {LIFECYCLE.map((stage, index) => {
            const Icon = stage.icon;
            const state = lifecycleState(
              index,
              systemRunning,
              run?.status,
              overview.status,
              policyRules.length || records.length,
            );
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

      {!records.length ? (
        <section
          className={styles.waiting}
          aria-label="Awaiting autonomous threshold generation"
        >
          <div className={styles.waitingIcon}>
            <SlidersHorizontal size={24} aria-hidden />
          </div>
          <h3>Awaiting Autonomous Threshold Generation</h3>
          <p>
            Stage 01 has not yet generated selection thresholds. Decision gates appear automatically
            after global Start begins and threshold reconciliation completes.
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
              Define → Evaluate → Validate → Persist
            </div>
          </div>
          <div className={styles.ghostCards} aria-hidden>
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
          </div>
        </section>
      ) : null}

      {records.length && systemRunning && !policyRules.length ? (
        <section className={styles.infoNotice} role="status" aria-live="polite">
          <Timer size={16} aria-hidden />
          <div>
            <strong>Live threshold generation in progress</strong>
            Stage 01 is reconciling decision gates. Explorer and intelligence panels update
            automatically as records persist.
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Threshold Explorer">
          <div className={styles.panelHead}>
            <h2>Threshold Explorer</h2>
            <p>
              {explorerSource.length} rules
              {filtered.length !== explorerSource.length ? ` · ${filtered.length} shown` : ''} ·
              auto-updating
            </p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter decision thresholds…"
              aria-label="Search selection thresholds"
            />
            <div className={styles.chips} role="group" aria-label="Threshold filters">
              {(
                [
                  ['all', 'All'],
                  ['mandatory', 'Mandatory'],
                  ['optional', 'Optional'],
                  ['active', 'Active'],
                  ['reject', 'Reject'],
                  ['review', 'Review'],
                  ['escalate', 'Escalate/Hold'],
                  ['thin_rule', 'Thin'],
                  ['missing_decision', 'No decision'],
                  ['missing_audit', 'No audit'],
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
              {filtered.map((record) => {
                const active = record.id === selectedId;
                const action = decisionAction(record);
                const coverage = thresholdCoverage(record);
                return (
                  <li key={record.id}>
                    <button
                      type="button"
                      className={`${styles.objCard} ${active ? styles.objCardActive : ''}`}
                      onClick={() => setSelectedId(record.id ?? null)}
                    >
                      <div className={styles.objCardTop}>
                        <strong>{record.name}</strong>
                        <em className={`${styles.badge} ${statusTone(action)}`}>{action}</em>
                      </div>
                      <div className={styles.objMeta}>
                        <span className={`${styles.pill} ${statusTone(record.status)}`}>
                          {ruleCategoryLabel(ruleCategory(record))}
                        </span>
                        <span className={styles.pill}>
                          {isMandatory(record) ? 'Mandatory' : 'Optional'}
                        </span>
                        <span className={styles.pill}>{coverage}% fill</span>
                        <span className={styles.pill}>UNMEASURED conf.</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.empty}>
              <h3>{systemRunning ? 'Definition in progress' : 'No matching thresholds'}</h3>
              <p>
                {systemRunning
                  ? 'Threshold reconciliation is materialising decision gates. This explorer updates automatically.'
                  : 'Adjust filters or wait for Stage 01 to materialise selection thresholds.'}
              </p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Threshold Intelligence">
          <div className={styles.panelHead}>
            <h2>{selected?.name || 'Threshold Intelligence'}</h2>
            <p>
              Explainable decision gate, evaluation criteria, and governance for the selected
              threshold.
            </p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Threshold tabs">
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
                <h3>No threshold selected</h3>
                <p>Persisted decision gates are selected automatically when Stage 01 completes.</p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Threshold identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Rule name</span>
                      <strong>{display(selected.name)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>System key</span>
                      <strong>{display(configDisplay(config, 'systemKey'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Category</span>
                      <strong>{ruleCategoryLabel(ruleCategory(selected))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Expression</span>
                      <strong>{thresholdExpression(selected)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Decision</span>
                      <strong>{selectedAction}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Mandatory</span>
                      <strong>{display(configDisplay(config, 'mandatory'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Priority</span>
                      <strong>{selected.priority}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Owning agent</span>
                      <strong>Selection Threshold Agent</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Executive summary</h3>
                  <p>{display(selected.description)}</p>
                  <div className={styles.gateGrid} aria-label="Decision gates">
                    {[
                      ['Metric', 'metric'],
                      ['Operator', 'operator'],
                      ['Value', 'value'],
                      ['Decision', 'decisionAction'],
                      ['Escalation', 'escalationAction'],
                      ['Audit', 'auditRequired'],
                    ].map(([label, key]) => {
                      const done = Boolean(configDisplay(config, key).trim());
                      return (
                        <div key={key} className={styles.gateChip} data-done={done}>
                          <strong>{label}</strong>
                          <span>{done ? 'Configured' : 'Pending'}</span>
                        </div>
                      );
                    })}
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Decision health</h3>
                  <div className={styles.scoreRow}>
                    {[
                      ['Rule fill', selectedCoverage],
                      ['Priority', selected.priority],
                      ['Package readiness', overview.readiness ?? 0],
                      ['Issues free', Math.max(0, 100 - issues.issueCount * 8)],
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
                  <p style={{ marginTop: 12, color: 'var(--muted)' }}>
                    Decision accuracy and model confidence remain UNMEASURED until selection
                    outcomes are measured in production.
                  </p>
                </article>
              </>
            ) : null}

            {selected && tab === 'rules' ? (
              <article className={styles.sectionCard}>
                <h3>Decision rules</h3>
                <div className={styles.groupList}>
                  {[...RULE_CORE_FIELDS, ...DECISION_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'matrix' ? (
              <article className={styles.sectionCard}>
                <h3>Threshold matrix</h3>
                <div className={styles.ladderStack} aria-label="Threshold decision matrix">
                  {filtered.map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      className={`${styles.ladderRung} ${record.id === selectedId ? styles.ladderRungActive : ''}`}
                      data-state={decisionAction(record)}
                      onClick={() => setSelectedId(record.id ?? null)}
                    >
                      <span className={styles.ladderRank}>P{record.priority}</span>
                      <div className={styles.ladderCopy}>
                        <strong>{record.name}</strong>
                        <span>{thresholdExpression(record)}</span>
                      </div>
                      <em className={`${styles.badge} ${statusTone(decisionAction(record))}`}>
                        {decisionAction(record)}
                      </em>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'evaluation' ? (
              <article className={styles.sectionCard}>
                <h3>Rule evaluation</h3>
                <div className={styles.groupList}>
                  <div className={styles.groupItem}>
                    <span>Scope type</span>
                    <b>{display(configDisplay(config, 'scopeType'))}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Scope id</span>
                    <b>{display(configDisplay(config, 'scopeId'))}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Override policy</span>
                    <b>{display(configDisplay(config, 'overrideAllowed'))}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Escalation</span>
                    <b>{display(configDisplay(config, 'escalationAction'))}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Effective from</span>
                    <b>
                      {selected.effectiveFrom
                        ? new Date(selected.effectiveFrom).toLocaleString()
                        : display(configDisplay(config, 'effectiveFromNote'))}
                    </b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Effective to</span>
                    <b>
                      {selected.effectiveTo
                        ? new Date(selected.effectiveTo).toLocaleString()
                        : display(configDisplay(config, 'effectiveToNote'))}
                    </b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Evaluation outcome</span>
                    <b>UNMEASURED — awaiting selection runs</b>
                  </div>
                </div>
              </article>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Why this threshold exists</h3>
                  <p>
                    Generated by the Selection Threshold Agent to enforce{' '}
                    {ruleCategoryLabel(ruleCategory(selected))} with decision {selectedAction}.
                    {selected.description ? ` ${selected.description}` : ''}
                  </p>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Decision factors</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Origin</span>
                      <strong>{display(configDisplay(config, 'origin'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Expression</span>
                      <strong>{thresholdExpression(selected)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Confidence</span>
                      <strong>UNMEASURED</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Linked sections</span>
                      <strong>{display(configDisplay(config, 'linkedSections'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Audit requirement</span>
                      <strong>{display(configDisplay(config, 'auditRequired'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Override hierarchy</span>
                      <strong>{display(configDisplay(config, 'overrideAllowed'))}</strong>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'dependencies' ? (
              <article className={styles.sectionCard}>
                <h3>Downstream and peer links</h3>
                <div className={styles.depChain}>
                  {[
                    'objectives',
                    'domains',
                    'source-policy',
                    'risk-policy',
                    'audiences',
                    'geographies',
                    'channels',
                    'portfolio',
                  ].map((item, index) => (
                    <span key={item} style={{ display: 'contents' }}>
                      {index > 0 ? <span className={styles.depArrow}>→</span> : null}
                      <span className={styles.depNode}>{item}</span>
                    </span>
                  ))}
                </div>
                <div className={styles.groupList} style={{ marginTop: 14 }}>
                  <div className={styles.groupItem}>
                    <span>Detected issues</span>
                    <b>{issues.issueCount}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Conflicting thresholds</span>
                    <b>{issues.conflicting.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Thin rules</span>
                    <b>{issues.thinRules.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Missing audit</span>
                    <b>{issues.missingAudit.length}</b>
                  </div>
                </div>
              </article>
            ) : null}

            {selected && tab === 'history' ? (
              <article className={styles.sectionCard}>
                <h3>Version timeline</h3>
                <ul className={styles.timeline}>
                  <li>
                    <span className={styles.dot} aria-hidden />
                    <div>
                      <strong>Threshold materialisation</strong>
                      <p>
                        {selected.effectiveFrom
                          ? new Date(selected.effectiveFrom).toLocaleString()
                          : 'Timestamp not persisted'}
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
                  <li>
                    <span className={styles.dot} aria-hidden />
                    <div>
                      <strong>Autonomy run</strong>
                      <p>{run?.status ?? 'IDLE'}</p>
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
            <strong>{selected ? selectedAction : '—'}</strong>
            <span className={`${styles.badge} ${styles.toneAi}`}>
              <BrainCircuit size={12} aria-hidden /> Threshold agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Decision confidence</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Threshold health</span>
              <b>{selected ? `${selectedCoverage}% fill` : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Optimization opportunities</span>
              <b>{pendingOptimizations}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Mandatory gates</span>
              <b>{mandatoryCount}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Detected issues</span>
              <b>{issues.issueCount}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Subtitle</span>
              <b>{selected ? thresholdSubtitle(selected) : '—'}</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>Recommendations</h3>
            <ul>
              <li>
                {issues.missingDecision.length
                  ? `Declare decision actions for ${issues.missingDecision.length} rule(s).`
                  : 'Decision actions are declared on threshold rules.'}
              </li>
              <li>
                {issues.conflicting.length
                  ? `Resolve ${issues.conflicting.length} conflicting metric/scope pair(s).`
                  : 'No conflicting metric/scope pairs detected.'}
              </li>
              <li>
                Keep mandatory reject/escalate gates ahead of optional regenerate paths before
                portfolio handoff.
              </li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Threshold health axes">
            {[
              ['Coverage', selectedCoverage],
              ['Validation', validationScore],
              ['Priority', selected?.priority ?? 0],
              ['Categories', Math.min(100, categories.length * 9)],
              ['Mandatory', Math.min(100, mandatoryCount * 9)],
              ['Issues free', Math.max(0, 100 - issues.issueCount * 8)],
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
            <p>Persisted Stage 01 milestones</p>
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
                  <strong>Threshold persistence</strong>
                  <p>
                    {policyRules.length || records.length} rules · {mandatoryCount} mandatory ·{' '}
                    {activeThresholds} active
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
              <span>Rules discovered</span>
              <b>{records.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Activity size={12} aria-hidden /> Agent
              </span>
              <b>Selection Thresholds</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <AlertTriangle size={12} aria-hidden /> Issues
              </span>
              <b>{issues.issueCount}</b>
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
