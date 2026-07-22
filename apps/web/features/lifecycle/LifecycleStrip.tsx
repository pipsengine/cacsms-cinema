'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import {
  LIFECYCLE_STAGES,
  deriveWorkflowStatusFromQueue,
  stageJobCount,
  withContextQuery,
  type LifecycleStageConfig,
} from '@/apps/web/config/lifecycle-navigation';
import styles from '@/app/control-room.module.css';

export function LifecycleStrip({
  queue,
  activeWorkflowIndex,
  selectedStageId,
  onSelectStage,
  navigateOnSelect = true,
}: {
  queue: Record<string, number> | null | undefined;
  activeWorkflowIndex: number;
  selectedStageId: string;
  onSelectStage?: (stage: LifecycleStageConfig) => void;
  navigateOnSelect?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const context = useMemo(() => {
    const keys = ['projectId', 'workflowRunId', 'scriptId', 'sceneId', 'shotId', 'jobId', 'candidateId', 'assetId'] as const;
    const next: Record<string, string | null> = {};
    for (const key of keys) next[key] = searchParams.get(key);
    return next;
  }, [searchParams]);

  return (
    <div className={styles.steps} role="navigation" aria-label="Autonomous production lifecycle stages">
      {LIFECYCLE_STAGES.map((stage, index) => {
        const count = stageJobCount(queue, stage);
        const workflowStatus = deriveWorkflowStatusFromQueue(queue, stage);
        const isWorkflowActive = activeWorkflowIndex === index;
        const isSelected = selectedStageId === stage.id;
        const href = withContextQuery(stage.overviewHref, context);
        return (
          <button
            type="button"
            key={stage.id}
            className={`${styles.step} ${styles.stepButton} ${isWorkflowActive ? styles.currentStep : ''} ${isSelected ? styles.selectedStep : ''}`}
            title={`${stage.number} ${stage.label}: ${stage.description}`}
            aria-label={`Stage ${stage.number} ${stage.label}. Workflow status ${workflowStatus}. Open stage overview.`}
            aria-current={isSelected ? 'true' : undefined}
            onClick={() => {
              onSelectStage?.(stage);
              if (navigateOnSelect) router.push(href);
            }}
          >
            <i>{Number(stage.number)}</i>
            <span>{stage.label}</span>
            <strong>{count == null ? '—' : count}</strong>
            <small>
              {workflowStatus === 'unavailable'
                ? 'Unavailable'
                : workflowStatus === 'active'
                  ? 'Active'
                  : count
                    ? 'Queued'
                    : 'Idle'}
            </small>
          </button>
        );
      })}
    </div>
  );
}

export function workflowActiveIndex(
  queue: Record<string, number> | null | undefined,
  activeJobStatus?: string | null,
): number {
  if (activeJobStatus) {
    const bare = activeJobStatus.replace('PROCESSING:', '');
    return LIFECYCLE_STAGES.findIndex((stage) => stage.workflowStatuses.includes(bare));
  }
  if (!queue) return -1;
  return LIFECYCLE_STAGES.findIndex((stage) => deriveWorkflowStatusFromQueue(queue, stage) === 'active');
}
