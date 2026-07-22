'use client';

import Link from 'next/link';
import { Construction } from 'lucide-react';
import { withContextQuery, type LifecyclePageConfig, type LifecycleStageConfig } from '@/apps/web/config/lifecycle-navigation';
import { LifecycleBreadcrumb, useLifecycleNavContext } from './LifecycleBreadcrumb';
import styles from './lifecycle-page.module.css';

export function CapabilityUnavailable({
  stage,
  page,
  prerequisiteHref,
  prerequisiteLabel,
  emptyMessage,
}: {
  stage: LifecycleStageConfig;
  page: LifecyclePageConfig;
  prerequisiteHref?: string;
  prerequisiteLabel?: string;
  emptyMessage?: string;
}) {
  const context = useLifecycleNavContext();
  const isNotAvailable = page.capability === 'not_available';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <LifecycleBreadcrumb stage={stage} page={page} />
        <h1>{page.label}</h1>
        <p>{page.description}</p>
      </header>
      <section className={styles.panel} aria-label="Capability status">
        <div className={styles.banner}>
          <Construction size={18} aria-hidden />
          <div>
            <strong>
              {isNotAvailable ? 'Capability not yet available.' : 'No records yet.'}
            </strong>
            <p>
              {isNotAvailable
                ? `${page.label} is registered in the lifecycle navigation but its domain engine is not yet implemented. No simulated metrics or fake activity are shown.`
                : emptyMessage ||
                  `${page.label} has no persisted records. Autonomous workflow actions that produce this data have not yet written results to MSSQL.`}
            </p>
          </div>
        </div>
        <ul className={styles.list}>
          <li>Route: {page.href}</li>
          <li>Stage: {stage.number} {stage.label}</li>
          <li>Permission key: {page.permissionKey}</li>
        </ul>
        <div className={styles.actions}>
          <Link href={withContextQuery(stage.overviewHref, context)} className={styles.actionLink}>
            Back to stage overview
          </Link>
          {prerequisiteHref ? (
            <Link href={withContextQuery(prerequisiteHref, context)} className={styles.actionLink}>
              {prerequisiteLabel || 'Open prerequisite'}
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
