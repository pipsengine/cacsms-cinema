'use client';

import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Suspense, type ReactNode } from 'react';
import {
  getLifecycleStageById,
  type LifecyclePageConfig,
  type LifecycleStageConfig,
} from '@/apps/web/config/lifecycle-navigation';
import { ImageGeneratorWorkspace } from '@/apps/web/features/image-generator';
import { StoryboardEngineWorkspace } from '@/apps/web/features/storyboard-engine';
import { VideoAssemblyWorkspace } from '@/apps/web/features/video-assembly';
import { CapabilityGate } from '@/apps/web/components/CapabilityGate';
import { CapabilityUnavailable } from './CapabilityUnavailable';
import { StageOverviewTemplate } from './StageOverviewTemplate';
import { LifecycleBreadcrumb } from './LifecycleBreadcrumb';
import styles from './lifecycle-page.module.css';

const ScriptWriterPage = dynamic(() => import('@/app/scripts/page'), {
  ssr: false,
  loading: () => <div className={styles.page}>Loading script interpretation…</div>,
});

const LIVE_RENDERERS: Record<
  string,
  (args: {
    stage: LifecycleStageConfig;
    page: LifecyclePageConfig;
    jobId?: string;
    assetId?: string;
  }) => ReactNode
> = {
  'script-interpretation': () => <ScriptWriterPage />,
  'storyboard-workspace': ({ stage, page }) => (
    <div>
      <div className={styles.page} style={{ paddingBottom: 0 }}>
        <LifecycleBreadcrumb stage={stage} page={page} />
      </div>
      <StoryboardEngineWorkspace />
    </div>
  ),
  'image-generator': () => <ImageGeneratorWorkspace />,
  'generation-queue': () => <ImageGeneratorWorkspace focus="queue" />,
  'active-job': ({ jobId }) =>
    jobId ? (
      <ImageGeneratorWorkspace initialJobId={jobId} focus="job" />
    ) : (
      <ImageGeneratorWorkspace focus="queue" />
    ),
  'candidate-gallery': () => <ImageGeneratorWorkspace focus="candidates" />,
  attempts: () => <ImageGeneratorWorkspace focus="attempts" />,
  failures: () => <ImageGeneratorWorkspace focus="failures" />,
  'quality-evidence': ({ stage, page }) => (
    <div>
      <div className={styles.page} style={{ paddingBottom: 0 }}>
        <LifecycleBreadcrumb stage={stage} page={page} />
      </div>
      <CapabilityGate
        title="Quality Evidence Dashboard"
        description="Evidence-based technical, semantic, identity, continuity, geographic, historical, and safety gates."
        phase="Scheduled after real candidate generation and file validation"
        requirements={[
          'Versioned evaluator contracts and registry',
          'Persisted scores, confidence, evidence, and defects',
          'Critical-gate policy that cannot be overridden by averages',
          'Golden-scene benchmarks and quality target reporting',
        ]}
      />
    </div>
  ),
  exceptions: ({ stage, page }) => (
    <div>
      <div className={styles.page} style={{ paddingBottom: 0 }}>
        <LifecycleBreadcrumb stage={stage} page={page} />
      </div>
      <CapabilityGate
        title="Exception Resolution"
        description="Human-exception queue for critical quality and continuity failures."
        phase="Activation follows quality evidence and repair pipelines"
        requirements={[
          'HUMAN_EXCEPTION_REQUIRED job states surfaced with evidence',
          'Operator resolution APIs with audit trail',
          'No mock exceptions or fabricated severity counts',
        ]}
      />
    </div>
  ),
  'approved-assets': ({ stage, page }) => (
    <div>
      <div className={styles.page} style={{ paddingBottom: 0 }}>
        <LifecycleBreadcrumb stage={stage} page={page} />
      </div>
      <CapabilityGate
        title="Approved Assets"
        description="Immutable approved media, renditions, provenance, usages, and delivery references."
        phase="Activation follows storage integrity and approval gates"
        requirements={[
          'Durable storage adapter and read-back validation',
          'Immutable AssetVersion and Rendition APIs',
          'Lineage, copyright, consent, and disclosure metadata',
          'Protected browser-compatible delivery',
        ]}
      />
    </div>
  ),
  'asset-detail': ({ stage, page, assetId }) =>
    assetId ? (
      <CapabilityUnavailable
        stage={stage}
        page={page}
        emptyMessage={`Asset ${assetId} was requested. Asset detail requires an approved AssetVersion record; open Approved Assets when lineage APIs are active.`}
        prerequisiteHref="/visuals/delivery/approved-assets"
        prerequisiteLabel="Open approved assets"
      />
    ) : (
      <CapabilityUnavailable
        stage={stage}
        page={page}
        emptyMessage="Select an approved asset identifier before opening Asset Detail. Dynamic asset routes are never opened without a valid record id."
        prerequisiteHref="/visuals/delivery/approved-assets"
        prerequisiteLabel="Open approved assets"
      />
    ),
  'video-readiness': ({ stage, page }) => (
    <div>
      <div className={styles.page} style={{ paddingBottom: 0 }}>
        <LifecycleBreadcrumb stage={stage} page={page} />
      </div>
      <VideoAssemblyWorkspace />
    </div>
  ),
};

function resolvePage(
  stage: LifecycleStageConfig,
  slugParts: string[],
): { page: LifecyclePageConfig; jobId?: string; assetId?: string } | null {
  if (slugParts.length === 0) {
    return { page: stage.pages[0] };
  }

  if (slugParts[0] === 'jobs') {
    const page = stage.pages.find((item) => item.dynamicKind === 'job');
    if (!page) return null;
    return { page, jobId: slugParts[1] };
  }

  if (slugParts[0] === 'assets') {
    const page = stage.pages.find((item) => item.dynamicKind === 'asset');
    if (!page) return null;
    return { page, assetId: slugParts[1] };
  }

  const href = `/visuals/${stage.id}/${slugParts.join('/')}`;
  const page = stage.pages.find((item) => item.href === href);
  return page ? { page } : null;
}

export function LifecycleWorkspace({
  stageKey,
  slugParts = [],
}: {
  stageKey: string;
  slugParts?: string[];
}) {
  const stage = getLifecycleStageById(stageKey);
  if (!stage) notFound();

  const resolved = resolvePage(stage, slugParts);
  if (!resolved) notFound();

  const { page, jobId, assetId } = resolved;

  if (page.exact || slugParts.length === 0) {
    return (
      <Suspense fallback={<div className={styles.page}>Loading stage overview…</div>}>
        <StageOverviewTemplate stage={stage} />
      </Suspense>
    );
  }

  const live = LIVE_RENDERERS[page.id];
  if (live) {
    return (
      <Suspense fallback={<div className={styles.page}>Loading workspace…</div>}>
        {live({ stage, page, jobId, assetId })}
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className={styles.page}>Loading…</div>}>
      <CapabilityUnavailable
        stage={stage}
        page={page}
        prerequisiteHref={stage.overviewHref}
        prerequisiteLabel="Back to stage overview"
      />
    </Suspense>
  );
}

/** @deprecated Prefer LifecycleWorkspace */
export function LifecycleStagePage(props: { stageKey: string; slugParts?: string[] }) {
  return <LifecycleWorkspace {...props} />;
}
