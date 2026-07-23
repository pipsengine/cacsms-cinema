import { notFound } from 'next/navigation';
import { StrategyWorkspace } from '@/apps/web/components/strategy/StrategyWorkspace';
import { ObjectivesWorkspace } from '@/apps/web/components/strategy/ObjectivesWorkspace';
import { DomainsWorkspace } from '@/apps/web/components/strategy/DomainsWorkspace';
import { OperationalWorkspace } from '@/apps/web/components/strategy/OperationalWorkspace';
import { getSection } from '@/apps/web/lib/strategy-config';

export default async function StrategySectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === 'objectives') return <ObjectivesWorkspace />;
  if (section === 'domains') return <DomainsWorkspace />;
  const item = getSection(section);
  if (item) return <StrategyWorkspace sectionKey={item.key} />;
  if (section === 'validation' || section === 'versions' || section === 'audit') {
    return <OperationalWorkspace mode={section} />;
  }
  notFound();
}
