'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Database,
  FileSearch,
  Gauge,
  GitBranch,
  HeartPulse,
  Layers3,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';
import type {
  RegisteredSource,
  SourceRegistryOverview,
} from '@/lib/content-intelligence/sources';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import styles from './source-registry.module.css';

type TabId =
  | 'overview'
  | 'registered'
  | 'providers'
  | 'rules'
  | 'reasoning'
  | 'dependencies'
  | 'history'
  | 'audit';

type FilterId =
  | 'all'
  | 'active'
  | 'healthy'
  | 'failed'
  | 'approved'
  | 'pending'
  | 'deprioritised';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'registered', label: 'Registered Sources' },
  { id: 'providers', label: 'Provider Health' },
  { id: 'rules', label: 'Discovery Rules' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'register', label: 'Register', icon: Database },
  { key: 'validate', label: 'Validate', icon: FileSearch },
  { key: 'monitor', label: 'Monitor', icon: Activity },
  { key: 'score', label: 'Score', icon: Gauge },
  { key: 'approve', label: 'Approve', icon: ShieldCheck },
  { key: 'sync', label: 'Sync', icon: RefreshCw },
  { key: 'discover', label: 'Discover', icon: Radio },
] as const;

function statusTone(status?: string | null) {
  switch (status) {
    case 'ACTIVE':
    case 'HEALTHY':
    case 'READY':
    case 'COMPLETED':
    case 'RUNNING':
    case 'ACKNOWLEDGED':
    case 'APPROVED':
    case 'Healthy':
    case 'Completed':
      return styles.toneReady;
    case 'FAILED':
    case 'OFFLINE':
    case 'ERROR':
    case 'REJECTED':
    case 'Failed':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'MAINTENANCE':
    case 'WARNING':
    case 'PARTIAL':
    case 'QUEUED':
    case 'PAUSED':
    case 'DEPRIORITISED':
    case 'PENDING':
    case 'Running':
    case 'Waiting':
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

function matchesSource(item: RegisteredSource, needle: string, filter: FilterId) {
  if (filter === 'active' && item.status !== 'ACTIVE' && item.status !== 'HEALTHY') return false;
  if (filter === 'healthy' && item.status !== 'ACTIVE' && item.status !== 'HEALTHY') return false;
  if (
    filter === 'failed' &&
    item.status !== 'FAILED' &&
    item.status !== 'OFFLINE' &&
    item.status !== 'ERROR'
  ) {
    return false;
  }
  if (filter === 'approved' && item.configuration.approvalState !== 'APPROVED') return false;
  if (filter === 'pending' && item.configuration.approvalState !== 'PENDING') return false;
  if (filter === 'deprioritised' && item.configuration.approvalState !== 'DEPRIORITISED') {
    return false;
  }
  if (!needle) return true;
  const haystack = [
    item.name,
    item.sourceType,
    item.configuration.category,
    item.configuration.provider,
    item.configuration.region,
    item.configuration.language,
    item.status,
    item.configuration.approvalState,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function lifecycleState(
  index: number,
  registry: SourceRegistryOverview | null,
  systemRunning: boolean,
) {
  const count = registry?.metrics.registered ?? 0;
  const runStatus = registry?.run?.status;
  const hasPackage = Boolean(registry?.strategy);

  if (count > 0 && runStatus === 'COMPLETED') {
    return 'done';
  }
  if (count > 0 && (runStatus === 'RUNNING' || runStatus === 'QUEUED' || systemRunning)) {
    if (index <= 5) return 'done';
    return index === 6 ? 'active' : 'pending';
  }
  if (count > 0) {
    if (index <= 4) return 'done';
    if (index === 5) return 'active';
    return 'pending';
  }
  if (hasPackage || systemRunning || runStatus === 'RUNNING' || runStatus === 'QUEUED') {
    if (index === 0) return 'active';
    return 'pending';
  }
  return 'pending';
}

function packageLabel(registry: SourceRegistryOverview | null, systemRunning: boolean) {
  if (registry?.run?.status === 'COMPLETED') return 'Completed';
  if (registry?.run?.status === 'RUNNING' || systemRunning) return 'Syncing';
  if (registry?.run?.status === 'FAILED') return 'Failed';
  if (registry?.run?.status === 'PARTIAL') return 'Partial';
  if ((registry?.metrics.failed ?? 0) > 0) return 'Warning';
  if ((registry?.metrics.registered ?? 0) > 0) return 'Healthy';
  if (registry?.strategy) return 'Waiting';
  return 'Empty';
}

export function SourceRegistryWorkspace() {
  const reduceMotion = useReducedMotion();
  const [registry, setRegistry] = useState<SourceRegistryOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
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
        intelligenceApi.sources(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setRegistry(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const items = next.sources ?? [];
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

  const sources = registry?.sources ?? [];
  const metrics = registry?.metrics;
  const needle = query.trim().toLowerCase();

  const providers = useMemo(
    () => [...new Set(sources.map((item) => item.configuration.provider))].sort(),
    [sources],
  );
  const categories = useMemo(
    () => [...new Set(sources.map((item) => item.configuration.category))].sort(),
    [sources],
  );
  const regions = useMemo(
    () => [...new Set(sources.map((item) => item.configuration.region))].sort(),
    [sources],
  );

  const filtered = useMemo(
    () =>
      sources.filter((item) => {
        if (providerFilter !== 'all' && item.configuration.provider !== providerFilter) {
          return false;
        }
        if (categoryFilter !== 'all' && item.configuration.category !== categoryFilter) {
          return false;
        }
        if (regionFilter !== 'all' && item.configuration.region !== regionFilter) {
          return false;
        }
        return matchesSource(item, needle, filter);
      }),
    [sources, needle, filter, providerFilter, categoryFilter, regionFilter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    sources.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const kpis = useMemo(() => {
    const registered = metrics?.registered ?? 0;
    const activeProviders = metrics?.activeProviders ?? 0;
    const healthy = metrics?.healthy ?? 0;
    const failed = metrics?.failed ?? 0;
    const readiness = metrics?.discoveryReadiness ?? 0;
    const measuredConfidence = (metrics?.measuredConfidence ?? 0) > 0;
    return [
      {
        label: 'Registered Sources',
        value: String(registered),
        meta: 'Persisted registry rows',
        accent: '#2563EB',
        icon: Database,
        bars: sparkBars(registered),
      },
      {
        label: 'Active Providers',
        value: String(activeProviders),
        meta: 'Distinct provider groups',
        accent: '#0EA5E9',
        icon: Server,
        bars: sparkBars(activeProviders),
      },
      {
        label: 'Healthy Sources',
        value: String(healthy),
        meta: 'ACTIVE / HEALTHY status',
        accent: '#22C55E',
        icon: HeartPulse,
        bars: sparkBars(healthy),
      },
      {
        label: 'Failed Sources',
        value: String(failed),
        meta: 'Offline or failed providers',
        accent: '#EF4444',
        icon: AlertTriangle,
        bars: sparkBars(failed),
      },
      {
        label: 'AI Confidence',
        value: measuredConfidence ? String(metrics?.avgConfidence ?? 0) : 'UNMEAS.',
        meta: measuredConfidence
          ? `${metrics?.measuredConfidence} measured source scores`
          : 'No measured confidence yet',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(metrics?.avgConfidence ?? 0),
      },
      {
        label: 'Discovery Readiness',
        value: `${readiness}%`,
        meta: 'Healthy share of registry',
        accent: '#F59E0B',
        icon: Gauge,
        bars: sparkBars(readiness),
      },
    ];
  }, [metrics]);

  const stageStatus = packageLabel(registry, systemRunning);

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
      };

  if (busy && !registry) {
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

  if (error || (registry && !registry.available)) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Content Lifecycle / 02 Content Intelligence / Source Registry</p>
        <h1 className={styles.title}>Source Registry & Provider Intelligence</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Source registry unavailable</h2>
          <p>{error || registry?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  const issues = registry?.issues ?? [];
  const audit = registry?.audit ?? [];

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>Content Lifecycle / 02 Content Intelligence / Source Registry</p>
          <h1 className={styles.title}>Source Registry & Provider Intelligence</h1>
          <p className={styles.lede}>
            Autonomously register, validate, and monitor trusted discovery sources so Stage 02 can
            collect evidence-backed signals under the active Strategy package.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 02</span>
          <span className={`${styles.badge} ${styles.toneAi}`}>System Managed</span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Observe Only</span>
          <span className={`${styles.badge} ${statusTone(stageStatus)}`}>{stageStatus}</span>
          <span className={`${styles.badge} ${statusTone(registry?.strategy?.status)}`}>
            Strategy v{registry?.strategy?.versionNumber ?? '—'}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only</strong>
          Sources are discovered, validated, monitored, and updated automatically after a Strategy
          package is acknowledged. Runtime health and confidence stay UNMEASURED until discovery
          writes measured values.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Source registry KPI summary">
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

      <section className={styles.lifecycle} aria-label="Source registry lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Source lifecycle</h2>
          <span>
            {registry?.strategy
              ? `Package ACK · run ${registry.run?.status ?? 'IDLE'}`
              : `Awaiting Strategy package · system ${systemState}`}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {LIFECYCLE.map((stage, index) => {
            const Icon = stage.icon;
            const state = lifecycleState(index, registry, systemRunning);
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

      {!registry?.strategy ? (
        <div className={styles.waitingBanner} role="status">
          <Timer size={18} aria-hidden />
          <div>
            <strong>Waiting for Strategy activation</strong>
            The source registry materialises automatically once Stage 01 hands off an acknowledged
            Strategy package. No production provider metrics are fabricated while waiting.
          </div>
        </div>
      ) : null}

      {(metrics?.registered ?? 0) === 0 && registry?.strategy ? (
        <div className={styles.waitingBanner} role="status">
          <RefreshCw size={18} aria-hidden />
          <div>
            <strong>Registering source categories</strong>
            System source slots are being reconciled from the Stage 01 evidence ladder. Refresh will
            show persisted registry rows.
          </div>
        </div>
      ) : null}

      <section className={styles.workspace} aria-label="Source intelligence workspace">
        <aside className={`${styles.panel} ${styles.explorer}`} aria-label="Source Explorer">
          <div className={styles.panelHead}>
            <h2>Source Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search sources, providers, regions…"
                aria-label="Search source registry"
              />
            </label>
            <label className={styles.field}>
              <span>Status</span>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as FilterId)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="healthy">Healthy</option>
                <option value="failed">Failed</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending approval</option>
                <option value="deprioritised">Deprioritised</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Provider</span>
              <select
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value)}
                aria-label="Filter by provider"
              >
                <option value="all">All providers</option>
                {providers.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
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
              <span>Region</span>
              <select
                value={regionFilter}
                onChange={(event) => setRegionFilter(event.target.value)}
                aria-label="Filter by region"
              >
                <option value="all">All regions</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </label>

            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No persisted sources match the current filters.</p>
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
                      <span className={styles.explorerTitle}>{item.name}</span>
                      <span className={styles.explorerMeta}>
                        {item.configuration.provider} · {item.configuration.category}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                        <span
                          className={`${styles.chip} ${statusTone(item.configuration.approvalState)}`}
                        >
                          {item.configuration.approvalState}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Source Intelligence">
          <div className={styles.tabs} role="tablist" aria-label="Source intelligence tabs">
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
            {!selected && tab !== 'audit' && tab !== 'dependencies' && tab !== 'providers' ? (
              <div className={styles.emptyInline}>
                <Layers3 size={22} aria-hidden />
                <p>
                  {registry?.strategy
                    ? 'Select a registered source to inspect provider intelligence.'
                    : 'Persisted sources appear after Strategy package acknowledgement.'}
                </p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Source profile</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Name</dt>
                      <dd>{selected.name}</dd>
                    </div>
                    <div>
                      <dt>Type</dt>
                      <dd>{selected.sourceType}</dd>
                    </div>
                    <div>
                      <dt>Provider</dt>
                      <dd>{selected.configuration.provider}</dd>
                    </div>
                    <div>
                      <dt>Category</dt>
                      <dd>{selected.configuration.category}</dd>
                    </div>
                    <div>
                      <dt>Region</dt>
                      <dd>{selected.configuration.region}</dd>
                    </div>
                    <div>
                      <dt>Language</dt>
                      <dd>{selected.configuration.language}</dd>
                    </div>
                    <div>
                      <dt>Update frequency</dt>
                      <dd>{selected.configuration.updateFrequency}</dd>
                    </div>
                    <div>
                      <dt>Base URL</dt>
                      <dd>{display(selected.baseUrl)}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Health & quality</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Status</dt>
                      <dd>{selected.status}</dd>
                    </div>
                    <div>
                      <dt>Measured authority</dt>
                      <dd>{measured(selected.authorityScore)}</dd>
                    </div>
                    <div>
                      <dt>Policy authority band</dt>
                      <dd>{measured(selected.configuration.authorityBand)}</dd>
                    </div>
                    <div>
                      <dt>Freshness</dt>
                      <dd>{measured(selected.configuration.freshness)}</dd>
                    </div>
                    <div>
                      <dt>Reliability</dt>
                      <dd>{measured(selected.configuration.reliability)}</dd>
                    </div>
                    <div>
                      <dt>Availability</dt>
                      <dd>{measured(selected.configuration.availability)}</dd>
                    </div>
                    <div>
                      <dt>API status</dt>
                      <dd>{measured(selected.configuration.apiStatus)}</dd>
                    </div>
                    <div>
                      <dt>Evidence score</dt>
                      <dd>{measured(selected.configuration.evidenceScore)}</dd>
                    </div>
                    <div>
                      <dt>Last sync</dt>
                      <dd>{measured(selected.configuration.lastSync)}</dd>
                    </div>
                    <div>
                      <dt>Linked signals</dt>
                      <dd>{selected.signalCount}</dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Governance</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Approval</dt>
                      <dd>{selected.configuration.approvalState}</dd>
                    </div>
                    <div>
                      <dt>Authentication</dt>
                      <dd>{selected.configuration.authentication}</dd>
                    </div>
                    <div>
                      <dt>Rate limits</dt>
                      <dd>{selected.configuration.rateLimits}</dd>
                    </div>
                    <div>
                      <dt>Licensing</dt>
                      <dd>{selected.configuration.licensing}</dd>
                    </div>
                    <div>
                      <dt>Copyright</dt>
                      <dd>{selected.configuration.copyright}</dd>
                    </div>
                    <div>
                      <dt>Discovery priority</dt>
                      <dd>{selected.configuration.discoveryPriority}</dd>
                    </div>
                    <div>
                      <dt>Evidence class</dt>
                      <dd>{selected.configuration.evidenceClass}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{new Date(selected.updatedAt).toLocaleString()}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {selected && tab === 'registered' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Registered source record</h3>
                  <p className={styles.lede}>{selected.configuration.reasoning}</p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>System key</dt>
                      <dd>{selected.configuration.systemKey}</dd>
                    </div>
                    <div>
                      <dt>Origin</dt>
                      <dd>{selected.configuration.origin}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Row id</dt>
                      <dd>{selected.id}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'providers' ? (
              <div className={styles.detailGrid}>
                {providers.length === 0 ? (
                  <div className={styles.emptyInline}>
                    <p>No provider groups persisted yet.</p>
                  </div>
                ) : (
                  providers.map((provider) => {
                    const group = sources.filter((item) => item.configuration.provider === provider);
                    const healthy = group.filter(
                      (item) => item.status === 'ACTIVE' || item.status === 'HEALTHY',
                    ).length;
                    const failed = group.filter(
                      (item) =>
                        item.status === 'FAILED' ||
                        item.status === 'OFFLINE' ||
                        item.status === 'ERROR',
                    ).length;
                    return (
                      <article key={provider} className={styles.detailCard}>
                        <h3>{provider}</h3>
                        <dl className={styles.kv}>
                          <div>
                            <dt>Sources</dt>
                            <dd>{group.length}</dd>
                          </div>
                          <div>
                            <dt>Healthy</dt>
                            <dd>{healthy}</dd>
                          </div>
                          <div>
                            <dt>Failed</dt>
                            <dd>{failed}</dd>
                          </div>
                          <div>
                            <dt>Coverage</dt>
                            <dd>
                              {group.length
                                ? `${Math.round((healthy / group.length) * 100)}%`
                                : 'UNMEASURED'}
                            </dd>
                          </div>
                        </dl>
                      </article>
                    );
                  })
                )}
              </div>
            ) : null}

            {selected && tab === 'rules' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Discovery rules</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Evidence class gate</dt>
                      <dd>{selected.configuration.evidenceClass}</dd>
                    </div>
                    <div>
                      <dt>Approval workflow</dt>
                      <dd>{selected.configuration.approvalState}</dd>
                    </div>
                    <div>
                      <dt>Priority for discovery</dt>
                      <dd>{selected.configuration.discoveryPriority}</dd>
                    </div>
                    <div>
                      <dt>Auth requirement</dt>
                      <dd>{selected.configuration.authentication}</dd>
                    </div>
                    <div>
                      <dt>Rate-limit policy</dt>
                      <dd>{selected.configuration.rateLimits}</dd>
                    </div>
                    <div>
                      <dt>Rights / licence</dt>
                      <dd>
                        {selected.configuration.licensing} · {selected.configuration.copyright}
                      </dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Evidence policy compliance</h3>
                  <p>
                    Restricted/social classes cannot be sole evidence. Approved institutional and
                    scholarly classes may feed discovery immediately after Strategy acknowledgement.
                  </p>
                </article>
              </div>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Why this source is {selected.configuration.approvalState.toLowerCase()}</h3>
                  <p>{selected.configuration.reasoning}</p>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Confidence</dt>
                      <dd>{measured(selected.configuration.confidence)}</dd>
                    </div>
                    <div>
                      <dt>Supporting signals</dt>
                      <dd>{selected.signalCount}</dd>
                    </div>
                    <div>
                      <dt>Evidence class</dt>
                      <dd>{selected.configuration.evidenceClass}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'dependencies' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Upstream</h3>
                  <ul className={styles.bulletList}>
                    <li>Stage 01 Strategy package (ACTIVE → ACK)</li>
                    <li>Source / evidence ladder policy</li>
                    <li>Global system control (RUNNING)</li>
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Downstream</h3>
                  <ul className={styles.bulletList}>
                    <li>Discovery runs & signal capture</li>
                    <li>Trend / audience / gap intelligence</li>
                    <li>Candidate generation & verification</li>
                    <li>Stage 03 Idea Qualification handoff</li>
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Version reference</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Strategy version</dt>
                      <dd>v{registry?.strategy?.versionNumber ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Checksum</dt>
                      <dd>{display(registry?.strategy?.checksum?.slice(0, 12))}…</dd>
                    </div>
                    <div>
                      <dt>Run</dt>
                      <dd>{display(registry?.run?.id?.slice(0, 8))}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {selected && tab === 'history' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Source timeline</h3>
                  <ul className={styles.timeline}>
                    <li>
                      <CircleDot size={14} aria-hidden />
                      <div>
                        <strong>Registered</strong>
                        <span>{new Date(selected.createdAt).toLocaleString()}</span>
                      </div>
                    </li>
                    <li>
                      <RefreshCw size={14} aria-hidden />
                      <div>
                        <strong>Last registry update</strong>
                        <span>{new Date(selected.updatedAt).toLocaleString()}</span>
                      </div>
                    </li>
                    <li>
                      <Activity size={14} aria-hidden />
                      <div>
                        <strong>Last measured sync</strong>
                        <span>{measured(selected.configuration.lastSync)}</span>
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
                    <p className={styles.lede}>No source-related audit events persisted yet.</p>
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
                <h3>Provider health</h3>
                <p>
                  {metrics?.healthy ?? 0} healthy · {metrics?.failed ?? 0} failed · readiness{' '}
                  {metrics?.discoveryReadiness ?? 0}%
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Credibility</h3>
                <p>
                  Measured authority:{' '}
                  {selected?.authorityScore != null
                    ? selected.authorityScore
                    : 'UNMEASURED'}
                  {selected?.configuration.authorityBand != null
                    ? ` · policy band ${selected.configuration.authorityBand}`
                    : ''}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Freshness</h3>
                <p>{measured(selected?.configuration.freshness)}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Coverage</h3>
                <p>
                  {metrics?.registered ?? 0} categories registered · {metrics?.signalLinks ?? 0}{' '}
                  linked signals
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Recommendations</h3>
                <ul className={styles.bulletList}>
                  {!registry?.strategy ? (
                    <li>Activate and hand off Stage 01 Strategy to unlock registry reconcile.</li>
                  ) : null}
                  {(metrics?.failed ?? 0) > 0 ? (
                    <li>Investigate failed/offline providers before expanding discovery scope.</li>
                  ) : null}
                  {(metrics?.measuredConfidence ?? 0) === 0 ? (
                    <li>
                      Confidence remains UNMEASURED until discovery runs write measured provider
                      scores.
                    </li>
                  ) : null}
                  {selected?.configuration.approvalState === 'DEPRIORITISED' ? (
                    <li>
                      Selected source is deprioritised — require higher-ladder corroboration for
                      factual claims.
                    </li>
                  ) : null}
                  {(metrics?.registered ?? 0) > 0 && (metrics?.failed ?? 0) === 0 ? (
                    <li>Registry is ready for discovery when the autonomous run is RUNNING.</li>
                  ) : null}
                </ul>
              </article>
              <article className={styles.insightCard}>
                <h3>Detected issues</h3>
                {!issues.length ? (
                  <p>No open source anomalies in persisted registry state.</p>
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

      <section className={styles.bottom} aria-label="Source health monitoring">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Health monitoring</h2>
            <GitBranch size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Approved</dt>
                <dd>{metrics?.approved ?? 0}</dd>
              </div>
              <div>
                <dt>Pending</dt>
                <dd>{metrics?.pending ?? 0}</dd>
              </div>
              <div>
                <dt>System control</dt>
                <dd>{systemState}</dd>
              </div>
              <div>
                <dt>Discovery run</dt>
                <dd>{registry?.run?.status ?? 'IDLE'}</dd>
              </div>
            </dl>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Recovery posture</h2>
            <ShieldCheck size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <p>
              {(metrics?.failed ?? 0) > 0
                ? 'Failed providers remain visible for automatic recovery once credentials or endpoints restore. No manual edits on this page.'
                : 'No failed providers in the persisted registry. Automatic recovery idle.'}
            </p>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Performance</h2>
            <CheckCircle2 size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <dl className={styles.kv}>
              <div>
                <dt>Readiness</dt>
                <dd>{metrics?.discoveryReadiness ?? 0}%</dd>
              </div>
              <div>
                <dt>Signal links</dt>
                <dd>{metrics?.signalLinks ?? 0}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>
                  {registry?.lastUpdated
                    ? new Date(registry.lastUpdated).toLocaleString()
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
