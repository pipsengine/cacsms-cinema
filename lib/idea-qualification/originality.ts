import { prisma } from '@/lib/db';
import type { FactorScores } from './contracts';

export type DuplicateClass =
  | 'EXACT_DUPLICATE'
  | 'HIGH_SEMANTIC_OVERLAP'
  | 'MODERATE_OVERLAP'
  | 'RELATED_TOPIC'
  | 'COMPLEMENTARY_TOPIC'
  | 'COMPLETELY_ORIGINAL'
  | 'UNMEASURED';

export type OriginalityCandidate = {
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
  originalityScore: number | null;
  noveltyIndex: number | null;
  similarityIndex: number | null;
  knowledgeContribution: number | null;
  uniquePerspective: number | null;
  copyrightRisk: number | null;
  existingCoverage: number | null;
  innovationScore: number | null;
  researchUniqueness: number | null;
  confidence: number | null;
  measuredConfidence: boolean;
  productionReadiness: number | null;
  originalityStatus: 'ORIGINAL' | 'NEEDS_DIFFERENTIATION' | 'OVERLAP_RISK' | 'PENDING';
  duplicateClass: DuplicateClass;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMEASURED';
  recommendation: string;
  editorialRecommendation: string;
  explainability: string[];
  aiSummary: string;
  semanticSources: Array<{ source: string; similarity: number | null; detail: string }>;
  coverage: Array<{ source: string; coverage: number | null }>;
  noveltySignals: Array<{ label: string; status: string; detail: string }>;
  perspectives: Array<{ label: string; status: string; detail: string }>;
  knowledge: Array<{ label: string; value: number | null }>;
  copyright: Array<{ label: string; status: string; detail: string }>;
  knowledgeGraph: Array<{ label: string; status: string; detail: string }>;
  noveltyHeatmap: Array<{ label: string; value: number | null }>;
  innovation: Array<{ label: string; value: number | null }>;
  researchGaps: string[];
  competitive: Array<{ label: string; value: number | null }>;
  duplicates: Array<{
    id: string;
    assetType: string;
    assetId: string;
    similarity: number;
    blocking: boolean;
    explanation: string | null;
    modelVersion: string;
    checkedAt: string;
  }>;
  optimization: string[];
  lifecycle: Array<{ key: string; label: string; done: boolean; at: string | null }>;
  factors: Partial<FactorScores> | null;
  modelVersion: string | null;
  embeddingModel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OriginalityOverview = {
  available: boolean;
  reason?: string;
  meta: {
    cycleStatus: string;
    intakeStatus: string | null;
    modelVersions: string[];
    embeddingModels: string[];
  };
  metrics: {
    averageOriginality: number | null;
    noveltyIndex: number | null;
    similarityIndex: number | null;
    knowledgeContribution: number | null;
    uniquePerspective: number | null;
    copyrightRisk: number | null;
    existingCoverage: number | null;
    innovationScore: number | null;
    researchUniqueness: number | null;
    aiConfidence: number | null;
    editorialRecommendationRate: number | null;
    productionReadiness: number | null;
    totalCandidates: number;
    originalCount: number;
    needsDifferentiation: number;
    overlapRisk: number;
  };
  pipeline: Array<{
    key: string;
    label: string;
    state: 'pending' | 'active' | 'done' | 'failed';
  }>;
  candidates: OriginalityCandidate[];
  duplicateClassDistribution: Array<{ label: string; count: number }>;
  domainNovelty: Array<{ label: string; avgScore: number | null; count: number }>;
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    candidateId?: string;
  }>;
  analytics: {
    originalityDistribution: Array<{ label: string; count: number }>;
    similarityBands: Array<{ label: string; count: number }>;
    copyrightRiskBands: Array<{ label: string; count: number }>;
  };
  governance: {
    modelVersions: string[];
    embeddingModels: string[];
    decisionsLogged: number;
    auditEvents: number;
    duplicateChecks: number;
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
      (parsed.originality as Record<string, unknown> | undefined) ??
      (parsed.originalityMeta as Record<string, unknown> | undefined) ??
      (parsed.novelty as Record<string, unknown> | undefined);
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

function classifyDuplicate(similarity: number | null): DuplicateClass {
  if (similarity == null) return 'UNMEASURED';
  if (similarity >= 95) return 'EXACT_DUPLICATE';
  if (similarity >= 80) return 'HIGH_SEMANTIC_OVERLAP';
  if (similarity >= 60) return 'MODERATE_OVERLAP';
  if (similarity >= 40) return 'RELATED_TOPIC';
  if (similarity >= 20) return 'COMPLEMENTARY_TOPIC';
  return 'COMPLETELY_ORIGINAL';
}

function originalityStatusFrom(
  score: number | null,
  similarity: number | null,
  gateStatus: string,
  decision: string | null,
): OriginalityCandidate['originalityStatus'] {
  const gate = gateStatus.toUpperCase();
  const dec = (decision ?? '').toUpperCase();
  if (dec.includes('REJECT') || gate.includes('FAIL') || (similarity != null && similarity >= 80)) {
    return 'OVERLAP_RISK';
  }
  if (score == null && similarity == null) return 'PENDING';
  if (score != null && score >= 85 && (similarity == null || similarity < 40)) return 'ORIGINAL';
  if (score != null && score >= 70) return 'NEEDS_DIFFERENTIATION';
  if (similarity != null && similarity >= 60) return 'OVERLAP_RISK';
  if (score != null && score < 70) return 'NEEDS_DIFFERENTIATION';
  return 'PENDING';
}

function recommendationFor(
  status: OriginalityCandidate['originalityStatus'],
  duplicateClass: DuplicateClass,
): string {
  if (status === 'ORIGINAL') return 'Proceed — distinctive contribution';
  if (duplicateClass === 'EXACT_DUPLICATE') return 'Reject — exact duplicate';
  if (duplicateClass === 'HIGH_SEMANTIC_OVERLAP') return 'Reduce overlap with existing content';
  if (status === 'OVERLAP_RISK') return 'Differentiate narrative before proceeding';
  if (status === 'NEEDS_DIFFERENTIATION') return 'Add unique perspective or original evidence';
  return 'Await originality scoring';
}

function editorialFor(status: OriginalityCandidate['originalityStatus']): string {
  switch (status) {
    case 'ORIGINAL':
      return 'Editorial clear — distinctive angle';
    case 'OVERLAP_RISK':
      return 'Editorial hold — overlap / IP concern';
    case 'NEEDS_DIFFERENTIATION':
      return 'Editorial revise — strengthen novelty';
    default:
      return 'Editorial pending originality review';
  }
}

function signalStatus(value: number | null, highIsGood = true): string {
  if (value == null) return 'UNMEASURED';
  if (highIsGood) {
    if (value >= 80) return 'STRONG';
    if (value >= 60) return 'MODERATE';
    return 'WEAK';
  }
  if (value >= 70) return 'HIGH_RISK';
  if (value >= 40) return 'ELEVATED';
  return 'LOW';
}

function optimizationHints(input: {
  originality: number | null;
  similarity: number | null;
  perspective: number | null;
  visual: number | null;
  regional: number | null;
  educational: number | null;
}): string[] {
  const tips: string[] = [];
  if (input.similarity != null && input.similarity >= 60) {
    tips.push('Reduce overlap with existing content');
  }
  if (input.perspective != null && input.perspective < 75) {
    tips.push('Introduce alternative perspectives');
  }
  if (input.regional != null && input.regional < 70) {
    tips.push('Expand regional coverage');
  }
  if (input.educational != null && input.educational < 75) {
    tips.push('Include unpublished research');
  }
  if (input.visual != null && input.visual < 75) {
    tips.push('Add original visualizations');
  }
  if (input.originality != null && input.originality < 85) {
    tips.push('Add new interviews');
    tips.push('Incorporate exclusive archival material');
  }
  if (!tips.length && input.originality != null) {
    tips.push('Preserve distinctive narrative angle');
  }
  if (!tips.length) tips.push('Await originality scoring before optimization');
  return tips.slice(0, 8);
}

export async function loadOriginality(): Promise<OriginalityOverview> {
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
          TRY_CONVERT(float, JSON_VALUE(s.factors_json, '$.originality')),
          s.total_score,
          c.score
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
      SELECT TOP 500
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
      ORDER BY checked_at DESC
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
         OR category LIKE '%TRADEMARK%'
         OR category LIKE '%LICENSE%'
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
      WHERE action LIKE '%ORIGIN%'
         OR action LIKE '%DUPLIC%'
         OR action LIKE '%SIMILAR%'
         OR action LIKE '%SCORE%'
         OR action LIKE '%QUALIF%'
         OR action LIKE '%COPY%'
      ORDER BY created_at DESC
    `;

    const duplicatesByCandidate = new Map<string, typeof duplicateRows>();
    for (const row of duplicateRows) {
      const list = duplicatesByCandidate.get(row.candidateId) ?? [];
      if (list.length < 12) list.push(row);
      duplicatesByCandidate.set(row.candidateId, list);
    }

    const risksByCandidate = new Map<
      string,
      Array<{ category: string; severity: string; score: number }>
    >();
    for (const row of riskRows) {
      const list = risksByCandidate.get(row.candidateId) ?? [];
      if (list.length < 8) {
        list.push({
          category: row.category,
          severity: row.severity,
          score: Math.round(Number(row.score)),
        });
      }
      risksByCandidate.set(row.candidateId, list);
    }

    const domainBuckets = new Map<string, number[]>();
    const classCounts = new Map<string, number>();

    const candidates: OriginalityCandidate[] = rows.map((row) => {
      const factors = parseFactors(row.factorsJson);
      const meta = parseMeta(row.factorsJson);
      const originalityScore = factors?.originality ?? null;
      const similarityFromChecks = num(row.maxDuplicateSimilarity);
      const similarityIndex =
        factors?.duplicateSimilarity ??
        similarityFromChecks ??
        nestedNum(meta, ['similarityIndex', 'similarity', 'semanticSimilarity']);
      const noveltyIndex =
        nestedNum(meta, ['novelty', 'noveltyIndex']) ?? originalityScore;
      const knowledgeContribution =
        nestedNum(meta, ['knowledgeContribution', 'knowledge']) ??
        factors?.educationalValue ??
        null;
      const uniquePerspective =
        nestedNum(meta, ['uniquePerspective', 'perspective']) ?? null;
      const copyrightFromRisks = avg(
        (risksByCandidate.get(row.id) ?? []).map((item) => item.score),
      );
      const copyrightRisk =
        nestedNum(meta, ['copyrightRisk', 'ipRisk']) ?? copyrightFromRisks;
      const existingCoverage =
        nestedNum(meta, ['existingCoverage', 'coverage']) ??
        (similarityIndex != null ? Math.round(similarityIndex) : null);
      const innovationScore =
        nestedNum(meta, ['innovation', 'innovationScore']) ??
        avg(
          [originalityScore, factors?.visualPotential, factors?.timeliness].filter(
            (v): v is number => v != null,
          ),
        );
      const researchUniqueness =
        nestedNum(meta, ['researchUniqueness', 'research']) ?? originalityScore;
      const productionReadiness = factors?.feasibility ?? null;
      const confidence = num(row.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;
      const duplicateClass = classifyDuplicate(similarityIndex);
      const originalityStatus = originalityStatusFrom(
        originalityScore,
        similarityIndex,
        row.gateStatus,
        row.decision,
      );
      const priority: OriginalityCandidate['priority'] =
        originalityScore == null && similarityIndex == null
          ? 'UNMEASURED'
          : originalityStatus === 'ORIGINAL'
            ? 'HIGH'
            : originalityStatus === 'OVERLAP_RISK'
              ? 'LOW'
              : 'MEDIUM';

      classCounts.set(duplicateClass, (classCounts.get(duplicateClass) ?? 0) + 1);
      if (originalityScore != null) {
        const bucket = domainBuckets.get(row.domain) ?? [];
        bucket.push(originalityScore);
        domainBuckets.set(row.domain, bucket);
      }

      const dupes = (duplicatesByCandidate.get(row.id) ?? []).map((item) => ({
        id: item.id,
        assetType: item.assetType,
        assetId: item.assetId,
        similarity: Math.round(Number(item.similarity)),
        blocking: Boolean(item.blocking),
        explanation: item.explanation,
        modelVersion: item.modelVersion,
        checkedAt: item.checkedAt.toISOString(),
      }));

      const coverageByType = new Map<string, number[]>();
      for (const item of dupes) {
        const list = coverageByType.get(item.assetType) ?? [];
        list.push(item.similarity);
        coverageByType.set(item.assetType, list);
      }

      const coverageCatalog = [
        'Internal Library',
        'YouTube',
        'Netflix',
        'Academic Papers',
        'Industry Reports',
        'News Archives',
        'Books',
        'Public Datasets',
      ];

      const coverage = coverageCatalog.map((source) => {
        const key = source.toLowerCase();
        const matchEntry = [...coverageByType.entries()].find(([assetType]) => {
          const t = assetType.toLowerCase();
          return (
            t.includes(key.split(' ')[0]!) ||
            (key.includes('internal') && /internal|library|catalogue|catalog/.test(t)) ||
            (key.includes('academic') && /academic|paper|scholar/.test(t)) ||
            (key.includes('industry') && /industry|report/.test(t)) ||
            (key.includes('news') && /news|archive/.test(t)) ||
            (key.includes('book') && /book/.test(t)) ||
            (key.includes('public') && /dataset|public/.test(t)) ||
            (key.includes('youtube') && /youtube|yt/.test(t)) ||
            (key.includes('netflix') && /netflix|streaming/.test(t))
          );
        });
        return {
          source,
          coverage: matchEntry ? avg(matchEntry[1]) : null,
        };
      });

      const semanticSources =
        dupes.length > 0
          ? dupes.map((item) => ({
              source: item.assetType,
              similarity: item.similarity,
              detail: item.explanation ?? `Compared asset ${item.assetId.slice(0, 8)}`,
            }))
          : coverageCatalog.slice(0, 6).map((source) => ({
              source,
              similarity: null as number | null,
              detail: 'No semantic comparison persisted for this source',
            }));

      const explainability: string[] = [];
      if (originalityScore != null) {
        explainability.push(`Originality score ${originalityScore}%`);
      }
      if (noveltyIndex != null) explainability.push(`Novelty index ${noveltyIndex}%`);
      if (similarityIndex != null) {
        explainability.push(
          similarityIndex <= 20
            ? `Minimal semantic overlap (${similarityIndex}%)`
            : `Similarity index ${similarityIndex}% (${duplicateClass})`,
        );
      }
      if (knowledgeContribution != null) {
        explainability.push(`Knowledge contribution ${knowledgeContribution}%`);
      }
      if (uniquePerspective != null) {
        explainability.push(`Unique perspective ${uniquePerspective}%`);
      }
      if (copyrightRisk != null) {
        explainability.push(
          copyrightRisk <= 30
            ? `Minimal copyright risk (${copyrightRisk})`
            : `Elevated copyright risk (${copyrightRisk})`,
        );
      }
      if (row.geography?.trim()) {
        explainability.push(`Geographic focus: ${row.geography.trim()}`);
      }
      if (!explainability.length) {
        explainability.push('No originality or duplicate-check signals persisted yet');
      }

      const recommendation = recommendationFor(originalityStatus, duplicateClass);
      const editorialRecommendation = editorialFor(originalityStatus);
      const createdAt = row.createdAt.toISOString();
      const updatedAt = row.updatedAt.toISOString();
      const optimization = optimizationHints({
        originality: originalityScore,
        similarity: similarityIndex,
        perspective: uniquePerspective,
        visual: factors?.visualPotential ?? null,
        regional: factors?.regionalRelevance ?? null,
        educational: factors?.educationalValue ?? null,
      });

      const researchGaps: string[] = [];
      if (similarityIndex != null && similarityIndex >= 60) {
        researchGaps.push('High overlap with existing coverage — seek unused angles');
      }
      if (factors?.regionalRelevance != null && factors.regionalRelevance < 70) {
        researchGaps.push('Limited regional research depth');
      }
      if (factors?.educationalValue != null && factors.educationalValue < 70) {
        researchGaps.push('Few educational / expert interview signals');
      }
      if (dupes.length === 0) {
        researchGaps.push('No duplicate corpus comparisons written yet');
      }
      if (!researchGaps.length && originalityScore != null) {
        researchGaps.push('No critical research gaps flagged from persisted signals');
      }
      if (!researchGaps.length) {
        researchGaps.push('Await originality cycle before gap detection');
      }

      const embeddingModel =
        nestedString(meta, ['embeddingModel', 'embedding_version']) ??
        dupes[0]?.modelVersion ??
        null;

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
        originalityScore,
        noveltyIndex,
        similarityIndex,
        knowledgeContribution,
        uniquePerspective,
        copyrightRisk,
        existingCoverage,
        innovationScore,
        researchUniqueness,
        confidence,
        measuredConfidence,
        productionReadiness,
        originalityStatus,
        duplicateClass,
        priority,
        recommendation,
        editorialRecommendation,
        explainability,
        aiSummary:
          originalityScore != null
            ? `${row.title} scores ${originalityScore}% originality (${duplicateClass.replaceAll('_', ' ').toLowerCase()}). ${recommendation}.`
            : `${row.title} awaits persisted originality scoring and/or duplicate checks.`,
        semanticSources,
        coverage,
        noveltySignals: [
          {
            label: 'New evidence',
            status: signalStatus(nestedNum(meta, ['newEvidence']) ?? originalityScore),
            detail:
              nestedNum(meta, ['newEvidence']) != null
                ? `Score ${nestedNum(meta, ['newEvidence'])}`
                : originalityScore != null
                  ? `Inferred via originality ${originalityScore}`
                  : 'No evidence-novelty payload',
          },
          {
            label: 'New interpretation',
            status: signalStatus(uniquePerspective),
            detail:
              uniquePerspective != null
                ? `Perspective ${uniquePerspective}`
                : 'No perspective payload',
          },
          {
            label: 'New geographic focus',
            status: signalStatus(factors?.regionalRelevance ?? null),
            detail:
              factors?.regionalRelevance != null
                ? `Regional relevance ${factors.regionalRelevance}`
                : 'No regional novelty payload',
          },
          {
            label: 'New interviews',
            status: nestedNum(meta, ['newInterviews']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['newInterviews']) != null
                ? `Score ${nestedNum(meta, ['newInterviews'])}`
                : 'No interview novelty payload',
          },
          {
            label: 'New technology',
            status: signalStatus(factors?.timeliness ?? null),
            detail:
              factors?.timeliness != null
                ? `Timeliness ${factors.timeliness}`
                : 'No technology novelty payload',
          },
          {
            label: 'New historical insight',
            status: nestedNum(meta, ['historicalInsight']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['historicalInsight']) != null
                ? `Score ${nestedNum(meta, ['historicalInsight'])}`
                : 'No historical insight payload',
          },
          {
            label: 'New production approach',
            status: signalStatus(factors?.visualPotential ?? null),
            detail:
              factors?.visualPotential != null
                ? `Visual potential ${factors.visualPotential}`
                : 'No production-approach payload',
          },
        ],
        perspectives: [
          {
            label: 'Alternative viewpoint',
            status: signalStatus(uniquePerspective),
            detail:
              uniquePerspective != null
                ? `Perspective ${uniquePerspective}`
                : 'UNMEASURED',
          },
          {
            label: 'Underrepresented voices',
            status:
              nestedNum(meta, ['underrepresentedVoices']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail:
              nestedNum(meta, ['underrepresentedVoices']) != null
                ? `Score ${nestedNum(meta, ['underrepresentedVoices'])}`
                : 'No voice-diversity payload',
          },
          {
            label: 'Regional perspective',
            status: signalStatus(factors?.regionalRelevance ?? null),
            detail:
              factors?.regionalRelevance != null
                ? `Regional ${factors.regionalRelevance}`
                : row.geography?.trim() || 'No geography persisted',
          },
          {
            label: 'Industry perspective',
            status: signalStatus(knowledgeContribution),
            detail:
              knowledgeContribution != null
                ? `Knowledge ${knowledgeContribution}`
                : 'UNMEASURED',
          },
          {
            label: 'Historical reinterpretation',
            status:
              nestedNum(meta, ['historicalReinterpretation']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail:
              nestedNum(meta, ['historicalReinterpretation']) != null
                ? `Score ${nestedNum(meta, ['historicalReinterpretation'])}`
                : 'No reinterpretation payload',
          },
          {
            label: 'Emerging trend',
            status: signalStatus(factors?.timeliness ?? null),
            detail:
              factors?.timeliness != null
                ? `Timeliness ${factors.timeliness}`
                : 'UNMEASURED',
          },
        ],
        knowledge: [
          { label: 'Educational advancement', value: knowledgeContribution },
          {
            label: 'Industry relevance',
            value: nestedNum(meta, ['industryRelevance']) ?? factors?.strategicFit ?? null,
          },
          {
            label: 'Scientific contribution',
            value: nestedNum(meta, ['scientificContribution']),
          },
          {
            label: 'Historical preservation',
            value: nestedNum(meta, ['historicalPreservation']),
          },
          {
            label: 'Public awareness',
            value: nestedNum(meta, ['publicAwareness']) ?? factors?.audienceValue ?? null,
          },
          {
            label: 'Professional development',
            value: nestedNum(meta, ['professionalDevelopment']),
          },
        ],
        copyright: [
          {
            label: 'Copyright infringement',
            status: signalStatus(copyrightRisk, false),
            detail:
              copyrightRisk != null
                ? `Risk score ${copyrightRisk}`
                : 'No copyright risk assessment persisted',
          },
          {
            label: 'Trademark issues',
            status:
              (risksByCandidate.get(row.id) ?? []).some((r) =>
                /trade/i.test(r.category),
              )
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail: 'From iq_risk_assessments when category matches',
          },
          {
            label: 'Fair use considerations',
            status:
              nestedNum(meta, ['fairUse']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['fairUse']) != null
                ? `Score ${nestedNum(meta, ['fairUse'])}`
                : 'No fair-use payload',
          },
          {
            label: 'Third-party material',
            status:
              nestedNum(meta, ['thirdPartyMaterial']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['thirdPartyMaterial']) != null
                ? `Score ${nestedNum(meta, ['thirdPartyMaterial'])}`
                : 'No third-party material payload',
          },
          {
            label: 'Licensing requirements',
            status:
              (risksByCandidate.get(row.id) ?? []).some((r) =>
                /licen/i.test(r.category),
              )
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail: 'From risk assessments when present',
          },
          {
            label: 'Public domain availability',
            status:
              nestedNum(meta, ['publicDomain']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['publicDomain']) != null
                ? `Score ${nestedNum(meta, ['publicDomain'])}`
                : 'No public-domain payload',
          },
        ],
        knowledgeGraph: [
          {
            label: 'Existing entities',
            status: dupes.length ? 'OBSERVED' : 'UNMEASURED',
            detail: dupes.length
              ? `${dupes.length} compared assets`
              : 'No knowledge-graph comparisons persisted',
          },
          {
            label: 'Missing relationships',
            status:
              nestedNum(meta, ['missingRelationships']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail:
              nestedNum(meta, ['missingRelationships']) != null
                ? `Score ${nestedNum(meta, ['missingRelationships'])}`
                : 'No KG gap payload',
          },
          {
            label: 'New concepts',
            status: signalStatus(noveltyIndex),
            detail:
              noveltyIndex != null ? `Novelty ${noveltyIndex}` : 'UNMEASURED',
          },
          {
            label: 'New timelines',
            status:
              nestedNum(meta, ['newTimelines']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['newTimelines']) != null
                ? `Score ${nestedNum(meta, ['newTimelines'])}`
                : 'No timeline novelty payload',
          },
          {
            label: 'New organizations',
            status:
              nestedNum(meta, ['newOrganizations']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['newOrganizations']) != null
                ? `Score ${nestedNum(meta, ['newOrganizations'])}`
                : 'No organization novelty payload',
          },
          {
            label: 'New events',
            status:
              nestedNum(meta, ['newEvents']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['newEvents']) != null
                ? `Score ${nestedNum(meta, ['newEvents'])}`
                : 'No event novelty payload',
          },
        ],
        noveltyHeatmap: [
          { label: 'Topic', value: originalityScore },
          { label: 'Perspective', value: uniquePerspective },
          { label: 'Research', value: researchUniqueness },
          {
            label: 'Evidence',
            value: nestedNum(meta, ['newEvidence']) ?? factors?.evidence ?? null,
          },
          {
            label: 'Storytelling',
            value: nestedNum(meta, ['storytelling']) ?? originalityScore,
          },
          { label: 'Visuals', value: factors?.visualPotential ?? null },
        ],
        innovation: [
          {
            label: 'Storytelling innovation',
            value: nestedNum(meta, ['storytellingInnovation']) ?? originalityScore,
          },
          {
            label: 'Technical innovation',
            value: nestedNum(meta, ['technicalInnovation']),
          },
          {
            label: 'Visual innovation',
            value: factors?.visualPotential ?? null,
          },
          {
            label: 'Educational innovation',
            value: factors?.educationalValue ?? null,
          },
          {
            label: 'Production innovation',
            value: nestedNum(meta, ['productionInnovation']) ?? productionReadiness,
          },
        ],
        researchGaps,
        competitive: [
          {
            label: 'Topic uniqueness',
            value: originalityScore,
          },
          {
            label: 'Narrative structure',
            value: nestedNum(meta, ['narrativeStructure']),
          },
          {
            label: 'Production quality',
            value: productionReadiness,
          },
          {
            label: 'Educational depth',
            value: factors?.educationalValue ?? null,
          },
          {
            label: 'Visual innovation',
            value: factors?.visualPotential ?? null,
          },
          {
            label: 'Research depth',
            value: researchUniqueness,
          },
        ],
        duplicates: dupes,
        optimization,
        lifecycle: [
          { key: 'idea', label: 'Idea', done: true, at: createdAt },
          {
            key: 'semantic',
            label: 'Semantic comparison',
            done: dupes.length > 0 || similarityIndex != null,
            at: dupes.length || similarityIndex != null ? updatedAt : null,
          },
          {
            key: 'novelty',
            label: 'Novelty detection',
            done: originalityScore != null || noveltyIndex != null,
            at: originalityScore != null || noveltyIndex != null ? updatedAt : null,
          },
          {
            key: 'knowledge',
            label: 'Knowledge analysis',
            done: knowledgeContribution != null,
            at: knowledgeContribution != null ? updatedAt : null,
          },
          {
            key: 'copyright',
            label: 'Copyright review',
            done: copyrightRisk != null,
            at: copyrightRisk != null ? updatedAt : null,
          },
          {
            key: 'decision',
            label: 'Originality decision',
            done: originalityStatus === 'ORIGINAL' || originalityStatus === 'OVERLAP_RISK',
            at:
              originalityStatus === 'ORIGINAL' || originalityStatus === 'OVERLAP_RISK'
                ? updatedAt
                : null,
          },
        ],
        factors,
        modelVersion: row.modelVersion,
        embeddingModel,
        createdAt,
        updatedAt,
      };
    });

    const originalCount = candidates.filter((c) => c.originalityStatus === 'ORIGINAL').length;
    const needsDifferentiation = candidates.filter(
      (c) => c.originalityStatus === 'NEEDS_DIFFERENTIATION',
    ).length;
    const overlapRisk = candidates.filter((c) => c.originalityStatus === 'OVERLAP_RISK').length;

    const originalityScores = candidates
      .map((c) => c.originalityScore)
      .filter((v): v is number => v != null);
    const noveltyScores = candidates
      .map((c) => c.noveltyIndex)
      .filter((v): v is number => v != null);
    const similarityScores = candidates
      .map((c) => c.similarityIndex)
      .filter((v): v is number => v != null);
    const knowledgeScores = candidates
      .map((c) => c.knowledgeContribution)
      .filter((v): v is number => v != null);
    const perspectiveScores = candidates
      .map((c) => c.uniquePerspective)
      .filter((v): v is number => v != null);
    const copyrightScores = candidates
      .map((c) => c.copyrightRisk)
      .filter((v): v is number => v != null);
    const coverageScores = candidates
      .map((c) => c.existingCoverage)
      .filter((v): v is number => v != null);
    const innovationScores = candidates
      .map((c) => c.innovationScore)
      .filter((v): v is number => v != null);
    const researchScores = candidates
      .map((c) => c.researchUniqueness)
      .filter((v): v is number => v != null);
    const confidenceScores = candidates
      .filter((c) => c.measuredConfidence)
      .map((c) => c.confidence)
      .filter((v): v is number => v != null);
    const readinessScores = candidates
      .map((c) => c.productionReadiness)
      .filter((v): v is number => v != null);

    const recommendations: OriginalityOverview['recommendations'] = [];
    for (const item of candidates.slice(0, 12)) {
      recommendations.push({
        id: `or-${item.id}`,
        action: item.recommendation,
        reason: `${item.title} · ${item.originalityStatus} · ${item.duplicateClass}`,
        priority:
          item.originalityStatus === 'ORIGINAL'
            ? 'HIGH'
            : item.originalityStatus === 'OVERLAP_RISK'
              ? 'LOW'
              : 'MEDIUM',
        candidateId: item.id,
      });
      for (const tip of item.optimization.slice(0, 1)) {
        recommendations.push({
          id: `opt-${item.id}`,
          action: tip,
          reason: `Innovation opportunity for ${item.title}`,
          priority: 'MEDIUM',
          candidateId: item.id,
        });
      }
    }

    const notifications: OriginalityOverview['notifications'] = [];
    for (const item of candidates.slice(0, 10)) {
      if (item.originalityStatus === 'ORIGINAL') {
        notifications.push({
          id: `ok-${item.id}`,
          severity: 'INFO',
          message: `Distinctive originality: ${item.title}`,
        });
      }
      if (item.originalityStatus === 'OVERLAP_RISK') {
        notifications.push({
          id: `ov-${item.id}`,
          severity: item.duplicateClass === 'EXACT_DUPLICATE' ? 'CRITICAL' : 'WARNING',
          message: `Overlap risk (${item.duplicateClass}): ${item.title}`,
        });
      }
      if (item.originalityStatus === 'NEEDS_DIFFERENTIATION') {
        notifications.push({
          id: `diff-${item.id}`,
          severity: 'WARNING',
          message: `Needs differentiation: ${item.title}`,
        });
      }
    }

    const modelVersions = [
      ...new Set(
        candidates
          .map((c) => c.modelVersion)
          .filter((v): v is string => Boolean(v)),
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

    const hasScores = originalityScores.length > 0 || similarityScores.length > 0;
    const pipeline = [
      { key: 'semantic', label: 'Semantic Comparison' },
      { key: 'kg', label: 'Knowledge Graph Analysis' },
      { key: 'coverage', label: 'Coverage Review' },
      { key: 'novelty', label: 'Novelty Detection' },
      { key: 'copyright', label: 'Copyright Assessment' },
      { key: 'knowledge', label: 'Knowledge Contribution' },
      { key: 'score', label: 'Originality Score' },
      { key: 'proceed', label: 'Proceed' },
    ].map((item, index) => {
      let state: 'pending' | 'active' | 'done' | 'failed' = 'pending';
      if (overlapRisk > 0 && item.key === 'score') state = 'failed';
      else if (originalCount > 0 && index <= 7) state = 'done';
      else if (hasScores && index <= 4) state = 'done';
      else if (hasScores && index === 5) state = 'active';
      else if (rows.length && index === 0) state = 'active';
      return { ...item, state };
    });

    const similarityBands = [
      { label: '0–19', count: 0 },
      { label: '20–39', count: 0 },
      { label: '40–59', count: 0 },
      { label: '60–79', count: 0 },
      { label: '80–100', count: 0 },
      { label: 'UNMEASURED', count: 0 },
    ];
    for (const item of candidates) {
      const s = item.similarityIndex;
      if (s == null) similarityBands[5]!.count += 1;
      else if (s < 20) similarityBands[0]!.count += 1;
      else if (s < 40) similarityBands[1]!.count += 1;
      else if (s < 60) similarityBands[2]!.count += 1;
      else if (s < 80) similarityBands[3]!.count += 1;
      else similarityBands[4]!.count += 1;
    }

    const copyrightBands = [
      { label: 'LOW (0–29)', count: 0 },
      { label: 'MEDIUM (30–69)', count: 0 },
      { label: 'HIGH (70–100)', count: 0 },
      { label: 'UNMEASURED', count: 0 },
    ];
    for (const item of candidates) {
      const s = item.copyrightRisk;
      if (s == null) copyrightBands[3]!.count += 1;
      else if (s < 30) copyrightBands[0]!.count += 1;
      else if (s < 70) copyrightBands[1]!.count += 1;
      else copyrightBands[2]!.count += 1;
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
        averageOriginality: avg(originalityScores),
        noveltyIndex: avg(noveltyScores),
        similarityIndex: avg(similarityScores),
        knowledgeContribution: avg(knowledgeScores),
        uniquePerspective: avg(perspectiveScores),
        copyrightRisk: avg(copyrightScores),
        existingCoverage: avg(coverageScores),
        innovationScore: avg(innovationScores),
        researchUniqueness: avg(researchScores),
        aiConfidence: avg(confidenceScores),
        editorialRecommendationRate: pct(originalCount, candidates.length),
        productionReadiness: avg(readinessScores),
        totalCandidates: candidates.length,
        originalCount,
        needsDifferentiation,
        overlapRisk,
      },
      pipeline,
      candidates,
      duplicateClassDistribution: [...classCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      domainNovelty: [...domainBuckets.entries()]
        .map(([label, scores]) => ({
          label,
          avgScore: avg(scores),
          count: scores.length,
        }))
        .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0)),
      recommendations,
      analytics: {
        originalityDistribution: [
          { label: 'ORIGINAL', count: originalCount },
          { label: 'NEEDS_DIFFERENTIATION', count: needsDifferentiation },
          { label: 'OVERLAP_RISK', count: overlapRisk },
          {
            label: 'PENDING',
            count: candidates.filter((c) => c.originalityStatus === 'PENDING').length,
          },
        ],
        similarityBands,
        copyrightRiskBands: copyrightBands,
      },
      governance: {
        modelVersions,
        embeddingModels,
        decisionsLogged: Number(decisionCount[0]?.count ?? 0),
        auditEvents: auditRows.length,
        duplicateChecks: duplicateRows.length,
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
          : 'Originality Analysis unavailable',
      meta: {
        cycleStatus: 'UNAVAILABLE',
        intakeStatus: null,
        modelVersions: [],
        embeddingModels: [],
      },
      metrics: {
        averageOriginality: null,
        noveltyIndex: null,
        similarityIndex: null,
        knowledgeContribution: null,
        uniquePerspective: null,
        copyrightRisk: null,
        existingCoverage: null,
        innovationScore: null,
        researchUniqueness: null,
        aiConfidence: null,
        editorialRecommendationRate: null,
        productionReadiness: null,
        totalCandidates: 0,
        originalCount: 0,
        needsDifferentiation: 0,
        overlapRisk: 0,
      },
      pipeline: [],
      candidates: [],
      duplicateClassDistribution: [],
      domainNovelty: [],
      recommendations: [],
      analytics: {
        originalityDistribution: [],
        similarityBands: [],
        copyrightRiskBands: [],
      },
      governance: {
        modelVersions: [],
        embeddingModels: [],
        decisionsLogged: 0,
        auditEvents: 0,
        duplicateChecks: 0,
      },
      notifications: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
