import assert from 'node:assert/strict';
import test from 'node:test';
import {
  claimIsReady,
  evaluateEvidenceGates,
  evidenceConfidence,
} from '../lib/research-evidence/scoring';
import { sectionKeys } from '../lib/research-evidence/contracts';

const good = {
  authority: 92,
  corroboration: 88,
  recency: 80,
  relevance: 94,
  provenance: 96,
  rightsConfidence: 85,
  contradictionRisk: 10,
};

test('evidence confidence is deterministic and bounded', () => {
  assert.ok(evidenceConfidence(good) > 80);
  assert.equal(evidenceConfidence(good), evidenceConfidence(good));
});

test('evidence gates cannot bypass weak provenance', () => {
  assert.equal(evaluateEvidenceGates({ ...good, provenance: 40 }).passed, false);
});

test('evidence gates block unresolved contradiction risk', () => {
  assert.ok(
    evaluateEvidenceGates({ ...good, contradictionRisk: 70 }).failures.some(
      (failure) => failure.code === 'CONTRADICTION_RISK',
    ),
  );
});

test('evidence gates block unclear reuse rights', () => {
  assert.ok(
    evaluateEvidenceGates({ ...good, rightsConfidence: 30 }).failures.some(
      (failure) => failure.code === 'RIGHTS',
    ),
  );
});

test('evidence gates pass reliable evidence', () => {
  assert.equal(evaluateEvidenceGates(good).passed, true);
});

test('claim readiness requires independent corroboration', () => {
  assert.equal(
    claimIsReady({
      material: true,
      supportingSources: 1,
      requiredSources: 2,
      unresolvedContradictions: 0,
      citationComplete: true,
      rightsCleared: true,
    }),
    false,
  );
});

test('claim readiness requires citation and rights clearance', () => {
  assert.equal(
    claimIsReady({
      material: true,
      supportingSources: 2,
      requiredSources: 2,
      unresolvedContradictions: 0,
      citationComplete: false,
      rightsCleared: true,
    }),
    false,
  );
});

test('claim readiness accepts a fully verified material claim', () => {
  assert.equal(
    claimIsReady({
      material: true,
      supportingSources: 3,
      requiredSources: 2,
      unresolvedContradictions: 0,
      citationComplete: true,
      rightsCleared: true,
    }),
    true,
  );
});

test('research evidence navigation exposes twenty pages', async () => {
  const { researchEvidenceNavigation } = await import(
    '../apps/web/lib/research-evidence-navigation'
  );
  assert.equal(researchEvidenceNavigation.length, 20);
  assert.equal(researchEvidenceNavigation[0].href, '/research');
  assert.equal(sectionKeys.length, 19);
  assert.ok(researchEvidenceNavigation.some((item) => item.href === '/research/audit'));
});
