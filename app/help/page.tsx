import { PlaceholderWorkspace } from '@/apps/web/features/lifecycle/PlaceholderWorkspace';

export default function HelpPage() {
  return (
    <PlaceholderWorkspace
      title="Help"
      breadcrumb={['Control Room', 'Help']}
      href="/help"
    />
  );
}
