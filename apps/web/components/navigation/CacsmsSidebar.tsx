'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Activity,
  Archive,
  BarChart3,
  Boxes,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileSearch,
  Folder,
  Gauge,
  Grid3X3,
  HeartPulse,
  Image,
  MapPin,
  Menu,
  MonitorPlay,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { LifecycleIcon } from '@/apps/web/config/lifecycle-icons';
import {
  LIFECYCLE_STAGES,
  findActiveLifecyclePage,
  findStageForPathname,
  matchesPageRoute,
  pageCount,
  withContextQuery,
  type WorkflowOperationalStatus,
} from '@/apps/web/config/lifecycle-navigation';
import styles from './CacsmsSidebar.module.css';

const primary: Array<[string, string, LucideIcon]> = [
  ['Control Room', '/', Gauge],
  ['Projects', '/projects', Folder],
  ['Production Monitor', '/production-monitor', MonitorPlay],
];

const libraries: Array<[string, string, LucideIcon]> = [
  ['Character Library', '/library/characters', Users],
  ['Location Library', '/library/locations', MapPin],
  ['Asset Library', '/library/assets', Image],
  ['Reference Library', '/libraries/references', FileSearch],
  ['Style Library', '/libraries/styles', Sparkles],
  ['Wardrobe & Props', '/libraries/wardrobe-props', Boxes],
];

const system: Array<[string, string, LucideIcon]> = [
  ['Quality Assurance', '/qa', ShieldCheck],
  ['System Health', '/health', HeartPulse],
  ['Provider Health', '/system/providers', Activity],
  ['Model Registry', '/system/models', BrainCircuit],
  ['Workflow Registry', '/system/workflows', Workflow],
  ['Job & Event Monitor', '/system/job-monitor', BarChart3],
  ['Cost Controls', '/system/cost-controls', SlidersHorizontal],
  ['Audit Trail', '/system/audit-trail', Archive],
  ['Settings', '/settings', Settings],
];

function matches(path: string, href: string) {
  if (href === '/') return path === href;
  return path === href || path.startsWith(`${href}/`);
}

function statusClass(status: WorkflowOperationalStatus): string {
  if (status === 'completed') return styles.complete;
  if (status === 'active') return styles.active;
  if (status === 'blocked') return styles.blocked;
  return styles.pending;
}

function NavLink({
  href,
  label,
  Icon,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const path = usePathname();
  const active = matches(path, href);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
      <span>{label}</span>
      {!collapsed && <ChevronRight className={styles.trailing} size={15} />}
    </Link>
  );
}

function useLifecycleContextQuery(): Record<string, string | null> {
  const searchParams = useSearchParams();
  return useMemo(() => {
    const keys = [
      'projectId',
      'workflowRunId',
      'scriptId',
      'sceneId',
      'shotId',
      'jobId',
      'candidateId',
      'assetId',
    ] as const;
    const context: Record<string, string | null> = {};
    for (const key of keys) context[key] = searchParams.get(key);
    return context;
  }, [searchParams]);
}

export function CacsmsSidebar() {
  const pathname = usePathname();
  const context = useLifecycleContextQuery();
  const activeMatch = useMemo(() => findActiveLifecyclePage(pathname), [pathname]);
  const routeStage = useMemo(() => findStageForPathname(pathname), [pathname]);
  const [expanded, setExpanded] = useState(routeStage?.id ?? '');
  const [pathnameForExpand, setPathnameForExpand] = useState(pathname);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('cacsms-sidebar-collapsed') === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workflowByStage, setWorkflowByStage] = useState<Record<string, WorkflowOperationalStatus>>({});
  const listIdPrefix = useId();

  if (pathname !== pathnameForExpand) {
    setPathnameForExpand(pathname);
    if (routeStage) setExpanded(routeStage.id);
    setMobileOpen(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        const params = new URLSearchParams();
        if (context.workflowRunId) params.set('workflowRunId', context.workflowRunId);
        if (context.projectId) params.set('projectId', context.projectId);
        if (context.jobId) params.set('jobId', context.jobId);
        const response = await fetch(`/api/lifecycle/status?${params.toString()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          stages?: Array<{ id: string; workflowStatus: WorkflowOperationalStatus }>;
        };
        if (cancelled) return;
        if (payload.stages?.length) {
          setWorkflowByStage(
            Object.fromEntries(payload.stages.map((stage) => [stage.id, stage.workflowStatus])),
          );
        }
      } catch {
        /* status unavailable */
      }
    }
    void loadStatus();
    const interval = window.setInterval(() => void loadStatus(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [context.workflowRunId, context.projectId, context.jobId]);

  const toggleCollapse = () =>
    setCollapsed((value) => {
      localStorage.setItem('cacsms-sidebar-collapsed', String(!value));
      return !value;
    });

  return (
    <>
      <button className={styles.mobileTrigger} onClick={() => setMobileOpen(true)} aria-label="Open navigation" type="button">
        <Menu />
      </button>
      {mobileOpen ? (
        <button className={styles.backdrop} onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" type="button" />
      ) : null}
      <aside
        className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}
        aria-label="Main navigation"
      >
        <header className={styles.brand}>
          <Link href="/" className={styles.brandLink} aria-label="CACSMS Visual Studio home">
            <span className={styles.logo}>
              <span />
            </span>
            <span className={styles.brandText}>
              <strong>CACSMS Visual Studio</strong>
              <small>Autonomous Production</small>
            </span>
          </Link>
          <button className={styles.closeMobile} onClick={() => setMobileOpen(false)} aria-label="Close navigation" type="button">
            <X size={20} />
          </button>
          <button
            className={styles.collapseButton}
            onClick={toggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            type="button"
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </header>

        <div className={styles.scrollArea}>
          <nav className={styles.primary}>
            {primary.map(([label, href, Icon]) => (
              <NavLink key={href} label={label} href={href} Icon={Icon} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
            ))}
          </nav>
          <div className={styles.divider} />
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span>Visual Production Lifecycle</span>
              <b>8 stages</b>
            </div>
            <div className={styles.timeline}>
              {LIFECYCLE_STAGES.map((stage) => {
                const isOpen = expanded === stage.id && !collapsed;
                const containsActive = routeStage?.id === stage.id;
                const workflowStatus = workflowByStage[stage.id] ?? 'unavailable';
                const listId = `${listIdPrefix}-${stage.id}`;
                const overviewHref = withContextQuery(stage.overviewHref, context);
                return (
                  <div className={`${styles.stage} ${isOpen ? styles.stageOpen : ''}`} key={stage.id}>
                    <div className={`${styles.stageRow} ${containsActive ? styles.stageActive : ''}`}>
                      <Link
                        href={overviewHref}
                        className={styles.stageLink}
                        onClick={() => {
                          setExpanded(stage.id);
                          setMobileOpen(false);
                          if (collapsed) setCollapsed(false);
                        }}
                        title={collapsed ? `${stage.number} ${stage.label}` : undefined}
                        aria-current={containsActive && activeMatch?.page.exact ? 'page' : undefined}
                      >
                        <span className={`${styles.statusDot} ${statusClass(workflowStatus)}`} title={`Workflow: ${workflowStatus}`} />
                        <span className={styles.stageNumber}>{stage.number}</span>
                        <span className={styles.stageLabel}>{stage.label}</span>
                        {!collapsed && (
                          <>
                            {workflowStatus === 'active' ? <em>Active</em> : null}
                            <span className={styles.count}>{pageCount(stage)}</span>
                          </>
                        )}
                      </Link>
                      {!collapsed ? (
                        <button
                          type="button"
                          className={styles.stageChevronButton}
                          aria-expanded={isOpen}
                          aria-controls={listId}
                          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${stage.label} pages`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setExpanded((current) => (current === stage.id ? '' : stage.id));
                          }}
                        >
                          <ChevronDown className={styles.stageChevron} size={15} />
                        </button>
                      ) : null}
                    </div>
                    {isOpen ? (
                      <div className={styles.pageList} id={listId} role="group" aria-label={`${stage.label} pages`}>
                        {stage.pages.map((page) => {
                          const active = matchesPageRoute(pathname, page);
                          const href = withContextQuery(page.href, {
                            ...context,
                            ...(page.dynamicKind === 'job' ? { jobId: null } : {}),
                            ...(page.dynamicKind === 'asset' ? { assetId: null } : {}),
                          });
                          return (
                            <Link
                              key={page.id}
                              href={href}
                              onClick={() => setMobileOpen(false)}
                              className={`${styles.pageLink} ${active ? styles.pageActive : ''}`}
                              aria-current={active ? 'page' : undefined}
                            >
                              <span className={styles.pageDot} />
                              <LifecycleIcon name={page.icon} size={14} />
                              <span>{page.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <div className={styles.divider} />
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span>Libraries</span>
            </div>
            {libraries.map(([label, href, Icon]) => (
              <NavLink key={href} label={label} href={href} Icon={Icon} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
            ))}
            {!collapsed ? (
              <Link href="/libraries" className={styles.viewAll} onClick={() => setMobileOpen(false)}>
                <Grid3X3 size={16} />
                View all libraries
                <ChevronRight size={15} />
              </Link>
            ) : null}
          </section>
          <div className={styles.divider} />
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span>System</span>
            </div>
            {system.map(([label, href, Icon]) => (
              <NavLink key={href} label={label} href={href} Icon={Icon} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
            ))}
          </section>
        </div>

        <footer className={styles.footer}>
          <div className={styles.avatar}>CO</div>
          <div className={styles.user}>
            <strong>Chris Ogbaisi</strong>
            <span>Administrator</span>
          </div>
          <Link href="/help" aria-label="Help">
            <CircleHelp size={20} />
          </Link>
          <Link href="/settings" aria-label="Settings">
            <Settings size={20} />
          </Link>
        </footer>
      </aside>
    </>
  );
}

/** @deprecated Prefer LIFECYCLE_STAGES from lifecycle-navigation config. */
export const lifecycleStages = LIFECYCLE_STAGES.map((stage) => ({
  number: stage.number,
  label: stage.label,
  href: stage.overviewHref,
  pages: stage.pages.map((page) => ({ label: page.label, href: page.href })),
}));
