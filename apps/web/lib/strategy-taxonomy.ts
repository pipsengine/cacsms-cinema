import type { StrategyRecord } from '@/lib/strategy/contracts';
import { getSection } from '@/apps/web/lib/strategy-config';

export type TaxonomyTreeNode = {
  record: StrategyRecord;
  depth: number;
  children: TaxonomyTreeNode[];
};

export type TaxonomyFlatNode = {
  record: StrategyRecord;
  depth: number;
};

const TAXONOMY_FIELDS = getSection('taxonomy')?.fields ?? [];

export function taxonomyFieldKeys(): string[] {
  return TAXONOMY_FIELDS;
}

export function parentIdOf(record: StrategyRecord): string | null {
  const config = record.configuration ?? {};
  const raw = config.parentId ?? config.parent_id;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return null;
}

export function configDisplay(config: Record<string, unknown> | undefined, key: string): string {
  if (!config) return '';
  const value = config[key];
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Build a forest from parentId links. Unknown parents become roots (no fabricated nodes). */
export function buildTaxonomyTree(records: StrategyRecord[]): TaxonomyTreeNode[] {
  const withIds = records.filter((record): record is StrategyRecord & { id: string } =>
    Boolean(record.id),
  );
  const byId = new Map(withIds.map((record) => [record.id, record]));
  const childrenMap = new Map<string | null, Array<StrategyRecord & { id: string }>>();

  for (const record of withIds) {
    let parent = parentIdOf(record);
    if (parent && !byId.has(parent)) parent = null;
    const bucket = childrenMap.get(parent) ?? [];
    bucket.push(record);
    childrenMap.set(parent, bucket);
  }

  function walk(parentId: string | null, depth: number): TaxonomyTreeNode[] {
    const kids = childrenMap.get(parentId) ?? [];
    return kids
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name) || a.priority - b.priority)
      .map((record) => ({
        record,
        depth,
        children: walk(record.id, depth + 1),
      }));
  }

  return walk(null, 0);
}

export function flattenTaxonomyTree(nodes: TaxonomyTreeNode[]): TaxonomyFlatNode[] {
  const out: TaxonomyFlatNode[] = [];
  function visit(list: TaxonomyTreeNode[]) {
    for (const node of list) {
      out.push({ record: node.record, depth: node.depth });
      visit(node.children);
    }
  }
  visit(nodes);
  return out;
}

export function isBaselineStub(record: StrategyRecord): boolean {
  const origin = record.configuration?.origin;
  return origin === 'SYSTEM_POLICY' || record.name === 'Taxonomy';
}

export function fieldLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

export function nodeTypeOf(record: StrategyRecord): string {
  return configDisplay(record.configuration, 'nodeType') || 'node';
}

export type TaxonomyQuality = {
  orphanIds: string[];
  circularIds: string[];
  duplicateIds: string[];
  stubCount: number;
  rootCount: number;
  maxDepth: number;
  validEdgeCount: number;
  invalidParentCount: number;
  issueCount: number;
};

/** Derive hierarchy quality metrics from persisted parentId links only. */
export function analyzeTaxonomyQuality(records: StrategyRecord[]): TaxonomyQuality {
  const withIds = records.filter((record): record is StrategyRecord & { id: string } =>
    Boolean(record.id),
  );
  const byId = new Map(withIds.map((record) => [record.id, record]));
  const orphanIds: string[] = [];
  const circularIds: string[] = [];
  let validEdgeCount = 0;
  let invalidParentCount = 0;

  for (const record of withIds) {
    const parent = parentIdOf(record);
    if (!parent) continue;
    if (!byId.has(parent)) {
      orphanIds.push(record.id);
      invalidParentCount += 1;
      continue;
    }
    validEdgeCount += 1;
    const seen = new Set<string>([record.id]);
    let cursor: string | null = parent;
    while (cursor) {
      if (seen.has(cursor)) {
        circularIds.push(record.id);
        break;
      }
      seen.add(cursor);
      const next = byId.get(cursor);
      cursor = next ? parentIdOf(next) : null;
      if (cursor && !byId.has(cursor)) break;
    }
  }

  const nameBuckets = new Map<string, string[]>();
  for (const record of withIds) {
    const key = `${record.name.trim().toLowerCase()}::${nodeTypeOf(record).toLowerCase()}`;
    const bucket = nameBuckets.get(key) ?? [];
    bucket.push(record.id);
    nameBuckets.set(key, bucket);
  }
  const duplicateIds = [...nameBuckets.values()].filter((ids) => ids.length > 1).flat();

  const tree = buildTaxonomyTree(records);
  let maxDepth = 0;
  function walkDepth(nodes: TaxonomyTreeNode[]) {
    for (const node of nodes) {
      maxDepth = Math.max(maxDepth, node.depth);
      walkDepth(node.children);
    }
  }
  walkDepth(tree);

  const uniqueIssues = new Set([...orphanIds, ...circularIds, ...duplicateIds]);
  return {
    orphanIds,
    circularIds,
    duplicateIds,
    stubCount: records.filter(isBaselineStub).length,
    rootCount: tree.length,
    maxDepth,
    validEdgeCount,
    invalidParentCount,
    issueCount: uniqueIssues.size,
  };
}

export function ancestryPath(
  record: StrategyRecord,
  records: StrategyRecord[],
): StrategyRecord[] {
  const byId = new Map(
    records.filter((item): item is StrategyRecord & { id: string } => Boolean(item.id)).map((item) => [
      item.id,
      item,
    ]),
  );
  const path: StrategyRecord[] = [];
  const seen = new Set<string>();
  let cursor: StrategyRecord | undefined = record;
  while (cursor?.id) {
    if (seen.has(cursor.id)) break;
    seen.add(cursor.id);
    path.unshift(cursor);
    const parent = parentIdOf(cursor);
    cursor = parent ? byId.get(parent) : undefined;
  }
  return path;
}

export function childRecords(parentId: string, records: StrategyRecord[]): StrategyRecord[] {
  return records
    .filter((record) => parentIdOf(record) === parentId)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function siblingRecords(record: StrategyRecord, records: StrategyRecord[]): StrategyRecord[] {
  const parent = parentIdOf(record);
  return records
    .filter((item) => item.id !== record.id && parentIdOf(item) === parent)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}
