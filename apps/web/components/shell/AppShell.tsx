'use client';

import React, { Suspense } from 'react';
import { CacsmsSidebar } from '@/apps/web/components/navigation/CacsmsSidebar';
import styles from './shell.module.css';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Suspense fallback={<aside className={styles.sidebarFallback} aria-hidden />}>
        <CacsmsSidebar />
      </Suspense>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
