import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InvalidWorkflowTransitionError,
  assertTransition,
  canTransition,
  controlActionAllowed,
  targetStatusForControl,
} from '../lib/visual-workflow/statuses';
import {
  calculateOverallProgress,
  calculateTaskProgress,
  finalizeStageProgress,
} from '../lib/visual-workflow/progress';
import { mapJobStatusToStageId } from '../lib/visual-workflow/catalog';

test('valid transitions are accepted', () => {
  assert.equal(canTransition('NOT_STARTED', 'QUEUED'), true);
  assert.equal(canTransition('QUEUED', 'ACTIVE'), true);
  assert.equal(canTransition('ACTIVE', 'COMPLETED'), true);
  assert.equal(canTransition('ACTIVE', 'PAUSING'), true);
  assert.equal(canTransition('PAUSED', 'ACTIVE'), true);
  assert.equal(canTransition('ACTIVE', 'BLOCKED'), true);
  assert.equal(canTransition('BLOCKED', 'ACTIVE'), true);
  assert.equal(canTransition('FAILED', 'QUEUED'), true);
  assert.equal(canTransition('ACTIVE', 'STOPPED'), true);
  assert.equal(canTransition('ACTIVE', 'EMERGENCY_STOPPED'), true);
});

test('invalid transitions are rejected', () => {
  assert.equal(canTransition('COMPLETED', 'ACTIVE'), false);
  assert.equal(canTransition('NOT_STARTED', 'COMPLETED'), false);
  assert.equal(canTransition('CANCELLED', 'QUEUED'), false);
  assert.throws(() => assertTransition('COMPLETED', 'ACTIVE'), InvalidWorkflowTransitionError);
});

test('control actions respect status', () => {
  assert.equal(controlActionAllowed('start', 'NOT_STARTED'), true);
  assert.equal(controlActionAllowed('pause', 'ACTIVE'), true);
  assert.equal(controlActionAllowed('resume', 'PAUSED'), true);
  assert.equal(controlActionAllowed('stop', 'ACTIVE'), true);
  assert.equal(controlActionAllowed('emergency_stop', 'QUEUED'), true);
  assert.equal(controlActionAllowed('retry', 'FAILED'), true);
  assert.equal(controlActionAllowed('pause', 'NOT_STARTED'), false);
  assert.equal(targetStatusForControl('start'), 'QUEUED');
});

test('task-weight progress calculation', () => {
  assert.equal(
    calculateTaskProgress([
      { weight: 1, applicable: true, status: 'COMPLETED' },
      { weight: 1, applicable: true, status: 'NOT_STARTED' },
    ]),
    50,
  );
  assert.equal(
    calculateTaskProgress([
      { weight: 2, applicable: true, status: 'COMPLETED' },
      { weight: 2, applicable: false, status: 'CANCELLED' },
    ]),
    100,
  );
  assert.equal(calculateTaskProgress([]), null);
});

test('mandatory gate prevents completion and 100%', () => {
  const result = finalizeStageProgress({
    taskProgress: 100,
    gates: [{ mandatory: true, result: 'PENDING' }],
    openBlockingExceptions: 0,
    proposedStatus: 'COMPLETED',
  });
  assert.equal(result.canComplete, false);
  assert.ok((result.progressPercent ?? 0) < 100);
});

test('blocking exception precedence', () => {
  const result = finalizeStageProgress({
    taskProgress: 100,
    gates: [{ mandatory: true, result: 'PASSED' }],
    openBlockingExceptions: 2,
    proposedStatus: 'COMPLETED',
  });
  assert.equal(result.canComplete, false);
  assert.ok((result.progressPercent ?? 0) < 100);
});

test('overall progress from weighted stages', () => {
  const overall = calculateOverallProgress([
    { progressPercent: 100, status: 'COMPLETED', weight: 1 },
    { progressPercent: 50, status: 'ACTIVE', weight: 1 },
  ]);
  assert.equal(overall, 75);
});

test('job status maps to lifecycle stage ids', () => {
  assert.equal(mapJobStatusToStageId('DISCOVER'), 'discover');
  assert.equal(mapJobStatusToStageId('PROCESSING:GENERATE_CANDIDATES'), 'generation');
  assert.equal(mapJobStatusToStageId('APPROVE'), 'delivery');
  assert.equal(mapJobStatusToStageId('LEARN'), 'learning');
});
