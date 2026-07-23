'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Crosshair,
  MessageSquareHeart,
  ShieldAlert,
  Target,
  Users,
  UsersRound,
} from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  audienceFieldGroups,
  audienceSegment,
  configDisplay,
  fieldLabel,
  filterAudienceRecords,
  groupAudiencesBySegment,
  isAudiencePolicyProfile,
  isAudienceStub,
  segmentLabel,
  type AudienceFilter,
  type AudienceSegment,
} from '@/apps/web/lib/strategy-audiences';
import styles from './audiences.module.css';

const SEGMENTS: AudienceSegment[] = ['primary', 'secondary', 'excluded', 'unclassified'];

const LANE_CLASS: Record<AudienceSegment, string> = {
  primary: styles.lanePrimary,
  secondary: styles.laneSecondary,
  excluded: styles.laneExcluded,
  unclassified: styles.laneUnclassified,
};

const PANEL_ICONS = {
  who: Users,
  needs: MessageSquareHeart,
  reach: Crosshair,
  success: Target,
} as const;

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'RUNNING':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'EMERGENCY_STOP':
      return styles.toneBlocked;
    case 'IN_REVIEW':
    case 'PAUSED':
    case 'QUEUED':
      return styles.toneWarning;
    case 'STOPPED':
    case 'UNAVAILABLE':
      return styles.toneIdle;
    case 'DRAFT':
    default:
      return styles.toneDraft;
  }
}

function relativeRefresh(iso: string | null, now: number) {
  if (!iso) return '—';
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function FieldValue({ value }: { value: string }) {
  if (!value.trim()) return <span className={styles.notSet}>Not set</span>;
  return <p>{value}</p>;
}

export function AudiencesWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AudienceFilter>('all');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const systemRunning = systemState === 'RUNNING';
  const groups = useMemo(() => audienceFieldGroups(), []);

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
      setLastLoadedAt(new Date().toISOString());
      if (!next.available || !next.versionId) {
        setRecords([]);
        setSelectedId(null);
        return;
      }
      const list = (await strategyApi.list(next.versionId, 'audiences')).filter(
        (record) => record.status !== 'ARCHIVED',
      );
      setRecords(list);
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

  useEffect(() => {
    const onControlChanged = () => void load(selectedId);
    window.addEventListener('cacsms:system-control-changed', onControlChanged);
    return () => window.removeEventListener('cacsms:system-control-changed', onControlChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const filtered = useMemo(
    () => filterAudienceRecords(records, query, filter),
    [records, query, filter],
  );

  const lanes = useMemo(() => groupAudiencesBySegment(filtered), [filtered]);

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    records.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const segmentCounts = useMemo(() => {
    const all = groupAudiencesBySegment(records);
    return {
      primary: all.primary.length,
      secondary: all.secondary.length,
      excluded: all.excluded.length,
      unclassified: all.unclassified.length,
    };
  }, [records]);

  const policyProfiles = records.filter(isAudiencePolicyProfile);
  const policyReady = policyProfiles.length > 0;

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
      };

  if (busy && !overview) {
    return (
      <main className={styles.page}>
        <div className={styles.skeletonHero} />
        <div className={styles.skeletonBoard}>
          <div className={styles.skeletonLane} />
          <div className={styles.skeletonLane} />
          <div className={styles.skeletonLane} />
          <div className={styles.skeletonLane} />
        </div>
        <div className={styles.skeletonSheet} />
      </main>
    );
  }

  if (error || !overview?.available) {
    return (
      <main className={styles.page}>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Strategy service unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.hero}>
        <p className={styles.crumb}>
          Strategy & Fields
          <span aria-hidden> / </span>
          Audience Profiles
        </p>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>Audience Profiles</h1>
            <p className={styles.lede}>
              Segment board for primary, secondary, and excluded audiences. Stage 01 writes persona
              records while Running — this page is observe-only.
            </p>
          </div>
          <div className={styles.badges}>
            <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
            <span className={`${styles.badge} ${statusTone(overview.status)}`}>{overview.status}</span>
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.opsLine} aria-label="Audience operations summary">
          <span>
            System <strong data-state={systemState}>{systemState.replaceAll('_', ' ')}</strong>
          </span>
          <span className={styles.opsSep} aria-hidden>
            ·
          </span>
          <span>
            Stage 01{' '}
            <strong>{policyReady ? 'Policy reconciled' : systemRunning ? 'Reconciling…' : 'Idle'}</strong>
          </span>
          <span className={styles.opsSep} aria-hidden>
            ·
          </span>
          <span>
            Personas <strong>{policyProfiles.length || records.length}</strong>
          </span>
          <span className={styles.opsSep} aria-hidden>
            ·
          </span>
          <span>
            Primary <strong>{segmentCounts.primary}</strong>
          </span>
          <span className={styles.opsSep} aria-hidden>
            ·
          </span>
          <span>
            Secondary <strong>{segmentCounts.secondary}</strong>
          </span>
          <span className={styles.opsSep} aria-hidden>
            ·
          </span>
          <span>
            Excluded <strong>{segmentCounts.excluded}</strong>
          </span>
          <span className={styles.opsSep} aria-hidden>
            ·
          </span>
          <span>
            Last refresh <strong>{relativeRefresh(lastLoadedAt, now)}</strong>
          </span>
        </div>

        <p className={styles.notice}>
          {policyReady
            ? 'Observe-only segment board. Stage 01 has reconciled primary, secondary, and excluded audience policy. Global control stays in the top bar.'
            : systemRunning
              ? 'System is Running. Stage 01 is reconciling audience policy into persona lanes. This board updates automatically.'
              : 'System is idle. Global Start runs Stage 01 autonomy to materialise audience personas here. No human form input on this page.'}
        </p>

        <div className={styles.toolbar}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search audiences, interests, channels, outcomes…"
            aria-label="Search audience profiles"
          />
          <div className={styles.chips} role="group" aria-label="Segment filters">
            {(
              [
                ['all', 'All'],
                ['primary', 'Primary'],
                ['secondary', 'Secondary'],
                ['excluded', 'Excluded'],
                ['unclassified', 'Unclassified'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`${styles.chip} ${filter === value ? styles.chipActive : ''}`}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length ? (
          <div className={styles.board} aria-label="Audience segment board">
            {SEGMENTS.map((segment) => {
              const laneRecords = lanes[segment];
              return (
                <section
                  key={segment}
                  className={`${styles.lane} ${LANE_CLASS[segment]}`}
                  aria-label={`${segmentLabel(segment)} audiences`}
                >
                  <div className={styles.laneHead}>
                    <h2>{segmentLabel(segment)}</h2>
                    <span>{laneRecords.length}</span>
                  </div>
                  <div className={styles.laneBody}>
                    {laneRecords.length ? (
                      laneRecords.map((record) => {
                        const config = record.configuration ?? {};
                        const active = record.id === selectedId;
                        const stub = isAudienceStub(record);
                        const policy = isAudiencePolicyProfile(record);
                        const interest = configDisplay(config, 'interestGroup');
                        const age = configDisplay(config, 'ageRange');
                        const languages = configDisplay(config, 'languages');
                        return (
                          <button
                            key={record.id ?? record.name}
                            type="button"
                            className={`${styles.persona} ${active ? styles.personaSelected : ''}`}
                            aria-pressed={active}
                            onClick={() => setSelectedId(record.id ?? null)}
                          >
                            <div className={styles.personaTop}>
                              <h3 className={styles.personaName}>{record.name}</h3>
                              <span className={`${styles.badge} ${statusTone(record.status)}`}>
                                {record.status}
                              </span>
                            </div>
                            <p className={styles.personaMeta}>
                              {record.description?.trim() ||
                                (stub ? 'Baseline audience stub' : 'Audience persona')}
                            </p>
                            <div className={styles.tagRow}>
                              {interest ? (
                                <span className={styles.tag}>{interest}</span>
                              ) : (
                                <span className={styles.notSet}>Interest not set</span>
                              )}
                              {age ? <span className={styles.tag}>{age}</span> : null}
                              {languages ? <span className={styles.tag}>{languages}</span> : null}
                              {policy ? <span className={styles.stubChip}>System policy</span> : null}
                              {stub ? <span className={styles.stubChip}>Baseline stub</span> : null}
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <p className={styles.laneEmpty}>No personas in this lane</p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyBoard}>
            <UsersRound size={36} aria-hidden color="#4338ca" />
            <h3>{systemRunning ? 'Awaiting Stage 01 audience reconcile' : 'Audience board not started'}</h3>
            <p>
              {systemRunning
                ? 'Stage 01 is writing audience policy personas into segment lanes. This board refreshes automatically.'
                : 'Start the system from the top bar. Stage 01 autonomy reconciles primary, secondary, and excluded personas here.'}
            </p>
          </div>
        )}

        {selected ? (
          <section className={styles.sheet} aria-label="Selected audience persona sheet">
            <div className={styles.sheetHead}>
              <div>
                <h2>{selected.name}</h2>
                <p>
                  {segmentLabel(audienceSegment(selected))} audience
                  {selected.description ? ` — ${selected.description}` : ''}
                </p>
              </div>
              <span className={`${styles.badge} ${statusTone(selected.status)}`}>
                {selected.status}
              </span>
            </div>

            <div className={styles.sheetGrid}>
              {groups.map((group) => {
                const Icon = PANEL_ICONS[group.id];
                const config = selected.configuration ?? {};
                return (
                  <article key={group.id} className={styles.panel}>
                    <div className={styles.panelHead}>
                      <Icon size={16} aria-hidden />
                      <h3>{group.label}</h3>
                    </div>
                    <div className={styles.fieldList}>
                      {group.fields.map((key) => (
                        <div key={key} className={styles.fieldRow}>
                          <span>{fieldLabel(key)}</span>
                          <FieldValue value={configDisplay(config, key)} />
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className={styles.provenance}>
              <span>
                Segment <strong>{segmentLabel(audienceSegment(selected))}</strong>
              </span>
              <span>
                Origin <strong>{configDisplay(selected.configuration, 'origin') || '—'}</strong>
              </span>
              <span>
                System key{' '}
                <strong>{configDisplay(selected.configuration, 'systemKey') || '—'}</strong>
              </span>
              <span>
                Priority <strong>{selected.priority}</strong>
              </span>
              {isAudienceStub(selected) ? (
                <span>
                  Note <strong>Baseline stub — not a fabricated persona set</strong>
                </span>
              ) : null}
            </div>
          </section>
        ) : null}

        <p className={styles.footerHint}>
          Observe-only segment board. Lanes use persisted audience tier/type fields when present;
          otherwise profiles stay Unclassified. Global Start / Stop remain in the top bar.
        </p>
      </div>
    </motion.main>
  );
}
