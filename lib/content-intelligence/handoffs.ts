import { prisma } from '@/lib/db';

export type HandoffDependency = {
  key: string;
  label: string;
  present: boolean;
  detail: string | null;
};

export type HandoffPackage = {
  id: string;
  packageId: string;
  opportunityId: string;
  title: string;
  domain: string;
  audience: string | null;
  geography: string | null;
  formatHint: string | null;
  opportunityStatus: string;
  handoffStatus: string;
  priority: number | null;
  score: number;
  measuredScore: boolean;
  confidence: number | null;
  measuredConfidence: boolean;
  rankPosition: number | null;
  selectionStatus: string | null;
  evidenceCount: number;
  verificationPassed: number;
  verificationFailed: number;
  duplicateSimilarity: number | null;
  riskScore: number | null;
  retryCount: number;
  checksum: string;
  idempotencyKey: string;
  acknowledgedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  latencyMs: number | null;
  transferTimeMs: number | null;
  receivingModule: string;
  strategyVersion: number | null;
  strategyChecksum: string | null;
  modelVersion: string | null;
  digitalSignature: string;
  integrityScore: number | null;
  completenessScore: number | null;
  validationScore: number | null;
  aiConfidence: number | null;
  dependencies: HandoffDependency[];
  dependencyErrors: number;
  missingFields: string[];
  packageSizeBytes: number | null;
  timeline: Array<{ key: string; label: string; at: string | null; done: boolean }>;
  recommendation: string;
  explainability: string;
  nextStage: string;
};

export type HandoffIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  packageId?: string;
};

export type HandoffPipelineNode = {
  key: string;
  label: string;
  recordsProcessed: number;
  durationMs: number | null;
  queueDepth: number;
  aiConfidence: number | null;
  healthScore: number | null;
  retries: number;
  state: 'pending' | 'active' | 'done' | 'failed';
};

export type QualificationHandoffsOverview = {
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
    receivingModuleStatus: string;
    receivingOnline: boolean | null;
    lastTransfer: string | null;
    averagePackageSize: number | null;
    queueStatus: string;
  };
  metrics: {
    ready: number;
    packagesGenerated: number;
    successful: number;
    failed: number;
    pendingValidation: number;
    dependencyErrors: number;
    averageHandoffTimeMs: number | null;
    aiConfidence: number | null;
    digitalSignatures: number;
    queueSize: number;
    retryQueue: number;
    rollbackQueue: number;
    transferSuccessRate: number | null;
    packageIntegrity: number | null;
    receivingModuleStatus: string;
    averagePackageSize: number | null;
  };
  receiving: {
    module: string;
    status: string;
    pending: number;
    acknowledged: number;
    rejected: number;
    failed: number;
    averageProcessingMs: number | null;
    latencyMs: number | null;
    availability: number | null;
  };
  integrity: {
    integrityPct: number | null;
    missingFields: number;
    warnings: number;
    validationErrors: number;
    dependencyIssues: number;
    brokenReferences: number;
    metadataCompleteness: number | null;
    evidenceCompleteness: number | null;
    overallHealth: number | null;
  };
  pipeline: HandoffPipelineNode[];
  packages: HandoffPackage[];
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  issues: HandoffIssue[];
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

type HandoffRow = {
  handoffId: string | null;
  opportunityId: string;
  title: string;
  summary: string;
  domain: string;
  geography: string | null;
  audience: string | null;
  formatHint: string | null;
  opportunityStatus: string;
  score: number | string;
  confidence: number | string;
  riskScore: number | string | null;
  duplicateSimilarity: number | string | null;
  handoffStatus: string | null;
  retryCount: number | bigint | null;
  checksum: string | null;
  idempotencyKey: string | null;
  acknowledgedAt: Date | null;
  failureReason: string | null;
  createdAt: Date | null;
  opportunityCreatedAt: Date;
  opportunityUpdatedAt: Date;
  evidenceCount: number | bigint;
  verificationPassed: number | bigint;
  verificationFailed: number | bigint;
  rankPosition: number | string | null;
  selectionStatus: string | null;
  totalScore: number | string | null;
  modelVersion: string | null;
  scoreExplanation: string | null;
};

function numOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
}

function isTerminalSuccess(status: string) {
  const s = status.toUpperCase();
  return s === 'ACKNOWLEDGED' || s === 'COMPLETED' || s === 'IMPORTED' || s === 'READY';
}

function isFailed(status: string) {
  const s = status.toUpperCase();
  return s === 'FAILED' || s === 'REJECTED' || s === 'ROLLED_BACK';
}

function isPending(status: string) {
  const s = status.toUpperCase();
  return (
    s === 'PENDING' ||
    s === 'QUEUED' ||
    s === 'VALIDATING' ||
    s === 'SIGNED' ||
    s === 'TRANSFERRED' ||
    s === 'RETRY' ||
    s === 'RETRYING'
  );
}

function buildDependencies(input: {
  hasStrategy: boolean;
  evidenceCount: number;
  verificationPassed: number;
  verificationFailed: number;
  hasRank: boolean;
  hasScore: boolean;
  hasAudience: boolean;
  hasGeography: boolean;
  duplicateSimilarity: number | null;
  receivingOnline: boolean | null;
}): HandoffDependency[] {
  return [
    {
      key: 'strategy',
      label: 'Strategy package',
      present: input.hasStrategy,
      detail: input.hasStrategy ? 'ACKNOWLEDGED strategy package present' : 'No ACK strategy package',
    },
    {
      key: 'evidence',
      label: 'Evidence references',
      present: input.evidenceCount > 0,
      detail: `${input.evidenceCount} linked signal(s)`,
    },
    {
      key: 'verification',
      label: 'Verification complete',
      present: input.verificationPassed > 0 && input.verificationFailed === 0,
      detail: `passed ${input.verificationPassed} · failed ${input.verificationFailed}`,
    },
    {
      key: 'ranking',
      label: 'Ranking complete',
      present: input.hasRank,
      detail: input.hasRank ? 'Rank position persisted' : 'No ci_rankings row',
    },
    {
      key: 'scoring',
      label: 'Score finalized',
      present: input.hasScore,
      detail: input.hasScore ? 'ci_scores total_score present' : 'No measured score',
    },
    {
      key: 'audience',
      label: 'Audience profile',
      present: input.hasAudience,
      detail: input.hasAudience ? 'Audience set' : 'Audience missing',
    },
    {
      key: 'geography',
      label: 'Country / geography profile',
      present: input.hasGeography,
      detail: input.hasGeography ? 'Geography set' : 'Geography missing',
    },
    {
      key: 'duplicates',
      label: 'Duplicate clearance',
      present: input.duplicateSimilarity == null || input.duplicateSimilarity < 70,
      detail:
        input.duplicateSimilarity == null
          ? 'No duplicate_similarity persisted'
          : `similarity ${input.duplicateSimilarity}`,
    },
    {
      key: 'receiving',
      label: 'Receiving stage online',
      present: input.receivingOnline !== false,
      detail:
        input.receivingOnline == null
          ? 'Receiving availability UNMEASURED'
          : input.receivingOnline
            ? 'Receiving module reachable'
            : 'Receiving module offline',
    },
  ];
}

function integrityFrom(deps: HandoffDependency[], missingFields: string[]): number {
  const present = deps.filter((item) => item.present).length;
  const base = Math.round((present / Math.max(1, deps.length)) * 100);
  const penalty = Math.min(40, missingFields.length * 5);
  return Math.max(0, base - penalty);
}

export async function loadQualificationHandoffs(): Promise<QualificationHandoffsOverview> {
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

    const rows = await prisma.$queryRaw<HandoffRow[]>`
      SELECT TOP 200
        CONVERT(varchar(36), h.id) AS handoffId,
        CONVERT(varchar(36), o.id) AS opportunityId,
        o.title,
        o.summary,
        o.domain,
        o.geography,
        o.audience,
        o.format_hint AS formatHint,
        o.status AS opportunityStatus,
        o.score,
        o.confidence,
        o.risk_score AS riskScore,
        o.duplicate_similarity AS duplicateSimilarity,
        h.status AS handoffStatus,
        h.retry_count AS retryCount,
        h.checksum,
        h.idempotency_key AS idempotencyKey,
        h.acknowledged_at AS acknowledgedAt,
        h.failure_reason AS failureReason,
        h.created_at AS createdAt,
        o.created_at AS opportunityCreatedAt,
        o.updated_at AS opportunityUpdatedAt,
        (
          SELECT COUNT(*)
          FROM ci_opportunity_signals os
          WHERE os.opportunity_id = o.id
        ) AS evidenceCount,
        (
          SELECT COUNT(*)
          FROM ci_verifications v
          WHERE v.opportunity_id = o.id AND v.status IN ('PASSED', 'VERIFIED', 'ACCEPTED')
        ) AS verificationPassed,
        (
          SELECT COUNT(*)
          FROM ci_verifications v
          WHERE v.opportunity_id = o.id AND v.status IN ('FAILED', 'REJECTED')
        ) AS verificationFailed,
        (
          SELECT TOP 1 rk.rank_position
          FROM ci_rankings rk
          WHERE rk.opportunity_id = o.id
          ORDER BY rk.ranked_at DESC
        ) AS rankPosition,
        (
          SELECT TOP 1 rk.selection_status
          FROM ci_rankings rk
          WHERE rk.opportunity_id = o.id
          ORDER BY rk.ranked_at DESC
        ) AS selectionStatus,
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
        ) AS modelVersion,
        (
          SELECT TOP 1 s.explanation
          FROM ci_scores s
          WHERE s.opportunity_id = o.id
          ORDER BY s.scored_at DESC
        ) AS scoreExplanation
      FROM ci_opportunities o
      LEFT JOIN ci_handoffs h ON h.opportunity_id = o.id
      WHERE
        h.id IS NOT NULL
        OR o.status IN ('QUALIFIED', 'HANDED_OFF', 'VERIFIED')
        OR EXISTS (
          SELECT 1 FROM ci_rankings rk
          WHERE rk.opportunity_id = o.id
            AND rk.selection_status IN ('SELECTED', 'APPROVED', 'SHORTLISTED', 'HANDED_OFF')
        )
      ORDER BY
        CASE WHEN h.created_at IS NULL THEN o.updated_at ELSE h.created_at END DESC
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
         OR action LIKE '%HANDOFF%'
         OR action LIKE '%TRANSFER%'
         OR action LIKE '%QUALIF%'
         OR opportunity_id IS NOT NULL
      ORDER BY created_at DESC
    `;

    const packageRow = packages[0];
    const run = runs[0];
    const hasStrategy = Boolean(packageRow);
    const receivingOnline: boolean | null = null;

    const handoffPackages: HandoffPackage[] = rows.map((row) => {
      const score = numOrNull(row.totalScore) ?? Number(row.score) ?? 0;
      const measuredScore = Number.isFinite(score) && score > 0;
      const confidence = numOrNull(row.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;
      const evidenceCount = Number(row.evidenceCount ?? 0);
      const verificationPassed = Number(row.verificationPassed ?? 0);
      const verificationFailed = Number(row.verificationFailed ?? 0);
      const rankPosition = row.rankPosition != null ? Number(row.rankPosition) : null;
      const duplicateSimilarity =
        row.duplicateSimilarity != null ? Number(row.duplicateSimilarity) : null;
      const handoffStatus = row.handoffStatus ?? 'READY';
      const checksum = row.checksum ?? '';
      const createdAt = (row.createdAt ?? row.opportunityUpdatedAt).toISOString();
      const acknowledgedAt = row.acknowledgedAt?.toISOString() ?? null;
      const transferTimeMs =
        row.acknowledgedAt && row.createdAt
          ? Math.max(0, row.acknowledgedAt.getTime() - row.createdAt.getTime())
          : null;
      const latencyMs = transferTimeMs;

      const deps = buildDependencies({
        hasStrategy,
        evidenceCount,
        verificationPassed,
        verificationFailed,
        hasRank: rankPosition != null,
        hasScore: measuredScore,
        hasAudience: Boolean(row.audience?.trim()),
        hasGeography: Boolean(row.geography?.trim()),
        duplicateSimilarity,
        receivingOnline,
      });
      const dependencyErrors = deps.filter((item) => !item.present).length;
      const missingFields: string[] = [];
      if (!row.audience?.trim()) missingFields.push('audience');
      if (!row.geography?.trim()) missingFields.push('geography');
      if (!row.formatHint?.trim()) missingFields.push('format');
      if (!measuredScore) missingFields.push('score');
      if (!checksum) missingFields.push('checksum');

      const integrityScore = integrityFrom(deps, missingFields);
      const completenessScore = Math.round(
        (([
          Boolean(row.audience),
          Boolean(row.geography),
          Boolean(row.formatHint),
          measuredScore,
          evidenceCount > 0,
          rankPosition != null,
        ].filter(Boolean).length /
          6) *
          100),
      );
      const validationScore = Math.round(
        ((deps.filter((item) => item.present).length / Math.max(1, deps.length)) * 100),
      );

      const packageId = row.handoffId ?? `ready-${row.opportunityId}`;
      const digitalSignature = checksum
        ? `sha256:${checksum.slice(0, 16)}…`
        : 'UNMEASURED';

      const timeline = [
        {
          key: 'created',
          label: 'Package Created',
          at: row.handoffId ? createdAt : null,
          done: Boolean(row.handoffId),
        },
        {
          key: 'validated',
          label: 'Validation Complete',
          at: dependencyErrors === 0 && row.handoffId ? createdAt : null,
          done: dependencyErrors === 0 && Boolean(row.handoffId),
        },
        {
          key: 'signed',
          label: 'Package Signed',
          at: checksum ? createdAt : null,
          done: Boolean(checksum),
        },
        {
          key: 'queued',
          label: 'Transfer Started',
          at: isPending(handoffStatus) || isTerminalSuccess(handoffStatus) ? createdAt : null,
          done: isPending(handoffStatus) || isTerminalSuccess(handoffStatus) || isFailed(handoffStatus),
        },
        {
          key: 'received',
          label: 'Received',
          at: isTerminalSuccess(handoffStatus) ? acknowledgedAt ?? createdAt : null,
          done: isTerminalSuccess(handoffStatus),
        },
        {
          key: 'acknowledged',
          label: 'Acknowledged',
          at: acknowledgedAt,
          done: Boolean(acknowledgedAt) || isTerminalSuccess(handoffStatus),
        },
        {
          key: 'imported',
          label: 'Imported / Ready',
          at: row.opportunityStatus === 'HANDED_OFF' ? acknowledgedAt ?? createdAt : null,
          done: row.opportunityStatus === 'HANDED_OFF' || isTerminalSuccess(handoffStatus),
        },
      ];

      let recommendation = 'Await packaging';
      let explainability =
        row.scoreExplanation ??
        'No persisted explanation — dependency and integrity scores are authoritative.';
      if (!row.handoffId) {
        recommendation =
          dependencyErrors === 0
            ? 'Ready for autonomous packaging'
            : 'Resolve dependencies before transfer';
        explainability = `Opportunity is qualified for handoff with ${dependencyErrors} dependency gap(s).`;
      } else if (isTerminalSuccess(handoffStatus)) {
        recommendation = 'Transfer complete — Stage 03 may consume';
        explainability = `Package ${packageId} acknowledged by Idea Qualification.`;
      } else if (isFailed(handoffStatus)) {
        recommendation = 'Retry / rebuild package';
        explainability =
          row.failureReason ??
          `Handoff status ${handoffStatus} — recovery workers should rebuild checksum and retry.`;
      } else if (dependencyErrors > 0) {
        recommendation = 'Hold for dependency repair';
        explainability = `Missing: ${deps
          .filter((item) => !item.present)
          .map((item) => item.label)
          .join(', ')}`;
      } else {
        recommendation = 'Continue autonomous transfer';
      }

      return {
        id: packageId,
        packageId,
        opportunityId: row.opportunityId,
        title: row.title,
        domain: row.domain,
        audience: row.audience,
        geography: row.geography,
        formatHint: row.formatHint,
        opportunityStatus: row.opportunityStatus,
        handoffStatus,
        priority: rankPosition,
        score,
        measuredScore,
        confidence,
        measuredConfidence,
        rankPosition,
        selectionStatus: row.selectionStatus,
        evidenceCount,
        verificationPassed,
        verificationFailed,
        duplicateSimilarity,
        riskScore: row.riskScore != null ? Number(row.riskScore) : null,
        retryCount: Number(row.retryCount ?? 0),
        checksum,
        idempotencyKey: row.idempotencyKey ?? '',
        acknowledgedAt,
        failureReason: row.failureReason,
        createdAt,
        latencyMs,
        transferTimeMs,
        receivingModule: 'Idea Qualification',
        strategyVersion: packageRow ? Number(packageRow.version_number) : null,
        strategyChecksum: packageRow?.checksum ?? null,
        modelVersion: row.modelVersion,
        digitalSignature,
        integrityScore,
        completenessScore,
        validationScore,
        aiConfidence: measuredConfidence ? confidence : validationScore,
        dependencies: deps,
        dependencyErrors,
        missingFields,
        packageSizeBytes: null,
        timeline,
        recommendation,
        explainability,
        nextStage: isTerminalSuccess(handoffStatus)
          ? 'Stage 03 – Idea Qualification'
          : isFailed(handoffStatus)
            ? 'Recovery / retry queue'
            : 'Await receiving acknowledgement',
      };
    });

    // Dedupe by opportunity — prefer rows with handoff ids
    const byOpportunity = new Map<string, HandoffPackage>();
    for (const item of handoffPackages) {
      const existing = byOpportunity.get(item.opportunityId);
      if (!existing) {
        byOpportunity.set(item.opportunityId, item);
        continue;
      }
      const preferNew =
        (item.checksum && !existing.checksum) ||
        (item.handoffStatus !== 'READY' && existing.handoffStatus === 'READY');
      if (preferNew) byOpportunity.set(item.opportunityId, item);
    }
    const packagesList = [...byOpportunity.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    const withHandoff = packagesList.filter((item) => !item.packageId.startsWith('ready-'));
    const successful = packagesList.filter((item) => isTerminalSuccess(item.handoffStatus));
    const failed = packagesList.filter((item) => isFailed(item.handoffStatus));
    const pendingValidation = packagesList.filter(
      (item) =>
        item.dependencyErrors > 0 ||
        item.handoffStatus === 'PENDING' ||
        item.handoffStatus === 'VALIDATING' ||
        item.packageId.startsWith('ready-'),
    );
    const retryQueue = packagesList.filter(
      (item) =>
        item.retryCount > 0 ||
        item.handoffStatus.toUpperCase() === 'RETRY' ||
        item.handoffStatus.toUpperCase() === 'RETRYING',
    );
    const rollbackQueue = packagesList.filter(
      (item) => item.handoffStatus.toUpperCase() === 'ROLLED_BACK',
    );
    const queueSize = packagesList.filter(
      (item) => isPending(item.handoffStatus) || item.packageId.startsWith('ready-'),
    ).length;
    const dependencyErrors = packagesList.reduce((sum, item) => sum + item.dependencyErrors, 0);
    const transferTimes = packagesList
      .map((item) => item.transferTimeMs)
      .filter((value): value is number => value != null);
    const integrityValues = packagesList
      .map((item) => item.integrityScore)
      .filter((value): value is number => value != null);
    const confValues = packagesList
      .map((item) => item.aiConfidence)
      .filter((value): value is number => value != null);
    const signatures = packagesList.filter((item) => Boolean(item.checksum)).length;
    const transferSuccessRate =
      withHandoff.length > 0
        ? Math.round((successful.length / withHandoff.length) * 1000) / 10
        : null;

    const ready = packagesList.filter(
      (item) =>
        item.packageId.startsWith('ready-') ||
        (item.dependencyErrors === 0 && !isTerminalSuccess(item.handoffStatus) && !isFailed(item.handoffStatus)),
    ).length;

    const missingFieldsTotal = packagesList.reduce(
      (sum, item) => sum + item.missingFields.length,
      0,
    );
    const warnings = packagesList.filter(
      (item) => item.dependencyErrors > 0 || item.missingFields.length > 0,
    ).length;
    const validationErrors = failed.length + packagesList.filter((item) => item.verificationFailed > 0).length;
    const brokenReferences = packagesList.filter(
      (item) => item.evidenceCount === 0 && item.measuredScore,
    ).length;

    const issues: HandoffIssue[] = [];
    for (const item of packagesList) {
      if (isFailed(item.handoffStatus)) {
        issues.push({
          id: `${item.id}-fail`,
          severity: 'CRITICAL',
          code: 'TRANSFER_FAILED',
          message: `Package “${item.title}” failed: ${item.failureReason ?? item.handoffStatus}`,
          packageId: item.id,
        });
      }
      if (item.dependencyErrors > 0) {
        issues.push({
          id: `${item.id}-deps`,
          severity: 'WARNING',
          code: 'DEPENDENCY_MISSING',
          message: `${item.dependencyErrors} dependency gap(s) on “${item.title}”.`,
          packageId: item.id,
        });
      }
      if (isTerminalSuccess(item.handoffStatus)) {
        issues.push({
          id: `${item.id}-ok`,
          severity: 'INFO',
          code: 'PACKAGE_ACKNOWLEDGED',
          message: `Package acknowledged for “${item.title}”.`,
          packageId: item.id,
        });
      }
    }

    const recommendations = [
      queueSize > 5
        ? {
            id: 'batch',
            action: 'Increase batch size for transfer workers',
            reason: `Queue size is ${queueSize}.`,
            priority: 'MEDIUM' as const,
          }
        : null,
      failed.length > 0
        ? {
            id: 'retry-failed',
            action: 'Rebuild and retry failed packages',
            reason: `${failed.length} failed transfer(s) in queue.`,
            priority: 'HIGH' as const,
          }
        : null,
      dependencyErrors > 0
        ? {
            id: 'deps',
            action: 'Repair missing dependencies before signing',
            reason: `${dependencyErrors} dependency error(s) across packages.`,
            priority: 'HIGH' as const,
          }
        : null,
      brokenReferences > 0
        ? {
            id: 'evidence',
            action: 'Improve evidence quality on scored packages',
            reason: `${brokenReferences} scored package(s) lack evidence links.`,
            priority: 'MEDIUM' as const,
          }
        : null,
      transferSuccessRate != null && transferSuccessRate < 80
        ? {
            id: 'latency',
            action: 'Reduce transfer latency / receiving capacity',
            reason: `Success rate ${transferSuccessRate}% is below 80%.`,
            priority: 'MEDIUM' as const,
          }
        : null,
    ].filter(Boolean) as QualificationHandoffsOverview['recommendations'];

    const lastTransfer =
      packagesList
        .map((item) => item.acknowledgedAt ?? (item.checksum ? item.createdAt : null))
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    const pipelineBase: Array<Omit<HandoffPipelineNode, 'state'>> = [
      {
        key: 'qualified',
        label: 'Qualified Opportunity',
        recordsProcessed: packagesList.length,
        durationMs: null,
        queueDepth: ready,
        aiConfidence: avg(confValues),
        healthScore: avg(integrityValues),
        retries: packagesList.reduce((sum, item) => sum + item.retryCount, 0),
      },
      {
        key: 'deps',
        label: 'Dependency Validation',
        recordsProcessed: packagesList.filter((item) => item.dependencyErrors === 0).length,
        durationMs: null,
        queueDepth: pendingValidation.length,
        aiConfidence: avg(
          packagesList.map((item) => item.validationScore).filter((v): v is number => v != null),
        ),
        healthScore: avg(
          packagesList.map((item) => item.validationScore).filter((v): v is number => v != null),
        ),
        retries: 0,
      },
      {
        key: 'evidence',
        label: 'Evidence Packaging',
        recordsProcessed: packagesList.filter((item) => item.evidenceCount > 0).length,
        durationMs: null,
        queueDepth: packagesList.filter((item) => item.evidenceCount === 0).length,
        aiConfidence: avg(confValues),
        healthScore: packagesList.length
          ? Math.round(
              (packagesList.filter((item) => item.evidenceCount > 0).length /
                packagesList.length) *
                100,
            )
          : null,
        retries: 0,
      },
      {
        key: 'metadata',
        label: 'Metadata Assembly',
        recordsProcessed: packagesList.filter((item) => item.missingFields.length === 0).length,
        durationMs: null,
        queueDepth: missingFieldsTotal,
        aiConfidence: avg(
          packagesList
            .map((item) => item.completenessScore)
            .filter((v): v is number => v != null),
        ),
        healthScore: avg(
          packagesList
            .map((item) => item.completenessScore)
            .filter((v): v is number => v != null),
        ),
        retries: 0,
      },
      {
        key: 'cert',
        label: 'AI Certification',
        recordsProcessed: withHandoff.length,
        durationMs: null,
        queueDepth: ready,
        aiConfidence: avg(confValues),
        healthScore: avg(integrityValues),
        retries: 0,
      },
      {
        key: 'sign',
        label: 'Digital Signature',
        recordsProcessed: signatures,
        durationMs: null,
        queueDepth: packagesList.filter((item) => !item.checksum).length,
        aiConfidence: avg(integrityValues),
        healthScore: packagesList.length
          ? Math.round((signatures / packagesList.length) * 100)
          : null,
        retries: 0,
      },
      {
        key: 'queue',
        label: 'Transfer Queue',
        recordsProcessed: queueSize,
        durationMs: null,
        queueDepth: queueSize,
        aiConfidence: avg(confValues),
        healthScore: transferSuccessRate,
        retries: retryQueue.reduce((sum, item) => sum + item.retryCount, 0),
      },
      {
        key: 'ack',
        label: 'Receiving Acknowledgement',
        recordsProcessed: successful.length,
        durationMs: avg(transferTimes),
        queueDepth: failed.length,
        aiConfidence: avg(confValues),
        healthScore: transferSuccessRate,
        retries: retryQueue.length,
      },
      {
        key: 'iq',
        label: 'Idea Qualification',
        recordsProcessed: successful.length,
        durationMs: avg(transferTimes),
        queueDepth: 0,
        aiConfidence: avg(confValues),
        healthScore: transferSuccessRate,
        retries: 0,
      },
    ];

    const runStatus = run?.status ?? 'IDLE';
    const activeIndex = !packageRow
      ? -1
      : packagesList.length === 0
        ? 0
        : failed.length > 0
          ? 7
          : successful.length > 0
            ? 8
            : queueSize > 0
              ? 6
              : 1;

    const pipeline: HandoffPipelineNode[] = pipelineBase.map((node, index) => ({
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

    const packageIntegrity = avg(integrityValues);
    const metadataCompleteness = avg(
      packagesList.map((item) => item.completenessScore).filter((v): v is number => v != null),
    );
    const evidenceCompleteness = packagesList.length
      ? Math.round(
          (packagesList.filter((item) => item.evidenceCount > 0).length / packagesList.length) *
            100,
        )
      : null;

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
        receivingModuleStatus: 'Idea Qualification · availability UNMEASURED',
        receivingOnline,
        lastTransfer,
        averagePackageSize: null,
        queueStatus: queueSize
          ? `${queueSize} in queue`
          : successful.length
            ? 'Clear'
            : packageRow
              ? 'Idle'
              : 'Blocked',
      },
      metrics: {
        ready,
        packagesGenerated: withHandoff.length,
        successful: successful.length,
        failed: failed.length,
        pendingValidation: pendingValidation.length,
        dependencyErrors,
        averageHandoffTimeMs: avg(transferTimes),
        aiConfidence: avg(confValues),
        digitalSignatures: signatures,
        queueSize,
        retryQueue: retryQueue.length,
        rollbackQueue: rollbackQueue.length,
        transferSuccessRate,
        packageIntegrity,
        receivingModuleStatus: 'UNMEASURED',
        averagePackageSize: null,
      },
      receiving: {
        module: 'Idea Qualification',
        status: 'UNMEASURED',
        pending: queueSize,
        acknowledged: successful.length,
        rejected: packagesList.filter((item) => item.handoffStatus.toUpperCase() === 'REJECTED')
          .length,
        failed: failed.length,
        averageProcessingMs: avg(transferTimes),
        latencyMs: avg(transferTimes),
        availability: null,
      },
      integrity: {
        integrityPct: packageIntegrity,
        missingFields: missingFieldsTotal,
        warnings,
        validationErrors,
        dependencyIssues: dependencyErrors,
        brokenReferences,
        metadataCompleteness,
        evidenceCompleteness,
        overallHealth: packageIntegrity,
      },
      pipeline,
      packages: packagesList,
      recommendations,
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
          : 'Qualification handoffs unavailable. Run the Content Intelligence migration.',
      meta: {
        receivingModuleStatus: 'Unavailable',
        receivingOnline: null,
        lastTransfer: null,
        averagePackageSize: null,
        queueStatus: 'Unavailable',
      },
      metrics: {
        ready: 0,
        packagesGenerated: 0,
        successful: 0,
        failed: 0,
        pendingValidation: 0,
        dependencyErrors: 0,
        averageHandoffTimeMs: null,
        aiConfidence: null,
        digitalSignatures: 0,
        queueSize: 0,
        retryQueue: 0,
        rollbackQueue: 0,
        transferSuccessRate: null,
        packageIntegrity: null,
        receivingModuleStatus: 'UNAVAILABLE',
        averagePackageSize: null,
      },
      receiving: {
        module: 'Idea Qualification',
        status: 'UNAVAILABLE',
        pending: 0,
        acknowledged: 0,
        rejected: 0,
        failed: 0,
        averageProcessingMs: null,
        latencyMs: null,
        availability: null,
      },
      integrity: {
        integrityPct: null,
        missingFields: 0,
        warnings: 0,
        validationErrors: 0,
        dependencyIssues: 0,
        brokenReferences: 0,
        metadataCompleteness: null,
        evidenceCompleteness: null,
        overallHealth: null,
      },
      pipeline: [],
      packages: [],
      recommendations: [],
      issues: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
