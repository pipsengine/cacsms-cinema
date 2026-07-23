'use client';

import { useEffect, useState } from 'react';
import type { StrategyOverview } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import styles from './strategy.module.css';

const copy = {
  validation: [
    'Strategy Validation',
    'Run and inspect persisted mandatory, logical, compatibility and provider-readiness checks.',
  ],
  versions: [
    'Strategy Versions',
    'Compare immutable history, create drafts and activate only validated READY versions.',
  ],
  audit: [
    'Strategy Audit',
    'Trace configuration, validation, activation and handoff events with correlation evidence.',
  ],
} as const;

type AuditEvent = {
  id: string;
  action: string;
  actorType: string;
  createdAt: string;
  reason: string | null;
};

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
      return styles.toneBlocked;
    case 'IN_REVIEW':
      return styles.toneWarning;
    default:
      return styles.toneDraft;
  }
}

export function OperationalWorkspace({ mode }: { mode: keyof typeof copy }) {
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState('');
  const [title, description] = copy[mode];

  async function load() {
    try {
      const next = await strategyApi.overview();
      setOverview(next);
      if (mode === 'audit' && next.versionId) {
        setEvents(await strategyApi.audit(next.versionId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unavailable');
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mode trigger
  }, [mode]);

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div>
          <p className={styles.crumb}>Strategy & Fields / {title}</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lede}>{description}</p>
        </div>
        {overview?.status ? (
          <span className={`${styles.badge} ${statusTone(overview.status)}`}>{overview.status}</span>
        ) : null}
      </header>

      {error ? (
        <section className={styles.unavailable}>
          <h2>Service unavailable</h2>
          <p>{error}</p>
        </section>
      ) : !overview ? (
        <div className={styles.skeletonPanel} />
      ) : (
        <section className={styles.sidePanel}>
          {mode === 'validation' ? (
            <>
              <h2>Latest validation</h2>
              <p className={styles.lede}>
                Last checked: {overview.lastValidatedAt ?? 'Not yet validated'}
              </p>
              <p className={styles.lede}>
                Readiness: {overview.readiness}% · Failed mandatory sections:{' '}
                {overview.metrics?.failedMandatoryValidations ?? 0}
              </p>
              {overview.versionId ? (
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => void strategyApi.validate(overview.versionId!).then(() => load())}
                >
                  Run validation
                </button>
              ) : null}
            </>
          ) : null}
          {mode === 'versions' ? (
            <>
              <h2>Current version</h2>
              <p className={styles.lede}>
                {overview.name} · Version {overview.versionNumber} · {overview.status}
              </p>
              <p className={styles.lede}>
                Activated history is immutable. Rollback creates a new draft from a selected historical
                version.
              </p>
            </>
          ) : null}
          {mode === 'audit' ? (
            <>
              <h2>Recent strategy evidence</h2>
              <p className={styles.checksum}>
                Current package checksum
                <code>{overview.checksum ?? 'Not generated'}</code>
              </p>
              {events.length ? (
                <div className={styles.tableShell}>
                  <table>
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Action</th>
                        <th>Actor</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event) => (
                        <tr key={event.id}>
                          <td>{new Date(event.createdAt).toLocaleString()}</td>
                          <td>{event.action}</td>
                          <td>{event.actorType}</td>
                          <td>{event.reason ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.noIssues}>No audit events yet for this version.</p>
              )}
            </>
          ) : null}
        </section>
      )}
    </main>
  );
}
