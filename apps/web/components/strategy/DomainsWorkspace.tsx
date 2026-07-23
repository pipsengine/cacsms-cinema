'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ShieldAlert } from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import { recordToDomainForm } from '@/apps/web/lib/strategy-domains';
import styles from './objectives.module.css';

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'PERMITTED':
    case 'ALLOWED':
    case 'RUNNING':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'RESTRICTED':
    case 'FAILED':
    case 'CANCELLED':
    case 'ARCHIVED':
      return styles.toneBlocked;
    case 'CONDITIONAL':
    case 'ALLOWED_WITH_REVIEW':
    case 'QUEUED':
      return styles.toneWarning;
    default:
      return styles.toneDraft;
  }
}

function display(value: string | undefined) {
  if (!value) return '—';
  if (value === 'UNMEASURED') return 'UNMEASURED';
  return value;
}

export function DomainsWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');

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
      const list = (await strategyApi.list(next.versionId, 'domains')).filter(
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) => {
      const config = record.configuration ?? {};
      return (
        record.name.toLowerCase().includes(needle) ||
        record.status.toLowerCase().includes(needle) ||
        String(config.fieldName ?? '')
          .toLowerCase()
          .includes(needle) ||
        String(config.domainName ?? '')
          .toLowerCase()
          .includes(needle) ||
        String(config.coverageStatus ?? '')
          .toLowerCase()
          .includes(needle) ||
        String(config.allowedState ?? '')
          .toLowerCase()
          .includes(needle)
      );
    });
  }, [records, query]);

  const selected = records.find((item) => item.id === selectedId) ?? null;
  const detail = selected ? recordToDomainForm(selected) : null;

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
        <p className={styles.crumb}>Strategy & Fields / Field & Domain Profiles</p>
        <h1 className={styles.title}>Field & Domain Profiles</h1>
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
            Field & Domain Profiles
          </p>
          <h1 className={styles.title}>Field & Domain Profiles</h1>
          <p className={styles.lede}>
            Permitted knowledge fields and domain coverage, written by Stage 01 while the system is
            Running.
          </p>
        </div>
        <div className={styles.topActions}>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
          <span className={`${styles.badge} ${statusTone(overview.status)}`}>{overview.status}</span>
        </div>
      </header>

      <p className={styles.notice}>
        {systemRunning
          ? 'System is Running. Domain profiles are written by Stage 01 autonomy — this page is observe-only.'
          : 'System is idle. Domain profiles appear automatically after global Start; no form input on this page.'}
      </p>

      <div className={styles.layout}>
        <aside className={styles.listPanel} aria-label="Domain profiles list">
          <div className={styles.listHead}>
            <div>
              <h2>Configured domains</h2>
              <p>
                {records.length} persisted profile{records.length === 1 ? '' : 's'}
              </p>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search field & domain profiles"
              aria-label="Search field and domain profiles"
            />
          </div>

          {filtered.length ? (
            <ul className={styles.list}>
              {filtered.map((record) => {
                const config = record.configuration ?? {};
                const active = record.id === selectedId;
                const coverage = String(config.coverageStatus || record.status);
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
                          {String(config.fieldName || 'Field')}
                          {config.domainName ? ` · ${String(config.domainName)}` : ''}
                          {config.origin === 'SYSTEM_POLICY' ? ' · SYSTEM' : ''}
                        </span>
                      </div>
                      <em className={statusTone(coverage)}>{coverage}</em>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.emptyList}>
              <h3>
                {systemRunning ? 'Autonomy in progress' : 'Awaiting system Start'}
              </h3>
              <p>
                {systemRunning
                  ? 'Stage 01 is reconciling field and domain profiles. This list updates automatically.'
                  : 'No human input on this page. Global Start runs Stage 01 and materialises domain profiles here.'}
              </p>
            </div>
          )}
        </aside>

        <section className={styles.formPanel} aria-label="Domain profile detail">
          <div className={styles.formHead}>
            <div>
              <h2>{detail?.name || 'Domain profile detail'}</h2>
              <p>Read-only system record. Autonomy owns Field & Domain Profiles.</p>
            </div>
          </div>

          {detail ? (
            <div className={styles.form}>
              <fieldset disabled className={styles.fieldset}>
                <legend>Identity</legend>
                <div className={styles.grid2}>
                  <label className={styles.field}>
                    <span>Field Name</span>
                    <input value={display(detail.fieldName)} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Domain Name</span>
                    <input value={display(detail.domainName)} readOnly />
                  </label>
                </div>
                <label className={styles.field}>
                  <span>Description</span>
                  <textarea value={detail.description} rows={3} readOnly />
                </label>
                <label className={styles.field}>
                  <span>Rationale</span>
                  <textarea value={detail.rationale} rows={3} readOnly />
                </label>
                <div className={styles.grid3}>
                  <label className={styles.field}>
                    <span>Coverage Status</span>
                    <input value={display(detail.coverageStatus)} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Allowed State</span>
                    <input value={display(detail.allowedState)} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Record status</span>
                    <input value={display(detail.status)} readOnly />
                  </label>
                </div>
              </fieldset>

              <fieldset disabled className={styles.fieldset}>
                <legend>Scope</legend>
                <div className={styles.grid2}>
                  <label className={styles.field}>
                    <span>Countries</span>
                    <input value={display(detail.countries)} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Audiences</span>
                    <input value={display(detail.audiences)} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Formats</span>
                    <input value={display(detail.formats)} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Parent Domain</span>
                    <input value={display(detail.parentDomain)} readOnly />
                  </label>
                </div>
              </fieldset>

              <fieldset disabled className={styles.fieldset}>
                <legend>Governance</legend>
                <label className={styles.field}>
                  <span>Evidence Requirement</span>
                  <textarea value={detail.evidenceRequirement} rows={2} readOnly />
                </label>
                <div className={styles.grid2}>
                  <label className={styles.field}>
                    <span>Sensitivity</span>
                    <input value={display(detail.sensitivity)} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Seasonal Relevance</span>
                    <input value={display(detail.seasonalRelevance)} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Frequency Limit</span>
                    <input value={display(detail.frequencyLimit)} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Authority Requirement</span>
                    <input value={display(detail.authorityRequirement)} readOnly />
                  </label>
                </div>
                <div className={styles.grid2}>
                  <label className={styles.field}>
                    <span>System key</span>
                    <input value={display(detail.systemKey)} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Origin</span>
                    <input value={display(detail.origin)} readOnly />
                  </label>
                </div>
              </fieldset>
            </div>
          ) : (
            <div className={styles.emptyList}>
              <h3>{systemRunning ? 'Autonomy in progress' : 'No profile selected'}</h3>
              <p>
                {systemRunning
                  ? 'Detail appears as soon as Stage 01 persists the first domain profile.'
                  : 'Persisted profiles are selected automatically when Stage 01 completes.'}
              </p>
            </div>
          )}
        </section>
      </div>
    </motion.main>
  );
}
