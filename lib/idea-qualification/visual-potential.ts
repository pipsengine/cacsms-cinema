import { prisma } from '@/lib/db';
import type { FactorScores } from './contracts';

export type VisualRecommendation =
  | 'Proceed'
  | 'Revise Visual Approach'
  | 'Increase Animation'
  | 'Acquire Archive Assets'
  | 'Reject'
  | 'Await Scoring';

export type VisualPotentialCandidate = {
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
  visualPotentialScore: number | null;
  sceneCoverage: number | null;
  aiImageReadiness: number | null;
  archiveFootageAvailability: number | null;
  animationRequirement: number | null;
  mapOpportunity: number | null;
  timelineOpportunity: number | null;
  characterVisualization: number | null;
  geographicVisualization: number | null;
  historicalReconstruction: number | null;
  cinematicQuality: number | null;
  confidence: number | null;
  measuredConfidence: boolean;
  recommendation: VisualRecommendation;
  readinessBand: 'EXCELLENT' | 'GOOD' | 'MARGINAL' | 'NOT_READY' | 'PENDING';
  explainability: string[];
  aiSummary: string;
  sceneOpportunities: Array<{ label: string; status: string; detail: string }>;
  visualAssets: Array<{ label: string; status: string; detail: string }>;
  scenePrediction: Array<{ label: string; value: number | null }>;
  cinematography: Array<{ label: string; value: number | null }>;
  storyboard: Array<{ label: string; value: number | null }>;
  geographic: Array<{ label: string; status: string; detail: string }>;
  historical: Array<{ label: string; status: string; detail: string }>;
  imageGeneration: Array<{ label: string; value: number | null }>;
  animation: Array<{ label: string; status: string; detail: string }>;
  characters: Array<{ label: string; status: string; detail: string }>;
  environments: Array<{ label: string; status: string; detail: string }>;
  visualDiversity: Array<{ label: string; value: number | null }>;
  suggestions: string[];
  visualRisks: Array<{ label: string; status: string; detail: string }>;
  productionComplexity: Array<{ label: string; value: number | null }>;
  storytellingHeatmap: Array<{ label: string; value: number | null }>;
  visualTimeline: Array<{ phase: string; treatment: string }>;
  assetRecommendations: Array<{ label: string; status: string }>;
  productionReadiness: Array<{ label: string; value: number | null }>;
  multiFormat: Array<{ format: string; status: string; detail: string }>;
  lifecycle: Array<{ key: string; label: string; done: boolean; at: string | null }>;
  factors: Partial<FactorScores> | null;
  modelVersion: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VisualPotentialOverview = {
  available: boolean;
  reason?: string;
  meta: {
    cycleStatus: string;
    intakeStatus: string | null;
    modelVersions: string[];
  };
  metrics: {
    averageVisualPotential: number | null;
    sceneCoverage: number | null;
    aiImageReadiness: number | null;
    archiveFootageAvailability: number | null;
    animationRequirement: number | null;
    mapOpportunity: number | null;
    timelineOpportunity: number | null;
    characterVisualization: number | null;
    geographicVisualization: number | null;
    historicalReconstruction: number | null;
    cinematicQuality: number | null;
    proceedRate: number | null;
    totalCandidates: number;
    excellentCount: number;
    reviseCount: number;
    rejectCount: number;
  };
  pipeline: Array<{
    key: string;
    label: string;
    state: 'pending' | 'active' | 'done' | 'failed';
  }>;
  candidates: VisualPotentialCandidate[];
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    candidateId?: string;
  }>;
  analytics: {
    readinessDistribution: Array<{ label: string; count: number }>;
    recommendationDistribution: Array<{ label: string; count: number }>;
    domainVisuals: Array<{ label: string; avgScore: number | null; count: number }>;
  };
  governance: {
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

const SCENE_CATALOG = [
  'Historical Event',
  'Modern City',
  'Factory',
  'Laboratory',
  'Office',
  'Battlefield',
  'Satellite View',
  'Construction Site',
  'Nature',
  'Landscape',
  'Airport',
  'Harbour',
  'Market',
  'Hospital',
  'Village',
  'Interview Location',
  'Museum',
  'Government Building',
] as const;

const ASSET_CATALOG = [
  'Real Photographs',
  'Historical Photos',
  'Drone Footage',
  'Satellite Images',
  'Maps',
  'Blueprints',
  'Architectural Drawings',
  '3D Models',
  'Videos',
  'News Clips',
  'Document Scans',
  'Charts',
  'Infographics',
  'AI Generated Assets',
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
      (parsed.visual as Record<string, unknown> | undefined) ??
      (parsed.visualPotential as Record<string, unknown> | undefined) ??
      (parsed.cinematography as Record<string, unknown> | undefined);
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

function nestedList(meta: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = meta[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            const row = item as Record<string, unknown>;
            const label = row.label ?? row.name ?? row.scene ?? row.type;
            return typeof label === 'string' ? label : null;
          }
          return null;
        })
        .filter((v): v is string => Boolean(v));
    }
  }
  return [];
}

function readinessBand(
  score: number | null,
): VisualPotentialCandidate['readinessBand'] {
  if (score == null) return 'PENDING';
  if (score >= 90) return 'EXCELLENT';
  if (score >= 75) return 'GOOD';
  if (score >= 60) return 'MARGINAL';
  return 'NOT_READY';
}

function recommendationFor(
  band: VisualPotentialCandidate['readinessBand'],
  archive: number | null,
  animation: number | null,
): VisualRecommendation {
  if (band === 'PENDING') return 'Await Scoring';
  if (band === 'NOT_READY') return 'Reject';
  if (band === 'MARGINAL') {
    if (archive != null && archive < 50) return 'Acquire Archive Assets';
    if (animation != null && animation >= 70) return 'Increase Animation';
    return 'Revise Visual Approach';
  }
  if (band === 'EXCELLENT' || band === 'GOOD') return 'Proceed';
  return 'Revise Visual Approach';
}

function statusFromScore(value: number | null): string {
  if (value == null) return 'UNMEASURED';
  if (value >= 80) return 'STRONG';
  if (value >= 60) return 'MODERATE';
  return 'WEAK';
}

function matchCatalog(
  catalog: readonly string[],
  detected: string[],
  score: number | null,
): Array<{ label: string; status: string; detail: string }> {
  const hay = detected.map((item) => item.toLowerCase());
  return catalog.map((label) => {
    const hit = hay.some(
      (item) => item.includes(label.toLowerCase()) || label.toLowerCase().includes(item),
    );
    if (hit) {
      return {
        label,
        status: 'DETECTED',
        detail: score != null ? `Linked to visual score ${score}` : 'Detected in visual meta',
      };
    }
    return {
      label,
      status: 'UNMEASURED',
      detail: 'No scene/asset detection payload for this label',
    };
  });
}

function suggestionsFor(input: {
  score: number | null;
  archive: number | null;
  animation: number | null;
  map: number | null;
  historical: number | null;
  geography: string | null;
}): string[] {
  const tips: string[] = [];
  if (input.historical != null && input.historical >= 70) {
    tips.push('Generate historical reconstruction');
  }
  if (input.map != null && input.map >= 70) {
    tips.push('Use satellite visualization');
    tips.push('Use timeline animation');
  }
  if (input.animation != null && input.animation >= 65) {
    tips.push('Use animated infographics');
  }
  if (input.archive != null && input.archive < 60) {
    tips.push('Replace expensive footage with AI imagery');
  }
  if (input.geography) tips.push('Use cinematic drone footage');
  if (input.score != null && input.score < 85) tips.push('Use AI reconstruction');
  if (!tips.length) tips.push('Await visual scoring before production suggestions');
  return [...new Set(tips)].slice(0, 8);
}

export async function loadVisualPotential(): Promise<VisualPotentialOverview> {
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
          TRY_CONVERT(float, JSON_VALUE(s.factors_json, '$.visualPotential')),
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
      WHERE category LIKE '%VISUAL%'
         OR category LIKE '%IMAGE%'
         OR category LIKE '%FOOTAGE%'
         OR category LIKE '%COPY%'
         OR category LIKE '%RIGHT%'
         OR category LIKE '%SENSIT%'
         OR category LIKE '%LOCATION%'
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
      WHERE action LIKE '%VISUAL%'
         OR action LIKE '%SCENE%'
         OR action LIKE '%IMAGE%'
         OR action LIKE '%STORYBOARD%'
         OR action LIKE '%SCORE%'
         OR action LIKE '%QUALIF%'
      ORDER BY created_at DESC
    `;

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

    const candidates: VisualPotentialCandidate[] = rows.map((row) => {
      const factors = parseFactors(row.factorsJson);
      const meta = parseMeta(row.factorsJson);
      const visualPotentialScore = factors?.visualPotential ?? null;
      const sceneCoverage =
        nestedNum(meta, ['sceneCoverage', 'scenes']) ?? visualPotentialScore;
      const aiImageReadiness = nestedNum(meta, [
        'aiImageReadiness',
        'imageGenerationReadiness',
        'imageReadiness',
      ]);
      const archiveFootageAvailability =
        nestedNum(meta, ['archiveFootage', 'archiveAvailability']) ??
        factors?.sourceAvailability ??
        null;
      const animationRequirement = nestedNum(meta, [
        'animationRequirement',
        'animation',
      ]);
      const mapOpportunity =
        nestedNum(meta, ['mapOpportunity', 'maps']) ??
        factors?.regionalRelevance ??
        null;
      const timelineOpportunity =
        nestedNum(meta, ['timelineOpportunity', 'timeline']) ??
        factors?.timeliness ??
        null;
      const characterVisualization = nestedNum(meta, [
        'characterVisualization',
        'characters',
      ]);
      const geographicVisualization =
        nestedNum(meta, ['geographicVisualization', 'geographyVisual']) ??
        (row.geography ? factors?.regionalRelevance ?? null : null);
      const historicalReconstruction = nestedNum(meta, [
        'historicalReconstruction',
        'reconstruction',
      ]);
      const cinematicQuality =
        nestedNum(meta, ['cinematicQuality', 'cinematography']) ??
        visualPotentialScore;
      const confidence = num(row.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;
      const band = readinessBand(visualPotentialScore);
      const recommendation = recommendationFor(
        band,
        archiveFootageAvailability,
        animationRequirement,
      );

      if (visualPotentialScore != null) {
        const bucket = domainBuckets.get(row.domain) ?? [];
        bucket.push(visualPotentialScore);
        domainBuckets.set(row.domain, bucket);
      }

      const detectedScenes = nestedList(meta, ['scenes', 'sceneOpportunities', 'detectedScenes']);
      const detectedAssets = nestedList(meta, ['assets', 'visualAssets', 'availableAssets']);
      const detectedEnvs = nestedList(meta, ['environments', 'environment']);
      const detectedChars = nestedList(meta, ['characters', 'characterTypes']);

      const explainability: string[] = [];
      if (visualPotentialScore != null) {
        explainability.push(
          `Visual potential ${visualPotentialScore}% (${band.toLowerCase().replaceAll('_', ' ')})`,
        );
      }
      if (sceneCoverage != null) explainability.push(`Scene coverage ${sceneCoverage}%`);
      if (archiveFootageAvailability != null) {
        explainability.push(`Archive / source availability ${archiveFootageAvailability}%`);
      }
      if (animationRequirement != null) {
        explainability.push(`Animation requirement ${animationRequirement}%`);
      }
      if (mapOpportunity != null) explainability.push(`Map opportunity ${mapOpportunity}%`);
      if (historicalReconstruction != null) {
        explainability.push(`Historical reconstruction ${historicalReconstruction}%`);
      }
      if (row.geography?.trim()) {
        explainability.push(`Geographic focus: ${row.geography.trim()}`);
      }
      if (!explainability.length) {
        explainability.push('No visualPotential factor or visual meta persisted yet');
      }

      const createdAt = row.createdAt.toISOString();
      const updatedAt = row.updatedAt.toISOString();
      const candidateRisks = risksByCandidate.get(row.id) ?? [];

      const suggestions = suggestionsFor({
        score: visualPotentialScore,
        archive: archiveFootageAvailability,
        animation: animationRequirement,
        map: mapOpportunity,
        historical: historicalReconstruction,
        geography: row.geography,
      });

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
        visualPotentialScore,
        sceneCoverage,
        aiImageReadiness,
        archiveFootageAvailability,
        animationRequirement,
        mapOpportunity,
        timelineOpportunity,
        characterVisualization,
        geographicVisualization,
        historicalReconstruction,
        cinematicQuality,
        confidence,
        measuredConfidence,
        recommendation,
        readinessBand: band,
        explainability,
        aiSummary:
          visualPotentialScore != null
            ? `${row.title} scores ${visualPotentialScore}% visual potential (${band.replaceAll('_', ' ').toLowerCase()}). Recommendation: ${recommendation}.`
            : `${row.title} awaits persisted visualPotential scoring from the qualification cycle.`,
        sceneOpportunities: matchCatalog(SCENE_CATALOG, detectedScenes, visualPotentialScore),
        visualAssets: matchCatalog(ASSET_CATALOG, detectedAssets, archiveFootageAvailability),
        scenePrediction: [
          {
            label: 'Total Scenes',
            value: nestedNum(meta, ['totalScenes']),
          },
          {
            label: 'Primary Scenes',
            value: nestedNum(meta, ['primaryScenes']),
          },
          {
            label: 'Supporting Scenes',
            value: nestedNum(meta, ['supportingScenes']),
          },
          {
            label: 'Transition Scenes',
            value: nestedNum(meta, ['transitionScenes']),
          },
          {
            label: 'Animated Scenes',
            value: nestedNum(meta, ['animatedScenes']),
          },
          {
            label: 'Interview Scenes',
            value: nestedNum(meta, ['interviewScenes']),
          },
          {
            label: 'Drone Opportunities',
            value: nestedNum(meta, ['droneOpportunities']),
          },
          {
            label: 'B-Roll Opportunities',
            value: nestedNum(meta, ['brollOpportunities']),
          },
          {
            label: 'AI Generated',
            value: nestedNum(meta, ['aiGeneratedScenes']),
          },
          {
            label: 'Archive',
            value: nestedNum(meta, ['archiveScenes']),
          },
          {
            label: 'Stock',
            value: nestedNum(meta, ['stockScenes']),
          },
          {
            label: 'Animation',
            value: nestedNum(meta, ['animationScenes']),
          },
        ],
        cinematography: [
          { label: 'Wide Shots', value: nestedNum(meta, ['wideShots']) },
          { label: 'Close-ups', value: nestedNum(meta, ['closeUps']) },
          { label: 'Macro Shots', value: nestedNum(meta, ['macroShots']) },
          { label: 'Tracking Shots', value: nestedNum(meta, ['trackingShots']) },
          { label: 'Drone Shots', value: nestedNum(meta, ['droneShots']) },
          { label: 'Timelapse', value: nestedNum(meta, ['timelapse']) },
          { label: 'Hyperlapse', value: nestedNum(meta, ['hyperlapse']) },
          { label: 'POV', value: nestedNum(meta, ['pov']) },
          { label: 'Interior', value: nestedNum(meta, ['interior']) },
          { label: 'Exterior', value: nestedNum(meta, ['exterior']) },
          { label: 'Night Scenes', value: nestedNum(meta, ['nightScenes']) },
          { label: 'Day Scenes', value: nestedNum(meta, ['dayScenes']) },
          { label: 'Slow Motion', value: nestedNum(meta, ['slowMotion']) },
          { label: 'Motion Graphics', value: nestedNum(meta, ['motionGraphics']) },
        ],
        storyboard: [
          {
            label: 'Storyboard Complexity',
            value: nestedNum(meta, ['storyboardComplexity']),
          },
          {
            label: 'Estimated Storyboard Frames',
            value: nestedNum(meta, ['storyboardFrames']),
          },
          {
            label: 'Illustration Requirements',
            value: nestedNum(meta, ['illustrationRequirements']),
          },
          {
            label: 'Animation Requirements',
            value: animationRequirement,
          },
          {
            label: 'Camera Direction Opportunities',
            value: nestedNum(meta, ['cameraDirection']),
          },
          {
            label: 'Scene Transitions',
            value: nestedNum(meta, ['sceneTransitions']),
          },
          {
            label: 'Visual Continuity',
            value: nestedNum(meta, ['visualContinuity']) ?? visualPotentialScore,
          },
        ],
        geographic: [
          {
            label: 'Maps',
            status: statusFromScore(mapOpportunity),
            detail:
              mapOpportunity != null
                ? `Map opportunity ${mapOpportunity}`
                : 'No map opportunity payload',
          },
          {
            label: 'Country / Satellite / 3D Globe',
            status:
              nestedNum(meta, ['satelliteMaps', 'globe']) != null
                ? 'EVALUATED'
                : row.geography
                  ? 'OBSERVED'
                  : 'UNMEASURED',
            detail: row.geography?.trim() || 'No geography persisted',
          },
          {
            label: 'Travel / Migration / Trade / War routes',
            status:
              nestedNum(meta, ['routes']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['routes']) != null
                ? `Score ${nestedNum(meta, ['routes'])}`
                : 'No route visualization payload',
          },
          {
            label: 'Population / Climate maps',
            status:
              nestedNum(meta, ['thematicMaps']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              nestedNum(meta, ['thematicMaps']) != null
                ? `Score ${nestedNum(meta, ['thematicMaps'])}`
                : 'No thematic map payload',
          },
        ],
        historical: [
          {
            label: 'AI reconstruction possible',
            status: statusFromScore(historicalReconstruction),
            detail:
              historicalReconstruction != null
                ? `Reconstruction ${historicalReconstruction}`
                : 'No reconstruction payload',
          },
          {
            label: 'Buildings / Ancient cities / Events',
            status:
              nestedNum(meta, ['historicStructures']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail: 'Nested historical meta when present',
          },
          {
            label: 'People / Machines / Battles',
            status:
              nestedNum(meta, ['historicActors']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail: 'Nested historical meta when present',
          },
          {
            label: 'Infrastructure / Industrial sites',
            status:
              nestedNum(meta, ['historicInfrastructure']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail: 'Nested historical meta when present',
          },
        ],
        imageGeneration: [
          {
            label: 'Prompt Complexity',
            value: nestedNum(meta, ['promptComplexity']),
          },
          {
            label: 'Rendering Difficulty',
            value: nestedNum(meta, ['renderingDifficulty']),
          },
          {
            label: 'Expected Quality',
            value: nestedNum(meta, ['expectedImageQuality']) ?? aiImageReadiness,
          },
          {
            label: 'Reference Images Needed',
            value: nestedNum(meta, ['referenceImagesNeeded']),
          },
          {
            label: 'Human Review Needed',
            value: nestedNum(meta, ['humanReviewNeeded']),
          },
          {
            label: 'Rendering Cost',
            value: nestedNum(meta, ['renderingCost']),
          },
          {
            label: 'Inference Time',
            value: nestedNum(meta, ['inferenceTime']),
          },
          {
            label: 'AI Image Readiness',
            value: aiImageReadiness,
          },
        ],
        animation: [
          {
            label: 'Infographics',
            status: statusFromScore(animationRequirement),
            detail:
              animationRequirement != null
                ? `Animation requirement ${animationRequirement}`
                : 'UNMEASURED',
          },
          {
            label: 'Process / Timeline / 3D / Scientific',
            status:
              nestedNum(meta, ['specializedAnimation']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail: 'Nested animation meta when present',
          },
          {
            label: 'Economic charts / Data visualizations',
            status:
              nestedNum(meta, ['dataVisualization']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail: 'Nested data-viz meta when present',
          },
          {
            label: 'Mechanism explainers / Flow diagrams',
            status:
              nestedNum(meta, ['explainers']) != null ? 'EVALUATED' : 'UNMEASURED',
            detail: 'Nested explainer meta when present',
          },
        ],
        characters: (
          detectedChars.length
            ? detectedChars
            : [
                'Historical Figures',
                'Scientists',
                'Workers',
                'Military',
                'Executives',
                'Politicians',
                'Citizens',
                'Interview Subjects',
                'Narrators',
                'Crowd Scenes',
              ]
        ).map((label) => ({
          label,
          status: detectedChars.length
            ? 'DETECTED'
            : characterVisualization != null
              ? 'SCORED'
              : 'UNMEASURED',
          detail:
            characterVisualization != null
              ? `Character visualization ${characterVisualization}`
              : 'No character visualization payload',
        })),
        environments: (
          detectedEnvs.length
            ? detectedEnvs
            : [
                'Urban',
                'Industrial',
                'Natural',
                'Marine',
                'Underground',
                'Desert',
                'Forest',
                'Mountain',
                'Office',
                'Factory',
                'Laboratory',
                'Construction',
                'Residential',
              ]
        ).map((label) => ({
          label,
          status: detectedEnvs.length ? 'DETECTED' : 'UNMEASURED',
          detail: detectedEnvs.length
            ? 'Detected in visual meta'
            : 'No environment classification payload',
        })),
        visualDiversity: [
          {
            label: 'Indoor vs Outdoor',
            value: nestedNum(meta, ['indoorOutdoorBalance']),
          },
          {
            label: 'Modern vs Historical',
            value: nestedNum(meta, ['modernHistoricalBalance']),
          },
          {
            label: 'People vs Environment',
            value: nestedNum(meta, ['peopleEnvironmentBalance']),
          },
          {
            label: 'Animation vs Reality',
            value: nestedNum(meta, ['animationRealityBalance']),
          },
          {
            label: 'Maps vs Footage',
            value: nestedNum(meta, ['mapsFootageBalance']),
          },
          {
            label: 'Data vs Storytelling',
            value: nestedNum(meta, ['dataStoryBalance']),
          },
        ],
        suggestions,
        visualRisks: [
          {
            label: 'Unavailable Footage',
            status:
              archiveFootageAvailability != null && archiveFootageAvailability < 50
                ? 'HIGH'
                : archiveFootageAvailability != null
                  ? 'LOW'
                  : 'UNMEASURED',
            detail:
              archiveFootageAvailability != null
                ? `Archive availability ${archiveFootageAvailability}`
                : 'No archive availability signal',
          },
          {
            label: 'Copyright Issues',
            status: candidateRisks.some((r) => /copy|right/i.test(r.category))
              ? 'EVALUATED'
              : 'UNMEASURED',
            detail: 'From iq_risk_assessments when present',
          },
          {
            label: 'Low Image Quality / Missing References',
            status:
              aiImageReadiness != null && aiImageReadiness < 60
                ? 'ELEVATED'
                : aiImageReadiness != null
                  ? 'LOW'
                  : 'UNMEASURED',
            detail:
              aiImageReadiness != null
                ? `AI image readiness ${aiImageReadiness}`
                : 'No image readiness payload',
          },
          {
            label: 'Sensitive / Restricted / Political / Military',
            status: candidateRisks.some((r) =>
              /sensit|restrict|politic|military|location/i.test(r.category),
            )
              ? 'EVALUATED'
              : 'UNMEASURED',
            detail: 'From visual / location risk assessments when present',
          },
        ],
        productionComplexity: [
          {
            label: 'Image Generation Time',
            value: nestedNum(meta, ['imageGenerationTime']),
          },
          {
            label: 'Animation Time',
            value: nestedNum(meta, ['animationTime']),
          },
          {
            label: 'Editing Complexity',
            value: nestedNum(meta, ['editingComplexity']),
          },
          {
            label: 'Rendering Hours',
            value: nestedNum(meta, ['renderingHours']),
          },
          {
            label: 'GPU Hours',
            value: nestedNum(meta, ['gpuHours']),
          },
          {
            label: 'Storage',
            value: nestedNum(meta, ['storage']),
          },
          {
            label: 'Cloud Costs',
            value: nestedNum(meta, ['cloudCosts']),
          },
          {
            label: 'Human Review',
            value: nestedNum(meta, ['humanReview']),
          },
        ],
        storytellingHeatmap: [
          {
            label: 'Opening',
            value: nestedNum(meta, ['heatmapOpening']),
          },
          {
            label: 'History',
            value: nestedNum(meta, ['heatmapHistory']) ?? historicalReconstruction,
          },
          {
            label: 'Technology',
            value: nestedNum(meta, ['heatmapTechnology']),
          },
          {
            label: 'Future',
            value: nestedNum(meta, ['heatmapFuture']) ?? timelineOpportunity,
          },
          {
            label: 'Conclusion',
            value: nestedNum(meta, ['heatmapConclusion']) ?? cinematicQuality,
          },
        ],
        visualTimeline: [
          {
            phase: 'Introduction',
            treatment: nestedList(meta, ['timelineTreatments'])[0] ?? 'UNMEASURED',
          },
          {
            phase: 'History',
            treatment: nestedList(meta, ['timelineTreatments'])[1] ?? 'UNMEASURED',
          },
          {
            phase: 'Explanation',
            treatment: nestedList(meta, ['timelineTreatments'])[2] ?? 'UNMEASURED',
          },
          {
            phase: 'Case Study',
            treatment: nestedList(meta, ['timelineTreatments'])[3] ?? 'UNMEASURED',
          },
          {
            phase: 'Conclusion',
            treatment: nestedList(meta, ['timelineTreatments'])[4] ?? 'UNMEASURED',
          },
        ],
        assetRecommendations: ASSET_CATALOG.map((label) => {
          const hit = detectedAssets.some((item) =>
            item.toLowerCase().includes(label.toLowerCase().split(' ')[0]!),
          );
          return {
            label,
            status: hit
              ? 'RECOMMENDED'
              : archiveFootageAvailability != null || visualPotentialScore != null
                ? 'PENDING_MODEL'
                : 'UNMEASURED',
          };
        }),
        productionReadiness: [
          { label: 'Visual Readiness', value: visualPotentialScore },
          {
            label: 'Storyboard Readiness',
            value: nestedNum(meta, ['storyboardReadiness']),
          },
          {
            label: 'Animation Readiness',
            value: animationRequirement,
          },
          {
            label: 'Image Readiness',
            value: aiImageReadiness,
          },
          {
            label: 'Video Readiness',
            value: nestedNum(meta, ['videoReadiness']) ?? archiveFootageAvailability,
          },
          {
            label: 'Overall Visual Score',
            value: visualPotentialScore,
          },
        ],
        multiFormat: [
          {
            format: 'Full documentary',
            status: visualPotentialScore != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              visualPotentialScore != null
                ? `Visual score ${visualPotentialScore}`
                : 'No score',
          },
          {
            format: 'Short-form / vertical social',
            status:
              nestedNum(meta, ['shortFormReadiness']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail: 'Nested multi-format meta when present',
          },
          {
            format: 'Educational explainer',
            status:
              factors?.educationalValue != null ? 'EVALUATED' : 'UNMEASURED',
            detail:
              factors?.educationalValue != null
                ? `Educational value ${factors.educationalValue}`
                : 'UNMEASURED',
          },
          {
            format: 'Presentation / interactive web',
            status:
              nestedNum(meta, ['interactiveReadiness']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail: 'Nested multi-format meta when present',
          },
          {
            format: 'Podcast visual companion',
            status:
              nestedNum(meta, ['podcastCompanion']) != null
                ? 'EVALUATED'
                : 'UNMEASURED',
            detail: 'Nested multi-format meta when present',
          },
        ],
        lifecycle: [
          {
            key: 'scenes',
            label: 'Scene discovery',
            done: detectedScenes.length > 0 || sceneCoverage != null,
            at:
              detectedScenes.length > 0 || sceneCoverage != null ? updatedAt : null,
          },
          {
            key: 'assets',
            label: 'Visual asset analysis',
            done: archiveFootageAvailability != null || detectedAssets.length > 0,
            at:
              archiveFootageAvailability != null || detectedAssets.length > 0
                ? updatedAt
                : null,
          },
          {
            key: 'cinema',
            label: 'Cinematography assessment',
            done: cinematicQuality != null,
            at: cinematicQuality != null ? updatedAt : null,
          },
          {
            key: 'animation',
            label: 'Animation opportunity',
            done: animationRequirement != null,
            at: animationRequirement != null ? updatedAt : null,
          },
          {
            key: 'storyboard',
            label: 'Storyboard readiness',
            done: nestedNum(meta, ['storyboardReadiness', 'storyboardFrames']) != null,
            at:
              nestedNum(meta, ['storyboardReadiness', 'storyboardFrames']) != null
                ? updatedAt
                : null,
          },
          {
            key: 'complexity',
            label: 'Production complexity',
            done: nestedNum(meta, ['renderingHours', 'gpuHours', 'editingComplexity']) != null,
            at:
              nestedNum(meta, ['renderingHours', 'gpuHours', 'editingComplexity']) != null
                ? updatedAt
                : null,
          },
          {
            key: 'score',
            label: 'Visual potential score',
            done: visualPotentialScore != null,
            at: visualPotentialScore != null ? updatedAt : null,
          },
          {
            key: 'decision',
            label: 'Proceed / Revise / Reject',
            done: recommendation !== 'Await Scoring',
            at: recommendation !== 'Await Scoring' ? updatedAt : null,
          },
        ],
        factors,
        modelVersion: row.modelVersion,
        createdAt,
        updatedAt,
      };
    });

    const excellentCount = candidates.filter(
      (c) => c.readinessBand === 'EXCELLENT' || c.readinessBand === 'GOOD',
    ).length;
    const reviseCount = candidates.filter((c) =>
      [
        'Revise Visual Approach',
        'Increase Animation',
        'Acquire Archive Assets',
      ].includes(c.recommendation),
    ).length;
    const rejectCount = candidates.filter((c) => c.recommendation === 'Reject').length;

    const visualScores = candidates
      .map((c) => c.visualPotentialScore)
      .filter((v): v is number => v != null);

    const recommendations: VisualPotentialOverview['recommendations'] = [];
    for (const item of candidates.slice(0, 12)) {
      recommendations.push({
        id: `vp-${item.id}`,
        action: item.recommendation,
        reason: `${item.title} · ${item.readinessBand} · score ${item.visualPotentialScore ?? 'UNMEAS.'}`,
        priority:
          item.recommendation === 'Reject'
            ? 'HIGH'
            : item.recommendation === 'Proceed'
              ? 'LOW'
              : 'MEDIUM',
        candidateId: item.id,
      });
      for (const tip of item.suggestions.slice(0, 1)) {
        recommendations.push({
          id: `sug-${item.id}`,
          action: tip,
          reason: `Visual production suggestion for ${item.title}`,
          priority: 'MEDIUM',
          candidateId: item.id,
        });
      }
    }

    const notifications: VisualPotentialOverview['notifications'] = [];
    for (const item of candidates.slice(0, 10)) {
      if (item.recommendation === 'Proceed') {
        notifications.push({
          id: `ok-${item.id}`,
          severity: 'INFO',
          message: `Strong visual candidate: ${item.title}`,
        });
      }
      if (item.recommendation === 'Reject') {
        notifications.push({
          id: `rej-${item.id}`,
          severity: 'CRITICAL',
          message: `Weak visual potential: ${item.title}`,
        });
      }
      if (
        item.recommendation === 'Revise Visual Approach' ||
        item.recommendation === 'Increase Animation' ||
        item.recommendation === 'Acquire Archive Assets'
      ) {
        notifications.push({
          id: `rev-${item.id}`,
          severity: 'WARNING',
          message: `${item.recommendation}: ${item.title}`,
        });
      }
    }

    const modelVersions = [
      ...new Set(
        candidates.map((c) => c.modelVersion).filter((v): v is string => Boolean(v)),
      ),
    ];

    const hasScores = visualScores.length > 0;
    const pipeline = [
      { key: 'scenes', label: 'Scene Discovery' },
      { key: 'assets', label: 'Visual Asset Analysis' },
      { key: 'cinema', label: 'Cinematography Assessment' },
      { key: 'animation', label: 'Animation Opportunity' },
      { key: 'storyboard', label: 'Storyboard Readiness' },
      { key: 'complexity', label: 'Production Complexity' },
      { key: 'score', label: 'Visual Potential Score' },
      { key: 'decision', label: 'Proceed / Revise / Reject' },
    ].map((item, index) => {
      let state: 'pending' | 'active' | 'done' | 'failed' = 'pending';
      if (rejectCount > 0 && item.key === 'score') state = 'failed';
      else if (excellentCount > 0 && index <= 7) state = 'done';
      else if (hasScores && index <= 4) state = 'done';
      else if (hasScores && index === 5) state = 'active';
      else if (rows.length && index === 0) state = 'active';
      return { ...item, state };
    });

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
      },
      metrics: {
        averageVisualPotential: avg(visualScores),
        sceneCoverage: avg(
          candidates
            .map((c) => c.sceneCoverage)
            .filter((v): v is number => v != null),
        ),
        aiImageReadiness: avg(
          candidates
            .map((c) => c.aiImageReadiness)
            .filter((v): v is number => v != null),
        ),
        archiveFootageAvailability: avg(
          candidates
            .map((c) => c.archiveFootageAvailability)
            .filter((v): v is number => v != null),
        ),
        animationRequirement: avg(
          candidates
            .map((c) => c.animationRequirement)
            .filter((v): v is number => v != null),
        ),
        mapOpportunity: avg(
          candidates
            .map((c) => c.mapOpportunity)
            .filter((v): v is number => v != null),
        ),
        timelineOpportunity: avg(
          candidates
            .map((c) => c.timelineOpportunity)
            .filter((v): v is number => v != null),
        ),
        characterVisualization: avg(
          candidates
            .map((c) => c.characterVisualization)
            .filter((v): v is number => v != null),
        ),
        geographicVisualization: avg(
          candidates
            .map((c) => c.geographicVisualization)
            .filter((v): v is number => v != null),
        ),
        historicalReconstruction: avg(
          candidates
            .map((c) => c.historicalReconstruction)
            .filter((v): v is number => v != null),
        ),
        cinematicQuality: avg(
          candidates
            .map((c) => c.cinematicQuality)
            .filter((v): v is number => v != null),
        ),
        proceedRate: pct(
          candidates.filter((c) => c.recommendation === 'Proceed').length,
          candidates.length,
        ),
        totalCandidates: candidates.length,
        excellentCount,
        reviseCount,
        rejectCount,
      },
      pipeline,
      candidates,
      recommendations,
      analytics: {
        readinessDistribution: [
          {
            label: 'EXCELLENT',
            count: candidates.filter((c) => c.readinessBand === 'EXCELLENT').length,
          },
          {
            label: 'GOOD',
            count: candidates.filter((c) => c.readinessBand === 'GOOD').length,
          },
          {
            label: 'MARGINAL',
            count: candidates.filter((c) => c.readinessBand === 'MARGINAL').length,
          },
          {
            label: 'NOT_READY',
            count: candidates.filter((c) => c.readinessBand === 'NOT_READY').length,
          },
          {
            label: 'PENDING',
            count: candidates.filter((c) => c.readinessBand === 'PENDING').length,
          },
        ],
        recommendationDistribution: [...recommendationDistribution.entries()].map(
          ([label, count]) => ({ label, count }),
        ),
        domainVisuals: [...domainBuckets.entries()]
          .map(([label, scores]) => ({
            label,
            avgScore: avg(scores),
            count: scores.length,
          }))
          .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0)),
      },
      governance: {
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
          : 'Visual Potential unavailable',
      meta: {
        cycleStatus: 'UNAVAILABLE',
        intakeStatus: null,
        modelVersions: [],
      },
      metrics: {
        averageVisualPotential: null,
        sceneCoverage: null,
        aiImageReadiness: null,
        archiveFootageAvailability: null,
        animationRequirement: null,
        mapOpportunity: null,
        timelineOpportunity: null,
        characterVisualization: null,
        geographicVisualization: null,
        historicalReconstruction: null,
        cinematicQuality: null,
        proceedRate: null,
        totalCandidates: 0,
        excellentCount: 0,
        reviseCount: 0,
        rejectCount: 0,
      },
      pipeline: [],
      candidates: [],
      recommendations: [],
      analytics: {
        readinessDistribution: [],
        recommendationDistribution: [],
        domainVisuals: [],
      },
      governance: {
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
