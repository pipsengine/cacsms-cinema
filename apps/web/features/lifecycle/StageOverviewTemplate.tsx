'use client';

import Link from 'next/link';
import { Suspense, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Construction, Zap } from 'lucide-react';
import {
  LIFECYCLE_STAGES,
  withContextQuery,
  type LifecycleStageConfig,
} from '@/apps/web/config/lifecycle-navigation';
import { LifecycleBreadcrumb, useLifecycleNavContext } from './LifecycleBreadcrumb';
import { LifecycleStrip } from './LifecycleStrip';
import { StagePagesPanel } from './StagePagesPanel';
import { WorkflowControlBar } from './WorkflowControlBar';
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
  const executionLabel = stageStatus?.executionStatus ?? 'UNAVAILABLE';
  const progress = stageStatus?.progressPercent;
  const stageStatuses = useMemo(
    () =>
      Object.fromEntries(
        statusPayload.stages.map((item) => [
          item.id,
          {
            executionStatus: item.executionStatus,
            progressPercent: item.progressPercent,
            count: item.completedTaskCount ?? item.jobCount,
          },
        ]),
      ),
    [statusPayload.stages],
  );

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

      <WorkflowControlBar
        workflowRunId={statusPayload.workflowRunId}
        version={statusPayload.version}
        allowedActions={statusPayload.allowedActions}
        overallStatus={statusPayload.overallStatus}
        stale={statusPayload.stale}
        connectionError={statusPayload.connectionError}
        onChanged={() => void statusPayload.refresh()}
      />

      <section className={`${roomStyles.panel} ${roomStyles.lifecycle}`} style={{ marginTop: 18 }}>
        <div className={roomStyles.sectionHead}>
          <h2>
            <Zap size={19} /> Autonomous Production Lifecycle
          </h2>
        </div>
        <LifecycleStrip
          activeStageId={statusPayload.activeStageId}
          selectedStageId={stage.id}
          stageStatuses={stageStatuses}
          navigateOnSelect
        />
      </section>

      <StagePagesPanel stage={stage} stageStatus={stageStatus} />

      <section className={styles.statusGrid} aria-label="Stage operational summary">
        <article>
          <span>Execution status</span>
          <strong>{titleCase(executionLabel)}</strong>
          <small>Persisted backend status — selection does not change execution</small>
        </article>
        <article>
          <span>Tasks</span>
          <strong>
            {stageStatus?.completedTaskCount != null && stageStatus?.totalTaskCount != null
              ? `${stageStatus.completedTaskCount}/${stageStatus.totalTaskCount}`
              : 'Unavailable'}
          </strong>
          <small>Completed / applicable tasks for this stage</small>
        </article>
        <article>
          <span>Progress</span>
          <strong>{progress == null ? 'Unavailable' : `${Number(progress).toFixed(1)}%`}</strong>
          <small>Weighted tasks and mandatory gates only</small>
        </article>
        <article>
          <span>Blocking exceptions</span>
          <strong>{stageStatus?.blockingIssues ?? 0}</strong>
          <small>Open blocking exceptions for this stage</small>
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
            <p>Artifacts produced by prior stages when the worker has advanced the linked job into this stage.</p>
          </div>
          <div>
            <h3>Current work</h3>
            <p>
              {executionLabel === 'ACTIVE'
                ? 'This stage is currently executing in the persisted workflow run.'
                : `Execution status is ${executionLabel}.`}
            </p>
          </div>
          <div>
            <h3>Mandatory gates</h3>
            <p>Stage completion requires passed mandatory gates and zero open blocking exceptions.</p>
          </div>
          <div>
            <h3>Outputs produced</h3>
            <p>Outputs remain unavailable until the worker records successful stage evidence in MSSQL.</p>
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
