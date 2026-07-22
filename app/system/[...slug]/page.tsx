import { PlaceholderWorkspace } from '@/apps/web/features/lifecycle/PlaceholderWorkspace';

export default async function SystemNestedPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const title = slug
    .map((part) => part.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' '))
    .join(' / ');
  return (
    <PlaceholderWorkspace
      title={title}
      breadcrumb={['Control Room', 'System', title]}
      href={`/system/${slug.join('/')}`}
    />
  );
}
