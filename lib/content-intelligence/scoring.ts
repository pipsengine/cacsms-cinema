export type Factors = {
  strategicFit: number;
  evidence: number;
  audienceDemand: number;
  originality: number;
  timeliness: number;
  visualPotential: number;
  feasibility: number;
  regionalRelevance: number;
  risk: number;
  duplicateSimilarity: number;
};

export const DEFAULT_WEIGHTS = {
  strategicFit: 0.2,
  evidence: 0.18,
  audienceDemand: 0.15,
  originality: 0.12,
  timeliness: 0.08,
  visualPotential: 0.08,
  feasibility: 0.08,
  regionalRelevance: 0.11,
};

export function scoreOpportunity(factors: Factors, weights = DEFAULT_WEIGHTS) {
  const weighted = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + factors[key as keyof typeof weights] * weight,
    0,
  );
  return Math.round(weighted * 10000) / 100;
}

export function absoluteGates(
  factors: Factors,
  thresholds = { strategicFit: 80, evidence: 80, duplicateSimilarity: 65, risk: 30 },
) {
  const failures: string[] = [];
  if (factors.strategicFit < thresholds.strategicFit) failures.push('STRATEGIC_FIT');
  if (factors.evidence < thresholds.evidence) failures.push('EVIDENCE');
  if (factors.duplicateSimilarity >= thresholds.duplicateSimilarity) failures.push('DUPLICATE');
  if (factors.risk > thresholds.risk) failures.push('RISK');
  return { passed: failures.length === 0, failures };
}

export function rankPortfolio<T extends { score: number; domain: string; geography?: string }>(
  items: T[],
  domainCap = 2,
) {
  const used = new Map<string, number>();
  return [...items]
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      const key = `${item.domain}|${item.geography ?? ''}`;
      const count = used.get(key) ?? 0;
      if (count >= domainCap) return false;
      used.set(key, count + 1);
      return true;
    });
}
