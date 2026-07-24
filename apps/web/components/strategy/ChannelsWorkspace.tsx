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
  Radio,
  Share2,
  ShieldAlert,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  AUDIENCE_FIELDS,
  categoryLabel,
  channelCategory,
  channelCoverage,
  channelIssues,
  channelSubtitle,
  configDisplay,
  DISTRIBUTION_FIELDS,
  enablementState,
  fieldLabel,
  filterChannelRecords,
  isChannelPolicyProfile,
  isChannelStub,
  MATRIX_COLUMNS,
  matrixCell,
  PLATFORM_FIELDS,
  PUBLISHING_FIELDS,
  publishTone,
  splitList,
  type ChannelFilter,
  type MatrixColumn,
} from '@/apps/web/lib/strategy-channels';
import styles from './channels-intel.module.css';

type TabId =
  | 'overview'
  | 'platform'
  | 'audience'
  | 'distribution'
  | 'publishing'
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
  { id: 'platform', label: 'Platform Configuration' },
  { id: 'audience', label: 'Audience Mapping' },
  { id: 'distribution', label: 'Distribution Rules' },
  { id: 'publishing', label: 'Publishing Strategy' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'discover', label: 'Discover', icon: Compass },
  { key: 'evaluate', label: 'Evaluate', icon: Gauge },
  { key: 'optimize', label: 'Optimize', icon: Share2 },
  { key: 'validate', label: 'Validate', icon: CheckCircle2 },
  { key: 'schedule', label: 'Schedule', icon: Timer },
  { key: 'publish', label: 'Publish', icon: Radio },
  { key: 'handoff', label: 'Handoff', icon: GitBranch },
] as const;

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'COMPLETED':
    case 'RUNNING':
    case 'Completed':
    case 'ENABLED':
    case 'owned':
    case 'education':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'Failed':
    case 'DISABLED':
      return styles.toneBlocked;
    case 'QUEUED':
    case 'PAUSED':
    case 'WARNING':
    case 'Running':
    case 'STAGED':
    case 'social':
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
  channelCount?: number,
) {
  if ((channelCount ?? 0) > 0 && (versionStatus === 'ACTIVE' || versionStatus === 'READY')) {
    return 'done';
  }
  if ((channelCount ?? 0) > 0) {
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

export function ChannelsWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCell, setActiveCell] = useState<MatrixColumn['id'] | null>('enablement');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ChannelFilter>('all');
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
        strategyApi.list(next.versionId, 'channels'),
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

  const policyChannels = useMemo(() => records.filter(isChannelPolicyProfile), [records]);
  const issues = useMemo(() => channelIssues(records), [records]);
  const activeChannels = records.filter(
    (item) => item.status === 'ACTIVE' || item.status === 'READY',
  ).length;
  const enabledChannels = records.filter((item) => enablementState(item) === 'ENABLED').length;
  const avgCoverage = records.length
    ? Math.round(records.reduce((sum, item) => sum + channelCoverage(item), 0) / records.length)
    : 0;
  const publishReady = records.filter((item) => publishTone(item) === 'ok').length;
  const audienceReachEntries = records.reduce(
    (sum, item) => sum + splitList(configDisplay(item.configuration, 'audiences')).length,
    0,
  );

  const kpis = useMemo(
    () => [
      {
        label: 'Distribution Channels',
        value: String(policyChannels.length || records.length),
        meta: 'Persisted channel strategies',
        accent: '#2563EB',
        icon: Radio,
        bars: sparkBars(policyChannels.length || records.length),
      },
      {
        label: 'Active Channels',
        value: String(activeChannels),
        meta: `${enabledChannels} strategically enabled`,
        accent: '#16A34A',
        icon: CheckCircle2,
        bars: sparkBars(activeChannels),
      },
      {
        label: 'Platform Readiness',
        value: `${avgCoverage}%`,
        meta: 'Average configuration fill',
        accent: '#0284C7',
        icon: Share2,
        bars: sparkBars(avgCoverage),
      },
      {
        label: 'Audience Reach',
        value: String(audienceReachEntries),
        meta: 'Audience mapping entries (not fabricated reach)',
        accent: '#0F766E',
        icon: Gauge,
        bars: sparkBars(audienceReachEntries),
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
        label: 'Publishing Readiness',
        value: String(publishReady),
        meta: overview?.readiness != null ? `Package ${overview.readiness}%` : 'Can-publish posture',
        accent: '#D97706',
        icon: CircleDot,
        bars: sparkBars(publishReady),
      },
    ],
    [
      policyChannels.length,
      records.length,
      activeChannels,
      enabledChannels,
      avgCoverage,
      audienceReachEntries,
      publishReady,
      overview?.readiness,
    ],
  );

  const explorerSource = useMemo(() => {
    const live = records.filter((record) => !isChannelStub(record));
    const policy = live.filter(isChannelPolicyProfile);
    return policy.length > 0 ? policy : live.length > 0 ? live : records;
  }, [records]);

  const filtered = useMemo(
    () => filterChannelRecords(explorerSource, query, filter),
    [explorerSource, query, filter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    records.find((item) => item.id === selectedId) ??
    null;
  const config = selected?.configuration ?? {};
  const selectedCategory = selected ? channelCategory(selected) : 'other';
  const selectedCoverage = selected ? channelCoverage(selected) : 0;
  const selectedEnablement = selected ? enablementState(selected) : 'UNKNOWN';
  const formats = splitList(configDisplay(config, 'formats'));
  const audiences = splitList(configDisplay(config, 'audiences'));
  const activeMatrix = selected && activeCell ? matrixCell(selected, activeCell) : null;

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
        <p className={styles.crumb}>Strategy & Fields / Channel Strategy</p>
        <h1 className={styles.title}>Channel Strategy</h1>
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
          <p className={styles.crumb}>Strategy & Fields / Channel Strategy</p>
          <h1 className={styles.title}>Channel Strategy</h1>
          <p className={styles.lede}>
            Autonomously governed distribution strategy defining platform enablement, audience fit,
            publishing rules, provider readiness, and multi-channel delivery for CACSMS.
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
          Channel strategies are generated automatically during Stage 01. This workspace provides
          distribution exploration, platform readiness, governance, and audit visibility only.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Channel KPI summary">
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

      <section className={styles.lifecycle} aria-label="Channel lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Channel lifecycle</h2>
          <span>
            {systemRunning
              ? 'Stage 01 running — channel discovery active'
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
              policyChannels.length || records.length,
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
        <section className={styles.waiting} aria-label="Awaiting autonomous channel generation">
          <div className={styles.waitingIcon}>
            <Radio size={24} aria-hidden />
          </div>
          <h3>Awaiting Autonomous Channel Generation</h3>
          <p>
            Stage 01 has not yet generated distribution channel strategies. The enablement matrix
            appears automatically after global Start begins and channel discovery completes.
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
              Discover → Evaluate → Persist
            </div>
          </div>
          <div className={styles.ghostCards} aria-hidden>
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
          </div>
        </section>
      ) : null}

      {records.length && systemRunning && !policyChannels.length ? (
        <section className={styles.infoNotice} role="status" aria-live="polite">
          <Timer size={16} aria-hidden />
          <div>
            <strong>Live generation in progress</strong>
            Stage 01 is reconciling channel strategies. Explorer and intelligence panels update
            automatically as records persist.
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Channel Explorer">
          <div className={styles.panelHead}>
            <h2>Channel Explorer</h2>
            <p>
              {explorerSource.length} channels
              {filtered.length !== explorerSource.length ? ` · ${filtered.length} shown` : ''} ·
              auto-updating
            </p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search channels, formats, audiences…"
              aria-label="Search distribution channels"
            />
            <div className={styles.chips} role="group" aria-label="Channel filters">
              {(
                [
                  ['all', 'All'],
                  ['owned', 'Owned'],
                  ['social', 'Social'],
                  ['education', 'Education'],
                  ['partner', 'Partner'],
                  ['enabled', 'Enabled'],
                  ['staged', 'Staged'],
                  ['validated', 'Validated'],
                  ['thin_config', 'Thin'],
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
                const category = channelCategory(record);
                const coverage = channelCoverage(record);
                const enabled = enablementState(record);
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
                        <span className={`${styles.pill} ${statusTone(enabled)}`}>{enabled}</span>
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
              <h3>{systemRunning ? 'Discovery in progress' : 'No matching channels'}</h3>
              <p>
                {systemRunning
                  ? 'Channel discovery is reconciling strategies. This explorer updates automatically.'
                  : 'Adjust filters or wait for Stage 01 to materialise channel strategies.'}
              </p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Channel Intelligence">
          <div className={styles.panelHead}>
            <h2>{selected?.name || 'Channel Intelligence'}</h2>
            <p>Explainable enablement, distribution, and publishing posture for the selected channel.</p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Channel tabs">
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
                <h3>No channel selected</h3>
                <p>Persisted channels are selected automatically when Stage 01 completes.</p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Channel identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Channel name</span>
                      <strong>{display(selected.name)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>System key</span>
                      <strong>{display(configDisplay(config, 'systemKey'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Category / lane</span>
                      <strong>{categoryLabel(selectedCategory)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Enablement</span>
                      <strong>{selectedEnablement}</strong>
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
                      <span>Publish posture</span>
                      <strong>{matrixCell(selected, 'publish').label}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Owning agent</span>
                      <strong>Channel Strategy Agent</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Executive summary</h3>
                  <p>{display(selected.description)}</p>
                  <div className={styles.matrixGrid} role="group" aria-label="Enablement matrix">
                    {MATRIX_COLUMNS.map((column) => {
                      const cell = matrixCell(selected, column.id);
                      return (
                        <button
                          key={column.id}
                          type="button"
                          className={`${styles.matrixCell} ${activeCell === column.id ? styles.matrixCellActive : ''}`}
                          data-tone={cell.tone}
                          title={cell.detail || column.label}
                          onClick={() => setActiveCell(column.id)}
                        >
                          <span>{column.label}</span>
                          <strong>{cell.label}</strong>
                        </button>
                      );
                    })}
                  </div>
                  {activeMatrix ? (
                    <p style={{ marginTop: 12, color: 'var(--muted)' }}>
                      {MATRIX_COLUMNS.find((item) => item.id === activeCell)?.label}:{' '}
                      {display(activeMatrix.detail)}
                    </p>
                  ) : null}
                </article>
                <article className={styles.sectionCard}>
                  <h3>Channel health</h3>
                  <div className={styles.scoreRow}>
                    {[
                      ['Config fill', selectedCoverage],
                      ['Priority', selected.priority],
                      ['Package readiness', overview.readiness ?? 0],
                      ['Format links', Math.min(100, formats.length * 25)],
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
                    Channel performance and AI confidence remain UNMEASURED — no fabricated reach or
                    engagement metrics.
                  </p>
                </article>
              </>
            ) : null}

            {selected && tab === 'platform' ? (
              <article className={styles.sectionCard}>
                <h3>Platform configuration</h3>
                <div className={styles.groupList}>
                  {[...PLATFORM_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'audience' ? (
              <article className={styles.sectionCard}>
                <h3>Audience mapping</h3>
                <div className={styles.groupList}>
                  {[...AUDIENCE_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
                <div className={styles.countryChips} style={{ marginTop: 12 }}>
                  {audiences.map((item) => (
                    <span key={item} className={styles.countryChip}>
                      {item}
                    </span>
                  ))}
                  {formats.map((item) => (
                    <span key={item} className={styles.countryChip}>
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'distribution' ? (
              <article className={styles.sectionCard}>
                <h3>Distribution rules</h3>
                <div className={styles.groupList}>
                  {[...DISTRIBUTION_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'publishing' ? (
              <article className={styles.sectionCard}>
                <h3>Publishing strategy</h3>
                <div className={styles.groupList}>
                  {[...PUBLISHING_FIELDS].map((key) => (
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
                  <h3>Why this channel exists</h3>
                  <p>
                    Generated by the Channel Strategy Agent to define {categoryLabel(selectedCategory).toLowerCase()}{' '}
                    distribution for Stage 01 publishing readiness
                    {configDisplay(config, 'objective') ? `: ${configDisplay(config, 'objective')}` : '.'}
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
                      <span>Lane</span>
                      <strong>{display(configDisplay(config, 'lane'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Confidence</span>
                      <strong>UNMEASURED</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Success metrics</span>
                      <strong>{display(configDisplay(config, 'successMetrics'))}</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Governance</h3>
                  <div className={styles.groupList}>
                    <div className={styles.groupItem}>
                      <span>Restrictions</span>
                      <b>{display(configDisplay(config, 'restrictions'))}</b>
                    </div>
                    <div className={styles.groupItem}>
                      <span>Caption requirements</span>
                      <b>{display(configDisplay(config, 'captionRequirements'))}</b>
                    </div>
                    <div className={styles.groupItem}>
                      <span>Geographic targeting</span>
                      <b>{display(configDisplay(config, 'geographicTargeting'))}</b>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'dependencies' ? (
              <article className={styles.sectionCard}>
                <h3>Downstream and peer links</h3>
                <div className={styles.depChain}>
                  {['objectives', 'audiences', 'formats', 'geographies', 'editorial-policy', 'localisation'].map(
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
                    <span>Provider gaps</span>
                    <b>{issues.providerGaps.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Blocked publish</span>
                    <b>{issues.blockedPublish.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Missing format mappings</span>
                    <b>{issues.missingFormats.length}</b>
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
                      <strong>Channel materialisation</strong>
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
            <strong>{selected ? selectedEnablement : '—'}</strong>
            <span className={`${styles.badge} ${styles.toneAi}`}>
              <BrainCircuit size={12} aria-hidden /> Channel agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Channel performance</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Audience fit</span>
              <b>{audiences.length || '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Optimization score</span>
              <b>{selected ? `${selectedCoverage}% fill` : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Linked formats</span>
              <b>{formats.length}</b>
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
              <b>{selected ? channelSubtitle(selected) : '—'}</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>Recommendations</h3>
            <ul>
              <li>
                {issues.providerGaps.length
                  ? `Resolve provider readiness for ${issues.providerGaps.length} channel(s).`
                  : 'No provider-gap channels detected in the current set.'}
              </li>
              <li>
                {issues.missingFormats.length
                  ? `Map formats to ${issues.missingFormats.length} channel(s).`
                  : 'Format mappings are present on policy channels.'}
              </li>
              <li>
                Keep automation gated until editorial, geography, and quality peers clear publish
                windows.
              </li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Channel health axes">
            {[
              ['Coverage', selectedCoverage],
              ['Priority', selected?.priority ?? 0],
              ['Formats', formats.length ? Math.min(100, formats.length * 25) : 0],
              ['Audiences', audiences.length ? Math.min(100, audiences.length * 25) : 0],
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
                  <strong>Channel persistence</strong>
                  <p>
                    {policyChannels.length || records.length} channels · {enabledChannels} enabled ·{' '}
                    {publishReady} publish-ready
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
              <span>Channels discovered</span>
              <b>{records.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Activity size={12} aria-hidden /> Agent
              </span>
              <b>Channel Strategy</b>
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
