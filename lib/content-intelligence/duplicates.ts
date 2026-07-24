import { prisma } from '@/lib/db';

export type DuplicateRecord = {
  id: string;
  opportunityId: string;
  title: string;
  summary: string;
  domain: string;
  status: string;
  clusterId: string;
  clusterLabel: string;
  similarity: number | null;
  measuredSimilarity: boolean;
  semanticOverlap: number | null;
  uniqueness: number | null;
  confidence: number | null;
  measuredConfidence: boolean;
  matchTitle: string | null;
  matchOpportunityId: string | null;
  evidenceCount: number;
  explanation: string | null;
  recommendedAction: 'merge' | 'keep' | 'reject' | 'review';
  resolutionStatus: 'open' | 'merged' | 'ignored' | 'resolved' | 'archived';
  nextStage: string;
  createdAt: string;
  updatedAt: string;
  evidenceSubjects: string[];
};

export type DuplicateCluster = {
  id: string;
  label: string;
  domain: string;
  size: number;
  avgSimilarity: number | null;
  maxSimilarity: number | null;
  openCount: number;
  memberIds: string[];
};

export type DuplicatePair = {
  id: string;
  leftId: string;
  rightId: string;
  leftTitle: string;
  rightTitle: string;
  similarity: number | null;
  measuredSimilarity: boolean;
  clusterId: string;
  recommendedAction: DuplicateRecord['recommendedAction'];
};

export type DuplicateIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  duplicateId?: string;
};

export type DuplicateDetectionOverview = {
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
  metrics: {
    itemsScanned: number;
    duplicates: number;
    measuredSimilarity: number;
    avgSimilarity: number | null;
    uniqueIdeas: number;
    merged: number;
    ignored: number;
    openClusters: number;
    highRisk: number;
  };
  records: DuplicateRecord[];
  clusters: DuplicateCluster[];
  pairs: DuplicatePair[];
  issues: DuplicateIssue[];
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
  summary: string;
  status: string;
  domain: string;
  duplicateSimilarity: number | string | null;
  confidence: number | string;
  riskScore: number | string | null;
  scoreExplanationJson: string | null;
  scoreExplanation: string | null;
  factorsJson: string | null;
  selectionStatus: string | null;
  evidenceCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
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

function strOrNull(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value);
}

function normalizeTopic(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clusterKey(title: string, domain: string): string {
  const normalized = normalizeTopic(title);
  const tokens = normalized.split(' ').filter(Boolean).slice(0, 4).join(' ');
  return `${domain.toLowerCase()}::${tokens || normalized.slice(0, 40)}`;
}

function tokenOverlap(a: string, b: string): number | null {
  const left = new Set(normalizeTopic(a).split(' ').filter((t) => t.length > 2));
  const right = new Set(normalizeTopic(b).split(' ').filter((t) => t.length > 2));
  if (!left.size || !right.size) return null;
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  const denom = Math.max(left.size, right.size);
  return Math.round((shared / denom) * 100);
}

function resolutionStatus(
  status: string,
  selectionStatus: string | null,
  explanation: Record<string, unknown>,
): DuplicateRecord['resolutionStatus'] {
  const action = String(
    explanation.duplicateAction ?? explanation.resolution ?? explanation.action ?? '',
  ).toUpperCase();
  const selection = (selectionStatus ?? '').toUpperCase();
  const st = status.toUpperCase();

  if (st === 'ARCHIVED' || selection === 'ARCHIVED' || action === 'ARCHIVE') return 'archived';
  if (st === 'MERGED' || selection === 'MERGED' || action === 'MERGE') return 'merged';
  if (
    st === 'REJECTED' ||
    selection === 'IGNORED' ||
    selection === 'REJECTED' ||
    action === 'IGNORE' ||
    action === 'REJECT'
  ) {
    return 'ignored';
  }
  if (selection === 'RESOLVED' || action === 'KEEP' || action === 'RESOLVED') return 'resolved';
  return 'open';
}

function recommendedAction(
  similarity: number | null,
  resolution: DuplicateRecord['resolutionStatus'],
  explanation: Record<string, unknown>,
): DuplicateRecord['recommendedAction'] {
  const explicit = String(
    explanation.recommendedAction ?? explanation.duplicateRecommendation ?? '',
  ).toLowerCase();
  if (explicit === 'merge' || explicit === 'keep' || explicit === 'reject' || explicit === 'review') {
    return explicit;
  }
  if (resolution === 'merged') return 'merge';
  if (resolution === 'ignored') return 'reject';
  if (resolution === 'resolved') return 'keep';
  if (similarity == null) return 'review';
  if (similarity >= 85) return 'merge';
  if (similarity >= 70) return 'review';
  if (similarity >= 50) return 'keep';
  return 'keep';
}

function nextStageFor(
  resolution: DuplicateRecord['resolutionStatus'],
  status: string,
  similarity: number | null,
): string {
  if (resolution === 'archived') return 'Archived — excluded from qualification';
  if (resolution === 'merged') return 'Merged — retain canonical idea for Stage 03';
  if (resolution === 'ignored') return 'Ignored / rejected — recovery if reopened';
  if (resolution === 'resolved') return 'Resolved — ready for Stage 03 Idea Qualification';
  if (similarity != null && similarity >= 70) return 'Awaiting duplicate resolution';
  if (status === 'QUALIFIED' || status === 'HANDED_OFF' || status === 'VERIFIED') {
    return 'Ready for Stage 03 Idea Qualification';
  }
  return 'Continue scan / compare before qualification';
}

function deriveIssues(
  records: DuplicateRecord[],
  clusters: DuplicateCluster[],
): DuplicateIssue[] {
  const issues: DuplicateIssue[] = [];

  for (const item of records) {
    if (item.measuredSimilarity && (item.similarity ?? 0) >= 85 && item.resolutionStatus === 'open') {
      issues.push({
        id: `${item.id}-high`,
        severity: 'CRITICAL',
        code: 'HIGH_SIMILARITY',
        message: `Open duplicate risk (${item.similarity}%) on “${item.title}”.`,
        duplicateId: item.id,
      });
    } else if (
      item.measuredSimilarity &&
      (item.similarity ?? 0) >= 70 &&
      item.resolutionStatus === 'open'
    ) {
      issues.push({
        id: `${item.id}-warn`,
        severity: 'WARNING',
        code: 'DUPLICATE_CANDIDATE',
        message: `Similarity ${item.similarity}% needs resolution for “${item.title}”.`,
        duplicateId: item.id,
      });
    }
  }

  for (const cluster of clusters) {
    if (cluster.size >= 3 && cluster.openCount > 0) {
      issues.push({
        id: `cluster-${cluster.id}`,
        severity: 'WARNING',
        code: 'CLUSTER_OVERFLOW',
        message: `Cluster “${cluster.label}” has ${cluster.size} related ideas (${cluster.openCount} open).`,
      });
    }
  }

  return issues.slice(0, 40);
}

export async function loadDuplicateDetection(): Promise<DuplicateDetectionOverview> {
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
        o.summary,
        o.status,
        o.domain,
        o.duplicate_similarity AS duplicateSimilarity,
        o.confidence,
        o.risk_score AS riskScore,
        o.score_explanation_json AS scoreExplanationJson,
        (
          SELECT TOP 1 s.explanation
          FROM ci_scores s
          WHERE s.opportunity_id = o.id
          ORDER BY s.scored_at DESC
        ) AS scoreExplanation,
        (
          SELECT TOP 1 s.factors_json
          FROM ci_scores s
          WHERE s.opportunity_id = o.id
          ORDER BY s.scored_at DESC
        ) AS factorsJson,
        (
          SELECT TOP 1 rk.selection_status
          FROM ci_rankings rk
          WHERE rk.opportunity_id = o.id
          ORDER BY rk.ranked_at DESC
        ) AS selectionStatus,
        (
          SELECT COUNT(*)
          FROM ci_opportunity_signals os
          WHERE os.opportunity_id = o.id
        ) AS evidenceCount,
        o.created_at AS createdAt,
        o.updated_at AS updatedAt
      FROM ci_opportunities o
      ORDER BY
        CASE WHEN o.duplicate_similarity IS NULL THEN 0 ELSE o.duplicate_similarity END DESC,
        o.updated_at DESC
    `;

    const signalRows = await prisma.$queryRaw<
      Array<{ opportunityId: string; subject: string }>
    >`
      SELECT TOP 400
        CONVERT(varchar(36), os.opportunity_id) AS opportunityId,
        sig.subject
      FROM ci_opportunity_signals os
      INNER JOIN ci_signals sig ON sig.id = os.signal_id
      ORDER BY sig.created_at DESC
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
         OR action LIKE '%DUPLICATE%'
         OR action LIKE '%OPPORTUNITY%'
      ORDER BY created_at DESC
    `;

    const subjectsByOpportunity = new Map<string, string[]>();
    for (const row of signalRows) {
      const list = subjectsByOpportunity.get(row.opportunityId) ?? [];
      if (list.length < 6) list.push(row.subject);
      subjectsByOpportunity.set(row.opportunityId, list);
    }

    const draft = rows.map((row) => {
      const explanationJson = {
        ...parseJson(row.scoreExplanationJson),
        ...parseJson(row.factorsJson),
      };
      const similarity =
        numOrNull(row.duplicateSimilarity) ??
        numOrNull(
          explanationJson.duplicateSimilarity ??
            explanationJson.similarity ??
            explanationJson.similarityScore,
        );
      const measuredSimilarity = similarity != null;
      const confidence = numOrNull(row.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;
      const key =
        strOrNull(explanationJson.clusterKey ?? explanationJson.clusterId) ??
        clusterKey(row.title, row.domain);
      const matchOpportunityId = strOrNull(
        explanationJson.matchOpportunityId ??
          explanationJson.matchedOpportunityId ??
          explanationJson.duplicateOf ??
          explanationJson.peerOpportunityId,
      );
      const matchTitle = strOrNull(
        explanationJson.matchTitle ?? explanationJson.matchedTitle ?? explanationJson.duplicateTitle,
      );
      const resolution = resolutionStatus(row.status, row.selectionStatus, explanationJson);
      const action = recommendedAction(similarity, resolution, explanationJson);
      const uniqueness =
        measuredSimilarity && similarity != null
          ? Math.max(0, Math.round(100 - similarity))
          : null;

      return {
        id: row.id,
        opportunityId: row.id,
        title: row.title,
        summary: row.summary,
        domain: row.domain,
        status: row.status,
        clusterId: key,
        clusterLabel: key.includes('::') ? key.split('::')[1] || row.domain : row.domain,
        similarity,
        measuredSimilarity,
        semanticOverlap: null as number | null,
        uniqueness,
        confidence,
        measuredConfidence,
        matchTitle,
        matchOpportunityId,
        evidenceCount: Number(row.evidenceCount ?? 0),
        explanation:
          strOrNull(row.scoreExplanation) ??
          strOrNull(explanationJson.explanation ?? explanationJson.duplicateExplanation),
        recommendedAction: action,
        resolutionStatus: resolution,
        nextStage: nextStageFor(resolution, row.status, similarity),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        evidenceSubjects: subjectsByOpportunity.get(row.id) ?? [],
      } satisfies DuplicateRecord;
    });

    // Resolve fuzzy match peers within cluster when explicit match ids are absent.
    const byCluster = new Map<string, typeof draft>();
    for (const item of draft) {
      const list = byCluster.get(item.clusterId) ?? [];
      list.push(item);
      byCluster.set(item.clusterId, list);
    }

    const records: DuplicateRecord[] = draft.map((item) => {
      const peers = (byCluster.get(item.clusterId) ?? []).filter((peer) => peer.id !== item.id);
      let matchOpportunityId = item.matchOpportunityId;
      let matchTitle = item.matchTitle;
      let semanticOverlap = item.semanticOverlap;

      if (!matchOpportunityId && peers.length) {
        let best: { peer: (typeof peers)[0]; overlap: number } | null = null;
        for (const peer of peers) {
          const overlap = tokenOverlap(item.title, peer.title);
          if (overlap == null) continue;
          if (!best || overlap > best.overlap) best = { peer, overlap };
        }
        if (best) {
          matchOpportunityId = best.peer.id;
          matchTitle = best.peer.title;
          semanticOverlap = best.overlap;
        }
      } else if (matchOpportunityId) {
        const peer = draft.find((row) => row.id === matchOpportunityId);
        if (peer) {
          matchTitle = matchTitle ?? peer.title;
          semanticOverlap = tokenOverlap(item.title, peer.title);
        }
      }

      return {
        ...item,
        matchOpportunityId,
        matchTitle,
        semanticOverlap,
      };
    });

    const clusters: DuplicateCluster[] = [...byCluster.entries()]
      .map(([id, members]) => {
        const sims = members
          .filter((m) => m.measuredSimilarity && m.similarity != null)
          .map((m) => m.similarity as number);
        return {
          id,
          label: members[0]?.clusterLabel ?? id,
          domain: members[0]?.domain ?? '—',
          size: members.length,
          avgSimilarity:
            sims.length > 0
              ? Math.round(sims.reduce((sum, n) => sum + n, 0) / sims.length)
              : null,
          maxSimilarity: sims.length > 0 ? Math.max(...sims) : null,
          openCount: members.filter((m) => m.resolutionStatus === 'open').length,
          memberIds: members.map((m) => m.id),
        };
      })
      .filter((cluster) => cluster.size > 1 || (cluster.maxSimilarity ?? 0) >= 50)
      .sort((a, b) => (b.maxSimilarity ?? 0) - (a.maxSimilarity ?? 0) || b.size - a.size);

    const pairKeys = new Set<string>();
    const pairs: DuplicatePair[] = [];
    for (const item of records) {
      if (!item.matchOpportunityId) continue;
      const peer = records.find((row) => row.id === item.matchOpportunityId);
      if (!peer) continue;
      const key = [item.id, peer.id].sort().join(':');
      if (pairKeys.has(key)) continue;
      pairKeys.add(key);
      const similarity =
        item.similarity ?? peer.similarity ?? item.semanticOverlap ?? peer.semanticOverlap;
      pairs.push({
        id: key,
        leftId: item.id,
        rightId: peer.id,
        leftTitle: item.title,
        rightTitle: peer.title,
        similarity,
        measuredSimilarity: item.measuredSimilarity || peer.measuredSimilarity,
        clusterId: item.clusterId,
        recommendedAction:
          (item.similarity ?? 0) >= (peer.similarity ?? 0)
            ? item.recommendedAction
            : peer.recommendedAction,
      });
    }
    pairs.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

    const measuredSims = records
      .filter((item) => item.measuredSimilarity && item.similarity != null)
      .map((item) => item.similarity as number);
    const avgSimilarity =
      measuredSims.length > 0
        ? Math.round(measuredSims.reduce((sum, n) => sum + n, 0) / measuredSims.length)
        : null;

    const duplicates = records.filter(
      (item) => item.measuredSimilarity && (item.similarity ?? 0) >= 70,
    ).length;
    const uniqueIdeas = records.filter(
      (item) =>
        !item.measuredSimilarity ||
        (item.similarity != null && item.similarity < 50) ||
        item.resolutionStatus === 'resolved',
    ).length;
    const merged = records.filter((item) => item.resolutionStatus === 'merged').length;
    const ignored = records.filter((item) => item.resolutionStatus === 'ignored').length;
    const highRisk = records.filter(
      (item) =>
        item.resolutionStatus === 'open' &&
        item.measuredSimilarity &&
        (item.similarity ?? 0) >= 85,
    ).length;

    const packageRow = packages[0];
    const run = runs[0];

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
      metrics: {
        itemsScanned: records.length,
        duplicates,
        measuredSimilarity: measuredSims.length,
        avgSimilarity,
        uniqueIdeas,
        merged,
        ignored,
        openClusters: clusters.filter((c) => c.openCount > 0).length,
        highRisk,
      },
      records,
      clusters,
      pairs,
      issues: deriveIssues(records, clusters),
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
          : 'Duplicate detection unavailable. Run the Content Intelligence migration.',
      metrics: {
        itemsScanned: 0,
        duplicates: 0,
        measuredSimilarity: 0,
        avgSimilarity: null,
        uniqueIdeas: 0,
        merged: 0,
        ignored: 0,
        openClusters: 0,
        highRisk: 0,
      },
      records: [],
      clusters: [],
      pairs: [],
      issues: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
