'use client';

import React, { Suspense } from 'react';
import { CacsmsSidebar } from '@/apps/web/components/navigation/CacsmsSidebar';
import { SystemControlBar } from '@/apps/web/components/shell/SystemControlBar';
import styles from './shell.module.css';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Suspense fallback={<aside className={styles.sidebarFallback} aria-hidden />}>
        <CacsmsSidebar />
      </Suspense>
      <div className={styles.mainColumn}>
        <SystemControlBar variant="top" />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
