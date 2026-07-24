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
import { RiskPolicyWorkspace } from '@/apps/web/components/strategy/RiskPolicyWorkspace';
import { SelectionThresholdsWorkspace } from '@/apps/web/components/strategy/SelectionThresholdsWorkspace';
import { PortfolioWorkspace } from '@/apps/web/components/strategy/PortfolioWorkspace';
import { ValidationWorkspace } from '@/apps/web/components/strategy/ValidationWorkspace';
import { VersionsWorkspace } from '@/apps/web/components/strategy/VersionsWorkspace';
import { AuditWorkspace } from '@/apps/web/components/strategy/AuditWorkspace';
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
  if (section === 'risk-policy') return <RiskPolicyWorkspace />;
  if (section === 'selection-thresholds') return <SelectionThresholdsWorkspace />;
  if (section === 'portfolio') return <PortfolioWorkspace />;
  if (section === 'validation') return <ValidationWorkspace />;
  if (section === 'versions') return <VersionsWorkspace />;
  if (section === 'audit') return <AuditWorkspace />;
  const item = getSection(section);
  if (item) return <StrategyWorkspace sectionKey={item.key} />;
  notFound();
}
