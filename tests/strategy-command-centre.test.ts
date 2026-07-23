import assert from 'node:assert/strict';
import test from 'node:test';
import { REQUIRED_SECTIONS } from '../lib/strategy/contracts';

const readiness = (present: Set<string>) =>
  Math.round((REQUIRED_SECTIONS.filter((key) => present.has(key)).length / REQUIRED_SECTIONS.length) * 100);

test('strategy readiness is zero for empty configuration', () => {
  assert.equal(readiness(new Set()), 0);
});

test('strategy readiness is 100 only when every mandatory section exists', () => {
  assert.equal(readiness(new Set(REQUIRED_SECTIONS)), 100);
});

test('strategy readiness does not treat a majority as ready', () => {
  assert.ok(readiness(new Set(REQUIRED_SECTIONS.slice(0, 8))) < 100);
});

type Rule = { scope: 'GLOBAL' | 'FIELD' | 'COUNTRY' | 'FORMAT' | 'CHANNEL'; priority: number; value: number };
const rank = { GLOBAL: 0, FIELD: 1, COUNTRY: 2, FORMAT: 3, CHANNEL: 4 };
const effective = (rules: Rule[]) =>
  [...rules].sort((a, b) => b.priority - a.priority || rank[b.scope] - rank[a.scope])[0];

test('threshold precedence uses higher explicit priority', () => {
  assert.equal(
    effective([
      { scope: 'GLOBAL', priority: 1, value: 80 },
      { scope: 'FIELD', priority: 2, value: 85 },
    ]).value,
    85,
  );
});

test('threshold precedence uses the narrower scope when priorities match', () => {
  assert.equal(
    effective([
      { scope: 'GLOBAL', priority: 1, value: 80 },
      { scope: 'COUNTRY', priority: 1, value: 90 },
    ]).value,
    90,
  );
});

const validatePortfolio = (items: Array<{ min: number; max: number; target: number }>) => ({
  valid:
    items.every((item) => item.min <= item.target && item.target <= item.max) &&
    items.reduce((sum, item) => sum + item.target, 0) === 100,
});

test('portfolio accepts a complete balanced allocation', () => {
  assert.equal(
    validatePortfolio([
      { min: 20, max: 60, target: 40 },
      { min: 20, max: 80, target: 60 },
    ]).valid,
    true,
  );
});

test('portfolio rejects totals other than 100', () => {
  assert.equal(validatePortfolio([{ min: 0, max: 100, target: 40 }]).valid, false);
});

test('portfolio rejects target outside boundaries', () => {
  assert.equal(
    validatePortfolio([
      { min: 60, max: 90, target: 50 },
      { min: 0, max: 100, target: 50 },
    ]).valid,
    false,
  );
});

test('strategy navigation exposes seventeen command-centre pages', async () => {
  const { strategyNavigation } = await import('../apps/web/lib/strategy-navigation');
  assert.equal(strategyNavigation.length, 17);
  assert.equal(strategyNavigation[0].href, '/strategy');
  assert.ok(strategyNavigation.some((item) => item.href === '/strategy/portfolio'));
  assert.ok(strategyNavigation.some((item) => item.href === '/strategy/audit'));
});
