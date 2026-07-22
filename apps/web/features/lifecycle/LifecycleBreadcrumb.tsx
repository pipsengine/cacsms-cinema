'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import {
  findActiveLifecyclePage,
  withContextQuery,
  type LifecyclePageConfig,
  type LifecycleStageConfig,
} from '@/apps/web/config/lifecycle-navigation';
import styles from './lifecycle-page.module.css';

const CONTEXT_KEYS = [
  'projectId',
  'workflowRunId',
  'scriptId',
  'sceneId',
  'shotId',
  'jobId',
  'candidateId',
  'assetId',
] as const;

export function useLifecycleNavContext(): Record<string, string | null> {
  const searchParams = useSearchParams();
  return useMemo(() => {
    const context: Record<string, string | null> = {};
    for (const key of CONTEXT_KEYS) context[key] = searchParams.get(key);
    return context;
  }, [searchParams]);
}

export function LifecycleBreadcrumb({
  stage,
  page,
  extras = [],
}: {
  stage: LifecycleStageConfig;
  page: LifecyclePageConfig;
  extras?: Array<{ label: string; href?: string }>;
}) {
  const context = useLifecycleNavContext();
  const stageHref = withContextQuery(stage.overviewHref, context);
  const productionHref = withContextQuery('/', context);

  return (
    <nav className={styles.breadcrumb} aria-label="Breadcrumb">
      <Link href={productionHref}>Visual Production</Link>
      <span aria-hidden>/</span>
      <Link href={stageHref}>{`${stage.number} ${stage.label}`}</Link>
      <span aria-hidden>/</span>
      <span aria-current="page">{page.label}</span>
      {extras.map((item) => (
        <span key={item.label} style={{ display: 'contents' }}>
          <span aria-hidden>/</span>
          {item.href ? <Link href={withContextQuery(item.href, context)}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function breadcrumbForPath(pathname: string): {
  stage: LifecycleStageConfig;
  page: LifecyclePageConfig;
} | null {
  return findActiveLifecyclePage(pathname);
}
