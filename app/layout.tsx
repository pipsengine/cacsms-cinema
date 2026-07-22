import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AppShell } from '@/apps/web/components/shell/AppShell';

export const metadata: Metadata = {
  title: 'cacsms-cinema',
  description: 'Production-grade cacsms-cinema visual intelligence and image generation workspace',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className="antialiased bg-white text-slate-900" suppressHydrationWarning>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
