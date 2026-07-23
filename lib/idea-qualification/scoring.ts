import type { FactorScores } from './contracts';

export const DEFAULT_WEIGHTS = {
  strategicFit: 0.18,
  evidence: 0.16,
  audienceValue: 0.13,
  originality: 0.11,
  timeliness: 0.07,
  educationalValue: 0.09,
  regionalRelevance: 0.08,
  visualPotential: 0.07,
  feasibility: 0.07,
  sourceAvailability: 0.04,
} as const;

export const DEFAULT_GATES = {
  strategicFit: 80,
  evidence: 80,
  audienceValue: 75,
  originality: 70,
  visualPotential: 70,
  feasibility: 70,
  sourceAvailability: 65,
  maxRisk: 30,
  maxDuplicateSimilarity: 65,
  minimumTotal: 78,
} as const;

export type GateResult = {
  passed: boolean;
  failures: Array<{ code: string; actual: number; required: string }>;
};

export function scoreCandidate(
  factors: FactorScores,
  weights: Record<keyof typeof DEFAULT_WEIGHTS, number> = DEFAULT_WEIGHTS,
) {
  const total = (Object.keys(weights) as Array<keyof typeof DEFAULT_WEIGHTS>).reduce(
    (sum, key) => sum + factors[key] * weights[key],
    0,
  );
  return Math.max(0, Math.min(100, Math.round(total * 100) / 100));
}

export function evaluateGates(factors: FactorScores, thresholds = DEFAULT_GATES): GateResult {
  const failures: GateResult['failures'] = [];
  const minimums = [
    ['STRATEGIC_FIT', factors.strategicFit, thresholds.strategicFit],
    ['EVIDENCE', factors.evidence, thresholds.evidence],
    ['AUDIENCE_VALUE', factors.audienceValue, thresholds.audienceValue],
    ['ORIGINALITY', factors.originality, thresholds.originality],
    ['VISUAL_POTENTIAL', factors.visualPotential, thresholds.visualPotential],
    ['FEASIBILITY', factors.feasibility, thresholds.feasibility],
    ['SOURCE_AVAILABILITY', factors.sourceAvailability, thresholds.sourceAvailability],
  ] as const;

  for (const [code, actual, required] of minimums) {
    if (actual < required) {
      failures.push({ code, actual, required: `>= ${required}` });
    }
  }
  if (factors.risk > thresholds.maxRisk) {
    failures.push({ code: 'RISK', actual: factors.risk, required: `<= ${thresholds.maxRisk}` });
  }
  if (factors.duplicateSimilarity >= thresholds.maxDuplicateSimilarity) {
    failures.push({
      code: 'DUPLICATE',
      actual: factors.duplicateSimilarity,
      required: `< ${thresholds.maxDuplicateSimilarity}`,
    });
  }
  const total = scoreCandidate(factors);
  if (total < thresholds.minimumTotal) {
    failures.push({
      code: 'TOTAL_SCORE',
      actual: total,
      required: `>= ${thresholds.minimumTotal}`,
    });
  }
  return { passed: failures.length === 0, failures };
}

export function rankCandidates<
  T extends { score: number; gateStatus: string; domain: string; geography?: string },
>(items: T[], cap = 2) {
  const used = new Map<string, number>();
  return [...items]
    .filter((item) => item.gateStatus === 'PASSED')
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      const key = `${item.domain}|${item.geography ?? ''}`;
      const count = used.get(key) ?? 0;
      if (count >= cap) return false;
      used.set(key, count + 1);
      return true;
    });
}
