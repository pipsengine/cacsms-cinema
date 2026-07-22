import { CapabilityGate } from '@/apps/web/components/CapabilityGate';

export default function LocationLibraryPage() {
  return <CapabilityGate title="Regional Profiles" description="Evidence-backed geographic, cultural, and historical production intelligence." phase="Scheduled after continuity foundations" requirements={['Hierarchical location and period models', 'Licensed sources and evidence policy', 'Nigeria-specific regional profiles', 'Geography, culture, and history evaluators']} />;
}
