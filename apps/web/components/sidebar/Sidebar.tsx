'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight, Menu, X, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { findStageForPathname, withContextQuery } from '@/apps/web/config/lifecycle-navigation';
import { BrandMark } from './BrandMark';
import {
  productionNavigation,
  serviceNavigation,
  statusLabels,
  type NavItem,
  type NavStatus,
} from './navigation';
import styles from './Sidebar.module.css';

export type WorkflowStatus = {
  engine: 'online' | 'offline';
  autonomousRun: 'active' | 'pending' | 'blocked' | 'offline';
  stageStatuses?: Partial<Record<string, NavStatus>>;
};

type SidebarProps = {
  status?: WorkflowStatus;
  workflowHref?: string;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
};

const CONTEXT_KEYS = [
  'projectId',
  'workflowRunId',
  'scriptId',
  'sceneId',
  'shotId',
  'jobId',
  'candidateId',
  'assetId',
] as const;

function isSelected(pathname: string, href: string) {
  if (href === '/') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function StatusDot({ status = 'pending' }: { status?: NavStatus }) {
  return (
    <span
      className={`${styles.statusDot} ${styles[`status_${status}`]}`}
      title={statusLabels[status]}
      aria-label={statusLabels[status]}
    />
  );
}

function mapExecutionToNav(status?: string): NavStatus {
  switch (status) {
    case 'COMPLETED':
      return 'online';
    case 'ACTIVE':
    case 'PAUSING':
    case 'RECOVERING':
    case 'DEGRADED':
    case 'QUEUED':
      return 'active';
    case 'BLOCKED':
    case 'FAILED':
    case 'EMERGENCY_STOPPED':
      return 'blocked';
    case 'UNAVAILABLE':
      return 'offline';
    default:
      return 'pending';
  }
}

export function Sidebar({
  status: statusProp,
  workflowHref = '/',
  onCollapsedChange,
  className = '',
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('cacsms-sidebar-collapsed') === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(['visuals']));
  const [runtimeStatus, setRuntimeStatus] = useState<WorkflowStatus>(
    statusProp ?? { engine: 'offline', autonomousRun: 'pending' },
  );

  const context = useMemo(() => {
    const next: Record<string, string | null> = {};
    for (const key of CONTEXT_KEYS) next[key] = searchParams.get(key);
    return next;
  }, [searchParams]);

  const status = statusProp ?? runtimeStatus;

  useEffect(() => {
    if (statusProp) return;
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams();
        if (context.workflowRunId) params.set('workflowRunId', context.workflowRunId);
        if (context.projectId) params.set('projectId', context.projectId);
        if (context.jobId) params.set('jobId', context.jobId);

        const [lifecycleResponse, systemResponse] = await Promise.all([
          fetch(`/api/lifecycle/status?${params.toString()}`, { cache: 'no-store' }),
          fetch('/api/system/status', { cache: 'no-store' }).catch(() => null),
        ]);

        const stageStatuses: Partial<Record<string, NavStatus>> = {};
        let autonomousRun: WorkflowStatus['autonomousRun'] = 'pending';
        let engine: WorkflowStatus['engine'] = 'offline';

        if (lifecycleResponse.ok) {
          const payload = (await lifecycleResponse.json()) as {
            available?: boolean;
            overallStatus?: string;
            activeStageId?: string | null;
            stages?: Array<{ id: string; executionStatus?: string }>;
          };
          for (const stage of payload.stages ?? []) {
            stageStatuses[stage.id] = mapExecutionToNav(stage.executionStatus);
          }
          if (payload.activeStageId || payload.overallStatus === 'ACTIVE' || payload.overallStatus === 'QUEUED') {
            stageStatuses.visuals = 'active';
          } else if (payload.overallStatus === 'BLOCKED' || payload.overallStatus === 'FAILED') {
            stageStatuses.visuals = 'blocked';
          } else if (payload.overallStatus === 'COMPLETED') {
            stageStatuses.visuals = 'online';
          } else {
            stageStatuses.visuals = 'pending';
          }
          const runStatus = mapExecutionToNav(payload.overallStatus);
          autonomousRun =
            runStatus === 'online' || runStatus === 'active'
              ? 'active'
              : runStatus === 'blocked'
                ? 'blocked'
                : runStatus === 'offline'
                  ? 'offline'
                  : 'pending';
        }

        if (systemResponse?.ok) {
          const system = (await systemResponse.json()) as { isHealthy?: boolean };
          engine = system.isHealthy ? 'online' : 'offline';
        } else if (lifecycleResponse.ok) {
          engine = 'online';
        }

        if (!cancelled) {
          setRuntimeStatus({ engine, autonomousRun, stageStatuses });
        }
      } catch {
        if (!cancelled) {
          setRuntimeStatus({ engine: 'offline', autonomousRun: 'offline', stageStatuses: {} });
        }
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [statusProp, context.workflowRunId, context.projectId, context.jobId]);

  useEffect(() => {
    const routeStage = findStageForPathname(pathname);
    const parent = productionNavigation.find((item) =>
      item.children?.some((child) => isSelected(pathname, child.href)),
    );
    setOpenGroups((current) => {
      const next = new Set(current);
      if (parent) next.add(parent.id);
      if (routeStage) next.add('visuals');
      return next;
    });
    setMobileOpen(false);
  }, [pathname]);

  const navWithRuntimeStatus = useMemo(
    () =>
      productionNavigation.map((item) => ({
        ...item,
        status: status.stageStatuses?.[item.id] ?? item.status,
        children: item.children?.map((child) => ({
          ...child,
          status: status.stageStatuses?.[child.id] ?? child.status,
          href: withContextQuery(child.href, context),
        })),
        href: withContextQuery(item.href, context),
      })),
    [status.stageStatuses, context],
  );

  const setSidebarCollapsed = (next: boolean) => {
    setCollapsed(next);
    localStorage.setItem('cacsms-sidebar-collapsed', String(next));
    onCollapsedChange?.(next);
  };

  const toggleGroup = (id: string) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderPrimaryItem = (item: NavItem) => {
    const Icon = item.icon;
    const childActive = item.children?.some((child) => isSelected(pathname, child.href.split('?')[0]));
    const selected = isSelected(pathname, item.href.split('?')[0]) || Boolean(childActive);
    const expanded = openGroups.has(item.id);
    const hasChildren = Boolean(item.children?.length);

    return (
      <li key={item.id}>
        <div className={`${styles.primaryRow} ${selected ? styles.selectedParent : ''}`}>
          <Link
            className={styles.primaryLink}
            href={item.href}
            aria-current={selected && !childActive ? 'page' : undefined}
            onClick={() => {
              if (hasChildren) setOpenGroups((current) => new Set(current).add(item.id));
              setMobileOpen(false);
            }}
            title={collapsed ? item.label : undefined}
          >
            {Icon ? <Icon className={styles.icon} aria-hidden="true" /> : null}
            <span className={styles.sequence}>{item.sequence}</span>
            <span className={styles.label}>{item.label}</span>
          </Link>
          {!collapsed ? (
            <>
              <StatusDot status={item.status} />
              {hasChildren ? (
                <button
                  className={styles.chevronButton}
                  type="button"
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
                  aria-expanded={expanded}
                  aria-controls={`nav-group-${item.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleGroup(item.id);
                  }}
                >
                  <ChevronDown className={expanded ? undefined : styles.chevronClosed} />
                </button>
              ) : (
                <ChevronRight className={styles.rowChevron} aria-hidden="true" />
              )}
            </>
          ) : null}
        </div>
        {hasChildren && expanded && !collapsed ? (
          <ol className={styles.stageList} id={`nav-group-${item.id}`}>
            {item.children?.map((child) => {
              const childSelected = isSelected(pathname, child.href.split('?')[0]);
              return (
                <li key={child.id} className={childSelected ? styles.selectedStage : ''}>
                  <Link
                    href={child.href}
                    aria-current={childSelected ? 'page' : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className={styles.stageNode} aria-hidden="true" />
                    <span className={styles.stageSequence}>{child.sequence}</span>
                    <span className={styles.stageLabel}>{child.label}</span>
                    <StatusDot status={child.status} />
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : null}
      </li>
    );
  };

  return (
    <>
      <button
        className={styles.mobileTrigger}
        type="button"
        aria-label="Open navigation"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={20} />
      </button>
      {mobileOpen ? (
        <button
          className={styles.backdrop}
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <aside
        className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''} ${className}`}
        data-collapsed={collapsed ? 'true' : 'false'}
        aria-label="CACSMS primary navigation"
      >
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <BrandMark />
            {mobileOpen ? (
              <button
                type="button"
                className={styles.mobileClose}
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
          <div className={styles.engineStatus}>
            <span
              className={`${styles.engineDot} ${status.engine === 'online' ? styles.engineOnline : styles.engineOffline}`}
            />
            <span>Engine {status.engine === 'online' ? 'Online' : 'Offline'}</span>
          </div>
        </header>

        <nav className={styles.navigation} aria-label="Production stages">
          <ol className={styles.primaryList}>{navWithRuntimeStatus.map(renderPrimaryItem)}</ol>

          <div className={styles.services}>
            <h2>Platform Services</h2>
            <ul>
              {serviceNavigation.map((item) => {
                const Icon = item.icon!;
                const href = withContextQuery(item.href, context);
                const selected = isSelected(pathname, item.href);
                return (
                  <li key={item.id}>
                    <Link
                      className={selected ? styles.selectedService : ''}
                      href={href}
                      aria-current={selected ? 'page' : undefined}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className={styles.icon} aria-hidden="true" />
                      <span className={styles.label}>{item.label}</span>
                      {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
                      <ChevronRight className={styles.rowChevron} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        <footer className={styles.footer}>
          <div className={styles.runCard}>
            <span className={styles.runIcon}>
              <Zap aria-hidden="true" />
            </span>
            <span className={styles.runCopy}>
              <strong>Autonomous Run</strong>
              <span>
                <StatusDot status={status.autonomousRun} />
                {statusLabels[status.autonomousRun]}
              </span>
            </span>
            <Link href={withContextQuery(workflowHref, context)} onClick={() => setMobileOpen(false)}>
              <span>View workflow</span>
              <ChevronRight aria-hidden="true" />
            </Link>
          </div>
          <button
            className={styles.collapseButton}
            type="button"
            onClick={() => setSidebarCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
            <span>{collapsed ? 'Expand' : 'Collapse sidebar'}</span>
          </button>
        </footer>
      </aside>
    </>
  );
}
