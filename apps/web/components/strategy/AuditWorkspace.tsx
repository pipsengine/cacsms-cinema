'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Gauge,
  GitBranch,
  History,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { StrategyOverview } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  actorLabel,
  auditEventType,
  auditIssues,
  auditModule,
  auditSeverity,
  auditStats,
  complianceScore,
  downloadBlob,
  exportAuditCsv,
  exportAuditJson,
  filterAuditEvents,
  truncateJson,
  type AuditEvent,
  type AuditFilter,
} from '@/apps/web/lib/strategy-audit';
import styles from './audit-intel.module.css';

type TabId =
  | 'overview'
  | 'timeline'
  | 'changes'
  | 'validation'
  | 'reasoning'
  | 'compliance'
  | 'reports'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Event Timeline' },
  { id: 'changes', label: 'Change History' },
  { id: 'validation', label: 'Validation Evidence' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'reports', label: 'Reports' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'capture', label: 'Capture', icon: History },
  { key: 'correlate', label: 'Correlate', icon: GitBranch },
  { key: 'verify', label: 'Verify', icon: ClipboardCheck },
  { key: 'sign', label: 'Sign', icon: ShieldCheck },
  { key: 'store', label: 'Store', icon: Scale },
  { key: 'report', label: 'Report', icon: FileText },
  { key: 'retain', label: 'Retain', icon: CheckCircle2 },
] as const;

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'COMPLETED':
    case 'INFO':
    case 'PASSED':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'WARNING':
    case 'RUNNING':
    case 'DRAFT':
    case 'QUEUED':
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
  eventCount: number,
  checksum?: string | null,
  systemRunning?: boolean,
) {
  if (eventCount > 0 && checksum) {
    if (index <= 4) return 'done';
    if (index === 5) return 'active';
    return 'pending';
  }
  if (eventCount > 0) {
    if (index <= 2) return 'done';
    if (index === 3) return 'active';
    return 'pending';
  }
  if (systemRunning) {
    return index === 0 ? 'active' : 'pending';
  }
  return index === 0 ? 'active' : 'pending';
}

export function AuditWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AuditFilter>('all');
  const [tab, setTab] = useState<TabId>('overview');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const systemRunning = systemState === 'RUNNING';

  async function load(preferId?: string | null) {
    setBusy(true);
    setError('');
    try {
      const [next, dashboard, auditRows] = await Promise.all([
        strategyApi.overview(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
        strategyApi.strategyAudit().catch(async () => {
          const overviewFallback = await strategyApi.overview();
          if (!overviewFallback.versionId) return [] as AuditEvent[];
          return strategyApi.audit(overviewFallback.versionId);
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const normalized: AuditEvent[] = auditRows.map((row) => ({
        id: row.id,
        versionId: row.versionId ?? null,
        versionNumber: 'versionNumber' in row ? (row.versionNumber ?? null) : null,
        versionStatus: 'versionStatus' in row ? (row.versionStatus ?? null) : null,
        action: row.action,
        actorType: row.actorType,
        actorReference: row.actorReference ?? null,
        requestId: row.requestId ?? null,
        correlationId: row.correlationId ?? null,
        previousValue: row.previousValue ?? null,
        newValue: row.newValue ?? null,
        reason: row.reason,
        createdAt: row.createdAt,
      }));
      setEvents(normalized);
      const targetId = preferId ?? selectedId;
      const selected = targetId ? normalized.find((item) => item.id === targetId) : normalized[0];
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

  const stats = useMemo(() => auditStats(events), [events]);
  const issues = useMemo(() => auditIssues(events), [events]);
  const compliance = useMemo(
    () => complianceScore(events, overview?.checksum),
    [events, overview?.checksum],
  );

  const filtered = useMemo(
    () => filterAuditEvents(events, query, filter),
    [events, query, filter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    events.find((item) => item.id === selectedId) ??
    null;

  const validationEvents = useMemo(
    () => events.filter((item) => auditEventType(item.action) === 'validation'),
    [events],
  );
  const changeEvents = useMemo(
    () =>
      events.filter(
        (item) =>
          Boolean(item.previousValue || item.newValue) ||
          auditEventType(item.action) === 'configuration',
      ),
    [events],
  );

  const kpis = useMemo(
    () => [
      {
        label: 'Audit Events',
        value: String(stats.total),
        meta: 'Persisted immutable log rows',
        accent: '#2563EB',
        icon: History,
        bars: sparkBars(stats.total),
      },
      {
        label: 'Critical Events',
        value: String(stats.critical),
        meta: 'Derived from action/reason signals',
        accent: '#DC2626',
        icon: ShieldAlert,
        bars: sparkBars(stats.critical),
      },
      {
        label: 'Validation Events',
        value: String(stats.validation),
        meta: 'Validate / readiness related',
        accent: '#D97706',
        icon: ClipboardCheck,
        bars: sparkBars(stats.validation),
      },
      {
        label: 'Configuration Changes',
        value: String(stats.configuration),
        meta: 'Reconcile / record mutations',
        accent: '#0284C7',
        icon: FileSpreadsheet,
        bars: sparkBars(stats.configuration),
      },
      {
        label: 'Compliance Score',
        value: `${compliance}%`,
        meta: 'Correlation coverage + package checksum',
        accent: '#16A34A',
        icon: Scale,
        bars: sparkBars(compliance),
      },
      {
        label: 'Evidence Integrity',
        value: overview?.checksum ? 'SIGNED' : 'UNMEAS.',
        meta: overview?.checksum
          ? `Checksum ${overview.checksum.slice(0, 12)}…`
          : 'No package checksum persisted',
        accent: overview?.checksum ? '#0F766E' : '#7C3AED',
        icon: ShieldCheck,
        bars: sparkBars(overview?.checksum ? 10 : 2),
      },
    ],
    [stats, compliance, overview?.checksum],
  );

  const packageStatus =
    overview?.status === 'ACTIVE'
      ? 'Completed'
      : systemRunning
        ? 'Live'
        : events.length
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

  function exportJson() {
    downloadBlob(
      `cacsms-strategy-audit-${new Date().toISOString().slice(0, 10)}.json`,
      exportAuditJson(filtered.length ? filtered : events),
      'application/json',
    );
  }

  function exportCsv() {
    downloadBlob(
      `cacsms-strategy-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      exportAuditCsv(filtered.length ? filtered : events),
      'text/csv;charset=utf-8',
    );
  }

  function exportReport() {
    const rows = (filtered.length ? filtered : events)
      .slice(0, 200)
      .map(
        (event) =>
          `<tr><td>${event.createdAt}</td><td>${event.action}</td><td>${event.actorType}</td><td>${auditModule(event.action)}</td><td>${auditSeverity(event.action, event.reason)}</td><td>${event.reason ?? ''}</td></tr>`,
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>CACSMS Strategy Audit Report</title>
      <style>body{font-family:Segoe UI,sans-serif;padding:24px;color:#0f172a}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #e5e7eb;padding:6px;text-align:left}th{background:#f8fafc}</style></head>
      <body><h1>Strategy Audit Report</h1>
      <p>Generated ${new Date().toLocaleString()} · Events ${events.length} · Compliance ${compliance}% · Checksum ${overview?.checksum ?? 'Not generated'}</p>
      <table><thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Module</th><th>Severity</th><th>Reason</th></tr></thead><tbody>${rows}</tbody></table>
      <p>Print this page to PDF from the browser. Evidence is read-only persisted audit data.</p>
      </body></html>`;
    downloadBlob(
      `cacsms-strategy-audit-report-${new Date().toISOString().slice(0, 10)}.html`,
      html,
      'text/html;charset=utf-8',
    );
  }

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
        <p className={styles.crumb}>Strategy & Fields / Strategy Audit</p>
        <h1 className={styles.title}>Strategy Audit</h1>
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
        <p className={styles.crumb}>Strategy & Fields / Strategy Audit</p>
        <h1 className={styles.title}>Strategy Audit</h1>
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
          <p className={styles.crumb}>Strategy & Fields / Strategy Audit</p>
          <h1 className={styles.title}>Strategy Audit</h1>
          <p className={styles.lede}>
            Immutable evidence of Stage 01 configuration, validation, versioning, activation, and
            handoff actions — observe-only forensic governance.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 01</span>
          <span className={`${styles.badge} ${styles.toneAi}`}>System Managed</span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Read Only</span>
          <span className={`${styles.badge} ${statusTone(packageStatus)}`}>{packageStatus}</span>
          <span className={`${styles.badge} ${statusTone(overview.status)}`}>
            v{overview.versionNumber ?? '—'}
          </span>
          <span className={`${styles.badge} ${overview.checksum ? styles.toneReady : styles.toneWarning}`}>
            {overview.checksum ? 'Evidence Signed' : 'Checksum Pending'}
          </span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Immutable audit log</strong>
          Every autonomous Stage 01 action is appended to persisted audit evidence. This workspace
          is read-only — export reports for compliance; no create/edit/delete of audit rows.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Audit KPI summary">
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

      <section className={styles.lifecycle} aria-label="Audit lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Audit lifecycle</h2>
          <span>
            {systemRunning
              ? 'Live capture — new events stream while Stage 01 runs'
              : `System ${systemState} · ${stats.total} events retained`}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {LIFECYCLE.map((stage, index) => {
            const Icon = stage.icon;
            const state = lifecycleState(index, events.length, overview.checksum, systemRunning);
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

      {!events.length ? (
        <section className={styles.waiting} aria-label="Awaiting audit evidence">
          <div className={styles.waitingIcon}>
            <History size={24} aria-hidden />
          </div>
          <h3>Awaiting Autonomous Audit Capture</h3>
          <p>
            No audit events are persisted yet. Stage 01 Start materialises configuration,
            validation, and activation evidence automatically into the immutable audit log.
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
              <strong>Checksum</strong>
              {overview.checksum ? 'Present' : 'Not generated'}
            </div>
            <div>
              <strong>Expected sequence</strong>
              Capture → Correlate → Store → Report
            </div>
          </div>
        </section>
      ) : null}

      {systemRunning ? (
        <section className={styles.infoNotice} role="status" aria-live="polite">
          <Timer size={16} aria-hidden />
          <div>
            <strong>Live audit streaming</strong>
            New Stage 01 actions append to the persisted log. Explorer refreshes automatically.
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Audit Explorer">
          <div className={styles.panelHead}>
            <h2>Audit Explorer</h2>
            <p>
              {events.length} events
              {filtered.length !== events.length ? ` · ${filtered.length} shown` : ''} · immutable
            </p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search actions, actors, modules…"
              aria-label="Search audit events"
            />
            <div className={styles.chips} role="group" aria-label="Audit filters">
              {(
                [
                  ['all', 'All'],
                  ['critical', 'Critical'],
                  ['validation', 'Validation'],
                  ['configuration', 'Config'],
                  ['versioning', 'Versions'],
                  ['handoff', 'Handoff'],
                  ['system', 'System'],
                  ['user', 'User'],
                  ['failed', 'Failed'],
                  ['missing_correlation', 'No correlation'],
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
              {filtered.map((event) => {
                const active = event.id === selectedId;
                const severity = auditSeverity(event.action, event.reason);
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      className={`${styles.objCard} ${active ? styles.objCardActive : ''}`}
                      onClick={() => setSelectedId(event.id)}
                    >
                      <div className={styles.objCardTop}>
                        <strong>{event.action}</strong>
                        <em className={`${styles.badge} ${statusTone(severity)}`}>{severity}</em>
                      </div>
                      <div className={styles.objMeta}>
                        <span className={styles.pill}>{auditModule(event.action)}</span>
                        <span className={styles.pill}>{actorLabel(event.actorType)}</span>
                        <span className={styles.pill}>
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.empty}>
              <h3>No matching events</h3>
              <p>Adjust filters or wait for Stage 01 to append audit evidence.</p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Audit Intelligence">
          <div className={styles.panelHead}>
            <h2>{selected?.action || 'Audit Intelligence'}</h2>
            <p>
              Forensic detail, before/after evidence, correlation, and compliance context for the
              selected event.
            </p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Audit tabs">
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
                <h3>No event selected</h3>
                <p>Persisted audit events appear when Stage 01 begins writing evidence.</p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Event identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Event ID</span>
                      <strong>{selected.id}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Timestamp</span>
                      <strong>{new Date(selected.createdAt).toLocaleString()}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Action</span>
                      <strong>{selected.action}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Actor</span>
                      <strong>
                        {actorLabel(selected.actorType)}
                        {selected.actorReference ? ` · ${selected.actorReference}` : ''}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Module</span>
                      <strong>{auditModule(selected.action)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Severity</span>
                      <strong>{auditSeverity(selected.action, selected.reason)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Correlation ID</span>
                      <strong>{display(selected.correlationId)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Request ID</span>
                      <strong>{display(selected.requestId)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Linked version</span>
                      <strong>
                        {selected.versionNumber != null
                          ? `v${selected.versionNumber} (${selected.versionStatus ?? '—'})`
                          : display(selected.versionId)}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>IP / device</span>
                      <strong>UNMEASURED</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Evidence hash</span>
                      <strong>
                        {overview.checksum ? `${overview.checksum.slice(0, 16)}…` : 'UNMEASURED'}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Digital signature</span>
                      <strong>{overview.checksum ? 'Package checksum' : 'UNMEASURED'}</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Reason & outcome</h3>
                  <p>{display(selected.reason)}</p>
                </article>
              </>
            ) : null}

            {selected && tab === 'timeline' ? (
              <article className={styles.sectionCard}>
                <h3>Event timeline</h3>
                <div className={styles.ladderStack} aria-label="Chronological audit timeline">
                  {filtered.slice(0, 40).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={`${styles.ladderRung} ${event.id === selectedId ? styles.ladderRungActive : ''}`}
                      onClick={() => setSelectedId(event.id)}
                    >
                      <span className={styles.ladderRank}>
                        {new Date(event.createdAt).toLocaleTimeString()}
                      </span>
                      <div className={styles.ladderCopy}>
                        <strong>{event.action}</strong>
                        <span>
                          {auditModule(event.action)} · {actorLabel(event.actorType)}
                        </span>
                      </div>
                      <em
                        className={`${styles.badge} ${statusTone(auditSeverity(event.action, event.reason))}`}
                      >
                        {auditSeverity(event.action, event.reason)}
                      </em>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'changes' ? (
              <article className={styles.sectionCard}>
                <h3>Change history</h3>
                <div className={styles.groupList}>
                  <div className={styles.groupItem}>
                    <span>Previous value</span>
                    <b>{truncateJson(selected.previousValue, 400)}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>New value</span>
                    <b>{truncateJson(selected.newValue, 400)}</b>
                  </div>
                </div>
                <div className={styles.ladderStack} style={{ marginTop: 14 }} aria-label="Recent changes">
                  {changeEvents.slice(0, 15).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={`${styles.ladderRung} ${event.id === selectedId ? styles.ladderRungActive : ''}`}
                      onClick={() => setSelectedId(event.id)}
                    >
                      <span className={styles.ladderRank}>Δ</span>
                      <div className={styles.ladderCopy}>
                        <strong>{event.action}</strong>
                        <span>{truncateJson(event.newValue ?? event.reason, 100)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            {selected && tab === 'validation' ? (
              <article className={styles.sectionCard}>
                <h3>Validation evidence</h3>
                <p>
                  Package last validated:{' '}
                  {overview.lastValidatedAt
                    ? new Date(overview.lastValidatedAt).toLocaleString()
                    : 'Not yet validated'}
                  . Readiness {overview.readiness ?? 0}%.
                </p>
                <div className={styles.ladderStack} aria-label="Validation audit events">
                  {validationEvents.length ? (
                    validationEvents.slice(0, 20).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        className={`${styles.ladderRung} ${event.id === selectedId ? styles.ladderRungActive : ''}`}
                        onClick={() => setSelectedId(event.id)}
                      >
                        <span className={styles.ladderRank}>V</span>
                        <div className={styles.ladderCopy}>
                          <strong>{event.action}</strong>
                          <span>{display(event.reason)}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p>No validation-tagged audit events yet.</p>
                  )}
                </div>
              </article>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Why this event occurred</h3>
                  <p>
                    {selected.reason ||
                      `Persisted ${selected.action} by ${actorLabel(selected.actorType)} affecting ${auditModule(selected.action)}.`}
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
                      <span>Event type</span>
                      <strong>{auditEventType(selected.action)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Dependency / module</span>
                      <strong>{auditModule(selected.action)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Business impact</span>
                      <strong>
                        {auditSeverity(selected.action, selected.reason) === 'CRITICAL'
                          ? 'Requires investigation before handoff'
                          : auditEventType(selected.action) === 'handoff'
                            ? 'Affects Content Intelligence package'
                            : 'Stage 01 governance trail'}
                      </strong>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'compliance' ? (
              <article className={styles.sectionCard}>
                <h3>Compliance & retention</h3>
                <div className={styles.groupList}>
                  <div className={styles.groupItem}>
                    <span>Compliance score</span>
                    <b>{compliance}%</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Retention policy</span>
                    <b>Immutable append-only strategy_audit_events</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Tamper detection</span>
                    <b>
                      {overview.checksum
                        ? 'Package checksum present — verify against release package'
                        : 'UNMEASURED until activation package exists'}
                    </b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Missing correlation</span>
                    <b>{stats.missingCorrelation}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Regulatory mapping</span>
                    <b>Stage 01 governance / change control evidence</b>
                  </div>
                </div>
              </article>
            ) : null}

            {tab === 'reports' ? (
              <article className={styles.sectionCard}>
                <h3>Export & reporting</h3>
                <p>
                  Exports use currently filtered persisted events ({filtered.length || events.length}{' '}
                  rows). PDF: download the HTML report and print to PDF.
                </p>
                <div className={styles.chips} style={{ marginTop: 12 }}>
                  <button type="button" className={styles.chip} onClick={exportJson}>
                    <FileJson size={14} aria-hidden /> Export JSON
                  </button>
                  <button type="button" className={styles.chip} onClick={exportCsv}>
                    <FileSpreadsheet size={14} aria-hidden /> Export CSV
                  </button>
                  <button type="button" className={styles.chip} onClick={exportReport}>
                    <Download size={14} aria-hidden /> Report (HTML→PDF)
                  </button>
                </div>
              </article>
            ) : null}

            {tab === 'audit' ? (
              <article className={styles.sectionCard}>
                <h3>Raw audit table</h3>
                {events.length ? (
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Action</th>
                        <th>Actor</th>
                        <th>Module</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(filtered.length ? filtered : events).slice(0, 25).map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.createdAt).toLocaleString()}</td>
                          <td>{row.action}</td>
                          <td>{row.actorType}</td>
                          <td>{auditModule(row.action)}</td>
                          <td>{row.reason ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No audit events persisted yet.</p>
                )}
              </article>
            ) : null}
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.insights}`} aria-label="AI Insights">
          <div className={styles.scoreHero}>
            <span className={styles.kpiLabel}>AI Insights</span>
            <strong>{compliance}%</strong>
            <span className={`${styles.badge} ${styles.toneAi}`}>
              <BrainCircuit size={12} aria-hidden /> Audit agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Risk score</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Compliance health</span>
              <b>{compliance}%</b>
            </div>
            <div className={styles.insightRow}>
              <span>Anomaly detection</span>
              <b>{issues.issueCount ? `${issues.issueCount} signals` : 'None'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Critical events</span>
              <b>{stats.critical}</b>
            </div>
            <div className={styles.insightRow}>
              <span>AI confidence</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Selected</span>
              <b>{selected?.action ?? '—'}</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>Recommendations</h3>
            <ul>
              <li>
                {stats.critical
                  ? `Investigate ${stats.critical} critical-severity event(s) before Content Intelligence handoff.`
                  : 'No critical-severity audit signals detected.'}
              </li>
              <li>
                {stats.missingCorrelation
                  ? `${stats.missingCorrelation} event(s) lack correlation/request ids — prefer idempotent runs.`
                  : 'Correlation/request coverage looks complete on recent events.'}
              </li>
              <li>
                {overview.checksum
                  ? 'Retain package checksum with release evidence for tamper verification.'
                  : 'Activate a READY package to persist an evidence checksum.'}
              </li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Audit health axes">
            {[
              ['Volume', Math.min(100, stats.total * 2)],
              ['Compliance', compliance],
              ['Validation', Math.min(100, stats.validation * 10)],
              ['Config', Math.min(100, stats.configuration * 3)],
              ['Integrity', overview.checksum ? 100 : 20],
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

      <section className={styles.bottom} aria-label="Timeline activity and integrity">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Evidence summary</h2>
            <p>Persisted package integrity</p>
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
                  <strong>Package checksum</strong>
                  <p>{overview.checksum ?? 'Not generated'}</p>
                </div>
              </li>
              <li>
                <span className={styles.dot} aria-hidden />
                <div>
                  <strong>Audit retention</strong>
                  <p>{stats.total} events · append-only</p>
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
              <span>System</span>
              <b>{systemState}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Activity size={12} aria-hidden /> Agent
              </span>
              <b>Audit Governance</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <AlertTriangle size={12} aria-hidden /> Issues
              </span>
              <b>{issues.issueCount}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Gauge size={12} aria-hidden /> Compliance
              </span>
              <b>{compliance}%</b>
            </div>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Quick export</h2>
            <p>Compliance downloads</p>
          </div>
          <div className={styles.tabBody}>
            <div className={styles.chips}>
              <button type="button" className={styles.chip} onClick={exportCsv}>
                CSV
              </button>
              <button type="button" className={styles.chip} onClick={exportJson}>
                JSON
              </button>
              <button type="button" className={styles.chip} onClick={exportReport}>
                Report
              </button>
            </div>
          </div>
        </article>
      </section>
    </motion.main>
  );
}
