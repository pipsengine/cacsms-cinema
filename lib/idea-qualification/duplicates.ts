import { prisma } from '@/lib/db';
import type { FactorScores } from './contracts';

export type DuplicateRiskClass =
  | 'EXACT_DUPLICATE'
  | 'NEAR_DUPLICATE'
  | 'HIGH_SEMANTIC_OVERLAP'
  | 'PARTIAL_OVERLAP'
  | 'RELATED_TOPIC'
  | 'COMPLEMENTARY_TOPIC'
  | 'UNIQUE'
  | 'UNMEASURED';

export type DuplicateRecommendation =
  | 'Proceed'
  | 'Minor Revision'
  | 'Major Revision'
  | 'Merge with Existing Project'
  | 'Archive'
  | 'Reject'
  | 'Await Scoring';

export type DuplicateMatch = {
  id: string;
  assetType: string;
  assetId: string;
  similarity: number;
  blocking: boolean;
  explanation: string | null;
  modelVersion: string;
  checkedAt: string;
  scope: 'INTERNAL' | 'EXTERNAL' | 'UNKNOWN';
};

export type DuplicateCandidate = {
  id: string;
  title: string;
  summary: string;
  domain: string;
  audience: string | null;
  geography: string | null;
  formatHint: string | null;
  candidateStatus: string;
  gateStatus: string;
  decision: string | null;
  duplicateRisk: number | null;
  semanticSimilarity: number | null;
  existingCoverage: number | null;
  internalMatches: number;
  externalMatches: number;
  plannedMatches: number;
  knowledgeGraphOverlap: number | null;
  confidence: number | null;
  measuredConfidence: boolean;
  productionConflict: boolean;
  copyrightRisk: number | null;
  duplicateClass: DuplicateRiskClass;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMEASURED';
  recommendation: DuplicateRecommendation;
  explainability: string[];
  aiSummary: string;
  similarityBreakdown: Array<{ label: string; value: number | null }>;
  similarityHeatmap: Array<{ label: string; value: number | null }>;
  knowledgeGraph: Array<{ label: string; overlap: number | null }>;
  researchOverlap: Array<{ label: string; value: number | null }>;
  storyline: Array<{ label: string; value: number | null }>;
  geographicOverlap: Array<{ label: string; value: number | null }>;
  timelineOverlap: Array<{ label: string; value: number | null }>;
  audienceOverlap: Array<{ label: string; value: number | null }>;
  productionConflicts: Array<{
    label: string;
    status: string;
    detail: string;
  }>;
  closestMatch: {
    title: string;
    summary: string;
    assetType: string;
    assetId: string;
    similarity: number | null;
    status: string;
    geography: string | null;
    audience: string | null;
    explanation: string | null;
  } | null;
  comparisonRows: Array<{
    field: string;
    current: string;
    match: string;
    overlap: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMEASURED';
  }>;
  matches: DuplicateMatch[];
  resolutionOptions: string[];
  optimization: string[];
  lifecycle: Array<{ key: string; label: string; done: boolean; at: string | null }>;
  factors: Partial<FactorScores> | null;
  modelVersion: string | null;
  embeddingModel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DuplicateDetectionIQOverview = {
  available: boolean;
  reason?: string;
  meta: {
    cycleStatus: string;
    intakeStatus: string | null;
    modelVersions: string[];
    embeddingModels: string[];
  };
  metrics: {
    duplicateRisk: number | null;
    semanticSimilarity: number | null;
    existingCoverage: number | null;
    internalMatches: number;
    externalMatches: number;
    plannedProjectMatches: number;
    knowledgeGraphOverlap: number | null;
    aiConfidence: number | null;
    productionConflicts: number;
    copyrightRisk: number | null;
    recommendationRate: number | null;
    totalCandidates: number;
    uniqueCount: number;
    highRiskCount: number;
    mergeCandidates: number;
    rejectCandidates: number;
  };
  pipeline: Array<{
    key: string;
    label: string;
    state: 'pending' | 'active' | 'done' | 'failed';
  }>;
  candidates: DuplicateCandidate[];
  classDistribution: Array<{ label: string; count: number }>;
  topicSaturation: Array<{ label: string; count: number; avgSimilarity: number | null }>;
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    candidateId?: string;
  }>;
  analytics: {
    riskDistribution: Array<{ label: string; count: number }>;
    similarityBands: Array<{ label: string; count: number }>;
    recommendationDistribution: Array<{ label: string; count: number }>;
  };
  governance: {
    modelVersions: string[];
    embeddingModels: string[];
    duplicateChecks: number;
    decisionsLogged: number;
    auditEvents: number;
  };
  notifications: Array<{
    id: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
  }>;
  audit: Array<{
    id: string;
    action: string;
    actorType: string;
    createdAt: string;
    reason: string | null;
  }>;
  lastUpdated: string;
};

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function parseFactors(raw: string | null): Partial<FactorScores> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<FactorScores> = {};
    for (const key of [
      'strategicFit',
      'evidence',
      'audienceValue',
      'originality',
      'timeliness',
      'educationalValue',
      'regionalRelevance',
      'visualPotential',
      'feasibility',
      'sourceAvailability',
      'risk',
      'duplicateSimilarity',
    ] as const) {
      const v = num(parsed[key]);
      if (v != null) out[key] = v;
    }
    return out;
  } catch {
    return null;
  }
}

function parseMeta(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const nested =
      (parsed.duplicate as Record<string, unknown> | undefined) ??
      (parsed.duplicates as Record<string, unknown> | undefined) ??
      (parsed.similarity as Record<string, unknown> | undefined);
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested;
    return parsed;
  } catch {
    return {};
  }
}

function nestedNum(meta: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = num(meta[key]);
    if (v != null) return v;
  }
  return null;
}

function nestedString(meta: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function classifyDuplicate(similarity: number | null): DuplicateRiskClass {
  if (similarity == null) return 'UNMEASURED';
  if (similarity >= 95) return 'EXACT_DUPLICATE';
  if (similarity >= 88) return 'NEAR_DUPLICATE';
  if (similarity >= 75) return 'HIGH_SEMANTIC_OVERLAP';
  if (similarity >= 55) return 'PARTIAL_OVERLAP';
  if (similarity >= 35) return 'RELATED_TOPIC';
  if (similarity >= 15) return 'COMPLEMENTARY_TOPIC';
  return 'UNIQUE';
}

function riskLevelFrom(
  similarity: number | null,
  duplicateClass: DuplicateRiskClass,
): DuplicateCandidate['riskLevel'] {
  if (similarity == null && duplicateClass === 'UNMEASURED') return 'UNMEASURED';
  if (
    duplicateClass === 'EXACT_DUPLICATE' ||
    duplicateClass === 'NEAR_DUPLICATE' ||
    duplicateClass === 'HIGH_SEMANTIC_OVERLAP' ||
    (similarity != null && similarity >= 75)
  ) {
    return 'HIGH';
  }
  if (
    duplicateClass === 'PARTIAL_OVERLAP' ||
    duplicateClass === 'RELATED_TOPIC' ||
    (similarity != null && similarity >= 40)
  ) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function recommendationFor(
  duplicateClass: DuplicateRiskClass,
  productionConflict: boolean,
): DuplicateRecommendation {
  if (duplicateClass === 'EXACT_DUPLICATE') return 'Reject';
  if (duplicateClass === 'NEAR_DUPLICATE') return 'Merge with Existing Project';
  if (duplicateClass === 'HIGH_SEMANTIC_OVERLAP') {
    return productionConflict ? 'Merge with Existing Project' : 'Major Revision';
  }
  if (duplicateClass === 'PARTIAL_OVERLAP') return 'Minor Revision';
  if (duplicateClass === 'RELATED_TOPIC' || duplicateClass === 'COMPLEMENTARY_TOPIC') {
    return 'Minor Revision';
  }
  if (duplicateClass === 'UNIQUE') return 'Proceed';
  return 'Await Scoring';
}

function matchScope(assetType: string): DuplicateMatch['scope'] {
  const t = assetType.toLowerCase();
  if (
    /internal|library|catalogue|catalog|project|planned|production|script|storyboard|research|knowledge|topic|candidate|pipeline/.test(
      t,
    )
  ) {
    return 'INTERNAL';
  }
  if (
    /youtube|netflix|bbc|national|discovery|scholar|wikipedia|news|government|external|academic|google/.test(
      t,
    )
  ) {
    return 'EXTERNAL';
  }
  return 'UNKNOWN';
}

function isPlannedType(assetType: string): boolean {
  return /planned|pipeline|approved|awaiting|scheduled|storyboard|script/.test(
    assetType.toLowerCase(),
  );
}

function optimizationHints(input: {
  similarity: number | null;
  geography: string | null;
  audience: string | null;
  visual: number | null;
}): string[] {
  const tips: string[] = [];
  if (input.similarity != null && input.similarity >= 75) {
    tips.push('Change narrative angle');
    tips.push('Merge with existing documentary');
  }
  if (input.similarity != null && input.similarity >= 55) {
    tips.push('Introduce new evidence');
    tips.push('Include exclusive interviews');
  }
  if (input.geography) tips.push('Focus on another geography');
  if (input.audience) tips.push('Target different audience');
  if (input.visual != null && input.visual < 70) tips.push('Expand research');
  tips.push('Shift historical period');
  return [...new Set(tips)].slice(0, 8);
}

export async function loadDuplicateDetection(): Promise<DuplicateDetectionIQOverview> {
  try {
    const intakes = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT TOP 1 status
      FROM iq_intake_packages
      WHERE status = 'ACKNOWLEDGED'
      ORDER BY acknowledged_at DESC
    `;

    const cycles = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT TOP 1 status FROM iq_cycles ORDER BY created_at DESC
    `;

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        summary: string;
        domain: string;
        audience: string | null;
        geography: string | null;
        formatHint: string | null;
        status: string;
        gateStatus: string;
        decision: string | null;
        confidence: number | string;
        createdAt: Date;
        updatedAt: Date;
        factorsJson: string | null;
        totalScore: number | string | null;
        modelVersion: string | null;
        maxDuplicateSimilarity: number | string | null;
        duplicateCheckCount: number | bigint;
      }>
    >`
      SELECT TOP 100
        CONVERT(varchar(36), c.id) AS id,
        c.title,
        c.summary,
        c.domain,
        c.audience,
        c.geography,
        c.format_hint AS formatHint,
        c.status,
        c.gate_status AS gateStatus,
        c.decision,
        c.confidence,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt,
        s.factors_json AS factorsJson,
        s.total_score AS totalScore,
        s.model_version AS modelVersion,
        (
          SELECT MAX(similarity) FROM iq_duplicate_checks d WHERE d.candidate_id = c.id
        ) AS maxDuplicateSimilarity,
        (
          SELECT COUNT(*) FROM iq_duplicate_checks d WHERE d.candidate_id = c.id
        ) AS duplicateCheckCount
      FROM iq_candidates c
      OUTER APPLY (
        SELECT TOP 1 *
        FROM iq_scores sc
        WHERE sc.candidate_id = c.id
        ORDER BY sc.scored_at DESC
      ) s
      ORDER BY
        COALESCE(
          (
            SELECT MAX(similarity) FROM iq_duplicate_checks d WHERE d.candidate_id = c.id
          ),
          TRY_CONVERT(float, JSON_VALUE(s.factors_json, '$.duplicateSimilarity')),
          0
        ) DESC,
        c.updated_at DESC
    `;

    const duplicateRows = await prisma.$queryRaw<
      Array<{
        id: string;
        candidateId: string;
        assetType: string;
        assetId: string;
        similarity: number | string;
        blocking: boolean | number;
        explanation: string | null;
        modelVersion: string;
        checkedAt: Date;
      }>
    >`
      SELECT TOP 800
        CONVERT(varchar(36), id) AS id,
        CONVERT(varchar(36), candidate_id) AS candidateId,
        compared_asset_type AS assetType,
        CONVERT(varchar(36), compared_asset_id) AS assetId,
        similarity,
        blocking,
        explanation,
        model_version AS modelVersion,
        checked_at AS checkedAt
      FROM iq_duplicate_checks
      ORDER BY similarity DESC, checked_at DESC
    `;

    const riskRows = await prisma.$queryRaw<
      Array<{
        candidateId: string;
        category: string;
        severity: string;
        score: number | string;
      }>
    >`
      SELECT TOP 400
        CONVERT(varchar(36), candidate_id) AS candidateId,
        category,
        severity,
        risk_score AS score
      FROM iq_risk_assessments
      WHERE category LIKE '%COPY%'
         OR category LIKE '%IP%'
         OR category LIKE '%RIGHT%'
         OR category LIKE '%DUPLIC%'
         OR category LIKE '%LEGAL%'
      ORDER BY assessed_at DESC
    `;

    const decisionCount = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
      SELECT COUNT(*) AS count FROM iq_decisions
    `;

    const auditRows = await prisma.$queryRaw<
      Array<{
        id: string;
        action: string;
        actorType: string;
        createdAt: Date;
        reason: string | null;
      }>
    >`
      SELECT TOP 40
        CONVERT(varchar(36), id) AS id,
        action,
        actor_type AS actorType,
        created_at AS createdAt,
        reason
      FROM iq_audit_events
      WHERE action LIKE '%DUPLIC%'
         OR action LIKE '%SIMILAR%'
         OR action LIKE '%MERGE%'
         OR action LIKE '%ORIGIN%'
         OR action LIKE '%SCORE%'
         OR action LIKE '%QUALIF%'
      ORDER BY created_at DESC
    `;

    const duplicatesByCandidate = new Map<string, typeof duplicateRows>();
    for (const row of duplicateRows) {
      const list = duplicatesByCandidate.get(row.candidateId) ?? [];
      if (list.length < 20) list.push(row);
      duplicatesByCandidate.set(row.candidateId, list);
    }

    const risksByCandidate = new Map<string, number[]>();
    for (const row of riskRows) {
      const list = risksByCandidate.get(row.candidateId) ?? [];
      list.push(Number(row.score));
      risksByCandidate.set(row.candidateId, list);
    }

    const peersByDomain = new Map<string, Array<{ id: string; title: string; status: string }>>();
    for (const row of rows) {
      const list = peersByDomain.get(row.domain) ?? [];
      list.push({ id: row.id, title: row.title, status: row.status });
      peersByDomain.set(row.domain, list);
    }

    const classCounts = new Map<string, number>();
    const topicBuckets = new Map<string, number[]>();

    const candidates: DuplicateCandidate[] = rows.map((row) => {
      const factors = parseFactors(row.factorsJson);
      const meta = parseMeta(row.factorsJson);
      const dupesRaw = duplicatesByCandidate.get(row.id) ?? [];
      const matches: DuplicateMatch[] = dupesRaw.map((item) => ({
        id: item.id,
        assetType: item.assetType,
        assetId: item.assetId,
        similarity: Math.round(Number(item.similarity)),
        blocking: Boolean(item.blocking),
        explanation: item.explanation,
        modelVersion: item.modelVersion,
        checkedAt: item.checkedAt.toISOString(),
        scope: matchScope(item.assetType),
      }));

      const semanticSimilarity =
        factors?.duplicateSimilarity ??
        num(row.maxDuplicateSimilarity) ??
        nestedNum(meta, ['semanticSimilarity', 'similarity']);
      const duplicateRisk =
        nestedNum(meta, ['duplicateRisk', 'risk']) ?? semanticSimilarity;
      const existingCoverage =
        nestedNum(meta, ['existingCoverage', 'coverage']) ?? semanticSimilarity;
      const internalMatches = matches.filter((m) => m.scope === 'INTERNAL').length;
      const externalMatches = matches.filter((m) => m.scope === 'EXTERNAL').length;
      const plannedMatches = matches.filter((m) => isPlannedType(m.assetType)).length;
      const knowledgeGraphOverlap =
        nestedNum(meta, ['knowledgeGraphOverlap', 'kgOverlap']) ??
        (matches.length ? avg(matches.map((m) => m.similarity)) : null);
      const copyrightRisk =
        nestedNum(meta, ['copyrightRisk']) ?? avg(risksByCandidate.get(row.id) ?? []);
      const confidence = num(row.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;
      const duplicateClass = classifyDuplicate(semanticSimilarity);
      const riskLevel = riskLevelFrom(semanticSimilarity, duplicateClass);

      const domainPeers = (peersByDomain.get(row.domain) ?? []).filter((p) => p.id !== row.id);
      const productionConflict =
        plannedMatches > 0 ||
        matches.some((m) => m.blocking) ||
        domainPeers.some((p) =>
          /APPROVED|IN_PRODUCTION|PRODUCING|SELECTED|HANDED_OFF/.test(p.status.toUpperCase()),
        );

      const recommendation = recommendationFor(duplicateClass, productionConflict);
      classCounts.set(duplicateClass, (classCounts.get(duplicateClass) ?? 0) + 1);
      if (semanticSimilarity != null) {
        const bucket = topicBuckets.get(row.domain) ?? [];
        bucket.push(semanticSimilarity);
        topicBuckets.set(row.domain, bucket);
      }

      const topMatch = matches[0] ?? null;
      const peer = domainPeers[0] ?? null;
      const closestMatch = topMatch
        ? {
            title: topMatch.explanation?.slice(0, 120) || `${topMatch.assetType} match`,
            summary: topMatch.explanation ?? 'Persisted duplicate comparison asset',
            assetType: topMatch.assetType,
            assetId: topMatch.assetId,
            similarity: topMatch.similarity,
            status: topMatch.blocking ? 'BLOCKING' : 'OBSERVED',
            geography: null as string | null,
            audience: null as string | null,
            explanation: topMatch.explanation,
          }
        : peer
          ? {
              title: peer.title,
              summary: `Domain peer in candidate pool (${peer.status})`,
              assetType: 'INTERNAL_CANDIDATE',
              assetId: peer.id,
              similarity: null as number | null,
              status: peer.status,
              geography: null,
              audience: null,
              explanation: 'Same-domain peer — similarity UNMEASURED until a check is written',
            }
          : null;

      const explainability: string[] = [];
      if (duplicateRisk != null) {
        explainability.push(`Duplicate risk ${duplicateRisk}% (${riskLevel})`);
      }
      if (semanticSimilarity != null) {
        explainability.push(`Semantic similarity ${semanticSimilarity}%`);
      }
      if (topMatch) {
        explainability.push(
          `Closest match ${topMatch.assetType} at ${topMatch.similarity}%${
            topMatch.blocking ? ' (blocking)' : ''
          }`,
        );
      }
      if (internalMatches) explainability.push(`${internalMatches} internal match(es)`);
      if (externalMatches) explainability.push(`${externalMatches} external match(es)`);
      if (plannedMatches) explainability.push(`${plannedMatches} planned/pipeline match(es)`);
      if (productionConflict) explainability.push('Internal production conflict signals present');
      if (copyrightRisk != null) explainability.push(`Copyright risk ${copyrightRisk}`);
      if (!explainability.length) {
        explainability.push('No duplicate checks or duplicateSimilarity factor persisted yet');
      }

      const createdAt = row.createdAt.toISOString();
      const updatedAt = row.updatedAt.toISOString();
      const hasChecks = matches.length > 0 || semanticSimilarity != null;

      const similarityBreakdown = [
        {
          label: 'Topic',
          value: nestedNum(meta, ['topicSimilarity']) ?? semanticSimilarity,
        },
        {
          label: 'Narrative',
          value: nestedNum(meta, ['narrativeSimilarity', 'storyline']),
        },
        {
          label: 'Research',
          value: nestedNum(meta, ['researchSimilarity']) ?? factors?.evidence ?? null,
        },
        {
          label: 'Visual Style',
          value: nestedNum(meta, ['visualSimilarity']) ?? factors?.visualPotential ?? null,
        },
        {
          label: 'Knowledge',
          value: nestedNum(meta, ['knowledgeSimilarity']) ?? knowledgeGraphOverlap,
        },
        {
          label: 'Audience',
          value: nestedNum(meta, ['audienceSimilarity']) ?? factors?.audienceValue ?? null,
        },
      ];

      return {
        id: row.id,
        title: row.title,
        summary: row.summary,
        domain: row.domain,
        audience: row.audience,
        geography: row.geography,
        formatHint: row.formatHint,
        candidateStatus: row.status,
        gateStatus: row.gateStatus,
        decision: row.decision,
        duplicateRisk,
        semanticSimilarity,
        existingCoverage,
        internalMatches,
        externalMatches,
        plannedMatches,
        knowledgeGraphOverlap,
        confidence,
        measuredConfidence,
        productionConflict,
        copyrightRisk,
        duplicateClass,
        riskLevel,
        recommendation,
        explainability,
        aiSummary:
          semanticSimilarity != null
            ? `${row.title} shows ${semanticSimilarity}% semantic similarity (${duplicateClass.replaceAll('_', ' ').toLowerCase()}). Recommendation: ${recommendation}.`
            : `${row.title} awaits persisted duplicate checks / duplicateSimilarity scoring.`,
        similarityBreakdown,
        similarityHeatmap: [
          { label: 'Topic', value: similarityBreakdown[0]?.value ?? null },
          { label: 'Evidence', value: factors?.evidence ?? null },
          { label: 'Narrative', value: similarityBreakdown[1]?.value ?? null },
          {
            label: 'Timeline',
            value: nestedNum(meta, ['timelineSimilarity']),
          },
          { label: 'Audience', value: similarityBreakdown[5]?.value ?? null },
          { label: 'Visuals', value: factors?.visualPotential ?? null },
        ],
        knowledgeGraph: [
          {
            label: 'Entities',
            overlap: nestedNum(meta, ['entityOverlap']) ?? knowledgeGraphOverlap,
          },
          { label: 'Events', overlap: nestedNum(meta, ['eventOverlap']) },
          { label: 'Organizations', overlap: nestedNum(meta, ['organizationOverlap']) },
          {
            label: 'Locations',
            overlap:
              nestedNum(meta, ['locationOverlap']) ?? factors?.regionalRelevance ?? null,
          },
          { label: 'Timelines', overlap: nestedNum(meta, ['timelineOverlap']) },
          { label: 'Technologies', overlap: nestedNum(meta, ['technologyOverlap']) },
          { label: 'Relationships', overlap: nestedNum(meta, ['relationshipOverlap']) },
        ],
        researchOverlap: [
          { label: 'Sources', value: nestedNum(meta, ['sourceOverlap']) },
          { label: 'References', value: nestedNum(meta, ['referenceOverlap']) },
          { label: 'Interviews', value: nestedNum(meta, ['interviewOverlap']) },
          { label: 'Experts', value: nestedNum(meta, ['expertOverlap']) },
          { label: 'Datasets', value: nestedNum(meta, ['datasetOverlap']) },
          { label: 'Citations', value: nestedNum(meta, ['citationOverlap']) },
        ],
        storyline: [
          {
            label: 'Narrative overlap',
            value: nestedNum(meta, ['narrativeSimilarity', 'storyline']) ?? null,
          },
          {
            label: 'Topic overlap',
            value: nestedNum(meta, ['topicSimilarity']) ?? semanticSimilarity,
          },
        ],
        geographicOverlap: [
          {
            label: row.geography?.trim() || 'Unspecified geography',
            value: factors?.regionalRelevance ?? nestedNum(meta, ['geoOverlap']),
          },
          { label: 'Region', value: nestedNum(meta, ['regionOverlap']) },
          { label: 'City', value: nestedNum(meta, ['cityOverlap']) },
          { label: 'Historical location', value: nestedNum(meta, ['historicalLocationOverlap']) },
        ],
        timelineOverlap: [
          { label: 'Historical periods', value: nestedNum(meta, ['periodOverlap']) },
          { label: 'Events', value: nestedNum(meta, ['eventOverlap']) },
          { label: 'Chronology', value: nestedNum(meta, ['chronologyOverlap']) },
        ],
        audienceOverlap: [
          {
            label: row.audience?.trim() || 'Unspecified audience',
            value: nestedNum(meta, ['audienceSimilarity']) ?? factors?.audienceValue ?? null,
          },
        ],
        productionConflicts: [
          {
            label: 'Planned / pipeline matches',
            status: plannedMatches > 0 ? 'CONFLICT' : matches.length ? 'CLEAR' : 'UNMEASURED',
            detail:
              plannedMatches > 0
                ? `${plannedMatches} planned asset comparison(s)`
                : 'No planned-pipeline matches persisted',
          },
          {
            label: 'Blocking duplicate checks',
            status: matches.some((m) => m.blocking) ? 'CONFLICT' : 'CLEAR',
            detail: matches.some((m) => m.blocking)
              ? 'At least one blocking comparison'
              : 'No blocking flags',
          },
          {
            label: 'Same-domain peers',
            status: domainPeers.length ? 'OBSERVED' : 'CLEAR',
            detail: domainPeers.length
              ? `${domainPeers.length} other candidate(s) in ${row.domain}`
              : 'No domain peers in current pool',
          },
        ],
        closestMatch,
        comparisonRows: [
          {
            field: 'Topic',
            current: row.domain,
            match: closestMatch?.assetType ?? '—',
            overlap:
              semanticSimilarity == null
                ? 'UNMEASURED'
                : semanticSimilarity >= 75
                  ? 'HIGH'
                  : semanticSimilarity >= 45
                    ? 'MEDIUM'
                    : 'LOW',
          },
          {
            field: 'Summary',
            current: row.summary.slice(0, 160),
            match: closestMatch?.summary?.slice(0, 160) ?? '—',
            overlap: closestMatch?.similarity != null ? 'MEDIUM' : 'UNMEASURED',
          },
          {
            field: 'Geography',
            current: row.geography ?? '—',
            match: closestMatch?.geography ?? '—',
            overlap: 'UNMEASURED',
          },
          {
            field: 'Audience',
            current: row.audience ?? '—',
            match: closestMatch?.audience ?? '—',
            overlap: 'UNMEASURED',
          },
          {
            field: 'Production status',
            current: row.status,
            match: closestMatch?.status ?? '—',
            overlap: productionConflict ? 'HIGH' : 'LOW',
          },
          {
            field: 'Similarity',
            current: semanticSimilarity != null ? `${semanticSimilarity}%` : 'UNMEASURED',
            match:
              closestMatch?.similarity != null ? `${closestMatch.similarity}%` : 'UNMEASURED',
            overlap:
              semanticSimilarity == null
                ? 'UNMEASURED'
                : semanticSimilarity >= 75
                  ? 'HIGH'
                  : semanticSimilarity >= 45
                    ? 'MEDIUM'
                    : 'LOW',
          },
        ],
        matches,
        resolutionOptions: [
          'Merge',
          'Replace',
          'Continue',
          'Archive',
          'Escalate',
          'Human Review',
        ],
        optimization: optimizationHints({
          similarity: semanticSimilarity,
          geography: row.geography,
          audience: row.audience,
          visual: factors?.visualPotential ?? null,
        }),
        lifecycle: [
          { key: 'candidate', label: 'Candidate', done: true, at: createdAt },
          {
            key: 'embedding',
            label: 'Embedding',
            done: hasChecks,
            at: hasChecks ? updatedAt : null,
          },
          {
            key: 'kg',
            label: 'Knowledge graph',
            done: knowledgeGraphOverlap != null,
            at: knowledgeGraphOverlap != null ? updatedAt : null,
          },
          {
            key: 'internal',
            label: 'Repository search',
            done: internalMatches > 0 || Number(row.duplicateCheckCount) > 0,
            at: internalMatches > 0 || Number(row.duplicateCheckCount) > 0 ? updatedAt : null,
          },
          {
            key: 'external',
            label: 'External search',
            done: externalMatches > 0,
            at: externalMatches > 0 ? updatedAt : null,
          },
          {
            key: 'similarity',
            label: 'Similarity analysis',
            done: semanticSimilarity != null,
            at: semanticSimilarity != null ? updatedAt : null,
          },
          {
            key: 'recommendation',
            label: 'Recommendation',
            done: recommendation !== 'Await Scoring',
            at: recommendation !== 'Await Scoring' ? updatedAt : null,
          },
        ],
        factors,
        modelVersion: row.modelVersion,
        embeddingModel:
          nestedString(meta, ['embeddingModel', 'embedding_version']) ??
          matches[0]?.modelVersion ??
          null,
        createdAt,
        updatedAt,
      };
    });

    const uniqueCount = candidates.filter((c) => c.duplicateClass === 'UNIQUE').length;
    const highRiskCount = candidates.filter((c) => c.riskLevel === 'HIGH').length;
    const mergeCandidates = candidates.filter(
      (c) => c.recommendation === 'Merge with Existing Project',
    ).length;
    const rejectCandidates = candidates.filter((c) => c.recommendation === 'Reject').length;

    const riskScores = candidates
      .map((c) => c.duplicateRisk)
      .filter((v): v is number => v != null);
    const similarityScores = candidates
      .map((c) => c.semanticSimilarity)
      .filter((v): v is number => v != null);
    const coverageScores = candidates
      .map((c) => c.existingCoverage)
      .filter((v): v is number => v != null);
    const kgScores = candidates
      .map((c) => c.knowledgeGraphOverlap)
      .filter((v): v is number => v != null);
    const confidenceScores = candidates
      .filter((c) => c.measuredConfidence)
      .map((c) => c.confidence)
      .filter((v): v is number => v != null);
    const copyrightScores = candidates
      .map((c) => c.copyrightRisk)
      .filter((v): v is number => v != null);

    const recommendations: DuplicateDetectionIQOverview['recommendations'] = [];
    for (const item of candidates.slice(0, 12)) {
      recommendations.push({
        id: `dup-${item.id}`,
        action: item.recommendation,
        reason: `${item.title} · ${item.duplicateClass} · sim ${item.semanticSimilarity ?? 'UNMEAS.'}`,
        priority:
          item.riskLevel === 'HIGH' ? 'HIGH' : item.riskLevel === 'LOW' ? 'LOW' : 'MEDIUM',
        candidateId: item.id,
      });
      for (const tip of item.optimization.slice(0, 1)) {
        recommendations.push({
          id: `opt-${item.id}`,
          action: tip,
          reason: `Resolution assistant for ${item.title}`,
          priority: 'MEDIUM',
          candidateId: item.id,
        });
      }
    }

    const notifications: DuplicateDetectionIQOverview['notifications'] = [];
    for (const item of candidates.slice(0, 10)) {
      if (item.riskLevel === 'HIGH') {
        notifications.push({
          id: `hi-${item.id}`,
          severity: item.duplicateClass === 'EXACT_DUPLICATE' ? 'CRITICAL' : 'WARNING',
          message: `High duplicate risk: ${item.title}`,
        });
      }
      if (item.productionConflict) {
        notifications.push({
          id: `pc-${item.id}`,
          severity: 'WARNING',
          message: `Production conflict signal: ${item.title}`,
        });
      }
      if (item.duplicateClass === 'UNIQUE') {
        notifications.push({
          id: `un-${item.id}`,
          severity: 'INFO',
          message: `Unique candidate: ${item.title}`,
        });
      }
    }

    const modelVersions = [
      ...new Set(
        candidates.map((c) => c.modelVersion).filter((v): v is string => Boolean(v)),
      ),
    ];
    const embeddingModels = [
      ...new Set(
        [
          ...candidates.map((c) => c.embeddingModel),
          ...duplicateRows.map((d) => d.modelVersion),
        ].filter((v): v is string => Boolean(v)),
      ),
    ];

    const hasScores = similarityScores.length > 0 || duplicateRows.length > 0;
    const pipeline = [
      { key: 'embedding', label: 'Semantic Embedding' },
      { key: 'kg', label: 'Knowledge Graph' },
      { key: 'internal', label: 'Internal Search' },
      { key: 'external', label: 'External Search' },
      { key: 'similarity', label: 'Similarity Analysis' },
      { key: 'classify', label: 'Duplicate Classification' },
      { key: 'recommend', label: 'AI Recommendation' },
      { key: 'decision', label: 'Proceed / Merge / Reject' },
    ].map((item, index) => {
      let state: 'pending' | 'active' | 'done' | 'failed' = 'pending';
      if (highRiskCount > 0 && item.key === 'classify') state = 'failed';
      else if (uniqueCount > 0 && index <= 7) state = 'done';
      else if (hasScores && index <= 4) state = 'done';
      else if (hasScores && index === 5) state = 'active';
      else if (rows.length && index === 0) state = 'active';
      return { ...item, state };
    });

    const similarityBands = [
      { label: '0–14', count: 0 },
      { label: '15–34', count: 0 },
      { label: '35–54', count: 0 },
      { label: '55–74', count: 0 },
      { label: '75–100', count: 0 },
      { label: 'UNMEASURED', count: 0 },
    ];
    for (const item of candidates) {
      const s = item.semanticSimilarity;
      if (s == null) similarityBands[5]!.count += 1;
      else if (s < 15) similarityBands[0]!.count += 1;
      else if (s < 35) similarityBands[1]!.count += 1;
      else if (s < 55) similarityBands[2]!.count += 1;
      else if (s < 75) similarityBands[3]!.count += 1;
      else similarityBands[4]!.count += 1;
    }

    const recommendationDistribution = new Map<string, number>();
    for (const item of candidates) {
      recommendationDistribution.set(
        item.recommendation,
        (recommendationDistribution.get(item.recommendation) ?? 0) + 1,
      );
    }

    return {
      available: true,
      meta: {
        cycleStatus: cycles[0]?.status ?? 'NOT_STARTED',
        intakeStatus: intakes[0]?.status ?? null,
        modelVersions,
        embeddingModels,
      },
      metrics: {
        duplicateRisk: avg(riskScores),
        semanticSimilarity: avg(similarityScores),
        existingCoverage: avg(coverageScores),
        internalMatches: candidates.reduce((sum, c) => sum + c.internalMatches, 0),
        externalMatches: candidates.reduce((sum, c) => sum + c.externalMatches, 0),
        plannedProjectMatches: candidates.reduce((sum, c) => sum + c.plannedMatches, 0),
        knowledgeGraphOverlap: avg(kgScores),
        aiConfidence: avg(confidenceScores),
        productionConflicts: candidates.filter((c) => c.productionConflict).length,
        copyrightRisk: avg(copyrightScores),
        recommendationRate: pct(
          candidates.filter((c) => c.recommendation === 'Proceed').length,
          candidates.length,
        ),
        totalCandidates: candidates.length,
        uniqueCount,
        highRiskCount,
        mergeCandidates,
        rejectCandidates,
      },
      pipeline,
      candidates,
      classDistribution: [...classCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      topicSaturation: [...topicBuckets.entries()]
        .map(([label, scores]) => ({
          label,
          count: scores.length,
          avgSimilarity: avg(scores),
        }))
        .sort((a, b) => (b.avgSimilarity ?? 0) - (a.avgSimilarity ?? 0)),
      recommendations,
      analytics: {
        riskDistribution: [
          {
            label: 'HIGH',
            count: candidates.filter((c) => c.riskLevel === 'HIGH').length,
          },
          {
            label: 'MEDIUM',
            count: candidates.filter((c) => c.riskLevel === 'MEDIUM').length,
          },
          {
            label: 'LOW',
            count: candidates.filter((c) => c.riskLevel === 'LOW').length,
          },
          {
            label: 'UNMEASURED',
            count: candidates.filter((c) => c.riskLevel === 'UNMEASURED').length,
          },
        ],
        similarityBands,
        recommendationDistribution: [...recommendationDistribution.entries()].map(
          ([label, count]) => ({ label, count }),
        ),
      },
      governance: {
        modelVersions,
        embeddingModels,
        duplicateChecks: duplicateRows.length,
        decisionsLogged: Number(decisionCount[0]?.count ?? 0),
        auditEvents: auditRows.length,
      },
      notifications,
      audit: auditRows.map((row) => ({
        id: row.id,
        action: row.action,
        actorType: row.actorType,
        createdAt: row.createdAt.toISOString(),
        reason: row.reason,
      })),
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    return {
      available: false,
      reason:
        error instanceof Error
          ? error.message.replace(/password|secret|token/gi, '[redacted]')
          : 'Duplicate Detection unavailable',
      meta: {
        cycleStatus: 'UNAVAILABLE',
        intakeStatus: null,
        modelVersions: [],
        embeddingModels: [],
      },
      metrics: {
        duplicateRisk: null,
        semanticSimilarity: null,
        existingCoverage: null,
        internalMatches: 0,
        externalMatches: 0,
        plannedProjectMatches: 0,
        knowledgeGraphOverlap: null,
        aiConfidence: null,
        productionConflicts: 0,
        copyrightRisk: null,
        recommendationRate: null,
        totalCandidates: 0,
        uniqueCount: 0,
        highRiskCount: 0,
        mergeCandidates: 0,
        rejectCandidates: 0,
      },
      pipeline: [],
      candidates: [],
      classDistribution: [],
      topicSaturation: [],
      recommendations: [],
      analytics: {
        riskDistribution: [],
        similarityBands: [],
        recommendationDistribution: [],
      },
      governance: {
        modelVersions: [],
        embeddingModels: [],
        duplicateChecks: 0,
        decisionsLogged: 0,
        auditEvents: 0,
      },
      notifications: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
