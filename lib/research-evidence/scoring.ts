import type { EvidenceAssessment } from './contracts';

export const DEFAULT_WEIGHTS = {
  authority: 0.22,
  corroboration: 0.22,
  recency: 0.1,
  relevance: 0.18,
  provenance: 0.18,
  rightsConfidence: 0.1,
} as const;

export const DEFAULT_GATES = {
  authority: 70,
  corroboration: 75,
  relevance: 75,
  provenance: 80,
  rightsConfidence: 70,
  maxContradictionRisk: 35,
  minimumConfidence: 78,
} as const;

export type GateResult = {
  passed: boolean;
  failures: Array<{ code: string; actual: number; required: string }>;
};

export function evidenceConfidence(
  value: EvidenceAssessment,
  weights: Record<keyof typeof DEFAULT_WEIGHTS, number> = DEFAULT_WEIGHTS,
) {
  const total = (Object.keys(weights) as Array<keyof typeof DEFAULT_WEIGHTS>).reduce(
    (sum, key) => sum + value[key] * weights[key],
    0,
  );
  return Math.max(0, Math.min(100, Math.round(total * 100) / 100));
}

export function evaluateEvidenceGates(
  value: EvidenceAssessment,
  thresholds = DEFAULT_GATES,
): GateResult {
  const failures: GateResult['failures'] = [];
  const minimums = [
    ['AUTHORITY', value.authority, thresholds.authority],
    ['CORROBORATION', value.corroboration, thresholds.corroboration],
    ['RELEVANCE', value.relevance, thresholds.relevance],
    ['PROVENANCE', value.provenance, thresholds.provenance],
    ['RIGHTS', value.rightsConfidence, thresholds.rightsConfidence],
  ] as const;

  for (const [code, actual, required] of minimums) {
    if (actual < required) {
      failures.push({ code, actual, required: `>= ${required}` });
    }
  }
  if (value.contradictionRisk > thresholds.maxContradictionRisk) {
    failures.push({
      code: 'CONTRADICTION_RISK',
      actual: value.contradictionRisk,
      required: `<= ${thresholds.maxContradictionRisk}`,
    });
  }
  const confidence = evidenceConfidence(value);
  if (confidence < thresholds.minimumConfidence) {
    failures.push({
      code: 'EVIDENCE_CONFIDENCE',
      actual: confidence,
      required: `>= ${thresholds.minimumConfidence}`,
    });
  }
  return { passed: failures.length === 0, failures };
}

export function claimIsReady(input: {
  material: boolean;
  supportingSources: number;
  requiredSources: number;
  unresolvedContradictions: number;
  citationComplete: boolean;
  rightsCleared: boolean;
}) {
  if (!input.material) return true;
  return (
    input.supportingSources >= input.requiredSources &&
    input.unresolvedContradictions === 0 &&
    input.citationComplete &&
    input.rightsCleared
  );
}
