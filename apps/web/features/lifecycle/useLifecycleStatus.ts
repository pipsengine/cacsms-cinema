'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LIFECYCLE_STAGES } from '@/apps/web/config/lifecycle-navigation';
import type { PageCapabilityStatus, WorkflowOperationalStatus } from '@/apps/web/config/lifecycle-navigation';

export interface LifecycleStageStatusView {
  id: string;
  workflowStatus: WorkflowOperationalStatus;
  executionStatus: string;
  jobCount: number | null;
  progressPercent: number | null;
  completedTaskCount?: number;
  totalTaskCount?: number;
  blockingIssues: number;
  lastUpdatedAt: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  retryEligible?: boolean;
  pages: Array<{
    id: string;
    status: PageCapabilityStatus;
    executionStatus?: string;
    count: number | null;
    blocking: boolean;
    lastUpdatedAt: string | null;
    progressPercent?: number | null;
    statusReason?: string | null;
  }>;
}

export interface LifecycleStatusPayload {
  generatedAt: string | null;
  available: boolean;
  stale: boolean;
  workflowRunId: string | null;
  overallStatus?: string;
  overallProgress?: number | null;
  activeStageId?: string | null;
  version?: number;
  lastHeartbeatAt?: string | null;
  allowedActions?: string[];
  connectionError: string | null;
  queue: Record<string, number> | null;
  stages: LifecycleStageStatusView[];
}

function emptyPayload(stale = false, connectionError: string | null = null): LifecycleStatusPayload {
  return {
    generatedAt: null,
    available: false,
    stale,
    workflowRunId: null,
    connectionError,
    queue: null,
    stages: LIFECYCLE_STAGES.map((stage) => ({
      id: stage.id,
      workflowStatus: 'unavailable',
      executionStatus: 'UNAVAILABLE',
      jobCount: null,
      progressPercent: null,
      blockingIssues: 0,
      lastUpdatedAt: null,
      pages: stage.pages.map((page) => ({
        id: page.id,
        status: page.capability === 'not_available' ? 'not_available' : 'not_started',
        executionStatus: page.capability === 'not_available' ? 'UNAVAILABLE' : 'NOT_STARTED',
        count: null,
        blocking: false,
        lastUpdatedAt: null,
      })),
    })),
  };
}

export function useLifecycleStatus(): LifecycleStatusPayload & { refresh: () => Promise<void> } {
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<LifecycleStatusPayload>(emptyPayload());
  const lastGood = useRef<LifecycleStatusPayload | null>(null);
  const inFlight = useRef(false);
  const backoffMs = useRef(15000);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const params = new URLSearchParams();
      const workflowRunId = searchParams.get('workflowRunId');
      const projectId = searchParams.get('projectId');
      const jobId = searchParams.get('jobId');
      if (workflowRunId) params.set('workflowRunId', workflowRunId);
      if (projectId) params.set('projectId', projectId);
      if (jobId) params.set('jobId', jobId);

      const response = await fetch(`/api/lifecycle/status?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Status API unavailable');
      const data = (await response.json()) as Omit<LifecycleStatusPayload, 'stale' | 'connectionError'>;
      const next: LifecycleStatusPayload = {
        ...emptyPayload(),
        ...data,
        stale: false,
        connectionError: null,
        available: data.available !== false,
        stages: data.stages?.length ? data.stages : emptyPayload().stages,
      };
      lastGood.current = next;
      setPayload(next);
      backoffMs.current = 15000;
    } catch {
      const fallback = lastGood.current
        ? { ...lastGood.current, stale: true, connectionError: 'Status connection lost. Showing last confirmed snapshot.' }
        : emptyPayload(true, 'Status service unavailable.');
      setPayload(fallback);
      backoffMs.current = Math.min(60000, backoffMs.current * 1.5);
    } finally {
      inFlight.current = false;
    }
  }, [searchParams]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    let interval = window.setInterval(() => void refresh(), backoffMs.current);

    const resetInterval = window.setInterval(() => {
      window.clearInterval(interval);
      interval = window.setInterval(() => void refresh(), backoffMs.current);
    }, 60000);

    const onFocus = () => void refresh();
    const onOnline = () => void refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.clearInterval(resetInterval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [refresh]);

  return { ...payload, refresh };
}

export function statusForStage(
  payload: LifecycleStatusPayload,
  stageId: string,
): LifecycleStageStatusView | undefined {
  return payload.stages.find((stage) => stage.id === stageId);
}

export function selectedStageDoesNotMutateWorkflow(
  before: WorkflowOperationalStatus,
  afterSelectingStage: WorkflowOperationalStatus,
): boolean {
  return before === afterSelectingStage;
}
