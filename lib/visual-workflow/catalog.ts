import { LIFECYCLE_STAGES } from '@/apps/web/config/lifecycle-navigation';

/** Stable task catalog used when seeding a workflow run. */
export function buildStageTaskCatalog(stageId: string): Array<{
  pageId: string | null;
  taskType: string;
  sequenceOrder: number;
  weight: number;
  applicable: boolean;
}> {
  const stage = LIFECYCLE_STAGES.find((item) => item.id === stageId);
  if (!stage) return [];

  return stage.pages
    .filter((page) => !page.exact)
    .map((page, index) => ({
      pageId: page.id,
      taskType: `PAGE_CAPABILITY:${page.id}`,
      sequenceOrder: index + 1,
      weight: 1,
      applicable: page.capability === 'live',
    }));
}

export function buildStageGateCatalog(stageId: string): Array<{
  gateType: string;
  mandatory: boolean;
  requiredThreshold: number | null;
  calculationBasis: string;
}> {
  const stage = LIFECYCLE_STAGES.find((item) => item.id === stageId);
  if (!stage) return [];

  return [
    {
      gateType: 'MANDATORY_STAGE_JOBS',
      mandatory: true,
      requiredThreshold: 1,
      calculationBasis: `All mapped job statuses must succeed: ${stage.workflowStatuses.join(',')}`,
    },
    {
      gateType: 'NO_OPEN_BLOCKING_EXCEPTIONS',
      mandatory: true,
      requiredThreshold: 0,
      calculationBasis: 'blockingExceptionCount must be 0',
    },
  ];
}

export function mapJobStatusToStageId(jobStatus: string): string | null {
  const bare = jobStatus.replace(/^PROCESSING:/, '');
  for (const stage of LIFECYCLE_STAGES) {
    if (stage.workflowStatuses.includes(bare)) return stage.id;
  }
  if (bare === 'COMPLETED') return 'learning';
  if (bare === 'HUMAN_EXCEPTION_REQUIRED' || bare === 'FAILED' || bare === 'CANCELLED') return null;
  return null;
}

export function stageIdsBefore(stageId: string): string[] {
  const index = LIFECYCLE_STAGES.findIndex((stage) => stage.id === stageId);
  if (index < 0) return [];
  return LIFECYCLE_STAGES.slice(0, index).map((stage) => stage.id);
}
