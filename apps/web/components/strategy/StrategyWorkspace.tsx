'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import type { SectionKey, StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import { getSection } from '@/apps/web/lib/strategy-config';
import styles from './strategy.module.css';

const label = (value: string) =>
  value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());

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
    case 'DRAFT':
    default:
      return styles.toneDraft;
  }
}

function metricEntries(metrics: Record<string, number> | undefined) {
  const preferred = [
    ['configuredSections', 'Configured sections'],
    ['configuredRecords', 'Configured records'],
    ['failedMandatoryValidations', 'Failed mandatory validations'],
    ['contentIntelligenceHandoff', 'Content Intelligence handoff'],
  ] as const;
  if (!metrics) return preferred.map(([key, title]) => ({ key, title, value: 0 }));
  return preferred.map(([key, title]) => ({
    key,
    title,
    value: metrics[key] ?? 0,
  }));
}

export function StrategyWorkspace({ sectionKey }: { sectionKey?: SectionKey }) {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [actionError, setActionError] = useState('');
  const [query, setQuery] = useState('');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional sectionKey trigger
  }, [sectionKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKey]);

  const filteredSections = useMemo(() => {
    const items = overview?.sections ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(needle) ||
        item.key.includes(needle) ||
        item.missing.some((entry) => entry.toLowerCase().includes(needle)),
    );
  }, [overview?.sections, query]);

  const filteredRecords = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter(
      (record) =>
        record.name.toLowerCase().includes(needle) ||
        record.status.toLowerCase().includes(needle),
    );
  }, [records, query]);

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
      };

  if (busy) {
    return (
      <main className={styles.page}>
        <div className={styles.skeletonHero} />
        <div className={styles.skeletonRow}>
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className={styles.skeletonBlock} />
          ))}
        </div>
        <div className={styles.skeletonPanel} />
      </main>
    );
  }

  if (error || !overview?.available) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Content Lifecycle / 01 Strategy & Fields</p>
        <h1 className={styles.title}>{section?.title ?? 'Strategy & Fields'}</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Strategy service unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  if (section) {
    return (
      <motion.main className={styles.page} {...motionProps}>
        <header className={styles.top}>
          <div>
            <p className={styles.crumb}>
              Strategy & Fields / {section.title}
            </p>
            <h1 className={styles.title}>{section.title}</h1>
            <p className={styles.lede}>{section.description}</p>
          </div>
          <span className={`${styles.badge} ${statusTone(overview.status)}`}>
            {overview.status}
          </span>
        </header>

        {actionError ? (
          <p className={styles.actionError} role="alert">
            <AlertTriangle size={15} aria-hidden />
            {actionError}
          </p>
        ) : null}

        <p className={styles.actionError} style={{ background: '#f7f9fd', color: '#596079', borderColor: '#d8e0ef' }}>
          Observe-only. No form input — Stage 01 writes records while the system is Running.
        </p>

        <section className={styles.toolbar}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${section.title.toLowerCase()}`}
            aria-label="Search records"
          />
        </section>

        {filteredRecords.length ? (
          <div className={styles.tableShell}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Effective from</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.name}</td>
                    <td>
                      <span className={`${styles.miniBadge} ${statusTone(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
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
            <p>
              No human input on this page. Global Start materialises section records automatically
              via Stage 01 autonomy.
            </p>
            <div className={styles.fieldHints}>
              {section.fields.slice(0, 10).map((field) => (
                <span key={field}>{label(field)}</span>
              ))}
            </div>
          </section>
        )}
      </motion.main>
    );
  }

  const metrics = metricEntries(overview.metrics);
  const blockedCount = overview.sections?.filter((item) => item.status === 'BLOCKED').length ?? 0;
  const readyCount = overview.sections?.filter((item) => item.status === 'READY').length ?? 0;

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.top}>
        <div>
          <p className={styles.crumb}>Content Lifecycle / 01 Strategy & Fields</p>
          <h1 className={styles.title}>Strategy & Fields</h1>
          <p className={styles.lede}>
            Observe the policy package that governs autonomous content production.
          </p>
        </div>
        <div className={styles.actions}>
          <span className={`${styles.badge} ${statusTone(overview.status)}`}>{overview.status}</span>
        </div>
      </header>

      {actionError ? (
        <p className={styles.actionError} role="alert">
          <AlertTriangle size={15} aria-hidden />
          {actionError}
        </p>
      ) : null}

      <section className={styles.hero} aria-label="Strategy version status">
        <div className={styles.heroCopy}>
          <span className={`${styles.badge} ${statusTone(overview.status)}`}>{overview.status}</span>
          <h2>
            {overview.name ?? 'Untitled strategy'}
            <small>v{overview.versionNumber ?? '—'}</small>
          </h2>
          <p>
            Effective {overview.effectiveDate ? new Date(overview.effectiveDate).toLocaleString() : 'when activated'}
            <span aria-hidden> · </span>
            Handoff {overview.handoffStatus ?? 'not started'}
          </p>
          <p className={styles.heroMeta}>
            {readyCount} ready · {blockedCount} blocked · {overview.sections?.length ?? 0} mandatory sections
          </p>
        </div>
        <div className={styles.readinessScore} aria-label={`${overview.readiness ?? 0} percent ready`}>
          <strong>{overview.readiness ?? 0}%</strong>
          <span>ready</span>
          <div className={styles.scoreTrack} aria-hidden>
            <i style={{ width: `${Math.max(0, Math.min(100, overview.readiness ?? 0))}%` }} />
          </div>
        </div>
      </section>

      <section className={styles.signals} aria-label="Strategy metrics">
        {metrics.map((metric) => (
          <div key={metric.key} className={styles.signal}>
            <span>{metric.title}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </section>

      <section className={styles.readinessPanel} aria-label="Configuration readiness">
        <div className={styles.panelHead}>
          <div>
            <h2>Configuration readiness</h2>
            <p>Mandatory Stage 01 sections. Each blocked item needs at least one active record.</p>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter sections"
            aria-label="Filter configuration sections"
            className={styles.filter}
          />
        </div>

        <div className={styles.readinessList}>
          {filteredSections.map((item) => (
            <Link
              key={item.key}
              href={`/strategy/${item.key}`}
              className={styles.readinessRow}
              data-status={item.status.toLowerCase()}
            >
              <div className={styles.readinessCopy}>
                <strong>{item.label}</strong>
                <span>{item.missing.join(', ') || 'All requirements satisfied'}</span>
              </div>
              <div className={styles.progressWrap}>
                <div className={styles.progressTrack} aria-hidden>
                  <i style={{ width: `${item.progress}%` }} />
                </div>
              </div>
              <b className={styles[item.status.toLowerCase() as 'ready' | 'blocked' | 'warning']}>
                {item.status}
              </b>
              <ArrowUpRight size={16} className={styles.rowArrow} aria-hidden />
            </Link>
          ))}
          {!filteredSections.length ? (
            <p className={styles.emptyFilter}>No sections match this filter.</p>
          ) : null}
        </div>
      </section>

      <section className={styles.lower}>
        <article className={styles.sidePanel}>
          <h2>Lifecycle handoff</h2>
          <ol className={styles.handoffSteps}>
            <li data-done={Boolean(overview.versionId) || undefined}>Strategy package</li>
            <li data-done={Boolean(overview.lastValidatedAt) || undefined}>Validation</li>
            <li data-done={overview.status === 'ACTIVE' || undefined}>Activation</li>
            <li data-done={overview.handoffStatus === 'ACKNOWLEDGED' || undefined}>
              Content Intelligence acknowledgement
            </li>
          </ol>
          <p className={styles.checksum}>
            Checksum
            <code>{overview.checksum ?? 'Not generated until activation'}</code>
          </p>
        </article>

        <article className={styles.sidePanel}>
          <h2>Blockers & warnings</h2>
          {overview.issues?.length ? (
            <ul className={styles.issueList}>
              {overview.issues.map((issue) => (
                <li key={issue.id}>
                  <div className={styles.issueHead}>
                    {issue.severity === 'CRITICAL' ? (
                      <AlertTriangle size={14} aria-hidden />
                    ) : (
                      <CheckCircle2 size={14} aria-hidden />
                    )}
                    <b>{issue.severity}</b>
                  </div>
                  <span>{issue.message}</span>
                  <small>{issue.recommendation}</small>
                  <Link href={`/strategy/${issue.section}`}>Open section</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.noIssues}>No unresolved blockers for this version.</p>
          )}
        </article>
      </section>
    </motion.main>
  );
}
