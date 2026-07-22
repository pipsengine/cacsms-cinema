import assert from 'node:assert/strict';
import test from 'node:test';
import { JobOrchestrator } from '../lib/job-orchestrator';
import { JOB_STATUSES, PROCESSABLE_JOB_STATUSES, isJobStatus } from '../lib/job-status';

test('the persisted lifecycle follows the complete mandatory stage order', () => {
  for (let index = 0; index < PROCESSABLE_JOB_STATUSES.length - 1; index += 1) {
    assert.equal(
      JobOrchestrator.getNextStatus(PROCESSABLE_JOB_STATUSES[index]),
      PROCESSABLE_JOB_STATUSES[index + 1]
    );
  }
  assert.equal(JobOrchestrator.getNextStatus('LEARN'), 'COMPLETED');
  assert.equal(JobOrchestrator.getNextStatus('COMPLETED'), null);
});

test('job statuses reject unknown workflow states', () => {
  for (const status of JOB_STATUSES) assert.equal(isJobStatus(status), true);
  assert.equal(isJobStatus('GENERATING_MAYBE'), false);
  assert.equal(isJobStatus(null), false);
});
