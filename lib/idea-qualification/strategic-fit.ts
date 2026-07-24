import { prisma } from '@/lib/db';
import { OBJECTIVES_POLICY } from '@/lib/strategy/objectives-policy';
import type { FactorScores } from './contracts';

export type StrategicFitCandidate = {
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
  strategicScore: number | null;
  brandAlignment: number | null;
  audienceAlignment: number | null;
  commercialValue: number | null;
  portfolioNeed: number | null;
  riskScore: number | null;
  productionFeasibility: number | null;
  educationalValue: number | null;
  originality: number | null;
  confidence: number | null;
  measuredConfidence: boolean;
  fitStatus: 'APPROVED' | 'NEEDS_REVIEW' | 'REJECTED' | 'PENDING';
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMEASURED';
  opportunityValue: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMEASURED';
  recommendation: string;
  explainability: string[];
  aiSummary: string;
  strategyMatches: Array<{ label: string; match: number | null; status: string }>;
  objectiveAlignment: Array<{ objective: string; match: number | null }>;
  audienceBreakdown: Array<{ label: string; value: number | null }>;
  brandChecks: Array<{ label: string; status: string; detail: string }>;
  commercial: Array<{ label: string; value: string | null }>;
  risks: Array<{ category: string; severity: string; score: number }>;
  production: Array<{ label: string; value: string | null }>;
  lifecycle: Array<{ key: string; label: string; done: boolean; at: string | null }>;
  factors: Partial<FactorScores> | null;
  modelVersion: string | null;
  strategyVersionId: string | null;
  strategyVersionNumber: number | null;
  createdAt: string;
  updatedAt: string;
};

export type StrategicFitOverview = {
  available: boolean;
  reason?: string;
  meta: {
    cycleStatus: string;
    intakeStatus: string | null;
    strategyVersionId: string | null;
    strategyVersionNumber: number | null;
    strategyChecksum: string | null;
    strategyThemes: string[];
  };
  metrics: {
    totalCandidates: number;
    strategyApproved: number;
    needsReview: number;
    rejected: number;
    averageStrategicScore: number | null;
    commercialPotential: number | null;
    audienceAlignment: number | null;
    brandAlignment: number | null;
    portfolioCoverage: number | null;
    estimatedRoi: number | null;
    productionPriorityHigh: number;
    executiveApprovalRate: number | null;
  };
  pipeline: Array<{
    key: string;
    label: string;
    state: 'pending' | 'active' | 'done' | 'failed';
  }>;
  candidates: StrategicFitCandidate[];
  portfolioHeatmap: Array<{ label: string; count: number; sharePct: number }>;
  portfolioGaps: Array<{ label: string; sharePct: number; recommendation: string }>;
  geographicCoverage: Array<{ label: string; count: number }>;
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    candidateId?: string;
  }>;
  governance: {
    strategyPackageVersion: string | null;
    modelVersions: string[];
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

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
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
    const keys: Array<keyof FactorScores> = [
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
    ];
    for (const key of keys) {
      const value = num(parsed[key]);
      if (value != null) out[key] = value;
    }
    return out;
  } catch {
    return null;
  }
}

function parseThemes(packageJson: string | null): string[] {
  if (!packageJson) return [];
  try {
    const parsed = JSON.parse(packageJson) as Record<string, unknown>;
    const buckets = [
      parsed.themes,
      parsed.priorities,
      parsed.focusAreas,
      parsed.fields,
      parsed.domains,
    ];
    const themes: string[] = [];
    for (const bucket of buckets) {
      if (Array.isArray(bucket)) {
        for (const item of bucket) {
          if (typeof item === 'string' && item.trim()) themes.push(item.trim());
          else if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>;
            const name =
              typeof obj.name === 'string'
                ? obj.name
                : typeof obj.label === 'string'
                  ? obj.label
                  : typeof obj.title === 'string'
                    ? obj.title
                    : null;
            if (name) themes.push(name);
          }
        }
      }
    }
    return [...new Set(themes)].slice(0, 12);
  } catch {
    return [];
  }
}

function themeMatch(domain: string, themes: string[]): number | null {
  if (!themes.length) return null;
  const hay = domain.toLowerCase();
  const hits = themes.filter((theme) => {
    const t = theme.toLowerCase();
    return hay.includes(t) || t.includes(hay) || hay.split(/\s+/).some((part) => t.includes(part));
  });
  if (!hits.length) return Math.max(20, 100 - themes.length * 5);
  return Math.min(99, 70 + hits.length * 10);
}

function fitStatusFrom(score: number | null, gateStatus: string, decision: string | null, candidateStatus: string): StrategicFitCandidate['fitStatus'] {
  if (decision === 'REJECT' || candidateStatus === 'REJECTED') return 'REJECTED';
  if (decision === 'QUALIFY' || candidateStatus === 'QUALIFIED' || candidateStatus === 'SELECTED') {
    return 'APPROVED';
  }
  if (gateStatus === 'FAILED' || candidateStatus === 'BLOCKED') return 'NEEDS_REVIEW';
  if (score == null) return 'PENDING';
  if (score >= 85) return 'APPROVED';
  if (score >= 65) return 'NEEDS_REVIEW';
  return 'REJECTED';
}

function recommendationFor(status: StrategicFitCandidate['fitStatus'], portfolioNeed: number | null): string {
  if (status === 'APPROVED' && (portfolioNeed == null || portfolioNeed >= 70)) {
    return 'Approve Immediately';
  }
  if (status === 'APPROVED') return 'Research Further';
  if (status === 'NEEDS_REVIEW') return 'Escalate to Editorial Board';
  if (status === 'REJECTED') return 'Reject';
  return 'Delay';
}

function opportunityValue(commercial: number | null, strategic: number | null): StrategicFitCandidate['opportunityValue'] {
  const score = avg([commercial, strategic].filter((v): v is number => v != null));
  if (score == null) return 'UNMEASURED';
  if (score >= 85) return 'HIGH';
  if (score >= 65) return 'MEDIUM';
  return 'LOW';
}

export async function loadStrategicFit(): Promise<StrategicFitOverview> {
  try {
    const intakes = await prisma.$queryRaw<
      Array<{
        status: string;
        strategyVersionId: string;
        checksum: string;
        packageJson: string | null;
        versionNumber: number | bigint | null;
      }>
    >`
      SELECT TOP 1
        i.status,
        CONVERT(varchar(36), i.strategy_version_id) AS strategyVersionId,
        i.checksum,
        p.package_json AS packageJson,
        p.version_number AS versionNumber
      FROM iq_intake_packages i
      OUTER APPLY (
        SELECT TOP 1 package_json, version_number
        FROM ci_strategy_packages pkg
        WHERE pkg.strategy_version_id = i.strategy_version_id
          AND pkg.status = 'ACKNOWLEDGED'
        ORDER BY pkg.acknowledged_at DESC
      ) p
      WHERE i.status = 'ACKNOWLEDGED'
      ORDER BY i.acknowledged_at DESC
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
        strategyVersionId: string | null;
        strategyVersionNumber: number | bigint | null;
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
        CONVERT(varchar(36), i.strategy_version_id) AS strategyVersionId,
        sp.version_number AS strategyVersionNumber
      FROM iq_candidates c
      INNER JOIN iq_cycles cy ON cy.id = c.cycle_id
      LEFT JOIN iq_intake_packages i ON i.id = cy.intake_package_id
      OUTER APPLY (
        SELECT TOP 1 version_number
        FROM ci_strategy_packages pkg
        WHERE pkg.strategy_version_id = i.strategy_version_id
        ORDER BY pkg.acknowledged_at DESC
      ) sp
      OUTER APPLY (
        SELECT TOP 1 *
        FROM iq_scores sc
        WHERE sc.candidate_id = c.id
        ORDER BY sc.scored_at DESC
      ) s
      ORDER BY
        COALESCE(
          TRY_CONVERT(float, JSON_VALUE(s.factors_json, '$.strategicFit')),
          s.total_score,
          c.score
        ) DESC,
        c.updated_at DESC
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
      WHERE action LIKE '%STRATEG%'
         OR action LIKE '%SCORE%'
         OR action LIKE '%DECISION%'
         OR action LIKE '%GATE%'
         OR action LIKE '%QUALIF%'
      ORDER BY created_at DESC
    `;

    const intake = intakes[0];
    const themes = parseThemes(intake?.packageJson ?? null);
    const policyObjectives = OBJECTIVES_POLICY.filter((item) => item.status === 'ACTIVE').slice(
      0,
      8,
    );

    const risksByCandidate = new Map<string, Array<{ category: string; severity: string; score: number }>>();
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

    const domainCounts = new Map<string, number>();
    for (const row of rows) {
      domainCounts.set(row.domain, (domainCounts.get(row.domain) ?? 0) + 1);
    }
    const totalForShare = Math.max(1, rows.length);

    const candidates: StrategicFitCandidate[] = rows.map((row) => {
      const factors = parseFactors(row.factorsJson);
      const strategicScore = factors?.strategicFit ?? num(row.totalScore);
      const audienceAlignment = factors?.audienceValue ?? null;
      const brandAlignment =
        factors?.educationalValue != null || factors?.strategicFit != null
          ? avg(
              [factors?.educationalValue, factors?.strategicFit].filter(
                (v): v is number => v != null,
              ),
            )
          : null;
      const commercialValue = factors?.audienceValue ?? null;
      const domainShare = ((domainCounts.get(row.domain) ?? 0) / totalForShare) * 100;
      const portfolioNeed =
        strategicScore == null
          ? null
          : Math.max(0, Math.min(100, Math.round(100 - domainShare + (strategicScore - 50) / 5)));
      const riskScore =
        avg((risksByCandidate.get(row.id) ?? []).map((item) => item.score)) ??
        factors?.risk ??
        null;
      const productionFeasibility = factors?.feasibility ?? null;
      const confidence = num(row.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;
      const fitStatus = fitStatusFrom(
        strategicScore,
        row.gateStatus,
        row.decision,
        row.status,
      );
      const priority: StrategicFitCandidate['priority'] =
        strategicScore == null
          ? 'UNMEASURED'
          : strategicScore >= 90
            ? 'HIGH'
            : strategicScore >= 75
              ? 'MEDIUM'
              : 'LOW';

      const strategyMatches =
        themes.length > 0
          ? themes.slice(0, 6).map((label) => {
              const match = themeMatch(row.domain, [label]);
              return {
                label,
                match,
                status: match != null && match >= 80 ? 'MATCH' : match != null ? 'PARTIAL' : 'UNMEASURED',
              };
            })
          : [
              {
                label: row.domain,
                match: strategicScore,
                status: strategicScore != null ? 'MATCH' : 'UNMEASURED',
              },
            ];

      const objectiveAlignment = policyObjectives.map((objective) => {
        const fields = (objective.configuration.applicableFields as string[] | undefined) ?? [];
        const match =
          fields.length > 0
            ? themeMatch(row.domain, fields)
            : strategicScore != null
              ? Math.round((strategicScore + (objective.priority ?? 50)) / 2)
              : null;
        return { objective: objective.name, match };
      });

      const explainability: string[] = [];
      if (strategicScore != null) explainability.push(`Strategic score ${strategicScore}%`);
      if (themes.length) {
        explainability.push(`Compared against ${themes.length} strategy package themes`);
      }
      if (audienceAlignment != null) {
        explainability.push(`Audience alignment ${audienceAlignment}%`);
      }
      if (commercialValue != null) {
        explainability.push(`Commercial potential ${commercialValue}%`);
      }
      if (portfolioNeed != null) {
        explainability.push(
          portfolioNeed >= 70
            ? `Portfolio underrepresented for ${row.domain}`
            : `Portfolio already covers ${row.domain} (${Math.round(domainShare)}%)`,
        );
      }
      if (riskScore != null) {
        explainability.push(
          riskScore <= 30 ? `Low measured risk (${riskScore})` : `Elevated risk (${riskScore})`,
        );
      }
      if (productionFeasibility != null) {
        explainability.push(`Production feasibility ${productionFeasibility}%`);
      }
      if (!explainability.length) {
        explainability.push('No strategic factor scores persisted yet for this candidate');
      }

      const recommendation = recommendationFor(fitStatus, portfolioNeed);
      const createdAt = row.createdAt.toISOString();
      const updatedAt = row.updatedAt.toISOString();

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
        strategicScore,
        brandAlignment,
        audienceAlignment,
        commercialValue,
        portfolioNeed,
        riskScore,
        productionFeasibility,
        educationalValue: factors?.educationalValue ?? null,
        originality: factors?.originality ?? null,
        confidence,
        measuredConfidence,
        fitStatus,
        priority,
        opportunityValue: opportunityValue(commercialValue, strategicScore),
        recommendation,
        explainability,
        aiSummary:
          strategicScore != null
            ? `${row.title} scores ${strategicScore}% strategic fit against the active strategy package. ${recommendation}. Domain ${row.domain} currently represents ${Math.round(domainShare)}% of the candidate pool.`
            : `${row.title} awaits persisted strategicFit scoring from the qualification cycle.`,
        strategyMatches,
        objectiveAlignment,
        audienceBreakdown: [
          { label: 'Target audience', value: audienceAlignment },
          { label: 'Geography', value: factors?.regionalRelevance ?? null },
          { label: 'Platform suitability', value: null },
          { label: 'Engagement likelihood', value: null },
        ],
        brandChecks: [
          {
            label: 'Editorial / educational standards',
            status: factors?.educationalValue != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              factors?.educationalValue != null
                ? `Educational value ${factors.educationalValue}`
                : 'No educational factor persisted',
          },
          {
            label: 'Mission / vision alignment',
            status: strategicScore != null ? 'EVALUATED' : 'UNMEASURED',
            detail: strategicScore != null ? `Via strategicFit ${strategicScore}` : 'Pending',
          },
          {
            label: 'Tone / corporate positioning',
            status: 'UNMEASURED',
            detail: 'No brand tone payload on iq_scores',
          },
        ],
        commercial: [
          {
            label: 'Commercial potential',
            value: commercialValue != null ? `${commercialValue}` : null,
          },
          { label: 'Sponsorship', value: null },
          { label: 'Licensing', value: null },
          {
            label: 'Educational value',
            value: factors?.educationalValue != null ? `${factors.educationalValue}` : null,
          },
          { label: 'Distribution opportunity', value: row.formatHint },
          {
            label: 'Evergreen value',
            value: factors?.timeliness != null ? `${factors.timeliness}` : null,
          },
          { label: 'Estimated ROI', value: null },
        ],
        risks: risksByCandidate.get(row.id) ?? [],
        production: [
          {
            label: 'Feasibility',
            value: productionFeasibility != null ? `${productionFeasibility}` : null,
          },
          {
            label: 'Source availability',
            value:
              factors?.sourceAvailability != null ? `${factors.sourceAvailability}` : null,
          },
          {
            label: 'Visual potential',
            value: factors?.visualPotential != null ? `${factors.visualPotential}` : null,
          },
          { label: 'Experts / archive / interviews', value: null },
          { label: 'Budget readiness', value: null },
        ],
        lifecycle: [
          { key: 'received', label: 'Idea Received', done: true, at: createdAt },
          {
            key: 'evidence',
            label: 'Evidence Validated',
            done: factors?.evidence != null,
            at: factors?.evidence != null ? updatedAt : null,
          },
          {
            key: 'strategy',
            label: 'Strategy Checked',
            done: strategicScore != null,
            at: strategicScore != null ? updatedAt : null,
          },
          {
            key: 'review',
            label: 'Executive Review',
            done: fitStatus === 'NEEDS_REVIEW' || fitStatus === 'APPROVED',
            at: fitStatus !== 'PENDING' ? updatedAt : null,
          },
          {
            key: 'approved',
            label: 'Approved',
            done: fitStatus === 'APPROVED',
            at: fitStatus === 'APPROVED' ? updatedAt : null,
          },
          {
            key: 'research',
            label: 'Research',
            done: row.status === 'SELECTED' || row.status === 'HANDED_OFF',
            at:
              row.status === 'SELECTED' || row.status === 'HANDED_OFF' ? updatedAt : null,
          },
        ],
        factors,
        modelVersion: row.modelVersion,
        strategyVersionId: row.strategyVersionId,
        strategyVersionNumber:
          row.strategyVersionNumber != null ? Number(row.strategyVersionNumber) : null,
        createdAt,
        updatedAt,
      };
    });

    const strategyApproved = candidates.filter((item) => item.fitStatus === 'APPROVED').length;
    const needsReview = candidates.filter((item) => item.fitStatus === 'NEEDS_REVIEW').length;
    const rejected = candidates.filter((item) => item.fitStatus === 'REJECTED').length;
    const productionPriorityHigh = candidates.filter((item) => item.priority === 'HIGH').length;

    const portfolioHeatmap = [...domainCounts.entries()]
      .map(([label, count]) => ({
        label,
        count,
        sharePct: Math.round((count / totalForShare) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const portfolioGaps = portfolioHeatmap
      .filter((item) => item.sharePct <= 15)
      .slice(0, 6)
      .map((item) => ({
        label: item.label,
        sharePct: item.sharePct,
        recommendation: `Increase ${item.label} documentaries`,
      }));

    const geoCounts = new Map<string, number>();
    for (const item of candidates) {
      const key = item.geography?.trim() || 'UNMEASURED';
      geoCounts.set(key, (geoCounts.get(key) ?? 0) + 1);
    }

    const recommendations: StrategicFitOverview['recommendations'] = [];
    for (const item of candidates.slice(0, 12)) {
      recommendations.push({
        id: `sf-${item.id}`,
        action: item.recommendation,
        reason: `${item.title} · ${item.fitStatus} · score ${item.strategicScore ?? 'UNMEAS.'}`,
        priority:
          item.recommendation === 'Approve Immediately'
            ? 'HIGH'
            : item.recommendation === 'Reject'
              ? 'LOW'
              : 'MEDIUM',
        candidateId: item.id,
      });
    }
    for (const gap of portfolioGaps.slice(0, 3)) {
      recommendations.push({
        id: `gap-${gap.label}`,
        action: 'Increase underrepresented category',
        reason: gap.recommendation,
        priority: 'MEDIUM',
      });
    }

    const notifications: StrategicFitOverview['notifications'] = [];
    for (const item of candidates.slice(0, 10)) {
      if (item.fitStatus === 'APPROVED' && (item.strategicScore ?? 0) >= 90) {
        notifications.push({
          id: `ok-${item.id}`,
          severity: 'INFO',
          message: `High strategic fit: ${item.title}`,
        });
      }
      if (item.fitStatus === 'REJECTED') {
        notifications.push({
          id: `rej-${item.id}`,
          severity: 'WARNING',
          message: `Strategic reject / low fit: ${item.title}`,
        });
      }
      if (item.fitStatus === 'NEEDS_REVIEW') {
        notifications.push({
          id: `rev-${item.id}`,
          severity: 'WARNING',
          message: `Escalate strategic review: ${item.title}`,
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

    const hasScores = candidates.some((item) => item.strategicScore != null);
    const pipeline = [
      'objectives',
      'brand',
      'audience',
      'commercial',
      'portfolio',
      'risk',
      'production',
      'score',
      'research',
    ].map((key, index) => {
      const labels: Record<string, string> = {
        objectives: 'Strategic Objectives',
        brand: 'Brand Alignment',
        audience: 'Audience Alignment',
        commercial: 'Commercial Value',
        portfolio: 'Portfolio Balance',
        risk: 'Risk Assessment',
        production: 'Production Readiness',
        score: 'Strategic Fit Score',
        research: 'Research & Evidence',
      };
      let state: 'pending' | 'active' | 'done' | 'failed' = 'pending';
      if (rejected > 0 && key === 'score') state = 'failed';
      else if (strategyApproved > 0 && index <= 8) state = 'done';
      else if (hasScores && index <= 4) state = 'done';
      else if (hasScores && index === 5) state = 'active';
      else if (intake && index === 0) state = 'active';
      return { key, label: labels[key], state };
    });

    return {
      available: true,
      meta: {
        cycleStatus: cycles[0]?.status ?? 'NOT_STARTED',
        intakeStatus: intake?.status ?? null,
        strategyVersionId: intake?.strategyVersionId ?? null,
        strategyVersionNumber:
          intake?.versionNumber != null ? Number(intake.versionNumber) : null,
        strategyChecksum: intake?.checksum ?? null,
        strategyThemes: themes,
      },
      metrics: {
        totalCandidates: candidates.length,
        strategyApproved,
        needsReview,
        rejected,
        averageStrategicScore: avg(
          candidates
            .map((item) => item.strategicScore)
            .filter((value): value is number => value != null),
        ),
        commercialPotential: avg(
          candidates
            .map((item) => item.commercialValue)
            .filter((value): value is number => value != null),
        ),
        audienceAlignment: avg(
          candidates
            .map((item) => item.audienceAlignment)
            .filter((value): value is number => value != null),
        ),
        brandAlignment: avg(
          candidates
            .map((item) => item.brandAlignment)
            .filter((value): value is number => value != null),
        ),
        portfolioCoverage: portfolioHeatmap.length
          ? Math.min(100, portfolioHeatmap.length * 12)
          : null,
        estimatedRoi: null,
        productionPriorityHigh,
        executiveApprovalRate: pct(strategyApproved, candidates.length),
      },
      pipeline,
      candidates,
      portfolioHeatmap,
      portfolioGaps,
      geographicCoverage: [...geoCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      recommendations,
      governance: {
        strategyPackageVersion:
          intake?.versionNumber != null
            ? `v${Number(intake.versionNumber)}`
            : intake?.strategyVersionId?.slice(0, 8) ?? null,
        modelVersions,
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
          : 'Strategic Fit unavailable',
      meta: {
        cycleStatus: 'UNAVAILABLE',
        intakeStatus: null,
        strategyVersionId: null,
        strategyVersionNumber: null,
        strategyChecksum: null,
        strategyThemes: [],
      },
      metrics: {
        totalCandidates: 0,
        strategyApproved: 0,
        needsReview: 0,
        rejected: 0,
        averageStrategicScore: null,
        commercialPotential: null,
        audienceAlignment: null,
        brandAlignment: null,
        portfolioCoverage: null,
        estimatedRoi: null,
        productionPriorityHigh: 0,
        executiveApprovalRate: null,
      },
      pipeline: [],
      candidates: [],
      portfolioHeatmap: [],
      portfolioGaps: [],
      geographicCoverage: [],
      recommendations: [],
      governance: {
        strategyPackageVersion: null,
        modelVersions: [],
        decisionsLogged: 0,
        auditEvents: 0,
      },
      notifications: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
