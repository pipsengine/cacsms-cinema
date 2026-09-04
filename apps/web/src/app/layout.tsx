import type { ReactNode } from 'react';
import '../styles/globals.css';

export const metadata = {
  title: 'Autonomous Content Generator',
  description: 'AI-native content operations platform'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
