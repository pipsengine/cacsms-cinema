import { notFound } from 'next/navigation';
import { getSection } from '@/apps/web/lib/qualification-config';
import { CandidatePoolWorkspace } from '@/apps/web/components/qualification/CandidatePoolWorkspace';
import { EvidenceSufficiencyWorkspace } from '@/apps/web/components/qualification/EvidenceSufficiencyWorkspace';
import { IntelligenceIntakeWorkspace } from '@/apps/web/components/qualification/IntelligenceIntakeWorkspace';
import { QualificationWorkspace } from '@/apps/web/components/qualification/QualificationWorkspace';
import { AudienceValueWorkspace } from '@/apps/web/components/qualification/AudienceValueWorkspace';
import { DuplicateDetectionWorkspace } from '@/apps/web/components/qualification/DuplicateDetectionWorkspace';
import { OriginalityWorkspace } from '@/apps/web/components/qualification/OriginalityWorkspace';
import { ProductionFeasibilityWorkspace } from '@/apps/web/components/qualification/ProductionFeasibilityWorkspace';
import { DecisionRegisterWorkspace } from '@/apps/web/components/qualification/DecisionRegisterWorkspace';
import { MandatoryGatesWorkspace } from '@/apps/web/components/qualification/MandatoryGatesWorkspace';
import { QualificationScoringWorkspace } from '@/apps/web/components/qualification/QualificationScoringWorkspace';
import { QualifiedRankingWorkspace } from '@/apps/web/components/qualification/QualifiedRankingWorkspace';
import { RiskSensitivityWorkspace } from '@/apps/web/components/qualification/RiskSensitivityWorkspace';
import { StrategicFitWorkspace } from '@/apps/web/components/qualification/StrategicFitWorkspace';
import { VisualPotentialWorkspace } from '@/apps/web/components/qualification/VisualPotentialWorkspace';
import type { SectionKey } from '@/lib/idea-qualification/contracts';

export default async function IdeaQualificationSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!getSection(section)) notFound();
  if (section === 'intake') {
    return <IntelligenceIntakeWorkspace />;
  }
  if (section === 'candidate-pool') {
    return <CandidatePoolWorkspace />;
  }
  if (section === 'evidence') {
    return <EvidenceSufficiencyWorkspace />;
  }
  if (section === 'strategic-fit') {
    return <StrategicFitWorkspace />;
  }
  if (section === 'audience-value') {
    return <AudienceValueWorkspace />;
  }
  if (section === 'originality') {
    return <OriginalityWorkspace />;
  }
  if (section === 'duplicates') {
    return <DuplicateDetectionWorkspace />;
  }
  if (section === 'feasibility') {
    return <ProductionFeasibilityWorkspace />;
  }
  if (section === 'visual-potential') {
    return <VisualPotentialWorkspace />;
  }
  if (section === 'risk') {
    return <RiskSensitivityWorkspace />;
  }
  if (section === 'scoring') {
    return <QualificationScoringWorkspace />;
  }
  if (section === 'gates') {
    return <MandatoryGatesWorkspace />;
  }
  if (section === 'ranking') {
    return <QualifiedRankingWorkspace />;
  }
  if (section === 'decisions') {
    return <DecisionRegisterWorkspace />;
  }
  return <QualificationWorkspace sectionKey={section as SectionKey} />;
}
