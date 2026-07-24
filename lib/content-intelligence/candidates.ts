import {
  loadTopicOpportunities,
  type TopicOpportunityRecord,
} from './topic-opportunities';

export type CandidateIdeaRecord = TopicOpportunityRecord & {
  uniqueness: number | null;
  estimatedImpact: number | null;
  nextStage: string;
};

export type CandidateIdeaIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  candidateId?: string;
};

export type CandidateIdeasOverview = {
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
    candidateIdeas: number;
    measuredAiScore: number;
    avgAiScore: number | null;
    highPriority: number;
    ready: number;
    rejected: number;
    qualified: number;
    measuredConfidence: number;
    avgConfidence: number | null;
    duplicates: number;
    blocked: number;
  };
  candidates: CandidateIdeaRecord[];
  issues: CandidateIdeaIssue[];
  audit: Array<{
    id: string;
    action: string;
    actorType: string;
    createdAt: string;
    reason: string | null;
  }>;
  lastUpdated: string;
};

function nextStageFor(status: string, handoffStatus: string | null): string {
  if (status === 'HANDED_OFF' || handoffStatus === 'ACKNOWLEDGED') {
    return 'Stage 03 – Idea Qualification (acknowledged)';
  }
  if (status === 'QUALIFIED' || status === 'VERIFIED') {
    return 'Ready for Stage 03 handoff';
  }
  if (status === 'REJECTED' || status === 'BLOCKED') {
    return 'Blocked — recovery / re-evaluation';
  }
  if (status === 'ENRICHING' || status === 'DISCOVERED') {
    return 'Enrichment / scoring in progress';
  }
  return 'Awaiting verification & ranking';
}

function uniquenessFrom(item: TopicOpportunityRecord): number | null {
  if (item.duplicateSimilarity == null) return null;
  const uniqueness = Math.max(0, Math.round(100 - Number(item.duplicateSimilarity)));
  return Number.isFinite(uniqueness) ? uniqueness : null;
}

export async function loadCandidateIdeas(): Promise<CandidateIdeasOverview> {
  const base = await loadTopicOpportunities();

  if (!base.available) {
    return {
      available: false,
      reason: base.reason,
      metrics: {
        candidateIdeas: 0,
        measuredAiScore: 0,
        avgAiScore: null,
        highPriority: 0,
        ready: 0,
        rejected: 0,
        qualified: 0,
        measuredConfidence: 0,
        avgConfidence: null,
        duplicates: 0,
        blocked: 0,
      },
      candidates: [],
      issues: [],
      audit: [],
      lastUpdated: base.lastUpdated,
    };
  }

  const candidates: CandidateIdeaRecord[] = base.opportunities.map((item) => ({
    ...item,
    uniqueness: uniquenessFrom(item),
    estimatedImpact:
      item.predictedPerformance ??
      item.expectedRoi ??
      item.scoreFactors.impact ??
      item.scoreFactors.estimatedImpact ??
      null,
    nextStage: nextStageFor(item.status, item.handoffStatus),
  }));

  const ready = candidates.filter(
    (item) =>
      item.status === 'VERIFIED' ||
      item.status === 'QUALIFIED' ||
      (item.verificationPassed > 0 && item.verificationFailed === 0 && item.measuredScore),
  ).length;

  const rejected = candidates.filter((item) => item.status === 'REJECTED').length;
  const qualified = candidates.filter(
    (item) => item.status === 'QUALIFIED' || item.status === 'HANDED_OFF',
  ).length;

  const issues: CandidateIdeaIssue[] = base.issues.map((issue) => ({
    id: issue.id,
    severity: issue.severity,
    code: issue.code,
    message: issue.message.replace(/Opportunity/g, 'Candidate'),
    candidateId: issue.opportunityId,
  }));

  return {
    available: true,
    strategy: base.strategy,
    run: base.run,
    metrics: {
      candidateIdeas: candidates.length,
      measuredAiScore: base.metrics.measuredScores,
      avgAiScore: base.metrics.avgOpportunityScore,
      highPriority: base.metrics.highPriority,
      ready,
      rejected,
      qualified,
      measuredConfidence: base.metrics.measuredConfidence,
      avgConfidence: base.metrics.avgConfidence,
      duplicates: base.metrics.duplicates,
      blocked: base.metrics.blocked,
    },
    candidates,
    issues,
    audit: base.audit,
    lastUpdated: base.lastUpdated,
  };
}
