import { prisma } from '@/lib/db';

export type PortfolioSlice = {
  key: string;
  label: string;
  count: number;
  share: number;
  status: 'balanced' | 'over' | 'under' | 'missing';
};

export type PortfolioRecommendation = {
  id: string;
  action: string;
  reason: string;
  dimension: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number | null;
  impact: string;
  estimatedRoi: number | null;
  relatedKeys: string[];
};

export type PortfolioCandidate = {
  id: string;
  title: string;
  domain: string;
  audience: string | null;
  geography: string | null;
  formatHint: string | null;
  status: string;
  score: number;
  measuredScore: boolean;
  confidence: number | null;
  riskScore: number | null;
  duplicateSimilarity: number | null;
  rankPosition: number | null;
  selectionStatus: string | null;
  portfolioFit: number | null;
  portfolioImpact: number | null;
  portfolioEffect: Record<string, unknown>;
  recommendation: 'approve' | 'delay' | 'replace' | 'reject';
  impactPreview: {
    topicShareAfter: number | null;
    audienceShareAfter: number | null;
    geographyShareAfter: number | null;
    healthDelta: number | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type PortfolioIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  dimension?: string;
};

export type PortfolioPipelineNode = {
  key: string;
  label: string;
  recordsProcessed: number;
  durationMs: number | null;
  aiConfidence: number | null;
  healthScore: number | null;
  queueDepth: number;
  lastUpdate: string | null;
  state: 'pending' | 'active' | 'done' | 'failed';
};

export type PortfolioBalanceOverview = {
  available: boolean;
  reason?: string;
  strategy?: {
    versionId: string;
    versionNumber: number;
    checksum: string;
    status: string;
  };
  run?: {
    id: string;
    status: string;
    startedAt: string;
    completedAt?: string | null;
    failureReason?: string | null;
  };
  meta: {
    portfolioHealth: number | null;
    balanceScore: number | null;
    diversityIndex: number | null;
    activePortfolioVersion: string | null;
    lastOptimization: string | null;
    aiModel: string | null;
    optimizationCycle: string | null;
    queueStatus: string;
  };
  metrics: {
    overallHealth: number | null;
    diversityScore: number | null;
    strategicCoverage: number | null;
    audienceCoverage: number | null;
    geographicCoverage: number | null;
    languageCoverage: number | null;
    documentaryBalance: number | null;
    productionCapacityUtilization: number | null;
    budgetAllocation: number | null;
    evergreenRatio: number | null;
    trendingRatio: number | null;
    commercialRatio: number | null;
    educationalRatio: number | null;
    historicalRatio: number | null;
    scientificRatio: number | null;
    riskDistribution: number | null;
    pendingRebalanceActions: number;
    totalCandidates: number;
    measuredScores: number;
  };
  diversity: {
    shannonTopic: number | null;
    shannonAudience: number | null;
    shannonGeography: number | null;
    shannonFormat: number | null;
    shannonStatus: number | null;
    topicEntropy: number | null;
    audienceEntropy: number | null;
    geographicEntropy: number | null;
    formatEntropy: number | null;
  };
  constraints: {
    maximumTopicPct: number;
    maximumCountryPct: number;
    maximumChannelPct: number;
    minimumDiversity: number;
    minimumEvergreen: number;
    maximumRisk: number;
    source: 'platform_defaults';
  };
  topics: PortfolioSlice[];
  geographies: PortfolioSlice[];
  audiences: PortfolioSlice[];
  formats: PortfolioSlice[];
  statuses: PortfolioSlice[];
  coverageMatrix: Array<{
    topic: string;
    region: string;
    count: number;
    share: number;
    priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  }>;
  pipeline: PortfolioPipelineNode[];
  recommendations: PortfolioRecommendation[];
  candidates: PortfolioCandidate[];
  issues: PortfolioIssue[];
  audit: Array<{
    id: string;
    action: string;
    actorType: string;
    createdAt: string;
    reason: string | null;
  }>;
  lastUpdated: string;
};

type PackageRow = {
  strategy_version_id: string;
  version_number: number;
  checksum: string;
  status: string;
};

type OpportunityRow = {
  id: string;
  title: string;
  domain: string;
  geography: string | null;
  audience: string | null;
  formatHint: string | null;
  status: string;
  score: number | string;
  confidence: number | string;
  riskScore: number | string | null;
  duplicateSimilarity: number | string | null;
  createdAt: Date;
  updatedAt: Date;
  rankPosition: number | string | null;
  selectionStatus: string | null;
  portfolioEffectJson: string | null;
  rankedAt: Date | null;
  totalScore: number | string | null;
  modelVersion: string | null;
};

function parseJson(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 10) / 10;
}

/** Shannon diversity H; optional normalize by ln(n) for 0–1 evenness. */
function shannon(counts: number[], normalize = true): number | null {
  const total = counts.reduce((sum, n) => sum + n, 0);
  if (total <= 0 || counts.length === 0) return null;
  let h = 0;
  for (const count of counts) {
    if (count <= 0) continue;
    const p = count / total;
    h -= p * Math.log(p);
  }
  if (!normalize) return Math.round(h * 1000) / 1000;
  const max = Math.log(counts.filter((c) => c > 0).length || 1);
  if (max <= 0) return 0;
  return Math.round((h / max) * 1000) / 1000;
}

function distribution(
  items: Array<string | null | undefined>,
  maxShare: number,
  minShare: number,
): PortfolioSlice[] {
  const total = items.length;
  const map = new Map<string, number>();
  for (const raw of items) {
    const key = (raw ?? '').trim() || 'Unspecified';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => {
      const share = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
      let status: PortfolioSlice['status'] = 'balanced';
      if (share >= maxShare) status = 'over';
      else if (share > 0 && share < minShare && map.size > 1) status = 'under';
      return { key, label: key, count, share, status };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function ratioForDomains(topics: PortfolioSlice[], needles: string[]): number | null {
  if (!topics.length) return null;
  const total = topics.reduce((sum, item) => sum + item.count, 0);
  if (!total) return null;
  const matched = topics
    .filter((item) => needles.some((needle) => item.label.toLowerCase().includes(needle)))
    .reduce((sum, item) => sum + item.count, 0);
  return Math.round((matched / total) * 1000) / 10;
}

function candidateAction(
  item: {
    selectionStatus: string | null;
    status: string;
    duplicateSimilarity: number | null;
    riskScore: number | null;
    domainShare: number;
    maxTopicPct: number;
  },
): PortfolioCandidate['recommendation'] {
  const selection = (item.selectionStatus ?? '').toUpperCase();
  const status = item.status.toUpperCase();
  if (status === 'REJECTED' || status === 'BLOCKED' || selection === 'REJECTED') return 'reject';
  if ((item.duplicateSimilarity ?? 0) >= 70) return 'replace';
  if (item.domainShare >= item.maxTopicPct || (item.riskScore ?? 0) >= 70) return 'delay';
  if (selection === 'SELECTED' || status === 'QUALIFIED' || status === 'HANDED_OFF') return 'approve';
  return 'approve';
}

export async function loadPortfolioBalance(): Promise<PortfolioBalanceOverview> {
  const constraints = {
    maximumTopicPct: 35,
    maximumCountryPct: 40,
    maximumChannelPct: 40,
    minimumDiversity: 0.55,
    minimumEvergreen: 20,
    maximumRisk: 30,
    source: 'platform_defaults' as const,
  };

  try {
    const packages = await prisma.$queryRaw<PackageRow[]>`
      SELECT TOP 1
        CONVERT(varchar(36), strategy_version_id) AS strategy_version_id,
        version_number,
        checksum,
        status
      FROM ci_strategy_packages
      WHERE status = 'ACKNOWLEDGED'
      ORDER BY acknowledged_at DESC
    `;

    const runs = await prisma.$queryRaw<
      Array<{
        id: string;
        status: string;
        started_at: Date | null;
        completed_at: Date | null;
        failure_reason: string | null;
      }>
    >`
      SELECT TOP 1
        CONVERT(varchar(36), id) AS id,
        status,
        started_at,
        completed_at,
        failure_reason
      FROM ci_discovery_runs
      ORDER BY created_at DESC
    `;

    const rows = await prisma.$queryRaw<OpportunityRow[]>`
      SELECT TOP 200
        CONVERT(varchar(36), o.id) AS id,
        o.title,
        o.domain,
        o.geography,
        o.audience,
        o.format_hint AS formatHint,
        o.status,
        o.score,
        o.confidence,
        o.risk_score AS riskScore,
        o.duplicate_similarity AS duplicateSimilarity,
        o.created_at AS createdAt,
        o.updated_at AS updatedAt,
        rk.rank_position AS rankPosition,
        rk.selection_status AS selectionStatus,
        rk.portfolio_effect_json AS portfolioEffectJson,
        rk.ranked_at AS rankedAt,
        (
          SELECT TOP 1 s.total_score
          FROM ci_scores s
          WHERE s.opportunity_id = o.id
          ORDER BY s.scored_at DESC
        ) AS totalScore,
        (
          SELECT TOP 1 s.model_version
          FROM ci_scores s
          WHERE s.opportunity_id = o.id
          ORDER BY s.scored_at DESC
        ) AS modelVersion
      FROM ci_opportunities o
      OUTER APPLY (
        SELECT TOP 1
          r.rank_position,
          r.selection_status,
          r.portfolio_effect_json,
          r.ranked_at
        FROM ci_rankings r
        WHERE r.opportunity_id = o.id
        ORDER BY r.ranked_at DESC
      ) rk
      WHERE o.status <> 'ARCHIVED'
      ORDER BY o.updated_at DESC
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
      SELECT TOP 24
        CONVERT(varchar(36), id) AS id,
        action,
        actor_type AS actorType,
        created_at AS createdAt,
        reason
      FROM ci_audit_events
      WHERE action LIKE 'DISCOVERY%'
         OR action LIKE 'STRATEGY_PACKAGE%'
         OR action LIKE '%RANK%'
         OR action LIKE '%SCORE%'
         OR action LIKE '%PORTFOLIO%'
         OR opportunity_id IS NOT NULL
      ORDER BY created_at DESC
    `;

    const topics = distribution(
      rows.map((row) => row.domain),
      constraints.maximumTopicPct,
      5,
    );
    const geographies = distribution(
      rows.map((row) => row.geography),
      constraints.maximumCountryPct,
      5,
    );
    const audiences = distribution(
      rows.map((row) => row.audience),
      constraints.maximumTopicPct,
      5,
    );
    const formats = distribution(
      rows.map((row) => row.formatHint),
      constraints.maximumChannelPct,
      5,
    );
    const statuses = distribution(
      rows.map((row) => row.status),
      60,
      5,
    );

    const topicCounts = topics.map((item) => item.count);
    const audienceCounts = audiences.map((item) => item.count);
    const geoCounts = geographies.map((item) => item.count);
    const formatCounts = formats.map((item) => item.count);
    const statusCounts = statuses.map((item) => item.count);

    const shannonTopic = shannon(topicCounts);
    const shannonAudience = shannon(audienceCounts);
    const shannonGeography = shannon(geoCounts);
    const shannonFormat = shannon(formatCounts);
    const shannonStatus = shannon(statusCounts);

    const diversityParts = [
      shannonTopic,
      shannonAudience,
      shannonGeography,
      shannonFormat,
    ].filter((value): value is number => value != null);
    const diversityScore =
      diversityParts.length > 0
        ? Math.round(avg(diversityParts.map((v) => v * 100))! )
        : null;

    const topicShareMap = new Map(topics.map((item) => [item.key, item.share]));
    const audienceShareMap = new Map(audiences.map((item) => [item.key, item.share]));
    const geoShareMap = new Map(geographies.map((item) => [item.key, item.share]));

    const candidates: PortfolioCandidate[] = rows.map((row) => {
      const portfolioEffect = parseJson(row.portfolioEffectJson);
      const score = numOrNull(row.totalScore) ?? Number(row.score) ?? 0;
      const measuredScore = Number.isFinite(score) && score > 0;
      const domainKey = row.domain?.trim() || 'Unspecified';
      const audienceKey = row.audience?.trim() || 'Unspecified';
      const geoKey = row.geography?.trim() || 'Unspecified';
      const domainShare = topicShareMap.get(domainKey) ?? 0;
      const recommendation = candidateAction({
        selectionStatus: row.selectionStatus,
        status: row.status,
        duplicateSimilarity:
          row.duplicateSimilarity != null ? Number(row.duplicateSimilarity) : null,
        riskScore: row.riskScore != null ? Number(row.riskScore) : null,
        domainShare,
        maxTopicPct: constraints.maximumTopicPct,
      });

      const healthDelta =
        recommendation === 'delay' || recommendation === 'replace' || recommendation === 'reject'
          ? 2
          : domainShare >= constraints.maximumTopicPct
            ? -3
            : 1;

      return {
        id: row.id,
        title: row.title,
        domain: row.domain,
        audience: row.audience,
        geography: row.geography,
        formatHint: row.formatHint,
        status: row.status,
        score,
        measuredScore,
        confidence: numOrNull(row.confidence),
        riskScore: row.riskScore != null ? Number(row.riskScore) : null,
        duplicateSimilarity:
          row.duplicateSimilarity != null ? Number(row.duplicateSimilarity) : null,
        rankPosition: row.rankPosition != null ? Number(row.rankPosition) : null,
        selectionStatus: row.selectionStatus,
        portfolioFit: numOrNull(
          portfolioEffect.portfolioFit ?? portfolioEffect.fit ?? portfolioEffect.balance,
        ),
        portfolioImpact: numOrNull(
          portfolioEffect.portfolioImpact ?? portfolioEffect.impact,
        ),
        portfolioEffect,
        recommendation,
        impactPreview: {
          topicShareAfter: topicShareMap.get(domainKey) ?? null,
          audienceShareAfter: audienceShareMap.get(audienceKey) ?? null,
          geographyShareAfter: geoShareMap.get(geoKey) ?? null,
          healthDelta,
        },
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });

    const coverageMatrix: PortfolioBalanceOverview['coverageMatrix'] = [];
    const matrixMap = new Map<string, number>();
    for (const row of rows) {
      const topic = row.domain?.trim() || 'Unspecified';
      const region = row.geography?.trim() || 'Unspecified';
      const key = `${topic}||${region}`;
      matrixMap.set(key, (matrixMap.get(key) ?? 0) + 1);
    }
    const matrixTotal = rows.length || 1;
    for (const [key, count] of matrixMap) {
      const [topic, region] = key.split('||');
      const share = Math.round((count / matrixTotal) * 1000) / 10;
      coverageMatrix.push({
        topic,
        region,
        count,
        share,
        priority:
          share >= constraints.maximumTopicPct
            ? 'HIGH'
            : share < 5
              ? 'MEDIUM'
              : count >= 2
                ? 'LOW'
                : 'NONE',
      });
    }
    coverageMatrix.sort((a, b) => b.count - a.count);

    const recommendations: PortfolioRecommendation[] = [];
    for (const topic of topics.filter((item) => item.status === 'over').slice(0, 5)) {
      recommendations.push({
        id: `reduce-topic-${topic.key}`,
        action: `Reduce duplicate / saturated “${topic.label}” documentaries`,
        reason: `Topic share ${topic.share}% exceeds maximum ${constraints.maximumTopicPct}%.`,
        dimension: 'topic',
        priority: 'HIGH',
        confidence: shannonTopic != null ? Math.round(shannonTopic * 100) : null,
        impact: `Lower ${topic.label} concentration toward balanced share`,
        estimatedRoi: null,
        relatedKeys: [topic.key],
      });
    }
    for (const topic of topics.filter((item) => item.status === 'under').slice(0, 5)) {
      recommendations.push({
        id: `increase-topic-${topic.key}`,
        action: `Increase coverage for “${topic.label}”`,
        reason: `Topic share ${topic.share}% is under-represented relative to the portfolio.`,
        dimension: 'topic',
        priority: 'MEDIUM',
        confidence: shannonTopic != null ? Math.round(shannonTopic * 100) : null,
        impact: `Improve topic diversity and strategic coverage`,
        estimatedRoi: null,
        relatedKeys: [topic.key],
      });
    }
    for (const geo of geographies.filter((item) => item.status === 'over').slice(0, 4)) {
      recommendations.push({
        id: `geo-over-${geo.key}`,
        action: `Reduce regional bias toward “${geo.label}”`,
        reason: `Geographic share ${geo.share}% exceeds maximum ${constraints.maximumCountryPct}%.`,
        dimension: 'geography',
        priority: 'HIGH',
        confidence: shannonGeography != null ? Math.round(shannonGeography * 100) : null,
        impact: 'Improve geographic coverage balance',
        estimatedRoi: null,
        relatedKeys: [geo.key],
      });
    }
    for (const geo of geographies.filter((item) => item.status === 'under' || item.label === 'Unspecified').slice(0, 4)) {
      recommendations.push({
        id: `geo-under-${geo.key}`,
        action:
          geo.label === 'Unspecified'
            ? 'Assign geography on underspecified candidates'
            : `Increase coverage for “${geo.label}”`,
        reason:
          geo.label === 'Unspecified'
            ? `${geo.count} candidates lack geography attribution.`
            : `Region share ${geo.share}% is under-represented.`,
        dimension: 'geography',
        priority: geo.label === 'Unspecified' ? 'MEDIUM' : 'HIGH',
        confidence: shannonGeography != null ? Math.round(shannonGeography * 100) : null,
        impact: 'Expand regional representation',
        estimatedRoi: null,
        relatedKeys: [geo.key],
      });
    }
    for (const audience of audiences.filter((item) => item.status === 'under').slice(0, 4)) {
      recommendations.push({
        id: `aud-${audience.key}`,
        action: `Expand content for audience “${audience.label}”`,
        reason: `Audience share ${audience.share}% is under-served.`,
        dimension: 'audience',
        priority: 'MEDIUM',
        confidence: shannonAudience != null ? Math.round(shannonAudience * 100) : null,
        impact: 'Improve audience coverage',
        estimatedRoi: null,
        relatedKeys: [audience.key],
      });
    }
    for (const format of formats.filter((item) => item.status === 'over').slice(0, 3)) {
      recommendations.push({
        id: `fmt-${format.key}`,
        action: `Diversify away from format “${format.label}”`,
        reason: `Format share ${format.share}% exceeds concentration limit.`,
        dimension: 'format',
        priority: 'MEDIUM',
        confidence: shannonFormat != null ? Math.round(shannonFormat * 100) : null,
        impact: 'Improve documentary / format balance',
        estimatedRoi: null,
        relatedKeys: [format.key],
      });
    }

    const portfolioFits = candidates
      .map((item) => item.portfolioFit)
      .filter((value): value is number => value != null);
    const risks = candidates
      .map((item) => item.riskScore)
      .filter((value): value is number => value != null);
    const measuredScores = candidates.filter((item) => item.measuredScore).length;

    const strategicCoverage =
      topics.length > 0
        ? Math.round((topics.filter((item) => item.status !== 'missing').length / Math.max(1, topics.length)) * 100)
        : null;
    const audienceCoverage =
      audiences.filter((item) => item.label !== 'Unspecified').length > 0
        ? Math.round(
            (audiences.filter((item) => item.label !== 'Unspecified').reduce((s, i) => s + i.count, 0) /
              Math.max(1, rows.length)) *
              100,
          )
        : null;
    const geographicCoverage =
      geographies.filter((item) => item.label !== 'Unspecified').length > 0
        ? Math.round(
            (geographies.filter((item) => item.label !== 'Unspecified').reduce((s, i) => s + i.count, 0) /
              Math.max(1, rows.length)) *
              100,
          )
        : null;

    const balanceScore = diversityScore;
    const overallHealth =
      balanceScore != null
        ? Math.round(
            (balanceScore * 0.6 +
              (strategicCoverage ?? 0) * 0.15 +
              (audienceCoverage ?? 0) * 0.15 +
              (geographicCoverage ?? 0) * 0.1) *
              10,
          ) / 10
        : null;

    const pendingRebalanceActions = recommendations.filter(
      (item) => item.priority === 'HIGH' || item.priority === 'MEDIUM',
    ).length;

    const issues: PortfolioIssue[] = [];
    for (const topic of topics.filter((item) => item.status === 'over')) {
      issues.push({
        id: `sat-${topic.key}`,
        severity: 'WARNING',
        code: 'TOPIC_SATURATION',
        message: `Topic saturation: “${topic.label}” at ${topic.share}%.`,
        dimension: 'topic',
      });
    }
    for (const geo of geographies.filter((item) => item.status === 'over')) {
      issues.push({
        id: `geo-${geo.key}`,
        severity: 'WARNING',
        code: 'COUNTRY_SATURATION',
        message: `Geographic saturation: “${geo.label}” at ${geo.share}%.`,
        dimension: 'geography',
      });
    }
    if (audiences.some((item) => item.label === 'Unspecified' && item.share >= 30)) {
      issues.push({
        id: 'aud-missing',
        severity: 'WARNING',
        code: 'AUDIENCE_NEGLECTED',
        message: 'Large share of candidates lack audience attribution.',
        dimension: 'audience',
      });
    }
    if (
      diversityScore != null &&
      diversityScore / 100 < constraints.minimumDiversity
    ) {
      issues.push({
        id: 'div-low',
        severity: 'CRITICAL',
        code: 'LOW_DIVERSITY',
        message: `Diversity score ${diversityScore} is below minimum ${(constraints.minimumDiversity * 100).toFixed(0)}.`,
        dimension: 'diversity',
      });
    }
    if (pendingRebalanceActions === 0 && rows.length > 0) {
      issues.push({
        id: 'healthy',
        severity: 'INFO',
        code: 'PORTFOLIO_HEALTHY',
        message: 'No high/medium rebalance actions from current persisted portfolio.',
        dimension: 'health',
      });
    }

    const packageRow = packages[0];
    const run = runs[0];
    const runStatus = run?.status ?? 'IDLE';
    const lastOptimization =
      rows
        .map((row) => row.rankedAt?.toISOString() ?? row.updatedAt.toISOString())
        .sort()
        .at(-1) ?? null;
    const modelVersions = [
      ...new Set(rows.map((row) => row.modelVersion).filter(Boolean) as string[]),
    ];

    const qualified = candidates.filter(
      (item) =>
        item.selectionStatus?.toUpperCase() === 'SELECTED' ||
        item.status === 'QUALIFIED' ||
        item.measuredScore,
    ).length;

    const pipelineBase: Array<Omit<PortfolioPipelineNode, 'state'>> = [
      {
        key: 'qualified',
        label: 'Qualified Candidates',
        recordsProcessed: qualified,
        durationMs: null,
        aiConfidence: avg(
          candidates
            .map((item) => item.confidence)
            .filter((value): value is number => value != null && value >= 1),
        ),
        healthScore: overallHealth,
        queueDepth: candidates.length,
        lastUpdate: lastOptimization,
      },
      {
        key: 'analysis',
        label: 'Portfolio Analysis',
        recordsProcessed: candidates.length,
        durationMs: null,
        aiConfidence: diversityScore,
        healthScore: overallHealth,
        queueDepth: topics.length,
        lastUpdate: lastOptimization,
      },
      {
        key: 'coverage',
        label: 'Coverage Evaluation',
        recordsProcessed: coverageMatrix.length,
        durationMs: null,
        aiConfidence: geographicCoverage,
        healthScore: geographicCoverage,
        queueDepth: geographies.filter((item) => item.status === 'under').length,
        lastUpdate: lastOptimization,
      },
      {
        key: 'diversity',
        label: 'Diversity Analysis',
        recordsProcessed: diversityParts.length,
        durationMs: null,
        aiConfidence: diversityScore,
        healthScore: diversityScore,
        queueDepth: pendingRebalanceActions,
        lastUpdate: lastOptimization,
      },
      {
        key: 'gaps',
        label: 'Strategic Gap Detection',
        recordsProcessed: recommendations.length,
        durationMs: null,
        aiConfidence: diversityScore,
        healthScore: strategicCoverage,
        queueDepth: topics.filter((item) => item.status === 'under').length,
        lastUpdate: lastOptimization,
      },
      {
        key: 'capacity',
        label: 'Capacity Planning',
        recordsProcessed: 0,
        durationMs: null,
        aiConfidence: null,
        healthScore: null,
        queueDepth: 0,
        lastUpdate: null,
      },
      {
        key: 'budget',
        label: 'Budget Optimization',
        recordsProcessed: 0,
        durationMs: null,
        aiConfidence: null,
        healthScore: null,
        queueDepth: 0,
        lastUpdate: null,
      },
      {
        key: 'risk',
        label: 'Risk Balancing',
        recordsProcessed: risks.length,
        durationMs: null,
        aiConfidence: avg(risks),
        healthScore: risks.length ? Math.max(0, 100 - (avg(risks) ?? 0)) : null,
        queueDepth: risks.filter((value) => value >= constraints.maximumRisk).length,
        lastUpdate: lastOptimization,
      },
      {
        key: 'audience',
        label: 'Audience Optimization',
        recordsProcessed: audiences.length,
        durationMs: null,
        aiConfidence: audienceCoverage,
        healthScore: audienceCoverage,
        queueDepth: audiences.filter((item) => item.status === 'under').length,
        lastUpdate: lastOptimization,
      },
      {
        key: 'final',
        label: 'Final Portfolio',
        recordsProcessed: candidates.filter((item) => item.recommendation === 'approve').length,
        durationMs: null,
        aiConfidence: avg(portfolioFits),
        healthScore: overallHealth,
        queueDepth: pendingRebalanceActions,
        lastUpdate: lastOptimization,
      },
    ];

    const activeIndex = !packageRow
      ? -1
      : candidates.length === 0
        ? 0
        : pendingRebalanceActions > 0
          ? 4
          : 9;
    const pipeline: PortfolioPipelineNode[] = pipelineBase.map((node, index) => ({
      ...node,
      state:
        runStatus === 'FAILED' && index === Math.max(0, activeIndex)
          ? 'failed'
          : activeIndex < 0
            ? 'pending'
            : index < activeIndex
              ? 'done'
              : index === activeIndex
                ? 'active'
                : 'pending',
    }));

    return {
      available: true,
      strategy: packageRow
        ? {
            versionId: packageRow.strategy_version_id,
            versionNumber: Number(packageRow.version_number),
            checksum: packageRow.checksum,
            status: packageRow.status,
          }
        : undefined,
      run: run
        ? {
            id: run.id,
            status: run.status,
            startedAt: run.started_at?.toISOString() ?? new Date(0).toISOString(),
            completedAt: run.completed_at?.toISOString() ?? null,
            failureReason: run.failure_reason,
          }
        : undefined,
      meta: {
        portfolioHealth: overallHealth,
        balanceScore,
        diversityIndex: shannonTopic != null ? Math.round(shannonTopic * 1000) / 1000 : null,
        activePortfolioVersion: packageRow
          ? `strategy-v${packageRow.version_number}`
          : null,
        lastOptimization,
        aiModel: modelVersions[0] ?? null,
        optimizationCycle: run?.id ?? null,
        queueStatus: pendingRebalanceActions
          ? `${pendingRebalanceActions} rebalance actions`
          : candidates.length
            ? 'Balanced'
            : packageRow
              ? 'Idle'
              : 'Blocked',
      },
      metrics: {
        overallHealth,
        diversityScore,
        strategicCoverage,
        audienceCoverage,
        geographicCoverage,
        languageCoverage: null,
        documentaryBalance: shannonFormat != null ? Math.round(shannonFormat * 100) : null,
        productionCapacityUtilization: null,
        budgetAllocation: null,
        evergreenRatio: ratioForDomains(topics, ['evergreen', 'history', 'education']),
        trendingRatio: ratioForDomains(topics, ['trend', 'ai', 'tech', 'climate']),
        commercialRatio: ratioForDomains(topics, ['business', 'commercial', 'finance', 'econom']),
        educationalRatio: ratioForDomains(topics, ['education', 'learning', 'training']),
        historicalRatio: ratioForDomains(topics, ['history', 'historical', 'biography']),
        scientificRatio: ratioForDomains(topics, ['science', 'scientific', 'medicine', 'research']),
        riskDistribution: avg(risks),
        pendingRebalanceActions,
        totalCandidates: candidates.length,
        measuredScores,
      },
      diversity: {
        shannonTopic,
        shannonAudience,
        shannonGeography,
        shannonFormat,
        shannonStatus,
        topicEntropy: shannon(topicCounts, false),
        audienceEntropy: shannon(audienceCounts, false),
        geographicEntropy: shannon(geoCounts, false),
        formatEntropy: shannon(formatCounts, false),
      },
      constraints,
      topics,
      geographies,
      audiences,
      formats,
      statuses,
      coverageMatrix: coverageMatrix.slice(0, 80),
      pipeline,
      recommendations: recommendations.slice(0, 40),
      candidates,
      issues: issues.slice(0, 40),
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
          : 'Portfolio balance unavailable. Run the Content Intelligence migration.',
      meta: {
        portfolioHealth: null,
        balanceScore: null,
        diversityIndex: null,
        activePortfolioVersion: null,
        lastOptimization: null,
        aiModel: null,
        optimizationCycle: null,
        queueStatus: 'Unavailable',
      },
      metrics: {
        overallHealth: null,
        diversityScore: null,
        strategicCoverage: null,
        audienceCoverage: null,
        geographicCoverage: null,
        languageCoverage: null,
        documentaryBalance: null,
        productionCapacityUtilization: null,
        budgetAllocation: null,
        evergreenRatio: null,
        trendingRatio: null,
        commercialRatio: null,
        educationalRatio: null,
        historicalRatio: null,
        scientificRatio: null,
        riskDistribution: null,
        pendingRebalanceActions: 0,
        totalCandidates: 0,
        measuredScores: 0,
      },
      diversity: {
        shannonTopic: null,
        shannonAudience: null,
        shannonGeography: null,
        shannonFormat: null,
        shannonStatus: null,
        topicEntropy: null,
        audienceEntropy: null,
        geographicEntropy: null,
        formatEntropy: null,
      },
      constraints,
      topics: [],
      geographies: [],
      audiences: [],
      formats: [],
      statuses: [],
      coverageMatrix: [],
      pipeline: [],
      recommendations: [],
      candidates: [],
      issues: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
