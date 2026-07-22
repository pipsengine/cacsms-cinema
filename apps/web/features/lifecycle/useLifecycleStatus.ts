'use client';

import { useEffect, useState } from 'react';
import {
  LIFECYCLE_STAGES,
  deriveWorkflowStatusFromQueue,
  stageJobCount,
  type PageCapabilityStatus,
  type WorkflowOperationalStatus,
} from '@/apps/web/config/lifecycle-navigation';

export interface LifecycleStageStatusView {
  id: string;
  workflowStatus: WorkflowOperationalStatus;
  jobCount: number | null;
  progressPercent: number | null;
  blockingIssues: number;
  lastUpdatedAt: string | null;
  pages: Array<{
    id: string;
    status: PageCapabilityStatus;
    count: number | null;
    blocking: boolean;
    lastUpdatedAt: string | null;
  }>;
}

export interface LifecycleStatusPayload {
  generatedAt: string | null;
  available: boolean;
  queue: Record<string, number> | null;
  stages: LifecycleStageStatusView[];
}

const EMPTY: LifecycleStatusPayload = {
  generatedAt: null,
  available: false,
  queue: null,
  stages: LIFECYCLE_STAGES.map((stage) => ({
    id: stage.id,
    workflowStatus: 'unavailable' as const,
    jobCount: null,
    progressPercent: null,
    blockingIssues: 0,
    lastUpdatedAt: null,
    pages: stage.pages.map((page) => ({
      id: page.id,
      status: page.capability === 'not_available' ? ('not_available' as const) : ('not_started' as const),
      count: null,
      blocking: false,
      lastUpdatedAt: null,
    })),
  })),
};

export function useLifecycleStatus(): LifecycleStatusPayload {
  const [payload, setPayload] = useState<LifecycleStatusPayload>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/lifecycle/status', { cache: 'no-store' });
        if (!response.ok) {
          if (!cancelled) setPayload(EMPTY);
          return;
        }
        const data = (await response.json()) as LifecycleStatusPayload;
        if (!cancelled) setPayload(data);
      } catch {
        if (!cancelled) setPayload(EMPTY);
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return payload;
}

export function statusForStage(
  payload: LifecycleStatusPayload,
  stageId: string,
): LifecycleStageStatusView | undefined {
  return payload.stages.find((stage) => stage.id === stageId);
}

/** Pure helper for tests: viewing a stage must not mutate workflow status. */
export function selectedStageDoesNotMutateWorkflow(
  before: WorkflowOperationalStatus,
  afterSelectingStage: WorkflowOperationalStatus,
): boolean {
  return before === afterSelectingStage;
}

export function fallbackStatusFromQueue(queue: Record<string, number> | null): LifecycleStatusPayload {
  return {
    generatedAt: null,
    available: Boolean(queue),
    queue,
    stages: LIFECYCLE_STAGES.map((stage) => ({
      id: stage.id,
      workflowStatus: deriveWorkflowStatusFromQueue(queue, stage),
      jobCount: stageJobCount(queue, stage),
      progressPercent: null,
      blockingIssues: 0,
      lastUpdatedAt: null,
      pages: stage.pages.map((page) => ({
        id: page.id,
        status: page.capability === 'not_available' ? 'not_available' : 'not_started',
        count: null,
        blocking: false,
        lastUpdatedAt: null,
      })),
    })),
  };
}
