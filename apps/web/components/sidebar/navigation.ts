import {
  Antenna,
  BarChart3,
  BookOpen,
  Bot,
  BrainCircuit,
  Clapperboard,
  FileSearch,
  Film,
  Headphones,
  Lightbulb,
  PackageCheck,
  PencilLine,
  Plug,
  Settings,
  ShieldCheck,
  Tags,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { LIFECYCLE_STAGES } from '@/apps/web/config/lifecycle-navigation';
import { contentIntelligenceNavigation } from '@/apps/web/lib/content-intelligence-navigation';
import { ideaQualificationNavigation } from '@/apps/web/lib/idea-qualification-navigation';
import { researchEvidenceNavigation } from '@/apps/web/lib/research-evidence-navigation';
import { strategyNavigation } from '@/apps/web/lib/strategy-navigation';

export type NavStatus = 'online' | 'active' | 'pending' | 'blocked' | 'offline';

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  sequence?: string;
  status?: NavStatus;
  badge?: string;
  children?: NavItem[];
};

/** Visual Production children — authoritative lifecycle overview routes. */
const visualChildren: NavItem[] = LIFECYCLE_STAGES.map((stage) => ({
  id: stage.id,
  sequence: stage.number,
  label: stage.label,
  href: stage.overviewHref,
  status: 'pending' as NavStatus,
}));

const strategyChildren: NavItem[] = strategyNavigation.map((item) => ({
  id: item.id,
  label: item.label,
  href: item.href,
  status: 'pending' as NavStatus,
}));

const intelligenceChildren: NavItem[] = contentIntelligenceNavigation.map((item) => ({
  id: item.id,
  label: item.label,
  href: item.href,
  status: 'pending' as NavStatus,
}));

const qualificationChildren: NavItem[] = ideaQualificationNavigation.map((item) => ({
  id: item.id,
  label: item.label,
  href: item.href,
  status: 'pending' as NavStatus,
}));

const researchChildren: NavItem[] = researchEvidenceNavigation.map((item) => ({
  id: item.id,
  label: item.label,
  href: item.href,
  status: 'pending' as NavStatus,
}));

export const productionNavigation: NavItem[] = [
  {
    id: 'strategy',
    sequence: '01',
    label: 'Strategy & Fields',
    href: '/strategy',
    icon: Target,
    status: 'pending',
    children: strategyChildren,
  },
  {
    id: 'intelligence',
    sequence: '02',
    label: 'Content Intelligence',
    href: '/content-intelligence',
    icon: BrainCircuit,
    status: 'pending',
    children: intelligenceChildren,
  },
  {
    id: 'qualification',
    sequence: '03',
    label: 'Idea Qualification',
    href: '/ideas',
    icon: Lightbulb,
    status: 'pending',
    children: qualificationChildren,
  },
  {
    id: 'research',
    sequence: '04',
    label: 'Research & Evidence',
    href: '/research',
    icon: FileSearch,
    status: 'pending',
    children: researchChildren,
  },
  { id: 'script', sequence: '05', label: 'Script & Narrative', href: '/visuals/discover/script-interpretation', icon: PencilLine, status: 'pending' },
  {
    id: 'visuals',
    sequence: '06',
    label: 'Visual Production',
    href: '/visuals/discover',
    icon: Clapperboard,
    status: 'pending',
    children: visualChildren,
  },
  { id: 'audio', sequence: '07', label: 'Audio Production', href: '/audio', icon: Headphones, status: 'pending' },
  { id: 'video', sequence: '08', label: 'Video & Assembly', href: '/video', icon: Film, status: 'pending' },
  { id: 'quality', sequence: '09', label: 'Quality & Compliance', href: '/visuals/quality/evidence', icon: ShieldCheck, status: 'pending' },
  { id: 'publishing', sequence: '10', label: 'Packaging & Publishing', href: '/publishing', icon: PackageCheck, status: 'pending' },
  { id: 'distribution', sequence: '11', label: 'Distribution & Monitoring', href: '/distribution', icon: Antenna, status: 'pending' },
  { id: 'analytics', sequence: '12', label: 'Analytics & Learning', href: '/visuals/learning', icon: BarChart3, status: 'pending' },
];

export const serviceNavigation: NavItem[] = [
  { id: 'knowledge', label: 'Knowledge Universe', href: '/libraries', icon: BookOpen },
  { id: 'agents', label: 'Agents & Workflows', href: '/system/workflows', icon: Bot },
  { id: 'brand', label: 'Brand & Assets', href: '/library/assets', icon: Tags },
  { id: 'integrations', label: 'Integrations', href: '/system/providers', icon: Plug },
  { id: 'operations', label: 'System Operations', href: '/health', icon: Settings },
  { id: 'administration', label: 'Administration', href: '/settings', icon: Users, badge: 'Later' },
];

export const statusLabels: Record<NavStatus, string> = {
  online: 'Online',
  active: 'Active',
  pending: 'Not started',
  blocked: 'Blocked',
  offline: 'Unavailable',
};
