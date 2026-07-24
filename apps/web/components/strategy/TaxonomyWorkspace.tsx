'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Compass,
  FolderTree,
  Gauge,
  GitBranch,
  Layers3,
  Network,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
} from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  analyzeTaxonomyQuality,
  ancestryPath,
  buildTaxonomyTree,
  childRecords,
  configDisplay,
  flattenTaxonomyTree,
  isBaselineStub,
  nodeTypeOf,
  parentIdOf,
  siblingRecords,
  type TaxonomyTreeNode,
} from '@/apps/web/lib/strategy-taxonomy';
import styles from './taxonomy-intel.module.css';

type TabId =
  | 'overview'
  | 'hierarchy'
  | 'relationships'
  | 'coverage'
  | 'reasoning'
  | 'evidence'
  | 'governance'
  | 'history'
  | 'audit';

type FilterId =
  | 'all'
  | 'fields'
  | 'domains'
  | 'subjects'
  | 'subfields'
  | 'topics'
  | 'validated'
  | 'orphaned'
  | 'duplicate'
  | 'conflict'
  | 'stale'
  | 'stub';

type IssueFilter = 'none' | 'orphans' | 'circular' | 'duplicates' | 'stubs' | 'invalid';

type AuditRow = {
  id: string;
  action: string;
  actorType: string;
  createdAt: string;
  reason: string | null;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'hierarchy', label: 'Hierarchy' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'reasoning', label: 'AI Reasoning' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'governance', label: 'Governance' },
  { id: 'history', label: 'History' },
  { id: 'audit', label: 'Audit' },
];

const LIFECYCLE = [
  { key: 'intake', label: 'Domain Intake', icon: Layers3 },
  { key: 'subjects', label: 'Subject Discovery', icon: Compass },
  { key: 'subfields', label: 'Subfield Expansion', icon: FolderTree },
  { key: 'topics', label: 'Topic Classification', icon: Target },
  { key: 'relations', label: 'Relationship Mapping', icon: GitBranch },
  { key: 'evidence', label: 'Evidence Validation', icon: BookOpen },
  { key: 'conflicts', label: 'Conflict Resolution', icon: ShieldCheck },
  { key: 'persist', label: 'Persistence', icon: CircleDot },
] as const;

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'COMPLETED':
    case 'RUNNING':
    case 'Validated':
    case 'Completed':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'CANCELLED':
    case 'ARCHIVED':
    case 'Failed':
      return styles.toneBlocked;
    case 'QUEUED':
    case 'PAUSED':
    case 'Warning':
    case 'Validating':
    case 'Running':
      return styles.toneWarning;
    default:
      return styles.toneDraft;
  }
}

function display(value?: string | null) {
  if (!value) return '—';
  if (value === 'UNMEASURED') return 'UNMEASURED';
  return value;
}

function sparkBars(seed: number) {
  return [4, 7, 5, 9, 6, 10, 8].map((base, index) => Math.max(3, ((base + seed + index * 2) % 10) + 3));
}

function lifecycleState(
  index: number,
  systemRunning: boolean,
  runStatus?: string | null,
  versionStatus?: string,
  nodeCount?: number,
) {
  if ((nodeCount ?? 0) > 0 && (versionStatus === 'ACTIVE' || versionStatus === 'READY')) {
    return 'done';
  }
  if ((nodeCount ?? 0) > 0) {
    return index <= 7 ? 'done' : 'pending';
  }
  if (runStatus === 'RUNNING' || runStatus === 'QUEUED' || systemRunning) {
    if (index < 1) return 'done';
    if (index === 1) return 'active';
    return 'pending';
  }
  if (versionStatus === 'DRAFT' || versionStatus === 'INVALID') {
    return index === 0 ? 'active' : 'pending';
  }
  return 'pending';
}

function matchesNodeType(type: string, filter: FilterId) {
  const normalised = type.toLowerCase();
  if (filter === 'fields') return normalised.includes('field');
  if (filter === 'domains') return normalised.includes('domain');
  if (filter === 'subjects') return normalised.includes('subject');
  if (filter === 'subfields') return normalised.includes('subfield') || normalised.includes('sub-field');
  if (filter === 'topics') return normalised.includes('topic') || normalised.includes('entity');
  return true;
}

function collectDescendantCount(node: TaxonomyTreeNode): number {
  return node.children.reduce((sum, child) => sum + 1 + collectDescendantCount(child), 0);
}

function findTreeNode(nodes: TaxonomyTreeNode[], id: string): TaxonomyTreeNode | null {
  for (const node of nodes) {
    if (node.record.id === id) return node;
    const nested = findTreeNode(node.children, id);
    if (nested) return nested;
  }
  return null;
}

export function TaxonomyWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('none');
  const [tab, setTab] = useState<TabId>('overview');
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const run = overview?.autonomyRun ?? null;
  const systemRunning = systemState === 'RUNNING';
  const quality = useMemo(() => analyzeTaxonomyQuality(records), [records]);
  const tree = useMemo(() => buildTaxonomyTree(records), [records]);

  async function load(preferId?: string | null) {
    setBusy(true);
    setError('');
    try {
      const [next, dashboard] = await Promise.all([
        strategyApi.overview(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      if (!next.available || !next.versionId) {
        setRecords([]);
        setAudit([]);
        return;
      }
      const [list, auditRows] = await Promise.all([
        strategyApi.list(next.versionId, 'taxonomy'),
        strategyApi.audit(next.versionId).catch(() => [] as AuditRow[]),
      ]);
      const live = list.filter((record) => record.status !== 'ARCHIVED');
      setRecords(live);
      setAudit(auditRows);
      const targetId = preferId ?? selectedId;
      const selected = targetId ? live.find((item) => item.id === targetId) : live[0];
      setSelectedId(selected?.id ?? null);
      setExpanded((prev) => {
        if (prev.size) return prev;
        const roots = buildTaxonomyTree(live)
          .map((node) => node.record.id)
          .filter((id): id is string => Boolean(id));
        return new Set(roots);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unavailable');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load(selectedId);
    }, systemRunning ? 3000 : 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemRunning, selectedId]);

  useEffect(() => {
    const onControlChanged = () => void load(selectedId);
    window.addEventListener('cacsms:system-control-changed', onControlChanged);
    return () => window.removeEventListener('cacsms:system-control-changed', onControlChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const validatedCount = records.filter(
    (item) => item.status === 'ACTIVE' || item.status === 'READY',
  ).length;

  const hierarchyCompleteness =
    records.length === 0
      ? 0
      : Math.round(
          Math.min(
            100,
            ((quality.validEdgeCount + quality.rootCount) /
              Math.max(1, records.length + quality.validEdgeCount)) *
              100,
          ),
        );

  const relationshipHealth =
    records.length === 0
      ? 0
      : Math.round(
          Math.min(
            100,
            100 -
              (quality.orphanIds.length + quality.circularIds.length) *
                (100 / Math.max(1, records.length)),
          ),
        );

  const kpis = useMemo(
    () => [
      {
        id: 'all' as const,
        label: 'Total Nodes',
        value: String(records.length),
        meta: 'Persisted taxonomy records',
        accent: '#2563EB',
        icon: FolderTree,
        bars: sparkBars(records.length),
      },
      {
        id: 'subjects' as const,
        label: 'Root Subjects',
        value: String(quality.rootCount),
        meta: 'Top-level hierarchy roots',
        accent: '#0284C7',
        icon: Network,
        bars: sparkBars(quality.rootCount),
      },
      {
        id: 'validated' as const,
        label: 'Validated Nodes',
        value: String(validatedCount),
        meta:
          records.length > 0
            ? `${Math.round((validatedCount / records.length) * 100)}% of nodes`
            : '0% of nodes',
        accent: '#16A34A',
        icon: CheckCircle2,
        bars: sparkBars(validatedCount),
      },
      {
        id: 'all' as const,
        label: 'Hierarchy Completeness',
        value: `${hierarchyCompleteness}%`,
        meta: `Max depth ${quality.maxDepth}`,
        accent: '#7C3AED',
        icon: Gauge,
        bars: sparkBars(hierarchyCompleteness),
      },
      {
        id: 'all' as const,
        label: 'Relationship Health',
        value: `${relationshipHealth}%`,
        meta: `${quality.validEdgeCount} valid edges`,
        accent: '#0F766E',
        icon: GitBranch,
        bars: sparkBars(relationshipHealth),
      },
      {
        id: 'orphaned' as const,
        label: 'Detected Issues',
        value: String(quality.issueCount),
        meta: 'Orphans, duplicates, cycles',
        accent: quality.issueCount ? '#DC2626' : '#16A34A',
        icon: AlertTriangle,
        bars: sparkBars(quality.issueCount + 1),
      },
    ],
    [records.length, quality, validatedCount, hierarchyCompleteness, relationshipHealth],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      const type = nodeTypeOf(record);
      const id = record.id ?? '';
      if (filter !== 'all' && !['validated', 'orphaned', 'duplicate', 'conflict', 'stale', 'stub'].includes(filter)) {
        if (!matchesNodeType(type, filter)) return false;
      }
      if (filter === 'validated' && !(record.status === 'ACTIVE' || record.status === 'READY')) return false;
      if (filter === 'orphaned' && !quality.orphanIds.includes(id)) return false;
      if (filter === 'duplicate' && !quality.duplicateIds.includes(id)) return false;
      if (filter === 'conflict' && !quality.circularIds.includes(id)) return false;
      if (filter === 'stale' && !isBaselineStub(record)) return false;
      if (filter === 'stub' && !isBaselineStub(record)) return false;
      if (issueFilter === 'orphans' && !quality.orphanIds.includes(id)) return false;
      if (issueFilter === 'circular' && !quality.circularIds.includes(id)) return false;
      if (issueFilter === 'duplicates' && !quality.duplicateIds.includes(id)) return false;
      if (issueFilter === 'stubs' && !isBaselineStub(record)) return false;
      if (issueFilter === 'invalid' && quality.orphanIds.includes(id) === false) return false;
      if (!needle) return true;
      const haystack = [
        record.name,
        record.status,
        record.description,
        type,
        configDisplay(record.configuration, 'keywords'),
        configDisplay(record.configuration, 'synonyms'),
        configDisplay(record.configuration, 'parentId'),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [records, query, filter, issueFilter, quality]);

  const filteredTree = useMemo(() => buildTaxonomyTree(filtered), [filtered]);
  const flatNodes = useMemo(() => flattenTaxonomyTree(filteredTree), [filteredTree]);

  const selected = records.find((item) => item.id === selectedId) ?? null;
  const selectedConfig = selected?.configuration ?? {};
  const path = selected ? ancestryPath(selected, records) : [];
  const children = selected?.id ? childRecords(selected.id, records) : [];
  const siblings = selected ? siblingRecords(selected, records) : [];
  const selectedTreeNode = selected?.id ? findTreeNode(tree, selected.id) : null;
  const descendantCount = selectedTreeNode ? collectDescendantCount(selectedTreeNode) : 0;

  const packageStatus =
    overview?.status === 'ACTIVE'
      ? 'Completed'
      : overview?.status === 'READY'
        ? 'Validated'
        : systemRunning
          ? 'Running'
          : overview?.status === 'INVALID'
            ? 'Failed'
            : 'Waiting';

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
      };

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpanded(
      new Set(
        flattenTaxonomyTree(tree)
          .map((node) => node.record.id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  function renderTreeNodes(nodes: TaxonomyTreeNode[]) {
    return nodes.map((node) => {
      const id = node.record.id ?? '';
      const hasChildren = node.children.length > 0;
      const isOpen = expanded.has(id);
      const active = id === selectedId;
      const type = nodeTypeOf(node.record);
      const issues: string[] = [];
      if (quality.orphanIds.includes(id)) issues.push('Orphan');
      if (quality.circularIds.includes(id)) issues.push('Cycle');
      if (quality.duplicateIds.includes(id)) issues.push('Duplicate');
      return (
        <li key={id} role="treeitem" aria-expanded={hasChildren ? isOpen : undefined} aria-selected={active}>
          <div className={styles.treeRow} style={{ paddingLeft: node.depth * 14 }}>
            <button
              type="button"
              className={styles.treeToggle}
              disabled={!hasChildren}
              aria-label={isOpen ? 'Collapse node' : 'Expand node'}
              onClick={() => hasChildren && toggleExpand(id)}
            >
              {hasChildren ? (isOpen ? '▾' : '▸') : '·'}
            </button>
            <button
              type="button"
              className={`${styles.treeNode} ${active ? styles.treeNodeActive : ''}`}
              onClick={() => setSelectedId(id)}
            >
              <div className={styles.treeNodeTop}>
                <strong>{node.record.name}</strong>
                <em className={`${styles.badge} ${statusTone(node.record.status)}`}>
                  {node.record.status}
                </em>
              </div>
              <div className={styles.treeNodeMeta}>
                <span className={styles.pill}>{type}</span>
                <span className={styles.pill}>{node.children.length} children</span>
                <span className={styles.pill}>P{node.record.priority}</span>
                {issues.map((issue) => (
                  <span key={issue} className={`${styles.pill} ${styles.toneWarning}`}>
                    {issue}
                  </span>
                ))}
              </div>
            </button>
          </div>
          {hasChildren && isOpen ? (
            <ul className={styles.treeList} role="group">
              {renderTreeNodes(node.children)}
            </ul>
          ) : null}
        </li>
      );
    });
  }

  if (busy && !overview) {
    return (
      <main className={styles.page}>
        <div className={styles.skeletonTop} />
        <div className={styles.skeletonGrid}>
          <div className={styles.skeletonPanel} />
          <div className={styles.skeletonPanel} />
          <div className={styles.skeletonPanel} />
        </div>
      </main>
    );
  }

  if (error || !overview?.available) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Strategy & Fields / Subject & Subfield Taxonomy</p>
        <h1 className={styles.title}>Subject & Subfield Taxonomy</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Strategy service unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p className={styles.lede}>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>Strategy & Fields / Subject & Subfield Taxonomy</p>
          <h1 className={styles.title}>Subject & Subfield Taxonomy</h1>
          <p className={styles.lede}>
            Autonomously generated and governed knowledge hierarchy defining the subjects, subfields,
            topics, relationships, and coverage boundaries used throughout the CACSMS content-production
            lifecycle.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 01</span>
          <span className={`${styles.badge} ${styles.toneAi}`}>System Owned</span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Observe Only</span>
          <span className={`${styles.badge} ${statusTone(packageStatus)}`}>{packageStatus}</span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only</strong>
          Taxonomy records are generated automatically during Stage 01. This workspace provides
          hierarchy exploration, explainability, validation, governance, versioning, and audit visibility
          only.
          {syncedAt ? ` Last synchronised ${new Date(syncedAt).toLocaleString()}.` : ''}
        </div>
      </div>

      <section className={styles.kpiGrid} aria-label="Executive taxonomy KPIs">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              type="button"
              className={styles.kpiCard}
              style={{ ['--accent' as string]: kpi.accent }}
              title={kpi.meta}
              onClick={() => {
                setFilter(kpi.id);
                setIssueFilter(kpi.label === 'Detected Issues' ? 'orphans' : 'none');
              }}
            >
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>{kpi.label}</span>
                <Icon size={16} className={styles.kpiIcon} aria-hidden />
              </div>
              <div className={styles.kpiValue}>{kpi.value}</div>
              <div className={styles.kpiMeta}>
                <span>{kpi.meta}</span>
                <span className={styles.spark} aria-hidden>
                  {kpi.bars.map((height, index) => (
                    <i key={`${kpi.label}-${index}`} style={{ height: `${height}px` }} />
                  ))}
                </span>
              </div>
            </button>
          );
        })}
      </section>

      <section className={styles.lifecycle} aria-label="Autonomous taxonomy lifecycle">
        <div className={styles.lifecycleHead}>
          <h2>Taxonomy lifecycle</h2>
          <span>
            {systemRunning
              ? 'Stage 01 running — subject discovery active'
              : `System ${systemState} · package ${overview.status}`}
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {LIFECYCLE.map((stage, index) => {
            const Icon = stage.icon;
            const state = lifecycleState(
              index,
              systemRunning,
              run?.status,
              overview.status,
              records.length,
            );
            return (
              <div key={stage.key} className={styles.stage} data-state={state}>
                <span className={styles.stageIcon}>
                  <Icon size={14} aria-hidden />
                </span>
                <strong>{stage.label}</strong>
                <span>
                  {state === 'done' ? 'Completed' : state === 'active' ? 'Running' : 'Waiting'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {records.length ? (
        <section className={styles.qualityGrid} aria-label="Taxonomy quality dashboard">
          {(
            [
              ['orphans', 'Duplicate / orphan', quality.orphanIds.length, 'orphaned'],
              ['circular', 'Circular refs', quality.circularIds.length, 'conflict'],
              ['duplicates', 'Duplicate names', quality.duplicateIds.length, 'duplicate'],
              ['stubs', 'Baseline stubs', quality.stubCount, 'stub'],
              ['invalid', 'Invalid parents', quality.invalidParentCount, 'orphaned'],
            ] as const
          ).map(([id, label, value, chip]) => (
            <button
              key={id}
              type="button"
              className={`${styles.qualityCard} ${issueFilter === id ? styles.qualityCardActive : ''}`}
              onClick={() => {
                setIssueFilter(issueFilter === id ? 'none' : id);
                setFilter(chip);
              }}
            >
              <strong>{value}</strong>
              <span>{label}</span>
            </button>
          ))}
        </section>
      ) : null}

      {!records.length ? (
        <section className={styles.waiting} aria-label="Awaiting autonomous taxonomy generation">
          <div className={styles.waitingIcon}>
            <FolderTree size={24} aria-hidden />
          </div>
          <h3>Awaiting Autonomous Taxonomy Generation</h3>
          <p>
            Stage 01 has not yet generated taxonomy records. The hierarchy will appear automatically
            after the global run starts and the Subject Discovery and Relationship Mapping steps
            complete.
          </p>
          <div className={styles.waitingChecklist}>
            <div>
              <strong>System</strong>
              {systemState}
            </div>
            <div>
              <strong>Package</strong>
              {overview.status}
            </div>
            <div>
              <strong>Autonomy run</strong>
              {run?.status ?? 'IDLE'}
            </div>
            <div>
              <strong>Expected sequence</strong>
              Intake → Discovery → Mapping → Persist
            </div>
          </div>
          <div className={styles.ghostCards} aria-hidden>
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
            <div className={styles.ghostCard} />
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.panel} aria-label="Taxonomy Explorer">
          <div className={styles.panelHead}>
            <h2>Taxonomy Explorer</h2>
            <p>
              {records.length} persisted
              {filtered.length !== records.length ? ` · ${filtered.length} shown` : ''} · auto-updating
            </p>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search taxonomy nodes"
              aria-label="Search taxonomy nodes"
            />
            <div className={styles.viewToggle} role="group" aria-label="Explorer view">
              <button
                type="button"
                className={`${styles.viewBtn} ${viewMode === 'tree' ? styles.viewBtnActive : ''}`}
                onClick={() => setViewMode('tree')}
              >
                Tree
              </button>
              <button
                type="button"
                className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
                onClick={() => setViewMode('list')}
              >
                Compact list
              </button>
              <button type="button" className={styles.viewBtn} onClick={expandAll}>
                Expand all
              </button>
              <button type="button" className={styles.viewBtn} onClick={collapseAll}>
                Collapse
              </button>
            </div>
            <div className={styles.chips} role="group" aria-label="Taxonomy filters">
              {(
                [
                  ['all', 'All'],
                  ['subjects', 'Subjects'],
                  ['subfields', 'Subfields'],
                  ['topics', 'Topics'],
                  ['validated', 'Validated'],
                  ['orphaned', 'Orphaned'],
                  ['duplicate', 'Duplicate'],
                  ['conflict', 'Conflict'],
                  ['stub', 'Stub'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.chip} ${filter === id ? styles.chipActive : ''}`}
                  onClick={() => {
                    setFilter(id);
                    setIssueFilter('none');
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length ? (
            viewMode === 'tree' ? (
              <ul className={styles.treeList} role="tree" aria-label="Taxonomy hierarchy">
                {renderTreeNodes(filteredTree)}
              </ul>
            ) : (
              <ul className={styles.explorerList}>
                {flatNodes.map(({ record, depth }) => {
                  const active = record.id === selectedId;
                  return (
                    <li key={record.id}>
                      <button
                        type="button"
                        className={`${styles.objCard} ${active ? styles.objCardActive : ''}`}
                        style={{ marginLeft: depth * 8 }}
                        onClick={() => setSelectedId(record.id ?? null)}
                      >
                        <div className={styles.objCardTop}>
                          <strong>{record.name}</strong>
                          <em className={`${styles.badge} ${statusTone(record.status)}`}>
                            {record.status}
                          </em>
                        </div>
                        <div className={styles.objMeta}>
                          <span className={styles.pill}>{nodeTypeOf(record)}</span>
                          <span className={styles.pill}>Depth {depth}</span>
                          <span className={styles.pill}>P{record.priority}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <div className={styles.empty}>
              <h3>{systemRunning ? 'Discovery in progress' : 'No matching nodes'}</h3>
              <p>
                {systemRunning
                  ? 'Subject Discovery is materialising taxonomy records. This explorer updates automatically.'
                  : 'Adjust filters or wait for Stage 01 to persist the hierarchy.'}
              </p>
            </div>
          )}
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Taxonomy Node Intelligence">
          <div className={styles.panelHead}>
            <h2>{selected?.name || 'Taxonomy Node Intelligence'}</h2>
            <p>Explainable hierarchy, governance, and lineage for the selected system-owned node.</p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Taxonomy node tabs">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`${styles.tab} ${tab === item.id ? styles.tabActive : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.tabBody} role="tabpanel">
            {!selected ? (
              <div className={styles.empty}>
                <h3>No node selected</h3>
                <p>Persisted nodes are selected automatically when Stage 01 completes.</p>
              </div>
            ) : null}

            {selected && tab === 'overview' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Node identity</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Node name</span>
                      <strong>{display(selected.name)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Node code</span>
                      <strong>{display(configDisplay(selectedConfig, 'systemKey') || selected.id)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Node type</span>
                      <strong>{display(nodeTypeOf(selected))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Parent node</span>
                      <strong>
                        {display(
                          parentIdOf(selected)
                            ? records.find((item) => item.id === parentIdOf(selected))?.name
                            : 'Root',
                        )}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Taxonomy depth</span>
                      <strong>{path.length ? path.length - 1 : 0}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Status</span>
                      <strong>{display(selected.status)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Priority</span>
                      <strong>{selected.priority}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Owning agent</span>
                      <strong>Subject Discovery Agent</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Effective from</span>
                      <strong>
                        {selected.effectiveFrom
                          ? new Date(selected.effectiveFrom).toLocaleString()
                          : '—'}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Knowledge entity</span>
                      <strong>{display(configDisplay(selectedConfig, 'knowledgeEntityId'))}</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Description and purpose</h3>
                  <p>{display(selected.description)}</p>
                  <div className={styles.groupList} style={{ marginTop: 12 }}>
                    <div className={styles.groupItem}>
                      <span>Included concepts</span>
                      <b>{display(configDisplay(selectedConfig, 'relatedConcepts') || configDisplay(selectedConfig, 'keywords'))}</b>
                    </div>
                    <div className={styles.groupItem}>
                      <span>Excluded concepts</span>
                      <b>{display(configDisplay(selectedConfig, 'exclusions'))}</b>
                    </div>
                    <div className={styles.groupItem}>
                      <span>Synonyms</span>
                      <b>{display(configDisplay(selectedConfig, 'synonyms'))}</b>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Node health</h3>
                  <div className={styles.scoreRow}>
                    {[
                      ['Hierarchy', hierarchyCompleteness],
                      ['Relationships', relationshipHealth],
                      ['Priority weight', selected.priority],
                      ['Package readiness', overview.readiness ?? 0],
                    ].map(([label, value]) => (
                      <div key={String(label)} className={styles.metricTile}>
                        <span className={styles.kpiLabel}>{label}</span>
                        <div
                          className={styles.ring}
                          style={{ ['--p' as string]: Number(value) }}
                          aria-hidden
                        />
                        <strong>{Number(value)}%</strong>
                      </div>
                    ))}
                  </div>
                  <p style={{ marginTop: 12, color: 'var(--muted)' }}>
                    Classification confidence, evidence strength, and freshness remain UNMEASURED until
                    Research & Evidence publishes verified scores.
                  </p>
                </article>
              </>
            ) : null}

            {selected && tab === 'hierarchy' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Ancestor path</h3>
                  <div className={styles.pathTrail}>
                    {path.map((node, index) => (
                      <span key={node.id} style={{ display: 'contents' }}>
                        {index > 0 ? <span className={styles.pathSep}>→</span> : null}
                        <button
                          type="button"
                          className={styles.pathChip}
                          onClick={() => setSelectedId(node.id ?? null)}
                        >
                          {node.name}
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Children</span>
                      <strong>{children.length}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Siblings</span>
                      <strong>{siblings.length}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Descendants</span>
                      <strong>{descendantCount}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Max depth (forest)</span>
                      <strong>{quality.maxDepth}</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Children</h3>
                  {children.length ? (
                    <ul className={styles.tree}>
                      {children.map((child) => (
                        <li key={child.id}>
                          <button type="button" className={styles.pathChip} onClick={() => setSelectedId(child.id ?? null)}>
                            {child.name} · {nodeTypeOf(child)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No child nodes persisted under this node.</p>
                  )}
                </article>
                <article className={styles.sectionCard}>
                  <h3>Integrity checks</h3>
                  <div className={styles.groupList}>
                    <div className={styles.groupItem}>
                      <span>Invalid parent reference</span>
                      <b>{selected.id && quality.orphanIds.includes(selected.id) ? 'Detected' : 'None'}</b>
                    </div>
                    <div className={styles.groupItem}>
                      <span>Circular reference</span>
                      <b>{selected.id && quality.circularIds.includes(selected.id) ? 'Detected' : 'None'}</b>
                    </div>
                    <div className={styles.groupItem}>
                      <span>Duplicate name/type</span>
                      <b>{selected.id && quality.duplicateIds.includes(selected.id) ? 'Detected' : 'None'}</b>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'relationships' ? (
              <article className={styles.sectionCard}>
                <h3>Relationship map</h3>
                <div className={styles.depChain}>
                  {['Parent', selected.name, ...children.slice(0, 3).map((item) => item.name)].map(
                    (item, index) => (
                      <span key={`${item}-${index}`} style={{ display: 'contents' }}>
                        {index > 0 ? <span className={styles.depArrow}>→</span> : null}
                        <span className={styles.depNode}>{item}</span>
                      </span>
                    ),
                  )}
                </div>
                <div className={styles.groupList} style={{ marginTop: 14 }}>
                  <div className={styles.groupItem}>
                    <span>Related concepts</span>
                    <b>{display(configDisplay(selectedConfig, 'relatedConcepts'))}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Geographic variations</span>
                    <b>{display(configDisplay(selectedConfig, 'geographicVariations'))}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Downstream stages</span>
                    <b>Content Intelligence → Idea Qualification → Research & Evidence</b>
                  </div>
                </div>
                <p style={{ marginTop: 12, color: 'var(--muted)' }}>
                  Interactive zoom/pan graph rendering uses persisted parent and related-concept links.
                  Weak or unmeasured edge strengths remain UNMEASURED.
                </p>
              </article>
            ) : null}

            {selected && tab === 'coverage' ? (
              <article className={styles.sectionCard}>
                <h3>Coverage applicability</h3>
                <div className={styles.groupList}>
                  <div className={styles.groupItem}>
                    <span>Geographic variations</span>
                    <b>{display(configDisplay(selectedConfig, 'geographicVariations'))}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Local terminology</span>
                    <b>{display(configDisplay(selectedConfig, 'localTerminology'))}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Historical terms</span>
                    <b>{display(configDisplay(selectedConfig, 'historicalTerms'))}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Keywords</span>
                    <b>{display(configDisplay(selectedConfig, 'keywords'))}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Exclusions</span>
                    <b>{display(configDisplay(selectedConfig, 'exclusions'))}</b>
                  </div>
                </div>
                <p style={{ marginTop: 12, color: 'var(--muted)' }}>
                  Full Node × Audience × Region × Language × Format × Channel matrix populates when
                  linked Stage 01 coverage records are persisted. Gaps show as empty rather than
                  fabricated values.
                </p>
              </article>
            ) : null}

            {selected && tab === 'reasoning' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Why this node exists</h3>
                  <p>
                    Generated by the Subject Discovery Agent during Stage 01 to structure permitted
                    knowledge coverage
                    {path.length > 1 ? ` under ${path[path.length - 2]?.name}` : ' at taxonomy root'}.
                    {selected.description ? ` ${selected.description}` : ''}
                  </p>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Decision factors</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Generating agent</span>
                      <strong>Subject Discovery Agent</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Origin</span>
                      <strong>{display(configDisplay(selectedConfig, 'origin'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Classification confidence</span>
                      <strong>UNMEASURED</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Baseline stub</span>
                      <strong>{isBaselineStub(selected) ? 'Yes' : 'No'}</strong>
                    </div>
                  </div>
                </article>
              </>
            ) : null}

            {selected && tab === 'evidence' ? (
              <article className={styles.sectionCard}>
                <h3>Evidence posture</h3>
                <p>
                  Evidence rows for this taxonomy node appear after Research & Evidence validates
                  supporting sources. Authority, reliability, citation count, and freshness scores
                  remain UNMEASURED until those packages are persisted.
                </p>
                <div className={styles.groupList} style={{ marginTop: 12 }}>
                  <div className={styles.groupItem}>
                    <span>Knowledge entity link</span>
                    <b>{display(configDisplay(selectedConfig, 'knowledgeEntityId'))}</b>
                  </div>
                  <div className={styles.groupItem}>
                    <span>Evidence strength</span>
                    <b>UNMEASURED</b>
                  </div>
                </div>
              </article>
            ) : null}

            {selected && tab === 'governance' ? (
              <>
                <article className={styles.sectionCard}>
                  <h3>Governance classification</h3>
                  <div className={styles.identityGrid}>
                    <div className={styles.field}>
                      <span>Node status</span>
                      <strong>{display(selected.status)}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Issue flags</span>
                      <strong>
                        {[
                          selected.id && quality.orphanIds.includes(selected.id) ? 'Orphan' : null,
                          selected.id && quality.circularIds.includes(selected.id) ? 'Circular' : null,
                          selected.id && quality.duplicateIds.includes(selected.id) ? 'Duplicate' : null,
                          isBaselineStub(selected) ? 'Baseline stub' : null,
                        ]
                          .filter(Boolean)
                          .join(', ') || 'None detected'}
                      </strong>
                    </div>
                    <div className={styles.field}>
                      <span>Exclusions</span>
                      <strong>{display(configDisplay(selectedConfig, 'exclusions'))}</strong>
                    </div>
                    <div className={styles.field}>
                      <span>Approval state</span>
                      <strong>{display(overview.status)}</strong>
                    </div>
                  </div>
                </article>
                <article className={styles.sectionCard}>
                  <h3>Usage boundaries</h3>
                  <p>
                    Permitted usage follows Stage 01 package status <strong>{overview.status}</strong>.
                    Restricted and prohibited claims require linked editorial policy and source-policy
                    records. Manual taxonomy overrides are not available on this page.
                  </p>
                </article>
              </>
            ) : null}

            {selected && tab === 'history' ? (
              <article className={styles.sectionCard}>
                <h3>Version timeline</h3>
                <ul className={styles.timeline}>
                  <li>
                    <span className={styles.dot} aria-hidden />
                    <div>
                      <strong>Node discovery / materialisation</strong>
                      <p>
                        {selected.effectiveFrom
                          ? new Date(selected.effectiveFrom).toLocaleString()
                          : 'Timestamp not persisted'}
                      </p>
                    </div>
                  </li>
                  <li>
                    <span className={styles.dot} aria-hidden />
                    <div>
                      <strong>Current package</strong>
                      <p>
                        v{overview.versionNumber ?? '—'} · {overview.status} · readiness{' '}
                        {overview.readiness ?? 0}%
                      </p>
                    </div>
                  </li>
                  <li>
                    <span className={styles.dot} aria-hidden />
                    <div>
                      <strong>Autonomy run</strong>
                      <p>{run?.status ?? 'IDLE'}</p>
                    </div>
                  </li>
                </ul>
              </article>
            ) : null}

            {tab === 'audit' ? (
              <article className={styles.sectionCard}>
                <h3>Audit trail</h3>
                {audit.length ? (
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Actor</th>
                        <th>Action</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.slice(0, 12).map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.createdAt).toLocaleString()}</td>
                          <td>{row.actorType}</td>
                          <td>{row.action}</td>
                          <td>{row.reason ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No audit events persisted for this version yet.</p>
                )}
              </article>
            ) : null}
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.insights}`} aria-label="Taxonomy Intelligence">
          <div className={styles.scoreHero}>
            <span className={styles.kpiLabel}>Taxonomy Intelligence</span>
            <strong>{selected ? nodeTypeOf(selected) : '—'}</strong>
            <span className={`${styles.badge} ${styles.toneAi}`}>
              <BrainCircuit size={12} aria-hidden /> Taxonomy agent
            </span>
          </div>
          <div>
            <div className={styles.insightRow}>
              <span>Node health</span>
              <b>{selected ? selected.status : '—'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Classification confidence</span>
              <b>UNMEASURED</b>
            </div>
            <div className={styles.insightRow}>
              <span>Hierarchy completeness</span>
              <b>{hierarchyCompleteness}%</b>
            </div>
            <div className={styles.insightRow}>
              <span>Relationship health</span>
              <b>{relationshipHealth}%</b>
            </div>
            <div className={styles.insightRow}>
              <span>Child nodes</span>
              <b>{children.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Detected issues</span>
              <b>{quality.issueCount}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Package readiness</span>
              <b>{overview.readiness ?? 0}%</b>
            </div>
            <div className={styles.insightRow}>
              <span>Next validation</span>
              <b>System-scheduled</b>
            </div>
          </div>
          <div className={styles.xai}>
            <h3>AI recommendations</h3>
            <ul>
              <li>
                {quality.orphanIds.length
                  ? `Reassign ${quality.orphanIds.length} orphaned node(s) when parent links are repaired by autonomy.`
                  : 'No orphaned nodes detected in the persisted forest.'}
              </li>
              <li>
                {quality.duplicateIds.length
                  ? 'Review duplicate name/type pairs for merge during Conflict Resolution.'
                  : 'No duplicate name/type collisions detected.'}
              </li>
              <li>
                {selected && isBaselineStub(selected)
                  ? 'Baseline stub present — expect richer subject expansion after Domain Intake completes.'
                  : 'Strengthen evidence links once Research & Evidence publishes source packages.'}
              </li>
            </ul>
          </div>
          <div className={styles.radar} aria-label="Taxonomy health axes">
            {[
              ['Completeness', hierarchyCompleteness],
              ['Relationships', relationshipHealth],
              ['Validated', records.length ? Math.round((validatedCount / records.length) * 100) : 0],
              ['Priority', selected?.priority ?? 0],
              ['Readiness', overview.readiness ?? 0],
              ['Issues free', Math.max(0, 100 - quality.issueCount * 10)],
            ].map(([label, value]) => (
              <div key={label} className={styles.radarItem}>
                <span>{label}</span>
                <div className={styles.radarBar}>
                  <i style={{ width: `${Math.max(0, Math.min(100, Number(value)))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section className={styles.bottom} aria-label="Timeline audit and activity">
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Execution timeline</h2>
            <p>Persisted Stage 01 milestones</p>
          </div>
          <div className={styles.tabBody}>
            <ul className={styles.timeline}>
              <li>
                <span className={styles.dot} aria-hidden />
                <div>
                  <strong>Strategy version</strong>
                  <p>
                    v{overview.versionNumber ?? '—'} · {overview.status}
                  </p>
                </div>
              </li>
              <li>
                <span className={styles.dot} aria-hidden />
                <div>
                  <strong>Taxonomy persistence</strong>
                  <p>
                    {records.length} live nodes · {quality.rootCount} roots
                  </p>
                </div>
              </li>
              <li>
                <span className={styles.dot} aria-hidden />
                <div>
                  <strong>System control</strong>
                  <p>{systemState}</p>
                </div>
              </li>
            </ul>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Live activity</h2>
            <p>Current autonomy posture</p>
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightRow}>
              <span>Run status</span>
              <b>{run?.status ?? 'IDLE'}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Nodes discovered</span>
              <b>{records.length}</b>
            </div>
            <div className={styles.insightRow}>
              <span>Valid edges</span>
              <b>{quality.validEdgeCount}</b>
            </div>
            <div className={styles.insightRow}>
              <span>
                <Activity size={12} aria-hidden /> Agent
              </span>
              <b>Subject Discovery</b>
            </div>
            {systemRunning ? (
              <div className={styles.insightRow}>
                <span>
                  <Timer size={12} aria-hidden /> Mode
                </span>
                <b>Live polling</b>
              </div>
            ) : null}
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Recent audit</h2>
            <p>Latest strategy events</p>
          </div>
          <div className={styles.tabBody}>
            {audit.slice(0, 5).map((row) => (
              <div key={row.id} className={styles.insightRow}>
                <span>{row.action}</span>
                <b>{row.actorType}</b>
              </div>
            ))}
            {!audit.length ? <p className={styles.empty}>No events yet.</p> : null}
          </div>
        </article>
      </section>
    </motion.main>
  );
}
