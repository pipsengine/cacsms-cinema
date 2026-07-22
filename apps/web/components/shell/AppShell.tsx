'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] font-sans text-[#101a35]">
      <Sidebar open={navigationOpen} onClose={() => setNavigationOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav onMenu={() => setNavigationOpen((value) => !value)} />
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
