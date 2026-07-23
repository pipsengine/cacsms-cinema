'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { FolderTree, Network, ShieldAlert, Tag } from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  buildTaxonomyTree,
  configDisplay,
  fieldLabel,
  flattenTaxonomyTree,
  isBaselineStub,
  taxonomyFieldKeys,
} from '@/apps/web/lib/strategy-taxonomy';
import styles from './taxonomy.module.css';

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

function display(value: string | undefined) {
  if (!value) return '—';
  if (value === 'UNMEASURED') return 'UNMEASURED';
  return value;
}

function relativeRefresh(iso: string | null, now: number) {
  if (!iso) return '—';
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export function TaxonomyWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const systemRunning = systemState === 'RUNNING';
  const fieldKeys = useMemo(() => taxonomyFieldKeys(), []);

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
      const list = (await strategyApi.list(next.versionId, 'taxonomy')).filter(
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) => {
      const config = record.configuration ?? {};
      const haystack = [
        record.name,
        record.status,
        record.description,
        configDisplay(config, 'nodeType'),
        configDisplay(config, 'keywords'),
        configDisplay(config, 'synonyms'),
        configDisplay(config, 'parentId'),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [records, query]);

  const flatNodes = useMemo(
    () => flattenTaxonomyTree(buildTaxonomyTree(filtered)),
    [filtered],
  );

  const selected = records.find((item) => item.id === selectedId) ?? null;
  const selectedConfig = selected?.configuration ?? {};
  const sectionMeta = overview?.sections?.find((item) => item.key === 'taxonomy');
  const sectionProgress =
    typeof sectionMeta?.progress === 'number' ? Math.round(sectionMeta.progress) : null;

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
      };

  if (busy && !overview) {
    return (
      <main className={styles.page}>
        <div className={styles.skeletonTop} />
        <div className={styles.skeletonGrid}>
          <div className={styles.skeletonPanel} />
          <div className={styles.skeletonPanel} />
        </div>
      </main>
    );
  }

  if (error || !overview?.available) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Strategy & Fields / Subject & Subfield Taxonomy</p>
        <h1 className={styles.title}>Subject & Subfield Taxonomy</h1>
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
      <header className={styles.top}>
        <div>
          <p className={styles.crumb}>
            Strategy & Fields
            <span aria-hidden> / </span>
            Subject & Subfield Taxonomy
          </p>
          <h1 className={styles.title}>Subject & Subfield Taxonomy</h1>
          <p className={styles.lede}>
            Controlled subject hierarchy written by Stage 01 while the system is Running. This page is
            observe-only.
          </p>
        </div>
        <div className={styles.topActions}>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
          <span className={`${styles.badge} ${statusTone(overview.status)}`}>{overview.status}</span>
        </div>
      </header>

      <p className={styles.notice}>
        {systemRunning
          ? 'System is Running. Taxonomy nodes are materialised by Stage 01 autonomy — no form input on this page.'
          : 'System is idle. Start from the top bar to materialise Stage 01 taxonomy records. No human editing here.'}
      </p>

      <section className={styles.contextStrip} aria-label="Taxonomy operational context">
        <div className={styles.contextItem}>
          <span>System</span>
          <strong data-state={systemState}>{systemState.replaceAll('_', ' ')}</strong>
        </div>
        <div className={styles.contextItem}>
          <span>Taxonomy nodes</span>
          <strong>{records.length}</strong>
        </div>
        <div className={styles.contextItem}>
          <span>Section progress</span>
          <strong>{sectionProgress == null ? 'Unavailable' : `${sectionProgress}%`}</strong>
        </div>
        <div className={styles.contextItem}>
          <span>Section status</span>
          <strong>{sectionMeta?.status ?? '—'}</strong>
        </div>
        <div className={styles.contextItem}>
          <span>Last refresh</span>
          <strong>{relativeRefresh(lastLoadedAt, now)}</strong>
        </div>
      </section>

      <div className={styles.layout}>
        <aside className={styles.listPanel} aria-label="Taxonomy hierarchy">
          <div className={styles.listHead}>
            <div>
              <h2>
                <FolderTree size={16} aria-hidden />
                Hierarchy
              </h2>
              <p>
                {records.length} persisted node{records.length === 1 ? '' : 's'}
                {filtered.length !== records.length ? ` · ${filtered.length} shown` : ''}
              </p>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search subject & subfield taxonomy"
              aria-label="Search subject and subfield taxonomy"
            />
          </div>

          {flatNodes.length ? (
            <>
              <p className={styles.treeRootLabel}>Taxonomy root</p>
              <ul className={styles.list} role="tree">
                {flatNodes.map(({ record, depth }) => {
                  const config = record.configuration ?? {};
                  const active = record.id === selectedId;
                  const nodeType = configDisplay(config, 'nodeType') || 'node';
                  const stub = isBaselineStub(record);
                  return (
                    <li key={record.id} role="none" style={{ paddingLeft: depth * 16 }}>
                      <button
                        type="button"
                        role="treeitem"
                        aria-selected={active}
                        className={`${styles.listItem} ${active ? styles.listItemActive : ''}`}
                        onClick={() => setSelectedId(record.id ?? null)}
                      >
                        <div>
                          <strong className={styles.nodeMeta}>
                            {depth > 0 ? <Network size={13} aria-hidden /> : <Tag size={13} aria-hidden />}
                            {record.name}
                            {stub ? <span className={styles.stubChip}>Baseline stub</span> : null}
                          </strong>
                          <span>
                            {nodeType}
                            {config.origin ? ` · ${String(config.origin)}` : ''}
                            {` · P${record.priority}`}
                          </span>
                        </div>
                        <em className={statusTone(record.status)}>{record.status}</em>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className={styles.emptyList}>
              <h3>{systemRunning ? 'Autonomy in progress' : 'Awaiting system Start'}</h3>
              <p>
                {systemRunning
                  ? 'Stage 01 is materialising taxonomy records. This hierarchy updates automatically.'
                  : 'No taxonomy nodes yet. Global Start runs Stage 01 and writes controlled subject hierarchy here.'}
              </p>
            </div>
          )}
        </aside>

        <section className={styles.formPanel} aria-label="Taxonomy node inspector">
          <div className={styles.formHead}>
            <div>
              <h2>{selected?.name || 'Node inspector'}</h2>
              <p>Read-only system record. Autonomy owns Subject & Subfield Taxonomy.</p>
            </div>
            {selected ? (
              <span className={`${styles.badge} ${statusTone(selected.status)}`}>{selected.status}</span>
            ) : null}
          </div>

          {selected ? (
            <div className={styles.form}>
              <fieldset disabled className={styles.fieldset}>
                <legend>Identity</legend>
                <div className={styles.grid2}>
                  <label className={styles.field}>
                    <span>Name</span>
                    <input value={display(selected.name)} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Status</span>
                    <input value={display(selected.status)} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Priority</span>
                    <input value={String(selected.priority)} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Effective from</span>
                    <input
                      value={
                        selected.effectiveFrom
                          ? new Date(selected.effectiveFrom).toLocaleString()
                          : '—'
                      }
                      readOnly
                    />
                  </label>
                </div>
                <label className={styles.field}>
                  <span>Description</span>
                  <textarea value={selected.description || '—'} rows={3} readOnly />
                </label>
              </fieldset>

              <fieldset disabled className={styles.fieldset}>
                <legend>Hierarchy fields</legend>
                <div className={styles.grid2}>
                  {fieldKeys
                    .filter((key) => key !== 'name')
                    .map((key) => {
                      const value = configDisplay(selectedConfig, key);
                      const long = value.length > 80 || key === 'keywords' || key === 'synonyms';
                      return (
                        <label
                          key={key}
                          className={styles.field}
                          style={long ? { gridColumn: '1 / -1' } : undefined}
                        >
                          <span>{fieldLabel(key)}</span>
                          {long ? (
                            <textarea value={display(value)} rows={2} readOnly />
                          ) : (
                            <input value={display(value)} readOnly />
                          )}
                        </label>
                      );
                    })}
                </div>
              </fieldset>

              <fieldset disabled className={styles.fieldset}>
                <legend>Provenance</legend>
                <div className={styles.grid2}>
                  <label className={styles.field}>
                    <span>System key</span>
                    <input value={display(configDisplay(selectedConfig, 'systemKey'))} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Origin</span>
                    <input value={display(configDisplay(selectedConfig, 'origin'))} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Baseline value</span>
                    <input value={display(configDisplay(selectedConfig, 'baselineValue'))} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Target value</span>
                    <input value={display(configDisplay(selectedConfig, 'targetValue'))} readOnly />
                  </label>
                </div>
                {isBaselineStub(selected) ? (
                  <p className={styles.footerHint}>
                    Baseline stub from Stage 01 mandatory section materialisation. Not a fabricated
                    subject hierarchy.
                  </p>
                ) : null}
              </fieldset>
            </div>
          ) : (
            <div className={styles.emptyList}>
              <h3>{systemRunning ? 'Autonomy in progress' : 'No node selected'}</h3>
              <p>
                {systemRunning
                  ? 'Inspector detail appears when Stage 01 persists the first taxonomy node.'
                  : 'Persisted nodes are selected automatically when Stage 01 completes.'}
              </p>
            </div>
          )}
        </section>
      </div>

      <p className={styles.footerHint}>
        Observe-only workspace. Global Start / Stop remain in the top bar. Hierarchy edges use
        persisted parentId links when present — unknown parents surface as roots.
      </p>
    </motion.main>
  );
}
