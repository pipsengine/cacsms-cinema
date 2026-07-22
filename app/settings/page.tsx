import { CapabilityGate } from '@/apps/web/components/CapabilityGate';

export default function SettingsPage() {
  return <CapabilityGate title="Policies and Provider Configuration" description="Backend-only configuration metadata; provider credentials are never rendered in the browser." phase="Scheduled with provider registry and governance" requirements={['Versioned provider/model/workflow registry', 'Backend secret validation without secret disclosure', 'Budget, quota, retention, and moderation policies', 'Audited privileged mutation APIs']} />;
}
