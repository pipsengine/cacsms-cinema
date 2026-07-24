'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  FileStack,
  Gauge,
  Layers3,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
} from 'lucide-react';
import type { ReadinessItem, StrategyOverview } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import styles from './strategy-overview-intel.module.css';

type AuditRow = {
  id: string;
  action: string;
  actorType: string;
  createdAt: string;
  reason: string | null;
};

const PRIMARY_SECTION_ORDER = [
  'objectives',
  'domains',
  'taxonomy',
  'geographies',
  'audiences',
  'editorial-policy',
  'formats',
  'channels',
  'localisation',
] as const;

const LIFECYCLE = [
  { key: 'generate', label: 'Generate', icon: Layers3 },
  { key: 'validate', label: 'Validate', icon: ClipboardCheck },
  { key: 'gaps', label: 'Resolve Gaps', icon: AlertTriangle },
  { key: 'approve', label: 'Approve', icon: ShieldCheck },
  { key: 'persist', label: 'Persist', icon: CircleDot },
  { key: 'handoff', label: 'Handoff', icon: Workflow },
] as const;

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'COMPLETED':
    case 'ACKNOWLEDGED':
    case 'Completed':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'Failed':
      return styles.toneBlocked;
    case 'IN_REVIEW':
    case 'QUEUED':
    case 'RUNNING':
    case 'WARNING':
    case 'PARTIAL':
    case 'Running':
      return styles.toneWarning;
    default:
      return styles.toneDraft;
  }
}

function lifecycleState(
  index: number,
  overview: StrategyOverview,
  systemRunning: boolean,
  blockedCount: number,
) {
  const readiness = overview.readiness ?? 0;
  const handoffReady =
    overview.handoffStatus === 'ACKNOWLEDGED' || overview.status === 'ACTIVE';
  const validated = Boolean(overview.lastValidatedAt) || overview.status === 'READY' || overview.status === 'ACTIVE';
  const hasPackage = Boolean(overview.versionId);
  const run = overview.autonomyRun?.status;

  if (handoffReady) return 'done';
  if (overview.status === 'INVALID' || overview.autonomyRun?.status === 'FAILED') {
    if (index <= 1) return index === 1 ? 'failed' : 'done';
    return 'pending';
  }
  if (overview.status === 'ACTIVE') {
    return index < 5 ? 'done' : index === 5 ? 'active' : 'pending';
  }
  if (overview.status === 'READY' && blockedCount === 0) {
    if (index < 4) return 'done';
    if (index === 4) return 'active';
    return 'pending';
  }
  if (validated && blockedCount === 0 && readiness >= 80) {
    if (index < 3) return 'done';
    if (index === 3) return 'active';
    return 'pending';
  }
  if (validated && blockedCount > 0) {
    if (index < 2) return 'done';
    if (index === 2) return 'warning';
    return 'pending';
  }
  if (run === 'RUNNING' || run === 'QUEUED' || systemRunning) {
    if (index === 0) return 'active';
    return 'pending';
  }
  if (hasPackage && readiness > 0) {
    if (index === 0) return 'done';
    if (index === 1) return 'active';
    return 'pending';
  }
  if (hasPackage) return index === 0 ? 'active' : 'pending';
  return 'pending';
}

function stageLabel(state: string) {
  if (state === 'done') return 'Completed';
  if (state === 'active') return 'Running';
  if (state === 'warning') return 'Attention';
  if (state === 'failed') return 'Failed';
  return 'Waiting';
}

function sectionHref(key: string) {
  return `/strategy/${key}`;
}

export function StrategyOverviewWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [query, setQuery] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const systemRunning = systemState === 'RUNNING';
  const run = overview?.autonomyRun ?? null;

  async function load() {
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
      if (next.available && next.versionId) {
        const auditRows = await strategyApi.audit(next.versionId).catch(() => [] as AuditRow[]);
        setAudit(auditRows);
      } else {
        setAudit([]);
      }
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
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
    }, systemRunning ? 3000 : 10000);
    return () => window.clearInterval(timer);
  }, [systemRunning]);

  useEffect(() => {
    const onControlChanged = () => void load();
    window.addEventListener('cacsms:system-control-changed', onControlChanged);
    return () => window.removeEventListener('cacsms:system-control-changed', onControlChanged);
  }, []);

  const primarySections = useMemo(() => {
    const byKey = new Map((overview?.sections ?? []).map((item) => [item.key, item]));
    return PRIMARY_SECTION_ORDER.map((key) => byKey.get(key)).filter(
      (item): item is ReadinessItem => Boolean(item),
    );
  }, [overview?.sections]);

  const filteredSections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return primarySections;
    return primarySections.filter(
      (item) =>
        item.label.toLowerCase().includes(needle) ||
        item.key.includes(needle) ||
        item.missing.some((entry) => entry.toLowerCase().includes(needle)),
    );
  }, [primarySections, query]);

  const metrics = useMemo(() => {
    const source = overview?.metrics ?? {};
    return [
      {
        key: 'configuredSections',
        title: 'Configured sections',
        value: source.configuredSections ?? primarySections.filter((s) => s.progress > 0).length,
        meta: 'Sections with persisted records',
        accent: '#2563EB',
        icon: Layers3,
      },
      {
        key: 'configuredRecords',
        title: 'Configured records',
        value: source.configuredRecords ?? 0,
        meta: 'Live Stage 01 records',
        accent: '#0284C7',
        icon: FileStack,
      },
      {
        key: 'failedMandatoryValidations',
        title: 'Failed validations',
        value: source.failedMandatoryValidations ?? overview?.issues?.filter((i) => i.severity === 'CRITICAL').length ?? 0,
        meta: 'Mandatory gaps blocking readiness',
        accent: '#DC2626',
        icon: AlertTriangle,
      },
      {
        key: 'contentIntelligenceHandoff',
        title: 'CI handoff',
        value: source.contentIntelligenceHandoff ?? (overview?.handoffStatus === 'ACKNOWLEDGED' ? 1 : 0),
        meta: overview?.handoffStatus ?? 'Not started',
        accent: '#7C3AED',
        icon: Workflow,
      },
    ];
  }, [overview, primarySections]);

  const blockedCount = primarySections.filter((item) => item.status === 'BLOCKED').length;
  const readyCount = primarySections.filter((item) => item.status === 'READY').length;
  const warningCount = primarySections.filter((item) => item.status === 'WARNING').length;

  const packageStatus =
    overview?.status === 'ACTIVE'
      ? 'Completed'
      : overview?.status === 'READY'
        ? 'Validated'
        : overview?.status === 'INVALID'
          ? 'Failed'
          : systemRunning
            ? 'Running'
            : blockedCount > 0
              ? 'Blocked'
              : overview?.status ?? 'Draft';

  const recommendations = useMemo(() => {
    const items: string[] = [];
    if (!overview?.versionId) {
      items.push('Start the global autonomous run to materialise the Stage 01 strategy package.');
    }
    if (blockedCount > 0) {
      items.push(
        `Resolve ${blockedCount} blocked section${blockedCount === 1 ? '' : 's'} so validation can advance.`,
      );
    }
    if (overview?.status === 'READY' && overview.handoffStatus !== 'ACKNOWLEDGED') {
      items.push('Package is READY — autonomy can activate and hand off to Content Intelligence.');
    }
    if (overview?.status === 'ACTIVE' && overview.handoffStatus !== 'ACKNOWLEDGED') {
      items.push('Strategy is ACTIVE. Monitor Content Intelligence acknowledgement.');
    }
    if (!items.length) {
      items.push('No outstanding strategy recommendations from persisted readiness state.');
    }
    return items.slice(0, 4);
  }, [overview, blockedCount]);

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
        <div className={styles.skeletonHero} />
        <div className={styles.skeletonRow}>
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className={styles.skeletonBlock} />
          ))}
        </div>
        <div className={styles.skeletonPanel} />
      </main>
    );
  }

  if (error || !overview?.available) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Content Lifecycle / 01 Strategy & Fields</p>
        <h1 className={styles.title}>Strategy & Fields</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Strategy service unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  const showWaiting = !overview.versionId || ((overview.metrics?.configuredRecords ?? 0) === 0 && !systemRunning);

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>Content Lifecycle / 01 Strategy & Fields</p>
          <h1 className={styles.title}>Strategy & Fields</h1>
          <p className={styles.lede}>
            Autonomous Stage 01 readiness and governance command centre for the policy package that
            governs CACSMS content production.
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
          Stage 01 generates, validates, and persists strategy sections automatically while the system
          is Running. This overview provides readiness, blockers, handoff, and audit visibility only.
          {syncedAt ? ` Last refresh ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.hero} aria-label="Strategy readiness hero">
        <div className={styles.heroCopy}>
          <span className={`${styles.badge} ${statusTone(overview.status)}`}>
            {overview.status ?? 'DRAFT'}
          </span>
          <h2>
            {overview.name ?? 'CACSMS Content Strategy'}
            <small>v{overview.versionNumber ?? '—'}</small>
          </h2>
          <p>
            Effective{' '}
            {overview.effectiveDate
              ? new Date(overview.effectiveDate).toLocaleString()
              : 'when activated'}
            <span aria-hidden> · </span>
            Handoff {overview.handoffStatus ?? 'not started'}
            <span aria-hidden> · </span>
            Run {run?.status ?? 'IDLE'}
          </p>
          <div className={styles.heroMeta}>
            <span className={styles.pill}>{readyCount} ready</span>
            <span className={styles.pill}>{warningCount} warning</span>
            <span className={styles.pill}>{blockedCount} blocked</span>
            <span className={styles.pill}>{primarySections.length} tracked sections</span>
            {overview.lastValidatedAt ? (
              <span className={styles.pill}>
                Validated {new Date(overview.lastValidatedAt).toLocaleString()}
              </span>
            ) : (
              <span className={styles.pill}>Not validated yet</span>
            )}
          </div>
        </div>
        <div
          className={styles.readinessScore}
          aria-label={`${overview.readiness ?? 0} percent ready`}
          title="Overall Stage 01 package readiness from persisted validation state"
        >
          <strong>{overview.readiness ?? 0}%</strong>
          <span>ready</span>
          <div className={styles.scoreTrack} aria-hidden>
            <i style={{ width: `${Math.max(0, Math.min(100, overview.readiness ?? 0))}%` }} />
          </div>
        </div>
      </section>

      <section className={styles.kpiGrid} aria-label="Strategy overview KPIs">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article
              key={metric.key}
              className={styles.kpiCard}
              style={{ ['--accent' as string]: metric.accent }}
              title={metric.meta}
            >
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>{metric.title}</span>
                <Icon size={16} className={styles.kpiIcon} aria-hidden />
              </div>
              <div className={styles.kpiValue}>{metric.value}</div>
              <div className={styles.kpiMeta}>{metric.meta}</div>
            </article>
          );
        })}
      </section>

      <section className={styles.lifecycle} aria-label="Strategy lifecycle flow">
        <div className={styles.lifecycleHead}>
          <h2>Stage lifecycle</h2>
          <span>
            {systemRunning
              ? 'Autonomy advancing Stage 01'
              : `System ${systemState} · package ${overview.status}`}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {LIFECYCLE.map((stage, index) => {
            const Icon = stage.icon;
            const state = lifecycleState(index, overview, systemRunning, blockedCount);
            return (
              <div key={stage.key} className={styles.stage} data-state={state}>
                <span className={styles.stageIcon}>
                  <Icon size={14} aria-hidden />
                </span>
                <strong>{stage.label}</strong>
                <span>{stageLabel(state)}</span>
              </div>
            );
          })}
        </div>
      </section>

      {showWaiting ? (
        <section className={styles.waiting} aria-label="Awaiting Stage 01 generation">
          <div className={styles.waitingIcon}>
            <Gauge size={22} aria-hidden />
          </div>
          <h3>Awaiting Autonomous Strategy Generation</h3>
          <p>
            Stage 01 has not yet produced a populated readiness package. Sections and validation
            results appear automatically after global Start begins.
          </p>
          <div className={styles.waitingChecklist}>
            <div>
              <strong>System</strong>
              {systemState}
            </div>
            <div>
              <strong>Package</strong>
              {overview.status ?? '—'}
            </div>
            <div>
              <strong>Autonomy run</strong>
              {run?.status ?? 'IDLE'}
            </div>
            <div>
              <strong>Sequence</strong>
              Generate → Validate → Handoff
            </div>
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <section className={styles.panel} aria-label="Configuration readiness checklist">
          <div className={styles.panelHead}>
            <div>
              <h2>Configuration readiness</h2>
              <p>
                Mandatory Stage 01 sections. Status, completion, and issues come from persisted
                validation — not editable here.
              </p>
            </div>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter sections"
              aria-label="Filter configuration sections"
            />
          </div>
          <div className={styles.checklist}>
            {filteredSections.map((item) => (
              <Link
                key={item.key}
                href={sectionHref(item.key)}
                className={styles.row}
                data-status={item.status.toLowerCase()}
                title={`Open ${item.label}`}
              >
                <div className={styles.rowCopy}>
                  <strong>{item.label}</strong>
                  <span>{item.missing.join(', ') || 'All requirements satisfied'}</span>
                  <div className={styles.rowMeta}>
                    <span className={styles.pill}>
                      {item.recordCount ?? 0} record{(item.recordCount ?? 0) === 1 ? '' : 's'}
                    </span>
                    <span className={styles.pill}>
                      {item.blockers} blocker{item.blockers === 1 ? '' : 's'}
                    </span>
                    <span className={styles.pill}>
                      {item.warnings} warning{item.warnings === 1 ? '' : 's'}
                    </span>
                    <span className={styles.pill}>
                      {item.lastValidatedAt
                        ? `Validated ${new Date(item.lastValidatedAt).toLocaleString()}`
                        : 'Not validated yet'}
                    </span>
                  </div>
                </div>
                <div className={styles.progressWrap}>
                  <div className={styles.progressTrack} aria-hidden>
                    <i style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} />
                  </div>
                  <b>{Math.round(item.progress)}%</b>
                </div>
                <span className={`${styles.badge} ${statusTone(item.status)}`}>{item.status}</span>
                <ArrowUpRight size={16} aria-hidden />
              </Link>
            ))}
            {!filteredSections.length ? (
              <p className={styles.emptyNote}>No sections match this filter.</p>
            ) : null}
          </div>
        </section>

        <aside className={styles.sideStack} aria-label="Strategy intelligence panels">
          <article className={styles.sidePanel}>
            <h2>Blockers & warnings</h2>
            {overview.issues?.length ? (
              <ul className={styles.issueList}>
                {overview.issues.slice(0, 6).map((issue) => (
                  <li key={issue.id}>
                    <div className={styles.issueHead}>
                      {issue.severity === 'CRITICAL' ? (
                        <AlertTriangle size={14} aria-hidden />
                      ) : (
                        <CheckCircle2 size={14} aria-hidden />
                      )}
                      <b>{issue.severity}</b>
                    </div>
                    <span>{issue.message}</span>
                    <small>{issue.recommendation}</small>
                    <Link href={sectionHref(issue.section)}>Open section</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyNote}>No unresolved blockers for this version.</p>
            )}
          </article>

          <article className={styles.sidePanel}>
            <h2>AI recommendations</h2>
            <ul className={styles.recList}>
              {recommendations.map((item) => (
                <li key={item}>
                  <span>{item}</span>
                  <small>Derived from persisted readiness and run state</small>
                </li>
              ))}
            </ul>
          </article>

          <article className={styles.sidePanel}>
            <h2>Recent activity</h2>
            <ul className={styles.activityList}>
              <li>
                <span>
                  <Activity size={12} aria-hidden /> Autonomy run
                </span>
                <small>{run?.status ?? 'IDLE'}</small>
              </li>
              <li>
                <span>
                  <Timer size={12} aria-hidden /> System control
                </span>
                <small>{systemState}</small>
              </li>
              <li>
                <span>
                  <Gauge size={12} aria-hidden /> Package readiness
                </span>
                <small>{overview.readiness ?? 0}%</small>
              </li>
              {audit.slice(0, 3).map((row) => (
                <li key={row.id}>
                  <span>{row.action}</span>
                  <small>
                    {row.actorType} · {new Date(row.createdAt).toLocaleString()}
                  </small>
                </li>
              ))}
              {!audit.length ? (
                <li>
                  <span>No audit events yet</span>
                  <small>Events appear as Stage 01 persists changes</small>
                </li>
              ) : null}
            </ul>
          </article>

          <article className={styles.sidePanel}>
            <h2>Audit summary</h2>
            <ul className={styles.activityList}>
              <li>
                <span>Checksum</span>
                <small>{overview.checksum ?? 'Not generated until activation'}</small>
              </li>
              <li>
                <span>Handoff</span>
                <small>{overview.handoffStatus ?? 'not started'}</small>
              </li>
              <li>
                <span>Audit events</span>
                <small>{audit.length} loaded for this version</small>
              </li>
              <li>
                <Link href="/strategy/audit">Open full strategy audit</Link>
              </li>
            </ul>
          </article>
        </aside>
      </div>
    </motion.main>
  );
}
