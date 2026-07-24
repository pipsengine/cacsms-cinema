export type VersionSummary = {
  id: string;
  versionNumber: number;
  status: string;
  effectiveDate: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  checksum: string | null;
  recordCount: number;
  sectionCount: number;
  sectionCounts: Record<string, number>;
  createdBy: string;
  createAction: string | null;
  createReason: string | null;
};

export type VersionFilter =
  | 'all'
  | 'draft'
  | 'validated'
  | 'released'
  | 'archived'
  | 'invalid'
  | 'stale'
  | 'current';

/** Map persisted status to release-lifecycle label. */
export function versionLifecycleLabel(status: string): string {
  switch (status) {
    case 'DRAFT':
    case 'IN_REVIEW':
      return 'Draft';
    case 'READY':
      return 'Validated';
    case 'ACTIVE':
      return 'Released';
    case 'SUPERSEDED':
    case 'ARCHIVED':
      return 'Archived';
    case 'INVALID':
    case 'BLOCKED':
      return 'Failed';
    default:
      return status;
  }
}

export function isDraftStatus(status: string): boolean {
  return status === 'DRAFT' || status === 'IN_REVIEW';
}

export function isReleasedStatus(status: string): boolean {
  return status === 'ACTIVE';
}

export function isArchivedStatus(status: string): boolean {
  return status === 'SUPERSEDED' || status === 'ARCHIVED';
}

export function isValidatedStatus(status: string): boolean {
  return status === 'READY' || status === 'ACTIVE';
}

export function rollbackEligible(version: VersionSummary, versions: VersionSummary[]): boolean {
  if (!['ACTIVE', 'SUPERSEDED', 'ARCHIVED'].includes(version.status)) return false;
  const mutableExists = versions.some((item) =>
    ['DRAFT', 'INVALID', 'READY', 'IN_REVIEW', 'BLOCKED'].includes(item.status),
  );
  return !mutableExists;
}

export function versionIssues(versions: VersionSummary[]) {
  const invalid = versions.filter((item) => item.status === 'INVALID' || item.status === 'BLOCKED');
  const drafts = versions.filter((item) => isDraftStatus(item.status));
  const staleDrafts = drafts.filter((item) => {
    const ageMs = Date.now() - new Date(item.updatedAt).getTime();
    return ageMs > 7 * 24 * 60 * 60 * 1000 && item.recordCount === 0;
  });
  const duplicates = versions.filter((item, index, all) =>
    all.some(
      (other, otherIndex) =>
        otherIndex !== index &&
        other.versionNumber === item.versionNumber &&
        other.id !== item.id,
    ),
  );
  const empty = versions.filter((item) => item.recordCount === 0 && item.status !== 'ARCHIVED');

  return {
    invalid,
    staleDrafts,
    duplicates,
    empty,
    issueCount: invalid.length + staleDrafts.length + duplicates.length + empty.length,
  };
}

export function matchesVersionQuery(version: VersionSummary, needle: string): boolean {
  if (!needle) return true;
  const haystack = [
    `v${version.versionNumber}`,
    version.status,
    versionLifecycleLabel(version.status),
    version.createdBy,
    version.createAction,
    version.createReason,
    version.checksum,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterVersions(
  versions: VersionSummary[],
  query: string,
  filter: VersionFilter = 'all',
  currentVersionId?: string | null,
): VersionSummary[] {
  const needle = query.trim().toLowerCase();
  const issues = versionIssues(versions);
  return [...versions]
    .filter((version) => {
      if (!matchesVersionQuery(version, needle)) return false;
      if (filter === 'all') return true;
      if (filter === 'draft') return isDraftStatus(version.status);
      if (filter === 'validated') return version.status === 'READY';
      if (filter === 'released') return isReleasedStatus(version.status);
      if (filter === 'archived') return isArchivedStatus(version.status);
      if (filter === 'invalid') return version.status === 'INVALID' || version.status === 'BLOCKED';
      if (filter === 'stale') return issues.staleDrafts.some((item) => item.id === version.id);
      if (filter === 'current') return version.id === currentVersionId;
      return true;
    })
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

export function versionSubtitle(version: VersionSummary): string {
  const parts = [
    versionLifecycleLabel(version.status),
    `${version.sectionCount} modules`,
    `${version.recordCount} records`,
  ];
  return parts.join(' · ');
}
