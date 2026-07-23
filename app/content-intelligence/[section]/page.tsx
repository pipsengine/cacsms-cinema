import { notFound } from 'next/navigation';
import { getSection } from '@/apps/web/lib/intelligence-config';
import { IntelligenceWorkspace } from '@/apps/web/components/intelligence/IntelligenceWorkspace';
import type { SectionKey } from '@/lib/content-intelligence/contracts';

export default async function ContentIntelligenceSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!getSection(section)) notFound();
  return <IntelligenceWorkspace sectionKey={section as SectionKey} />;
}
