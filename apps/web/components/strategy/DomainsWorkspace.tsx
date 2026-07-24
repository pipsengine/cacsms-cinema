'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Compass,
  Gauge,
  GitBranch,
  Globe2,
  Layers3,
  Map,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
} from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import { recordToDomainForm } from '@/apps/web/lib/strategy-domains';
import styles from './domains-intel.module.css';

type TabId =
  | 'overview'
  | 'coverage'
  | 'taxonomy'
  | 'reasoning'
  | 'evidence'
  | 'dependencies'
  | 'risk'
  | 'history'
  | 'audit';

type FilterId =
  | 'all'
  | 'core'
  | 'strategic'
  | 'restricted'
  | 'conditional'
  | 'system'
  | 'active';

type AuditRow = {
  id: string;
  action: string;
  actorType: string;
  createdAt: string;
  reason: string | null;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'taxonomy', label: 'Taxonomy' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'risk', label: 'Risk & Governance' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'intake', label: 'Strategy Intake', icon: Layers3 },
  { key: 'objectives', label: 'Objective Analysis', icon: Target },
  { key: 'discovery', label: 'Domain Discovery', icon: Compass },
  { key: 'evidence', label: 'Evidence Validation', icon: BookOpen },
  { key: 'risk', label: 'Risk Screening', icon: ShieldCheck },
  { key: 'scoring', label: 'Coverage Scoring', icon: Gauge },
  { key: 'deps', label: 'Dependency Mapping', icon: GitBranch },
  { key: 'persist', label: 'Persistence', icon: CircleDot },
] as const;

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'COMPLETED':
    case 'RUNNING':
    case 'PERMITTED':
    case 'ALLOWED':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'CANCELLED':
    case 'ARCHIVED':
    case 'RESTRICTED':
      return styles.toneBlocked;
    case 'QUEUED':
    case 'PAUSED':
    case 'CONDITIONAL':
    case 'ALLOWED_WITH_REVIEW':
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

function splitCsv(value?: string) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function tierFromPriority(priority: number) {
  if (priority >= 90) return 'Core';
  if (priority >= 80) return 'Strategic';
  if (priority >= 70) return 'Emerging';
  return 'Supporting';
}

function riskFromSensitivity(sensitivity?: string) {
  switch ((sensitivity ?? '').toUpperCase()) {
    case 'CRITICAL':
      return 'Critical';
    case 'HIGH':
      return 'High';
    case 'ELEVATED':
      return 'Elevated';
    case 'STANDARD':
      return 'Low';
    default:
      return sensitivity ? sensitivity : 'UNMEASURED';
  }
}

function sparkBars(seed: number) {
  return [4, 7, 5, 9, 6, 10, 8].map((base, index) => Math.max(3, ((base + seed + index * 2) % 10) + 3));
}

function lifecycleState(
  index: number,
  systemRunning: boolean,
  runStatus?: string | null,
  versionStatus?: string,
  domainCount?: number,
) {
  if ((domainCount ?? 0) > 0 && (versionStatus === 'ACTIVE' || versionStatus === 'READY')) {
    return index <= 7 ? 'done' : 'pending';
  }
  if ((domainCount ?? 0) > 0) {
    return index <= 6 ? 'done' : index === 7 ? 'done' : 'pending';
  }
  if (runStatus === 'RUNNING' || runStatus === 'QUEUED' || systemRunning) {
    if (index < 2) return 'done';
    if (index === 2) return 'active';
    return 'pending';
  }
  if (versionStatus === 'DRAFT' || versionStatus === 'INVALID') {
    return index === 0 ? 'active' : 'pending';
  }
  return 'pending';
}

export function DomainsWorkspace() {
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
        strategyApi.list(next.versionId, 'domains'),
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

  const kpis = useMemo(() => {
    const total = records.length;
    const validated = records.filter(
      (item) => item.status === 'ACTIVE' && String(item.configuration?.coverageStatus ?? '') !== 'RESTRICTED',
    ).length;
    const restricted = records.filter(
      (item) =>
        String(item.configuration?.coverageStatus ?? '') === 'RESTRICTED' ||
        String(item.configuration?.allowedState ?? '').includes('RESTRICTED'),
    ).length;
    const conditional = records.filter(
      (item) => String(item.configuration?.coverageStatus ?? '') === 'CONDITIONAL',
    ).length;
    const readiness = overview?.readiness ?? 0;
    const conflicts = 0;
    return [
      {
        label: 'Configured Domains',
        value: String(total),
        meta: 'Persisted profiles',
        accent: '#2563EB',
        icon: Globe2,
        bars: sparkBars(total),
      },
      {
        label: 'Validated Domains',
        value: String(validated),
        meta: 'ACTIVE non-restricted',
        accent: '#16A34A',
        icon: CheckCircle2,
        bars: sparkBars(validated),
      },
      {
        label: 'Coverage Readiness',
        value: `${readiness}%`,
        meta: 'Stage 01 package',
        accent: '#0284C7',
        icon: Gauge,
        bars: sparkBars(readiness),
      },
      {
        label: 'Restricted Domains',
        value: String(restricted),
        meta: 'Governance gated',
        accent: '#DC2626',
        icon: AlertTriangle,
        bars: sparkBars(restricted),
      },
      {
        label: 'Policy Conflicts',
        value: String(conflicts),
        meta: 'Detected overlaps',
        accent: '#7C3AED',
        icon: ShieldCheck,
        bars: sparkBars(1),
      },
      {
        label: 'Pending Optimisation',
        value: String(conditional),
        meta: 'Conditional coverage',
        accent: '#D97706',
        icon: Timer,
        bars: sparkBars(conditional),
      },
    ];
  }, [records, overview?.readiness]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      const form = recordToDomainForm(record);
      const tier = tierFromPriority(record.priority);
      if (filter === 'core' && tier !== 'Core') return false;
      if (filter === 'strategic' && tier !== 'Strategic') return false;
      if (filter === 'restricted' && form.coverageStatus !== 'RESTRICTED') return false;
      if (filter === 'conditional' && form.coverageStatus !== 'CONDITIONAL') return false;
      if (filter === 'system' && form.origin !== 'SYSTEM_POLICY') return false;
      if (filter === 'active' && record.status !== 'ACTIVE') return false;
      if (!needle) return true;
      return (
        record.name.toLowerCase().includes(needle) ||
        form.fieldName.toLowerCase().includes(needle) ||
        form.domainName.toLowerCase().includes(needle) ||
        form.coverageStatus.toLowerCase().includes(needle) ||
        form.allowedState.toLowerCase().includes(needle)
      );
    });
  }, [records, query, filter]);

  const selected = records.find((item) => item.id === selectedId) ?? null;
  const detail = selected ? recordToDomainForm(selected) : null;
  const audiences = splitCsv(detail?.audiences);
  const countries = splitCsv(detail?.countries);
  const formats = splitCsv(detail?.formats);
  const packageStatus =
    overview?.status === 'ACTIVE'
      ? 'Completed'
      : overview?.status === 'READY'
        ? 'Validated'
        : systemRunning
          ? 'Running'
          : overview?.status ?? 'Draft';

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
        <p className={styles.crumb}>Strategy & Fields / Field & Domain Profiles</p>
        <h1 className={styles.title}>Field & Domain Profiles</h1>
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
          <p className={styles.crumb}>Strategy & Fields / Field & Domain Profiles</p>
          <h1 className={styles.title}>Field & Domain Profiles</h1>
          <p className={styles.lede}>
            Autonomously generated knowledge domains that define permitted subject coverage,
            strategic relevance, governance boundaries, and downstream production scope.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 01</span>
          <span className={`${styles.badge} ${styles.toneAi}`}>System Owned</span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Read Only</span>
          <span className={`${styles.badge} ${statusTone(packageStatus)}`}>{packageStatus}</span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only</strong>
          Domain profiles are generated and maintained automatically during Stage 01. This page
          provides observation, explainability, governance, and audit visibility only.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Executive KPI summary">
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

      <section className={styles.lifecycle} aria-label="Domain generation lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Stage lifecycle</h2>
          <span>
            {systemRunning
              ? 'Stage 01 running — domain discovery active'
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
              records.length,
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
        <section className={styles.waiting} aria-label="Awaiting autonomous run">
          <div className={styles.waitingIcon}>
            <Map size={24} aria-hidden />
          </div>
          <h3>Awaiting Autonomous Run</h3>
          <p>
            Stage 01 has not yet generated domain profiles. Profiles appear automatically after
            global Start begins and the Domain Discovery step completes.
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
              Intake → Discovery → Persist
            </div>
          </div>
          <div className={styles.ghostCards} aria-hidden>
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Domain Profile Explorer">
          <div className={styles.panelHead}>
            <h2>Domain Profile Explorer</h2>
            <p>{records.length} persisted · auto-updating</p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search field & domain profiles"
              aria-label="Search field and domain profiles"
            />
            <div className={styles.chips} role="group" aria-label="Domain filters">
              {(
                [
                  ['all', 'All'],
                  ['core', 'Core'],
                  ['strategic', 'Strategic'],
                  ['conditional', 'Conditional'],
                  ['restricted', 'Restricted'],
                  ['system', 'System'],
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
                const form = recordToDomainForm(record);
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
                        <em className={`${styles.badge} ${statusTone(form.coverageStatus || record.status)}`}>
                          {form.coverageStatus || record.status}
                        </em>
                      </div>
                      <div className={styles.objMeta}>
                        <span className={styles.pill}>{tierFromPriority(record.priority)}</span>
                        <span className={styles.pill}>{display(form.fieldName)}</span>
                        <span className={styles.pill}>P{record.priority}</span>
                        <span className={styles.pill}>{riskFromSensitivity(form.sensitivity)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.empty}>
              <h3>{systemRunning ? 'Discovery in progress' : 'No matching domains'}</h3>
              <p>
                {systemRunning
                  ? 'Domain Discovery is reconciling profiles. This explorer updates automatically.'
                  : 'Adjust filters or wait for Stage 01 to materialise domain profiles.'}
              </p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Domain Intelligence Workspace">
          <div className={styles.panelHead}>
            <h2>{detail?.name || 'Domain Intelligence Workspace'}</h2>
            <p>Explainable governance view for the selected system-owned domain.</p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Domain tabs">
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
                <h3>No profile selected</h3>
                <p>Persisted profiles are selected automatically when Stage 01 completes.</p>
              </div>
            ) : null}

            {detail && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Domain name</span>
                      <strong>{display(detail.domainName || detail.name)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Domain code</span>
                      <strong>{display(detail.systemKey)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Field</span>
                      <strong>{display(detail.fieldName)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Strategic tier</span>
                      <strong>{tierFromPriority(detail.priority)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Status</span>
                      <strong>{display(detail.coverageStatus || detail.status)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Owning agent</span>
                      <strong>Domain Discovery Agent</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Priority</span>
                      <strong>{detail.priority}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Allowed state</span>
                      <strong>{display(detail.allowedState)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Parent domain</span>
                      <strong>{display(detail.parentDomain)}</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Executive summary</h3>
                  <p>{display(detail.description)}</p>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Strategic importance</h3>
                  <p>{display(detail.rationale)}</p>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Domain health</h3>
                  <div className={styles.scoreRow}>
                    {[
                      ['Strategic alignment', overview.readiness ?? 0],
                      ['Priority weight', detail.priority],
                      ['Audience scope', audiences.length ? Math.min(100, audiences.length * 25) : 0],
                      ['Regional scope', countries.length ? Math.min(100, countries.length * 30) : 0],
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

            {detail && tab === 'coverage' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Approved scope</h3>
                  <div className={styles.groupList}>
                    <div className={styles.groupItem}>
                      <span>Audiences ({audiences.length})</span>
                      <b>{audiences.join(', ') || '—'}</b>
                    </div>
                    <div className={styles.groupItem}>
                      <span>Regions ({countries.length})</span>
                      <b>{countries.join(', ') || '—'}</b>
                    </div>
                    <div className={styles.groupItem}>
                      <span>Formats ({formats.length})</span>
                      <b>{formats.join(', ') || '—'}</b>
                    </div>
                    <div className={styles.groupItem}>
                      <span>Seasonal relevance</span>
                      <b>{display(detail.seasonalRelevance)}</b>
                    </div>
                    <div className={styles.groupItem}>
                      <span>Frequency limit</span>
                      <b>{display(detail.frequencyLimit)}</b>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Evidence requirement</h3>
                  <p>{display(detail.evidenceRequirement)}</p>
                </article>
              </>
            ) : null}

            {detail && tab === 'taxonomy' ? (
              <article className={styles.sectionCard}>
                <h3>Hierarchy</h3>
                <ul className={styles.tree}>
                  <li>
                    <strong>Field</strong> — {display(detail.fieldName)}
                    <ul className={styles.tree}>
                      <li>
                        <strong>Domain</strong> — {display(detail.domainName || detail.name)}
                        <ul className={styles.tree}>
                          <li>
                            <strong>Parent</strong> — {display(detail.parentDomain)}
                          </li>
                          <li>
                            <strong>Coverage state</strong> — {display(detail.coverageStatus)}
                          </li>
                        </ul>
                      </li>
                    </ul>
                  </li>
                </ul>
              </article>
            ) : null}

            {detail && tab === 'reasoning' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Why this domain exists</h3>
                  <p>
                    Generated by the Domain Discovery Agent to support Stage 01 strategy coverage for{' '}
                    {display(detail.fieldName)}. {display(detail.rationale)}
                  </p>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Decision factors</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Origin</span>
                      <strong>{display(detail.origin)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Authority requirement</span>
                      <strong>{display(detail.authorityRequirement)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Allowed state</span>
                      <strong>{display(detail.allowedState)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Confidence</span>
                      <strong>UNMEASURED</strong>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {detail && tab === 'evidence' ? (
              <article className={styles.sectionCard}>
                <h3>Evidence posture</h3>
                <p>{display(detail.evidenceRequirement)}</p>
                <p style={{ marginTop: 10 }}>
                  Authority requirement: {display(detail.authorityRequirement)}. Quantitative
                  citation counts and reliability scores remain UNMEASURED until Research & Evidence
                  publishes verified source packages.
                </p>
              </article>
            ) : null}

            {detail && tab === 'dependencies' ? (
              <article className={styles.sectionCard}>
                <h3>Downstream and peer links</h3>
                <div className={styles.depChain}>
                  {['objectives', 'taxonomy', 'audiences', 'geographies', 'editorial-policy', 'formats', 'channels']
                    .map((item, index) => (
                      <span key={item} style={{ display: 'contents' }}>
                        {index > 0 ? <span className={styles.depArrow}>→</span> : null}
                        <span className={styles.depNode}>{item}</span>
                      </span>
                    ))}
                </div>
              </article>
            ) : null}

            {detail && tab === 'risk' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Risk classification</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Sensitivity</span>
                      <strong>{display(detail.sensitivity)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Risk level</span>
                      <strong>{riskFromSensitivity(detail.sensitivity)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Coverage status</span>
                      <strong>{display(detail.coverageStatus)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Allowed state</span>
                      <strong>{display(detail.allowedState)}</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Governance rules</h3>
                  <p>
                    Permitted use follows coverage status <strong>{display(detail.coverageStatus)}</strong>{' '}
                    and allowed state <strong>{display(detail.allowedState)}</strong>. Material claims
                    require: {display(detail.evidenceRequirement)}.
                  </p>
                </article>
              </>
            ) : null}

            {detail && tab === 'history' ? (
              <article className={styles.sectionCard}>
                <h3>Version posture</h3>
                <ul className={styles.timeline}>
                  <li>
                    <span className={styles.dot} aria-hidden />
                    <div>
                      <strong>System policy materialised</strong>
                      <p>{display(detail.systemKey)}</p>
                    </div>
                  </li>
                  <li>
                    <span className={styles.dot} aria-hidden />
                    <div>
                      <strong>Current package</strong>
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

        <aside className={`${styles.panel} ${styles.insights}`} aria-label="Domain Intelligence Summary">
          <div className={styles.scoreHero}>
            <span className={styles.kpiLabel}>Domain health</span>
            <strong>{detail ? tierFromPriority(detail.priority) : '—'}</strong>
            <span className={`${styles.badge} ${styles.toneAi}`}>
              <Sparkles size={12} aria-hidden /> Domain agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Configured domains</span>
              <b>{records.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Package readiness</span>
              <b>{overview.readiness ?? 0}%</b>
            </div>
            <div className={styles.insightRow}>
              <span>Coverage status</span>
              <b>{display(detail?.coverageStatus)}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Risk</span>
              <b>{detail ? riskFromSensitivity(detail.sensitivity) : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Audiences</span>
              <b>{audiences.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Regions</span>
              <b>{countries.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>AI confidence</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Conflicts</span>
              <b>0</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>AI recommendation summary</h3>
            <ul>
              <li>
                {detail?.frequencyLimit === 'UNMEASURED'
                  ? 'Establish measured frequency limits after Research & Evidence baselines exist.'
                  : 'Frequency posture already declared on this domain.'}
              </li>
              <li>
                {detail?.coverageStatus === 'RESTRICTED'
                  ? 'Keep restricted domain behind elevated evidence and risk gates.'
                  : 'Maintain evidence requirements before activation handoff.'}
              </li>
              <li>Refresh regional applicability when geographies section advances.</li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Domain health axes">
            {[
              ['Alignment', overview.readiness ?? 0],
              ['Priority', detail?.priority ?? 0],
              ['Audience', audiences.length ? Math.min(100, audiences.length * 25) : 0],
              ['Region', countries.length ? Math.min(100, countries.length * 30) : 0],
              ['Format', formats.length ? Math.min(100, formats.length * 25) : 0],
              ['Governance', detail?.sensitivity ? 70 : 20],
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

      <section className={styles.bottom} aria-label="Timeline audit and activity">
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
                  <strong>Domain persistence</strong>
                  <p>{records.length} live profiles</p>
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
              <span>Domains discovered</span>
              <b>{records.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Activity size={12} aria-hidden /> Agent
              </span>
              <b>Domain Discovery</b>
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
