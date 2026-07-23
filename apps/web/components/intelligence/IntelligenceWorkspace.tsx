'use client';

import { useEffect, useState } from 'react';
import type {
  IntelligenceOverview,
  Opportunity,
  SectionKey,
} from '@/lib/content-intelligence/contracts';
import { intelligenceApi } from '@/apps/web/lib/intelligence-api';
import { getSection } from '@/apps/web/lib/intelligence-config';
import styles from './intelligence.module.css';

const nice = (value: string) =>
  value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());

export function IntelligenceWorkspace({ sectionKey }: { sectionKey?: SectionKey }) {
  const [overview, setOverview] = useState<IntelligenceOverview | null>(null);
  const [items, setItems] = useState<Opportunity[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const section = sectionKey ? getSection(sectionKey) : undefined;

  async function load() {
    setBusy(true);
    setError('');
    try {
      setOverview(await intelligenceApi.overview());
      if (sectionKey) {
        setItems(await intelligenceApi.list(sectionKey));
      } else {
        setItems([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional sectionKey trigger
  }, [sectionKey]);

  if (busy) {
    return (
      <main className={styles.page}>
        <div className={styles.skeleton} />
        <div className={styles.grid}>
          {[1, 2, 3, 4].map((item) => (
            <div className={styles.skeletonCard} key={item} />
          ))}
        </div>
      </main>
    );
  }

  if (error || !overview?.available) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Content Lifecycle / 02 Content Intelligence</p>
        <h1>{section?.title ?? 'Content Intelligence Command Centre'}</h1>
        <section className={styles.unavailable}>
          <h2>Content Intelligence unavailable</h2>
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
            <p className={styles.crumb}>Content Intelligence / {section.title}</p>
            <h1>{section.title}</h1>
            <p>{section.description}</p>
          </div>
          <span className={styles.badge}>{overview.run?.status ?? 'IDLE'}</span>
        </header>
        <div className={styles.toolbar}>
          <input aria-label="Search" placeholder={`Search ${section.title.toLowerCase()}`} />
          <select aria-label="Status" defaultValue="all">
            <option value="all">All statuses</option>
            <option value="QUALIFIED">QUALIFIED</option>
            <option value="BLOCKED">BLOCKED</option>
          </select>
        </div>
        {items.length ? (
          <div className={styles.table}>
            <table>
              <thead>
                <tr>
                  <th>Candidate / Signal</th>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Confidence</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <small>{item.summary}</small>
                    </td>
                    <td>{item.domain}</td>
                    <td>
                      <span className={styles.badge}>{item.status}</span>
                    </td>
                    <td>{item.score.toFixed(1)}</td>
                    <td>{item.confidence.toFixed(0)}%</td>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <section className={styles.empty}>
            <h2>No persisted records</h2>
            <p>
              The system will display records after an active Strategy Package is acknowledged and a
              discovery run produces verified evidence.
            </p>
          </section>
        )}
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.crumb}>Content Lifecycle / 02 Content Intelligence</p>
          <h1>Content Intelligence Command Centre</h1>
          <p>
            Discover, verify, score and rank evidence-backed content opportunities under the active
            strategy.
          </p>
        </div>
        <div className={styles.toolbar}>
          <span className={styles.badge}>{overview.run?.status ?? 'NOT STARTED'}</span>
        </div>
      </header>
      <p className={styles.empty}>
        Observe-only. Start or stop the full system from the Control Room or top bar. This stage
        advances automatically while the system is Running.
      </p>
      <section className={styles.hero}>
        <div>
          <span className={styles.badge}>{overview.run?.status ?? 'NOT STARTED'}</span>
          <h2>Active intelligence cycle</h2>
          <p>
            Strategy v{overview.strategy?.versionNumber ?? '—'} · Package{' '}
            {overview.strategy?.status ?? 'not received'}
          </p>
        </div>
        <div>
          <strong>{overview.metrics?.qualified ?? 0}</strong>
          <span>qualified opportunities</span>
        </div>
      </section>
      <section className={styles.grid}>
        {Object.entries(overview.metrics ?? {}).map(([key, value]) => (
          <article className={styles.card} key={key}>
            <span>{nice(key)}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className={styles.panel}>
        <h2>Autonomous pipeline</h2>
        {overview.pipeline?.map((item) => (
          <div className={styles.pipeline} key={item.stage}>
            <div>
              <strong>{nice(item.stage)}</strong>
              <span>{item.count} persisted records</span>
            </div>
            <b className={styles.badge}>{item.status}</b>
          </div>
        ))}
      </section>
      <section className={styles.columns}>
        <article className={styles.panel}>
          <h2>Strategy contract</h2>
          <dl>
            <dt>Version</dt>
            <dd>{overview.strategy?.versionNumber ?? 'Unavailable'}</dd>
            <dt>Checksum</dt>
            <dd>
              <code>{overview.strategy?.checksum ?? 'Not received'}</code>
            </dd>
            <dt>Consumption</dt>
            <dd>{overview.strategy?.status ?? 'Pending'}</dd>
          </dl>
        </article>
        <article className={styles.panel}>
          <h2>Blockers</h2>
          {overview.blockers?.length ? (
            overview.blockers.map((blocker) => (
              <p key={blocker.id}>
                <b>{blocker.severity}</b> {blocker.message}
              </p>
            ))
          ) : (
            <p>No unresolved blockers.</p>
          )}
        </article>
      </section>
    </main>
  );
}
