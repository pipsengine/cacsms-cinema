import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateGates,
  rankCandidates,
  scoreCandidate,
} from '../lib/idea-qualification/scoring';
import { sectionKeys } from '../lib/idea-qualification/contracts';

const good = {
  strategicFit: 92,
  evidence: 88,
  audienceValue: 84,
  originality: 79,
  timeliness: 76,
  educationalValue: 87,
  regionalRelevance: 90,
  visualPotential: 82,
  feasibility: 80,
  sourceAvailability: 85,
  risk: 12,
  duplicateSimilarity: 20,
};

test('qualification scoring is deterministic and bounded', () => {
  assert.ok(scoreCandidate(good) > 80);
  assert.equal(scoreCandidate(good), scoreCandidate(good));
});

test('qualification gates are not bypassed by evidence failure', () => {
  assert.equal(evaluateGates({ ...good, evidence: 40 }).passed, false);
});

test('qualification gates block duplicate content', () => {
  assert.ok(
    evaluateGates({ ...good, duplicateSimilarity: 70 }).failures.some(
      (failure) => failure.code === 'DUPLICATE',
    ),
  );
});

test('qualification gates block excessive risk', () => {
  assert.ok(
    evaluateGates({ ...good, risk: 60 }).failures.some((failure) => failure.code === 'RISK'),
  );
});

test('qualification gates pass a qualifying idea', () => {
  assert.equal(evaluateGates(good).passed, true);
});

test('qualified ranking excludes failed gates', () => {
  assert.equal(
    rankCandidates([
      { score: 99, gateStatus: 'FAILED', domain: 'A' },
      { score: 85, gateStatus: 'PASSED', domain: 'B' },
    ]).length,
    1,
  );
});

test('qualified ranking sorts passed ideas', () => {
  assert.equal(
    rankCandidates([
      { score: 70, gateStatus: 'PASSED', domain: 'A' },
      { score: 90, gateStatus: 'PASSED', domain: 'B' },
    ])[0].score,
    90,
  );
});

test('qualified ranking enforces portfolio caps', () => {
  assert.equal(
    rankCandidates(
      [
        { score: 90, gateStatus: 'PASSED', domain: 'A', geography: 'NG' },
        { score: 80, gateStatus: 'PASSED', domain: 'A', geography: 'NG' },
        { score: 70, gateStatus: 'PASSED', domain: 'A', geography: 'NG' },
      ],
      2,
    ).length,
    2,
  );
});

test('idea qualification navigation exposes nineteen pages', async () => {
  const { ideaQualificationNavigation } = await import(
    '../apps/web/lib/idea-qualification-navigation'
  );
  assert.equal(ideaQualificationNavigation.length, 19);
  assert.equal(ideaQualificationNavigation[0].href, '/ideas');
  assert.equal(sectionKeys.length, 18);
  assert.ok(ideaQualificationNavigation.some((item) => item.href === '/ideas/audit'));
});
