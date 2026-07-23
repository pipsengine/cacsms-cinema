import { notFound } from 'next/navigation';
import { StrategyWorkspace } from '@/apps/web/components/strategy/StrategyWorkspace';
import { OperationalWorkspace } from '@/apps/web/components/strategy/OperationalWorkspace';
import { getSection } from '@/apps/web/lib/strategy-config';

export default async function StrategySectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const item = getSection(section);
  if (item) return <StrategyWorkspace sectionKey={item.key} />;
  if (section === 'validation' || section === 'versions' || section === 'audit') {
    return <OperationalWorkspace mode={section} />;
  }
  notFound();
}
