'use client';

import { LIFECYCLE_STAGES } from '@/apps/web/config/lifecycle-navigation';
import { Sidebar } from '@/apps/web/components/sidebar';

/** App shell entry — renders the upgraded autonomous production sidebar. */
export function CacsmsSidebar() {
  return <Sidebar workflowHref="/" />;
}

/** @deprecated Prefer LIFECYCLE_STAGES from lifecycle-navigation config. */
export const lifecycleStages = LIFECYCLE_STAGES.map((stage) => ({
  number: stage.number,
  label: stage.label,
  href: stage.overviewHref,
  pages: stage.pages.map((page) => ({ label: page.label, href: page.href })),
}));
