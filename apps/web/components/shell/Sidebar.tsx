import Link from 'next/link';
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

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-gray-200 bg-white h-screen flex flex-col flex-shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-gray-200 shrink-0">
        <h1 className="font-bold text-lg text-slate-900 tracking-tight">cacsms-cinema</h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 space-y-8">
        <div className="px-3">
          <div className="space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="group flex items-center px-3 py-2 text-sm font-medium text-slate-700 rounded-md hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                <item.icon className="text-slate-400 group-hover:text-slate-500 flex-shrink-0 h-5 w-5 mr-3" aria-hidden="true" />
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="px-3">
          <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Libraries</h3>
          <div className="space-y-1">
            {libraries.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="group flex items-center px-3 py-2 text-sm font-medium text-slate-700 rounded-md hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                <item.icon className="text-slate-400 group-hover:text-slate-500 flex-shrink-0 h-5 w-5 mr-3" aria-hidden="true" />
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="px-3">
          <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">System</h3>
          <div className="space-y-1">
            {system.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="group flex items-center px-3 py-2 text-sm font-medium text-slate-700 rounded-md hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                <item.icon className="text-slate-400 group-hover:text-slate-500 flex-shrink-0 h-5 w-5 mr-3" aria-hidden="true" />
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}
