import type { IntelligenceOverview, Opportunity, SectionKey } from '@/lib/content-intelligence/contracts';
import type { AudienceDemandOverview } from '@/lib/content-intelligence/audience-demand';
import type { CandidateIdeasOverview } from '@/lib/content-intelligence/candidates';
import type { CompetitorIntelligenceOverview } from '@/lib/content-intelligence/competitors';
import type { DiscoveryRunsOverview } from '@/lib/content-intelligence/discovery';
import type { KnowledgeGapsOverview } from '@/lib/content-intelligence/knowledge-gaps';
import type { SourceRegistryOverview } from '@/lib/content-intelligence/sources';
import type { TopicOpportunitiesOverview } from '@/lib/content-intelligence/topic-opportunities';
import type { TrendIntelligenceOverview } from '@/lib/content-intelligence/trends';
import type { EvidenceVerificationOverview } from '@/lib/content-intelligence/verification';
import type { DuplicateDetectionOverview } from '@/lib/content-intelligence/duplicates';
import type { RankingSelectionOverview } from '@/lib/content-intelligence/ranking';
import type { OpportunityScoringOverview } from '@/lib/content-intelligence/opportunity-scoring';
import type { PortfolioBalanceOverview } from '@/lib/content-intelligence/portfolio';
import type { QualificationHandoffsOverview } from '@/lib/content-intelligence/handoffs';
import type { FailureRecoveryOverview } from '@/lib/content-intelligence/failures';
import type { IntelligenceAuditOverview } from '@/lib/content-intelligence/audit';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    let detail = '';
    try {
      detail = ((await response.json()) as { message?: string }).message ?? '';
    } catch {
      detail = '';
    }
    throw new Error(detail || `Service returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const intelligenceApi = {
  overview: () => request<IntelligenceOverview>('/content-intelligence/overview'),
  sources: () => request<SourceRegistryOverview>('/content-intelligence/sources'),
  discovery: () => request<DiscoveryRunsOverview>('/content-intelligence/discovery'),
  trends: () => request<TrendIntelligenceOverview>('/content-intelligence/trends'),
  audienceDemand: () =>
    request<AudienceDemandOverview>('/content-intelligence/audience-demand'),
  knowledgeGaps: () =>
    request<KnowledgeGapsOverview>('/content-intelligence/knowledge-gaps'),
  topicOpportunities: () =>
    request<TopicOpportunitiesOverview>('/content-intelligence/topic-opportunities'),
  competitors: () =>
    request<CompetitorIntelligenceOverview>('/content-intelligence/competitors'),
  candidates: () => request<CandidateIdeasOverview>('/content-intelligence/candidates'),
  verification: () =>
    request<EvidenceVerificationOverview>('/content-intelligence/verification'),
  duplicates: () =>
    request<DuplicateDetectionOverview>('/content-intelligence/duplicates'),
  ranking: () => request<RankingSelectionOverview>('/content-intelligence/ranking'),
  scoring: () =>
    request<OpportunityScoringOverview>('/content-intelligence/scoring'),
  portfolio: () =>
    request<PortfolioBalanceOverview>('/content-intelligence/portfolio'),
  handoffs: () =>
    request<QualificationHandoffsOverview>('/content-intelligence/handoffs'),
  failures: () => request<FailureRecoveryOverview>('/content-intelligence/failures'),
  audit: () => request<IntelligenceAuditOverview>('/content-intelligence/audit'),
  list: (section: SectionKey) =>
    request<Opportunity[]>(`/content-intelligence/${section}`),
  run: () =>
    request<{ runId: string; status: string }>('/content-intelligence/runs', {
      method: 'POST',
      body: '{}',
      headers: { 'idempotency-key': crypto.randomUUID() },
    }),
  consumeActiveStrategy: () =>
    request<{ status: string; checksum: string }>(
      '/content-intelligence/strategy-packages/consume',
      { method: 'POST', body: '{}' },
    ),
};
