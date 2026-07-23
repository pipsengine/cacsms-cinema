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
