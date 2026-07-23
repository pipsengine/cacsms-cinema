import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StrategyWorkspace } from '@/apps/web/components/strategy/StrategyWorkspace';
import { ObjectivesWorkspace } from '@/apps/web/components/strategy/ObjectivesWorkspace';
import { DomainsWorkspace } from '@/apps/web/components/strategy/DomainsWorkspace';
import { TaxonomyWorkspace } from '@/apps/web/components/strategy/TaxonomyWorkspace';
import { GeographiesWorkspace } from '@/apps/web/components/strategy/GeographiesWorkspace';
import { AudiencesWorkspace } from '@/apps/web/components/strategy/AudiencesWorkspace';
import { EditorialWorkspace } from '@/apps/web/components/strategy/EditorialWorkspace';
import { FormatsWorkspace } from '@/apps/web/components/strategy/FormatsWorkspace';
import { ChannelsWorkspace } from '@/apps/web/components/strategy/ChannelsWorkspace';
import { LocalisationWorkspace } from '@/apps/web/components/strategy/LocalisationWorkspace';
import { SourcePolicyWorkspace } from '@/apps/web/components/strategy/SourcePolicyWorkspace';
import { OperationalWorkspace } from '@/apps/web/components/strategy/OperationalWorkspace';
import { getSection } from '@/apps/web/lib/strategy-config';

const OPERATIONAL_TITLES: Record<string, string> = {
  validation: 'Strategy Validation',
  versions: 'Strategy Versions',
  audit: 'Strategy Audit',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  const item = getSection(section);
  if (item) return { title: item.title };
  if (OPERATIONAL_TITLES[section]) return { title: OPERATIONAL_TITLES[section] };
  return { title: 'Strategy' };
}

export default async function StrategySectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === 'objectives') return <ObjectivesWorkspace />;
  if (section === 'domains') return <DomainsWorkspace />;
  if (section === 'taxonomy') return <TaxonomyWorkspace />;
  if (section === 'geographies') return <GeographiesWorkspace />;
  if (section === 'audiences') return <AudiencesWorkspace />;
  if (section === 'editorial-policy') return <EditorialWorkspace />;
  if (section === 'formats') return <FormatsWorkspace />;
  if (section === 'channels') return <ChannelsWorkspace />;
  if (section === 'localisation') return <LocalisationWorkspace />;
  if (section === 'source-policy') return <SourcePolicyWorkspace />;
  const item = getSection(section);
  if (item) return <StrategyWorkspace sectionKey={item.key} />;
  if (section === 'validation' || section === 'versions' || section === 'audit') {
    return <OperationalWorkspace mode={section} />;
  }
  notFound();
}
