import { notFound } from 'next/navigation';
import { getSection } from '@/apps/web/lib/research-evidence-config';
import { ResearchEvidenceWorkspace } from '@/apps/web/components/research/ResearchEvidenceWorkspace';
import type { SectionKey } from '@/lib/research-evidence/contracts';

export default async function ResearchSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!getSection(section)) notFound();
  return <ResearchEvidenceWorkspace sectionKey={section as SectionKey} />;
}
