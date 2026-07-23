'use client';

import { useEffect, useState } from 'react';
import type { SectionKey, StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import { getSection } from '@/apps/web/lib/strategy-config';
import styles from './strategy.module.css';

const label = (value: string) =>
  value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());

export function StrategyWorkspace({ sectionKey }: { sectionKey?: SectionKey }) {
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [actionError, setActionError] = useState('');
  const section = sectionKey ? getSection(sectionKey) : undefined;

  async function load() {
    setBusy(true);
    setError('');
    try {
      const next = await strategyApi.overview();
      setOverview(next);
      if (sectionKey && next.versionId) {
        setRecords(await strategyApi.list(next.versionId, sectionKey));
      } else {
        setRecords([]);
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
    // Reload when the active configuration section changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional sectionKey trigger
  }, [sectionKey]);

  async function handleValidate() {
    if (!overview?.versionId) return;
    setActionError('');
    try {
      await strategyApi.validate(overview.versionId);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Validation failed');
    }
  }

  async function handleActivate() {
    if (!overview?.versionId) return;
    setActionError('');
    try {
      await strategyApi.activate(overview.versionId);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Activation failed');
    }
  }

  async function handleAddRecord() {
    if (!overview?.versionId || !sectionKey || overview.status !== 'DRAFT') return;
    const name = window.prompt(`Name for new ${section?.title ?? 'record'}`);
    if (!name?.trim()) return;
    setActionError('');
    try {
      await strategyApi.create(overview.versionId, sectionKey, {
        name: name.trim(),
        description: '',
        status: 'ACTIVE',
        priority: 50,
        configuration: {},
        effectiveFrom: null,
        effectiveTo: null,
      });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  if (busy) {
    return (
      <main className={styles.page}>
        <div className={styles.skeleton} />
        <div className={styles.grid}>
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className={styles.skeletonCard} />
          ))}
        </div>
      </main>
    );
  }

  if (error || !overview?.available) {
    return (
      <main className={styles.page}>
        <header>
          <p className={styles.crumb}>Content Lifecycle / Strategy & Fields</p>
          <h1>{section?.title ?? 'Strategy & Fields Command Centre'}</h1>
        </header>
        <section className={styles.unavailable}>
          <h2>Strategy service unavailable</h2>
          <p>{error || overview?.reason}</p>
          <button type="button" onClick={() => void load()}>
            Retry connection
          </button>
        </section>
      </main>
    );
  }

  if (section) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className={styles.crumb}>Strategy & Fields / {section.title}</p>
            <h1>{section.title}</h1>
            <p>{section.description}</p>
          </div>
          <span className={styles.badge}>{overview.status}</span>
        </header>
        {actionError ? <p className={styles.issue}>{actionError}</p> : null}
        <section className={styles.toolbar}>
          <input placeholder={`Search ${section.title.toLowerCase()}`} aria-label="Search records" />
          <button type="button" disabled={overview.status !== 'DRAFT'} onClick={() => void handleAddRecord()}>
            Add record
          </button>
        </section>
        {records.length ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Name / Type</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.name}</td>
                    <td>{record.status}</td>
                    <td>{record.priority}</td>
                    <td>{record.effectiveFrom ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <section className={styles.empty}>
            <h2>No {section.title.toLowerCase()} configured</h2>
            <p>Create the first database-backed record. Activated versions remain read-only.</p>
            <div className={styles.chips}>
              {section.fields.map((field) => (
                <span key={field}>{label(field)}</span>
              ))}
            </div>
          </section>
        )}
      </main>
    );
  }

  const metrics = overview.metrics ?? {};

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.crumb}>Content Lifecycle / Strategy & Fields</p>
          <h1>Strategy & Fields Command Centre</h1>
          <p>
            Define, validate, activate and hand off the policy package that governs autonomous content
            production.
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => void handleValidate()}>
            Validate strategy
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={overview.status !== 'READY'}
            onClick={() => void handleActivate()}
          >
            Activate strategy
          </button>
        </div>
      </header>
      {actionError ? <p className={styles.issue}>{actionError}</p> : null}
      <section className={styles.hero}>
        <div>
          <span className={styles.badge}>{overview.status}</span>
          <h2>
            {overview.name} <small>v{overview.versionNumber}</small>
          </h2>
          <p>
            Effective {overview.effectiveDate ?? 'when activated'} · Handoff{' '}
            {overview.handoffStatus ?? 'not started'}
          </p>
        </div>
        <div className={styles.score}>
          <strong>{overview.readiness ?? 0}%</strong>
          <span>ready</span>
        </div>
      </section>
      <section className={styles.grid}>
        {Object.entries(metrics).map(([key, value]) => (
          <article className={styles.card} key={key}>
            <span>{label(key)}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className={styles.panel}>
        <h2>Configuration readiness</h2>
        {overview.sections?.map((item) => (
          <a className={styles.readiness} key={item.key} href={`/strategy/${item.key}`}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.missing.join(', ') || 'All requirements satisfied'}</span>
            </div>
            <progress max={100} value={item.progress} />
            <b className={styles[item.status.toLowerCase() as 'ready' | 'blocked' | 'warning']}>
              {item.status}
            </b>
          </a>
        ))}
      </section>
      <section className={styles.columns}>
        <article className={styles.panel}>
          <h2>Lifecycle handoff</h2>
          <ol>
            <li>Strategy Package</li>
            <li>Validation</li>
            <li>Activation</li>
            <li>Content Intelligence</li>
          </ol>
          <p>
            Checksum: <code>{overview.checksum ?? 'Not generated'}</code>
          </p>
        </article>
        <article className={styles.panel}>
          <h2>Blockers & warnings</h2>
          {overview.issues?.length ? (
            overview.issues.map((issue) => (
              <div className={styles.issue} key={issue.id}>
                <b>{issue.severity}</b>
                <span>{issue.message}</span>
                <small>{issue.recommendation}</small>
              </div>
            ))
          ) : (
            <p>No current issues.</p>
          )}
        </article>
      </section>
    </main>
  );
}
