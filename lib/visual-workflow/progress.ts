/**
 * Progress is derived only from persisted applicable task weights and mandatory gates.
 * Never invent percentages when measurement is impossible.
 */

export interface WeightedTask {
  weight: number;
  applicable: boolean;
  status: string;
}

export interface GateResult {
  mandatory: boolean;
  result: string; // PENDING | PASSED | FAILED | SKIPPED
}

export function calculateTaskProgress(tasks: WeightedTask[]): number | null {
  const applicable = tasks.filter((task) => task.applicable);
  if (applicable.length === 0) return null;

  const totalWeight = applicable.reduce((sum, task) => sum + task.weight, 0);
  if (totalWeight <= 0) return null;

  const completedWeight = applicable
    .filter((task) => task.status === 'COMPLETED')
    .reduce((sum, task) => sum + task.weight, 0);

  return Math.min(100, Math.max(0, (completedWeight / totalWeight) * 100));
}

/**
 * A stage cannot report 100% or COMPLETED while any mandatory gate is unresolved/failed,
 * or while blocking exceptions remain open.
 */
export function finalizeStageProgress(args: {
  taskProgress: number | null;
  gates: GateResult[];
  openBlockingExceptions: number;
  proposedStatus: string;
}): { progressPercent: number | null; canComplete: boolean; reason?: string } {
  const { taskProgress, gates, openBlockingExceptions, proposedStatus } = args;

  if (openBlockingExceptions > 0) {
    return {
      progressPercent: taskProgress == null ? null : Math.min(taskProgress, 99.9),
      canComplete: false,
      reason: 'Blocking exception open',
    };
  }

  const mandatory = gates.filter((gate) => gate.mandatory);
  const unresolved = mandatory.filter((gate) => gate.result !== 'PASSED' && gate.result !== 'SKIPPED');
  const failed = mandatory.filter((gate) => gate.result === 'FAILED');

  if (failed.length > 0) {
    return {
      progressPercent: taskProgress == null ? null : Math.min(taskProgress, 99.9),
      canComplete: false,
      reason: 'Mandatory gate failed',
    };
  }

  if (unresolved.length > 0) {
    return {
      progressPercent: taskProgress == null ? null : Math.min(taskProgress, 99.9),
      canComplete: false,
      reason: 'Mandatory gate unresolved',
    };
  }

  if (proposedStatus === 'COMPLETED' && (taskProgress == null || taskProgress < 100)) {
    return {
      progressPercent: taskProgress,
      canComplete: false,
      reason: 'Tasks incomplete',
    };
  }

  return { progressPercent: taskProgress, canComplete: true };
}

export function calculateOverallProgress(
  stages: Array<{ progressPercent: number | null; status: string; weight?: number }>,
): number | null {
  if (stages.length === 0) return null;

  const measurable = stages.filter((stage) => stage.progressPercent != null || stage.status === 'COMPLETED');
  if (measurable.length === 0) return null;

  let totalWeight = 0;
  let accrued = 0;
  for (const stage of stages) {
    const weight = stage.weight ?? 1;
    totalWeight += weight;
    if (stage.status === 'COMPLETED') {
      accrued += weight * 100;
    } else if (stage.progressPercent != null) {
      accrued += weight * stage.progressPercent;
    }
  }

  if (totalWeight <= 0) return null;
  return Math.min(100, Math.max(0, accrued / totalWeight));
}
