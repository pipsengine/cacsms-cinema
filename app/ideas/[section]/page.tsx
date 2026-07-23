import { notFound } from 'next/navigation';
import { getSection } from '@/apps/web/lib/qualification-config';
import { QualificationWorkspace } from '@/apps/web/components/qualification/QualificationWorkspace';
import type { SectionKey } from '@/lib/idea-qualification/contracts';

export default async function IdeaQualificationSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!getSection(section)) notFound();
  return <QualificationWorkspace sectionKey={section as SectionKey} />;
}
