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
  FileText,
  Gauge,
  GitBranch,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  BRAND_FIELDS,
  categoryLabel,
  chapterCoverage,
  chapterKey,
  chapterSubtitle,
  configDisplay,
  editorialCategory,
  editorialIssues,
  fieldLabel,
  filterEditorialRecords,
  isEditorialPolicyChapter,
  isEditorialStub,
  SAFETY_FIELDS,
  STANDARDS_FIELDS,
  VOICE_FIELDS,
  type EditorialFilter,
} from '@/apps/web/lib/strategy-editorial';
import styles from './editorial-intel.module.css';

type TabId =
  | 'overview'
  | 'standards'
  | 'brand'
  | 'voice'
  | 'safety'
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
  { id: 'standards', label: 'Editorial Standards' },
  { id: 'brand', label: 'Brand Guidelines' },
  { id: 'voice', label: 'Voice & Tone' },
  { id: 'safety', label: 'Content Safety & Compliance' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'generate', label: 'Generate', icon: Compass },
  { key: 'validate', label: 'Validate', icon: CheckCircle2 },
  { key: 'review', label: 'Review', icon: BookOpen },
  { key: 'align', label: 'Align', icon: Scale },
  { key: 'approve', label: 'Approve', icon: ShieldCheck },
  { key: 'publish', label: 'Publish', icon: FileText },
  { key: 'handoff', label: 'Handoff', icon: GitBranch },
] as const;

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'COMPLETED':
    case 'RUNNING':
    case 'Completed':
    case 'mission':
    case 'brand':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'Failed':
    case 'safety':
      return styles.toneBlocked;
    case 'QUEUED':
    case 'PAUSED':
    case 'WARNING':
    case 'Running':
    case 'voice':
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
  chapterCount?: number,
) {
  if ((chapterCount ?? 0) > 0 && (versionStatus === 'ACTIVE' || versionStatus === 'READY')) {
    return 'done';
  }
  if ((chapterCount ?? 0) > 0) {
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

export function EditorialWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<EditorialFilter>('all');
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
        strategyApi.list(next.versionId, 'editorial-policy'),
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

  const policyChapters = useMemo(() => records.filter(isEditorialPolicyChapter), [records]);
  const issues = useMemo(() => editorialIssues(records), [records]);
  const activePolicies = records.filter(
    (item) => item.status === 'ACTIVE' || item.status === 'READY',
  ).length;
  const avgCoverage = records.length
    ? Math.round(records.reduce((sum, item) => sum + chapterCoverage(item), 0) / records.length)
    : 0;
  const complianceScore = records.length
    ? Math.round((activePolicies / records.length) * 100)
    : 0;
  const brandConsistency = policyChapters.length
    ? Math.round(
        policyChapters.reduce((sum, item) => {
          const brandFilled = BRAND_FIELDS.filter((key) =>
            configDisplay(item.configuration, key).trim(),
          ).length;
          return sum + (brandFilled / BRAND_FIELDS.length) * 100;
        }, 0) / policyChapters.length,
      )
    : 0;

  const kpis = useMemo(
    () => [
      {
        label: 'Policy Chapters',
        value: String(policyChapters.length || records.length),
        meta: 'Persisted charter chapters',
        accent: '#2563EB',
        icon: BookOpen,
        bars: sparkBars(policyChapters.length || records.length),
      },
      {
        label: 'Active Policies',
        value: String(activePolicies),
        meta: 'ACTIVE / READY records',
        accent: '#16A34A',
        icon: CheckCircle2,
        bars: sparkBars(activePolicies),
      },
      {
        label: 'Compliance Score',
        value: `${complianceScore}%`,
        meta: 'Share of validated chapters',
        accent: '#0284C7',
        icon: ShieldCheck,
        bars: sparkBars(complianceScore),
      },
      {
        label: 'Brand Consistency',
        value: `${brandConsistency}%`,
        meta: 'Brand field fill across chapters',
        accent: '#7C3AED',
        icon: Scale,
        bars: sparkBars(brandConsistency),
      },
      {
        label: 'Editorial Readiness',
        value: `${overview?.readiness ?? avgCoverage}%`,
        meta: avgCoverage ? `Avg chapter fill ${avgCoverage}%` : 'Stage 01 package',
        accent: '#D97706',
        icon: Gauge,
        bars: sparkBars(overview?.readiness ?? avgCoverage),
      },
      {
        label: 'Outstanding Issues',
        value: String(issues.issueCount),
        meta: 'Thin, duplicate, conflict, stub',
        accent: issues.issueCount ? '#DC2626' : '#16A34A',
        icon: AlertTriangle,
        bars: sparkBars(issues.issueCount + 1),
      },
    ],
    [
      policyChapters.length,
      records.length,
      activePolicies,
      complianceScore,
      brandConsistency,
      overview?.readiness,
      avgCoverage,
      issues.issueCount,
    ],
  );

  const explorerSource = useMemo(() => {
    const live = records.filter((record) => !isEditorialStub(record));
    const policy = live.filter(isEditorialPolicyChapter);
    return policy.length > 0 ? policy : live.length > 0 ? live : records;
  }, [records]);

  const filtered = useMemo(
    () => filterEditorialRecords(explorerSource, query, filter),
    [explorerSource, query, filter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    records.find((item) => item.id === selectedId) ??
    null;
  const config = selected?.configuration ?? {};
  const selectedCategory = selected ? editorialCategory(selected) : 'other';
  const selectedCoverage = selected ? chapterCoverage(selected) : 0;

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
        <p className={styles.crumb}>Strategy & Fields / Editorial & Brand Policy</p>
        <h1 className={styles.title}>Editorial & Brand Policy</h1>
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
          <p className={styles.crumb}>Strategy & Fields / Editorial & Brand Policy</p>
          <h1 className={styles.title}>Editorial & Brand Policy</h1>
          <p className={styles.lede}>
            Autonomously governed editorial charter defining voice, factuality, brand standards,
            content safety, disclosure, and publishing readiness for CACSMS production.
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
          Editorial and brand policy chapters are generated automatically during Stage 01. This
          workspace provides charter exploration, explainability, compliance, and audit visibility
          only.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Editorial KPI summary">
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

      <section className={styles.lifecycle} aria-label="Editorial lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Editorial lifecycle</h2>
          <span>
            {systemRunning
              ? 'Stage 01 running — policy generation active'
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
              policyChapters.length || records.length,
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
        <section className={styles.waiting} aria-label="Awaiting autonomous editorial generation">
          <div className={styles.waitingIcon}>
            <BookOpen size={24} aria-hidden />
          </div>
          <h3>Awaiting Autonomous Charter Generation</h3>
          <p>
            Stage 01 has not yet generated editorial and brand policy chapters. The charter appears
            automatically after global Start begins and policy generation completes.
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
              Generate → Validate → Publish
            </div>
          </div>
          <div className={styles.ghostCards} aria-hidden>
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
          </div>
        </section>
      ) : null}

      {records.length && systemRunning && !policyChapters.length ? (
        <section className={styles.infoNotice} role="status" aria-live="polite">
          <Timer size={16} aria-hidden />
          <div>
            <strong>Live policy generation in progress</strong>
            Stage 01 is reconciling editorial chapters. Explorer and intelligence panels update
            automatically as records persist.
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Policy Explorer">
          <div className={styles.panelHead}>
            <h2>Policy Explorer</h2>
            <p>
              {explorerSource.length} chapters
              {filtered.length !== explorerSource.length ? ` · ${filtered.length} shown` : ''} ·
              auto-updating
            </p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search editorial & brand policy"
              aria-label="Search editorial policy chapters"
            />
            <div className={styles.chips} role="group" aria-label="Policy filters">
              {(
                [
                  ['all', 'All'],
                  ['mission', 'Mission'],
                  ['voice', 'Voice'],
                  ['brand', 'Brand'],
                  ['safety', 'Safety'],
                  ['standards', 'Standards'],
                  ['validated', 'Validated'],
                  ['thin_chapter', 'Thin'],
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
                const category = editorialCategory(record);
                const coverage = chapterCoverage(record);
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
              <h3>{systemRunning ? 'Generation in progress' : 'No matching chapters'}</h3>
              <p>
                {systemRunning
                  ? 'Editorial policy generation is reconciling chapters. This explorer updates automatically.'
                  : 'Adjust filters or wait for Stage 01 to materialise the charter.'}
              </p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Editorial Intelligence">
          <div className={styles.panelHead}>
            <h2>{selected?.name || 'Editorial Intelligence'}</h2>
            <p>Explainable charter, brand, and compliance view for the selected policy chapter.</p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Editorial tabs">
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
                <h3>No chapter selected</h3>
                <p>Persisted policy chapters are selected automatically when Stage 01 completes.</p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Chapter identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Chapter name</span>
                      <strong>{display(selected.name)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>System key</span>
                      <strong>{display(configDisplay(config, 'systemKey'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Chapter key</span>
                      <strong>{display(chapterKey(selected))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Category</span>
                      <strong>{categoryLabel(selectedCategory)}</strong>
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
                      <span>Origin</span>
                      <strong>{display(configDisplay(config, 'origin'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Owning agent</span>
                      <strong>Editorial Policy Agent</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Executive summary</h3>
                  <p>{display(selected.description)}</p>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Policy health</h3>
                  <div className={styles.scoreRow}>
                    {[
                      ['Chapter fill', selectedCoverage],
                      ['Priority', selected.priority],
                      ['Package readiness', overview.readiness ?? 0],
                      ['Compliance share', complianceScore],
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
                    Normative charter only — quantitative compliance scores beyond validated-chapter
                    share remain UNMEASURED.
                  </p>
                </article>
              </>
            ) : null}

            {selected && tab === 'standards' ? (
              <article className={styles.sectionCard}>
                <h3>Editorial standards</h3>
                <div className={styles.groupList}>
                  {[...STANDARDS_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'brand' ? (
              <article className={styles.sectionCard}>
                <h3>Brand guidelines</h3>
                <div className={styles.groupList}>
                  {[...BRAND_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'voice' ? (
              <article className={styles.sectionCard}>
                <h3>Voice & tone</h3>
                <div className={styles.groupList}>
                  {[...VOICE_FIELDS].map((key) => (
                    <div key={key} className={styles.groupItem}>
                      <span>{fieldLabel(key)}</span>
                      <b>{display(configDisplay(config, key))}</b>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'safety' ? (
              <article className={styles.sectionCard}>
                <h3>Content safety & compliance</h3>
                <div className={styles.groupList}>
                  {[...SAFETY_FIELDS].map((key) => (
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
                  <h3>Why this policy exists</h3>
                  <p>
                    Generated by the Editorial Policy Agent to define {categoryLabel(selectedCategory).toLowerCase()}{' '}
                    rules for Stage 01 publishing readiness.
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
                      <span>Chapter</span>
                      <strong>{display(chapterKey(selected))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Confidence</span>
                      <strong>UNMEASURED</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Review requirements</span>
                      <strong>{display(configDisplay(config, 'reviewRequirements'))}</strong>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'dependencies' ? (
              <article className={styles.sectionCard}>
                <h3>Downstream and peer links</h3>
                <div className={styles.depChain}>
                  {['objectives', 'domains', 'audiences', 'geographies', 'localisation', 'source-policy', 'formats'].map(
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
                    <span>Thin chapters</span>
                    <b>{issues.thinChapters.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Duplicate chapters</span>
                    <b>{issues.duplicates.length}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Policy conflicts</span>
                    <b>{issues.conflicts.length}</b>
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
                      <strong>Chapter materialisation</strong>
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
              <BrainCircuit size={12} aria-hidden /> Editorial agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Compliance score</span>
              <b>{complianceScore}%</b>
            </div>
            <div className={styles.insightRow}>
              <span>Confidence</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Policy health</span>
              <b>{selected ? selected.status : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Brand alignment</span>
              <b>{brandConsistency}%</b>
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
              <b>{selected ? chapterSubtitle(selected) : '—'}</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>Recommendations</h3>
            <ul>
              <li>
                {issues.thinChapters.length
                  ? `Enrich ${issues.thinChapters.length} thin chapter(s) with missing standards.`
                  : 'Chapter rule fill is above the thin-chapter threshold.'}
              </li>
              <li>
                {issues.conflicts.length
                  ? `Resolve ${issues.conflicts.length} prohibited/restricted conflict(s).`
                  : 'No identical prohibited/restricted conflicts detected.'}
              </li>
              <li>
                Align localisation and source-policy peers before Content Intelligence handoff.
              </li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Editorial health axes">
            {[
              ['Coverage', selectedCoverage],
              ['Priority', selected?.priority ?? 0],
              ['Compliance', complianceScore],
              ['Brand', brandConsistency],
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
                  <strong>Editorial persistence</strong>
                  <p>
                    {policyChapters.length || records.length} chapters · {activePolicies} active ·{' '}
                    {issues.issueCount} issues
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
              <span>Chapters discovered</span>
              <b>{records.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Activity size={12} aria-hidden /> Agent
              </span>
              <b>Editorial Policy</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <CircleDot size={12} aria-hidden /> Policy chapters
              </span>
              <b>{policyChapters.length}</b>
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
