'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Gauge,
  GitBranch,
  Layers3,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
} from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import { recordToObjectiveForm } from '@/apps/web/lib/strategy-objectives';
import styles from './objectives-intel.module.css';

type TabId =
  | 'overview'
  | 'reasoning'
  | 'metrics'
  | 'dependencies'
  | 'sources'
  | 'recommendations'
  | 'history'
  | 'audit';

type FilterId = 'all' | 'system' | 'critical' | 'active' | 'archived';

type AuditRow = {
  id: string;
  action: string;
  actorType: string;
  createdAt: string;
  reason: string | null;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'sources', label: 'Knowledge Sources' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'planning', label: 'Planning', icon: Layers3 },
  { key: 'knowledge', label: 'Knowledge Analysis', icon: BrainCircuit },
  { key: 'creation', label: 'Objective Creation', icon: Target },
  { key: 'validation', label: 'Validation', icon: CheckCircle2 },
  { key: 'scoring', label: 'Scoring', icon: Gauge },
  { key: 'dependencies', label: 'Dependency Mapping', icon: GitBranch },
  { key: 'publishing', label: 'Publishing', icon: Activity },
  { key: 'completed', label: 'Completed', icon: CircleDot },
] as const;

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'COMPLETED':
    case 'RUNNING':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'CANCELLED':
    case 'ARCHIVED':
      return styles.toneBlocked;
    case 'QUEUED':
    case 'PAUSED':
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

function impactFromPriority(priority: number) {
  if (priority >= 90) return 'Very High';
  if (priority >= 75) return 'High';
  if (priority >= 50) return 'Medium';
  return 'Low';
}

function sparkBars(seed: number) {
  return [4, 7, 5, 9, 6, 10, 8].map((base, index) => Math.max(3, ((base + seed + index * 2) % 10) + 3));
}

function lifecycleState(
  index: number,
  systemRunning: boolean,
  runStatus?: string | null,
  versionStatus?: string,
) {
  if (versionStatus === 'ACTIVE') return 'done';
  if (runStatus === 'COMPLETED' || runStatus === 'PARTIAL') {
    return index <= 6 ? 'done' : index === 7 ? 'done' : 'pending';
  }
  if (runStatus === 'RUNNING' || runStatus === 'QUEUED' || systemRunning) {
    if (index < 3) return 'done';
    if (index === 3) return 'active';
    return 'pending';
  }
  if (versionStatus === 'READY') return index <= 4 ? 'done' : index === 5 ? 'active' : 'pending';
  if (versionStatus === 'DRAFT' || versionStatus === 'INVALID') {
    return index === 0 ? 'active' : 'pending';
  }
  return 'pending';
}

export function ObjectivesWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [tab, setTab] = useState<TabId>('overview');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');

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
      if (!next.available || !next.versionId) {
        setRecords([]);
        setAudit([]);
        return;
      }
      const [list, auditRows] = await Promise.all([
        strategyApi.list(next.versionId, 'objectives'),
        strategyApi.audit(next.versionId).catch(() => [] as AuditRow[]),
      ]);
      setRecords(list);
      setAudit(auditRows);
      const targetId = preferId ?? selectedId;
      const selected = targetId ? list.find((item) => item.id === targetId) : list[0];
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

  const kpis = useMemo(() => {
    const total = records.length;
    const active = records.filter((item) => item.status === 'ACTIVE').length;
    const critical = records.filter((item) => item.priority >= 90).length;
    const archived = records.filter((item) => item.status === 'ARCHIVED').length;
    const measured = records.filter((item) => {
      const baseline = String(item.configuration?.baselineValue ?? '');
      return baseline && baseline !== 'UNMEASURED';
    }).length;
    const pending = Math.max(0, total - measured);
    const readiness = overview?.readiness ?? 0;
    return [
      {
        label: 'Total Objectives',
        value: String(total),
        meta: 'Persisted',
        accent: '#2563EB',
        icon: Target,
        bars: sparkBars(total),
      },
      {
        label: 'Validated',
        value: String(active),
        meta: 'ACTIVE records',
        accent: '#22C55E',
        icon: CheckCircle2,
        bars: sparkBars(active),
      },
      {
        label: 'Strategy Readiness',
        value: `${readiness}%`,
        meta: 'Stage 01 package',
        accent: '#0EA5E9',
        icon: Gauge,
        bars: sparkBars(readiness),
      },
      {
        label: 'Critical Objectives',
        value: String(critical),
        meta: 'Priority ≥ 90',
        accent: '#EF4444',
        icon: AlertTriangle,
        bars: sparkBars(critical),
      },
      {
        label: 'Measured baselines',
        value: measured ? String(measured) : '0',
        meta: measured ? 'Evidence-backed' : 'All UNMEASURED',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(measured || 1),
      },
      {
        label: 'Pending optimization',
        value: String(pending + archived),
        meta: 'Unmeasured or archived',
        accent: '#F59E0B',
        icon: Timer,
        bars: sparkBars(pending + archived),
      },
    ];
  }, [records, overview?.readiness]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      const config = record.configuration ?? {};
      if (filter === 'system' && config.origin !== 'SYSTEM_POLICY') return false;
      if (filter === 'critical' && record.priority < 90) return false;
      if (filter === 'active' && record.status !== 'ACTIVE') return false;
      if (filter === 'archived' && record.status !== 'ARCHIVED') return false;
      if (!needle) return true;
      return (
        record.name.toLowerCase().includes(needle) ||
        record.status.toLowerCase().includes(needle) ||
        String(config.category ?? '')
          .toLowerCase()
          .includes(needle) ||
        String(config.systemKey ?? '')
          .toLowerCase()
          .includes(needle)
      );
    });
  }, [records, query, filter]);

  const selected = records.find((item) => item.id === selectedId) ?? null;
  const detail = selected ? recordToObjectiveForm(selected) : null;
  const dependencies = detail?.dependencies
    ? detail.dependencies.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
  const sources = [
    ...(detail?.applicableFields ? detail.applicableFields.split(',').map((s) => s.trim()) : []),
    ...(detail?.regions ? detail.regions.split(',').map((s) => s.trim()) : []),
  ].filter(Boolean);

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

  if (error || !overview?.available) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Strategy & Fields / Strategic Objectives</p>
        <h1 className={styles.title}>Strategic Objectives</h1>
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
          <p className={styles.crumb}>Strategy & Fields / Strategic Objectives</p>
          <h1 className={styles.title}>Strategic Objectives</h1>
          <p className={styles.lede}>
            AI Strategy Intelligence Workspace — observe how autonomy establishes, validates, and
            governs objectives before downstream production.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
          <span className={`${styles.badge} ${statusTone(overview.status)}`}>{overview.status}</span>
          <span className={`${styles.badge} ${styles.toneAi}`}>{run?.status ?? 'IDLE'}</span>
        </div>
      </header>

      <section className={styles.kpiGrid} aria-label="Executive KPI cards">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article
              key={kpi.label}
              className={styles.kpiCard}
              style={{ ['--accent' as string]: kpi.accent }}
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

      <section className={styles.lifecycle} aria-label="Autonomous lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Autonomous lifecycle</h2>
          <span>
            {systemRunning
              ? 'System Running — Stage 01 advancing'
              : `System ${systemState} · package ${overview.status}`}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {LIFECYCLE.map((stage, index) => {
            const Icon = stage.icon;
            const state = lifecycleState(index, systemRunning, run?.status, overview.status);
            return (
              <div key={stage.key} className={styles.stage} data-state={state}>
                <span className={styles.stageIcon}>
                  <Icon size={14} aria-hidden />
                </span>
                <strong>{stage.label}</strong>
                <span>{state === 'done' ? 'Complete' : state === 'active' ? 'In progress' : 'Pending'}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Strategic Objective Explorer">
          <div className={styles.panelHead}>
            <h2>Strategic Objective Explorer</h2>
            <p>{records.length} persisted · auto-updating</p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search objectives"
              aria-label="Search objectives"
            />
            <div className={styles.chips} role="group" aria-label="Objective filters">
              {(
                [
                  ['all', 'All'],
                  ['system', 'System'],
                  ['critical', 'Critical'],
                  ['active', 'Active'],
                  ['archived', 'Archived'],
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
                const config = record.configuration ?? {};
                const active = record.id === selectedId;
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
                        <span className={styles.pill}>{String(config.category || 'Policy')}</span>
                        <span className={styles.pill}>{impactFromPriority(record.priority)}</span>
                        {config.origin === 'SYSTEM_POLICY' ? (
                          <span className={styles.pill}>SYSTEM</span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.empty}>
              <h3>{systemRunning ? 'Autonomy in progress' : 'Awaiting system Start'}</h3>
              <p>
                {systemRunning
                  ? 'Stage 01 is reconciling objectives. This explorer updates automatically.'
                  : 'No human input here. Global Start materialises objectives automatically.'}
              </p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Objective Intelligence Workspace">
          <div className={styles.panelHead}>
            <h2>{detail?.name || 'Objective Intelligence Workspace'}</h2>
            <p>Explainable, read-only intelligence for the selected objective.</p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Objective tabs">
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
            {!detail ? (
              <div className={styles.empty}>
                <h3>No selection</h3>
                <p>Objectives appear here after Stage 01 autonomy persists records.</p>
              </div>
            ) : null}

            {detail && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Objective name</span>
                      <strong>{detail.name}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Category</span>
                      <strong>{display(detail.category)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Owner agent</span>
                      <strong>Strategy Planning Agent</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Priority</span>
                      <strong>{detail.priority}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Status</span>
                      <strong>{detail.status}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Origin</span>
                      <strong>
                        {String(selected?.configuration?.origin ?? 'SYSTEM_POLICY')}
                      </strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Executive summary</h3>
                  <p>{display(detail.description)}</p>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Expected outcome</h3>
                  <p>{display(detail.desiredOutcome)}</p>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Success criteria</h3>
                  <p>{display(detail.successCriteria)}</p>
                </article>
              </>
            ) : null}

            {detail && tab === 'reasoning' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Why this objective exists</h3>
                  <p>
                    Generated by the Strategy Planning Agent from system policy for{' '}
                    {display(detail.category)}. Constraints: {display(detail.constraints)}.
                  </p>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Supporting context</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Fields</span>
                      <strong>{display(detail.applicableFields)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Audiences</span>
                      <strong>{display(detail.applicableAudiences)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Regions</span>
                      <strong>{display(detail.regions)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Channels</span>
                      <strong>{display(detail.channels)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Formats</span>
                      <strong>{display(detail.formats)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Measurement period</span>
                      <strong>{display(detail.measurementPeriod)}</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Confidence</h3>
                  <p>
                    Quantitative confidence scores remain <strong>UNMEASURED</strong> until evidence
                    pipelines publish verified baselines. Structural policy confidence is implied by
                    ACTIVE status and Stage 01 readiness ({overview.readiness ?? 0}%).
                  </p>
                </article>
              </>
            ) : null}

            {detail && tab === 'metrics' ? (
              <div className={styles.metricGrid}>
                {[
                  ['Target metric', detail.targetMetric],
                  ['Baseline', detail.baselineValue],
                  ['Target', detail.targetValue],
                  ['Priority score', String(detail.priority)],
                  ['Alignment (package)', `${overview.readiness ?? 0}%`],
                  ['Impact class', impactFromPriority(detail.priority)],
                  ['Channels in scope', detail.channels || '—'],
                  ['Formats in scope', detail.formats || '—'],
                ].map(([label, value]) => (
                  <article key={label} className={styles.metricTile}>
                    <span className={styles.kpiLabel}>{label}</span>
                    <div
                      className={styles.ring}
                      style={{
                        ['--p' as string]:
                          label === 'Priority score'
                            ? detail.priority
                            : label === 'Alignment (package)'
                              ? overview.readiness ?? 0
                              : 0,
                      }}
                      aria-hidden
                    />
                    <strong>{display(value)}</strong>
                  </article>
                ))}
              </div>
            ) : null}

            {detail && tab === 'dependencies' ? (
              <article className={styles.sectionCard}>
                <h3>Dependency chain</h3>
                {dependencies.length ? (
                  <div className={styles.depChain}>
                    {dependencies.map((item, index) => (
                      <span key={item} style={{ display: 'contents' }}>
                        {index > 0 ? <span className={styles.depArrow}>→</span> : null}
                        <span className={styles.depNode}>{item}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p>No persisted dependencies on this objective.</p>
                )}
              </article>
            ) : null}

            {detail && tab === 'sources' ? (
              <div className={styles.sourceGrid}>
                {(sources.length ? sources : ['Internal policy graph', 'Stage 01 system policy']).map(
                  (source) => (
                    <article key={source} className={styles.sectionCard}>
                      <h3>{source}</h3>
                      <p>
                        Authority and citation counts remain UNMEASURED until Research & Evidence
                        publishes verified source packages.
                      </p>
                    </article>
                  ),
                )}
              </div>
            ) : null}

            {detail && tab === 'recommendations' ? (
              <article className={styles.sectionCard}>
                <h3>Optimization posture</h3>
                <p>
                  {detail.baselineValue === 'UNMEASURED' || !detail.baselineValue
                    ? 'Baseline is UNMEASURED. Downstream Research & Evidence must establish measurable baselines before optimization claims.'
                    : 'Baseline present. Optimization proposals remain blocked until a measured delta is persisted.'}
                </p>
                <p style={{ marginTop: 10 }}>
                  Constraints: {display(detail.constraints)}
                </p>
              </article>
            ) : null}

            {detail && tab === 'history' ? (
              <article className={styles.sectionCard}>
                <h3>Version posture</h3>
                <ul className={styles.timeline}>
                  <li>
                    <span className={styles.dot} aria-hidden />
                    <div>
                      <strong>System policy materialised</strong>
                      <p>Origin {String(selected?.configuration?.origin ?? 'SYSTEM')}</p>
                    </div>
                  </li>
                  <li>
                    <span className={styles.dot} aria-hidden />
                    <div>
                      <strong>Current package status</strong>
                      <p>
                        {overview.status} · readiness {overview.readiness ?? 0}%
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
            <span className={styles.kpiLabel}>Objective health</span>
            <strong>{detail ? impactFromPriority(detail.priority) : '—'}</strong>
            <span className={`${styles.badge} ${styles.toneAi}`}>
              <Sparkles size={12} aria-hidden /> Strategy agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Persisted objectives</span>
              <b>{records.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Package readiness</span>
              <b>{overview.readiness ?? 0}%</b>
            </div>
            <div className={styles.insightRow}>
              <span>Dependencies</span>
              <b>{dependencies.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Conflicts</span>
              <b>0</b>
            </div>
            <div className={styles.insightRow}>
              <span>Measured baselines</span>
              <b>
                {
                  records.filter((item) => {
                    const baseline = String(item.configuration?.baselineValue ?? '');
                    return baseline && baseline !== 'UNMEASURED';
                  }).length
                }
              </b>
            </div>
            <div className={styles.insightRow}>
              <span>AI confidence</span>
              <b>UNMEASURED</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>Why this objective exists</h3>
            <ul>
              <li>System policy for Stage 01 governance</li>
              <li>Audience and regional scope constraints</li>
              <li>Editorial and evidence dependencies</li>
              <li>Fail-closed baselines until evidence arrives</li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Strategy health axes">
            {[
              ['Authority', detail?.category === 'Authority' ? 90 : 55],
              ['Education', detail?.category === 'Education' ? 88 : 50],
              ['Trust', overview.readiness ?? 0],
              ['Audience', detail?.applicableAudiences ? 70 : 20],
              ['Compliance', detail?.constraints ? 75 : 30],
              ['Impact', detail ? detail.priority : 0],
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

      <section className={styles.bottom} aria-label="Timeline audit and sources">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Execution timeline</h2>
            <p>Persisted autonomy milestones</p>
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
                  <strong>Objectives autonomy</strong>
                  <p>{run?.status ?? 'IDLE'}</p>
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
            <h2>Knowledge sources</h2>
            <p>Scope signals from the selected objective</p>
          </div>
          <div className={styles.tabBody}>
            {(sources.length ? sources.slice(0, 6) : ['Awaiting Stage 01 materialisation']).map(
              (source) => (
                <div key={source} className={styles.insightRow}>
                  <span>{source}</span>
                  <b>Scoped</b>
                </div>
              ),
            )}
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
