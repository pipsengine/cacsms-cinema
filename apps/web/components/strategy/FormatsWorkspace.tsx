'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Clapperboard,
  Compass,
  Film,
  Gauge,
  GitBranch,
  LayoutTemplate,
  MonitorPlay,
  ShieldAlert,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  aspectList,
  CALL_SHEET_FIELDS,
  categoryLabel,
  configDisplay,
  durationBounds,
  fieldLabel,
  filterFormatRecords,
  formatCategory,
  formatCoverage,
  formatDurationLabel,
  formatIssues,
  formatSubtitle,
  isFormatPolicyProfile,
  isFormatStub,
  PLATFORM_FIELDS,
  PRODUCTION_FIELDS,
  SPEC_FIELDS,
  splitList,
  timelinePercent,
  TIMELINE_MAX_SEC,
  TIMELINE_MIN_SEC,
  type FormatFilter,
} from '@/apps/web/lib/strategy-formats';
import styles from './formats-intel.module.css';

type TabId =
  | 'overview'
  | 'specs'
  | 'production'
  | 'platforms'
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
  { id: 'specs', label: 'Format Specifications' },
  { id: 'production', label: 'Production Workflow' },
  { id: 'platforms', label: 'Platform Compatibility' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'discover', label: 'Discover', icon: Compass },
  { key: 'classify', label: 'Classify', icon: LayoutTemplate },
  { key: 'validate', label: 'Validate', icon: CheckCircle2 },
  { key: 'optimize', label: 'Optimize', icon: Gauge },
  { key: 'schedule', label: 'Schedule', icon: Timer },
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
    case 'short_form':
    case 'explainer':
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
    case 'lesson':
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
  formatCount?: number,
) {
  if ((formatCount ?? 0) > 0 && (versionStatus === 'ACTIVE' || versionStatus === 'READY')) {
    return 'done';
  }
  if ((formatCount ?? 0) > 0) {
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

export function FormatsWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FormatFilter>('all');
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
        strategyApi.list(next.versionId, 'formats'),
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

  const policyFormats = useMemo(() => records.filter(isFormatPolicyProfile), [records]);
  const issues = useMemo(() => formatIssues(records), [records]);
  const activeFormats = records.filter(
    (item) => item.status === 'ACTIVE' || item.status === 'READY',
  ).length;
  const avgCoverage = records.length
    ? Math.round(records.reduce((sum, item) => sum + formatCoverage(item), 0) / records.length)
    : 0;
  const pendingOptimizations =
    issues.thinSpecs.length + issues.missingChannels.length + issues.missingAspect.length;

  const kpis = useMemo(
    () => [
      {
        label: 'Content Formats',
        value: String(policyFormats.length || records.length),
        meta: 'Persisted format strategies',
        accent: '#2563EB',
        icon: Clapperboard,
        bars: sparkBars(policyFormats.length || records.length),
      },
      {
        label: 'Active Formats',
        value: String(activeFormats),
        meta: 'ACTIVE / READY records',
        accent: '#16A34A',
        icon: CheckCircle2,
        bars: sparkBars(activeFormats),
      },
      {
        label: 'Coverage Score',
        value: `${avgCoverage}%`,
        meta: 'Average specification fill',
        accent: '#0284C7',
        icon: LayoutTemplate,
        bars: sparkBars(avgCoverage),
      },
      {
        label: 'Production Readiness',
        value: `${overview?.readiness ?? avgCoverage}%`,
        meta: 'Stage 01 package readiness',
        accent: '#D97706',
        icon: Gauge,
        bars: sparkBars(overview?.readiness ?? avgCoverage),
      },
      {
        label: 'AI Confidence',
        value: 'UNMEAS.',
        meta: 'No fabricated confidence scores',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(3),
      },
      {
        label: 'Pending Optimizations',
        value: String(pendingOptimizations),
        meta: 'Thin specs / missing channels / aspect',
        accent: pendingOptimizations ? '#DC2626' : '#16A34A',
        icon: AlertTriangle,
        bars: sparkBars(pendingOptimizations + 1),
      },
    ],
    [
      policyFormats.length,
      records.length,
      activeFormats,
      avgCoverage,
      overview?.readiness,
      pendingOptimizations,
    ],
  );

  const explorerSource = useMemo(() => {
    const live = records.filter((record) => !isFormatStub(record));
    const policy = live.filter(isFormatPolicyProfile);
    return policy.length > 0 ? policy : live.length > 0 ? live : records;
  }, [records]);

  const filtered = useMemo(
    () => filterFormatRecords(explorerSource, query, filter),
    [explorerSource, query, filter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    records.find((item) => item.id === selectedId) ??
    null;
  const config = selected?.configuration ?? {};
  const selectedCategory = selected ? formatCategory(selected) : 'other';
  const selectedCoverage = selected ? formatCoverage(selected) : 0;
  const bounds = selected ? durationBounds(selected) : { min: TIMELINE_MIN_SEC, max: TIMELINE_MIN_SEC };
  const aspects = selected ? aspectList(selected) : [];
  const channels = splitList(configDisplay(config, 'channels'));
  const audiences = splitList(configDisplay(config, 'audiences'));

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
        <p className={styles.crumb}>Strategy & Fields / Content Format Strategy</p>
        <h1 className={styles.title}>Content Format Strategy</h1>
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
          <p className={styles.crumb}>Strategy & Fields / Content Format Strategy</p>
          <h1 className={styles.title}>Content Format Strategy</h1>
          <p className={styles.lede}>
            Autonomously planned content formats defining duration bands, production standards,
            platform fit, accessibility, and publishing readiness across the CACSMS lifecycle.
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
          Content format strategies are generated automatically during Stage 01. This workspace
          provides format exploration, production standards, platform fit, and audit visibility only.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Format KPI summary">
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

      <section className={styles.lifecycle} aria-label="Format lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Format lifecycle</h2>
          <span>
            {systemRunning
              ? 'Stage 01 running — format discovery active'
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
              policyFormats.length || records.length,
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
        <section className={styles.waiting} aria-label="Awaiting autonomous format generation">
          <div className={styles.waitingIcon}>
            <Film size={24} aria-hidden />
          </div>
          <h3>Awaiting Autonomous Format Generation</h3>
          <p>
            Stage 01 has not yet generated content format strategies. Formats appear automatically
            after global Start begins and format discovery completes.
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

      {records.length && systemRunning && !policyFormats.length ? (
        <section className={styles.infoNotice} role="status" aria-live="polite">
          <Timer size={16} aria-hidden />
          <div>
            <strong>Live generation in progress</strong>
            Stage 01 is reconciling format strategies. Explorer and intelligence panels update
            automatically as records persist.
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Format Explorer">
          <div className={styles.panelHead}>
            <h2>Format Explorer</h2>
            <p>
              {explorerSource.length} formats
              {filtered.length !== explorerSource.length ? ` · ${filtered.length} shown` : ''} ·
              auto-updating
            </p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search formats, channels, durations…"
              aria-label="Search content formats"
            />
            <div className={styles.chips} role="group" aria-label="Format filters">
              {(
                [
                  ['all', 'All'],
                  ['short_form', 'Short-form'],
                  ['explainer', 'Explainer'],
                  ['lesson', 'Lesson'],
                  ['documentary', 'Documentary'],
                  ['validated', 'Validated'],
                  ['thin_spec', 'Thin spec'],
                  ['duplicate', 'Duplicate'],
                  ['stub_only', 'Stub'],
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
                const category = formatCategory(record);
                const coverage = formatCoverage(record);
                const d = durationBounds(record);
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
                        <span className={`${styles.pill} ${statusTone(category)}`}>
                          {categoryLabel(category)}
                        </span>
                        <span className={styles.pill}>
                          {formatDurationLabel(d.min)}–{formatDurationLabel(d.max)}
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
              <h3>{systemRunning ? 'Discovery in progress' : 'No matching formats'}</h3>
              <p>
                {systemRunning
                  ? 'Format discovery is reconciling strategies. This explorer updates automatically.'
                  : 'Adjust filters or wait for Stage 01 to materialise format strategies.'}
              </p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Content Format Intelligence">
          <div className={styles.panelHead}>
            <h2>{selected?.name || 'Content Format Intelligence'}</h2>
            <p>Explainable production brief and platform fit for the selected system-owned format.</p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Format tabs">
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
                <h3>No format selected</h3>
                <p>Persisted formats are selected automatically when Stage 01 completes.</p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Format identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Format name</span>
                      <strong>{display(selected.name)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>System key</span>
                      <strong>{display(configDisplay(config, 'systemKey'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Family / category</span>
                      <strong>{categoryLabel(selectedCategory)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Duration band</span>
                      <strong>
                        {formatDurationLabel(bounds.min)}–{formatDurationLabel(bounds.max)}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Status</span>
                      <strong>{display(selected.status)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Priority</span>
                      <strong>{selected.priority}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Cost boundary</span>
                      <strong>{display(configDisplay(config, 'costBoundary'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Owning agent</span>
                      <strong>Format Strategy Agent</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Executive summary</h3>
                  <p>{display(selected.description)}</p>
                  <div className={styles.timelineStrip} aria-label="Duration timeline band">
                    <div className={styles.timelineAxis}>
                      <i
                        className={styles.timelineBand}
                        style={{
                          left: `${timelinePercent(bounds.min)}%`,
                          width: `${Math.max(2, timelinePercent(bounds.max) - timelinePercent(bounds.min))}%`,
                        }}
                      />
                    </div>
                    <div className={styles.timelineLabels}>
                      <span>{formatDurationLabel(TIMELINE_MIN_SEC)}</span>
                      <span>
                        Selected {formatDurationLabel(bounds.min)}–{formatDurationLabel(bounds.max)}
                      </span>
                      <span>{formatDurationLabel(TIMELINE_MAX_SEC)}</span>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Format health</h3>
                  <div className={styles.scoreRow}>
                    {[
                      ['Spec fill', selectedCoverage],
                      ['Priority', selected.priority],
                      ['Package readiness', overview.readiness ?? 0],
                      ['Channel entries', Math.min(100, channels.length * 25)],
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
                    AI confidence and engagement potential remain UNMEASURED until Research & Evidence
                    publishes verified scores.
                  </p>
                </article>
              </>
            ) : null}

            {selected && tab === 'specs' ? (
              <article className={styles.sectionCard}>
                <h3>Format specifications</h3>
                <div className={styles.groupList}>
                  {[...SPEC_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
                {aspects.length ? (
                  <div className={styles.countryChips} style={{ marginTop: 12 }}>
                    {aspects.map((item) => (
                      <span key={item} className={styles.countryChip}>
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ) : null}

            {selected && tab === 'production' ? (
              <article className={styles.sectionCard}>
                <h3>Production workflow / call sheet</h3>
                <div className={styles.groupList}>
                  {CALL_SHEET_FIELDS.map((item) => (
                    <div key={item.key} className={styles.groupItem}>
                      <span>{item.label}</span>
                      <b>{display(configDisplay(config, item.key))}</b>
                    </div>
                  ))}
                  {[...PRODUCTION_FIELDS].filter((key) => !CALL_SHEET_FIELDS.some((c) => c.key === key)).map(
                    (key) => (
                      <div key={key} className={styles.groupItem}>
                        <span>{fieldLabel(key)}</span>
                        <b>{display(configDisplay(config, key))}</b>
                      </div>
                    ),
                  )}
                </div>
              </article>
            ) : null}

            {selected && tab === 'platforms' ? (
              <article className={styles.sectionCard}>
                <h3>Platform compatibility</h3>
                <div className={styles.groupList}>
                  {[...PLATFORM_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
                <div className={styles.countryChips} style={{ marginTop: 12 }}>
                  {channels.map((item) => (
                    <span key={item} className={styles.countryChip}>
                      {item}
                    </span>
                  ))}
                  {audiences.map((item) => (
                    <span key={item} className={styles.countryChip}>
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Why this format exists</h3>
                  <p>
                    Generated by the Format Strategy Agent to define {categoryLabel(selectedCategory).toLowerCase()}{' '}
                    production standards for Stage 01 publishing readiness
                    {configDisplay(config, 'purpose') ? `: ${configDisplay(config, 'purpose')}` : '.'}
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
                      <span>Family</span>
                      <strong>{display(configDisplay(config, 'family'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Confidence</span>
                      <strong>UNMEASURED</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Frequency posture</span>
                      <strong>{display(configDisplay(config, 'frequency'))}</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Governance</h3>
                  <div className={styles.groupList}>
                    <div className={styles.groupItem}>
                      <span>Accessibility</span>
                      <b>{display(configDisplay(config, 'accessibility'))}</b>
                    </div>
                    <div className={styles.groupItem}>
                      <span>Captions</span>
                      <b>{display(configDisplay(config, 'captions'))}</b>
                    </div>
                    <div className={styles.groupItem}>
                      <span>Evidence depth</span>
                      <b>{display(configDisplay(config, 'evidenceDepth'))}</b>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'dependencies' ? (
              <article className={styles.sectionCard}>
                <h3>Downstream and peer links</h3>
                <div className={styles.depChain}>
                  {['objectives', 'domains', 'audiences', 'channels', 'editorial-policy', 'localisation'].map(
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
                    <span>Thin specifications</span>
                    <b>{issues.thinSpecs.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Missing channels</span>
                    <b>{issues.missingChannels.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Missing aspect ratios</span>
                    <b>{issues.missingAspect.length}</b>
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
                      <strong>Format materialisation</strong>
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
            <strong>{selected ? `${selectedCoverage}%` : '—'}</strong>
            <span className={`${styles.badge} ${styles.toneAi}`}>
              <BrainCircuit size={12} aria-hidden /> Format agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Format score</span>
              <b>{selected ? `${selectedCoverage}% fill` : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Production complexity</span>
              <b>{display(configDisplay(config, 'costBoundary'))}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Engagement potential</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Linked audiences</span>
              <b>{audiences.length || 'Stage 01 peer'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Channels</span>
              <b>{channels.length}</b>
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
              <b>{selected ? formatSubtitle(selected) : '—'}</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>Recommendations</h3>
            <ul>
              <li>
                {issues.thinSpecs.length
                  ? `Enrich ${issues.thinSpecs.length} thin format specification(s).`
                  : 'Format specification fill is above the thin-spec threshold.'}
              </li>
              <li>
                {issues.missingChannels.length
                  ? `Attach channel targets to ${issues.missingChannels.length} format(s).`
                  : 'Channel targets are declared on policy formats.'}
              </li>
              <li>
                Align aspect ratios and accessibility rules with channel and editorial peers before
                handoff.
              </li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Format health axes">
            {[
              ['Coverage', selectedCoverage],
              ['Priority', selected?.priority ?? 0],
              ['Channels', channels.length ? Math.min(100, channels.length * 25) : 0],
              ['Aspects', aspects.length ? Math.min(100, aspects.length * 30) : 0],
              ['Readiness', overview.readiness ?? 0],
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
                  <strong>Format persistence</strong>
                  <p>
                    {policyFormats.length || records.length} formats · {activeFormats} active ·{' '}
                    {pendingOptimizations} pending
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
              <span>Formats discovered</span>
              <b>{records.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Activity size={12} aria-hidden /> Agent
              </span>
              <b>Format Strategy</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <MonitorPlay size={12} aria-hidden /> Policy formats
              </span>
              <b>{policyFormats.length}</b>
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
