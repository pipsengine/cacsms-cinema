import { LifecycleWorkspace } from '@/apps/web/features/lifecycle/LifecycleWorkspace';
import { getLifecycleStageById } from '@/apps/web/config/lifecycle-navigation';
import { notFound } from 'next/navigation';

const RESERVED = new Set(['image-generator']);

export default async function VisualStagePage({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
  const { stage } = await params;
  if (RESERVED.has(stage)) {
    return null;
  }
  if (!getLifecycleStageById(stage)) {
    notFound();
  }
  return <LifecycleWorkspace stageKey={stage} />;
}
