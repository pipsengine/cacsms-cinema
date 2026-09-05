'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect, useState, type ReactNode} from 'react';
import {apiFetch} from '@/lib/api';

type NavItem = {label: string; href?: string; icon: string; badge?: string; future?: boolean};
const groups: {label: string; items: NavItem[]}[] = [
  {label: 'COMMAND', items: [{label: 'Command Center', href: '/command', icon: '⌂'}, {label: 'My Work', href: '/my-work', icon: '✓'}, {label: 'Notifications', href: '/notifications', icon: '◌'}]},
  {label: 'CONTENT OPERATIONS', items: [{label: 'Content Projects', href: '/projects', icon: '▤'}, {label: 'Create Content', href: '/projects/new', icon: '＋'}, {label: 'Content Calendar', icon: '□', future: true}]},
  {label: 'PRODUCTION PIPELINE', items: [{label: 'Strategy & Brief', icon: '◇', future: true}, {label: 'Research Studio', icon: '⌕', future: true}, {label: 'Script Studio', icon: '¶', future: true}, {label: 'Scene & Storyboard', icon: '▦', future: true}, {label: 'AI Generation', icon: '✦', future: true}, {label: 'Editing & QA', icon: '◫', future: true}, {label: 'Packaging', icon: '◈', future: true}, {label: 'Approval & Publishing', icon: '✓', future: true}, {label: 'Analytics & Learning', icon: '↗', future: true}]},
  {label: 'ADMINISTRATION', items: [{label: 'Users', href: '/admin/users', icon: '♙'}, {label: 'Roles & Permissions', href: '/admin/roles', icon: '⌘'}, {label: 'Audit Trail', icon: '≡', future: true}, {label: 'System Settings', icon: '⚙', future: true}]}
];

type Me = {name: string; email: string; role?: string | null};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
}

export function AppShell({children, title, eyebrow = 'CACSMS CINEMA', actions}: {children: ReactNode; title: string; eyebrow?: string; actions?: ReactNode}) {
  const path = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    apiFetch<Me>('/api/auth/me').then(setMe).catch(() => setMe(null));
  }, []);
  const avatar = initials(me?.name || '');
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand"><div className="brand-mark">CC</div><div><strong>Cacsms Cinema</strong><span>Autonomous Content OS</span></div></div>
        <button className="workspace-mini"><div className="avatar square">CC</div><div><b>Cacsms Cinema</b><small>Production workspace</small></div><span>⌄</span></button>
        <nav className="side-nav">{groups.map(g => <div className="nav-group" key={g.label}><div className="nav-label">{g.label}</div>{g.items.map(i => i.href ? <Link key={i.label} href={i.href} className={path === i.href ? 'nav-item active' : 'nav-item'}><span className="nav-icon">{i.icon}</span>{i.label}{i.badge && <em>{i.badge}</em>}</Link> : <div key={i.label} className="nav-item future" title="Planned module"><span className="nav-icon">{i.icon}</span>{i.label}<small>soon</small></div>)}</div>)}</nav>
        <div className="sidebar-foot">
          <div className="sidebar-system"><span><i/> System operational</span><small>Module 03 · Projects</small></div>
          <div className="user-mini"><div className="avatar">{avatar}</div><div><b>{me?.name || '…'}</b><small>{me?.role || 'Member'}</small></div><span>•••</span></div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button className="mobile-menu">☰</button>
          <div className="search-box">⌕ <span>Search projects, tasks, agents, assets…</span><kbd>⌘ K</kbd></div>
          <div className="top-actions"><Link href="/projects/new" className="create-quick">＋ Create</Link><button className="icon-btn">?</button><Link href="/notifications" className="icon-btn notify">♢</Link><div className="avatar">{avatar}</div></div>
        </header>
        <main className="page">
          <div className="breadcrumb"><span>Cacsms Cinema</span><b>›</b><span>{eyebrow}</span><b>›</b><strong>{title}</strong></div>
          <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>{actions && <div className="page-actions">{actions}</div>}</div>
          {children}
        </main>
      </div>
    </div>
  );
}
