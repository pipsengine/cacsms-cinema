'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import { LifecycleIcon } from '@/apps/web/config/lifecycle-icons';
import {
  withContextQuery,
  type LifecycleStageConfig,
  type PageCapabilityStatus,
} from '@/apps/web/config/lifecycle-navigation';
import { useLifecycleNavContext } from './LifecycleBreadcrumb';
import type { LifecycleStageStatusView } from './useLifecycleStatus';
import styles from './stage-pages-panel.module.css';

function formatStatus(status: PageCapabilityStatus): string {
  return status.replaceAll('_', ' ');
}

function relativeTime(value: string | null): string {
  if (!value) return '—';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export function StagePagesPanel({
  stage,
  stageStatus,
}: {
  stage: LifecycleStageConfig;
  stageStatus?: LifecycleStageStatusView;
}) {
  const context = useLifecycleNavContext();

  return (
    <section className={styles.panel} aria-label={`${stage.label} pages`}>
      <header className={styles.head}>
        <div>
          <h3>Stage Pages</h3>
          <p>
            {stage.number} {stage.label} — {stage.pages.length} corresponding surfaces
          </p>
        </div>
      </header>
      <div className={styles.grid}>
        {stage.pages.map((page) => {
          const pageStatus = stageStatus?.pages.find((item) => item.id === page.id);
          const status: PageCapabilityStatus =
            page.capability === 'not_available'
              ? 'not_available'
              : pageStatus?.status ?? 'not_started';
          const executionStatus = pageStatus?.executionStatus ?? (page.capability === 'not_available' ? 'UNAVAILABLE' : 'NOT_STARTED');
          const href = withContextQuery(page.href, context);
          return (
            <article key={page.id} className={styles.card} data-status={status}>
              <div className={styles.cardTop}>
                <span className={styles.iconWrap}>
                  <LifecycleIcon name={page.icon} size={18} />
                </span>
                <span className={styles.badge} title={`Execution: ${executionStatus}`}>{formatStatus(status)}</span>
              </div>
              <h4>{page.label}</h4>
              <p>{page.description}</p>
              <dl className={styles.meta}>
                <div>
                  <dt>Count</dt>
                  <dd>{pageStatus?.count == null ? 'Unavailable' : pageStatus.count}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{relativeTime(pageStatus?.lastUpdatedAt ?? null)}</dd>
                </div>
              </dl>
              {pageStatus?.blocking ? (
                <div className={styles.blocking}>
                  <AlertTriangle size={14} aria-hidden />
                  Blocking issue recorded
                </div>
              ) : null}
              <Link href={href} className={styles.open}>
                Open page
                <ArrowUpRight size={15} aria-hidden />
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
