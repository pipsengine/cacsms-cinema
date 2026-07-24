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
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  automaticAction,
  CLASSIFICATION_FIELDS,
  configDisplay,
  DETECTION_FIELDS,
  fieldLabel,
  filterRiskRecords,
  isRiskPolicyRule,
  isRiskStub,
  MITIGATION_FIELDS,
  mitigationReadiness,
  riskCategory,
  riskCoverage,
  riskIssues,
  riskPostureLabel,
  riskSeverity,
  riskSubtitle,
  type RiskFilter,
} from '@/apps/web/lib/strategy-risk';
import styles from './risk-policy-intel.module.css';

type TabId =
  | 'overview'
  | 'classification'
  | 'detection'
  | 'mitigation'
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
  { id: 'classification', label: 'Risk Classification' },
  { id: 'detection', label: 'Detection Rules' },
  { id: 'mitigation', label: 'Mitigation & Escalation' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'discover', label: 'Discover', icon: Compass },
  { key: 'assess', label: 'Assess', icon: FileSearch },
  { key: 'classify', label: 'Classify', icon: Scale },
  { key: 'mitigate', label: 'Mitigate', icon: ShieldCheck },
  { key: 'validate', label: 'Validate', icon: CheckCircle2 },
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
    case 'LOW':
    case 'MEDIUM':
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
    case 'HIGH':
    case 'ELEVATED':
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

export function RiskPolicyWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RiskFilter>('all');
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
        strategyApi.list(next.versionId, 'risk-policy'),
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

  const policyRules = useMemo(() => records.filter(isRiskPolicyRule), [records]);
  const issues = useMemo(() => riskIssues(records), [records]);
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const record of records) {
      set.add(riskCategory(record));
    }
    return [...set];
  }, [records]);

  const highRisk = records.filter((item) => {
    const severity = riskSeverity(item);
    return severity === 'CRITICAL' || severity === 'HIGH';
  }).length;
  const activeRules = records.filter(
    (item) => item.status === 'ACTIVE' || item.status === 'READY',
  ).length;
  const avgCoverage = records.length
    ? Math.round(records.reduce((sum, item) => sum + riskCoverage(item), 0) / records.length)
    : 0;
  const avgMitigation = records.length
    ? Math.round(
        records.reduce((sum, item) => sum + mitigationReadiness(item), 0) / records.length,
      )
    : 0;
  const complianceScore = records.length
    ? Math.round((activeRules / records.length) * 100)
    : 0;

  const kpis = useMemo(
    () => [
      {
        label: 'Risk Policies',
        value: String(policyRules.length || records.length),
        meta: 'Persisted sensitivity rules',
        accent: '#2563EB',
        icon: ShieldAlert,
        bars: sparkBars(policyRules.length || records.length),
      },
      {
        label: 'High-Risk Categories',
        value: String(highRisk),
        meta: 'CRITICAL + HIGH severity',
        accent: '#DC2626',
        icon: AlertTriangle,
        bars: sparkBars(highRisk),
      },
      {
        label: 'Active Rules',
        value: String(activeRules),
        meta: 'ACTIVE / READY records',
        accent: '#16A34A',
        icon: CheckCircle2,
        bars: sparkBars(activeRules),
      },
      {
        label: 'AI Confidence',
        value: 'UNMEAS.',
        meta: 'No fabricated residual scores',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(3),
      },
      {
        label: 'Compliance Score',
        value: `${complianceScore}%`,
        meta: overview?.readiness != null ? `Package ${overview.readiness}%` : 'Active-rule share',
        accent: '#D97706',
        icon: Gauge,
        bars: sparkBars(complianceScore),
      },
      {
        label: 'Mitigation Readiness',
        value: `${avgMitigation}%`,
        meta: 'Escalation & remediation fill',
        accent: '#0F766E',
        icon: ShieldCheck,
        bars: sparkBars(avgMitigation),
      },
    ],
    [
      policyRules.length,
      records.length,
      highRisk,
      activeRules,
      complianceScore,
      avgMitigation,
      overview?.readiness,
    ],
  );

  const explorerSource = useMemo(() => {
    const live = records.filter((record) => !isRiskStub(record));
    const policy = live.filter(isRiskPolicyRule);
    return policy.length > 0 ? policy : live.length > 0 ? live : records;
  }, [records]);

  const filtered = useMemo(
    () => filterRiskRecords(explorerSource, query, filter),
    [explorerSource, query, filter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    records.find((item) => item.id === selectedId) ??
    null;
  const config = selected?.configuration ?? {};
  const selectedSeverity = selected ? riskSeverity(selected) : 'UNKNOWN';
  const selectedCoverage = selected ? riskCoverage(selected) : 0;
  const selectedMitigation = selected ? mitigationReadiness(selected) : 0;

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
        <p className={styles.crumb}>Strategy & Fields / Risk & Sensitivity Policy</p>
        <h1 className={styles.title}>Risk & Sensitivity Policy</h1>
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
          <p className={styles.crumb}>Strategy & Fields / Risk & Sensitivity Policy</p>
          <h1 className={styles.title}>Risk & Sensitivity Policy</h1>
          <p className={styles.lede}>
            Autonomously governed sensitivity rules for blocking, escalation, remediation, and
            publishing safety across CACSMS content production.
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
          Risk policies are generated automatically during Stage 01. This workspace provides
          classification, detection, mitigation, and audit visibility only — no manual create,
          edit, or delete.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Risk KPI summary">
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

      <section className={styles.lifecycle} aria-label="Risk lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Risk lifecycle</h2>
          <span>
            {systemRunning
              ? 'Stage 01 running — risk assessment active'
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
        <section className={styles.waiting} aria-label="Awaiting autonomous risk policy generation">
          <div className={styles.waitingIcon}>
            <ShieldAlert size={24} aria-hidden />
          </div>
          <h3>Awaiting Autonomous Risk Policy Generation</h3>
          <p>
            Stage 01 has not yet generated risk & sensitivity policies. Rules appear automatically
            after global Start begins and risk reconciliation completes.
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
              Discover → Assess → Classify → Mitigate → Persist
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
            <strong>Live risk policy generation in progress</strong>
            Stage 01 is reconciling sensitivity rules. Explorer and intelligence panels update
            automatically as records persist.
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Risk Explorer">
          <div className={styles.panelHead}>
            <h2>Risk Explorer</h2>
            <p>
              {explorerSource.length} policies
              {filtered.length !== explorerSource.length ? ` · ${filtered.length} shown` : ''} ·
              auto-updating
            </p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter risk policies…"
              aria-label="Search risk and sensitivity policies"
            />
            <div className={styles.chips} role="group" aria-label="Risk filters">
              {(
                [
                  ['all', 'All'],
                  ['critical', 'Critical'],
                  ['high', 'High'],
                  ['elevated', 'Elevated'],
                  ['medium', 'Medium'],
                  ['active', 'Active'],
                  ['review_required', 'Review'],
                  ['thin_policy', 'Thin'],
                  ['missing_detection', 'No detection'],
                  ['missing_escalation', 'No escalation'],
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
                const severity = riskSeverity(record);
                const coverage = riskCoverage(record);
                return (
                  <li key={record.id}>
                    <button
                      type="button"
                      className={`${styles.objCard} ${active ? styles.objCardActive : ''}`}
                      onClick={() => setSelectedId(record.id ?? null)}
                    >
                      <div className={styles.objCardTop}>
                        <strong>{record.name}</strong>
                        <em className={`${styles.badge} ${statusTone(severity)}`}>{severity}</em>
                      </div>
                      <div className={styles.objMeta}>
                        <span className={`${styles.pill} ${statusTone(severity)}`}>
                          {riskCategory(record)}
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
              <h3>{systemRunning ? 'Assessment in progress' : 'No matching policies'}</h3>
              <p>
                {systemRunning
                  ? 'Risk reconciliation is materialising policies. This explorer updates automatically.'
                  : 'Adjust filters or wait for Stage 01 to materialise risk policies.'}
              </p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Risk Intelligence">
          <div className={styles.panelHead}>
            <h2>{selected?.name || 'Risk Intelligence'}</h2>
            <p>
              Explainable sensitivity rule, detection gates, and mitigation workflow for the
              selected policy.
            </p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Risk tabs">
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
                <h3>No risk policy selected</h3>
                <p>Persisted sensitivity rules are selected automatically when Stage 01 completes.</p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Policy identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Policy name</span>
                      <strong>{display(selected.name)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>System key</span>
                      <strong>{display(configDisplay(config, 'systemKey'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Category</span>
                      <strong>{riskCategory(selected)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Severity</span>
                      <strong>{selectedSeverity}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Likelihood</span>
                      <strong>{display(configDisplay(config, 'likelihood'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Record status</span>
                      <strong>{display(selected.status)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Priority</span>
                      <strong>{selected.priority}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Owning agent</span>
                      <strong>Risk Policy Agent</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Executive summary</h3>
                  <p>{display(selected.description)}</p>
                  <div className={styles.gateGrid} aria-label="Control gates">
                    {[
                      ['Detection', 'detectionMethod'],
                      ['Action', 'automaticAction'],
                      ['Escalation', 'escalationRequired'],
                      ['Review', 'reviewRequired'],
                      ['Remediation', 'remediation'],
                      ['Closure', 'closureEvidence'],
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
                  <h3>Risk posture (declared controls)</h3>
                  <div className={styles.scoreRow}>
                    {[
                      ['Policy fill', selectedCoverage],
                      ['Mitigation', selectedMitigation],
                      ['Priority', selected.priority],
                      ['Package readiness', overview.readiness ?? 0],
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
                    Residual risk probability remains UNMEASURED — severity labels are policy
                    declarations, not fabricated scores.
                  </p>
                </article>
              </>
            ) : null}

            {selected && tab === 'classification' ? (
              <article className={styles.sectionCard}>
                <h3>Risk classification</h3>
                <div className={styles.groupList}>
                  {[...CLASSIFICATION_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
                <div className={styles.ladderStack} aria-label="Severity heatmap">
                  {filtered.map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      className={`${styles.ladderRung} ${record.id === selectedId ? styles.ladderRungActive : ''}`}
                      data-state={riskSeverity(record)}
                      onClick={() => setSelectedId(record.id ?? null)}
                    >
                      <span className={styles.ladderRank}>{riskSeverity(record).slice(0, 1)}</span>
                      <div className={styles.ladderCopy}>
                        <strong>{record.name}</strong>
                        <span>
                          {riskCategory(record)} · {riskSeverity(record)}
                        </span>
                      </div>
                      <em className={`${styles.badge} ${statusTone(riskSeverity(record))}`}>
                        {riskSeverity(record)}
                      </em>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'detection' ? (
              <article className={styles.sectionCard}>
                <h3>Detection rules</h3>
                <div className={styles.groupList}>
                  {[...DETECTION_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'mitigation' ? (
              <article className={styles.sectionCard}>
                <h3>Mitigation & escalation</h3>
                <div className={styles.groupList}>
                  {[...MITIGATION_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Why this rule exists</h3>
                  <p>
                    Generated by the Risk Policy Agent to govern {riskCategory(selected)} at
                    declared severity {selectedSeverity}.
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
                      <span>Automatic action</span>
                      <strong>{display(automaticAction(selected))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Confidence</span>
                      <strong>UNMEASURED</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Blocking threshold</span>
                      <strong>{display(configDisplay(config, 'blockingThreshold'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Linked audiences</span>
                      <strong>{display(configDisplay(config, 'audiences'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Linked geographies</span>
                      <strong>{display(configDisplay(config, 'countries'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Channels</span>
                      <strong>{display(configDisplay(config, 'channels'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Formats</span>
                      <strong>{display(configDisplay(config, 'formats'))}</strong>
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
                    'editorial-policy',
                    'source-policy',
                    'geographies',
                    'audiences',
                    'channels',
                    'selection-thresholds',
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
                    <span>Thin policies</span>
                    <b>{issues.thinPolicies.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Missing detection</span>
                    <b>{issues.missingDetection.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Review-required rules</span>
                    <b>{issues.reviewRequired.length}</b>
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
                      <strong>Risk policy materialisation</strong>
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
            <strong>{selected ? selectedSeverity : '—'}</strong>
            <span className={`${styles.badge} ${styles.toneAi}`}>
              <BrainCircuit size={12} aria-hidden /> Risk agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Risk posture</span>
              <b>{riskPostureLabel(records)}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Sensitivity level</span>
              <b>{selected ? selectedSeverity : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Policy fill</span>
              <b>{selected ? `${selectedCoverage}%` : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Compliance status</span>
              <b>{selected ? display(selected.status) : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Automatic action</span>
              <b>{selected ? display(automaticAction(selected)) : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>AI confidence</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Detected issues</span>
              <b>{issues.issueCount}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Subtitle</span>
              <b>{selected ? riskSubtitle(selected) : '—'}</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>Recommendations</h3>
            <ul>
              <li>
                {issues.missingDetection.length
                  ? `Declare detection methods for ${issues.missingDetection.length} policy(ies).`
                  : 'Detection methods are declared on risk policies.'}
              </li>
              <li>
                {issues.missingEscalation.length
                  ? `Add escalation posture to ${issues.missingEscalation.length} rule(s).`
                  : 'Escalation postures are present on risk rules.'}
              </li>
              <li>
                Keep CRITICAL and HIGH severity rules behind review gates before publish handoff.
              </li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Risk health axes">
            {[
              ['Coverage', selectedCoverage],
              ['Mitigation', selectedMitigation],
              ['Priority', selected?.priority ?? 0],
              ['Categories', Math.min(100, categories.length * 7)],
              ['Compliance', complianceScore],
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
                  <strong>Risk policy persistence</strong>
                  <p>
                    {policyRules.length || records.length} policies · {highRisk} high-risk ·{' '}
                    {activeRules} active
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
              <span>Policies discovered</span>
              <b>{records.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Activity size={12} aria-hidden /> Agent
              </span>
              <b>Risk Policy</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <AlertTriangle size={12} aria-hidden /> Issues
              </span>
              <b>{issues.issueCount}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Avg coverage</span>
              <b>{avgCoverage}%</b>
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
