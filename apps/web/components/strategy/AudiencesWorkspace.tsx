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
  Crosshair,
  Gauge,
  GitBranch,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
  Users,
  UsersRound,
} from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  audienceIssues,
  audienceSegment,
  audienceSubtitle,
  configDisplay,
  fieldLabel,
  filterAudienceRecords,
  groupAudiencesBySegment,
  isAudiencePolicyProfile,
  isAudienceStub,
  NEEDS_FIELDS,
  profileCoverage,
  REACH_FIELDS,
  segmentLabel,
  splitList,
  SUCCESS_FIELDS,
  WHO_FIELDS,
  type AudienceFilter,
} from '@/apps/web/lib/strategy-audiences';
import styles from './audiences-intel.module.css';

type TabId =
  | 'overview'
  | 'demographics'
  | 'psychographics'
  | 'behaviour'
  | 'channels'
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
  { id: 'demographics', label: 'Demographics' },
  { id: 'psychographics', label: 'Psychographics' },
  { id: 'behaviour', label: 'Behaviour & Interests' },
  { id: 'channels', label: 'Channels & Platforms' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'discover', label: 'Discover', icon: Compass },
  { key: 'segment', label: 'Segment', icon: UsersRound },
  { key: 'profile', label: 'Profile', icon: Users },
  { key: 'validate', label: 'Validate', icon: CheckCircle2 },
  { key: 'score', label: 'Score', icon: Gauge },
  { key: 'link', label: 'Link', icon: GitBranch },
  { key: 'persist', label: 'Persist', icon: CircleDot },
  { key: 'handoff', label: 'Handoff', icon: Target },
] as const;

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'COMPLETED':
    case 'RUNNING':
    case 'Completed':
    case 'primary':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'Failed':
    case 'excluded':
      return styles.toneBlocked;
    case 'QUEUED':
    case 'PAUSED':
    case 'WARNING':
    case 'Running':
    case 'secondary':
    case 'unclassified':
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
  profileCount?: number,
) {
  if ((profileCount ?? 0) > 0 && (versionStatus === 'ACTIVE' || versionStatus === 'READY')) {
    return 'done';
  }
  if ((profileCount ?? 0) > 0) {
    return index <= 6 ? 'done' : index === 7 ? 'active' : 'pending';
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

export function AudiencesWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AudienceFilter>('all');
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
        strategyApi.list(next.versionId, 'audiences'),
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

  const segments = useMemo(() => groupAudiencesBySegment(records), [records]);
  const issues = useMemo(() => audienceIssues(records), [records]);
  const policyProfiles = useMemo(() => records.filter(isAudiencePolicyProfile), [records]);
  const validated = records.filter((item) => item.status === 'ACTIVE' || item.status === 'READY').length;
  const avgCoverage = records.length
    ? Math.round(records.reduce((sum, item) => sum + profileCoverage(item), 0) / records.length)
    : 0;
  const validationScore = records.length ? Math.round((validated / records.length) * 100) : 0;

  const kpis = useMemo(
    () => [
      {
        label: 'Total Personas',
        value: String(records.length),
        meta: 'Persisted audience records',
        accent: '#2563EB',
        icon: Users,
        bars: sparkBars(records.length),
      },
      {
        label: 'Primary Audiences',
        value: String(segments.primary.length),
        meta: 'Core production personas',
        accent: '#16A34A',
        icon: Target,
        bars: sparkBars(segments.primary.length),
      },
      {
        label: 'Secondary Audiences',
        value: String(segments.secondary.length),
        meta: 'Adjacent reach personas',
        accent: '#0284C7',
        icon: UsersRound,
        bars: sparkBars(segments.secondary.length),
      },
      {
        label: 'Excluded Audiences',
        value: String(segments.excluded.length),
        meta: 'Governance-gated segments',
        accent: '#DC2626',
        icon: ShieldAlert,
        bars: sparkBars(segments.excluded.length),
      },
      {
        label: 'Validation Score',
        value: `${validationScore}%`,
        meta: `${validated} ACTIVE / READY`,
        accent: '#7C3AED',
        icon: CheckCircle2,
        bars: sparkBars(validationScore),
      },
      {
        label: 'Audience Readiness',
        value: `${overview?.readiness ?? avgCoverage}%`,
        meta: avgCoverage ? `Avg profile fill ${avgCoverage}%` : 'Stage 01 package',
        accent: '#D97706',
        icon: Gauge,
        bars: sparkBars(overview?.readiness ?? avgCoverage),
      },
    ],
    [
      records.length,
      segments.primary.length,
      segments.secondary.length,
      segments.excluded.length,
      validationScore,
      validated,
      overview?.readiness,
      avgCoverage,
    ],
  );

  const filtered = useMemo(
    () => filterAudienceRecords(records, query, filter),
    [records, query, filter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    records.find((item) => item.id === selectedId) ??
    null;
  const config = selected?.configuration ?? {};
  const selectedSegment = selected ? audienceSegment(selected) : 'unclassified';
  const selectedCoverage = selected ? profileCoverage(selected) : 0;
  const channels = splitList(configDisplay(config, 'channels'));
  const formats = splitList(configDisplay(config, 'formats'));

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
        <p className={styles.crumb}>Strategy & Fields / Audience Profiles</p>
        <h1 className={styles.title}>Audience Profiles</h1>
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
          <p className={styles.crumb}>Strategy & Fields / Audience Profiles</p>
          <h1 className={styles.title}>Audience Profiles</h1>
          <p className={styles.lede}>
            Autonomously discovered personas defining primary, secondary, and excluded audiences,
            their needs, channels, localisation requirements, and content-production readiness.
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
          Audience personas are generated and maintained automatically during Stage 01. This
          workspace provides segmentation, explainability, governance, and audit visibility only.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Audience KPI summary">
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

      <section className={styles.lifecycle} aria-label="Audience lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Audience lifecycle</h2>
          <span>
            {systemRunning
              ? 'Stage 01 running — audience discovery active'
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
              policyProfiles.length || records.length,
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
        <section className={styles.waiting} aria-label="Awaiting autonomous audience generation">
          <div className={styles.waitingIcon}>
            <UsersRound size={24} aria-hidden />
          </div>
          <h3>Awaiting Autonomous Audience Generation</h3>
          <p>
            Stage 01 has not yet generated audience personas. Primary, secondary, and excluded
            profiles appear automatically after global Start begins and audience discovery completes.
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
              Discover → Segment → Persist
            </div>
          </div>
          <div className={styles.ghostCards} aria-hidden>
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
          </div>
        </section>
      ) : null}

      {records.length && systemRunning && !policyProfiles.length ? (
        <section className={styles.infoNotice} role="status" aria-live="polite">
          <Timer size={16} aria-hidden />
          <div>
            <strong>Live generation in progress</strong>
            Stage 01 is reconciling audience personas. Explorer and intelligence panels update
            automatically as records persist.
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Audience Explorer">
          <div className={styles.panelHead}>
            <h2>Audience Explorer</h2>
            <p>
              {records.length} persisted
              {filtered.length !== records.length ? ` · ${filtered.length} shown` : ''} · auto-updating
            </p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search audiences, interests, channels…"
              aria-label="Search audience personas"
            />
            <div className={styles.chips} role="group" aria-label="Audience filters">
              {(
                [
                  ['all', 'All'],
                  ['primary', 'Primary'],
                  ['secondary', 'Secondary'],
                  ['excluded', 'Excluded'],
                  ['unclassified', 'Unclassified'],
                  ['validated', 'Validated'],
                  ['thin_profile', 'Thin profile'],
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
                const segment = audienceSegment(record);
                const coverage = profileCoverage(record);
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
                        <span className={`${styles.pill} ${statusTone(segment)}`}>
                          {segmentLabel(segment)}
                        </span>
                        <span className={styles.pill}>{coverage}% fill</span>
                        <span className={styles.pill}>P{record.priority}</span>
                        <span className={styles.pill}>UNMEASURED conf.</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.empty}>
              <h3>{systemRunning ? 'Discovery in progress' : 'No matching personas'}</h3>
              <p>
                {systemRunning
                  ? 'Audience discovery is reconciling personas. This explorer updates automatically.'
                  : 'Adjust filters or wait for Stage 01 to materialise audience profiles.'}
              </p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Audience Intelligence">
          <div className={styles.panelHead}>
            <h2>{selected?.name || 'Audience Intelligence'}</h2>
            <p>Explainable persona, segmentation, and governance for the selected system-owned audience.</p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Audience tabs">
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
                <h3>No persona selected</h3>
                <p>Persisted personas are selected automatically when Stage 01 completes.</p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Persona identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Persona name</span>
                      <strong>{display(selected.name)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>System key</span>
                      <strong>{display(configDisplay(config, 'systemKey'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Segment</span>
                      <strong>{segmentLabel(selectedSegment)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Interest group</span>
                      <strong>{display(configDisplay(config, 'interestGroup'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Status</span>
                      <strong>{display(selected.status)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Priority / business value</span>
                      <strong>{selected.priority}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Sensitivity</span>
                      <strong>{display(configDisplay(config, 'sensitivityTolerance'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Owning agent</span>
                      <strong>Audience Discovery Agent</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Executive summary</h3>
                  <p>{display(selected.description)}</p>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Persona health</h3>
                  <div className={styles.scoreRow}>
                    {[
                      ['Profile fill', selectedCoverage],
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
                    Engagement score, audience value indices, and confidence remain UNMEASURED until
                    Research & Evidence publishes verified audience packages.
                  </p>
                </article>
              </>
            ) : null}

            {selected && tab === 'demographics' ? (
              <article className={styles.sectionCard}>
                <h3>Demographics & reach context</h3>
                <div className={styles.groupList}>
                  {[...WHO_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'psychographics' ? (
              <article className={styles.sectionCard}>
                <h3>Goals, needs, and motivations</h3>
                <div className={styles.groupList}>
                  {[...NEEDS_FIELDS, 'preferredTone' as const, 'sensitivityTolerance' as const].map(
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

            {selected && tab === 'behaviour' ? (
              <article className={styles.sectionCard}>
                <h3>Behaviour & interests</h3>
                <div className={styles.groupList}>
                  {(
                    [
                      'viewingBehaviour',
                      'engagementObjectives',
                      'duration',
                      'deviceBandwidth',
                      'interestGroup',
                      'questions',
                    ] as const
                  ).map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'channels' ? (
              <article className={styles.sectionCard}>
                <h3>Channels, formats & platforms</h3>
                <div className={styles.groupList}>
                  {[...REACH_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
                <div className={styles.countryChips} style={{ marginTop: 12 }}>
                  {formats.map((item) => (
                    <span key={item} className={styles.countryChip}>
                      {item}
                    </span>
                  ))}
                  {channels.map((item) => (
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
                  <h3>Why this persona exists</h3>
                  <p>
                    Generated by the Audience Discovery Agent to define {segmentLabel(selectedSegment).toLowerCase()}{' '}
                    coverage for Stage 01 content production
                    {configDisplay(config, 'interestGroup')
                      ? ` around ${configDisplay(config, 'interestGroup')}`
                      : ''}
                    .
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
                      <span>Segment</span>
                      <strong>{segmentLabel(selectedSegment)}</strong>
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
                  <h3>Governance & ethics</h3>
                  <div className={styles.groupList}>
                    {[...SUCCESS_FIELDS].map((key) => (
                      <div key={key} className={styles.groupItem}>
                        <span>{fieldLabel(key)}</span>
                        <b>{display(configDisplay(config, key))}</b>
                      </div>
                    ))}
                    <div className={styles.groupItem}>
                      <span>Accessibility / privacy posture</span>
                      <b>{display(configDisplay(config, 'accessibilityNeeds'))}</b>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'dependencies' ? (
              <article className={styles.sectionCard}>
                <h3>Downstream and peer links</h3>
                <div className={styles.depChain}>
                  {['objectives', 'domains', 'taxonomy', 'geographies', 'formats', 'channels', 'localisation'].map(
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
                    <span>Thin profiles</span>
                    <b>{issues.thinProfiles.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Overlapping interest groups</span>
                    <b>{issues.overlapping.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Duplicate name/segment</span>
                    <b>{issues.duplicates.length}</b>
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
                      <strong>Persona materialisation</strong>
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
            <strong>{selected ? segmentLabel(selectedSegment) : '—'}</strong>
            <span className={`${styles.badge} ${styles.toneAi}`}>
              <BrainCircuit size={12} aria-hidden /> Audience agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Confidence</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Engagement score</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Audience value</span>
              <b>{selected ? `P${selected.priority}` : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Coverage fill</span>
              <b>{selected ? `${selectedCoverage}%` : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Linked domains</span>
              <b>Stage 01 peer</b>
            </div>
            <div className={styles.insightRow}>
              <span>Linked objectives</span>
              <b>Stage 01 peer</b>
            </div>
            <div className={styles.insightRow}>
              <span>Detected issues</span>
              <b>{issues.issueCount}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Subtitle</span>
              <b>{selected ? audienceSubtitle(selected) : '—'}</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>Recommendations</h3>
            <ul>
              <li>
                {issues.thinProfiles.length
                  ? `Enrich ${issues.thinProfiles.length} thin persona(s) with missing attributes.`
                  : 'Persona attribute fill is above the thin-profile threshold.'}
              </li>
              <li>
                {issues.overlapping.length
                  ? `Review ${issues.overlapping.length} overlapping interest-group assignment(s).`
                  : 'No overlapping interest groups across segments detected.'}
              </li>
              <li>
                {selectedSegment === 'excluded'
                  ? 'Keep excluded audience behind elevated governance and channel gates.'
                  : 'Align formats and channels with localisation and geography peers before handoff.'}
              </li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Audience health axes">
            {[
              ['Coverage', selectedCoverage],
              ['Priority', selected?.priority ?? 0],
              ['Channels', channels.length ? Math.min(100, channels.length * 25) : 0],
              ['Formats', formats.length ? Math.min(100, formats.length * 25) : 0],
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
                  <strong>Audience persistence</strong>
                  <p>
                    {records.length} personas · {segments.primary.length} primary ·{' '}
                    {segments.secondary.length} secondary · {segments.excluded.length} excluded
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
              <span>Personas discovered</span>
              <b>{records.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Activity size={12} aria-hidden /> Agent
              </span>
              <b>Audience Discovery</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Crosshair size={12} aria-hidden /> Unclassified
              </span>
              <b>{segments.unclassified.length}</b>
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
