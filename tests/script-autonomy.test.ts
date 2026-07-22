import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyScriptFailure } from '../lib/script-autonomy';
import { calculateSceneReadiness, formatDuration } from '../lib/script-metrics';

test('script readiness is deterministic and evidence-based', () => {
  const complete = calculateSceneReadiness({
    purpose: 'Establish the central conflict.', narration: 'A complete narration line.', visualIntention: 'A clear observable visual direction.',
    locationPeriod: 'Lagos, present day, sunrise.', emotionalDirection: 'Quietly hopeful and intimate.', cameraDirection: 'Wide controlled tracking shot.',
    soundDirection: 'Natural ambience beneath a restrained score.', durationSec: 48,
  });
  const incomplete = calculateSceneReadiness({ purpose: '', narration: '', visualIntention: '', locationPeriod: '', emotionalDirection: '', cameraDirection: '', soundDirection: '', durationSec: 48 });
  assert.equal(complete, 100);
  assert.equal(incomplete, 13);
  assert.equal(formatDuration(48), '0:48');
});

test('provider credential failures receive a stable autonomous exception code', () => {
  assert.equal(classifyScriptFailure('{"reason":"API_KEY_INVALID","message":"API key not valid"}'), 'PROVIDER_API_KEY_INVALID');
  assert.equal(classifyScriptFailure('PROVIDER_NOT_CONFIGURED: missing'), 'PROVIDER_NOT_CONFIGURED');
  assert.equal(classifyScriptFailure('unclassified failure'), 'SCRIPT_AUTOMATION_FAILED');
});
