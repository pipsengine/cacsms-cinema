'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Download,
  FileCheck2,
  Fingerprint,
  Gauge,
  Layers3,
  Package,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
  XCircle,
} from 'lucide-react';
import type {
  IntakePackageRecord,
  IntelligenceIntakeOverview,
} from '@/lib/idea-qualification/intake';
import { qualificationApi } from '@/apps/web/lib/qualification-api';
import styles from './intelligence-intake.module.css';

type TabId =
  | 'overview'
  | 'queue'
  | 'integrity'
  | 'compatibility'
  | 'summary'
  | 'timeline'
  | 'health'
  | 'validation'
  | 'errors'
  | 'explain'
  | 'knowledge'
  | 'analytics'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'queue', label: 'Package Queue' },
  { id: 'integrity', label: 'Integrity' },
  { id: 'compatibility', label: 'Compatibility' },
  { id: 'summary', label: 'AI Summary' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'health', label: 'Package Health' },
  { id: 'validation', label: 'Validation Rules' },
  { id: 'errors', label: 'Error Center' },
  { id: 'explain', label: 'Explainability' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit' },
];

const EMPTY_COPY =
  'The Intelligence Intake Engine automatically receives cryptographically verified candidate packages from the Content Intelligence stage. Every incoming package undergoes integrity verification, compatibility checks, provenance validation, evidence inspection, and strategy alignment before it is admitted into the Idea Qualification pipeline. Once the autonomous discovery engine completes a Content Intelligence run, verified packages and their complete audit trail will appear here.';

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'ACKNOWLEDGED':
    case 'VERIFIED':
    case 'PASS':
    case 'CLEAR':
    case 'READY':
    case 'RUNNING':
    case 'DONE':
      return styles.toneReady;
    case 'REJECTED':
    case 'MISMATCH':
    case 'FAIL':
    case 'FAILED':
    case 'CRITICAL':
    case 'DEGRADED':
      return styles.toneBlocked;
    case 'RECEIVED':
    case 'PENDING':
    case 'WAITING':
    case 'IDLE':
    case 'WARNING':
    case 'UNMEASURED':
      return styles.toneWarning;
    default:
      return styles.toneDraft;
  }
}

function display(value?: string | number | null) {
  if (value == null || value === '') return '—';
  return String(value);
}

function measured(value?: string | number | null) {
  if (value == null || value === '') return 'UNMEASURED';
  return String(value);
}

function sparkBars(seed: number) {
  return [4, 7, 5, 9, 6, 10, 8].map((base, index) =>
    Math.max(3, ((base + seed + index * 2) % 10) + 3),
  );
}

function exportPayload(overview: IntelligenceIntakeOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `intelligence-intake-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'id',
    'status',
    'integrity',
    'candidates',
    'confidence',
    'checksumMatch',
    'receivedAt',
  ];
  const lines = [
    header.join(','),
    ...overview.packages.map((item) =>
      [
        item.id,
        item.status,
        item.integrityStatus,
        item.candidateCount,
        item.overallConfidence ?? '',
        item.checksumMatch,
        item.receivedAt,
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `intelligence-intake-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function IntelligenceIntakeWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<IntelligenceIntakeOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
      const [next, dashboard] = await Promise.all([
        qualificationApi.intake(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const packages = next.packages ?? [];
      const targetId = preferId ?? selectedId;
      const selected = targetId
        ? packages.find((item) => item.id === targetId)
        : packages[0];
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

  const packages = overview?.packages ?? [];
  const metrics = overview?.metrics;
  const needle = query.trim().toLowerCase();

  const statuses = useMemo(
    () => [...new Set(packages.map((item) => item.status))].sort(),
    [packages],
  );

  const filtered = useMemo(
    () =>
      packages.filter((item) => {
        if (statusFilter !== 'all' && item.status !== statusFilter) return false;
        if (!needle) return true;
        const haystack = [
          item.id,
          item.sourceRunId,
          item.strategyVersionId,
          item.status,
          item.checksum,
          item.summary,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      }),
    [packages, needle, statusFilter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    packages.find((item) => item.id === selectedId) ??
    null;
  const compare =
    packages.find((item) => item.id === compareId && item.id !== selected?.id) ?? null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const kpis = useMemo(() => {
    const m = metrics;
    return [
      {
        label: 'Packages Received',
        value: String(m?.packagesReceived ?? 0),
        meta: 'iq_intake_packages rows',
        accent: '#2563EB',
        icon: Package,
        bars: sparkBars(m?.packagesReceived ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Packages Pending',
        value: String(m?.packagesPending ?? 0),
        meta: 'RECEIVED status',
        accent: '#F59E0B',
        icon: Timer,
        bars: sparkBars(m?.packagesPending ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Packages Accepted',
        value: String(m?.packagesAccepted ?? 0),
        meta: 'ACKNOWLEDGED',
        accent: '#22C55E',
        icon: CheckCircle2,
        bars: sparkBars(m?.packagesAccepted ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Packages Rejected',
        value: String(m?.packagesRejected ?? 0),
        meta: 'REJECTED',
        accent: '#EF4444',
        icon: XCircle,
        bars: sparkBars(m?.packagesRejected ?? 0),
        drill: 'errors' as TabId,
      },
      {
        label: 'Verification Failures',
        value: String(m?.verificationFailures ?? 0),
        meta: 'Mismatch or rejected',
        accent: '#F97316',
        icon: AlertTriangle,
        bars: sparkBars(m?.verificationFailures ?? 0),
        drill: 'integrity' as TabId,
      },
      {
        label: 'Checksum Mismatches',
        value: String(m?.checksumMismatches ?? 0),
        meta: 'SHA-256 compare failures',
        accent: '#EF4444',
        icon: Fingerprint,
        bars: sparkBars(m?.checksumMismatches ?? 0),
        drill: 'integrity' as TabId,
      },
      {
        label: 'Integrity Status',
        value: m?.integrityStatus ?? 'IDLE',
        meta: 'Derived ledger health',
        accent: '#0EA5E9',
        icon: ShieldCheck,
        bars: sparkBars(m?.packagesAccepted ?? 0),
        drill: 'integrity' as TabId,
      },
      {
        label: 'AI Confidence',
        value: m?.aiConfidence != null ? `${m.aiConfidence}%` : 'UNMEAS.',
        meta: 'Avg package confidence',
        accent: '#7C3AED',
        icon: Gauge,
        bars: sparkBars(m?.aiConfidence ?? 0),
        drill: 'summary' as TabId,
      },
      {
        label: 'Avg Intake Time',
        value:
          m?.averageIntakeTimeMs != null
            ? `${Math.round(m.averageIntakeTimeMs / 1000)}s`
            : 'UNMEAS.',
        meta: 'Received → acknowledged',
        accent: '#64748B',
        icon: Timer,
        bars: sparkBars(m?.averageIntakeTimeMs ?? 0),
        drill: 'analytics' as TabId,
      },
      {
        label: 'Queue Length',
        value: String(m?.queueLength ?? 0),
        meta: 'Pending packages',
        accent: '#F59E0B',
        icon: Layers3,
        bars: sparkBars(m?.queueLength ?? 0),
        drill: 'queue' as TabId,
      },
      {
        label: 'Processing Rate',
        value: m?.processingRate != null ? String(m.processingRate) : 'UNMEAS.',
        meta: 'No throughput probe yet',
        accent: '#94A3B8',
        icon: Activity,
        bars: sparkBars(0),
        drill: 'analytics' as TabId,
      },
      {
        label: 'Strategy Version',
        value: m?.currentStrategyVersion ?? 'UNMEAS.',
        meta: 'Latest package strategy',
        accent: '#2563EB',
        icon: FileCheck2,
        bars: sparkBars(1),
        drill: 'compatibility' as TabId,
      },
      {
        label: 'Intelligence Version',
        value: m?.currentIntelligenceVersion ?? 'UNMEAS.',
        meta: 'From package payload',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(0),
        drill: 'knowledge' as TabId,
      },
      {
        label: 'Package Success Rate',
        value: m?.packageSuccessRate != null ? `${m.packageSuccessRate}%` : 'UNMEAS.',
        meta: 'Accepted / received',
        accent: '#22C55E',
        icon: ShieldCheck,
        bars: sparkBars(m?.packageSuccessRate ?? 0),
        drill: 'analytics' as TabId,
      },
    ];
  }, [metrics]);

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35 },
      };

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

  if (error || (overview && !overview.available)) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Idea Qualification / Intelligence Intake</p>
        <h1 className={styles.title}>Intelligence Intake Gateway</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Intelligence Intake unavailable</h2>
          <p>{error || overview?.reason}</p>
          <button type="button" className={styles.chip} onClick={() => void load()}>
            Retry connection
          </button>
        </section>
      </main>
    );
  }

  const showEmpty = packages.length === 0;

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 03 Idea Qualification / Intelligence Intake
          </p>
          <h1 className={styles.title}>Intelligence Intake Gateway</h1>
          <p className={styles.lede}>
            Verify and acknowledge provenance-linked candidate packages from Content Intelligence —
            integrity, compatibility, and strategy alignment before qualification begins.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 03 Intake</span>
          <span className={`${styles.badge} ${statusTone(metrics?.integrityStatus)}`}>
            {metrics?.integrityStatus ?? 'IDLE'}
          </span>
          <span className={`${styles.badge} ${statusTone(overview?.meta.queueStatus)}`}>
            Queue {overview?.meta.queueStatus ?? 'Idle'}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous intake</strong>
          Packages arrive from Content Intelligence via checksum-verified transfer. Accept/reject is
          performed by the engine — this page explains and audits. Source taxonomy breakdowns stay
          UNMEASURED unless present on the package payload.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
          <span style={{ marginLeft: 12 }}>
            <button
              type="button"
              className={styles.chip}
              onClick={() => overview && exportPayload(overview, 'json')}
            >
              <Download size={12} aria-hidden /> JSON
            </button>{' '}
            <button
              type="button"
              className={styles.chip}
              onClick={() => overview && exportPayload(overview, 'csv')}
            >
              <Download size={12} aria-hidden /> CSV
            </button>
          </span>
        </div>
      </div>

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Intake KPIs">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              type="button"
              className={styles.kpiCard}
              style={{ ['--accent' as string]: kpi.accent }}
              title={kpi.meta}
              onClick={() => setTab(kpi.drill)}
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
            </button>
          );
        })}
      </section>

      <section className={styles.lifecycle} aria-label="Intake pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Autonomous intake pipeline</h2>
          <span>
            Content Intelligence → Package → Verify → Accept → Qualification ·{' '}
            {overview?.meta.queueStatus}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {(overview?.pipeline ?? []).map((stage) => (
            <div key={stage.key} className={styles.stage} data-state={stage.state}>
              <span className={styles.stageIcon}>
                <Workflow size={14} aria-hidden />
              </span>
              <strong>{stage.label}</strong>
            </div>
          ))}
        </div>
      </section>

      {showEmpty ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>{EMPTY_COPY}</h2>
            <p className={styles.lede}>
              Content Intelligence → Package Builder → Integrity → Compatibility → Checksum →
              Authentication → Acceptance → Idea Qualification.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Receive</strong>
              Cryptographic package transfer
            </li>
            <li>
              <strong>2. Verify</strong>
              Checksum + compatibility
            </li>
            <li>
              <strong>3. Accept</strong>
              Autonomous acknowledgement
            </li>
            <li>
              <strong>4. Qualify</strong>
              Open candidate pool cycle
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Intake workspace">
        <aside className={styles.panel} aria-label="Package Explorer">
          <div className={styles.panelHead}>
            <h2>Package Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Package ID, run, strategy, checksum…"
              />
            </label>
            <label className={styles.field}>
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No persisted packages match the current filters.</p>
              </div>
            ) : (
              <ul className={styles.explorerList}>
                {filtered.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`${styles.explorerItem} ${
                        selected?.id === item.id ? styles.explorerItemActive : ''
                      }`}
                      onClick={() => {
                        setSelectedId(item.id);
                        setTab('summary');
                      }}
                    >
                      <span className={styles.explorerTitle}>
                        PKG {item.id.slice(0, 8)}… · {item.candidateCount} ideas
                      </span>
                      <span className={styles.explorerMeta}>
                        Run {item.sourceRunId.slice(0, 8)}… ·{' '}
                        {new Date(item.receivedAt).toLocaleString()}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                        <span className={`${styles.chip} ${statusTone(item.integrityStatus)}`}>
                          {item.integrityStatus}
                        </span>
                        <button
                          type="button"
                          className={styles.chip}
                          onClick={(event) => {
                            event.stopPropagation();
                            setCompareId(item.id === compareId ? null : item.id);
                            setTab('analytics');
                          }}
                        >
                          {compareId === item.id ? 'Comparing' : 'Compare'}
                        </button>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Intake detail">
          <div className={styles.tabs} role="tablist">
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
            {tab === 'overview' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Queue monitor</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Waiting</dt>
                      <dd>{overview?.queueMonitor.waiting ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Processing</dt>
                      <dd>{overview?.queueMonitor.processing ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Failed</dt>
                      <dd>{overview?.queueMonitor.failed ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Accepted</dt>
                      <dd>{overview?.queueMonitor.accepted ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Avg queue time</dt>
                      <dd>
                        {overview?.queueMonitor.averageQueueTimeMs != null
                          ? `${Math.round(overview.queueMonitor.averageQueueTimeMs / 1000)}s`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Throughput</dt>
                      <dd>{measured(overview?.queueMonitor.throughput)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Notifications</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.notifications ?? []).map((note) => (
                      <li key={note.id}>
                        <span className={`${styles.chip} ${statusTone(note.severity)}`}>
                          {note.severity}
                        </span>{' '}
                        {note.message}
                      </li>
                    ))}
                    {!overview?.notifications.length ? <li>No intake alerts.</li> : null}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'queue' ? (
              <PackageQueueTable
                items={filtered}
                selectedId={selected?.id}
                onSelect={(id) => {
                  setSelectedId(id);
                  setTab('summary');
                }}
              />
            ) : null}

            {tab === 'integrity' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Integrity verification</h3>
                  <ul className={styles.bulletList}>
                    {selected.integrityChecks.map((check) => (
                      <li key={check.key}>
                        <span
                          className={`${styles.chip} ${statusTone(
                            check.passed === true
                              ? 'PASS'
                              : check.passed === false
                                ? 'FAIL'
                                : 'UNMEASURED',
                          )}`}
                        >
                          {check.passed === true
                            ? '✓'
                            : check.passed === false
                              ? '✕'
                              : '?'}{' '}
                          {check.label}
                        </span>{' '}
                        {check.detail}
                      </li>
                    ))}
                  </ul>
                  <dl className={styles.kv} style={{ marginTop: 16 }}>
                    <div>
                      <dt>Stored checksum</dt>
                      <dd>
                        <code>{selected.checksum}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Computed SHA-256</dt>
                      <dd>
                        <code>{selected.computedHash}</code>
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'compatibility' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Compatibility matrix</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Component</th>
                        <th>Expected</th>
                        <th>Actual</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.compatibility.map((row) => (
                        <tr key={row.key}>
                          <td>{row.label}</td>
                          <td>{display(row.expected)}</td>
                          <td>{display(row.actual)}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'summary' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>AI intake summary</h3>
                  <p>{selected.summary}</p>
                </article>
                <article className={styles.detailCard}>
                  <h3>Package header</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Package ID</dt>
                      <dd>{selected.id}</dd>
                    </div>
                    <div>
                      <dt>Strategy version</dt>
                      <dd>{selected.strategyVersionId}</dd>
                    </div>
                    <div>
                      <dt>Intelligence version</dt>
                      <dd>{measured(selected.intelligenceVersion)}</dd>
                    </div>
                    <div>
                      <dt>Discovery run</dt>
                      <dd>{selected.sourceRunId}</dd>
                    </div>
                    <div>
                      <dt>AI model</dt>
                      <dd>{measured(selected.aiModel)}</dd>
                    </div>
                    <div>
                      <dt>Prompt version</dt>
                      <dd>{measured(selected.promptVersion)}</dd>
                    </div>
                    <div>
                      <dt>Knowledge snapshot</dt>
                      <dd>{measured(selected.knowledgeSnapshot)}</dd>
                    </div>
                    <div>
                      <dt>Created / received</dt>
                      <dd>{new Date(selected.receivedAt).toLocaleString()}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Statistics</h3>
                  <div className={styles.metricGrid}>
                    <div className={styles.metricTile}>
                      <span>Candidate ideas</span>
                      <strong>{selected.candidateCount}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Topics</span>
                      <strong>{selected.topics}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Audiences</span>
                      <strong>{selected.audiences}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Evidence records</span>
                      <strong>{measured(selected.evidenceRecords)}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Trends</span>
                      <strong>{measured(selected.trends)}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Duplicates removed</span>
                      <strong>{measured(selected.duplicatesRemoved)}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Overall confidence</span>
                      <strong>
                        {selected.overallConfidence != null
                          ? `${selected.overallConfidence}%`
                          : 'UNMEAS.'}
                      </strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Package size</span>
                      <strong>{selected.packageSizeBytes} B</strong>
                    </div>
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'timeline' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Package timeline</h3>
                  <ul className={styles.timeline}>
                    {selected.timeline.map((step) => (
                      <li key={step.key}>
                        <CircleDot size={14} aria-hidden />
                        <div>
                          <strong>
                            {step.label}
                            {step.done ? ' ✓' : ''}
                          </strong>
                          <span>
                            {step.at ? new Date(step.at).toLocaleString() : 'Pending / UNMEASURED'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'health' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Package health</h3>
                  <div className={styles.waterfall}>
                    {Object.entries(selected.health).map(([key, value]) => (
                      <div key={key} className={styles.waterfallRow}>
                        <span>{key}</span>
                        <div className={styles.radarBar}>
                          <div
                            className={styles.radarFill}
                            style={{ width: `${value != null ? Math.min(100, value) : 0}%` }}
                          />
                        </div>
                        <strong>{value != null ? `${value}` : 'UNMEAS.'}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'validation' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Intake validation rules</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Rule</th>
                        <th>Status</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.validationRules.map((rule) => (
                        <tr key={rule.key}>
                          <td>{rule.label}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(rule.status)}`}>
                              {rule.status}
                            </span>
                          </td>
                          <td>{rule.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'errors' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Error center</h3>
                  {selected?.errors.length ? (
                    <>
                      <p>
                        <strong>
                          Package {selected.status === 'REJECTED' ? 'Rejected' : 'At risk'}
                        </strong>
                      </p>
                      <ul className={styles.bulletList}>
                        {selected.errors.map((err) => (
                          <li key={err}>{err}</li>
                        ))}
                      </ul>
                      <h3 style={{ marginTop: 16 }}>Corrective actions</h3>
                      <ul className={styles.bulletList}>
                        {selected.correctiveActions.map((action) => (
                          <li key={action}>{action}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className={styles.lede}>
                      {selected
                        ? 'No diagnostic failures on the selected package.'
                        : 'Select a package to inspect diagnostics.'}
                    </p>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'explain' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    Why this package was{' '}
                    {selected.status === 'ACKNOWLEDGED'
                      ? 'accepted'
                      : selected.status === 'REJECTED'
                        ? 'rejected'
                        : 'held'}
                  </h3>
                  <ul className={styles.bulletList}>
                    {selected.explainability.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'knowledge' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Knowledge snapshot</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Knowledge graph version</dt>
                      <dd>{measured(selected.knowledgeSnapshot)}</dd>
                    </div>
                    <div>
                      <dt>Ontology / taxonomy / embedding</dt>
                      <dd>UNMEASURED</dd>
                    </div>
                    <div>
                      <dt>RAG snapshot</dt>
                      <dd>UNMEASURED</dd>
                    </div>
                    <div>
                      <dt>Entity / relationship counts</dt>
                      <dd>UNMEASURED</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Evidence coverage</h3>
                  <ul className={styles.bulletList}>
                    {selected.evidenceCoverage.map((row) => (
                      <li key={row.label}>
                        {row.label}: {measured(row.count)}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'analytics' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Intake analytics</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Packages received</dt>
                      <dd>{metrics?.packagesReceived ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Success rate</dt>
                      <dd>
                        {measured(metrics?.packageSuccessRate)}
                        {metrics?.packageSuccessRate != null ? '%' : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Failure rate</dt>
                      <dd>
                        {metrics?.packagesReceived
                          ? `${Math.round(
                              ((metrics.verificationFailures ?? 0) / metrics.packagesReceived) *
                                100,
                            )}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Avg validation time</dt>
                      <dd>
                        {metrics?.averageIntakeTimeMs != null
                          ? `${Math.round(metrics.averageIntakeTimeMs / 1000)}s`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                  </dl>
                </article>
                {selected && compare ? (
                  <article className={styles.detailCard}>
                    <h3>Package comparison</h3>
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Selected</th>
                          <th>Compare</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            ['Ideas', selected.candidateCount, compare.candidateCount],
                            ['Topics', selected.topics, compare.topics],
                            ['Audiences', selected.audiences, compare.audiences],
                            [
                              'Confidence',
                              selected.overallConfidence,
                              compare.overallConfidence,
                            ],
                            ['Integrity', selected.integrityStatus, compare.integrityStatus],
                            ['Status', selected.status, compare.status],
                          ] as Array<[string, string | number | null, string | number | null]>
                        ).map(([label, a, b]) => (
                          <tr key={label}>
                            <td>{label}</td>
                            <td>{display(a)}</td>
                            <td>{display(b)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </article>
                ) : (
                  <article className={styles.detailCard}>
                    <h3>Package comparison</h3>
                    <p className={styles.lede}>
                      Use Compare on a second package in the explorer to open a side-by-side view.
                    </p>
                  </article>
                )}
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Immutable audit trail</h3>
                  {!overview?.audit.length ? (
                    <p className={styles.lede}>No intake-related audit events persisted yet.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Action</th>
                          <th>Actor</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.audit.map((row) => (
                          <tr key={row.id}>
                            <td>{new Date(row.createdAt).toLocaleString()}</td>
                            <td>{row.action}</td>
                            <td>{row.actorType}</td>
                            <td>{display(row.reason)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {[
              'integrity',
              'compatibility',
              'summary',
              'timeline',
              'health',
              'validation',
              'explain',
              'knowledge',
            ].includes(tab) && !selected ? (
              <div className={styles.emptyInline}>
                <Package size={22} aria-hidden />
                <p>Select an intake package to inspect verification details.</p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.insights}`} aria-label="AI Insights">
          <div className={styles.panelHead}>
            <h2>AI Explainability</h2>
            <BrainCircuit size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightStack}>
              <article className={styles.insightCard}>
                <h3>Selected package</h3>
                <p>
                  {selected
                    ? `${selected.id.slice(0, 8)}… · ${selected.status}`
                    : 'Select a package for XAI detail.'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Integrity</h3>
                <p>{selected?.integrityStatus ?? '—'}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Why</h3>
                <ul className={styles.bulletList}>
                  {(selected?.explainability ?? ['—']).slice(0, 5).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </article>
              <article className={styles.insightCard}>
                <h3>Strategy</h3>
                <p>
                  {selected?.strategy
                    ? `v${selected.strategy.versionNumber ?? '—'} · ${selected.strategy.status}`
                    : measured(selected?.strategyVersionId)}
                </p>
              </article>
            </div>
          </div>
        </aside>
      </section>
    </motion.main>
  );
}

function PackageQueueTable({
  items,
  selectedId,
  onSelect,
}: {
  items: IntakePackageRecord[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>Live intake queue</h3>
        <table className={styles.auditTable}>
          <thead>
            <tr>
              <th>Package ID</th>
              <th>Source stage</th>
              <th>Created</th>
              <th>Ideas</th>
              <th>Evidence</th>
              <th>Confidence</th>
              <th>Status</th>
              <th>Integrity</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={selectedId === item.id ? styles.explorerItemActive : undefined}
                onClick={() => onSelect(item.id)}
              >
                <td>{item.id.slice(0, 8)}…</td>
                <td>Content Intelligence</td>
                <td>{new Date(item.receivedAt).toLocaleString()}</td>
                <td>{item.candidateCount}</td>
                <td>{measured(item.evidenceRecords)}</td>
                <td>
                  {item.overallConfidence != null ? `${item.overallConfidence}%` : 'UNMEAS.'}
                </td>
                <td>{item.status}</td>
                <td>{item.integrityStatus}</td>
                <td>Inspect</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length ? (
          <div className={styles.emptyInline}>
            <p>No packages in queue.</p>
          </div>
        ) : null}
      </article>
    </div>
  );
}
