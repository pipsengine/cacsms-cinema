import type { ReactNode } from 'react';
import '../styles/globals.css';
export const metadata={title:{default:'Cacsms Cinema',template:'%s · Cacsms Cinema'},description:'Autonomous AI content production and governance platform'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="en"><body>{children}</body></html>}
