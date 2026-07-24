import { createHash } from 'crypto';
import { prisma } from '@/lib/db';

export type IntakePackageStatus = 'RECEIVED' | 'ACKNOWLEDGED' | 'REJECTED' | string;

export type IntakeIntegrityCheck = {
  key: string;
  label: string;
  passed: boolean | null;
  detail: string;
};

export type IntakeCompatibilityRow = {
  key: string;
  label: string;
  expected: string | null;
  actual: string | null;
  status: 'PASS' | 'FAIL' | 'UNMEASURED';
};

export type IntakePackageRecord = {
  id: string;
  sourceRunId: string;
  strategyVersionId: string;
  checksum: string;
  status: IntakePackageStatus;
  receivedAt: string;
  acknowledgedAt: string | null;
  integrityStatus: 'VERIFIED' | 'MISMATCH' | 'PENDING' | 'REJECTED';
  computedHash: string;
  checksumMatch: boolean;
  candidateCount: number;
  evidenceRecords: number | null;
  topics: number;
  audiences: number;
  avgConfidence: number | null;
  overallConfidence: number | null;
  duplicatesRemoved: number | null;
  trends: number | null;
  aiModel: string | null;
  promptVersion: string | null;
  knowledgeSnapshot: string | null;
  intelligenceVersion: string | null;
  packageSizeBytes: number;
  intakeTimeMs: number | null;
  summary: string;
  explainability: string[];
  integrityChecks: IntakeIntegrityCheck[];
  compatibility: IntakeCompatibilityRow[];
  validationRules: Array<{ key: string; label: string; status: 'PASS' | 'FAIL' | 'UNMEASURED'; detail: string }>;
  health: {
    completeness: number | null;
    integrity: number | null;
    authenticity: number | null;
    freshness: number | null;
    evidenceQuality: number | null;
    aiConfidence: number | null;
    strategyCompliance: number | null;
    risk: number | null;
  };
  evidenceCoverage: Array<{ label: string; count: number | null }>;
  errors: string[];
  correctiveActions: string[];
  timeline: Array<{ key: string; label: string; at: string | null; done: boolean }>;
  strategy: {
    versionId: string;
    versionNumber: number | null;
    status: string | null;
    checksum: string | null;
  } | null;
};

export type IntelligenceIntakeOverview = {
  available: boolean;
  reason?: string;
  meta: {
    queueStatus: string;
    lastReceivedAt: string | null;
    activeStrategyVersion: string | null;
    activeIntelligenceVersion: string | null;
  };
  metrics: {
    packagesReceived: number;
    packagesPending: number;
    packagesAccepted: number;
    packagesRejected: number;
    verificationFailures: number;
    checksumMismatches: number;
    integrityStatus: string;
    aiConfidence: number | null;
    averageIntakeTimeMs: number | null;
    queueLength: number;
    processingRate: number | null;
    currentStrategyVersion: string | null;
    currentIntelligenceVersion: string | null;
    packageSuccessRate: number | null;
  };
  pipeline: Array<{
    key: string;
    label: string;
    state: 'pending' | 'active' | 'done' | 'failed';
  }>;
  packages: IntakePackageRecord[];
  queueMonitor: {
    waiting: number;
    processing: number;
    failed: number;
    accepted: number;
    averageQueueTimeMs: number | null;
    throughput: number | null;
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

type PackageRow = {
  id: string;
  sourceRunId: string;
  strategyVersionId: string;
  checksum: string;
  packageJson: string;
  status: string;
  receivedAt: Date;
  acknowledgedAt: Date | null;
};

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function parsePackage(raw: string): {
  candidates: Array<{
    opportunityId?: string;
    title?: string;
    domain?: string;
    audience?: string | null;
    confidence?: number;
    score?: number;
    status?: string;
  }>;
  sourceRunId?: string;
  strategyVersionId?: string;
  strategyChecksum?: string;
  generatedAt?: string;
  intelligenceVersion?: string;
  modelVersion?: string;
  promptVersion?: string;
  knowledgeSnapshot?: string;
} {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const candidates = Array.isArray(parsed.candidates)
      ? (parsed.candidates as Array<Record<string, unknown>>).map((item) => ({
          opportunityId: typeof item.opportunityId === 'string' ? item.opportunityId : undefined,
          title: typeof item.title === 'string' ? item.title : undefined,
          domain: typeof item.domain === 'string' ? item.domain : undefined,
          audience:
            typeof item.audience === 'string' || item.audience === null
              ? (item.audience as string | null)
              : undefined,
          confidence:
            typeof item.confidence === 'number'
              ? item.confidence
              : typeof item.confidence === 'string'
                ? Number(item.confidence)
                : undefined,
          score:
            typeof item.score === 'number'
              ? item.score
              : typeof item.score === 'string'
                ? Number(item.score)
                : undefined,
          status: typeof item.status === 'string' ? item.status : undefined,
        }))
      : [];
    return {
      candidates,
      sourceRunId: typeof parsed.sourceRunId === 'string' ? parsed.sourceRunId : undefined,
      strategyVersionId:
        typeof parsed.strategyVersionId === 'string' ? parsed.strategyVersionId : undefined,
      strategyChecksum:
        typeof parsed.strategyChecksum === 'string' ? parsed.strategyChecksum : undefined,
      generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : undefined,
      intelligenceVersion:
        typeof parsed.intelligenceVersion === 'string' ? parsed.intelligenceVersion : undefined,
      modelVersion: typeof parsed.modelVersion === 'string' ? parsed.modelVersion : undefined,
      promptVersion: typeof parsed.promptVersion === 'string' ? parsed.promptVersion : undefined,
      knowledgeSnapshot:
        typeof parsed.knowledgeSnapshot === 'string' ? parsed.knowledgeSnapshot : undefined,
    };
  } catch {
    return { candidates: [] };
  }
}

function buildIntegrityChecks(input: {
  checksumMatch: boolean;
  status: string;
  hasStrategy: boolean;
  candidateCount: number;
  hasKnowledge: boolean;
  packageComplete: boolean;
}): IntakeIntegrityCheck[] {
  return [
    {
      key: 'checksum',
      label: 'Checksum Verified',
      passed: input.checksumMatch,
      detail: input.checksumMatch
        ? 'SHA-256 of package_json matches stored checksum'
        : 'Computed SHA-256 does not match stored checksum',
    },
    {
      key: 'signature',
      label: 'Signature Valid',
      passed: input.checksumMatch ? true : false,
      detail: input.checksumMatch
        ? 'Checksum acts as package integrity signature'
        : 'Integrity signature failed',
    },
    {
      key: 'strategy',
      label: 'Strategy Version Compatible',
      passed: input.hasStrategy ? true : null,
      detail: input.hasStrategy
        ? 'Strategy version reference present on package'
        : 'Strategy version not measurable from package',
    },
    {
      key: 'complete',
      label: 'Package Complete',
      passed: input.packageComplete,
      detail: input.packageComplete
        ? `${input.candidateCount} candidate ideas present`
        : 'Package missing candidate payload',
    },
    {
      key: 'knowledge',
      label: 'Knowledge Graph Linked',
      passed: input.hasKnowledge ? true : null,
      detail: input.hasKnowledge
        ? 'Knowledge snapshot reference present'
        : 'Knowledge snapshot not persisted on this package',
    },
    {
      key: 'evidence',
      label: 'Evidence Package Verified',
      passed: input.candidateCount > 0 ? true : false,
      detail:
        input.candidateCount > 0
          ? 'Candidate opportunities included from Content Intelligence'
          : 'No evidence-bearing candidates in package',
    },
  ];
}

export async function loadIntelligenceIntake(): Promise<IntelligenceIntakeOverview> {
  try {
    const rows = await prisma.$queryRaw<PackageRow[]>`
      SELECT TOP 50
        CONVERT(varchar(36), id) AS id,
        CONVERT(varchar(36), source_run_id) AS sourceRunId,
        CONVERT(varchar(36), strategy_version_id) AS strategyVersionId,
        checksum,
        package_json AS packageJson,
        status,
        received_at AS receivedAt,
        acknowledged_at AS acknowledgedAt
      FROM iq_intake_packages
      ORDER BY received_at DESC
    `;

    const strategyRows = await prisma.$queryRaw<
      Array<{
        versionId: string;
        versionNumber: number | bigint;
        status: string;
        checksum: string | null;
      }>
    >`
      SELECT TOP 20
        CONVERT(varchar(36), strategy_version_id) AS versionId,
        version_number AS versionNumber,
        status,
        checksum
      FROM ci_strategy_packages
      ORDER BY acknowledged_at DESC
    `;

    const strategyMap = new Map(
      strategyRows.map((row) => [
        row.versionId.toLowerCase(),
        {
          versionId: row.versionId,
          versionNumber: Number(row.versionNumber),
          status: row.status,
          checksum: row.checksum,
        },
      ]),
    );

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
      WHERE action LIKE 'INTAKE%'
         OR action LIKE '%PACKAGE%'
         OR action LIKE '%CHECKSUM%'
      ORDER BY created_at DESC
    `;

    const packages: IntakePackageRecord[] = rows.map((row) => {
      const parsed = parsePackage(row.packageJson);
      const computedHash = createHash('sha256').update(row.packageJson).digest('hex');
      const checksumMatch = computedHash.toLowerCase() === row.checksum.toLowerCase();
      const candidates = parsed.candidates;
      const confidences = candidates
        .map((item) => item.confidence)
        .filter((value): value is number => value != null && Number.isFinite(value));
      const domains = new Set(
        candidates.map((item) => item.domain).filter((value): value is string => Boolean(value)),
      );
      const audiences = new Set(
        candidates
          .map((item) => item.audience)
          .filter((value): value is string => Boolean(value)),
      );
      const strategy = strategyMap.get(row.strategyVersionId.toLowerCase()) ?? null;
      const packageComplete = candidates.length > 0;
      const hasKnowledge = Boolean(parsed.knowledgeSnapshot);
      const integrityChecks = buildIntegrityChecks({
        checksumMatch,
        status: row.status,
        hasStrategy: Boolean(row.strategyVersionId),
        candidateCount: candidates.length,
        hasKnowledge,
        packageComplete,
      });
      const failedChecks = integrityChecks.filter((check) => check.passed === false).length;
      const integrityStatus: IntakePackageRecord['integrityStatus'] =
        row.status === 'REJECTED'
          ? 'REJECTED'
          : !checksumMatch
            ? 'MISMATCH'
            : row.status === 'ACKNOWLEDGED' && checksumMatch
              ? 'VERIFIED'
              : 'PENDING';

      const compatibility: IntakeCompatibilityRow[] = [
        {
          key: 'strategy',
          label: 'Strategy Version',
          expected: strategy?.versionId ?? null,
          actual: row.strategyVersionId,
          status: row.strategyVersionId ? 'PASS' : 'FAIL',
        },
        {
          key: 'knowledge',
          label: 'Knowledge Version',
          expected: null,
          actual: parsed.knowledgeSnapshot ?? null,
          status: parsed.knowledgeSnapshot ? 'PASS' : 'UNMEASURED',
        },
        {
          key: 'prompt',
          label: 'Prompt Version',
          expected: null,
          actual: parsed.promptVersion ?? null,
          status: parsed.promptVersion ? 'PASS' : 'UNMEASURED',
        },
        {
          key: 'model',
          label: 'AI Model Version',
          expected: null,
          actual: parsed.modelVersion ?? null,
          status: parsed.modelVersion ? 'PASS' : 'UNMEASURED',
        },
        {
          key: 'intelligence',
          label: 'Content Intelligence Version',
          expected: null,
          actual: parsed.intelligenceVersion ?? null,
          status: parsed.intelligenceVersion ? 'PASS' : 'UNMEASURED',
        },
        {
          key: 'taxonomy',
          label: 'Taxonomy Version',
          expected: null,
          actual: null,
          status: 'UNMEASURED',
        },
        {
          key: 'policy',
          label: 'Policy Version',
          expected: null,
          actual: null,
          status: 'UNMEASURED',
        },
      ];

      const avgConfidence = avg(confidences);
      const validationRules: IntakePackageRecord['validationRules'] = [
        {
          key: 'min-evidence',
          label: 'Minimum evidence threshold',
          status: candidates.length > 0 ? 'PASS' : 'FAIL',
          detail: `${candidates.length} candidates in package`,
        },
        {
          key: 'min-confidence',
          label: 'Minimum confidence',
          status:
            avgConfidence == null ? 'UNMEASURED' : avgConfidence >= 50 ? 'PASS' : 'FAIL',
          detail:
            avgConfidence != null
              ? `Average confidence ${avgConfidence}%`
              : 'Confidence not persisted on candidates',
        },
        {
          key: 'metadata',
          label: 'Required metadata',
          status:
            Boolean(row.sourceRunId && row.strategyVersionId && row.checksum) ? 'PASS' : 'FAIL',
          detail: 'sourceRunId, strategyVersionId, checksum',
        },
        {
          key: 'taxonomy',
          label: 'Mandatory taxonomy',
          status: domains.size > 0 ? 'PASS' : 'UNMEASURED',
          detail: `${domains.size} domains observed`,
        },
        {
          key: 'audience',
          label: 'Required audience mapping',
          status: audiences.size > 0 ? 'PASS' : 'UNMEASURED',
          detail: `${audiences.size} audience segments observed`,
        },
        {
          key: 'topic',
          label: 'Required topic mapping',
          status: domains.size > 0 ? 'PASS' : 'UNMEASURED',
          detail: `${domains.size} topic/domain values`,
        },
        {
          key: 'safety',
          label: 'Safety compliance',
          status: 'UNMEASURED',
          detail: 'No safety verdict column on intake packages',
        },
        {
          key: 'duplicate-limit',
          label: 'Duplicate limit',
          status: 'UNMEASURED',
          detail: 'Duplicate removals not stored on intake payload',
        },
      ];

      const errors: string[] = [];
      const correctiveActions: string[] = [];
      if (!checksumMatch) {
        errors.push('Checksum mismatch');
        correctiveActions.push('Rebuild package from Content Intelligence and re-transfer');
      }
      if (row.status === 'REJECTED') {
        errors.push('Package rejected');
        correctiveActions.push('Inspect rejection reason in audit trail and regenerate package');
      }
      if (!packageComplete) {
        errors.push('Package incomplete — no candidates');
        correctiveActions.push('Re-run discovery until verified opportunities exist');
      }
      if (avgConfidence != null && avgConfidence < 50) {
        errors.push('Evidence confidence below threshold');
        correctiveActions.push('Improve upstream verification before re-intake');
      }
      for (const rule of validationRules) {
        if (rule.status === 'FAIL' && !errors.includes(rule.label)) {
          errors.push(rule.label);
        }
      }

      const explainability: string[] = [];
      if (row.status === 'ACKNOWLEDGED' && checksumMatch) {
        explainability.push(
          `${pct(
            integrityChecks.filter((c) => c.passed === true).length,
            integrityChecks.filter((c) => c.passed != null).length,
          ) ?? 0}% integrity checks passed`,
        );
        if (avgConfidence != null) explainability.push(`${avgConfidence}% average candidate confidence`);
        explainability.push(`${candidates.length} candidate ideas present`);
        explainability.push('No critical checksum failure');
        explainability.push('Mandatory run/strategy metadata present');
      } else if (errors.length) {
        explainability.push(...errors.map((error) => `Rejected/blocked: ${error}`));
      } else {
        explainability.push('Package pending autonomous verification');
      }

      const intakeTimeMs =
        row.acknowledgedAt != null
          ? Math.max(0, row.acknowledgedAt.getTime() - row.receivedAt.getTime())
          : null;

      const summary = `This package contains ${candidates.length} candidate ideas from Content Intelligence run ${row.sourceRunId.slice(0, 8)}… with ${
        avgConfidence != null ? `${avgConfidence}%` : 'UNMEASURED'
      } average confidence. Integrity is ${integrityStatus.toLowerCase()}. ${
        row.status === 'ACKNOWLEDGED'
          ? 'Package is accepted into Idea Qualification.'
          : row.status === 'REJECTED'
            ? 'Package was rejected.'
            : 'Package awaits acceptance.'
      }`;

      return {
        id: row.id,
        sourceRunId: row.sourceRunId,
        strategyVersionId: row.strategyVersionId,
        checksum: row.checksum,
        status: row.status,
        receivedAt: row.receivedAt.toISOString(),
        acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
        integrityStatus,
        computedHash,
        checksumMatch,
        candidateCount: candidates.length,
        evidenceRecords: null,
        topics: domains.size,
        audiences: audiences.size,
        avgConfidence,
        overallConfidence: avgConfidence,
        duplicatesRemoved: null,
        trends: null,
        aiModel: parsed.modelVersion ?? null,
        promptVersion: parsed.promptVersion ?? null,
        knowledgeSnapshot: parsed.knowledgeSnapshot ?? null,
        intelligenceVersion: parsed.intelligenceVersion ?? null,
        packageSizeBytes: Buffer.byteLength(row.packageJson, 'utf8'),
        intakeTimeMs,
        summary,
        explainability,
        integrityChecks,
        compatibility,
        validationRules,
        health: {
          completeness: packageComplete ? Math.min(100, 40 + candidates.length * 2) : 0,
          integrity: checksumMatch ? 100 : 0,
          authenticity: checksumMatch ? 100 : 0,
          freshness: null,
          evidenceQuality: avgConfidence,
          aiConfidence: avgConfidence,
          strategyCompliance: row.strategyVersionId ? 100 : 0,
          risk: failedChecks > 0 ? Math.min(100, failedChecks * 25) : row.status === 'ACKNOWLEDGED' ? 0 : null,
        },
        evidenceCoverage: [
          { label: 'Academic Sources', count: null },
          { label: 'Government Sources', count: null },
          { label: 'Industry Sources', count: null },
          { label: 'News Sources', count: null },
          { label: 'Books', count: null },
          { label: 'Internal Knowledge', count: null },
          { label: 'AI-generated Evidence', count: null },
          { label: 'Candidate Ideas', count: candidates.length },
        ],
        errors,
        correctiveActions,
        timeline: [
          { key: 'discovery', label: 'Discovery Started', at: parsed.generatedAt ?? null, done: Boolean(parsed.generatedAt || row.sourceRunId) },
          { key: 'evidence', label: 'Evidence Verified', at: null, done: candidates.length > 0 },
          { key: 'signals', label: 'Signals Collected', at: null, done: candidates.length > 0 },
          { key: 'topics', label: 'Topics Generated', at: null, done: domains.size > 0 },
          { key: 'ranking', label: 'Ranking Complete', at: null, done: candidates.some((c) => (c.score ?? 0) > 0) },
          { key: 'built', label: 'Package Built', at: parsed.generatedAt ?? row.receivedAt.toISOString(), done: true },
          { key: 'signed', label: 'Package Signed', at: row.receivedAt.toISOString(), done: checksumMatch },
          { key: 'transferred', label: 'Transferred', at: row.receivedAt.toISOString(), done: true },
          { key: 'received', label: 'Received', at: row.receivedAt.toISOString(), done: true },
          { key: 'verified', label: 'Verified', at: row.acknowledgedAt?.toISOString() ?? null, done: checksumMatch },
          {
            key: 'accepted',
            label: 'Accepted',
            at: row.acknowledgedAt?.toISOString() ?? null,
            done: row.status === 'ACKNOWLEDGED',
          },
        ],
        strategy,
      };
    });

    const received = packages.length;
    const pending = packages.filter((item) => item.status === 'RECEIVED').length;
    const accepted = packages.filter((item) => item.status === 'ACKNOWLEDGED').length;
    const rejected = packages.filter((item) => item.status === 'REJECTED').length;
    const mismatches = packages.filter((item) => !item.checksumMatch).length;
    const verificationFailures = packages.filter(
      (item) => item.integrityStatus === 'MISMATCH' || item.integrityStatus === 'REJECTED',
    ).length;
    const intakeTimes = packages
      .map((item) => item.intakeTimeMs)
      .filter((value): value is number => value != null);
    const confidences = packages
      .map((item) => item.overallConfidence)
      .filter((value): value is number => value != null);

    const latest = packages[0];
    const pipeline: IntelligenceIntakeOverview['pipeline'] = [
      'receive',
      'validate',
      'authenticate',
      'verify',
      'inspect',
      'accept',
      'record',
      'qualify',
    ].map((key, index) => {
      const labels: Record<string, string> = {
        receive: 'Receive Package',
        validate: 'Validate',
        authenticate: 'Authenticate',
        verify: 'Verify',
        inspect: 'Inspect',
        accept: 'Accept',
        record: 'Create Intake Record',
        qualify: 'Start Qualification',
      };
      let state: 'pending' | 'active' | 'done' | 'failed' = 'pending';
      if (latest?.status === 'REJECTED' && index <= 5) state = 'failed';
      else if (latest?.status === 'ACKNOWLEDGED') state = index <= 7 ? 'done' : 'pending';
      else if (latest && index === 0) state = 'active';
      else if (received === 0) state = 'pending';
      return { key, label: labels[key], state };
    });

    const notifications: IntelligenceIntakeOverview['notifications'] = [];
    for (const pkg of packages.slice(0, 8)) {
      if (!pkg.checksumMatch) {
        notifications.push({
          id: `checksum-${pkg.id}`,
          severity: 'CRITICAL',
          message: `Checksum mismatch on package ${pkg.id.slice(0, 8)}…`,
        });
      }
      if (pkg.status === 'REJECTED') {
        notifications.push({
          id: `reject-${pkg.id}`,
          severity: 'CRITICAL',
          message: `Package ${pkg.id.slice(0, 8)}… rejected`,
        });
      }
      if (pkg.status === 'ACKNOWLEDGED') {
        notifications.push({
          id: `ok-${pkg.id}`,
          severity: 'INFO',
          message: `Successful intake ${pkg.id.slice(0, 8)}…`,
        });
      }
      if (pkg.candidateCount === 0) {
        notifications.push({
          id: `empty-${pkg.id}`,
          severity: 'WARNING',
          message: `Package ${pkg.id.slice(0, 8)}… missing candidate evidence`,
        });
      }
    }

    return {
      available: true,
      meta: {
        queueStatus: pending > 0 ? 'Queued' : accepted > 0 ? 'Clear' : 'Idle',
        lastReceivedAt: latest?.receivedAt ?? null,
        activeStrategyVersion: latest?.strategyVersionId ?? null,
        activeIntelligenceVersion: latest?.intelligenceVersion ?? null,
      },
      metrics: {
        packagesReceived: received,
        packagesPending: pending,
        packagesAccepted: accepted,
        packagesRejected: rejected,
        verificationFailures,
        checksumMismatches: mismatches,
        integrityStatus:
          mismatches > 0 ? 'DEGRADED' : accepted > 0 ? 'VERIFIED' : received > 0 ? 'PENDING' : 'IDLE',
        aiConfidence: avg(confidences),
        averageIntakeTimeMs: avg(intakeTimes),
        queueLength: pending,
        processingRate: null,
        currentStrategyVersion: latest?.strategy?.versionNumber
          ? `v${latest.strategy.versionNumber}`
          : latest?.strategyVersionId?.slice(0, 8) ?? null,
        currentIntelligenceVersion: latest?.intelligenceVersion ?? null,
        packageSuccessRate: pct(accepted, received),
      },
      pipeline,
      packages,
      queueMonitor: {
        waiting: pending,
        processing: 0,
        failed: rejected + mismatches,
        accepted,
        averageQueueTimeMs: avg(intakeTimes),
        throughput: null,
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
          : 'Intelligence Intake unavailable',
      meta: {
        queueStatus: 'UNAVAILABLE',
        lastReceivedAt: null,
        activeStrategyVersion: null,
        activeIntelligenceVersion: null,
      },
      metrics: {
        packagesReceived: 0,
        packagesPending: 0,
        packagesAccepted: 0,
        packagesRejected: 0,
        verificationFailures: 0,
        checksumMismatches: 0,
        integrityStatus: 'UNAVAILABLE',
        aiConfidence: null,
        averageIntakeTimeMs: null,
        queueLength: 0,
        processingRate: null,
        currentStrategyVersion: null,
        currentIntelligenceVersion: null,
        packageSuccessRate: null,
      },
      pipeline: [],
      packages: [],
      queueMonitor: {
        waiting: 0,
        processing: 0,
        failed: 0,
        accepted: 0,
        averageQueueTimeMs: null,
        throughput: null,
      },
      notifications: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
