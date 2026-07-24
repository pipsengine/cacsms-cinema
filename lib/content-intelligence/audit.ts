import { createHash } from 'crypto';
import { prisma } from '@/lib/db';

export type AuditCategory =
  | 'Strategy'
  | 'Discovery'
  | 'Signals'
  | 'Trend Intelligence'
  | 'Audience Demand'
  | 'Knowledge Gap'
  | 'Topic Opportunity'
  | 'Competitor Analysis'
  | 'Candidate Generation'
  | 'Evidence Verification'
  | 'Duplicate Detection'
  | 'Ranking'
  | 'Portfolio Balance'
  | 'Scoring'
  | 'Recovery'
  | 'Qualification'
  | 'Policy'
  | 'Security'
  | 'Infrastructure'
  | 'Workflow'
  | 'User'
  | 'System'
  | 'Unknown';

export type AuditActorType = 'SYSTEM' | 'SERVICE' | 'AI' | 'HUMAN' | 'USER' | 'OPERATOR' | 'UNKNOWN';

export type AuditEventStatus =
  | 'RECORDED'
  | 'VERIFIED'
  | 'INTEGRITY_OK'
  | 'INTEGRITY_FAIL'
  | 'PENDING';

export type AuditEventRecord = {
  id: string;
  timestamp: string;
  workflow: string;
  stage: string;
  module: string;
  submodule: string;
  action: string;
  actor: string;
  actorType: AuditActorType;
  aiAgent: string | null;
  model: string | null;
  promptVersion: string | null;
  knowledgeVersion: string | null;
  strategyVersion: string | null;
  decision: string;
  confidence: number | null;
  evidence: string | null;
  inputs: string | null;
  outputs: string | null;
  durationMs: number | null;
  status: AuditEventStatus;
  correlationId: string | null;
  requestId: string | null;
  runId: string | null;
  opportunityId: string | null;
  digitalSignature: string;
  contentHash: string;
  category: AuditCategory;
  reason: string | null;
  previousValue: string | null;
  newValue: string | null;
  explainability: {
    summary: string;
    reasoning: string;
    stepByStep: string[];
    evidenceUsed: string[];
    alternatives: string[];
    policyChecks: string[];
    riskAnalysis: string;
    expectedOutcome: string;
    actualOutcome: string;
  };
  confidenceBreakdown: {
    overall: number | null;
    evidence: number | null;
    knowledge: number | null;
    model: number | null;
    prompt: number | null;
    ranking: number | null;
    portfolio: number | null;
  };
  decisionChain: Array<{ key: string; label: string; done: boolean }>;
  versions: {
    strategy: string | null;
    knowledge: string | null;
    prompt: string | null;
    model: string | null;
    policy: string | null;
    graph: string | null;
  };
};

export type IntelligenceTimelineMarker = {
  key: string;
  label: string;
  at: string | null;
  count: number;
  done: boolean;
};

export type AuditIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  eventId?: string;
};

export type DecisionChainNode = {
  key: string;
  label: string;
  records: number;
  confidence: number | null;
  state: 'pending' | 'active' | 'done';
};

export type IntelligenceAuditOverview = {
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
    ledgerStatus: string;
    lastEventAt: string | null;
    integrityPct: number | null;
    coveragePct: number | null;
  };
  metrics: {
    totalAuditEvents: number;
    aiDecisions: number;
    evidenceRecords: number;
    policyViolations: number;
    recoveredJobs: number;
    autonomousDecisions: number;
    humanOverrides: number;
    aiConfidence: number | null;
    averageDecisionTimeMs: number | null;
    decisionAccuracy: number | null;
    workflowCompliance: number | null;
    auditIntegrity: number | null;
    digitalSignatures: number;
    immutableRecords: number;
    modelVersions: number | null;
    knowledgeChanges: number;
  };
  governance: {
    complianceScore: number | null;
    auditCoverage: number | null;
    decisionTransparency: number | null;
    explainabilityScore: number | null;
    evidenceQuality: number | null;
    governanceHealth: number | null;
    riskExposure: number | null;
    policyCompliance: number | null;
  };
  categories: Array<{ category: AuditCategory; count: number }>;
  timeline: IntelligenceTimelineMarker[];
  decisionChain: DecisionChainNode[];
  events: AuditEventRecord[];
  learning: Array<{
    id: string;
    observation: string;
    improvement: string;
    confidenceGain: number | null;
    at: string;
  }>;
  policyChecks: Array<{
    id: string;
    policy: string;
    status: string;
    detail: string;
  }>;
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  issues: AuditIssue[];
  lastUpdated: string;
};

type PackageRow = {
  strategy_version_id: string;
  version_number: number;
  checksum: string;
  status: string;
};

type RawAuditRow = {
  id: string;
  runId: string | null;
  opportunityId: string | null;
  action: string;
  actorType: string;
  actorReference: string | null;
  requestId: string | null;
  correlationId: string | null;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: Date;
};

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function classifyCategory(action: string, reason: string | null): AuditCategory {
  const hay = `${action} ${reason ?? ''}`.toLowerCase();
  if (/strategy|package/.test(hay)) return 'Strategy';
  if (/discover|run_queued|run_started|run_completed/.test(hay)) return 'Discovery';
  if (/signal/.test(hay)) return 'Signals';
  if (/trend|seasonal/.test(hay)) return 'Trend Intelligence';
  if (/audience|demand/.test(hay)) return 'Audience Demand';
  if (/knowledge.?gap|search.?gap/.test(hay)) return 'Knowledge Gap';
  if (/topic|opportunity/.test(hay)) return 'Topic Opportunity';
  if (/competitor/.test(hay)) return 'Competitor Analysis';
  if (/candidate/.test(hay)) return 'Candidate Generation';
  if (/verif|evidence/.test(hay)) return 'Evidence Verification';
  if (/duplicate|dedup|similarity/.test(hay)) return 'Duplicate Detection';
  if (/rank|select/.test(hay)) return 'Ranking';
  if (/portfolio|balance|diversity/.test(hay)) return 'Portfolio Balance';
  if (/score|scoring/.test(hay)) return 'Scoring';
  if (/fail|recover|retry|block|heal/.test(hay)) return 'Recovery';
  if (/handoff|qualif|transfer|ack/.test(hay)) return 'Qualification';
  if (/policy|compliance|ethics|bias|copyright/.test(hay)) return 'Policy';
  if (/auth|token|security|permission|signature/.test(hay)) return 'Security';
  if (/infra|cpu|memory|gpu|redis|queue|worker/.test(hay)) return 'Infrastructure';
  if (/workflow|job|orchestr|pipeline/.test(hay)) return 'Workflow';
  if (/user|human|override|approval|manual/.test(hay)) return 'User';
  if (/system|service/.test(hay)) return 'System';
  return 'Unknown';
}

function normalizeActorType(raw: string | null): AuditActorType {
  const value = (raw ?? 'UNKNOWN').toUpperCase();
  if (value === 'SYSTEM' || value === 'SERVICE' || value === 'AI') return value;
  if (value === 'HUMAN' || value === 'USER' || value === 'OPERATOR' || value === 'DEVELOPMENT_USER') {
    return value === 'DEVELOPMENT_USER' ? 'HUMAN' : (value as AuditActorType);
  }
  if (/AI|MODEL|AGENT/.test(value)) return 'AI';
  if (/USER|HUMAN|OPERATOR|ADMIN/.test(value)) return 'HUMAN';
  if (/SERVICE|WORKER/.test(value)) return 'SERVICE';
  if (/SYSTEM/.test(value)) return 'SYSTEM';
  return 'UNKNOWN';
}

function moduleFromCategory(category: AuditCategory): string {
  switch (category) {
    case 'Strategy':
      return 'Strategy Intake';
    case 'Discovery':
      return 'Discovery Engine';
    case 'Signals':
      return 'Signal Collection';
    case 'Evidence Verification':
      return 'Evidence Verification';
    case 'Ranking':
    case 'Scoring':
      return 'Scoring & Ranking';
    case 'Portfolio Balance':
      return 'Portfolio Balance';
    case 'Qualification':
      return 'Qualification Handoffs';
    case 'Recovery':
      return 'Failure & Recovery';
    case 'Policy':
      return 'Policy Governance';
    case 'Security':
      return 'Security Audit';
    default:
      return category;
  }
}

function decisionFromAction(action: string, reason: string | null): string {
  if (reason && reason.trim()) return reason.trim().slice(0, 240);
  return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function parseJsonObject(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

function strField(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function numField(obj: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function signPayload(parts: Array<string | null | undefined>): { hash: string; signature: string } {
  const canonical = parts.map((part) => part ?? '').join('|');
  const hash = createHash('sha256').update(canonical).digest('hex');
  return { hash, signature: `sha256:${hash.slice(0, 32)}…${hash.slice(-8)}` };
}

function decisionChainFor(category: AuditCategory): Array<{ key: string; label: string; done: boolean }> {
  const nodes = [
    { key: 'strategy', label: 'Strategy', match: ['Strategy'] },
    { key: 'signals', label: 'Signals', match: ['Discovery', 'Signals', 'Trend Intelligence', 'Audience Demand', 'Knowledge Gap', 'Competitor Analysis'] },
    { key: 'evidence', label: 'Evidence', match: ['Evidence Verification'] },
    { key: 'knowledge', label: 'Knowledge', match: ['Knowledge Gap', 'Topic Opportunity', 'Candidate Generation'] },
    { key: 'scoring', label: 'Scoring', match: ['Scoring', 'Duplicate Detection'] },
    { key: 'ranking', label: 'Ranking', match: ['Ranking'] },
    { key: 'selection', label: 'Selection', match: ['Portfolio Balance', 'Ranking'] },
    { key: 'qualification', label: 'Qualification', match: ['Qualification'] },
    { key: 'handoff', label: 'Handoff', match: ['Qualification'] },
  ];
  const index = nodes.findIndex((node) => node.match.includes(category));
  return nodes.map((node, i) => ({
    key: node.key,
    label: node.label,
    done: index >= 0 ? i <= index : false,
  }));
}

function buildExplainability(input: {
  action: string;
  category: AuditCategory;
  decision: string;
  reason: string | null;
  previousValue: string | null;
  newValue: string | null;
  actorType: AuditActorType;
  confidence: number | null;
}): AuditEventRecord['explainability'] {
  const steps = [
    `Observed action ${input.action}`,
    `Classified as ${input.category}`,
    `Actor type ${input.actorType}`,
    input.reason ? `Recorded reason: ${input.reason}` : 'No free-text reason persisted',
    input.previousValue ? 'Previous value captured for change history' : 'No previous value on record',
    input.newValue ? 'New value persisted for forensic replay' : 'No new value payload persisted',
  ];
  return {
    summary: input.decision,
    reasoning: `Persisted Stage 02 audit trail for ${input.category.toLowerCase()} activity. Reconstructable from immutable ledger fields only.`,
    stepByStep: steps,
    evidenceUsed: input.newValue ? ['new_value payload', 'action + actor_type + timestamp'] : ['action + actor_type + timestamp'],
    alternatives: ['No alternate decision branches persisted for this event'],
    policyChecks: input.category === 'Policy' ? ['Policy evaluation recorded'] : ['No dedicated policy verdict column on this event'],
    riskAnalysis:
      input.category === 'Recovery' || input.category === 'Security'
        ? 'Elevated operational / security sensitivity based on category'
        : 'Standard workflow risk profile from category alone',
    expectedOutcome: 'Append-only ledger entry retained for governance replay',
    actualOutcome: `Event recorded with confidence ${input.confidence != null ? `${input.confidence}%` : 'UNMEASURED'}`,
  };
}

function timelineKeyFor(category: AuditCategory, action: string): string | null {
  const hay = action.toLowerCase();
  if (category === 'Strategy' || /strategy|package/.test(hay)) return 'strategy';
  if (/discover|run_queued|run_started/.test(hay)) return 'discovery';
  if (category === 'Signals' || /signal/.test(hay)) return 'signals';
  if (category === 'Evidence Verification' || /verif|evidence/.test(hay)) return 'evidence';
  if (category === 'Candidate Generation' || category === 'Topic Opportunity' || /candidate|opportunity/.test(hay)) {
    return 'candidate';
  }
  if (category === 'Duplicate Detection' || /duplicate|dedup/.test(hay)) return 'duplicate';
  if (category === 'Ranking' || category === 'Scoring' || /rank|score/.test(hay)) return 'ranking';
  if (category === 'Portfolio Balance' || /portfolio/.test(hay)) return 'portfolio';
  if (category === 'Recovery' || /fail|recover|retry|block/.test(hay)) return 'recovery';
  if (category === 'Qualification' || /handoff|qualif/.test(hay)) return 'qualification';
  if (/stage.?complete|run_completed|completed/.test(hay)) return 'stage';
  return null;
}

export async function loadIntelligenceAudit(): Promise<IntelligenceAuditOverview> {
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
      ORDER BY COALESCE(started_at, created_at) DESC
    `;

    const auditRows = await prisma.$queryRaw<RawAuditRow[]>`
      SELECT TOP 500
        CONVERT(varchar(36), id) AS id,
        CONVERT(varchar(36), run_id) AS runId,
        CONVERT(varchar(36), opportunity_id) AS opportunityId,
        action,
        actor_type AS actorType,
        actor_reference AS actorReference,
        request_id AS requestId,
        correlation_id AS correlationId,
        previous_value AS previousValue,
        new_value AS newValue,
        reason,
        created_at AS createdAt
      FROM ci_audit_events
      ORDER BY created_at DESC
    `;

    const counts = await prisma.$queryRaw<
      Array<{
        evidenceCount: number | bigint;
        recoveredBlockers: number | bigint;
        recoveredJobs: number | bigint;
        opportunityConfidenceAvg: number | string | null;
        scoreCount: number | bigint;
        rankingCount: number | bigint;
        handoffCount: number | bigint;
        opportunityCount: number | bigint;
        signalCount: number | bigint;
      }>
    >`
      SELECT
        (SELECT COUNT(*) FROM ci_verifications) AS evidenceCount,
        (SELECT COUNT(*) FROM ci_blockers WHERE resolved_at IS NOT NULL) AS recoveredBlockers,
        (SELECT COUNT(*) FROM ci_jobs WHERE status IN ('SUCCEEDED', 'COMPLETED') AND attempt_count > 0) AS recoveredJobs,
        (SELECT AVG(CAST(confidence AS float)) FROM ci_opportunities WHERE confidence IS NOT NULL) AS opportunityConfidenceAvg,
        (SELECT COUNT(*) FROM ci_scores) AS scoreCount,
        (SELECT COUNT(*) FROM ci_rankings) AS rankingCount,
        (SELECT COUNT(*) FROM ci_handoffs) AS handoffCount,
        (SELECT COUNT(*) FROM ci_opportunities) AS opportunityCount,
        (SELECT COUNT(*) FROM ci_signals) AS signalCount
    `;

    const strategy = packages[0]
      ? {
          versionId: packages[0].strategy_version_id,
          versionNumber: Number(packages[0].version_number),
          checksum: packages[0].checksum,
          status: packages[0].status,
        }
      : undefined;

    const run = runs[0]
      ? {
          id: runs[0].id,
          status: runs[0].status,
          startedAt: runs[0].started_at?.toISOString() ?? new Date().toISOString(),
          completedAt: runs[0].completed_at?.toISOString() ?? null,
          failureReason: runs[0].failure_reason,
        }
      : undefined;

    const stats = counts[0];
    const evidenceCount = Number(stats?.evidenceCount ?? 0);
    const recoveredJobs =
      Number(stats?.recoveredBlockers ?? 0) + Number(stats?.recoveredJobs ?? 0);
    const opportunityConfidenceAvg =
      stats?.opportunityConfidenceAvg != null && stats.opportunityConfidenceAvg !== ''
        ? Math.round(Number(stats.opportunityConfidenceAvg))
        : null;

    const events: AuditEventRecord[] = auditRows.map((row) => {
      const category = classifyCategory(row.action, row.reason);
      const actorType = normalizeActorType(row.actorType);
      const newObj = parseJsonObject(row.newValue);
      const prevObj = parseJsonObject(row.previousValue);
      const confidence =
        numField(newObj, 'confidence', 'aiConfidence', 'scoreConfidence') ??
        numField(prevObj, 'confidence');
      const model =
        strField(newObj, 'model', 'modelVersion', 'llm', 'embeddingModel') ?? null;
      const promptVersion =
        strField(newObj, 'promptVersion', 'prompt_version', 'systemPromptVersion') ?? null;
      const knowledgeVersion =
        strField(newObj, 'knowledgeVersion', 'knowledge_version', 'graphVersion') ?? null;
      const decision = decisionFromAction(row.action, row.reason);
      const { hash, signature } = signPayload([
        row.id,
        row.action,
        row.actorType,
        row.createdAt.toISOString(),
        row.previousValue,
        row.newValue,
        row.reason,
        row.correlationId,
        row.runId,
        row.opportunityId,
      ]);
      const durationMs =
        numField(newObj, 'durationMs', 'duration_ms', 'latencyMs', 'executionTimeMs') ?? null;

      return {
        id: `AUD-${row.id}`,
        timestamp: row.createdAt.toISOString(),
        workflow: 'Content Intelligence',
        stage: '02',
        module: moduleFromCategory(category),
        submodule: row.action,
        action: row.action,
        actor: row.actorReference ?? row.actorType ?? 'SYSTEM',
        actorType,
        aiAgent: actorType === 'AI' || actorType === 'SERVICE' ? row.actorReference ?? actorType : null,
        model,
        promptVersion,
        knowledgeVersion,
        strategyVersion: strategy ? `v${strategy.versionNumber}` : null,
        decision,
        confidence: confidence != null ? Math.round(confidence) : null,
        evidence: row.opportunityId ? `opportunity:${row.opportunityId}` : null,
        inputs: row.previousValue,
        outputs: row.newValue,
        durationMs,
        status: 'INTEGRITY_OK',
        correlationId: row.correlationId,
        requestId: row.requestId,
        runId: row.runId,
        opportunityId: row.opportunityId,
        digitalSignature: signature,
        contentHash: hash,
        category,
        reason: row.reason,
        previousValue: row.previousValue,
        newValue: row.newValue,
        explainability: buildExplainability({
          action: row.action,
          category,
          decision,
          reason: row.reason,
          previousValue: row.previousValue,
          newValue: row.newValue,
          actorType,
          confidence: confidence != null ? Math.round(confidence) : null,
        }),
        confidenceBreakdown: {
          overall: confidence != null ? Math.round(confidence) : opportunityConfidenceAvg,
          evidence: category === 'Evidence Verification' ? confidence : null,
          knowledge: category === 'Knowledge Gap' ? confidence : null,
          model: model ? confidence : null,
          prompt: promptVersion ? confidence : null,
          ranking: category === 'Ranking' || category === 'Scoring' ? confidence : null,
          portfolio: category === 'Portfolio Balance' ? confidence : null,
        },
        decisionChain: decisionChainFor(category),
        versions: {
          strategy: strategy ? `v${strategy.versionNumber}` : null,
          knowledge: knowledgeVersion,
          prompt: promptVersion,
          model,
          policy: null,
          graph: knowledgeVersion,
        },
      };
    });

    const categoryMap = new Map<AuditCategory, number>();
    for (const event of events) {
      categoryMap.set(event.category, (categoryMap.get(event.category) ?? 0) + 1);
    }
    const categories = [...categoryMap.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const timelineDefs: Array<{ key: string; label: string }> = [
      { key: 'strategy', label: 'Strategy Loaded' },
      { key: 'discovery', label: 'Discovery Started' },
      { key: 'signals', label: 'Signals Collected' },
      { key: 'evidence', label: 'Evidence Verified' },
      { key: 'candidate', label: 'Candidate Generated' },
      { key: 'duplicate', label: 'Duplicate Removed' },
      { key: 'ranking', label: 'Ranking Calculated' },
      { key: 'portfolio', label: 'Portfolio Balanced' },
      { key: 'recovery', label: 'Recovery Events' },
      { key: 'qualification', label: 'Qualification Completed' },
      { key: 'stage', label: 'Stage Completed' },
    ];

    const timelineBuckets = new Map<string, { count: number; at: string | null }>();
    for (const def of timelineDefs) {
      timelineBuckets.set(def.key, { count: 0, at: null });
    }
    for (const event of events) {
      const key = timelineKeyFor(event.category, event.action);
      if (!key) continue;
      const bucket = timelineBuckets.get(key);
      if (!bucket) continue;
      bucket.count += 1;
      if (!bucket.at || event.timestamp > bucket.at) bucket.at = event.timestamp;
    }
    // Enrich timeline counts from domain tables when audit rows are sparse
    const enrich: Array<[string, number]> = [
      ['signals', Number(stats?.signalCount ?? 0)],
      ['evidence', evidenceCount],
      ['candidate', Number(stats?.opportunityCount ?? 0)],
      ['ranking', Number(stats?.rankingCount ?? 0) + Number(stats?.scoreCount ?? 0)],
      ['qualification', Number(stats?.handoffCount ?? 0)],
      ['recovery', recoveredJobs],
    ];
    for (const [key, count] of enrich) {
      const bucket = timelineBuckets.get(key);
      if (!bucket) continue;
      if (bucket.count === 0 && count > 0) {
        bucket.count = count;
      }
    }
    if (strategy) {
      const bucket = timelineBuckets.get('strategy')!;
      if (bucket.count === 0) bucket.count = 1;
    }
    if (run) {
      const bucket = timelineBuckets.get('discovery')!;
      if (bucket.count === 0) bucket.count = 1;
      if (run.status === 'COMPLETED' || run.status === 'SUCCEEDED') {
        const stageBucket = timelineBuckets.get('stage')!;
        if (stageBucket.count === 0) stageBucket.count = 1;
        stageBucket.at = run.completedAt ?? stageBucket.at;
      }
    }

    const timeline: IntelligenceTimelineMarker[] = timelineDefs.map((def) => {
      const bucket = timelineBuckets.get(def.key)!;
      return {
        key: def.key,
        label: def.label,
        at: bucket.at,
        count: bucket.count,
        done: bucket.count > 0,
      };
    });

    const chainDefs: Array<{ key: string; label: string; categories: AuditCategory[] }> = [
      { key: 'strategy', label: 'Strategy', categories: ['Strategy'] },
      { key: 'signals', label: 'Signals', categories: ['Discovery', 'Signals', 'Trend Intelligence', 'Audience Demand'] },
      { key: 'evidence', label: 'Evidence', categories: ['Evidence Verification'] },
      { key: 'knowledge', label: 'Knowledge', categories: ['Knowledge Gap', 'Topic Opportunity', 'Candidate Generation'] },
      { key: 'scoring', label: 'Scoring', categories: ['Scoring', 'Duplicate Detection'] },
      { key: 'ranking', label: 'Ranking', categories: ['Ranking'] },
      { key: 'selection', label: 'Selection', categories: ['Portfolio Balance'] },
      { key: 'qualification', label: 'Qualification', categories: ['Qualification'] },
      { key: 'handoff', label: 'Handoff', categories: ['Qualification'] },
    ];

    const decisionChain: DecisionChainNode[] = chainDefs.map((node) => {
      const records = events.filter((event) => node.categories.includes(event.category)).length;
      const confidences = events
        .filter((event) => node.categories.includes(event.category))
        .map((event) => event.confidence)
        .filter((value): value is number => value != null);
      let state: DecisionChainNode['state'] = 'pending';
      if (records > 0) state = 'done';
      else if (
        (node.key === 'signals' && Number(stats?.signalCount ?? 0) > 0) ||
        (node.key === 'evidence' && evidenceCount > 0) ||
        (node.key === 'ranking' && Number(stats?.rankingCount ?? 0) > 0) ||
        (node.key === 'qualification' && Number(stats?.handoffCount ?? 0) > 0) ||
        (node.key === 'strategy' && Boolean(strategy))
      ) {
        state = 'active';
      }
      return {
        key: node.key,
        label: node.label,
        records:
          records ||
          (node.key === 'signals'
            ? Number(stats?.signalCount ?? 0)
            : node.key === 'evidence'
              ? evidenceCount
              : node.key === 'ranking'
                ? Number(stats?.rankingCount ?? 0)
                : node.key === 'qualification' || node.key === 'handoff'
                  ? Number(stats?.handoffCount ?? 0)
                  : 0),
        confidence: avg(confidences),
        state,
      };
    });

    const aiDecisions = events.filter((event) =>
      ['AI', 'SERVICE', 'SYSTEM'].includes(event.actorType),
    ).length;
    const humanOverrides = events.filter((event) =>
      ['HUMAN', 'USER', 'OPERATOR'].includes(event.actorType),
    ).length;
    const autonomousDecisions = events.filter((event) =>
      ['AI', 'SERVICE', 'SYSTEM'].includes(event.actorType),
    ).length;
    const policyViolations = events.filter(
      (event) =>
        event.category === 'Policy' &&
        /violat|fail|reject|block/i.test(`${event.action} ${event.reason ?? ''}`),
    ).length;
    const knowledgeChanges = events.filter(
      (event) =>
        event.category === 'Knowledge Gap' ||
        /knowledge|graph|embedding/i.test(event.action),
    ).length;
    const modelVersionSet = new Set(
      events.map((event) => event.model).filter((value): value is string => Boolean(value)),
    );
    const durations = events
      .map((event) => event.durationMs)
      .filter((value): value is number => value != null);
    const confidences = events
      .map((event) => event.confidence)
      .filter((value): value is number => value != null);

    const timelineDone = timeline.filter((item) => item.done).length;
    const coveragePct = pct(timelineDone, timeline.length);
    const integrityPct = events.length ? 100 : null;

    const learning = events
      .filter((event) => event.category === 'Recovery' || /learn|improv|adapt/i.test(event.action))
      .slice(0, 12)
      .map((event) => ({
        id: event.id,
        observation: event.decision,
        improvement: event.reason ?? 'Learning observation persisted without free-text improvement note',
        confidenceGain: event.confidence,
        at: event.timestamp,
      }));

    const policyChecks = [
      {
        id: 'content',
        policy: 'Content Policy',
        status: events.some((e) => e.category === 'Policy') ? 'EVALUATED' : 'UNMEASURED',
        detail: 'Dedicated policy verdict table not present; inferred from audit categories only',
      },
      {
        id: 'evidence',
        policy: 'Evidence Policy',
        status: evidenceCount > 0 ? 'OBSERVED' : 'UNMEASURED',
        detail: `${evidenceCount} verification rows persisted`,
      },
      {
        id: 'security',
        policy: 'Security Policy',
        status: events.some((e) => e.category === 'Security') ? 'EVALUATED' : 'UNMEASURED',
        detail: 'Security events sourced from audit action classification',
      },
      {
        id: 'integrity',
        policy: 'Audit Integrity',
        status: events.length ? 'SIGNED' : 'IDLE',
        detail: 'SHA-256 content hashes derived from immutable ledger fields',
      },
    ];

    const issues: AuditIssue[] = [];
    if (!strategy) {
      issues.push({
        id: 'no-strategy',
        severity: 'WARNING',
        code: 'STRATEGY_MISSING',
        message: 'No acknowledged Strategy Package — audit ledger awaiting Stage 01 handoff',
      });
    }
    if (events.length === 0 && strategy) {
      issues.push({
        id: 'empty-ledger',
        severity: 'INFO',
        code: 'LEDGER_EMPTY',
        message: 'Strategy acknowledged but no ci_audit_events persisted yet',
      });
    }
    if (policyViolations > 0) {
      issues.push({
        id: 'policy-violations',
        severity: 'CRITICAL',
        code: 'POLICY_VIOLATION',
        message: `${policyViolations} policy-related audit events require review`,
      });
    }

    const recommendations: IntelligenceAuditOverview['recommendations'] = [];
    if (humanOverrides > 0) {
      recommendations.push({
        id: 'review-overrides',
        action: 'Review human overrides for governance drift',
        reason: `${humanOverrides} human/operator audit actors recorded`,
        priority: 'MEDIUM',
      });
    }
    if (coveragePct != null && coveragePct < 50) {
      recommendations.push({
        id: 'expand-instrumentation',
        action: 'Expand Stage 02 audit instrumentation across sparse lifecycle nodes',
        reason: `Timeline coverage at ${coveragePct}%`,
        priority: 'HIGH',
      });
    }
    if (modelVersionSet.size === 0 && events.length > 0) {
      recommendations.push({
        id: 'persist-model-versions',
        action: 'Persist model / prompt versions in audit new_value payloads',
        reason: 'Model version fields currently UNMEASURED on ledger events',
        priority: 'MEDIUM',
      });
    }

    const aiConfidence = avg(confidences) ?? opportunityConfidenceAvg;
    const explainabilityScore =
      events.length > 0 ? Math.min(100, 55 + Math.round((confidences.length / events.length) * 45)) : null;

    return {
      available: true,
      strategy,
      run,
      meta: {
        ledgerStatus: events.length ? 'APPEND_ONLY' : strategy ? 'MONITORING' : 'AWAITING_STRATEGY',
        lastEventAt: events[0]?.timestamp ?? null,
        integrityPct,
        coveragePct,
      },
      metrics: {
        totalAuditEvents: events.length,
        aiDecisions,
        evidenceRecords: evidenceCount,
        policyViolations,
        recoveredJobs,
        autonomousDecisions,
        humanOverrides,
        aiConfidence,
        averageDecisionTimeMs: avg(durations),
        decisionAccuracy: null,
        workflowCompliance: coveragePct,
        auditIntegrity: integrityPct,
        digitalSignatures: events.length,
        immutableRecords: events.length,
        modelVersions: modelVersionSet.size > 0 ? modelVersionSet.size : null,
        knowledgeChanges,
      },
      governance: {
        complianceScore: coveragePct,
        auditCoverage: coveragePct,
        decisionTransparency: events.length ? pct(events.filter((e) => e.reason).length, events.length) : null,
        explainabilityScore,
        evidenceQuality: evidenceCount > 0 ? pct(evidenceCount, Math.max(evidenceCount, Number(stats?.opportunityCount ?? 0))) : null,
        governanceHealth: integrityPct,
        riskExposure: policyViolations > 0 ? Math.min(100, policyViolations * 10) : events.length ? 0 : null,
        policyCompliance: policyViolations === 0 && events.length > 0 ? 100 : policyViolations > 0 ? pct(events.length - policyViolations, events.length) : null,
      },
      categories,
      timeline,
      decisionChain,
      events,
      learning,
      policyChecks,
      recommendations,
      issues,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : 'Failed to load intelligence audit',
      meta: {
        ledgerStatus: 'UNAVAILABLE',
        lastEventAt: null,
        integrityPct: null,
        coveragePct: null,
      },
      metrics: {
        totalAuditEvents: 0,
        aiDecisions: 0,
        evidenceRecords: 0,
        policyViolations: 0,
        recoveredJobs: 0,
        autonomousDecisions: 0,
        humanOverrides: 0,
        aiConfidence: null,
        averageDecisionTimeMs: null,
        decisionAccuracy: null,
        workflowCompliance: null,
        auditIntegrity: null,
        digitalSignatures: 0,
        immutableRecords: 0,
        modelVersions: null,
        knowledgeChanges: 0,
      },
      governance: {
        complianceScore: null,
        auditCoverage: null,
        decisionTransparency: null,
        explainabilityScore: null,
        evidenceQuality: null,
        governanceHealth: null,
        riskExposure: null,
        policyCompliance: null,
      },
      categories: [],
      timeline: [],
      decisionChain: [],
      events: [],
      learning: [],
      policyChecks: [],
      recommendations: [],
      issues: [
        {
          id: 'load-failed',
          severity: 'CRITICAL',
          code: 'AUDIT_LOAD_FAILED',
          message: error instanceof Error ? error.message : 'Failed to load intelligence audit',
        },
      ],
      lastUpdated: new Date().toISOString(),
    };
  }
}
