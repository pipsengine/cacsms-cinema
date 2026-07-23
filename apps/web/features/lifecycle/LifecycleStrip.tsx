'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import {
  LIFECYCLE_STAGES,
  withContextQuery,
  type LifecycleStageConfig,
} from '@/apps/web/config/lifecycle-navigation';
import styles from '@/app/control-room.module.css';

export function LifecycleStrip({
  activeStageId,
  selectedStageId,
  stageStatuses,
  onSelectStage,
  navigateOnSelect = true,
}: {
  /** Workflow engine active stage (not UI selection). */
  activeStageId?: string | null;
  selectedStageId: string;
  stageStatuses?: Record<string, { executionStatus?: string; progressPercent?: number | null; count?: number | null }>;
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
      {LIFECYCLE_STAGES.map((stage) => {
        const meta = stageStatuses?.[stage.id];
        const executionStatus = meta?.executionStatus ?? 'UNAVAILABLE';
        const count = meta?.count;
        const isWorkflowActive = activeStageId === stage.id;
        const isSelected = selectedStageId === stage.id;
        const href = withContextQuery(stage.overviewHref, context);
        return (
          <button
            type="button"
            key={stage.id}
            className={`${styles.step} ${styles.stepButton} ${isWorkflowActive ? styles.currentStep : ''} ${isSelected ? styles.selectedStep : ''}`}
            title={`${stage.number} ${stage.label}: ${stage.description}`}
            aria-label={`Stage ${stage.number} ${stage.label}. Execution status ${executionStatus}. Open stage overview.`}
            aria-current={isSelected ? 'true' : undefined}
            onClick={() => {
              onSelectStage?.(stage);
              if (navigateOnSelect) router.push(href);
            }}
          >
            <i>{Number(stage.number)}</i>
            <span>{stage.label}</span>
            <strong>{count == null ? '—' : count}</strong>
            <small>{formatExec(executionStatus)}</small>
          </button>
        );
      })}
    </div>
  );
}

function formatExec(status: string): string {
  if (status === 'UNAVAILABLE') return 'Unavailable';
  if (status === 'ACTIVE') return 'Active';
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'BLOCKED' || status === 'FAILED') return 'Blocked';
  if (status === 'QUEUED') return 'Queued';
  if (status === 'WAITING') return 'Waiting';
  if (status === 'PAUSED') return 'Paused';
  if (status === 'NOT_STARTED') return 'Not started';
  return status.replaceAll('_', ' ');
}

export function workflowActiveIndex(activeStageId?: string | null): number {
  if (!activeStageId) return -1;
  return LIFECYCLE_STAGES.findIndex((stage) => stage.id === activeStageId);
}
