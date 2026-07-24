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
  Languages,
  Map as MapIcon,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  configDisplay,
  CONSTRAINT_FIELDS,
  continentHint,
  coverageScore,
  CULTURE_FIELDS,
  fieldLabel,
  filterGeographyRecords,
  geographyIssues,
  geographySubtitle,
  hasCountry,
  isGeographyPolicyProfile,
  isGeographyStub,
  PLACE_FIELDS,
  splitList,
  uniqueCountries,
  uniqueLanguages,
  uniqueRegions,
  type GeographyFilter,
} from '@/apps/web/lib/strategy-geographies';
import styles from './geographies-intel.module.css';

type TabId =
  | 'overview'
  | 'coverage'
  | 'culture'
  | 'reasoning'
  | 'compliance'
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
  { id: 'coverage', label: 'Regional Coverage' },
  { id: 'culture', label: 'Cultural & Language' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'compliance', label: 'Compliance & Restrictions' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'discover', label: 'Discover', icon: Compass },
  { key: 'validate', label: 'Validate', icon: CheckCircle2 },
  { key: 'localize', label: 'Localize', icon: Languages },
  { key: 'policy', label: 'Policy Check', icon: ShieldCheck },
  { key: 'risk', label: 'Risk Review', icon: AlertTriangle },
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
    return index <= 6 ? 'done' : 'pending';
  }
  if ((profileCount ?? 0) > 0) {
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

export function GeographiesWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GeographyFilter>('all');
  const [tab, setTab] = useState<TabId>('overview');
  const [continent, setContinent] = useState<string | null>(null);
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
        strategyApi.list(next.versionId, 'geographies'),
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

  const policyProfiles = useMemo(() => records.filter(isGeographyPolicyProfile), [records]);
  const issues = useMemo(() => geographyIssues(records), [records]);
  const countries = useMemo(() => uniqueCountries(records), [records]);
  const regions = useMemo(() => uniqueRegions(records), [records]);
  const languages = useMemo(() => uniqueLanguages(records), [records]);
  const validated = records.filter((item) => item.status === 'ACTIVE' || item.status === 'READY').length;
  const avgCoverage = records.length
    ? Math.round(records.reduce((sum, item) => sum + coverageScore(item), 0) / records.length)
    : 0;

  const kpis = useMemo(
    () => [
      {
        label: 'Countries',
        value: String(countries.length),
        meta: 'Distinct country values',
        accent: '#2563EB',
        icon: Globe2,
        bars: sparkBars(countries.length),
      },
      {
        label: 'Regions',
        value: String(regions.length),
        meta: 'Distinct regional labels',
        accent: '#0284C7',
        icon: MapIcon,
        bars: sparkBars(regions.length),
      },
      {
        label: 'Languages',
        value: String(languages.length),
        meta: 'Supported language entries',
        accent: '#7C3AED',
        icon: Languages,
        bars: sparkBars(languages.length),
      },
      {
        label: 'Cultural Profiles',
        value: String(policyProfiles.length),
        meta: 'System geography profiles',
        accent: '#0F766E',
        icon: BookOpen,
        bars: sparkBars(policyProfiles.length),
      },
      {
        label: 'Validated Profiles',
        value: String(validated),
        meta: 'ACTIVE / READY records',
        accent: '#16A34A',
        icon: CheckCircle2,
        bars: sparkBars(validated),
      },
      {
        label: 'Coverage Readiness',
        value: `${overview?.readiness ?? avgCoverage}%`,
        meta: avgCoverage ? `Avg field fill ${avgCoverage}%` : 'Stage 01 package',
        accent: '#D97706',
        icon: Gauge,
        bars: sparkBars(overview?.readiness ?? avgCoverage),
      },
    ],
    [countries.length, regions.length, languages.length, policyProfiles.length, validated, overview?.readiness, avgCoverage],
  );

  const filtered = useMemo(
    () => filterGeographyRecords(records, query, filter),
    [records, query, filter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    records.find((item) => item.id === selectedId) ??
    null;
  const config = selected?.configuration ?? {};
  const selectedCoverage = selected ? coverageScore(selected) : 0;
  const selectedLanguages = splitList(configDisplay(config, 'supportedLanguages'));

  const continentBuckets = useMemo(() => {
    const map = new Map<string, StrategyRecord[]>();
    for (const record of policyProfiles.length ? policyProfiles : records) {
      const country = configDisplay(record.configuration, 'country');
      const key = continentHint(country);
      const bucket = map.get(key) ?? [];
      bucket.push(record);
      map.set(key, bucket);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [policyProfiles, records]);

  const mapProfiles = useMemo(() => {
    if (!continent) return continentBuckets.flatMap(([, list]) => list);
    return continentBuckets.find(([name]) => name === continent)?.[1] ?? [];
  }, [continent, continentBuckets]);

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
        <p className={styles.crumb}>Strategy & Fields / Country & Regional Profiles</p>
        <h1 className={styles.title}>Country & Regional Profiles</h1>
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
          <p className={styles.crumb}>Strategy & Fields / Country & Regional Profiles</p>
          <h1 className={styles.title}>Country & Regional Profiles</h1>
          <p className={styles.lede}>
            Autonomously generated geographic intelligence defining authenticity policy, cultural
            safeguards, localisation boundaries, and publishing readiness across CACSMS operating
            regions.
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
          Geography profiles are reconciled automatically during Stage 01. This workspace provides
          atlas exploration, cultural explainability, compliance, and audit visibility only.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Geography KPI summary">
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

      <section className={styles.lifecycle} aria-label="Geography lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Geography lifecycle</h2>
          <span>
            {systemRunning
              ? 'Stage 01 running — geography discovery active'
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
        <section className={styles.waiting} aria-label="Awaiting autonomous geography generation">
          <div className={styles.waitingIcon}>
            <Globe2 size={24} aria-hidden />
          </div>
          <h3>Awaiting Autonomous Atlas Generation</h3>
          <p>
            Stage 01 has not yet generated country and regional profiles. The atlas appears
            automatically after global Start begins and geography discovery completes.
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
              Discover → Validate → Persist
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
            Stage 01 is reconciling geography profiles. Explorer and atlas update automatically as
            records persist.
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Geography Explorer">
          <div className={styles.panelHead}>
            <h2>Geography Explorer</h2>
            <p>
              {records.length} persisted
              {filtered.length !== records.length ? ` · ${filtered.length} shown` : ''} · auto-updating
            </p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search countries, regions, languages…"
              aria-label="Search geography profiles"
            />
            <div className={styles.chips} role="group" aria-label="Geography filters">
              {(
                [
                  ['all', 'All'],
                  ['with_country', 'With country'],
                  ['validated', 'Validated'],
                  ['thin_culture', 'Thin culture'],
                  ['missing_coverage', 'Missing coverage'],
                  ['stub_only', 'Stub only'],
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
                const score = coverageScore(record);
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
                        <span className={styles.pill}>{geographySubtitle(record)}</span>
                        <span className={styles.pill}>{score}% coverage</span>
                        <span className={styles.pill}>
                          {isGeographyStub(record) ? 'Stub' : 'Policy'}
                        </span>
                        <span className={styles.pill}>UNMEASURED conf.</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.empty}>
              <h3>{systemRunning ? 'Discovery in progress' : 'No matching profiles'}</h3>
              <p>
                {systemRunning
                  ? 'Geography discovery is reconciling profiles. This explorer updates automatically.'
                  : 'Adjust filters or wait for Stage 01 to materialise geography profiles.'}
              </p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Geography Intelligence">
          <div className={styles.panelHead}>
            <h2>{selected?.name || 'Geography Intelligence'}</h2>
            <p>Explainable regional authenticity, culture, and compliance for the selected profile.</p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Geography tabs">
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
                <h3>No profile selected</h3>
                <p>Persisted geography profiles are selected automatically when Stage 01 completes.</p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Profile name</span>
                      <strong>{display(selected.name)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>System key</span>
                      <strong>{display(configDisplay(config, 'systemKey'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Country</span>
                      <strong>{display(configDisplay(config, 'country'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Region</span>
                      <strong>{display(configDisplay(config, 'region'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>State / province</span>
                      <strong>{display(configDisplay(config, 'state'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Time zone</span>
                      <strong>{display(configDisplay(config, 'timeZone'))}</strong>
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
                      <span>Continent hint</span>
                      <strong>{continentHint(configDisplay(config, 'country'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Owning agent</span>
                      <strong>Geography Discovery Agent</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Executive summary</h3>
                  <p>{display(selected.description)}</p>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Profile health</h3>
                  <div className={styles.scoreRow}>
                    {[
                      ['Coverage fill', selectedCoverage],
                      ['Priority', selected.priority],
                      ['Package readiness', overview.readiness ?? 0],
                      ['Language entries', Math.min(100, selectedLanguages.length * 20)],
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
                    Confidence and freshness remain UNMEASURED until Research & Evidence publishes
                    verified regional scores.
                  </p>
                </article>
              </>
            ) : null}

            {selected && tab === 'coverage' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Interactive atlas</h3>
                  <div className={styles.mapPanel}>
                    <div className={styles.mapBoard}>
                      <h4>Continent drill-down</h4>
                      <div className={styles.continentGrid}>
                        <button
                          type="button"
                          className={`${styles.continentCard} ${!continent ? styles.continentCardActive : ''}`}
                          onClick={() => setContinent(null)}
                        >
                          <strong>All regions</strong>
                          <span>{continentBuckets.reduce((n, [, list]) => n + list.length, 0)} profiles</span>
                        </button>
                        {continentBuckets.map(([name, list]) => (
                          <button
                            key={name}
                            type="button"
                            className={`${styles.continentCard} ${continent === name ? styles.continentCardActive : ''}`}
                            onClick={() => setContinent(name)}
                          >
                            <strong>{name}</strong>
                            <span>{list.length} profile{list.length === 1 ? '' : 's'}</span>
                          </button>
                        ))}
                      </div>
                      <div className={styles.countryChips}>
                        {mapProfiles.map((profile) => (
                          <button
                            key={profile.id}
                            type="button"
                            className={`${styles.countryChip} ${profile.id === selectedId ? styles.countryChipActive : ''}`}
                            onClick={() => setSelectedId(profile.id ?? null)}
                          >
                            {configDisplay(profile.configuration, 'country') || profile.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={styles.mapDetail}>
                      <h4>Selected place detail</h4>
                      <div className={styles.groupList}>
                        {[...PLACE_FIELDS].map((key) => (
                          <div key={key} className={styles.groupItem}>
                            <span>{fieldLabel(key)}</span>
                            <b>{display(configDisplay(config, key))}</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'culture' ? (
              <article className={styles.sectionCard}>
                <h3>Cultural & language intelligence</h3>
                <div className={styles.groupList}>
                  {[...CULTURE_FIELDS, 'supportedLanguages' as const].map((key) => (
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
                  <h3>Why this geography exists</h3>
                  <p>
                    Generated by the Geography Discovery Agent to anchor Stage 01 authenticity and
                    localisation policy for {display(configDisplay(config, 'country') || selected.name)}.
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
                      <span>Priority</span>
                      <strong>{selected.priority}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Confidence</span>
                      <strong>UNMEASURED</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Related objectives / domains</span>
                      <strong>Stage 01 package peers</strong>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'compliance' ? (
              <article className={styles.sectionCard}>
                <h3>Compliance & restrictions</h3>
                <div className={styles.groupList}>
                  {[...CONSTRAINT_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
                <p style={{ marginTop: 12, color: 'var(--muted)' }}>
                  Quantitative risk scores remain UNMEASURED. Governance uses persisted constraint
                  text and package status only.
                </p>
              </article>
            ) : null}

            {selected && tab === 'dependencies' ? (
              <article className={styles.sectionCard}>
                <h3>Downstream and peer links</h3>
                <div className={styles.depChain}>
                  {['objectives', 'domains', 'taxonomy', 'audiences', 'localisation', 'channels', 'formats'].map(
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
                    <span>Detected issues on atlas</span>
                    <b>{issues.issueCount}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Missing coverage profiles</span>
                    <b>{issues.missingCoverage.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Thin culture profiles</span>
                    <b>{issues.thinCulture.length}</b>
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
                      <strong>Geography materialisation</strong>
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
              <BrainCircuit size={12} aria-hidden /> Geography agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Coverage score</span>
              <b>{selected ? `${selectedCoverage}%` : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Confidence</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Freshness</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Risk</span>
              <b>
                {configDisplay(config, 'restrictedSubjects') || configDisplay(config, 'sensitiveSubjects')
                  ? 'Policy-gated'
                  : 'UNMEASURED'}
              </b>
            </div>
            <div className={styles.insightRow}>
              <span>Supported languages</span>
              <b>{selectedLanguages.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Related audiences</span>
              <b>Stage 01 peer</b>
            </div>
            <div className={styles.insightRow}>
              <span>Linked domains</span>
              <b>Stage 01 peer</b>
            </div>
            <div className={styles.insightRow}>
              <span>Detected issues</span>
              <b>{issues.issueCount}</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>Recommendations</h3>
            <ul>
              <li>
                {issues.missingCoverage.length
                  ? `Resolve ${issues.missingCoverage.length} profile(s) missing country coverage.`
                  : 'All non-stub profiles declare a country value.'}
              </li>
              <li>
                {issues.thinCulture.length
                  ? `Enrich ${issues.thinCulture.length} profile(s) with cultural context fields.`
                  : 'Cultural fields are present on policy profiles.'}
              </li>
              <li>
                {selected && hasCountry(selected)
                  ? 'Keep localisation and channel targeting aligned to this geography.'
                  : 'Wait for Stage 01 to attach a country before localisation handoff.'}
              </li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Geography health axes">
            {[
              ['Coverage', selectedCoverage],
              ['Priority', selected?.priority ?? 0],
              ['Languages', selectedLanguages.length ? Math.min(100, selectedLanguages.length * 20) : 0],
              ['Constraints', selected ? Math.min(100, splitList(configDisplay(config, 'restrictedSubjects')).length * 25 + 40) : 0],
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
                  <strong>Geography persistence</strong>
                  <p>
                    {records.length} profiles · {countries.length} countries · {regions.length}{' '}
                    regions
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
              <span>Profiles discovered</span>
              <b>{records.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Activity size={12} aria-hidden /> Agent
              </span>
              <b>Geography Discovery</b>
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
