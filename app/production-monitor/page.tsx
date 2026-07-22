import { PlaceholderWorkspace } from '@/apps/web/features/lifecycle/PlaceholderWorkspace';

export default function ProductionMonitorPage() {
  return (
    <PlaceholderWorkspace
      title="Production Monitor"
      breadcrumb={['Control Room', 'Production Monitor']}
      href="/production-monitor"
    />
  );
}
