import { notFound } from 'next/navigation';
import { getSection } from '@/apps/web/lib/intelligence-config';
import { AudienceDemandWorkspace } from '@/apps/web/components/intelligence/AudienceDemandWorkspace';
import { CandidateIdeasWorkspace } from '@/apps/web/components/intelligence/CandidateIdeasWorkspace';
import { CompetitorIntelligenceWorkspace } from '@/apps/web/components/intelligence/CompetitorIntelligenceWorkspace';
import { DiscoveryRunsWorkspace } from '@/apps/web/components/intelligence/DiscoveryRunsWorkspace';
import { DuplicateDetectionWorkspace } from '@/apps/web/components/intelligence/DuplicateDetectionWorkspace';
import { EvidenceVerificationWorkspace } from '@/apps/web/components/intelligence/EvidenceVerificationWorkspace';
import { FailureRecoveryWorkspace } from '@/apps/web/components/intelligence/FailureRecoveryWorkspace';
import { IntelligenceAuditWorkspace } from '@/apps/web/components/intelligence/IntelligenceAuditWorkspace';
import { IntelligenceWorkspace } from '@/apps/web/components/intelligence/IntelligenceWorkspace';
import { KnowledgeGapsWorkspace } from '@/apps/web/components/intelligence/KnowledgeGapsWorkspace';
import { OpportunityScoringWorkspace } from '@/apps/web/components/intelligence/OpportunityScoringWorkspace';
import { PortfolioBalanceWorkspace } from '@/apps/web/components/intelligence/PortfolioBalanceWorkspace';
import { QualificationHandoffsWorkspace } from '@/apps/web/components/intelligence/QualificationHandoffsWorkspace';
import { RankingSelectionWorkspace } from '@/apps/web/components/intelligence/RankingSelectionWorkspace';
import { SourceRegistryWorkspace } from '@/apps/web/components/intelligence/SourceRegistryWorkspace';
import { TopicOpportunitiesWorkspace } from '@/apps/web/components/intelligence/TopicOpportunitiesWorkspace';
import { TrendIntelligenceWorkspace } from '@/apps/web/components/intelligence/TrendIntelligenceWorkspace';
import type { SectionKey } from '@/lib/content-intelligence/contracts';

export default async function ContentIntelligenceSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!getSection(section)) notFound();
  if (section === 'sources') {
    return <SourceRegistryWorkspace />;
  }
  if (section === 'discovery') {
    return <DiscoveryRunsWorkspace />;
  }
  if (section === 'trends') {
    return <TrendIntelligenceWorkspace />;
  }
  if (section === 'audience-demand') {
    return <AudienceDemandWorkspace />;
  }
  if (section === 'knowledge-gaps') {
    return <KnowledgeGapsWorkspace />;
  }
  if (section === 'topic-opportunities') {
    return <TopicOpportunitiesWorkspace />;
  }
  if (section === 'competitors') {
    return <CompetitorIntelligenceWorkspace />;
  }
  if (section === 'candidates') {
    return <CandidateIdeasWorkspace />;
  }
  if (section === 'verification') {
    return <EvidenceVerificationWorkspace />;
  }
  if (section === 'duplicates') {
    return <DuplicateDetectionWorkspace />;
  }
  if (section === 'ranking') {
    return <RankingSelectionWorkspace />;
  }
  if (section === 'scoring') {
    return <OpportunityScoringWorkspace />;
  }
  if (section === 'portfolio') {
    return <PortfolioBalanceWorkspace />;
  }
  if (section === 'handoffs') {
    return <QualificationHandoffsWorkspace />;
  }
  if (section === 'failures') {
    return <FailureRecoveryWorkspace />;
  }
  if (section === 'audit') {
    return <IntelligenceAuditWorkspace />;
  }
  return <IntelligenceWorkspace sectionKey={section as SectionKey} />;
}
