'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ShieldAlert } from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import { recordToObjectiveForm } from '@/apps/web/lib/strategy-objectives';
import styles from './objectives.module.css';

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'COMPLETED':
    case 'RUNNING':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'CANCELLED':
    case 'ARCHIVED':
      return styles.toneBlocked;
    case 'QUEUED':
      return styles.toneWarning;
    default:
      return styles.toneDraft;
  }
}

function valueOrDash(value: string | undefined) {
  if (!value || value === 'UNMEASURED') return 'UNMEASURED';
  return value;
}

export function ObjectivesWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');

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
      if (!next.available || !next.versionId) {
        setRecords([]);
        return;
      }
      const list = await strategyApi.list(next.versionId, 'objectives');
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) => {
      const config = record.configuration ?? {};
      return (
        record.name.toLowerCase().includes(needle) ||
        record.status.toLowerCase().includes(needle) ||
        String(config.category ?? '')
          .toLowerCase()
          .includes(needle) ||
        String(config.systemKey ?? '')
          .toLowerCase()
          .includes(needle)
      );
    });
  }, [records, query]);

  const selected = records.find((item) => item.id === selectedId) ?? null;
  const detail = selected ? recordToObjectiveForm(selected) : null;

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
        <p className={styles.crumb}>Strategy & Fields / Strategic Objectives</p>
        <h1 className={styles.title}>Strategic Objectives</h1>
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
            Strategic Objectives
          </p>
          <h1 className={styles.title}>Strategic Objectives</h1>
          <p className={styles.lede}>
            System-owned policy objectives. This page observes Stage 01 output only.
          </p>
        </div>
        <div className={styles.topActions}>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
          <span className={`${styles.badge} ${statusTone(overview.status)}`}>{overview.status}</span>
          <span className={`${styles.badge} ${statusTone(run?.status ?? 'IDLE')}`}>
            {run?.status ?? 'IDLE'}
          </span>
        </div>
      </header>

      <p className={styles.notice}>
        {systemRunning
          ? 'System is Running. The worker reconciles objectives and advances later stages automatically.'
          : 'System is idle. Objectives appear automatically after global Start; no form input on this page.'}
      </p>

      <div className={styles.layout}>
        <aside className={styles.listPanel} aria-label="Objectives list">
          <div className={styles.listHead}>
            <div>
              <h2>System objectives</h2>
              <p>
                {records.length} persisted record{records.length === 1 ? '' : 's'}
              </p>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search objectives"
              aria-label="Search objectives"
            />
          </div>

          {filtered.length ? (
            <ul className={styles.list}>
              {filtered.map((record) => {
                const config = record.configuration ?? {};
                const active = record.id === selectedId;
                return (
                  <li key={record.id}>
                    <button
                      type="button"
                      className={`${styles.listItem} ${active ? styles.listItemActive : ''}`}
                      onClick={() => setSelectedId(record.id ?? null)}
                    >
                      <div>
                        <strong>{record.name}</strong>
                        <span>
                          {String(config.category || 'Policy')}
                          {config.origin === 'SYSTEM_POLICY' ? ' · SYSTEM' : ''}
                        </span>
                      </div>
                      <em className={statusTone(record.status)}>{record.status}</em>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.emptyList}>
              <h3>{systemRunning ? 'Autonomy in progress' : 'Awaiting system Start'}</h3>
              <p>
                {systemRunning
                  ? 'Stage 01 is reconciling system objectives. This list updates automatically.'
                  : 'No human input on this page. Global Start runs Stage 01 and materialises objectives here.'}
              </p>
            </div>
          )}
        </aside>

        <section className={styles.formPanel} aria-label="Objective detail">
          <div className={styles.formHead}>
            <div>
              <h2>{detail?.name || 'Objective detail'}</h2>
              <p>Read-only observation. Autonomy owns this section.</p>
            </div>
          </div>

          {detail ? (
            <div className={styles.form}>
              <fieldset disabled className={styles.fieldset}>
                <legend>Identity</legend>
                <div className={styles.grid2}>
                  <label className={styles.field}>
                    <span>Name</span>
                    <input value={detail.name} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Category</span>
                    <input value={detail.category || '—'} readOnly />
                  </label>
                </div>
                <label className={styles.field}>
                  <span>Description</span>
                  <textarea value={detail.description} rows={3} readOnly />
                </label>
              </fieldset>

              <fieldset disabled className={styles.fieldset}>
                <legend>Outcomes & metrics</legend>
                <label className={styles.field}>
                  <span>Desired outcome</span>
                  <textarea value={detail.desiredOutcome} rows={3} readOnly />
                </label>
                <div className={styles.grid3}>
                  <label className={styles.field}>
                    <span>Target metric</span>
                    <input value={detail.targetMetric || '—'} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Baseline</span>
                    <input value={valueOrDash(detail.baselineValue)} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Target</span>
                    <input value={valueOrDash(detail.targetValue)} readOnly />
                  </label>
                </div>
              </fieldset>

              <fieldset disabled className={styles.fieldset}>
                <legend>Scope</legend>
                <div className={styles.grid2}>
                  <label className={styles.field}>
                    <span>Fields</span>
                    <input value={detail.applicableFields || '—'} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Audiences</span>
                    <input value={detail.applicableAudiences || '—'} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Regions</span>
                    <input value={detail.regions || '—'} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Channels</span>
                    <input value={detail.channels || '—'} readOnly />
                  </label>
                </div>
                <label className={styles.field}>
                  <span>Success criteria</span>
                  <textarea value={detail.successCriteria} rows={2} readOnly />
                </label>
              </fieldset>
            </div>
          ) : (
            <div className={styles.emptyList}>
              <h3>No selection</h3>
              <p>Persisted objectives will appear in the list after Stage 01 runs.</p>
            </div>
          )}
        </section>
      </div>
    </motion.main>
  );
}
