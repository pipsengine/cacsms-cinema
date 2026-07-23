'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { Zap } from 'lucide-react';
import { LIFECYCLE_STAGES, withContextQuery } from '@/apps/web/config/lifecycle-navigation';
import { useLifecycleNavContext } from './LifecycleBreadcrumb';
import { LifecycleStrip } from './LifecycleStrip';
import { StagePagesPanel } from './StagePagesPanel';
import { statusForStage, useLifecycleStatus } from './useLifecycleStatus';
import styles from '@/app/control-room.module.css';

function ControlRoomLifecycleStripInner() {
  const context = useLifecycleNavContext();
  const statusPayload = useLifecycleStatus();
  const [selectedStageId, setSelectedStageId] = useState<string>(LIFECYCLE_STAGES[0]?.id ?? 'discover');
  const selectedStage = LIFECYCLE_STAGES.find((stage) => stage.id === selectedStageId) ?? LIFECYCLE_STAGES[0];
  const selectedStatus = statusForStage(statusPayload, selectedStage.id);
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
    <>
      <section className={`${styles.panel} ${styles.lifecycle}`}>
        <div className={styles.sectionHead}>
          <h2>
            <Zap size={19} /> Visual Production Lifecycle
          </h2>
          <Link href={withContextQuery(selectedStage.overviewHref, {
            ...context,
            workflowRunId: statusPayload.workflowRunId,
          })}>
            Open selected stage ↗
          </Link>
        </div>
        {statusPayload.stale || statusPayload.connectionError ? (
          <p style={{ margin: '0 16px 10px', color: '#b45309', fontSize: 12 }}>
            {statusPayload.connectionError || 'Showing last confirmed status snapshot.'}
          </p>
        ) : null}
        <LifecycleStrip
          activeStageId={statusPayload.activeStageId}
          selectedStageId={selectedStageId}
          stageStatuses={stageStatuses}
          onSelectStage={(stage) => setSelectedStageId(stage.id)}
          navigateOnSelect
        />
      </section>
      <StagePagesPanel stage={selectedStage} stageStatus={selectedStatus} />
    </>
  );
}

export function ControlRoomLifecycleStrip({
  queue: _queue,
  activeWorkflowIndex: _activeWorkflowIndex,
}: {
  queue?: Record<string, number> | null | undefined;
  activeWorkflowIndex?: number;
}) {
  return (
    <Suspense
      fallback={
        <section className={`${styles.panel} ${styles.lifecycle}`}>
          <div className={styles.sectionHead}>
            <h2>Visual Production Lifecycle</h2>
          </div>
        </section>
      }
    >
      <ControlRoomLifecycleStripInner />
    </Suspense>
  );
}
