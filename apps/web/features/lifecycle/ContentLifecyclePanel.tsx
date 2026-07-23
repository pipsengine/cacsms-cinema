'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpRight, Layers3 } from 'lucide-react';
import { productionNavigation, type NavItem } from '@/apps/web/components/sidebar/navigation';
import styles from '@/app/control-room.module.css';

/** Full autonomous content lifecycle — all 12 production stages. */
const CONTENT_LIFECYCLE_STAGES = productionNavigation;

export function ContentLifecyclePanel() {
  const [selectedId, setSelectedId] = useState(CONTENT_LIFECYCLE_STAGES[0]?.id ?? 'strategy');
  const selected = useMemo(
    () => CONTENT_LIFECYCLE_STAGES.find((item) => item.id === selectedId) ?? CONTENT_LIFECYCLE_STAGES[0],
    [selectedId],
  );
  const pages = selected?.children ?? [];

  return (
    <>
      <section className={`${styles.panel} ${styles.lifecycle}`}>
        <div className={styles.sectionHead}>
          <h2>
            <Layers3 size={19} /> Content Lifecycle
          </h2>
          {selected ? (
            <Link href={selected.href}>Open {selected.label} ↗</Link>
          ) : null}
        </div>
        <p className={styles.lifecycleHint}>
          All 12 production stages. Select a stage to open its command centre pages. Status and counts
          come from each stage’s persisted APIs — nothing is fabricated here.
        </p>
        <div
          className={styles.contentSteps}
          role="navigation"
          aria-label="Content lifecycle stages"
        >
          {CONTENT_LIFECYCLE_STAGES.map((stage) => {
            const isSelected = stage.id === selected?.id;
            const pageCount = stage.children?.length ?? 0;
            return (
              <button
                type="button"
                key={stage.id}
                className={`${styles.step} ${styles.stepButton} ${isSelected ? styles.selectedStep : ''}`}
                aria-current={isSelected ? 'true' : undefined}
                aria-label={`Stage ${stage.sequence} ${stage.label}. ${pageCount || 'Overview only'}.`}
                onClick={() => setSelectedId(stage.id)}
              >
                <i>{Number(stage.sequence)}</i>
                <span>{stage.label}</span>
                <strong>{pageCount || '—'}</strong>
                <small>{pageCount ? 'pages' : 'overview'}</small>
              </button>
            );
          })}
        </div>
      </section>

      {selected ? <ContentStagePagesPanel stage={selected} pages={pages} /> : null}
    </>
  );
}

function ContentStagePagesPanel({
  stage,
  pages,
}: {
  stage: NavItem;
  pages: NavItem[];
}) {
  return (
    <section className={`${styles.panel} ${styles.stagePages}`} aria-label={`${stage.label} pages`}>
      <div className={styles.sectionHead}>
        <div>
          <h2>
            {stage.sequence} {stage.label} — Stage Pages
          </h2>
          <p className={styles.lifecycleHint}>
            {pages.length
              ? `${pages.length} surfaces under this command centre`
              : 'This stage opens a single overview surface until its dedicated pages are added.'}
          </p>
        </div>
        <Link href={stage.href}>Open command centre ↗</Link>
      </div>
      {pages.length ? (
        <div className={styles.stagePageGrid}>
          {pages.map((page) => (
            <article key={page.id} className={styles.stagePageCard}>
              <h3>{page.label}</h3>
              <p>{page.href}</p>
              <Link href={page.href} className={styles.stagePageOpen}>
                Open page
                <ArrowUpRight size={15} aria-hidden />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.stagePageGrid}>
          <article className={styles.stagePageCard}>
            <h3>{stage.label} Overview</h3>
            <p>{stage.href}</p>
            <Link href={stage.href} className={styles.stagePageOpen}>
              Open page
              <ArrowUpRight size={15} aria-hidden />
            </Link>
          </article>
        </div>
      )}
    </section>
  );
}
