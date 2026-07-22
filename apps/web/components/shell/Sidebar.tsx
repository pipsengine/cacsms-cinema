'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Image as ImageIcon,
  Film,
  Video,
  FileText,
  Users,
  Settings,
  Library,
  MapPin,
  CheckSquare,
  Activity
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Script Writer', href: '/scripts', icon: FileText },
  { name: 'Storyboard Editor', href: '/storyboards', icon: Film },
  { name: 'Image Generator', href: '/visuals/image-generator', icon: ImageIcon },
  { name: 'Video Assembly', href: '/video', icon: Video },
];

const libraries = [
  { name: 'Character Library', href: '/library/characters', icon: Users },
  { name: 'Location Library', href: '/library/locations', icon: MapPin },
  { name: 'Asset Library', href: '/library/assets', icon: Library },
];

const system = [
  { name: 'Quality Assurance', href: '/qa', icon: CheckSquare },
  { name: 'System Health', href: '/health', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => href === '/visuals/image-generator'
    ? pathname === '/' || pathname.startsWith(href)
    : href !== '/' && pathname === href;
  const groups = [{ items: navigation }, { title: 'Libraries', items: libraries }, { title: 'System', items: system }];
  return (
    <>
      {open && <button type="button" aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-30 bg-slate-950/20 md:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex h-screen w-[220px] shrink-0 flex-col border-r border-[#e3e8f1] bg-white transition-transform md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-16 shrink-0 items-center border-b border-[#e9edf4] px-[22px]">
        <h1 className="text-[17px] font-bold tracking-[-0.025em] text-[#101a35]">cacsms-cinema</h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {groups.map((group) => <div className="px-[9px] py-[10px]" key={group.title ?? 'primary'}>
          {group.title && <h3 className="mb-2 mt-4 px-[11px] text-[11px] font-medium uppercase tracking-[0.08em] text-[#7890bc]">{group.title}</h3>}
          <div>
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`group my-0.5 flex items-center gap-[13px] rounded-lg border px-3 py-[9px] text-[13px] font-medium transition-colors ${active ? 'border-[#10254d] bg-[#fbfcff] text-[#10254d] shadow-[0_1px_3px_rgba(20,42,83,.1)]' : 'border-transparent text-[#3f5782] hover:bg-[#f5f8ff]'}`}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                {item.name}
              </Link>
            )})}
          </div>
        </div>)}
      </nav>
    </aside>
    </>
  );
}
