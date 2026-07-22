'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { Zap } from 'lucide-react';
import { LIFECYCLE_STAGES, withContextQuery } from '@/apps/web/config/lifecycle-navigation';
import { useLifecycleNavContext } from './LifecycleBreadcrumb';
import { LifecycleStrip } from './LifecycleStrip';
import { StagePagesPanel } from './StagePagesPanel';
import { statusForStage, useLifecycleStatus } from './useLifecycleStatus';
import styles from '@/app/control-room.module.css';

function ControlRoomLifecycleStripInner({
  queue,
  activeWorkflowIndex,
}: {
  queue: Record<string, number> | null | undefined;
  activeWorkflowIndex: number;
}) {
  const context = useLifecycleNavContext();
  const statusPayload = useLifecycleStatus();
  const [selectedStageId, setSelectedStageId] = useState<string>(LIFECYCLE_STAGES[0]?.id ?? 'discover');
  const selectedStage = LIFECYCLE_STAGES.find((stage) => stage.id === selectedStageId) ?? LIFECYCLE_STAGES[0];
  const selectedStatus = statusForStage(statusPayload, selectedStage.id);

  return (
    <>
      <section className={`${styles.panel} ${styles.lifecycle}`}>
        <div className={styles.sectionHead}>
          <h2>
            <Zap size={19} /> Autonomous Production Lifecycle
          </h2>
          <Link href={withContextQuery(selectedStage.overviewHref, context)}>Open selected stage ↗</Link>
        </div>
        <LifecycleStrip
          queue={queue ?? statusPayload.queue}
          activeWorkflowIndex={activeWorkflowIndex}
          selectedStageId={selectedStageId}
          onSelectStage={(stage) => setSelectedStageId(stage.id)}
          navigateOnSelect
        />
      </section>
      <StagePagesPanel stage={selectedStage} stageStatus={selectedStatus} />
    </>
  );
}

export function ControlRoomLifecycleStrip({
  queue,
  activeWorkflowIndex,
}: {
  queue: Record<string, number> | null | undefined;
  activeWorkflowIndex: number;
}) {
  return (
    <Suspense
      fallback={
        <section className={`${styles.panel} ${styles.lifecycle}`}>
          <div className={styles.sectionHead}>
            <h2>Autonomous Production Lifecycle</h2>
          </div>
        </section>
      }
    >
      <ControlRoomLifecycleStripInner queue={queue} activeWorkflowIndex={activeWorkflowIndex} />
    </Suspense>
  );
}
