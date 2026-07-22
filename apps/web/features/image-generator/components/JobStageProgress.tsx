'use client';

import { LIFECYCLE_GROUPS, TERMINAL_STATUSES, displayStage, type JobRecord } from '../types';
import styles from '../image-generator.module.css';

/** Stage progress for the selected job only — not fleet-wide queue counts. */
export function JobStageProgress({ job }: { job: JobRecord | null }) {
  if (!job) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>No job selected</h3>
        <p>Select a job from the queue to see its stage progress.</p>
      </div>
    );
  }

  const stageKey = job.status.replace('PROCESSING:', '');
  const activeIndex = TERMINAL_STATUSES.has(job.status)
    ? job.status === 'COMPLETED'
      ? LIFECYCLE_GROUPS.length - 1
      : -1
    : LIFECYCLE_GROUPS.findIndex((group) => (group.stages as readonly string[]).includes(stageKey));

  return (
    <section className={styles.pipeline} aria-label="Selected job stage progress">
      <div className={styles.pipelineHead}>
        <h2>Job stage progress</h2>
        <small>{displayStage(job.status)}</small>
      </div>
      <ol className={styles.steps}>
        {LIFECYCLE_GROUPS.map((group, index) => {
          let className = styles.step;
          if (activeIndex === index) className = `${styles.step} ${styles.stepActive}`;
          else if (activeIndex > index || job.status === 'COMPLETED') className = `${styles.step} ${styles.stepComplete}`;
          else if (job.status === 'HUMAN_EXCEPTION_REQUIRED' && activeIndex < 0 && index === 0) {
            className = `${styles.step} ${styles.stepBlocked}`;
          }
          return (
            <li key={group.label} className={className}>
              <i aria-hidden>{index + 1}</i>
              <span>{group.label}</span>
            </li>
          );
        })}
      </ol>
      {job.failureCode ? (
        <p className={styles.mutedCopy}>Failure code: {job.failureCode}</p>
      ) : null}
    </section>
  );
}
