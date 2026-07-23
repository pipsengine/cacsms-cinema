/**
 * Authoritative visual-workflow execution statuses and transition rules.
 * The client must never invent or force transitions outside this machine.
 */

export const VISUAL_WORKFLOW_STATUSES = [
  'NOT_STARTED',
  'WAITING',
  'QUEUED',
  'ACTIVE',
  'PAUSING',
  'PAUSED',
  'BLOCKED',
  'DEGRADED',
  'FAILED',
  'COMPLETED',
  'STOPPED',
  'EMERGENCY_STOPPED',
  'RECOVERING',
  'CANCELLED',
  'UNAVAILABLE',
] as const;

export type VisualWorkflowStatus = (typeof VISUAL_WORKFLOW_STATUSES)[number];

export const TERMINAL_WORKFLOW_STATUSES: ReadonlySet<VisualWorkflowStatus> = new Set([
  'COMPLETED',
  'CANCELLED',
  'EMERGENCY_STOPPED',
]);

/** Allowed directed transitions. Keys are from-status; values are permitted to-statuses. */
export const VISUAL_WORKFLOW_TRANSITIONS: Record<VisualWorkflowStatus, readonly VisualWorkflowStatus[]> = {
  NOT_STARTED: ['QUEUED', 'WAITING', 'CANCELLED', 'UNAVAILABLE'],
  WAITING: ['QUEUED', 'ACTIVE', 'BLOCKED', 'CANCELLED', 'UNAVAILABLE'],
  QUEUED: ['ACTIVE', 'PAUSING', 'PAUSED', 'STOPPED', 'EMERGENCY_STOPPED', 'CANCELLED', 'BLOCKED'],
  ACTIVE: [
    'COMPLETED',
    'PAUSING',
    'PAUSED',
    'BLOCKED',
    'DEGRADED',
    'FAILED',
    'STOPPED',
    'EMERGENCY_STOPPED',
    'RECOVERING',
  ],
  PAUSING: ['PAUSED', 'ACTIVE', 'EMERGENCY_STOPPED', 'STOPPED'],
  PAUSED: ['ACTIVE', 'STOPPED', 'EMERGENCY_STOPPED', 'CANCELLED', 'RECOVERING'],
  BLOCKED: ['ACTIVE', 'QUEUED', 'FAILED', 'STOPPED', 'CANCELLED', 'RECOVERING'],
  DEGRADED: ['ACTIVE', 'BLOCKED', 'FAILED', 'COMPLETED', 'STOPPED', 'PAUSED'],
  FAILED: ['QUEUED', 'CANCELLED', 'STOPPED', 'RECOVERING'],
  COMPLETED: [],
  STOPPED: ['QUEUED', 'RECOVERING', 'CANCELLED'],
  EMERGENCY_STOPPED: ['RECOVERING', 'CANCELLED', 'STOPPED'],
  RECOVERING: ['ACTIVE', 'QUEUED', 'PAUSED', 'BLOCKED', 'FAILED', 'STOPPED'],
  CANCELLED: [],
  UNAVAILABLE: ['NOT_STARTED', 'WAITING', 'QUEUED', 'RECOVERING'],
};

export function isVisualWorkflowStatus(value: string): value is VisualWorkflowStatus {
  return (VISUAL_WORKFLOW_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: VisualWorkflowStatus, to: VisualWorkflowStatus): boolean {
  if (from === to) return true;
  return VISUAL_WORKFLOW_TRANSITIONS[from].includes(to);
}

export class InvalidWorkflowTransitionError extends Error {
  readonly from: VisualWorkflowStatus;
  readonly to: VisualWorkflowStatus;

  constructor(from: VisualWorkflowStatus, to: VisualWorkflowStatus) {
    super(`Invalid visual workflow transition: ${from} → ${to}`);
    this.name = 'InvalidWorkflowTransitionError';
    this.from = from;
    this.to = to;
  }
}

export function assertTransition(from: VisualWorkflowStatus, to: VisualWorkflowStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidWorkflowTransitionError(from, to);
  }
}

export function controlActionAllowed(
  action: 'start' | 'pause' | 'resume' | 'stop' | 'emergency_stop' | 'recover' | 'retry',
  status: VisualWorkflowStatus,
): boolean {
  switch (action) {
    case 'start':
      return status === 'NOT_STARTED' || status === 'STOPPED' || status === 'WAITING';
    case 'pause':
      return status === 'ACTIVE' || status === 'QUEUED' || status === 'DEGRADED';
    case 'resume':
      return status === 'PAUSED' || status === 'PAUSING';
    case 'stop':
      return (
        status === 'ACTIVE' ||
        status === 'QUEUED' ||
        status === 'PAUSED' ||
        status === 'PAUSING' ||
        status === 'DEGRADED' ||
        status === 'BLOCKED' ||
        status === 'RECOVERING'
      );
    case 'emergency_stop':
      return (
        status === 'ACTIVE' ||
        status === 'QUEUED' ||
        status === 'PAUSED' ||
        status === 'PAUSING' ||
        status === 'WAITING' ||
        status === 'DEGRADED' ||
        status === 'BLOCKED' ||
        status === 'RECOVERING'
      );
    case 'recover':
      return (
        status === 'EMERGENCY_STOPPED' ||
        status === 'STOPPED' ||
        status === 'FAILED' ||
        status === 'BLOCKED' ||
        status === 'RECOVERING'
      );
    case 'retry':
      return status === 'FAILED' || status === 'BLOCKED';
    default:
      return false;
  }
}

export function targetStatusForControl(
  action: 'start' | 'pause' | 'resume' | 'stop' | 'emergency_stop' | 'recover' | 'retry',
): VisualWorkflowStatus {
  switch (action) {
    case 'start':
      return 'QUEUED';
    case 'pause':
      return 'PAUSING';
    case 'resume':
      return 'ACTIVE';
    case 'stop':
      return 'STOPPED';
    case 'emergency_stop':
      return 'EMERGENCY_STOPPED';
    case 'recover':
      return 'RECOVERING';
    case 'retry':
      return 'QUEUED';
  }
}
