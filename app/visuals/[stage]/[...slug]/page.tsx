import { LifecycleWorkspace } from '@/apps/web/features/lifecycle/LifecycleWorkspace';
import { getLifecycleStageById } from '@/apps/web/config/lifecycle-navigation';
import { notFound } from 'next/navigation';

export default async function VisualStageNestedPage({
  params,
}: {
  params: Promise<{ stage: string; slug: string[] }>;
}) {
  const { stage, slug } = await params;
  if (!getLifecycleStageById(stage)) {
    notFound();
  }
  return <LifecycleWorkspace stageKey={stage} slugParts={slug} />;
}
