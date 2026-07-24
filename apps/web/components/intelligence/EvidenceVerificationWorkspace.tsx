'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  FileCheck2,
  FileSearch,
  Gauge,
  GitBranch,
  Layers3,
  Link2,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  XCircle,
} from 'lucide-react';
import type {
  EvidenceVerificationOverview,
  EvidenceVerificationRecord,
} from '@/lib/content-intelligence/verification';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import styles from './evidence-verification.module.css';

type TabId =
  | 'overview'
  | 'evidence'
  | 'sources'
  | 'corroboration'
  | 'reasoning'
  | 'history'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'sources', label: 'Sources' },
  { id: 'corroboration', label: 'Corroboration' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'collect', label: 'Collect', icon: FileSearch },
  { key: 'validate', label: 'Validate', icon: FileCheck2 },
  { key: 'corroborate', label: 'Corroborate', icon: Link2 },
  { key: 'score', label: 'Score', icon: Gauge },
  { key: 'approve', label: 'Approve', icon: ShieldCheck },
  { key: 'handoff', label: 'Handoff', icon: GitBranch },
] as const;

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'PASSED':
    case 'VERIFIED':
    case 'ACCEPTED':
    case 'APPROVED':
    case 'QUALIFIED':
    case 'HANDED_OFF':
    case 'COMPLETED':
    case 'RUNNING':
    case 'ACKNOWLEDGED':
    case 'ACTIVE':
    case 'HEALTHY':
    case 'OPERATIONAL':
      return styles.toneReady;
    case 'FAILED':
    case 'REJECTED':
    case 'BLOCKED':
    case 'ARCHIVED':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'PENDING':
    case 'QUEUED':
    case 'WARNING':
    case 'WAITING':
    case 'ANALYSING':
    case 'IN_PROGRESS':
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
  return [4, 7, 5, 9, 6, 10, 8].map((base, index) => Math.max(3, ((base + seed + index * 2) % 10) + 3));
}

function isPassed(status: string) {
  const s = status.toUpperCase();
  return s === 'PASSED' || s === 'VERIFIED' || s === 'ACCEPTED' || s === 'APPROVED';
}

function isFailed(status: string) {
  const s = status.toUpperCase();
  return s === 'FAILED' || s === 'REJECTED' || s === 'BLOCKED';
}

function matchesEvidence(
  item: EvidenceVerificationRecord,
  needle: string,
  status: string,
  source: string,
  category: string,
  confidenceBand: string,
) {
  if (status !== 'all' && item.status !== status) return false;
  if (source !== 'all' && (item.sourceName ?? 'Unspecified source') !== source) return false;
  if (category !== 'all' && (item.category ?? item.domain) !== category) return false;
  if (confidenceBand === 'high' && !(item.measuredConfidence && (item.confidence ?? 0) >= 70)) {
    return false;
  }
  if (
    confidenceBand === 'medium' &&
    !(item.measuredConfidence && (item.confidence ?? 0) >= 40 && (item.confidence ?? 0) < 70)
  ) {
    return false;
  }
  if (confidenceBand === 'low' && !(item.measuredConfidence && (item.confidence ?? 0) < 40)) {
    return false;
  }
  if (confidenceBand === 'unmeasured' && item.measuredConfidence) return false;
  if (!needle) return true;
  const haystack = [
    item.opportunityTitle,
    item.claim,
    item.ruleCode,
    item.sourceName,
    item.domain,
    item.status,
    item.summary,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function lifecycleState(
  index: number,
  overview: EvidenceVerificationOverview | null,
  systemRunning: boolean,
) {
  const count = overview?.metrics.evidence ?? 0;
  const verified = overview?.metrics.verified ?? 0;
  const failed = overview?.metrics.failed ?? 0;
  const pending = overview?.metrics.pending ?? 0;
  const runStatus = overview?.run?.status;
  const hasPackage = Boolean(overview?.strategy);

  if (verified > 0 && (runStatus === 'COMPLETED' || verified >= Math.max(1, count - failed))) {
    if (index <= 4) return 'done';
    return index === 5 ? 'active' : 'pending';
  }
  if (count > 0 && (runStatus === 'RUNNING' || systemRunning || pending > 0)) {
    if (index <= 1) return 'done';
    if (index === 2) return 'active';
    return 'pending';
  }
  if (count > 0) {
    if (index <= 2) return 'done';
    if (index === 3) return verified > 0 ? 'done' : 'active';
    if (index === 4) return verified > 0 ? 'active' : 'pending';
    return 'pending';
  }
  if (hasPackage || systemRunning || runStatus === 'RUNNING' || runStatus === 'QUEUED') {
    return index === 0 ? 'active' : 'pending';
  }
  return 'pending';
}

function packageLabel(overview: EvidenceVerificationOverview | null, systemRunning: boolean) {
  if ((overview?.metrics.failed ?? 0) > 0 && (overview?.metrics.blockingFailures ?? 0) > 0) {
    return 'Failed';
  }
  if ((overview?.metrics.conflicts ?? 0) > 0 || (overview?.metrics.failed ?? 0) > 0) {
    return 'Warning';
  }
  if (overview?.run?.status === 'RUNNING' || systemRunning) {
    return (overview?.metrics.evidence ?? 0) > 0 ? 'Analysing' : 'Collecting';
  }
  if (overview?.run?.status === 'FAILED') return 'Failed';
  if ((overview?.metrics.verified ?? 0) > 0) return 'Verified';
  if ((overview?.metrics.pending ?? 0) > 0) return 'Pending';
  if ((overview?.metrics.evidence ?? 0) > 0) return 'Active';
  if (overview?.strategy) return 'Waiting';
  return 'Empty';
}

function trustGauge(value: number | null) {
  if (value == null) return { label: 'UNMEASURED', width: 0 };
  return { label: String(value), width: Math.max(4, Math.min(100, value)) };
}

export function EvidenceVerificationWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<EvidenceVerificationOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
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
        intelligenceApi.verification(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const items = next.records ?? [];
      const targetId = preferId ?? selectedId;
      const selected = targetId ? items.find((item) => item.id === targetId) : items[0];
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

  const records = overview?.records ?? [];
  const metrics = overview?.metrics;
  const needle = query.trim().toLowerCase();

  const statuses = useMemo(
    () => [...new Set(records.map((item) => item.status))].sort(),
    [records],
  );
  const sources = useMemo(
    () =>
      [
        ...new Set(
          records.map((item) => item.sourceName?.trim() || 'Unspecified source'),
        ),
      ].sort(),
    [records],
  );
  const categories = useMemo(
    () =>
      [
        ...new Set(
          records.map((item) => item.category ?? item.domain).filter(Boolean) as string[],
        ),
      ].sort(),
    [records],
  );

  const filtered = useMemo(
    () =>
      records.filter((item) =>
        matchesEvidence(
          item,
          needle,
          statusFilter,
          sourceFilter,
          categoryFilter,
          confidenceFilter,
        ),
      ),
    [records, needle, statusFilter, sourceFilter, categoryFilter, confidenceFilter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    records.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const kpis = useMemo(() => {
    const evidence = metrics?.evidence ?? 0;
    const verified = metrics?.verified ?? 0;
    const pending = metrics?.pending ?? 0;
    const failed = metrics?.failed ?? 0;
    const measuredConf = (metrics?.measuredConfidence ?? 0) > 0;
    const measuredTrust = (metrics?.measuredTrust ?? 0) > 0;
    return [
      {
        label: 'Evidence',
        value: String(evidence),
        meta: 'Persisted ci_verifications',
        accent: '#2563EB',
        icon: FileSearch,
        bars: sparkBars(evidence),
      },
      {
        label: 'Verified',
        value: String(verified),
        meta: 'PASSED / VERIFIED / APPROVED',
        accent: '#22C55E',
        icon: CheckCircle2,
        bars: sparkBars(verified),
      },
      {
        label: 'Pending',
        value: String(pending),
        meta: 'PENDING / QUEUED / RUNNING',
        accent: '#F59E0B',
        icon: Timer,
        bars: sparkBars(pending),
      },
      {
        label: 'Failed',
        value: String(failed),
        meta: 'FAILED / REJECTED / BLOCKED',
        accent: '#EF4444',
        icon: XCircle,
        bars: sparkBars(failed),
      },
      {
        label: 'Confidence',
        value: measuredConf ? String(metrics?.avgConfidence ?? 0) : 'UNMEAS.',
        meta: measuredConf
          ? `${metrics?.measuredConfidence} measured rows`
          : 'No confidence ≥ 1 persisted',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(metrics?.avgConfidence ?? 0),
      },
      {
        label: 'Source Trust',
        value: measuredTrust ? String(metrics?.avgSourceTrust ?? 0) : 'UNMEAS.',
        meta: measuredTrust
          ? `${metrics?.measuredTrust} authority/trust scores`
          : 'No trust scores persisted',
        accent: '#0EA5E9',
        icon: Scale,
        bars: sparkBars(metrics?.avgSourceTrust ?? 0),
      },
    ];
  }, [metrics]);

  const stageStatus = packageLabel(overview, systemRunning);
  const confidenceGauge = trustGauge(selected?.confidence ?? null);
  const trustSelected = trustGauge(selected?.trustScore ?? selected?.authority ?? null);

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
        <p className={styles.crumb}>
          Content Lifecycle / 02 Content Intelligence / Evidence Verification
        </p>
        <h1 className={styles.title}>Evidence Verification</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Evidence verification unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  const issues = overview?.issues ?? [];
  const audit = overview?.audit ?? [];
  const sourceRows = overview?.sources ?? [];

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 02 Content Intelligence / Evidence Verification
          </p>
          <h1 className={styles.title}>Evidence Verification</h1>
          <p className={styles.lede}>
            Autonomously validate claims, sources, recency, authority, and corroboration before
            ideas proceed to Stage 03 Idea Qualification.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 02</span>
          <span className={`${styles.badge} ${styles.toneAi}`}>System Managed</span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Observe Only</span>
          <span className={`${styles.badge} ${statusTone(stageStatus)}`}>{stageStatus}</span>
          <span className={`${styles.badge} ${statusTone(overview?.strategy?.status)}`}>
            Strategy v{overview?.strategy?.versionNumber ?? '—'}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only</strong>
          Verification rows come from persisted <code>ci_verifications</code>. Confidence, trust,
          citations, and conflicts remain UNMEASURED unless workers write them into{' '}
          <code>evidence_json</code>.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Evidence verification KPI summary">
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

      <section className={styles.lifecycle} aria-label="Evidence verification lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Verification lifecycle</h2>
          <span>
            {overview?.strategy
              ? `Package ACK · run ${overview.run?.status ?? 'IDLE'}`
              : `Awaiting Strategy package · system ${systemState}`}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {LIFECYCLE.map((stage, index) => {
            const Icon = stage.icon;
            const state = lifecycleState(index, overview, systemRunning);
            return (
              <div key={stage.key} className={styles.stage} data-state={state}>
                <span className={styles.stageIcon}>
                  <Icon size={16} aria-hidden />
                </span>
                <strong>{stage.label}</strong>
              </div>
            );
          })}
        </div>
      </section>

      {!overview?.strategy ? (
        <div className={styles.waitingBanner} role="status">
          <Timer size={18} aria-hidden />
          <div>
            <strong>Waiting for Strategy activation</strong>
            Evidence verification appears after an acknowledged Strategy package and discovery
            produces verified evidence rows.
          </div>
        </div>
      ) : null}

      {overview?.strategy && records.length === 0 ? (
        <div className={styles.waitingBanner} role="status">
          <Activity size={18} aria-hidden />
          <div>
            <strong>Collecting evidence</strong>
            No verification records are persisted yet. This workspace updates when workers write
            into <code>ci_verifications</code>.
          </div>
        </div>
      ) : null}

      <section className={styles.workspace} aria-label="Evidence verification workspace">
        <aside className={styles.panel} aria-label="Evidence Explorer">
          <div className={styles.panelHead}>
            <h2>Evidence Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search evidence verification…"
                aria-label="Search evidence verification"
              />
            </label>
            <label className={styles.field}>
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Source</span>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                aria-label="Filter by source"
              >
                <option value="all">All sources</option>
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Category</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Filter by category"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Confidence</span>
              <select
                value={confidenceFilter}
                onChange={(event) => setConfidenceFilter(event.target.value)}
                aria-label="Filter by confidence"
              >
                <option value="all">All confidence</option>
                <option value="high">High (≥70)</option>
                <option value="medium">Medium (40–69)</option>
                <option value="low">Low (&lt;40)</option>
                <option value="unmeasured">Unmeasured</option>
              </select>
            </label>

            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No persisted verification records match the current filters.</p>
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
                        setTab('overview');
                      }}
                    >
                      <span className={styles.explorerTitle}>{item.opportunityTitle}</span>
                      <span className={styles.explorerMeta}>
                        {item.ruleCode}
                        {item.sourceName ? ` · ${item.sourceName}` : ''}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                        <span className={styles.chip}>
                          {item.measuredConfidence
                            ? Math.round(item.confidence as number)
                            : 'UNMEAS.'}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Evidence Intelligence">
          <div className={styles.tabs} role="tablist" aria-label="Evidence tabs">
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
            {!selected && tab !== 'audit' && tab !== 'sources' && tab !== 'evidence' ? (
              <div className={styles.emptyInline}>
                <Layers3 size={22} aria-hidden />
                <p>
                  {overview?.strategy
                    ? 'Select evidence to inspect claims, sources, corroboration, and explainability.'
                    : 'Persisted verification appears after discovery writes ci_verifications.'}
                </p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Evidence summary</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Opportunity</dt>
                      <dd>{selected.opportunityTitle}</dd>
                    </div>
                    <div>
                      <dt>Claim</dt>
                      <dd>{selected.claim}</dd>
                    </div>
                    <div>
                      <dt>Rule</dt>
                      <dd>
                        {selected.ruleCode} v{selected.ruleVersion}
                      </dd>
                    </div>
                    <div>
                      <dt>Category</dt>
                      <dd>{display(selected.category ?? selected.domain)}</dd>
                    </div>
                    <div>
                      <dt>Verification status</dt>
                      <dd>{selected.status}</dd>
                    </div>
                    <div>
                      <dt>Severity</dt>
                      <dd>
                        {selected.severity}
                        {selected.blocking ? ' · blocking' : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Next stage</dt>
                      <dd>{selected.nextStage}</dd>
                    </div>
                    <div>
                      <dt>Checked</dt>
                      <dd>{new Date(selected.checkedAt).toLocaleString()}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Trust gauges</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Confidence</dt>
                      <dd>{selected.measuredConfidence ? confidenceGauge.label : 'UNMEASURED'}</dd>
                    </div>
                    <div>
                      <dt>Source trust</dt>
                      <dd>{selected.trustScore != null || selected.authority != null ? trustSelected.label : 'UNMEASURED'}</dd>
                    </div>
                    <div>
                      <dt>Authority</dt>
                      <dd>{measured(selected.authority)}</dd>
                    </div>
                    <div>
                      <dt>Recency (hours)</dt>
                      <dd>{measured(selected.recencyHours)}</dd>
                    </div>
                    <div>
                      <dt>Corroboration count</dt>
                      <dd>{measured(selected.corroborationCount)}</dd>
                    </div>
                  </dl>
                  <div className={styles.timelineStrip} aria-hidden>
                    <div className={styles.timelineAxis}>
                      <div
                        className={styles.timelineBand}
                        style={{
                          width: `${selected.measuredConfidence ? confidenceGauge.width : 0}%`,
                          background: 'var(--primary)',
                        }}
                      />
                    </div>
                    <div className={styles.timelineLabels}>
                      <span>Confidence</span>
                      <span>{selected.measuredConfidence ? `${confidenceGauge.width}%` : '—'}</span>
                    </div>
                    <div className={styles.timelineAxis}>
                      <div
                        className={styles.timelineBand}
                        style={{
                          width: `${selected.trustScore != null || selected.authority != null ? trustSelected.width : 0}%`,
                          background: 'var(--success)',
                        }}
                      />
                    </div>
                    <div className={styles.timelineLabels}>
                      <span>Trust</span>
                      <span>
                        {selected.trustScore != null || selected.authority != null
                          ? `${trustSelected.width}%`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </article>
                <article className={styles.detailCard}>
                  <h3>Notes</h3>
                  <p>{selected.summary ?? 'No explanation persisted in evidence_json.'}</p>
                </article>
              </div>
            ) : null}

            {tab === 'evidence' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Evidence table</h3>
                  {!filtered.length ? (
                    <p className={styles.lede}>No evidence rows to display.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Opportunity</th>
                          <th scope="col">Claim</th>
                          <th scope="col">Status</th>
                          <th scope="col">Confidence</th>
                          <th scope="col">Trust</th>
                          <th scope="col">Conflicts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice(0, 40).map((item) => (
                          <tr key={item.id}>
                            <td>{item.opportunityTitle}</td>
                            <td>{item.claim.slice(0, 80)}{item.claim.length > 80 ? '…' : ''}</td>
                            <td>{item.status}</td>
                            <td>
                              {item.measuredConfidence
                                ? Math.round(item.confidence as number)
                                : 'UNMEASURED'}
                            </td>
                            <td>{measured(item.trustScore ?? item.authority)}</td>
                            <td>{item.conflicts.length}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'sources' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Source attribution</h3>
                  {!sourceRows.length ? (
                    <p className={styles.lede}>No source attributions on verification rows yet.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">Source</th>
                          <th scope="col">Checks</th>
                          <th scope="col">Passed</th>
                          <th scope="col">Failed</th>
                          <th scope="col">Avg authority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sourceRows.map((row) => (
                          <tr key={`${row.sourceId ?? ''}|${row.sourceName}`}>
                            <td>{row.sourceName}</td>
                            <td>{row.verificationCount}</td>
                            <td>{row.passed}</td>
                            <td>{row.failed}</td>
                            <td>{measured(row.avgAuthority)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
                {selected ? (
                  <article className={styles.detailCard}>
                    <h3>Selected source</h3>
                    <dl className={styles.kv}>
                      <div>
                        <dt>Name</dt>
                        <dd>{display(selected.sourceName)}</dd>
                      </div>
                      <div>
                        <dt>Source ID</dt>
                        <dd>{display(selected.sourceId)}</dd>
                      </div>
                      <div>
                        <dt>Authority</dt>
                        <dd>{measured(selected.authority)}</dd>
                      </div>
                      <div>
                        <dt>Recency</dt>
                        <dd>{measured(selected.recencyHours)}</dd>
                      </div>
                    </dl>
                  </article>
                ) : null}
              </div>
            ) : null}

            {selected && tab === 'corroboration' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Multi-source validation</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Corroboration count</dt>
                      <dd>{measured(selected.corroborationCount)}</dd>
                    </div>
                    <div>
                      <dt>Citations</dt>
                      <dd>{selected.citations.length || 'UNMEASURED'}</dd>
                    </div>
                    <div>
                      <dt>Conflicts</dt>
                      <dd>{selected.conflicts.length}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Citations</h3>
                  {!selected.citations.length ? (
                    <p className={styles.lede}>No citation URLs persisted.</p>
                  ) : (
                    <ul className={styles.bulletList}>
                      {selected.citations.map((citation) => (
                        <li key={citation}>{citation}</li>
                      ))}
                    </ul>
                  )}
                </article>
                <article className={styles.detailCard}>
                  <h3>Contradiction analysis</h3>
                  {!selected.conflicts.length ? (
                    <p className={styles.lede}>No contradictions recorded for this evidence row.</p>
                  ) : (
                    <ul className={styles.bulletList}>
                      {selected.conflicts.map((conflict) => (
                        <li key={conflict}>{conflict}</li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>AI explainability</h3>
                  <p>
                    {selected.summary ??
                      'Workers did not persist an explanation. Rule outcome and severity remain the authoritative record.'}
                  </p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Rule</dt>
                      <dd>
                        {selected.ruleCode} v{selected.ruleVersion}
                      </dd>
                    </div>
                    <div>
                      <dt>Outcome</dt>
                      <dd>
                        {selected.status} · {selected.severity}
                        {selected.blocking ? ' · blocking' : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Trace ID</dt>
                      <dd>{selected.id}</dd>
                    </div>
                    <div>
                      <dt>Opportunity</dt>
                      <dd>{selected.opportunityId}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Fact-check posture</h3>
                  <ul className={styles.bulletList}>
                    <li>
                      Claim status:{' '}
                      {isPassed(selected.status)
                        ? 'Accepted by verification rule'
                        : isFailed(selected.status)
                          ? 'Rejected / blocked'
                          : 'Pending validation'}
                    </li>
                    <li>
                      Duplicate risk:{' '}
                      {issues.some((issue) => issue.code === 'DUPLICATE_EVIDENCE')
                        ? 'Similar claims detected in portfolio'
                        : 'No duplicate-claim alert on this load'}
                    </li>
                    <li>
                      Conflict signal:{' '}
                      {selected.conflicts.length > 0 ? 'Conflicts present' : 'No conflicts listed'}
                    </li>
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Raw evidence keys</h3>
                  {Object.keys(selected.evidenceJson).length ? (
                    <dl className={styles.kv}>
                      {Object.entries(selected.evidenceJson)
                        .slice(0, 12)
                        .map(([key, value]) => (
                          <div key={key}>
                            <dt>{key}</dt>
                            <dd>
                              {typeof value === 'string' || typeof value === 'number'
                                ? String(value)
                                : JSON.stringify(value)}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  ) : (
                    <p className={styles.lede}>evidence_json is empty for this row.</p>
                  )}
                </article>
              </div>
            ) : null}

            {selected && tab === 'history' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Verification timeline</h3>
                  <ul className={styles.timeline}>
                    <li>
                      <CircleDot size={14} aria-hidden />
                      <div>
                        <strong>Checked</strong>
                        <span>{new Date(selected.checkedAt).toLocaleString()}</span>
                      </div>
                    </li>
                    <li>
                      <RefreshCw size={14} aria-hidden />
                      <div>
                        <strong>Current outcome</strong>
                        <span>
                          {selected.status} · {selected.severity}
                        </span>
                      </div>
                    </li>
                    <li>
                      <CheckCircle2 size={14} aria-hidden />
                      <div>
                        <strong>Next stage</strong>
                        <span>{selected.nextStage}</span>
                      </div>
                    </li>
                    <li>
                      <GitBranch size={14} aria-hidden />
                      <div>
                        <strong>Opportunity status</strong>
                        <span>{selected.opportunityStatus}</span>
                      </div>
                    </li>
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Audit trail</h3>
                  {!audit.length ? (
                    <p className={styles.lede}>No verification-related audit events persisted yet.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th scope="col">When</th>
                          <th scope="col">Action</th>
                          <th scope="col">Actor</th>
                          <th scope="col">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.map((row) => (
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
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.insights}`} aria-label="AI Insights">
          <div className={styles.panelHead}>
            <h2>AI Insights</h2>
            <BrainCircuit size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightStack}>
              <article className={styles.insightCard}>
                <h3>Credibility</h3>
                <p>
                  Confidence{' '}
                  {selected?.measuredConfidence
                    ? Math.round(selected.confidence as number)
                    : 'UNMEASURED'}{' '}
                  · trust {measured(selected?.trustScore ?? selected?.authority)} · authority{' '}
                  {measured(selected?.authority)}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Risks</h3>
                <p>
                  Failed {metrics?.failed ?? 0} · blocking {metrics?.blockingFailures ?? 0} ·
                  conflicts {metrics?.conflicts ?? 0}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Recommendations</h3>
                <ul className={styles.bulletList}>
                  {!overview?.strategy ? (
                    <li>Acknowledge Strategy package to unlock evidence collection.</li>
                  ) : null}
                  {overview?.strategy && records.length === 0 ? (
                    <li>Keep system RUNNING until discovery persists verification rows.</li>
                  ) : null}
                  {(metrics?.verified ?? 0) > 0 ? (
                    <li>Verified evidence can proceed toward Stage 03 Idea Qualification.</li>
                  ) : null}
                  {(metrics?.blockingFailures ?? 0) > 0 ? (
                    <li>Resolve blocking verification failures before qualification handoff.</li>
                  ) : null}
                  {(metrics?.conflicts ?? 0) > 0 ? (
                    <li>Review contradiction alerts before approving conflicting claims.</li>
                  ) : null}
                  {selected && isFailed(selected.status) ? (
                    <li>Selected evidence is in recovery — re-run verification after source fixes.</li>
                  ) : null}
                </ul>
              </article>
              <article className={styles.insightCard}>
                <h3>Alerts</h3>
                {!issues.length ? (
                  <p>No open verification anomalies in persisted state.</p>
                ) : (
                  <ul className={styles.bulletList}>
                    {issues.slice(0, 6).map((issue) => (
                      <li key={issue.id}>
                        [{issue.severity}] {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.bottom} aria-label="Verification monitoring">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Health monitoring</h2>
            <AlertTriangle size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Verified</dt>
                <dd>{metrics?.verified ?? 0}</dd>
              </div>
              <div>
                <dt>Pending</dt>
                <dd>{metrics?.pending ?? 0}</dd>
              </div>
              <div>
                <dt>Failed</dt>
                <dd>{metrics?.failed ?? 0}</dd>
              </div>
              <div>
                <dt>Blocking</dt>
                <dd>{metrics?.blockingFailures ?? 0}</dd>
              </div>
            </dl>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Traceability</h2>
            <RefreshCw size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              Each verification row links an opportunity, rule code, severity, and optional
              evidence_json. This page is observe-only — Start/Pause/Resume/Stop remain global.
            </p>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Stage 03 readiness</h2>
            <CheckCircle2 size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Verified evidence</dt>
                <dd>{metrics?.verified ?? 0}</dd>
              </div>
              <div>
                <dt>Blocking failures</dt>
                <dd>{metrics?.blockingFailures ?? 0}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>
                  {overview?.lastUpdated
                    ? new Date(overview.lastUpdated).toLocaleString()
                    : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </article>
      </section>
    </motion.main>
  );
}
