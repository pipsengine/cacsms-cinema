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
  Globe2,
  Languages,
  ShieldAlert,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  ADAPTATION_LADDER,
  configDisplay,
  CULTURE_FIELDS,
  familyLabel,
  familyShort,
  fieldLabel,
  filterLocalisationRecords,
  isHubLocale,
  isLocalisationPolicyKit,
  isLocalisationStub,
  ladderCompletion,
  LANGUAGE_PACK_FIELDS,
  languageStack,
  localisationCoverage,
  localisationIssues,
  localisationSubtitle,
  localeFamily,
  REGIONAL_FIELDS,
  requiresHumanReview,
  TRANSLATION_FIELDS,
  uniqueLanguages,
  uniqueRegions,
  type LocalisationFilter,
} from '@/apps/web/lib/strategy-localisation';
import styles from './localisation-intel.module.css';

type TabId =
  | 'overview'
  | 'packs'
  | 'regional'
  | 'translation'
  | 'culture'
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
  { id: 'packs', label: 'Language Packs' },
  { id: 'regional', label: 'Regional Adaptation' },
  { id: 'translation', label: 'Translation Rules' },
  { id: 'culture', label: 'Cultural & Compliance' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'discover', label: 'Discover', icon: Compass },
  { key: 'translate', label: 'Translate', icon: Languages },
  { key: 'localise', label: 'Localise', icon: Globe2 },
  { key: 'validate', label: 'Validate', icon: CheckCircle2 },
  { key: 'culture', label: 'Cultural Review', icon: ShieldAlert },
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
    case 'english':
    case 'hub':
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
    case 'hausa':
    case 'yoruba':
    case 'igbo':
    case 'pidgin':
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
  kitCount?: number,
) {
  if ((kitCount ?? 0) > 0 && (versionStatus === 'ACTIVE' || versionStatus === 'READY')) {
    return 'done';
  }
  if ((kitCount ?? 0) > 0) {
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

export function LocalisationWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LocalisationFilter>('all');
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
        strategyApi.list(next.versionId, 'localisation'),
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

  const policyKits = useMemo(() => records.filter(isLocalisationPolicyKit), [records]);
  const issues = useMemo(() => localisationIssues(records), [records]);
  const languages = useMemo(() => uniqueLanguages(records), [records]);
  const regions = useMemo(() => uniqueRegions(records), [records]);
  const validated = records.filter((item) => item.status === 'ACTIVE' || item.status === 'READY').length;
  const avgCoverage = records.length
    ? Math.round(records.reduce((sum, item) => sum + localisationCoverage(item), 0) / records.length)
    : 0;
  const pendingTasks =
    issues.thinPacks.length +
    issues.missingTranslation.length +
    issues.missingCulture.length +
    issues.reviewRequired.length;

  const kpis = useMemo(
    () => [
      {
        label: 'Supported Languages',
        value: String(languages.length),
        meta: 'Distinct language entries',
        accent: '#2563EB',
        icon: Languages,
        bars: sparkBars(languages.length),
      },
      {
        label: 'Locales',
        value: String(policyKits.length || records.length),
        meta: 'Persisted localisation kits',
        accent: '#0284C7',
        icon: Globe2,
        bars: sparkBars(policyKits.length || records.length),
      },
      {
        label: 'Translation Coverage',
        value: `${avgCoverage}%`,
        meta: 'Average pack field fill',
        accent: '#0F766E',
        icon: CheckCircle2,
        bars: sparkBars(avgCoverage),
      },
      {
        label: 'Localisation Readiness',
        value: `${overview?.readiness ?? avgCoverage}%`,
        meta: `${validated} ACTIVE / READY`,
        accent: '#D97706',
        icon: Gauge,
        bars: sparkBars(overview?.readiness ?? avgCoverage),
      },
      {
        label: 'AI Confidence',
        value: 'UNMEAS.',
        meta: 'No fabricated fluency scores',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(3),
      },
      {
        label: 'Pending Localisation Tasks',
        value: String(pendingTasks),
        meta: 'Thin packs / gaps / review',
        accent: pendingTasks ? '#DC2626' : '#16A34A',
        icon: AlertTriangle,
        bars: sparkBars(pendingTasks + 1),
      },
    ],
    [
      languages.length,
      policyKits.length,
      records.length,
      avgCoverage,
      overview?.readiness,
      validated,
      pendingTasks,
    ],
  );

  const explorerSource = useMemo(() => {
    const live = records.filter((record) => !isLocalisationStub(record));
    const policy = live.filter(isLocalisationPolicyKit);
    return policy.length > 0 ? policy : live.length > 0 ? live : records;
  }, [records]);

  const filtered = useMemo(
    () => filterLocalisationRecords(explorerSource, query, filter),
    [explorerSource, query, filter],
  );

  const hub = useMemo(
    () => explorerSource.find(isHubLocale) ?? policyKits.find(isHubLocale) ?? null,
    [explorerSource, policyKits],
  );
  const satellites = useMemo(
    () => explorerSource.filter((record) => !isHubLocale(record)),
    [explorerSource],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    records.find((item) => item.id === selectedId) ??
    null;
  const config = selected?.configuration ?? {};
  const selectedFamily = selected ? localeFamily(selected) : 'other';
  const selectedCoverage = selected ? localisationCoverage(selected) : 0;
  const selectedLadder = selected ? ladderCompletion(selected) : 0;
  const stack = selected ? languageStack(selected) : [];

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
        <p className={styles.crumb}>Strategy & Fields / Language & Localisation</p>
        <h1 className={styles.title}>Language & Localisation</h1>
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
          <p className={styles.crumb}>Strategy & Fields / Language & Localisation</p>
          <h1 className={styles.title}>Language & Localisation</h1>
          <p className={styles.lede}>
            Autonomously governed multilingual strategy defining language packs, translation rules,
            cultural adaptation, and global publishing readiness for CACSMS.
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
          Language packs and localisation kits are generated automatically during Stage 01. This
          workspace provides multilingual exploration, cultural governance, and audit visibility only.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Localisation KPI summary">
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

      <section className={styles.lifecycle} aria-label="Localisation lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Localisation lifecycle</h2>
          <span>
            {systemRunning
              ? 'Stage 01 running — locale discovery active'
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
              policyKits.length || records.length,
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
        <section className={styles.waiting} aria-label="Awaiting autonomous localisation generation">
          <div className={styles.waitingIcon}>
            <Languages size={24} aria-hidden />
          </div>
          <h3>Awaiting Autonomous Localisation Generation</h3>
          <p>
            Stage 01 has not yet generated language packs. The locale constellation appears
            automatically after global Start begins and localisation discovery completes.
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
              Discover → Translate → Persist
            </div>
          </div>
          <div className={styles.ghostCards} aria-hidden>
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
          </div>
        </section>
      ) : null}

      {records.length && systemRunning && !policyKits.length ? (
        <section className={styles.infoNotice} role="status" aria-live="polite">
          <Timer size={16} aria-hidden />
          <div>
            <strong>Live localisation generation in progress</strong>
            Stage 01 is reconciling language packs. Explorer and intelligence panels update
            automatically as records persist.
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Language Explorer">
          <div className={styles.panelHead}>
            <h2>Language Explorer</h2>
            <p>
              {explorerSource.length} kits
              {filtered.length !== explorerSource.length ? ` · ${filtered.length} shown` : ''} ·
              auto-updating
            </p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search languages, locales, regions…"
              aria-label="Search language packs"
            />
            <div className={styles.chips} role="group" aria-label="Localisation filters">
              {(
                [
                  ['all', 'All'],
                  ['hub', 'Hub'],
                  ['satellite', 'Satellite'],
                  ['english', 'English'],
                  ['hausa', 'Hausa'],
                  ['yoruba', 'Yoruba'],
                  ['igbo', 'Igbo'],
                  ['pidgin', 'Pidgin'],
                  ['review_required', 'Review'],
                  ['thin_pack', 'Thin'],
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
                const family = localeFamily(record);
                const coverage = localisationCoverage(record);
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
                        <span className={`${styles.pill} ${statusTone(family)}`}>
                          {familyShort(family)} · {familyLabel(family)}
                        </span>
                        <span className={styles.pill}>
                          {isHubLocale(record) ? 'Hub' : 'Satellite'}
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
              <h3>{systemRunning ? 'Discovery in progress' : 'No matching kits'}</h3>
              <p>
                {systemRunning
                  ? 'Localisation discovery is reconciling packs. This explorer updates automatically.'
                  : 'Adjust filters or wait for Stage 01 to materialise language packs.'}
              </p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Localisation Intelligence">
          <div className={styles.panelHead}>
            <h2>{selected?.name || 'Localisation Intelligence'}</h2>
            <p>Explainable language pack, translation, and cultural governance for the selected locale.</p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Localisation tabs">
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
                <h3>No language pack selected</h3>
                <p>Persisted kits are selected automatically when Stage 01 completes.</p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Locale identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Kit name</span>
                      <strong>{display(selected.name)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>System key</span>
                      <strong>{display(configDisplay(config, 'systemKey'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Family</span>
                      <strong>{familyLabel(selectedFamily)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Role</span>
                      <strong>{isHubLocale(selected) ? 'Hub' : 'Satellite'}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Primary language</span>
                      <strong>{display(configDisplay(config, 'primaryLanguage'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Status</span>
                      <strong>{display(selected.status)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Human review</span>
                      <strong>{requiresHumanReview(selected) ? 'Required' : 'As configured'}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Owning agent</span>
                      <strong>Localisation Agent</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Locale constellation</h3>
                  <p>{display(selected.description)}</p>
                  <div className={styles.localeMap} aria-label="Language map">
                    {hub ? (
                      <button
                        type="button"
                        className={`${styles.hubNode} ${hub.id === selectedId ? styles.hubNodeActive : ''}`}
                        onClick={() => setSelectedId(hub.id ?? null)}
                      >
                        <strong>{hub.name}</strong>
                        <span>
                          {familyShort(localeFamily(hub))} hub · P{hub.priority}
                        </span>
                      </button>
                    ) : (
                      <div className={styles.hubNode}>
                        <strong>No hub kit</strong>
                        <span>Awaiting EN hub persistence</span>
                      </div>
                    )}
                    <div className={styles.satGrid}>
                      {satellites.map((sat) => (
                        <button
                          key={sat.id}
                          type="button"
                          className={`${styles.satNode} ${sat.id === selectedId ? styles.satNodeActive : ''}`}
                          onClick={() => setSelectedId(sat.id ?? null)}
                        >
                          <strong>{sat.name}</strong>
                          <span>
                            {familyShort(localeFamily(sat))} · {localisationCoverage(sat)}%
                          </span>
                        </button>
                      ))}
                      {!satellites.length ? (
                        <div className={styles.satNode}>
                          <strong>No satellites yet</strong>
                          <span>Appear after Stage 01 reconcile</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.ladderRow} aria-label="Adaptation ladder">
                    {ADAPTATION_LADDER.map((step) => {
                      const done = Boolean(configDisplay(config, step.field).trim());
                      return (
                        <div key={step.id} className={styles.ladderStep} data-done={done}>
                          <strong>{step.label}</strong>
                          <span>{done ? 'Configured' : 'Pending'}</span>
                        </div>
                      );
                    })}
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Pack health</h3>
                  <div className={styles.scoreRow}>
                    {[
                      ['Pack fill', selectedCoverage],
                      ['Ladder', selectedLadder],
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
                    Translation quality and AI confidence remain UNMEASURED — no fabricated fluency
                    scores.
                  </p>
                </article>
              </>
            ) : null}

            {selected && tab === 'packs' ? (
              <article className={styles.sectionCard}>
                <h3>Language pack details</h3>
                <div className={styles.groupList}>
                  {[...LANGUAGE_PACK_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
                <div className={styles.countryChips} style={{ marginTop: 12 }}>
                  {stack.map((item) => (
                    <span key={item} className={styles.countryChip}>
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'regional' ? (
              <article className={styles.sectionCard}>
                <h3>Regional adaptation</h3>
                <div className={styles.groupList}>
                  {[...REGIONAL_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'translation' ? (
              <article className={styles.sectionCard}>
                <h3>Translation rules</h3>
                <div className={styles.groupList}>
                  {[...TRANSLATION_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'culture' ? (
              <article className={styles.sectionCard}>
                <h3>Cultural & compliance</h3>
                <div className={styles.groupList}>
                  {[...CULTURE_FIELDS].map((key) => (
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
                  <h3>Why this locale is supported</h3>
                  <p>
                    Generated by the Localisation Agent to define {familyLabel(selectedFamily)}{' '}
                    {isHubLocale(selected) ? 'hub' : 'satellite'} coverage for Stage 01 multilingual
                    publishing
                    {configDisplay(config, 'countryMappings')
                      ? ` across ${configDisplay(config, 'countryMappings')}`
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
                      <span>Locale family</span>
                      <strong>{familyLabel(selectedFamily)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Confidence</span>
                      <strong>UNMEASURED</strong>
                    </div>
                    <div className={styles.field}>
                      <span>MT threshold</span>
                      <strong>{display(configDisplay(config, 'machineTranslationThreshold'))}</strong>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'dependencies' ? (
              <article className={styles.sectionCard}>
                <h3>Downstream and peer links</h3>
                <div className={styles.depChain}>
                  {['objectives', 'geographies', 'audiences', 'formats', 'channels', 'editorial-policy'].map(
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
                    <span>Missing translation rules</span>
                    <b>{issues.missingTranslation.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Missing cultural adaptation</span>
                    <b>{issues.missingCulture.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Review-required kits</span>
                    <b>{issues.reviewRequired.length}</b>
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
                      <strong>Locale materialisation</strong>
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
            <strong>{selected ? familyShort(selectedFamily) : '—'}</strong>
            <span className={`${styles.badge} ${styles.toneAi}`}>
              <BrainCircuit size={12} aria-hidden /> Localisation agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Translation quality</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Localisation score</span>
              <b>{selected ? `${selectedCoverage}% fill` : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Supported regions</span>
              <b>{regions.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Linked audiences</span>
              <b>Stage 01 peer</b>
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
              <b>{selected ? localisationSubtitle(selected) : '—'}</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>Recommendations</h3>
            <ul>
              <li>
                {issues.missingTranslation.length
                  ? `Add translation rules to ${issues.missingTranslation.length} kit(s).`
                  : 'Translation rules are present on policy kits.'}
              </li>
              <li>
                {issues.missingCulture.length
                  ? `Complete cultural adaptation for ${issues.missingCulture.length} kit(s).`
                  : 'Cultural adaptation fields are populated on policy kits.'}
              </li>
              <li>
                Keep machine translation below the declared threshold and route review-required kits
                through human localisation.
              </li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Localisation health axes">
            {[
              ['Coverage', selectedCoverage],
              ['Ladder', selectedLadder],
              ['Priority', selected?.priority ?? 0],
              ['Languages', stack.length ? Math.min(100, stack.length * 20) : 0],
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
                  <strong>Localisation persistence</strong>
                  <p>
                    {policyKits.length || records.length} kits · {languages.length} languages ·{' '}
                    {pendingTasks} pending
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
              <span>Kits discovered</span>
              <b>{records.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Activity size={12} aria-hidden /> Agent
              </span>
              <b>Localisation</b>
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
