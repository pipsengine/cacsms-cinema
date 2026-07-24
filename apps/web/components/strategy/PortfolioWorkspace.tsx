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
  Gauge,
  GitBranch,
  LayoutGrid,
  PieChart,
  Scale,
  ShieldAlert,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  ALLOCATION_FIELDS,
  allocationCategory,
  allocationCategoryLabel,
  CAPACITY_FIELDS,
  configDisplay,
  fieldLabel,
  filterPortfolioRecords,
  isPortfolioRule,
  isPortfolioStub,
  portfolioCoverage,
  portfolioIssues,
  portfolioSubtitle,
  SCHEDULE_FIELDS,
  targetPercentage,
  type PortfolioFilter,
} from '@/apps/web/lib/strategy-portfolio';
import styles from './portfolio-intel.module.css';

type TabId =
  | 'overview'
  | 'rules'
  | 'capacity'
  | 'scheduling'
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
  { id: 'rules', label: 'Allocation Rules' },
  { id: 'capacity', label: 'Capacity & Diversity' },
  { id: 'scheduling', label: 'Scheduling & Frequency' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'plan', label: 'Plan', icon: Compass },
  { key: 'allocate', label: 'Allocate', icon: LayoutGrid },
  { key: 'balance', label: 'Balance', icon: Scale },
  { key: 'validate', label: 'Validate', icon: CheckCircle2 },
  { key: 'optimize', label: 'Optimize', icon: Gauge },
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
    case 'YES':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'Failed':
      return styles.toneBlocked;
    case 'QUEUED':
    case 'PAUSED':
    case 'WARNING':
    case 'Running':
    case 'UNMEASURED':
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

export function PortfolioWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PortfolioFilter>('all');
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
        strategyApi.list(next.versionId, 'portfolio'),
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

  const policyRules = useMemo(() => records.filter(isPortfolioRule), [records]);
  const issues = useMemo(() => portfolioIssues(records), [records]);
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const record of records) set.add(allocationCategory(record));
    return [...set];
  }, [records]);

  const avgCoverage = records.length
    ? Math.round(records.reduce((sum, item) => sum + portfolioCoverage(item), 0) / records.length)
    : 0;
  const coverageBalance =
    issues.balance.total > 0
      ? Math.round((issues.balance.balanced / issues.balance.total) * 100)
      : 0;
  const diversityDeclared = records.filter((item) =>
    configDisplay(item.configuration, 'diversityRequirement').trim(),
  ).length;
  const diversityScore = records.length
    ? Math.round((diversityDeclared / records.length) * 100)
    : 0;
  const portfolioReadiness = records.length
    ? Math.round(
        (records.filter((item) => item.status === 'ACTIVE' || item.status === 'READY').length /
          records.length) *
          100,
      )
    : 0;

  const kpis = useMemo(
    () => [
      {
        label: 'Allocation Rules',
        value: String(policyRules.length || records.length),
        meta: `${categories.length} dimensions`,
        accent: '#2563EB',
        icon: LayoutGrid,
        bars: sparkBars(policyRules.length || records.length),
      },
      {
        label: 'Coverage Balance',
        value: issues.balance.total ? `${coverageBalance}%` : '—',
        meta: issues.balance.total
          ? `${issues.balance.balanced}/${issues.balance.total} dimension groups at 100%`
          : 'No share-band groups yet',
        accent: '#16A34A',
        icon: Scale,
        bars: sparkBars(coverageBalance),
      },
      {
        label: 'Diversity Score',
        value: `${diversityScore}%`,
        meta: 'Rules with diversity requirements',
        accent: '#0284C7',
        icon: PieChart,
        bars: sparkBars(diversityScore),
      },
      {
        label: 'Capacity Utilization',
        value: 'UNMEAS.',
        meta: 'Await measured production load',
        accent: '#D97706',
        icon: Gauge,
        bars: sparkBars(2),
      },
      {
        label: 'AI Confidence',
        value: 'UNMEAS.',
        meta: 'No fabricated allocation confidence',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(3),
      },
      {
        label: 'Portfolio Readiness',
        value: `${portfolioReadiness}%`,
        meta: overview?.readiness != null ? `Package ${overview.readiness}%` : 'Active-rule share',
        accent: '#0F766E',
        icon: CheckCircle2,
        bars: sparkBars(portfolioReadiness),
      },
    ],
    [
      policyRules.length,
      records.length,
      categories.length,
      coverageBalance,
      issues.balance.total,
      issues.balance.balanced,
      diversityScore,
      portfolioReadiness,
      overview?.readiness,
    ],
  );

  const explorerSource = useMemo(() => {
    const live = records.filter((record) => !isPortfolioStub(record));
    const policy = live.filter(isPortfolioRule);
    return policy.length > 0 ? policy : live.length > 0 ? live : records;
  }, [records]);

  const filtered = useMemo(
    () => filterPortfolioRecords(explorerSource, query, filter),
    [explorerSource, query, filter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    records.find((item) => item.id === selectedId) ??
    null;
  const config = selected?.configuration ?? {};
  const selectedCoverage = selected ? portfolioCoverage(selected) : 0;
  const selectedTarget = selected ? targetPercentage(selected) : null;

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
        <p className={styles.crumb}>Strategy & Fields / Portfolio Allocation</p>
        <h1 className={styles.title}>Portfolio Allocation</h1>
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
          <p className={styles.crumb}>Strategy & Fields / Portfolio Allocation</p>
          <h1 className={styles.title}>Portfolio Allocation</h1>
          <p className={styles.lede}>
            Autonomously governed share bands balancing coverage, diversity, capacity, and budget
            across CACSMS content production.
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
          Portfolio allocation rules are generated automatically during Stage 01. This workspace
          provides share-band exploration, capacity governance, and audit visibility only — no
          manual create, edit, or delete.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Portfolio KPI summary">
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

      <section className={styles.lifecycle} aria-label="Portfolio lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Portfolio lifecycle</h2>
          <span>
            {systemRunning
              ? 'Stage 01 running — allocation planning active'
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
        <section className={styles.waiting} aria-label="Awaiting autonomous portfolio generation">
          <div className={styles.waitingIcon}>
            <PieChart size={24} aria-hidden />
          </div>
          <h3>Awaiting Autonomous Portfolio Generation</h3>
          <p>
            Stage 01 has not yet generated portfolio allocation rules. Share bands appear
            automatically after global Start begins and portfolio reconciliation completes.
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
              Plan → Allocate → Balance → Persist
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
            <strong>Live allocation generation in progress</strong>
            Stage 01 is reconciling portfolio share bands. Explorer and intelligence panels update
            automatically as records persist.
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Portfolio Explorer">
          <div className={styles.panelHead}>
            <h2>Portfolio Explorer</h2>
            <p>
              {explorerSource.length} rules
              {filtered.length !== explorerSource.length ? ` · ${filtered.length} shown` : ''} ·
              auto-updating
            </p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter allocation rules…"
              aria-label="Search portfolio allocation"
            />
            <div className={styles.chips} role="group" aria-label="Portfolio filters">
              {(
                [
                  ['all', 'All'],
                  ['domains', 'Domains'],
                  ['audiences', 'Audiences'],
                  ['regions', 'Regions'],
                  ['formats', 'Formats'],
                  ['channels', 'Channels'],
                  ['languages', 'Languages'],
                  ['capacity', 'Capacity & budget'],
                  ['imbalanced', 'Imbalanced'],
                  ['active', 'Active'],
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
                const coverage = portfolioCoverage(record);
                const target = configDisplay(record.configuration, 'targetPercentage').trim();
                return (
                  <li key={record.id}>
                    <button
                      type="button"
                      className={`${styles.objCard} ${active ? styles.objCardActive : ''}`}
                      onClick={() => setSelectedId(record.id ?? null)}
                    >
                      <div className={styles.objCardTop}>
                        <strong>{record.name}</strong>
                        <em className={`${styles.badge} ${statusTone(record.status)}`}>
                          {record.status}
                        </em>
                      </div>
                      <div className={styles.objMeta}>
                        <span className={`${styles.pill} ${styles.toneDraft}`}>
                          {allocationCategoryLabel(allocationCategory(record))}
                        </span>
                        <span className={styles.pill}>
                          Target {target === 'UNMEASURED' ? 'UNMEAS.' : `${target || '—'}%`}
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
              <h3>{systemRunning ? 'Planning in progress' : 'No matching allocations'}</h3>
              <p>
                {systemRunning
                  ? 'Portfolio reconciliation is materialising share bands. This explorer updates automatically.'
                  : 'Adjust filters or wait for Stage 01 to materialise portfolio rules.'}
              </p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Portfolio Intelligence">
          <div className={styles.panelHead}>
            <h2>{selected?.name || 'Portfolio Intelligence'}</h2>
            <p>
              Explainable share band, capacity controls, and balancing logic for the selected
              allocation rule.
            </p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Portfolio tabs">
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
                <h3>No allocation selected</h3>
                <p>Persisted portfolio rules are selected automatically when Stage 01 completes.</p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Allocation identity</h3>
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
                      <strong>{allocationCategoryLabel(allocationCategory(selected))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Dimension</span>
                      <strong>{display(configDisplay(config, 'dimension'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Dimension value</span>
                      <strong>{display(configDisplay(config, 'dimensionValue'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Target share</span>
                      <strong>
                        {selectedTarget == null
                          ? display(configDisplay(config, 'targetPercentage'))
                          : `${selectedTarget}%`}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Priority</span>
                      <strong>{selected.priority}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Owning agent</span>
                      <strong>Portfolio Allocation Agent</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Executive summary</h3>
                  <p>{display(selected.description)}</p>
                  <div className={styles.gateGrid} aria-label="Allocation gates">
                    {[
                      ['Min', 'minimumAllocation'],
                      ['Target', 'targetPercentage'],
                      ['Max', 'maximumAllocation'],
                      ['Diversity', 'diversityRequirement'],
                      ['Capacity', 'capacityLimit'],
                      ['Optimize', 'autoOptimize'],
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
                  <h3>Declared share band</h3>
                  <div className={styles.scoreRow}>
                    {[
                      [
                        'Min',
                        Number(configDisplay(config, 'minimumAllocation')) || 0,
                      ],
                      ['Target', selectedTarget ?? 0],
                      [
                        'Max',
                        Number(configDisplay(config, 'maximumAllocation')) || 0,
                      ],
                      ['Rule fill', selectedCoverage],
                    ].map(([label, value]) => (
                      <div key={String(label)} className={styles.metricTile}>
                        <span className={styles.kpiLabel}>{label}</span>
                        <div
                          className={styles.ring}
                          style={{ ['--p' as string]: Number(value) }}
                          aria-hidden
                        />
                        <strong>
                          {label === 'Rule fill' ? `${Number(value)}%` : `${Number(value)}%`}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <p style={{ marginTop: 12, color: 'var(--muted)' }}>
                    Share bands are normative policy targets. Capacity utilization and measured mix
                    remain UNMEASURED until production selection persists outcomes.
                  </p>
                </article>
              </>
            ) : null}

            {selected && tab === 'rules' ? (
              <article className={styles.sectionCard}>
                <h3>Allocation rules</h3>
                <div className={styles.groupList}>
                  {[...ALLOCATION_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
                <div className={styles.ladderStack} aria-label="Allocation share heatmap" style={{ marginTop: 14 }}>
                  {filtered.map((record) => {
                    const target = targetPercentage(record);
                    return (
                      <button
                        key={record.id}
                        type="button"
                        className={`${styles.ladderRung} ${record.id === selectedId ? styles.ladderRungActive : ''}`}
                        onClick={() => setSelectedId(record.id ?? null)}
                      >
                        <span className={styles.ladderRank}>
                          {target == null ? '—' : `${target}`}
                        </span>
                        <div className={styles.ladderCopy}>
                          <strong>{record.name}</strong>
                          <span>{portfolioSubtitle(record)}</span>
                        </div>
                        <em className={`${styles.badge} ${statusTone(record.status)}`}>
                          {allocationCategoryLabel(allocationCategory(record))}
                        </em>
                      </button>
                    );
                  })}
                </div>
              </article>
            ) : null}

            {selected && tab === 'capacity' ? (
              <article className={styles.sectionCard}>
                <h3>Capacity & diversity</h3>
                <div className={styles.groupList}>
                  {[...CAPACITY_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'scheduling' ? (
              <article className={styles.sectionCard}>
                <h3>Scheduling & frequency</h3>
                <div className={styles.groupList}>
                  {[...SCHEDULE_FIELDS].map((key) => (
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
                  <h3>Why this allocation exists</h3>
                  <p>
                    Generated by the Portfolio Allocation Agent to balance{' '}
                    {allocationCategoryLabel(allocationCategory(selected))}
                    {selectedTarget != null ? ` toward a ${selectedTarget}% target share` : ''}.
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
                      <span>Balancing logic</span>
                      <strong>{display(configDisplay(config, 'balancingLogic'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Confidence</span>
                      <strong>UNMEASURED</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Linked objectives</span>
                      <strong>{display(configDisplay(config, 'linkedObjectives'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Auto-optimize</span>
                      <strong>{display(configDisplay(config, 'autoOptimize'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Diversity requirement</span>
                      <strong>{display(configDisplay(config, 'diversityRequirement'))}</strong>
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
                    'audiences',
                    'geographies',
                    'formats',
                    'channels',
                    'localisation',
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
                    <span>Imbalanced groups</span>
                    <b>
                      {issues.balance.total - issues.balance.balanced}/{issues.balance.total || 0}
                    </b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Under-coverage</span>
                    <b>{issues.underCovered.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Over-allocation</span>
                    <b>{issues.overAllocated.length}</b>
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
                      <strong>Portfolio materialisation</strong>
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
            <strong>
              {selectedTarget == null
                ? '—'
                : `${selectedTarget}%`}
            </strong>
            <span className={`${styles.badge} ${styles.toneAi}`}>
              <BrainCircuit size={12} aria-hidden /> Portfolio agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Allocation health</span>
              <b>{selected ? `${selectedCoverage}% fill` : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Diversity score</span>
              <b>{diversityScore}%</b>
            </div>
            <div className={styles.insightRow}>
              <span>Capacity usage</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Coverage balance</span>
              <b>{issues.balance.total ? `${coverageBalance}%` : '—'}</b>
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
              <b>{selected ? portfolioSubtitle(selected) : '—'}</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>Recommendations</h3>
            <ul>
              <li>
                {issues.balance.total && issues.balance.balanced < issues.balance.total
                  ? `Rebalance ${issues.balance.total - issues.balance.balanced} dimension group(s) to 100% targets.`
                  : 'Declared share-band groups are balanced at 100%.'}
              </li>
              <li>
                {issues.missingDiversity.length
                  ? `Add diversity requirements to ${issues.missingDiversity.length} rule(s).`
                  : 'Diversity requirements are present on allocation rules.'}
              </li>
              <li>
                Keep mandatory dimension floors ahead of exploratory share before content-intelligence
                handoff.
              </li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Portfolio health axes">
            {[
              ['Coverage', selectedCoverage],
              ['Balance', coverageBalance],
              ['Diversity', diversityScore],
              ['Readiness', portfolioReadiness],
              ['Priority', selected?.priority ?? 0],
              ['Issues free', Math.max(0, 100 - issues.issueCount * 5)],
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
                  <strong>Portfolio persistence</strong>
                  <p>
                    {policyRules.length || records.length} rules · {categories.length} dimensions ·{' '}
                    {issues.balance.balanced}/{issues.balance.total || 0} balanced
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
              <b>Portfolio Allocation</b>
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
