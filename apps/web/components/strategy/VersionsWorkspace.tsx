'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  Archive,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  FileDiff,
  Gauge,
  GitBranch,
  History,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { StrategyOverview } from '@/lib/strategy/contracts';
import { REQUIRED_SECTIONS } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  filterVersions,
  isArchivedStatus,
  isDraftStatus,
  isReleasedStatus,
  rollbackEligible,
  versionIssues,
  versionLifecycleLabel,
  versionSubtitle,
  type VersionFilter,
  type VersionSummary,
} from '@/apps/web/lib/strategy-versions';
import styles from './versions-intel.module.css';

type TabId =
  | 'overview'
  | 'comparison'
  | 'changelog'
  | 'validation'
  | 'reasoning'
  | 'release'
  | 'rollback'
  | 'audit';

type AuditRow = {
  id: string;
  action: string;
  actorType: string;
  createdAt: string;
  reason: string | null;
};

type ComparePayload = {
  leftId: string;
  rightId: string;
  modules: Array<{
    section: string;
    label: string;
    leftCount: number;
    rightCount: number;
    added: string[];
    removed: string[];
    unchanged: number;
    modified: number;
  }>;
  totals: { added: number; removed: number; unchanged: number };
};

type ValidationPayload = {
  run: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    summary: Record<string, unknown> | null;
  } | null;
  results: Array<{
    id: string;
    ruleCode: string;
    severity: string;
    passed: boolean;
    blocking: boolean;
    sectionKey: string | null;
    explanation: string;
    recommendation: string | null;
  }>;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'comparison', label: 'Version Comparison' },
  { id: 'changelog', label: 'Change Log' },
  { id: 'validation', label: 'Validation Results' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'release', label: 'Release History' },
  { id: 'rollback', label: 'Rollback' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'draft', label: 'Draft', icon: CircleDot },
  { key: 'validate', label: 'Validate', icon: ClipboardCheck },
  { key: 'approve', label: 'Approve', icon: ShieldCheck },
  { key: 'release', label: 'Release', icon: CheckCircle2 },
  { key: 'archive', label: 'Archive', icon: Archive },
  { key: 'rollback', label: 'Rollback', icon: History },
  { key: 'audit', label: 'Audit', icon: GitBranch },
] as const;

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'COMPLETED':
    case 'Released':
    case 'Validated':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'Failed':
      return styles.toneBlocked;
    case 'DRAFT':
    case 'IN_REVIEW':
    case 'SUPERSEDED':
    case 'ARCHIVED':
    case 'Archived':
    case 'Draft':
    case 'WARNING':
    case 'RUNNING':
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
  selected: VersionSummary | null,
  systemRunning: boolean,
) {
  if (!selected) {
    if (systemRunning && index === 0) return 'active';
    return 'pending';
  }
  const status = selected.status;
  if (status === 'ACTIVE') {
    if (index <= 3) return 'done';
    if (index === 4) return 'active';
    return 'pending';
  }
  if (status === 'SUPERSEDED' || status === 'ARCHIVED') {
    if (index <= 4) return 'done';
    if (index === 5) return 'active';
    return 'pending';
  }
  if (status === 'READY') {
    if (index <= 1) return 'done';
    if (index === 2) return 'active';
    return 'pending';
  }
  if (status === 'INVALID') {
    if (index === 0) return 'done';
    if (index === 1) return 'active';
    return 'pending';
  }
  if (systemRunning) {
    return index === 0 ? 'active' : 'pending';
  }
  return index === 0 ? 'active' : 'pending';
}

export function VersionsWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [validation, setValidation] = useState<ValidationPayload>({ run: null, results: [] });
  const [compare, setCompare] = useState<ComparePayload | null>(null);
  const [compareAgainstId, setCompareAgainstId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VersionFilter>('all');
  const [tab, setTab] = useState<TabId>('overview');
  const [busy, setBusy] = useState(true);
  const [rollingBack, setRollingBack] = useState(false);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const run = overview?.autonomyRun ?? null;
  const systemRunning = systemState === 'RUNNING';

  async function load(preferId?: string | null) {
    setBusy(true);
    setError('');
    try {
      const [next, dashboard, versionPayload] = await Promise.all([
        strategyApi.overview(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
        strategyApi.versions().catch(() => ({
          strategyId: null,
          currentVersionId: null,
          versions: [] as VersionSummary[],
        })),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      setVersions(versionPayload.versions);
      setCurrentVersionId(versionPayload.currentVersionId);
      const targetId =
        preferId ??
        selectedId ??
        versionPayload.currentVersionId ??
        versionPayload.versions[0]?.id ??
        null;
      setSelectedId(targetId);

      if (targetId) {
        const [auditRows, validationPayload] = await Promise.all([
          strategyApi.audit(targetId).catch(() => [] as AuditRow[]),
          strategyApi.validation(targetId).catch(() => ({ run: null, results: [] })),
        ]);
        setAudit(auditRows);
        setValidation(validationPayload);
      } else {
        setAudit([]);
        setValidation({ run: null, results: [] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unavailable');
    } finally {
      setBusy(false);
    }
  }

  async function loadCompare(leftId: string, rightId: string) {
    try {
      const payload = await strategyApi.compareVersions(leftId, rightId);
      setCompare(payload);
    } catch {
      setCompare(null);
    }
  }

  async function performRollback(sourceId: string) {
    if (rollingBack) return;
    setRollingBack(true);
    setError('');
    try {
      const result = await strategyApi.rollback(sourceId);
      await load(result.id);
      setTab('overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setRollingBack(false);
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

  const issues = useMemo(() => versionIssues(versions), [versions]);
  const filtered = useMemo(
    () => filterVersions(versions, query, filter, currentVersionId),
    [versions, query, filter, currentVersionId],
  );
  const selected =
    filtered.find((item) => item.id === selectedId) ??
    versions.find((item) => item.id === selectedId) ??
    null;

  const compareCandidates = useMemo(
    () => versions.filter((item) => item.id !== selected?.id),
    [versions, selected?.id],
  );

  useEffect(() => {
    if (!selected) {
      setCompareAgainstId(null);
      setCompare(null);
      return;
    }
    const preferred =
      compareAgainstId && compareAgainstId !== selected.id
        ? compareAgainstId
        : compareCandidates[0]?.id ?? null;
    setCompareAgainstId(preferred);
    if (preferred) void loadCompare(preferred, selected.id);
    else setCompare(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, versions]);

  const activeVersion = versions.find((item) => item.status === 'ACTIVE');
  const draftCount = versions.filter((item) => isDraftStatus(item.status)).length;
  const releasedCount = versions.filter((item) => isReleasedStatus(item.status)).length;
  const archivedCount = versions.filter((item) => isArchivedStatus(item.status)).length;
  const canRollback = selected ? rollbackEligible(selected, versions) : false;
  const validationPassed = validation.results.filter((item) => item.passed).length;
  const validationFailed = validation.results.filter((item) => !item.passed).length;

  const kpis = useMemo(
    () => [
      {
        label: 'Total Versions',
        value: String(versions.length),
        meta: `${archivedCount} archived / superseded`,
        accent: '#2563EB',
        icon: History,
        bars: sparkBars(versions.length),
      },
      {
        label: 'Active Version',
        value: activeVersion ? `v${activeVersion.versionNumber}` : '—',
        meta: activeVersion ? 'Released & immutable' : 'No ACTIVE release',
        accent: '#16A34A',
        icon: CheckCircle2,
        bars: sparkBars(activeVersion?.versionNumber ?? 0),
      },
      {
        label: 'Draft Versions',
        value: String(draftCount),
        meta: 'Mutable working copies',
        accent: '#0284C7',
        icon: CircleDot,
        bars: sparkBars(draftCount),
      },
      {
        label: 'Released Versions',
        value: String(releasedCount),
        meta: 'Currently ACTIVE',
        accent: '#0F766E',
        icon: ShieldCheck,
        bars: sparkBars(releasedCount),
      },
      {
        label: 'Validation Status',
        value: selected?.lastValidatedAt
          ? versionLifecycleLabel(selected.status)
          : 'UNVALIDATED',
        meta: selected?.lastValidatedAt
          ? new Date(selected.lastValidatedAt).toLocaleString()
          : 'No validation timestamp',
        accent: '#D97706',
        icon: ClipboardCheck,
        bars: sparkBars(selected?.lastValidatedAt ? 8 : 2),
      },
      {
        label: 'Rollback Readiness',
        value: canRollback ? 'READY' : 'BLOCKED',
        meta: canRollback
          ? 'Eligible to clone a new draft'
          : 'Mutable draft exists or source ineligible',
        accent: canRollback ? '#7C3AED' : '#B45309',
        icon: RefreshCw,
        bars: sparkBars(canRollback ? 9 : 2),
      },
    ],
    [
      versions.length,
      archivedCount,
      activeVersion,
      draftCount,
      releasedCount,
      selected,
      canRollback,
    ],
  );

  const packageStatus =
    overview?.status === 'ACTIVE'
      ? 'Released'
      : overview?.status === 'READY'
        ? 'Validated'
        : systemRunning
          ? 'Creating'
          : overview?.status === 'INVALID'
            ? 'Failed'
            : versions.length
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
        <p className={styles.crumb}>Strategy & Fields / Strategy Versions</p>
        <h1 className={styles.title}>Strategy Versions</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Strategy service unavailable</h2>
          <p>{error || overview?.reason}</p>
        </section>
      </main>
    );
  }

  if (!overview?.available) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Strategy & Fields / Strategy Versions</p>
        <h1 className={styles.title}>Strategy Versions</h1>
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
          <p className={styles.crumb}>Strategy & Fields / Strategy Versions</p>
          <h1 className={styles.title}>Strategy Versions</h1>
          <p className={styles.lede}>
            Immutable release history, draft lifecycle, validation evidence, and rollback drafts for
            CACSMS Stage 01 strategy packages.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 01</span>
          <span className={`${styles.badge} ${styles.toneAi}`}>System Managed</span>
          <span className={`${styles.badge} ${statusTone(packageStatus)}`}>{packageStatus}</span>
          <span className={`${styles.badge} ${statusTone(overview.status)}`}>
            Current v{overview.versionNumber ?? '—'}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>System-managed versions</strong>
          New versions are created automatically after successful validation/activation. ACTIVE
          history is immutable. Rollback clones a selected historical version into a new DRAFT.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      {error ? (
        <div className={styles.infoNotice} role="alert">
          <AlertTriangle size={16} aria-hidden />
          <div>
            <strong>Version action failed</strong>
            {error}
          </div>
        </div>
      ) : null}

      <section className={styles.kpiGrid} aria-label="Version KPI summary">
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

      <section className={styles.lifecycle} aria-label="Version lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Version lifecycle</h2>
          <span>
            {systemRunning
              ? 'Stage 01 running — version updates may follow validation'
              : `System ${systemState} · package ${overview.status}`}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {LIFECYCLE.map((stage, index) => {
            const Icon = stage.icon;
            const state = lifecycleState(index, selected, systemRunning);
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

      {!versions.length ? (
        <section className={styles.waiting} aria-label="Awaiting strategy versions">
          <div className={styles.waitingIcon}>
            <History size={24} aria-hidden />
          </div>
          <h3>Awaiting Strategy Version Timeline</h3>
          <p>
            No strategy versions are persisted yet. An initial DRAFT is created when the strategy
            service starts; additional releases appear after Stage 01 validation and activation.
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
              Draft → Validate → Release
            </div>
          </div>
        </section>
      ) : null}

      {systemRunning ? (
        <section className={styles.infoNotice} role="status" aria-live="polite">
          <Timer size={16} aria-hidden />
          <div>
            <strong>Live Stage 01 execution in progress</strong>
            Version status and validation timestamps update automatically as reconcile and validate
            complete.
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Version Explorer">
          <div className={styles.panelHead}>
            <h2>Version Explorer</h2>
            <p>
              {versions.length} versions
              {filtered.length !== versions.length ? ` · ${filtered.length} shown` : ''} ·
              auto-updating
            </p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter versions…"
              aria-label="Search strategy versions"
            />
            <div className={styles.chips} role="group" aria-label="Version filters">
              {(
                [
                  ['all', 'All'],
                  ['current', 'Current'],
                  ['draft', 'Draft'],
                  ['validated', 'Validated'],
                  ['released', 'Released'],
                  ['archived', 'Archived'],
                  ['invalid', 'Failed'],
                  ['stale', 'Stale'],
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
              {filtered.map((version) => {
                const active = version.id === selectedId;
                const label = versionLifecycleLabel(version.status);
                return (
                  <li key={version.id}>
                    <button
                      type="button"
                      className={`${styles.objCard} ${active ? styles.objCardActive : ''}`}
                      onClick={() => setSelectedId(version.id)}
                    >
                      <div className={styles.objCardTop}>
                        <strong>Version {version.versionNumber}</strong>
                        <em className={`${styles.badge} ${statusTone(label)}`}>{label}</em>
                      </div>
                      <div className={styles.objMeta}>
                        <span className={styles.pill}>{version.status}</span>
                        <span className={styles.pill}>{version.recordCount} records</span>
                        <span className={styles.pill}>{version.createdBy}</span>
                        {version.id === currentVersionId ? (
                          <span className={`${styles.pill} ${styles.toneDraft}`}>Current</span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.empty}>
              <h3>No matching versions</h3>
              <p>Adjust filters or wait for Stage 01 to persist version history.</p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Version Intelligence">
          <div className={styles.panelHead}>
            <h2>
              {selected ? `Version ${selected.versionNumber}` : 'Version Intelligence'}
            </h2>
            <p>
              Release metadata, comparison, validation evidence, and rollback controls for the
              selected strategy version.
            </p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Version tabs">
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
                <h3>No version selected</h3>
                <p>Persisted strategy versions appear when the package is available.</p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Version identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Version number</span>
                      <strong>v{selected.versionNumber}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Status</span>
                      <strong>
                        {versionLifecycleLabel(selected.status)} ({selected.status})
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Author / agent</span>
                      <strong>{display(selected.createdBy)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Created</span>
                      <strong>{new Date(selected.createdAt).toLocaleString()}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Activation date</span>
                      <strong>
                        {selected.effectiveDate
                          ? new Date(selected.effectiveDate).toLocaleString()
                          : '—'}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Last validated</span>
                      <strong>
                        {selected.lastValidatedAt
                          ? new Date(selected.lastValidatedAt).toLocaleString()
                          : '—'}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Checksum</span>
                      <strong>{display(selected.checksum?.slice(0, 16))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Compatibility</span>
                      <strong>
                        {selected.sectionCount}/{REQUIRED_SECTIONS.length} modules present
                      </strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Change summary</h3>
                  <p>
                    {selected.createReason ||
                      selected.createAction ||
                      'No persisted create reason for this version.'}
                  </p>
                  <div className={styles.gateGrid}>
                    {REQUIRED_SECTIONS.map((key) => {
                      const count = selected.sectionCounts[key] ?? 0;
                      return (
                        <div key={key} className={styles.gateChip} data-done={count > 0}>
                          <strong>{key}</strong>
                          <span>{count > 0 ? `${count} records` : 'Empty'}</span>
                        </div>
                      );
                    })}
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'comparison' ? (
              <article className={styles.sectionCard}>
                <h3>Side-by-side comparison</h3>
                <div className={styles.groupList} style={{ marginBottom: 12 }}>
                  <div className={styles.groupItem}>
                    <span>Compare baseline</span>
                    <b>
                      <select
                        value={compareAgainstId ?? ''}
                        onChange={(event) => {
                          const nextId = event.target.value || null;
                          setCompareAgainstId(nextId);
                          if (nextId) void loadCompare(nextId, selected.id);
                        }}
                        aria-label="Select comparison baseline version"
                      >
                        {!compareCandidates.length ? (
                          <option value="">No other versions</option>
                        ) : null}
                        {compareCandidates.map((version) => (
                          <option key={version.id} value={version.id}>
                            v{version.versionNumber} · {version.status}
                          </option>
                        ))}
                      </select>
                    </b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Selected (right)</span>
                    <b>
                      v{selected.versionNumber} · {selected.status}
                    </b>
                  </div>
                </div>
                {compare ? (
                  <>
                    <p>
                      <FileDiff size={14} aria-hidden /> Added {compare.totals.added} · Removed{' '}
                      {compare.totals.removed} · Unchanged {compare.totals.unchanged}
                    </p>
                    <div className={styles.ladderStack} aria-label="Module comparison">
                      {compare.modules.map((module) => (
                        <div key={module.section} className={styles.ladderRung}>
                          <span className={styles.ladderRank}>
                            {module.rightCount - module.leftCount}
                          </span>
                          <div className={styles.ladderCopy}>
                            <strong>{module.label}</strong>
                            <span>
                              {module.leftCount} → {module.rightCount} · +{module.added.length} / −
                              {module.removed.length}
                            </span>
                          </div>
                          <em
                            className={`${styles.badge} ${
                              module.added.length || module.removed.length
                                ? styles.toneWarning
                                : styles.toneReady
                            }`}
                          >
                            {module.added.length || module.removed.length ? 'Changed' : 'Same'}
                          </em>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p>Select another version to compare fingerprints across Stage 01 modules.</p>
                )}
              </article>
            ) : null}

            {selected && tab === 'changelog' ? (
              <article className={styles.sectionCard}>
                <h3>Change log</h3>
                <div className={styles.groupList}>
                  <div className={styles.groupItem}>
                    <span>Create action</span>
                    <b>{display(selected.createAction)}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Release notes</span>
                    <b>{display(selected.createReason)}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Records</span>
                    <b>{selected.recordCount}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Modules impacted</span>
                    <b>
                      {
                        Object.values(selected.sectionCounts).filter((count) => count > 0)
                          .length
                      }
                    </b>
                  </div>
                </div>
                {compare ? (
                  <div className={styles.xai} style={{ marginTop: 12 }}>
                    <h3>Delta vs baseline</h3>
                    <ul>
                      <li>{compare.totals.added} fingerprints added</li>
                      <li>{compare.totals.removed} fingerprints removed</li>
                      <li>{compare.totals.unchanged} unchanged fingerprints</li>
                    </ul>
                  </div>
                ) : null}
              </article>
            ) : null}

            {selected && tab === 'validation' ? (
              <article className={styles.sectionCard}>
                <h3>Validation results</h3>
                <div className={styles.groupList} style={{ marginBottom: 12 }}>
                  <div className={styles.groupItem}>
                    <span>Run</span>
                    <b>{validation.run?.status ?? 'NO_RUN'}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Passed / failed</span>
                    <b>
                      {validationPassed} / {validationFailed}
                    </b>
                  </div>
                </div>
                {validation.results.length ? (
                  <div className={styles.ladderStack}>
                    {validation.results.slice(0, 20).map((result) => (
                      <div key={result.id} className={styles.ladderRung}>
                        <span className={styles.ladderRank}>{result.passed ? '✓' : '×'}</span>
                        <div className={styles.ladderCopy}>
                          <strong>{result.ruleCode}</strong>
                          <span>{result.explanation}</span>
                        </div>
                        <em
                          className={`${styles.badge} ${
                            result.passed ? styles.toneReady : styles.toneBlocked
                          }`}
                        >
                          {result.passed ? 'PASSED' : result.severity}
                        </em>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No persisted validation results for this version yet.</p>
                )}
              </article>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Why this version exists</h3>
                  <p>
                    {selected.createReason ||
                      `Version ${selected.versionNumber} was persisted with status ${selected.status} by ${selected.createdBy}.`}
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
                      <span>Validation evidence</span>
                      <strong>
                        {selected.lastValidatedAt
                          ? `${validationPassed} passed / ${validationFailed} failed`
                          : 'Not validated'}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Downstream impact</span>
                      <strong>
                        {selected.status === 'ACTIVE'
                          ? 'Drives Content Intelligence handoff package'
                          : selected.status === 'DRAFT'
                            ? 'Mutable Stage 01 working copy'
                            : 'Historical / immutable reference'}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Package readiness</span>
                      <strong>{overview.readiness ?? 0}%</strong>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'release' ? (
              <article className={styles.sectionCard}>
                <h3>Release history</h3>
                <div className={styles.ladderStack} aria-label="Release timeline">
                  {versions.map((version) => (
                    <button
                      key={version.id}
                      type="button"
                      className={`${styles.ladderRung} ${version.id === selectedId ? styles.ladderRungActive : ''}`}
                      onClick={() => setSelectedId(version.id)}
                    >
                      <span className={styles.ladderRank}>v{version.versionNumber}</span>
                      <div className={styles.ladderCopy}>
                        <strong>{versionLifecycleLabel(version.status)}</strong>
                        <span>
                          {version.effectiveDate
                            ? `Activated ${new Date(version.effectiveDate).toLocaleString()}`
                            : `Created ${new Date(version.createdAt).toLocaleString()}`}
                        </span>
                      </div>
                      <em className={`${styles.badge} ${statusTone(version.status)}`}>
                        {version.status}
                      </em>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'rollback' ? (
              <article className={styles.sectionCard}>
                <h3>Rollback policy</h3>
                <p>
                  Rollback never mutates ACTIVE history. It clones the selected version into a new
                  DRAFT so Stage 01 can continue safely.
                </p>
                <div className={styles.groupList}>
                  <div className={styles.groupItem}>
                    <span>Source</span>
                    <b>
                      v{selected.versionNumber} · {selected.status}
                    </b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Eligibility</span>
                    <b>{canRollback ? 'READY' : 'BLOCKED'}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Impact</span>
                    <b>
                      Clones {selected.recordCount} records into version{' '}
                      {Math.max(...versions.map((item) => item.versionNumber), 0) + 1}
                    </b>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.chip}
                  style={{
                    marginTop: 14,
                    cursor: canRollback && !rollingBack ? 'pointer' : 'not-allowed',
                    opacity: canRollback ? 1 : 0.5,
                  }}
                  disabled={!canRollback || rollingBack}
                  onClick={() => void performRollback(selected.id)}
                >
                  <RefreshCw size={14} aria-hidden />{' '}
                  {rollingBack ? 'Creating draft…' : 'Create rollback draft'}
                </button>
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
            <strong>{selected ? `v${selected.versionNumber}` : '—'}</strong>
            <span className={`${styles.badge} ${styles.toneAi}`}>
              <BrainCircuit size={12} aria-hidden /> Version agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Version health</span>
              <b>{selected ? versionLifecycleLabel(selected.status) : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Readiness score</span>
              <b>{overview.readiness ?? 0}%</b>
            </div>
            <div className={styles.insightRow}>
              <span>Impact analysis</span>
              <b>
                {compare
                  ? `+${compare.totals.added} / −${compare.totals.removed}`
                  : 'Select compare baseline'}
              </b>
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
              <b>{selected ? versionSubtitle(selected) : '—'}</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>Recommendations</h3>
            <ul>
              <li>
                {issues.invalid.length
                  ? `Resolve ${issues.invalid.length} invalid/blocked version(s) via Stage 01 Start.`
                  : 'No invalid versions detected.'}
              </li>
              <li>
                {canRollback
                  ? 'Rollback is available — creates a new DRAFT without mutating ACTIVE history.'
                  : 'Rollback blocked while a mutable draft/ready version exists.'}
              </li>
              <li>
                Activate only READY versions; ACTIVE packages remain immutable for Content
                Intelligence.
              </li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Version health axes">
            {[
              ['Modules', selected ? Math.round((selected.sectionCount / REQUIRED_SECTIONS.length) * 100) : 0],
              ['Readiness', overview.readiness ?? 0],
              ['Validation', selected?.lastValidatedAt ? 100 : 20],
              ['Release', selected?.status === 'ACTIVE' ? 100 : selected?.status === 'READY' ? 70 : 30],
              ['Rollback', canRollback ? 100 : 25],
              ['Issues free', Math.max(0, 100 - issues.issueCount * 12)],
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
            <p>Persisted version milestones</p>
          </div>
          <div className={styles.tabBody}>
            <ul className={styles.timeline}>
              <li>
                <span className={styles.dot} aria-hidden />
                <div>
                  <strong>Current package</strong>
                  <p>
                    v{overview.versionNumber ?? '—'} · {overview.status}
                  </p>
                </div>
              </li>
              <li>
                <span className={styles.dot} aria-hidden />
                <div>
                  <strong>Version catalogue</strong>
                  <p>
                    {versions.length} total · {draftCount} draft · {releasedCount} released
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
              <span>
                <Activity size={12} aria-hidden /> Agent
              </span>
              <b>Version Management</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <AlertTriangle size={12} aria-hidden /> Issues
              </span>
              <b>{issues.issueCount}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Gauge</span>
              <b>
                <Gauge size={12} aria-hidden /> {overview.readiness ?? 0}%
              </b>
            </div>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Recent audit</h2>
            <p>Selected version events</p>
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
