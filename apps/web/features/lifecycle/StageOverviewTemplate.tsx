'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowLeft, ArrowRight, Construction, Zap } from 'lucide-react';
import {
  LIFECYCLE_STAGES,
  withContextQuery,
  type LifecycleStageConfig,
} from '@/apps/web/config/lifecycle-navigation';
import { LifecycleBreadcrumb, useLifecycleNavContext } from './LifecycleBreadcrumb';
import { LifecycleStrip, workflowActiveIndex } from './LifecycleStrip';
import { StagePagesPanel } from './StagePagesPanel';
import { statusForStage, useLifecycleStatus } from './useLifecycleStatus';
import styles from './lifecycle-page.module.css';
import roomStyles from '@/app/control-room.module.css';

function StageOverviewBody({ stage }: { stage: LifecycleStageConfig }) {
  const context = useLifecycleNavContext();
  const statusPayload = useLifecycleStatus();
  const stageStatus = statusForStage(statusPayload, stage.id);
  const overviewPage = stage.pages[0];
  const index = LIFECYCLE_STAGES.findIndex((item) => item.id === stage.id);
  const previous = index > 0 ? LIFECYCLE_STAGES[index - 1] : null;
  const next = index >= 0 && index < LIFECYCLE_STAGES.length - 1 ? LIFECYCLE_STAGES[index + 1] : null;
  const workflowLabel = stageStatus?.workflowStatus ?? 'unavailable';
  const jobCount = stageStatus?.jobCount;
  const progress = stageStatus?.progressPercent;
  const activeWorkflowIndex = workflowActiveIndex(statusPayload.queue);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <LifecycleBreadcrumb stage={stage} page={overviewPage} />
        <p className={styles.stageEyebrow}>
          Stage {stage.number} · Visual Production Lifecycle
        </p>
        <h1>{stage.label}</h1>
        <p>{stage.description}</p>
      </header>

      <section className={`${roomStyles.panel} ${roomStyles.lifecycle}`} style={{ marginTop: 18 }}>
        <div className={roomStyles.sectionHead}>
          <h2>
            <Zap size={19} /> Autonomous Production Lifecycle
          </h2>
        </div>
        <LifecycleStrip
          queue={statusPayload.queue}
          activeWorkflowIndex={activeWorkflowIndex}
          selectedStageId={stage.id}
          navigateOnSelect
        />
      </section>

      <StagePagesPanel stage={stage} stageStatus={stageStatus} />

      <section className={styles.statusGrid} aria-label="Stage operational summary">
        <article>
          <span>Workflow status</span>
          <strong>{titleCase(workflowLabel)}</strong>
          <small>Driven by persisted job queue — not by page selection</small>
        </article>
        <article>
          <span>Jobs in stage</span>
          <strong>{jobCount == null ? 'Unavailable' : jobCount}</strong>
          <small>Queued + processing for this stage&apos;s statuses</small>
        </article>
        <article>
          <span>Progress</span>
          <strong>{progress == null ? 'Unavailable' : `${progress}%`}</strong>
          <small>Gate completion is not inferred from navigation</small>
        </article>
        <article>
          <span>Blocking exceptions</span>
          <strong>{stageStatus?.blockingIssues ?? 0}</strong>
          <small>Open human-exception pressure for this stage</small>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.banner}>
          <Construction size={18} aria-hidden />
          <div>
            <strong>Stage purpose</strong>
            <p>{stage.description}</p>
          </div>
        </div>
        <div className={styles.overviewGrid}>
          <div>
            <h3>Inputs received</h3>
            <p>Artifacts and context produced by the previous lifecycle stage, when the worker has advanced jobs into this stage.</p>
          </div>
          <div>
            <h3>Current work</h3>
            <p>
              {jobCount && jobCount > 0
                ? `${jobCount} job(s) currently mapped to ${stage.label} statuses.`
                : 'No jobs are currently mapped to this stage’s workflow statuses.'}
            </p>
          </div>
          <div>
            <h3>Mandatory gates</h3>
            <p>All configured workflow statuses for this stage must clear before the worker advances. Opening this overview does not pass gates.</p>
          </div>
          <div>
            <h3>Outputs produced</h3>
            <p>Stage outputs remain unavailable until the autonomous worker records successful completion evidence in MSSQL.</p>
          </div>
        </div>
      </section>

      <nav className={styles.stageNav} aria-label="Adjacent lifecycle stages">
        {previous ? (
          <Link href={withContextQuery(previous.overviewHref, context)} className={styles.stageNavLink}>
            <ArrowLeft size={16} aria-hidden />
            <span>
              <small>Previous stage</small>
              <strong>
                {previous.number} {previous.label}
              </strong>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={withContextQuery(next.overviewHref, context)} className={`${styles.stageNavLink} ${styles.stageNavNext}`}>
            <span>
              <small>Next stage</small>
              <strong>
                {next.number} {next.label}
              </strong>
            </span>
            <ArrowRight size={16} aria-hidden />
          </Link>
        ) : null}
      </nav>
    </div>
  );
}

export function StageOverviewTemplate({ stage }: { stage: LifecycleStageConfig }) {
  return (
    <Suspense fallback={<div className={styles.page}>Loading stage overview…</div>}>
      <StageOverviewBody stage={stage} />
    </Suspense>
  );
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
