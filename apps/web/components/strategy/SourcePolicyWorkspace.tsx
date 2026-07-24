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
  FileSearch,
  Gauge,
  GitBranch,
  Scale,
  ShieldAlert,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  CITATION_FIELDS,
  configDisplay,
  evidenceClass,
  evidenceClassLabel,
  EVIDENCE_RULE_FIELDS,
  fieldLabel,
  filterSourceRecords,
  gateCompletion,
  HIERARCHY_FIELDS,
  isSourcePolicyClass,
  isSourceStub,
  LADDER_GATE_ROWS,
  ladderRank,
  sourceCoverage,
  sourceIssues,
  sourceState,
  sourceSubtitle,
  type SourceFilter,
} from '@/apps/web/lib/strategy-source';
import styles from './source-policy-intel.module.css';

type TabId =
  | 'overview'
  | 'hierarchy'
  | 'rules'
  | 'citation'
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
  { id: 'hierarchy', label: 'Source Hierarchy' },
  { id: 'rules', label: 'Evidence Rules' },
  { id: 'citation', label: 'Citation Standards' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'discover', label: 'Discover', icon: Compass },
  { key: 'verify', label: 'Verify', icon: FileSearch },
  { key: 'classify', label: 'Classify', icon: BookOpen },
  { key: 'score', label: 'Score', icon: Gauge },
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
    case 'ALLOWED':
    case 'primary_institutional':
    case 'scholarly':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'Failed':
    case 'RESTRICTED':
    case 'restricted_anonymous':
      return styles.toneBlocked;
    case 'QUEUED':
    case 'PAUSED':
    case 'WARNING':
    case 'Running':
    case 'CONDITIONAL':
    case 'journalism':
    case 'civil_society':
    case 'other':
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
  classCount?: number,
) {
  if ((classCount ?? 0) > 0 && (versionStatus === 'ACTIVE' || versionStatus === 'READY')) {
    return 'done';
  }
  if ((classCount ?? 0) > 0) {
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

export function SourcePolicyWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SourceFilter>('all');
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
        strategyApi.list(next.versionId, 'source-policy'),
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

  const policyClasses = useMemo(() => records.filter(isSourcePolicyClass), [records]);
  const issues = useMemo(() => sourceIssues(records), [records]);
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const record of records) {
      const category = configDisplay(record.configuration, 'sourceCategory').trim();
      if (category) set.add(category);
      else set.add(evidenceClassLabel(evidenceClass(record)));
    }
    return [...set];
  }, [records]);
  const trusted = records.filter((item) => sourceState(item) === 'ALLOWED').length;
  const validated = records.filter((item) => item.status === 'ACTIVE' || item.status === 'READY').length;
  const avgCoverage = records.length
    ? Math.round(records.reduce((sum, item) => sum + sourceCoverage(item), 0) / records.length)
    : 0;
  const citationReady = records.filter((item) =>
    configDisplay(item.configuration, 'citationRequired').trim(),
  ).length;
  const citationQuality = records.length ? Math.round((citationReady / records.length) * 100) : 0;
  const complianceScore = records.length ? Math.round((trusted / records.length) * 100) : 0;

  const kpis = useMemo(
    () => [
      {
        label: 'Source Categories',
        value: String(categories.length || policyClasses.length || records.length),
        meta: 'Distinct evidence classes',
        accent: '#2563EB',
        icon: BookOpen,
        bars: sparkBars(categories.length || policyClasses.length),
      },
      {
        label: 'Trusted Sources',
        value: String(trusted),
        meta: 'ALLOWED ladder classes',
        accent: '#16A34A',
        icon: CheckCircle2,
        bars: sparkBars(trusted),
      },
      {
        label: 'Evidence Coverage',
        value: `${avgCoverage}%`,
        meta: 'Average rung field fill',
        accent: '#0284C7',
        icon: Scale,
        bars: sparkBars(avgCoverage),
      },
      {
        label: 'Citation Quality',
        value: `${citationQuality}%`,
        meta: 'Rungs with citation rules',
        accent: '#0F766E',
        icon: FileSearch,
        bars: sparkBars(citationQuality),
      },
      {
        label: 'AI Confidence',
        value: 'UNMEAS.',
        meta: 'No fabricated authority scores',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(3),
      },
      {
        label: 'Compliance Score',
        value: `${complianceScore}%`,
        meta: overview?.readiness != null ? `Package ${overview.readiness}%` : 'Allowed-class share',
        accent: '#D97706',
        icon: Gauge,
        bars: sparkBars(complianceScore),
      },
    ],
    [
      categories.length,
      policyClasses.length,
      records.length,
      trusted,
      avgCoverage,
      citationQuality,
      complianceScore,
      overview?.readiness,
    ],
  );

  const explorerSource = useMemo(() => {
    const live = records.filter((record) => !isSourceStub(record));
    const policy = live.filter(isSourcePolicyClass);
    return policy.length > 0 ? policy : live.length > 0 ? live : records;
  }, [records]);

  const filtered = useMemo(
    () => filterSourceRecords(explorerSource, query, filter),
    [explorerSource, query, filter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    records.find((item) => item.id === selectedId) ??
    null;
  const config = selected?.configuration ?? {};
  const selectedClass = selected ? evidenceClass(selected) : 'other';
  const selectedState = selected ? sourceState(selected) : 'UNKNOWN';
  const selectedCoverage = selected ? sourceCoverage(selected) : 0;
  const selectedGates = selected ? gateCompletion(selected) : 0;

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
        <p className={styles.crumb}>Strategy & Fields / Evidence & Source Policy</p>
        <h1 className={styles.title}>Evidence & Source Policy</h1>
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
          <p className={styles.crumb}>Strategy & Fields / Evidence & Source Policy</p>
          <h1 className={styles.title}>Evidence & Source Policy</h1>
          <p className={styles.lede}>
            Autonomously governed evidence ladder defining source hierarchy, credibility gates,
            citation standards, and research readiness for CACSMS content production.
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
          Evidence classes and source gates are generated automatically during Stage 01. This
          workspace provides ladder exploration, citation governance, and audit visibility only.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Evidence KPI summary">
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

      <section className={styles.lifecycle} aria-label="Evidence lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Evidence lifecycle</h2>
          <span>
            {systemRunning
              ? 'Stage 01 running — source discovery active'
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
              policyClasses.length || records.length,
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
        <section className={styles.waiting} aria-label="Awaiting autonomous source policy generation">
          <div className={styles.waitingIcon}>
            <Scale size={24} aria-hidden />
          </div>
          <h3>Awaiting Autonomous Evidence Ladder Generation</h3>
          <p>
            Stage 01 has not yet generated source policy classes. The evidence ladder appears
            automatically after global Start begins and source discovery completes.
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
              Discover → Classify → Persist
            </div>
          </div>
          <div className={styles.ghostCards} aria-hidden>
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
          </div>
        </section>
      ) : null}

      {records.length && systemRunning && !policyClasses.length ? (
        <section className={styles.infoNotice} role="status" aria-live="polite">
          <Timer size={16} aria-hidden />
          <div>
            <strong>Live evidence generation in progress</strong>
            Stage 01 is reconciling source policy classes. Explorer and intelligence panels update
            automatically as records persist.
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Source Explorer">
          <div className={styles.panelHead}>
            <h2>Source Explorer</h2>
            <p>
              {explorerSource.length} classes
              {filtered.length !== explorerSource.length ? ` · ${filtered.length} shown` : ''} ·
              auto-updating
            </p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter ladder rungs…"
              aria-label="Search evidence source classes"
            />
            <div className={styles.chips} role="group" aria-label="Source filters">
              {(
                [
                  ['all', 'All'],
                  ['primary_institutional', 'Institutional'],
                  ['scholarly', 'Scholarly'],
                  ['journalism', 'Journalism'],
                  ['civil_society', 'Civil society'],
                  ['restricted_anonymous', 'Restricted'],
                  ['allowed', 'Allowed'],
                  ['conditional', 'Conditional'],
                  ['restricted', 'Restricted state'],
                  ['thin_rung', 'Thin'],
                  ['validated', 'Validated'],
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
                const klass = evidenceClass(record);
                const state = sourceState(record);
                const coverage = sourceCoverage(record);
                return (
                  <li key={record.id}>
                    <button
                      type="button"
                      className={`${styles.objCard} ${active ? styles.objCardActive : ''}`}
                      onClick={() => setSelectedId(record.id ?? null)}
                    >
                      <div className={styles.objCardTop}>
                        <strong>{record.name}</strong>
                        <em className={`${styles.badge} ${statusTone(state)}`}>{state}</em>
                      </div>
                      <div className={styles.objMeta}>
                        <span className={`${styles.pill} ${statusTone(klass)}`}>
                          R{ladderRank(record)} · {evidenceClassLabel(klass)}
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
              <h3>{systemRunning ? 'Discovery in progress' : 'No matching classes'}</h3>
              <p>
                {systemRunning
                  ? 'Source discovery is reconciling ladder classes. This explorer updates automatically.'
                  : 'Adjust filters or wait for Stage 01 to materialise source policies.'}
              </p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Evidence Intelligence">
          <div className={styles.panelHead}>
            <h2>{selected?.name || 'Evidence Intelligence'}</h2>
            <p>Explainable evidence class, citation gates, and governance for the selected rung.</p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Evidence tabs">
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
                <h3>No evidence class selected</h3>
                <p>Persisted ladder rungs are selected automatically when Stage 01 completes.</p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Evidence class identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Class name</span>
                      <strong>{display(selected.name)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>System key</span>
                      <strong>{display(configDisplay(config, 'systemKey'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Ladder rank</span>
                      <strong>Rung {ladderRank(selected)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Evidence class</span>
                      <strong>{evidenceClassLabel(selectedClass)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Policy state</span>
                      <strong>{selectedState}</strong>
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
                      <strong>Source Policy Agent</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Executive summary</h3>
                  <p>{display(selected.description)}</p>
                  <div className={styles.gateGrid} aria-label="Ladder gates">
                    {LADDER_GATE_ROWS.map((row) => {
                      const done = Boolean(configDisplay(config, row.key).trim());
                      return (
                        <div key={row.key} className={styles.gateChip} data-done={done}>
                          <strong>{row.label}</strong>
                          <span>{done ? 'Configured' : 'Pending'}</span>
                        </div>
                      );
                    })}
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Evidence health</h3>
                  <div className={styles.scoreRow}>
                    {[
                      ['Rung fill', selectedCoverage],
                      ['Gate fill', selectedGates],
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
                    Authority and credibility scores remain qualitative — no fabricated numeric
                    confidence values.
                  </p>
                </article>
              </>
            ) : null}

            {selected && tab === 'hierarchy' ? (
              <article className={styles.sectionCard}>
                <h3>Source hierarchy</h3>
                <div className={styles.groupList}>
                  {[...HIERARCHY_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
                <div className={styles.ladderStack} aria-label="Evidence ladder visualization">
                  {filtered.map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      className={`${styles.ladderRung} ${record.id === selectedId ? styles.ladderRungActive : ''}`}
                      data-state={sourceState(record)}
                      onClick={() => setSelectedId(record.id ?? null)}
                    >
                      <span className={styles.ladderRank}>R{ladderRank(record)}</span>
                      <div className={styles.ladderCopy}>
                        <strong>{record.name}</strong>
                        <span>
                          {evidenceClassLabel(evidenceClass(record))} · {sourceState(record)}
                        </span>
                      </div>
                      <em className={`${styles.badge} ${statusTone(sourceState(record))}`}>
                        {sourceState(record)}
                      </em>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'rules' ? (
              <article className={styles.sectionCard}>
                <h3>Evidence rules</h3>
                <div className={styles.groupList}>
                  {[...EVIDENCE_RULE_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'citation' ? (
              <article className={styles.sectionCard}>
                <h3>Citation standards</h3>
                <div className={styles.groupList}>
                  {[...CITATION_FIELDS].map((key) => (
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
                  <h3>Why this source class exists</h3>
                  <p>
                    Generated by the Source Policy Agent to place {evidenceClassLabel(selectedClass)}{' '}
                    evidence at ladder rung {ladderRank(selected)} with policy state{' '}
                    {selectedState}.
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
                      <span>Authority posture</span>
                      <strong>{display(configDisplay(config, 'minimumAuthorityScore'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Confidence</span>
                      <strong>UNMEASURED</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Anonymous restrictions</span>
                      <strong>{display(configDisplay(config, 'anonymousRestrictions'))}</strong>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'dependencies' ? (
              <article className={styles.sectionCard}>
                <h3>Downstream and peer links</h3>
                <div className={styles.depChain}>
                  {['objectives', 'domains', 'editorial-policy', 'geographies', 'formats', 'channels'].map(
                    (item, index) => (
                      <span key={item} style={{ display: 'contents' }}>
                        {index > 0 ? <span className={styles.depArrow}>→</span> : null}
                        <span className={styles.depNode}>{item}</span>
                      </span>
                    ),
                  )}
                </div>
                <div className={styles.groupList} style={{ marginTop: 14 }}>
                  <div className={styles.groupItem}>
                    <span>Detected issues</span>
                    <b>{issues.issueCount}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Thin rungs</span>
                    <b>{issues.thinRungs.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Missing citation rules</span>
                    <b>{issues.missingCitation.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Restricted classes</span>
                    <b>{issues.restricted.length}</b>
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
                      <strong>Source class materialisation</strong>
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
            <strong>{selected ? `R${ladderRank(selected)}` : '—'}</strong>
            <span className={`${styles.badge} ${styles.toneAi}`}>
              <BrainCircuit size={12} aria-hidden /> Source agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Authority score</span>
              <b>Qualitative only</b>
            </div>
            <div className={styles.insightRow}>
              <span>Evidence quality</span>
              <b>{selected ? `${selectedCoverage}% fill` : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Freshness</span>
              <b>{display(configDisplay(config, 'maximumAge'))}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Credibility</span>
              <b>{selectedState}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Linked policies</span>
              <b>Editorial · Risk · Research</b>
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
              <b>{selected ? sourceSubtitle(selected) : '—'}</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>Recommendations</h3>
            <ul>
              <li>
                {issues.missingAuthority.length
                  ? `Define authority posture for ${issues.missingAuthority.length} rung(s).`
                  : 'Authority postures are declared on policy rungs.'}
              </li>
              <li>
                {issues.missingCitation.length
                  ? `Add citation requirements to ${issues.missingCitation.length} class(es).`
                  : 'Citation requirements are present on policy classes.'}
              </li>
              <li>
                Keep restricted and anonymous classes behind elevated corroboration before research
                handoff.
              </li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Evidence health axes">
            {[
              ['Coverage', selectedCoverage],
              ['Gates', selectedGates],
              ['Priority', selected?.priority ?? 0],
              ['Citation', citationQuality],
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
                  <strong>Source policy persistence</strong>
                  <p>
                    {policyClasses.length || records.length} classes · {trusted} trusted ·{' '}
                    {validated} validated
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
              <span>Classes discovered</span>
              <b>{records.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Activity size={12} aria-hidden /> Agent
              </span>
              <b>Source Policy</b>
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
