'use client';

import Link from 'next/link';

export function PlaceholderWorkspace({
  title,
  breadcrumb,
  href,
}: {
  title: string;
  breadcrumb: string[];
  href: string;
}) {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px 40px', color: '#151a30' }}>
      <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap', color: '#7a8299', fontSize: 12 }} aria-label="Breadcrumb">
        {breadcrumb.map((crumb, index) => (
          <span key={`${crumb}-${index}`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            {index > 0 ? <span aria-hidden>/</span> : null}
            {index === 0 ? <Link href="/" style={{ color: '#4c31de', textDecoration: 'none' }}>{crumb}</Link> : <span>{crumb}</span>}
          </span>
        ))}
      </nav>
      <h1 style={{ margin: '10px 0 8px', fontSize: 28, letterSpacing: '-0.03em' }}>{title}</h1>
      <p style={{ margin: 0, color: '#596079', fontSize: 14, lineHeight: 1.5, maxWidth: 640 }}>
        Shell route <code>{href}</code> is registered in the lifecycle sidebar. Domain implementation is pending;
        no simulated production metrics are shown.
      </p>
    </div>
  );
}
