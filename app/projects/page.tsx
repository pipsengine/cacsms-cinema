import { PlaceholderWorkspace } from '@/apps/web/features/lifecycle/PlaceholderWorkspace';

export default function ProjectsPage() {
  return (
    <PlaceholderWorkspace
      title="Projects"
      breadcrumb={['Control Room', 'Projects']}
      href="/projects"
    />
  );
}
