import assert from 'node:assert/strict';
import test from 'node:test';
import {
  absoluteGates,
  rankPortfolio,
  scoreOpportunity,
} from '../lib/content-intelligence/scoring';
import { sectionKeys } from '../lib/content-intelligence/contracts';

const good = {
  strategicFit: 90,
  evidence: 86,
  audienceDemand: 80,
  originality: 75,
  timeliness: 70,
  visualPotential: 84,
  feasibility: 81,
  regionalRelevance: 88,
  risk: 12,
  duplicateSimilarity: 20,
};

test('opportunity scoring is deterministic and bounded', () => {
  assert.ok(scoreOpportunity(good) > 80);
  assert.equal(scoreOpportunity(good), scoreOpportunity(good));
});

test('absolute gates are not bypassed by ranking score', () => {
  assert.equal(absoluteGates({ ...good, evidence: 40 }).passed, false);
});

test('absolute gates block duplicate content', () => {
  assert.ok(absoluteGates({ ...good, duplicateSimilarity: 70 }).failures.includes('DUPLICATE'));
});

test('absolute gates block excessive risk', () => {
  assert.ok(absoluteGates({ ...good, risk: 60 }).failures.includes('RISK'));
});

test('absolute gates pass a qualifying candidate', () => {
  assert.deepEqual(absoluteGates(good), { passed: true, failures: [] });
});

test('portfolio ranking sorts by score', () => {
  assert.equal(
    rankPortfolio([
      { score: 70, domain: 'A' },
      { score: 90, domain: 'B' },
    ])[0].score,
    90,
  );
});

test('portfolio ranking enforces a domain/geography cap', () => {
  const ranked = rankPortfolio(
    [
      { score: 90, domain: 'A', geography: 'NG' },
      { score: 80, domain: 'A', geography: 'NG' },
      { score: 70, domain: 'A', geography: 'NG' },
    ],
    2,
  );
  assert.equal(ranked.length, 2);
});

test('portfolio ranking treats geographies independently', () => {
  const ranked = rankPortfolio(
    [
      { score: 90, domain: 'A', geography: 'NG' },
      { score: 80, domain: 'A', geography: 'GH' },
    ],
    1,
  );
  assert.equal(ranked.length, 2);
});

test('content intelligence navigation exposes seventeen pages', async () => {
  const { contentIntelligenceNavigation } = await import(
    '../apps/web/lib/content-intelligence-navigation'
  );
  assert.equal(contentIntelligenceNavigation.length, 17);
  assert.equal(contentIntelligenceNavigation[0].href, '/content-intelligence');
  assert.equal(sectionKeys.length, 16);
  assert.ok(contentIntelligenceNavigation.some((item) => item.href === '/content-intelligence/audit'));
});
