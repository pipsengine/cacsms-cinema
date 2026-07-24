import { notFound } from 'next/navigation';
import { getSection } from '@/apps/web/lib/qualification-config';
import { CandidatePoolWorkspace } from '@/apps/web/components/qualification/CandidatePoolWorkspace';
import { EvidenceSufficiencyWorkspace } from '@/apps/web/components/qualification/EvidenceSufficiencyWorkspace';
import { IntelligenceIntakeWorkspace } from '@/apps/web/components/qualification/IntelligenceIntakeWorkspace';
import { QualificationWorkspace } from '@/apps/web/components/qualification/QualificationWorkspace';
import { StrategicFitWorkspace } from '@/apps/web/components/qualification/StrategicFitWorkspace';
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
  return <QualificationWorkspace sectionKey={section as SectionKey} />;
}
