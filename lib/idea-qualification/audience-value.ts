import { prisma } from '@/lib/db';
import type { FactorScores } from './contracts';

export type AudienceValueCandidate = {
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
  audienceValueScore: number | null;
  educationalValue: number | null;
  commercialAppeal: number | null;
  engagementPotential: number | null;
  accessibilityScore: number | null;
  retentionScore: number | null;
  diversityScore: number | null;
  regionalRelevance: number | null;
  timeliness: number | null;
  visualPotential: number | null;
  confidence: number | null;
  measuredConfidence: boolean;
  valueStatus: 'HIGH_VALUE' | 'NEEDS_OPTIMIZATION' | 'LOW_VALUE' | 'PENDING';
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMEASURED';
  recommendation: string;
  explainability: string[];
  aiSummary: string;
  personas: Array<{ persona: string; match: number | null }>;
  segments: Array<{ label: string; size: number | null }>;
  demand: Array<{ label: string; value: number | null }>;
  educational: Array<{ label: string; value: number | null }>;
  engagement: Array<{ label: string; value: number | null }>;
  retentionCurve: Array<{ minute: number; retentionPct: number | null }>;
  commercial: Array<{ label: string; value: string | null }>;
  accessibility: Array<{ label: string; status: string; detail: string }>;
  platforms: Array<{ platform: string; suitability: number | null }>;
  knowledge: Array<{ label: string; value: number | null }>;
  learningOutcomes: Array<{ objective: string; confidence: number | null }>;
  sentiment: Array<{ label: string; value: number | null }>;
  geographyBreakdown: Array<{ label: string; value: number | null }>;
  heatmaps: Array<{ dimension: string; buckets: Array<{ label: string; value: number | null }> }>;
  optimization: string[];
  lifecycle: Array<{ key: string; label: string; done: boolean; at: string | null }>;
  factors: Partial<FactorScores> | null;
  modelVersion: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AudienceValueOverview = {
  available: boolean;
  reason?: string;
  meta: {
    cycleStatus: string;
    intakeStatus: string | null;
    modelVersions: string[];
    audienceModelVersion: string | null;
  };
  metrics: {
    averageAudienceValue: number | null;
    predictedReach: number | null;
    estimatedWatchTime: number | null;
    audienceSatisfaction: number | null;
    educationalImpact: number | null;
    commercialAppeal: number | null;
    viralPotential: number | null;
    audienceDiversity: number | null;
    accessibilityScore: number | null;
    globalCoverage: number | null;
    audienceRetention: number | null;
    recommendationScore: number | null;
    totalCandidates: number;
    highValue: number;
    needsOptimization: number;
    lowValue: number;
  };
  pipeline: Array<{
    key: string;
    label: string;
    state: 'pending' | 'active' | 'done' | 'failed';
  }>;
  candidates: AudienceValueCandidate[];
  segmentDistribution: Array<{ label: string; count: number }>;
  geographicCoverage: Array<{ label: string; count: number }>;
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    candidateId?: string;
  }>;
  analytics: {
    valueDistribution: Array<{ label: string; count: number }>;
    domainDemand: Array<{ label: string; avgScore: number | null; count: number }>;
  };
  governance: {
    modelVersions: string[];
    audienceModelVersion: string | null;
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

const KNOWN_SEGMENTS = [
  'Students',
  'Engineers',
  'Executives',
  'Researchers',
  'Investors',
  'Policy Makers',
  'General Public',
  'Children',
  'Professionals',
] as const;

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

function parseAudienceMeta(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const nested =
      (parsed.audience as Record<string, unknown> | undefined) ??
      (parsed.audienceMeta as Record<string, unknown> | undefined) ??
      (parsed.audienceValueDetail as Record<string, unknown> | undefined);
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

function valueStatusFrom(
  score: number | null,
  gateStatus: string,
  decision: string | null,
): AudienceValueCandidate['valueStatus'] {
  const gate = gateStatus.toUpperCase();
  const dec = (decision ?? '').toUpperCase();
  if (dec.includes('REJECT') || gate.includes('FAIL')) return 'LOW_VALUE';
  if (score == null) return 'PENDING';
  if (score >= 85) return 'HIGH_VALUE';
  if (score >= 65) return 'NEEDS_OPTIMIZATION';
  return 'LOW_VALUE';
}

function recommendationFor(
  status: AudienceValueCandidate['valueStatus'],
  educational: number | null,
  accessibility: number | null,
): string {
  if (status === 'HIGH_VALUE') return 'Approve for audience gate';
  if (status === 'LOW_VALUE') return 'Reject or redesign for audience value';
  if (status === 'PENDING') return 'Await audience scoring';
  if (educational != null && educational < 70) return 'Increase educational depth';
  if (accessibility != null && accessibility < 70) return 'Improve accessibility';
  return 'Optimize narrative for target segments';
}

function inferPersonas(
  audience: string | null,
  domain: string,
  score: number | null,
): Array<{ persona: string; match: number | null }> {
  const hay = `${audience ?? ''} ${domain}`.toLowerCase();
  const catalog: Array<{ persona: string; match: RegExp }> = [
    { persona: 'Engineering Students', match: /student|university|campus|learning/ },
    { persona: 'Civil Engineers', match: /civil|engineer|infrastructure|construction/ },
    { persona: 'Business Leaders', match: /executive|business|leader|corporate|c-suite/ },
    { persona: 'Government Agencies', match: /policy|government|regulator|public sector/ },
    { persona: 'Researchers', match: /research|academic|scientist/ },
    { persona: 'Investors', match: /investor|venture|capital|finance/ },
    { persona: 'General Audience', match: /general|public|consumer|mass/ },
  ];

  const hits = catalog
    .filter((item) => item.match.test(hay))
    .map((item) => ({
      persona: item.persona,
      match: score,
    }));

  if (hits.length) return hits.slice(0, 6);

  if (audience?.trim()) {
    return [{ persona: audience.trim(), match: score }];
  }

  return KNOWN_SEGMENTS.slice(0, 5).map((persona) => ({
    persona,
    match: null as number | null,
  }));
}

function segmentLabel(audience: string | null): string {
  if (!audience?.trim()) return 'Unspecified';
  const raw = audience.trim();
  const lower = raw.toLowerCase();
  for (const known of KNOWN_SEGMENTS) {
    if (lower.includes(known.toLowerCase().replace(/s$/, '')) || lower.includes(known.toLowerCase())) {
      return known;
    }
  }
  return raw;
}

function retentionFromMeta(
  meta: Record<string, unknown>,
): Array<{ minute: number; retentionPct: number | null }> {
  const curve = meta.retentionCurve ?? meta.retention;
  if (Array.isArray(curve)) {
    return curve
      .map((point) => {
        if (!point || typeof point !== 'object') return null;
        const row = point as Record<string, unknown>;
        const minute = num(row.minute ?? row.at ?? row.t);
        const retentionPct = num(row.retentionPct ?? row.retention ?? row.value);
        if (minute == null) return null;
        return { minute, retentionPct };
      })
      .filter((item): item is { minute: number; retentionPct: number | null } => item != null)
      .slice(0, 12);
  }
  return [
    { minute: 0, retentionPct: null },
    { minute: 3, retentionPct: null },
    { minute: 10, retentionPct: null },
    { minute: 20, retentionPct: null },
    { minute: 30, retentionPct: null },
  ];
}

function platformsFrom(
  formatHint: string | null,
  meta: Record<string, unknown>,
  score: number | null,
): Array<{ platform: string; suitability: number | null }> {
  const fromMeta = meta.platforms ?? meta.platformSuitability;
  if (Array.isArray(fromMeta)) {
    return fromMeta
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const platform = nestedString(row, ['platform', 'label', 'name']);
        if (!platform) return null;
        return {
          platform,
          suitability: num(row.suitability ?? row.score ?? row.value),
        };
      })
      .filter((item): item is { platform: string; suitability: number | null } => item != null)
      .slice(0, 10);
  }

  const hint = (formatHint ?? '').toLowerCase();
  const catalog = [
    'YouTube',
    'Netflix',
    'Amazon Prime',
    'Corporate LMS',
    'University LMS',
    'Television',
    'Mobile',
    'Short-form',
    'Podcast',
  ];

  return catalog.map((platform) => {
    const key = platform.toLowerCase();
    const hinted =
      hint.includes(key) ||
      (key === 'short-form' && /short|reel|tiktok|shorts/.test(hint)) ||
      (key === 'university lms' && /university|campus|moodle|canvas/.test(hint)) ||
      (key === 'corporate lms' && /corporate|lms|training/.test(hint));
    return {
      platform,
      suitability: hinted ? score : null,
    };
  });
}

function optimizationHints(input: {
  educational: number | null;
  accessibility: number | null;
  visual: number | null;
  regional: number | null;
  audienceValue: number | null;
}): string[] {
  const tips: string[] = [];
  if (input.visual != null && input.visual < 75) tips.push('Increase visual demonstrations');
  if (input.educational != null && input.educational < 80) tips.push('Add case studies');
  if (input.accessibility != null && input.accessibility < 80) tips.push('Simplify terminology');
  if (input.regional != null && input.regional < 75) tips.push('Increase regional examples');
  if (input.audienceValue != null && input.audienceValue < 85) {
    tips.push('Improve storytelling');
    tips.push('Include interviews');
  }
  if (!tips.length && input.audienceValue != null) {
    tips.push('Maintain educational clarity');
    tips.push('Preserve evergreen framing');
  }
  if (!tips.length) {
    tips.push('Await audience scoring before optimization');
  }
  return tips.slice(0, 8);
}

export async function loadAudienceValue(): Promise<AudienceValueOverview> {
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
        s.model_version AS modelVersion
      FROM iq_candidates c
      OUTER APPLY (
        SELECT TOP 1 *
        FROM iq_scores sc
        WHERE sc.candidate_id = c.id
        ORDER BY sc.scored_at DESC
      ) s
      ORDER BY
        COALESCE(
          TRY_CONVERT(float, JSON_VALUE(s.factors_json, '$.audienceValue')),
          s.total_score,
          c.score
        ) DESC,
        c.updated_at DESC
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
      WHERE action LIKE '%AUDIENCE%'
         OR action LIKE '%SCORE%'
         OR action LIKE '%VALUE%'
         OR action LIKE '%QUALIF%'
         OR action LIKE '%DECISION%'
      ORDER BY created_at DESC
    `;

    const segmentCounts = new Map<string, number>();
    const geoCounts = new Map<string, number>();
    const domainBuckets = new Map<string, number[]>();

    const candidates: AudienceValueCandidate[] = rows.map((row) => {
      const factors = parseFactors(row.factorsJson);
      const meta = parseAudienceMeta(row.factorsJson);
      const audienceValueScore = factors?.audienceValue ?? null;
      const educationalValue =
        factors?.educationalValue ?? nestedNum(meta, ['educationalImpact', 'educationalValue']);
      const commercialAppeal =
        nestedNum(meta, ['commercialAppeal', 'commercialValue', 'sponsorInterest']) ??
        factors?.audienceValue ??
        null;
      const engagementPotential =
        nestedNum(meta, ['engagement', 'engagementPotential', 'predictedEngagement']) ?? null;
      const accessibilityScore =
        nestedNum(meta, ['accessibility', 'accessibilityScore']) ?? null;
      const retentionScore = nestedNum(meta, ['retention', 'retentionScore', 'completion']) ?? null;
      const diversityScore = nestedNum(meta, ['diversity', 'audienceDiversity']) ?? null;
      const regionalRelevance = factors?.regionalRelevance ?? null;
      const confidence = num(row.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;
      const valueStatus = valueStatusFrom(audienceValueScore, row.gateStatus, row.decision);
      const priority: AudienceValueCandidate['priority'] =
        audienceValueScore == null
          ? 'UNMEASURED'
          : audienceValueScore >= 90
            ? 'HIGH'
            : audienceValueScore >= 75
              ? 'MEDIUM'
              : 'LOW';

      const segment = segmentLabel(row.audience);
      segmentCounts.set(segment, (segmentCounts.get(segment) ?? 0) + 1);
      const geoKey = row.geography?.trim() || 'UNMEASURED';
      geoCounts.set(geoKey, (geoCounts.get(geoKey) ?? 0) + 1);
      if (audienceValueScore != null) {
        const bucket = domainBuckets.get(row.domain) ?? [];
        bucket.push(audienceValueScore);
        domainBuckets.set(row.domain, bucket);
      }

      const personas = inferPersonas(row.audience, row.domain, audienceValueScore);
      const explainability: string[] = [];
      if (audienceValueScore != null) {
        explainability.push(`Audience value score ${audienceValueScore}%`);
      }
      if (educationalValue != null) {
        explainability.push(`Educational impact ${educationalValue}%`);
      }
      if (commercialAppeal != null) {
        explainability.push(`Commercial appeal ${commercialAppeal}`);
      }
      if (regionalRelevance != null) {
        explainability.push(`Regional relevance ${regionalRelevance}%`);
      }
      if (row.audience?.trim()) {
        explainability.push(`Target audience: ${row.audience.trim()}`);
      }
      if (engagementPotential != null) {
        explainability.push(`Engagement potential ${engagementPotential}%`);
      }
      if (retentionScore != null) {
        explainability.push(`Retention prediction ${retentionScore}%`);
      }
      if (!explainability.length) {
        explainability.push('No audienceValue factor persisted yet for this candidate');
      }

      const recommendation = recommendationFor(
        valueStatus,
        educationalValue,
        accessibilityScore,
      );
      const createdAt = row.createdAt.toISOString();
      const updatedAt = row.updatedAt.toISOString();
      const optimization = optimizationHints({
        educational: educationalValue,
        accessibility: accessibilityScore,
        visual: factors?.visualPotential ?? null,
        regional: regionalRelevance,
        audienceValue: audienceValueScore,
      });

      const learningFromMeta = meta.learningOutcomes ?? meta.learningObjectives;
      const learningOutcomes = Array.isArray(learningFromMeta)
        ? learningFromMeta
            .map((item) => {
              if (!item || typeof item !== 'object') return null;
              const rowObj = item as Record<string, unknown>;
              const objective = nestedString(rowObj, ['objective', 'label', 'name']);
              if (!objective) return null;
              return {
                objective,
                confidence: num(rowObj.confidence ?? rowObj.value ?? rowObj.score),
              };
            })
            .filter(
              (item): item is { objective: string; confidence: number | null } => item != null,
            )
            .slice(0, 8)
        : [
            {
              objective: 'Understand technology',
              confidence: educationalValue,
            },
            {
              objective: 'Engineering awareness',
              confidence: educationalValue != null ? educationalValue : null,
            },
            {
              objective: 'Historical knowledge',
              confidence: factors?.timeliness ?? null,
            },
            {
              objective: 'Career inspiration',
              confidence: null,
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
        audienceValueScore,
        educationalValue,
        commercialAppeal,
        engagementPotential,
        accessibilityScore,
        retentionScore,
        diversityScore,
        regionalRelevance,
        timeliness: factors?.timeliness ?? null,
        visualPotential: factors?.visualPotential ?? null,
        confidence,
        measuredConfidence,
        valueStatus,
        priority,
        recommendation,
        explainability,
        aiSummary:
          audienceValueScore != null
            ? `${row.title} scores ${audienceValueScore}% audience value for ${row.audience?.trim() || 'unspecified audience'}. ${recommendation}.`
            : `${row.title} awaits persisted audienceValue scoring from the qualification cycle.`,
        personas,
        segments: [
          {
            label: segment,
            size: null,
          },
        ],
        demand: [
          {
            label: 'Search demand',
            value: nestedNum(meta, ['searchDemand', 'searchInterest']),
          },
          {
            label: 'Trending interest',
            value: nestedNum(meta, ['trendingInterest', 'trendScore']),
          },
          {
            label: 'Seasonal interest',
            value: nestedNum(meta, ['seasonalInterest']),
          },
          {
            label: 'Geographic demand',
            value: regionalRelevance,
          },
          {
            label: 'Platform demand',
            value: nestedNum(meta, ['platformDemand']),
          },
          {
            label: 'Language demand',
            value: nestedNum(meta, ['languageDemand']),
          },
        ],
        educational: [
          { label: 'Learning outcomes', value: educationalValue },
          {
            label: 'Knowledge transfer',
            value: nestedNum(meta, ['knowledgeTransfer']) ?? educationalValue,
          },
          {
            label: 'Skill development',
            value: nestedNum(meta, ['skillDevelopment']),
          },
          {
            label: 'Awareness',
            value: nestedNum(meta, ['awareness']),
          },
          {
            label: 'Industry contribution',
            value: nestedNum(meta, ['industryContribution']),
          },
          {
            label: 'Curriculum relevance',
            value: nestedNum(meta, ['curriculumRelevance']),
          },
        ],
        engagement: [
          {
            label: 'CTR',
            value: nestedNum(meta, ['ctr', 'clickThroughRate']),
          },
          {
            label: 'Watch time',
            value: nestedNum(meta, ['watchTime', 'avgViewDuration']),
          },
          {
            label: 'Completion',
            value: nestedNum(meta, ['completion', 'completionRate']) ?? retentionScore,
          },
          {
            label: 'Likes',
            value: nestedNum(meta, ['likeRate', 'likes']),
          },
          {
            label: 'Shares',
            value: nestedNum(meta, ['shareRate', 'shares']),
          },
          {
            label: 'Subscriber growth',
            value: nestedNum(meta, ['subscriberGrowth']),
          },
          {
            label: 'Repeat viewing',
            value: nestedNum(meta, ['repeatViewing']),
          },
          { label: 'Engagement potential', value: engagementPotential },
        ],
        retentionCurve: retentionFromMeta(meta),
        commercial: [
          {
            label: 'Commercial appeal',
            value: commercialAppeal != null ? `${commercialAppeal}` : null,
          },
          {
            label: 'Sponsor interest',
            value:
              nestedNum(meta, ['sponsorInterest']) != null
                ? `${nestedNum(meta, ['sponsorInterest'])}`
                : null,
          },
          {
            label: 'Advertiser appeal',
            value:
              nestedNum(meta, ['advertiserAppeal']) != null
                ? `${nestedNum(meta, ['advertiserAppeal'])}`
                : null,
          },
          {
            label: 'Licensing potential',
            value:
              nestedNum(meta, ['licensingPotential']) != null
                ? `${nestedNum(meta, ['licensingPotential'])}`
                : null,
          },
          {
            label: 'Subscription impact',
            value:
              nestedNum(meta, ['subscriptionImpact']) != null
                ? `${nestedNum(meta, ['subscriptionImpact'])}`
                : null,
          },
          {
            label: 'Educational sales',
            value: educationalValue != null ? `${educationalValue}` : null,
          },
          {
            label: 'Corporate training value',
            value:
              nestedNum(meta, ['corporateTrainingValue']) != null
                ? `${nestedNum(meta, ['corporateTrainingValue'])}`
                : null,
          },
        ],
        accessibility: [
          {
            label: 'Subtitle support',
            status:
              nestedNum(meta, ['subtitles', 'subtitleSupport']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail:
              nestedNum(meta, ['subtitles', 'subtitleSupport']) != null
                ? `Score ${nestedNum(meta, ['subtitles', 'subtitleSupport'])}`
                : 'No subtitle payload on iq_scores',
          },
          {
            label: 'Multi-language potential',
            status:
              nestedNum(meta, ['multiLanguage', 'languagePotential']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail:
              nestedNum(meta, ['multiLanguage', 'languagePotential']) != null
                ? `Score ${nestedNum(meta, ['multiLanguage', 'languagePotential'])}`
                : 'No language payload persisted',
          },
          {
            label: 'Reading complexity',
            status:
              nestedNum(meta, ['readingComplexity']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['readingComplexity']) != null
                ? `Score ${nestedNum(meta, ['readingComplexity'])}`
                : 'No complexity model output',
          },
          {
            label: 'Hearing accessibility',
            status: accessibilityScore != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              accessibilityScore != null
                ? `Accessibility ${accessibilityScore}`
                : 'No accessibility factor persisted',
          },
          {
            label: 'Visual accessibility',
            status:
              nestedNum(meta, ['visualAccessibility']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['visualAccessibility']) != null
                ? `Score ${nestedNum(meta, ['visualAccessibility'])}`
                : 'No visual accessibility payload',
          },
          {
            label: 'Cultural inclusiveness',
            status: diversityScore != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              diversityScore != null
                ? `Diversity ${diversityScore}`
                : 'No diversity payload persisted',
          },
        ],
        platforms: platformsFrom(row.formatHint, meta, audienceValueScore),
        knowledge: [
          {
            label: 'Information density',
            value: nestedNum(meta, ['informationDensity']) ?? educationalValue,
          },
          {
            label: 'Practical benefit',
            value: nestedNum(meta, ['practicalBenefit']),
          },
          {
            label: 'Research contribution',
            value: nestedNum(meta, ['researchContribution']),
          },
          {
            label: 'Industry relevance',
            value: nestedNum(meta, ['industryRelevance']) ?? regionalRelevance,
          },
          {
            label: 'Historical importance',
            value: nestedNum(meta, ['historicalImportance']) ?? factors?.timeliness ?? null,
          },
        ],
        learningOutcomes,
        sentiment: [
          {
            label: 'Positive',
            value: nestedNum(meta, ['sentimentPositive', 'positive']),
          },
          {
            label: 'Neutral',
            value: nestedNum(meta, ['sentimentNeutral', 'neutral']),
          },
          {
            label: 'Negative',
            value: nestedNum(meta, ['sentimentNegative', 'negative']),
          },
          {
            label: 'Emotional impact',
            value: nestedNum(meta, ['emotionalImpact']),
          },
        ],
        geographyBreakdown: [
          {
            label: row.geography?.trim() || 'Unspecified geography',
            value: regionalRelevance,
          },
          {
            label: 'Language coverage',
            value: nestedNum(meta, ['languageDemand', 'languages']),
          },
          {
            label: 'Time-zone reach',
            value: nestedNum(meta, ['timezoneReach']),
          },
        ],
        heatmaps: [
          {
            dimension: 'Profession',
            buckets: personas.map((item) => ({
              label: item.persona,
              value: item.match,
            })),
          },
          {
            dimension: 'Region',
            buckets: [
              {
                label: row.geography?.trim() || 'Unspecified',
                value: regionalRelevance,
              },
            ],
          },
          {
            dimension: 'Interest',
            buckets: [{ label: row.domain, value: audienceValueScore }],
          },
          {
            dimension: 'Age groups',
            buckets: [{ label: 'UNMEASURED', value: null }],
          },
          {
            dimension: 'Education level',
            buckets: [{ label: 'UNMEASURED', value: null }],
          },
          {
            dimension: 'Income',
            buckets: [{ label: 'UNMEASURED', value: null }],
          },
        ],
        optimization,
        lifecycle: [
          {
            key: 'idea',
            label: 'Idea',
            done: true,
            at: createdAt,
          },
          {
            key: 'analysis',
            label: 'Audience analysis',
            done: audienceValueScore != null,
            at: audienceValueScore != null ? updatedAt : null,
          },
          {
            key: 'segmentation',
            label: 'Segmentation',
            done: Boolean(row.audience?.trim()),
            at: row.audience?.trim() ? updatedAt : null,
          },
          {
            key: 'prediction',
            label: 'Prediction',
            done: engagementPotential != null || retentionScore != null,
            at:
              engagementPotential != null || retentionScore != null ? updatedAt : null,
          },
          {
            key: 'optimization',
            label: 'Optimization',
            done: valueStatus === 'NEEDS_OPTIMIZATION' || optimization.length > 1,
            at: updatedAt,
          },
          {
            key: 'approval',
            label: 'Approval',
            done: valueStatus === 'HIGH_VALUE',
            at: valueStatus === 'HIGH_VALUE' ? updatedAt : null,
          },
        ],
        factors,
        modelVersion: row.modelVersion,
        createdAt,
        updatedAt,
      };
    });

    const highValue = candidates.filter((item) => item.valueStatus === 'HIGH_VALUE').length;
    const needsOptimization = candidates.filter(
      (item) => item.valueStatus === 'NEEDS_OPTIMIZATION',
    ).length;
    const lowValue = candidates.filter((item) => item.valueStatus === 'LOW_VALUE').length;

    const audienceScores = candidates
      .map((item) => item.audienceValueScore)
      .filter((value): value is number => value != null);
    const educationalScores = candidates
      .map((item) => item.educationalValue)
      .filter((value): value is number => value != null);
    const commercialScores = candidates
      .map((item) => item.commercialAppeal)
      .filter((value): value is number => value != null);
    const accessibilityScores = candidates
      .map((item) => item.accessibilityScore)
      .filter((value): value is number => value != null);
    const retentionScores = candidates
      .map((item) => item.retentionScore)
      .filter((value): value is number => value != null);
    const diversityScores = candidates
      .map((item) => item.diversityScore)
      .filter((value): value is number => value != null);
    // Predicted reach / watch time / viral / satisfaction only from nested meta when present.
    const reachVals: number[] = [];
    const watchVals: number[] = [];
    const satisfactionVals: number[] = [];
    const viralVals: number[] = [];
    const coverageVals: number[] = [];
    for (const row of rows) {
      const meta = parseAudienceMeta(row.factorsJson);
      const r = nestedNum(meta, ['predictedReach', 'reach']);
      const w = nestedNum(meta, ['estimatedWatchTime', 'watchTime']);
      const s = nestedNum(meta, ['audienceSatisfaction', 'satisfaction']);
      const v = nestedNum(meta, ['viralPotential', 'virality']);
      const c = nestedNum(meta, ['globalCoverage', 'coverage']);
      if (r != null) reachVals.push(r);
      if (w != null) watchVals.push(w);
      if (s != null) satisfactionVals.push(s);
      if (v != null) viralVals.push(v);
      if (c != null) coverageVals.push(c);
    }
    const predictedReach = avg(reachVals);
    const estimatedWatchTime = avg(watchVals);
    const audienceSatisfaction = avg(satisfactionVals);
    const viralPotential = avg(viralVals);
    const globalCoverage = avg(coverageVals);

    const recommendations: AudienceValueOverview['recommendations'] = [];
    for (const item of candidates.slice(0, 12)) {
      recommendations.push({
        id: `av-${item.id}`,
        action: item.recommendation,
        reason: `${item.title} · ${item.valueStatus} · score ${item.audienceValueScore ?? 'UNMEAS.'}`,
        priority:
          item.valueStatus === 'HIGH_VALUE'
            ? 'HIGH'
            : item.valueStatus === 'LOW_VALUE'
              ? 'LOW'
              : 'MEDIUM',
        candidateId: item.id,
      });
      for (const tip of item.optimization.slice(0, 1)) {
        recommendations.push({
          id: `opt-${item.id}`,
          action: tip,
          reason: `Optimization for ${item.title}`,
          priority: 'MEDIUM',
          candidateId: item.id,
        });
      }
    }

    const notifications: AudienceValueOverview['notifications'] = [];
    for (const item of candidates.slice(0, 10)) {
      if (item.valueStatus === 'HIGH_VALUE') {
        notifications.push({
          id: `hi-${item.id}`,
          severity: 'INFO',
          message: `High audience value: ${item.title}`,
        });
      }
      if (item.valueStatus === 'LOW_VALUE') {
        notifications.push({
          id: `lo-${item.id}`,
          severity: 'WARNING',
          message: `Low audience value: ${item.title}`,
        });
      }
      if (item.valueStatus === 'NEEDS_OPTIMIZATION') {
        notifications.push({
          id: `optn-${item.id}`,
          severity: 'WARNING',
          message: `Audience optimization needed: ${item.title}`,
        });
      }
    }

    const modelVersions = [
      ...new Set(
        candidates
          .map((item) => item.modelVersion)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const hasScores = audienceScores.length > 0;
    const pipeline = [
      { key: 'identify', label: 'Audience Identification' },
      { key: 'segment', label: 'Segmentation' },
      { key: 'education', label: 'Educational Impact' },
      { key: 'commercial', label: 'Commercial Value' },
      { key: 'engagement', label: 'Engagement Prediction' },
      { key: 'access', label: 'Accessibility Review' },
      { key: 'score', label: 'Audience Value Score' },
      { key: 'approval', label: 'Approval' },
    ].map((item, index) => {
      let state: 'pending' | 'active' | 'done' | 'failed' = 'pending';
      if (lowValue > 0 && item.key === 'score') state = 'failed';
      else if (highValue > 0 && index <= 7) state = 'done';
      else if (hasScores && index <= 4) state = 'done';
      else if (hasScores && index === 5) state = 'active';
      else if (rows.length && index === 0) state = 'active';
      return { ...item, state };
    });

    const valueDistribution = [
      { label: 'HIGH_VALUE', count: highValue },
      { label: 'NEEDS_OPTIMIZATION', count: needsOptimization },
      { label: 'LOW_VALUE', count: lowValue },
      {
        label: 'PENDING',
        count: candidates.filter((item) => item.valueStatus === 'PENDING').length,
      },
    ];

    return {
      available: true,
      meta: {
        cycleStatus: cycles[0]?.status ?? 'NOT_STARTED',
        intakeStatus: intakes[0]?.status ?? null,
        modelVersions,
        audienceModelVersion: modelVersions[0] ?? null,
      },
      metrics: {
        averageAudienceValue: avg(audienceScores),
        predictedReach,
        estimatedWatchTime,
        audienceSatisfaction,
        educationalImpact: avg(educationalScores),
        commercialAppeal: avg(commercialScores),
        viralPotential,
        audienceDiversity: avg(diversityScores),
        accessibilityScore: avg(accessibilityScores),
        globalCoverage,
        audienceRetention: avg(retentionScores),
        recommendationScore: avg(audienceScores),
        totalCandidates: candidates.length,
        highValue,
        needsOptimization,
        lowValue,
      },
      pipeline,
      candidates,
      segmentDistribution: [...segmentCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      geographicCoverage: [...geoCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      recommendations,
      analytics: {
        valueDistribution,
        domainDemand: [...domainBuckets.entries()]
          .map(([label, scores]) => ({
            label,
            avgScore: avg(scores),
            count: scores.length,
          }))
          .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0)),
      },
      governance: {
        modelVersions,
        audienceModelVersion: modelVersions[0] ?? null,
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
          : 'Audience Value unavailable',
      meta: {
        cycleStatus: 'UNAVAILABLE',
        intakeStatus: null,
        modelVersions: [],
        audienceModelVersion: null,
      },
      metrics: {
        averageAudienceValue: null,
        predictedReach: null,
        estimatedWatchTime: null,
        audienceSatisfaction: null,
        educationalImpact: null,
        commercialAppeal: null,
        viralPotential: null,
        audienceDiversity: null,
        accessibilityScore: null,
        globalCoverage: null,
        audienceRetention: null,
        recommendationScore: null,
        totalCandidates: 0,
        highValue: 0,
        needsOptimization: 0,
        lowValue: 0,
      },
      pipeline: [],
      candidates: [],
      segmentDistribution: [],
      geographicCoverage: [],
      recommendations: [],
      analytics: { valueDistribution: [], domainDemand: [] },
      governance: {
        modelVersions: [],
        audienceModelVersion: null,
        decisionsLogged: 0,
        auditEvents: 0,
      },
      notifications: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
