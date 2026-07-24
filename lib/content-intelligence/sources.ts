import { prisma } from '@/lib/db';

/**
 * System source-category registry for Stage 02 discovery readiness.
 * These are policy slots (not fabricated production health metrics).
 * Runtime health, freshness, and evidence scores remain UNMEASURED until
 * discovery runs write measured values into configuration_json / columns.
 */
export type SourceCategoryDefinition = {
  systemKey: string;
  name: string;
  sourceType: string;
  category: string;
  provider: string;
  region: string;
  language: string;
  updateFrequency: string;
  authentication: string;
  rateLimits: string;
  licensing: string;
  copyright: string;
  discoveryPriority: number;
  evidenceClass: string;
  reasoning: string;
  /** Policy authority band only — nullable column until measured at runtime */
  authorityBand: number | null;
};

export const SOURCE_CATEGORY_CATALOG: SourceCategoryDefinition[] = [
  {
    systemKey: 'src.official-websites',
    name: 'Official websites',
    sourceType: 'OFFICIAL_WEBSITE',
    category: 'Official websites',
    provider: 'Institutional web',
    region: 'Multi-region',
    language: 'Multi-language',
    updateFrequency: 'As published',
    authentication: 'Public / site-specific',
    rateLimits: 'Respect robots.txt',
    licensing: 'Fair quotation + terms of use',
    copyright: 'Publisher retains rights',
    discoveryPriority: 95,
    evidenceClass: 'primary_institutional',
    reasoning: 'Official sites anchor material claims under Stage 01 source ladder rung 1.',
    authorityBand: 92,
  },
  {
    systemKey: 'src.government',
    name: 'Government sources',
    sourceType: 'GOVERNMENT',
    category: 'Government',
    provider: 'Public sector',
    region: 'Jurisdiction-bound',
    language: 'Official languages',
    updateFrequency: 'Gazette / release cadence',
    authentication: 'Public portals',
    rateLimits: 'Portal fair-use',
    licensing: 'Crown / open government where stated',
    copyright: 'Record reuse rights',
    discoveryPriority: 98,
    evidenceClass: 'primary_institutional',
    reasoning: 'Statutory and government releases are preferred primaries for civic claims.',
    authorityBand: 96,
  },
  {
    systemKey: 'src.research-institutions',
    name: 'Research institutions',
    sourceType: 'RESEARCH_INSTITUTION',
    category: 'Research institutions',
    provider: 'Research orgs',
    region: 'Global',
    language: 'EN + local',
    updateFrequency: 'Report editions',
    authentication: 'Public / institutional',
    rateLimits: 'Standard web',
    licensing: 'Report licence',
    copyright: 'Cite with attribution',
    discoveryPriority: 90,
    evidenceClass: 'scholarly',
    reasoning: 'Institutional research supports knowledge-gap and trend discovery.',
    authorityBand: 88,
  },
  {
    systemKey: 'src.academic-journals',
    name: 'Academic journals',
    sourceType: 'ACADEMIC_JOURNAL',
    category: 'Academic journals',
    provider: 'Scholarly publishers',
    region: 'Global',
    language: 'Primarily EN',
    updateFrequency: 'Issue cadence',
    authentication: 'DOI / publisher API',
    rateLimits: 'Publisher quotas',
    licensing: 'Publisher licence',
    copyright: 'No full republication',
    discoveryPriority: 94,
    evidenceClass: 'scholarly',
    reasoning: 'Peer-reviewed venues sit on Stage 01 scholarly ladder rung.',
    authorityBand: 94,
  },
  {
    systemKey: 'src.books',
    name: 'Books & monographs',
    sourceType: 'BOOK',
    category: 'Books',
    provider: 'Publishers / libraries',
    region: 'Global',
    language: 'Multi-language',
    updateFrequency: 'Edition-based',
    authentication: 'Catalogue / ISBN',
    rateLimits: 'Catalogue fair-use',
    licensing: 'Quotation limits',
    copyright: 'Publisher / author',
    discoveryPriority: 72,
    evidenceClass: 'scholarly',
    reasoning: 'Durable reference material for evergreen topic scaffolding.',
    authorityBand: 80,
  },
  {
    systemKey: 'src.standards-bodies',
    name: 'Standards bodies',
    sourceType: 'STANDARDS',
    category: 'Standards bodies',
    provider: 'ISO / national standards',
    region: 'Global',
    language: 'EN + local',
    updateFrequency: 'Standard revisions',
    authentication: 'Public abstracts / licensed full text',
    rateLimits: 'Portal limits',
    licensing: 'Standards licence',
    copyright: 'Strict reuse controls',
    discoveryPriority: 91,
    evidenceClass: 'primary_institutional',
    reasoning: 'Normative references support technical accuracy gates.',
    authorityBand: 93,
  },
  {
    systemKey: 'src.verified-news',
    name: 'Verified news',
    sourceType: 'VERIFIED_NEWS',
    category: 'Verified news',
    provider: 'Newsrooms',
    region: 'Multi-region',
    language: 'Multi-language',
    updateFrequency: 'Continuous',
    authentication: 'Public / feed',
    rateLimits: 'Feed / API quotas',
    licensing: 'Quote limits',
    copyright: 'No full republication',
    discoveryPriority: 84,
    evidenceClass: 'journalism',
    reasoning: 'Reputable journalism with corrections policy — conditional for contested claims.',
    authorityBand: 78,
  },
  {
    systemKey: 'src.apis',
    name: 'Data APIs',
    sourceType: 'API',
    category: 'APIs',
    provider: 'API providers',
    region: 'Multi-region',
    language: 'Structured data',
    updateFrequency: 'Real-time / batch',
    authentication: 'API key / OAuth',
    rateLimits: 'Provider quotas',
    licensing: 'API terms',
    copyright: 'Dataset licence',
    discoveryPriority: 88,
    evidenceClass: 'primary_institutional',
    reasoning: 'Structured APIs supply reproducible discovery inputs when credentials are valid.',
    authorityBand: 85,
  },
  {
    systemKey: 'src.rss',
    name: 'RSS / Atom feeds',
    sourceType: 'RSS',
    category: 'RSS',
    provider: 'Feed publishers',
    region: 'Multi-region',
    language: 'Feed language',
    updateFrequency: 'Feed cadence',
    authentication: 'Public',
    rateLimits: 'Polling etiquette',
    licensing: 'Feed terms',
    copyright: 'Item-level rights',
    discoveryPriority: 76,
    evidenceClass: 'journalism',
    reasoning: 'Feeds enable continuous monitoring without fabricating engagement metrics.',
    authorityBand: 70,
  },
  {
    systemKey: 'src.podcasts',
    name: 'Podcasts',
    sourceType: 'PODCAST',
    category: 'Podcasts',
    provider: 'Audio platforms',
    region: 'Multi-region',
    language: 'Show language',
    updateFrequency: 'Episode cadence',
    authentication: 'Public / platform',
    rateLimits: 'Platform limits',
    licensing: 'Audio licence',
    copyright: 'Clip limits',
    discoveryPriority: 58,
    evidenceClass: 'civil_society',
    reasoning: 'Useful for audience-demand signals; not sole proof for contested facts.',
    authorityBand: 55,
  },
  {
    systemKey: 'src.youtube',
    name: 'YouTube channels',
    sourceType: 'YOUTUBE',
    category: 'YouTube',
    provider: 'YouTube',
    region: 'Global',
    language: 'Multi-language',
    updateFrequency: 'Upload cadence',
    authentication: 'YouTube Data API',
    rateLimits: 'Google quotas',
    licensing: 'YouTube ToS',
    copyright: 'Creator rights',
    discoveryPriority: 62,
    evidenceClass: 'restricted_anonymous',
    reasoning: 'Trend and format signals; elevated corroboration required for factual claims.',
    authorityBand: 48,
  },
  {
    systemKey: 'src.social-platforms',
    name: 'Social platforms',
    sourceType: 'SOCIAL',
    category: 'Social platforms',
    provider: 'Social networks',
    region: 'Global',
    language: 'Multi-language',
    updateFrequency: 'Continuous',
    authentication: 'Platform APIs',
    rateLimits: 'Strict API quotas',
    licensing: 'Platform ToS',
    copyright: 'User content rights',
    discoveryPriority: 50,
    evidenceClass: 'restricted_anonymous',
    reasoning: 'Fail-closed as sole evidence per Stage 01 anonymous/social rung.',
    authorityBand: 35,
  },
  {
    systemKey: 'src.internal-repositories',
    name: 'Internal repositories',
    sourceType: 'INTERNAL_REPO',
    category: 'Internal repositories',
    provider: 'CACSMS internal',
    region: 'Organisation',
    language: 'Org languages',
    updateFrequency: 'Continuous',
    authentication: 'Internal auth',
    rateLimits: 'Internal',
    licensing: 'Internal use',
    copyright: 'Organisation',
    discoveryPriority: 86,
    evidenceClass: 'primary_institutional',
    reasoning: 'Prior packages, audits, and approved corpora accelerate compliant discovery.',
    authorityBand: 90,
  },
  {
    systemKey: 'src.knowledge-bases',
    name: 'Knowledge bases',
    sourceType: 'KNOWLEDGE_BASE',
    category: 'Knowledge bases',
    provider: 'KB systems',
    region: 'Organisation / licensed',
    language: 'KB language',
    updateFrequency: 'Curated',
    authentication: 'Service account',
    rateLimits: 'KB quotas',
    licensing: 'KB licence',
    copyright: 'Recorded per corpus',
    discoveryPriority: 82,
    evidenceClass: 'civil_society',
    reasoning: 'Structured prior knowledge supports gap detection without inventing demand scores.',
    authorityBand: 75,
  },
  {
    systemKey: 'src.licensed-providers',
    name: 'Licensed providers',
    sourceType: 'LICENSED_PROVIDER',
    category: 'Licensed providers',
    provider: 'Licensed data vendors',
    region: 'Contract territory',
    language: 'Contract languages',
    updateFrequency: 'Contract SLA',
    authentication: 'Vendor credentials',
    rateLimits: 'Contract quotas',
    licensing: 'Paid licence',
    copyright: 'Vendor terms',
    discoveryPriority: 89,
    evidenceClass: 'primary_institutional',
    reasoning: 'Licensed feeds are approved when contract and rights checks pass.',
    authorityBand: 87,
  },
];

export type SourceConfiguration = {
  systemKey: string;
  origin: 'SYSTEM_POLICY';
  category: string;
  provider: string;
  region: string;
  language: string;
  updateFrequency: string;
  authentication: string;
  rateLimits: string;
  licensing: string;
  copyright: string;
  discoveryPriority: number;
  evidenceClass: string;
  reasoning: string;
  /** Policy ladder band only — not a measured runtime score */
  authorityBand: number | null;
  approvalState: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEPRIORITISED';
  availability: string | null;
  apiStatus: string | null;
  freshness: string | null;
  reliability: string | null;
  health: string | null;
  lastSync: string | null;
  evidenceScore: number | null;
  confidence: number | null;
  issues: string[];
};

export type RegisteredSource = {
  id: string;
  name: string;
  sourceType: string;
  baseUrl: string | null;
  authorityScore: number | null;
  status: string;
  configuration: SourceConfiguration;
  signalCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SourceIssue = {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  code: string;
  message: string;
  sourceId?: string;
};

export type SourceRegistryOverview = {
  available: boolean;
  reason?: string;
  strategy?: {
    versionId: string;
    versionNumber: number;
    checksum: string;
    status: string;
  };
  run?: {
    id: string;
    status: string;
    startedAt: string;
    completedAt?: string | null;
    failureReason?: string | null;
  };
  metrics: {
    registered: number;
    activeProviders: number;
    healthy: number;
    failed: number;
    measuredConfidence: number;
    avgConfidence: number | null;
    discoveryReadiness: number;
    signalLinks: number;
    approved: number;
    pending: number;
  };
  sources: RegisteredSource[];
  issues: SourceIssue[];
  audit: Array<{
    id: string;
    action: string;
    actorType: string;
    createdAt: string;
    reason: string | null;
  }>;
  lastUpdated: string;
};

type SourceRow = {
  id: string;
  name: string;
  sourceType: string;
  baseUrl: string | null;
  authorityScore: number | string | null;
  status: string;
  configurationJson: string | null;
  createdAt: Date;
  updatedAt: Date;
  signalCount: number | bigint;
};

function parseConfiguration(
  raw: string | null,
  fallback: Partial<SourceConfiguration> = {},
): SourceConfiguration {
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }

  const issues = Array.isArray(parsed.issues)
    ? parsed.issues.filter((item): item is string => typeof item === 'string')
    : [];

  const approval =
    parsed.approvalState === 'APPROVED' ||
    parsed.approvalState === 'REJECTED' ||
    parsed.approvalState === 'DEPRIORITISED' ||
    parsed.approvalState === 'PENDING'
      ? parsed.approvalState
      : 'PENDING';

  return {
    systemKey: String(parsed.systemKey ?? fallback.systemKey ?? ''),
    origin: 'SYSTEM_POLICY',
    category: String(parsed.category ?? fallback.category ?? 'Uncategorised'),
    provider: String(parsed.provider ?? fallback.provider ?? 'Unknown'),
    region: String(parsed.region ?? fallback.region ?? '—'),
    language: String(parsed.language ?? fallback.language ?? '—'),
    updateFrequency: String(parsed.updateFrequency ?? fallback.updateFrequency ?? '—'),
    authentication: String(parsed.authentication ?? fallback.authentication ?? '—'),
    rateLimits: String(parsed.rateLimits ?? fallback.rateLimits ?? '—'),
    licensing: String(parsed.licensing ?? fallback.licensing ?? '—'),
    copyright: String(parsed.copyright ?? fallback.copyright ?? '—'),
    discoveryPriority: Number(parsed.discoveryPriority ?? fallback.discoveryPriority ?? 50),
    evidenceClass: String(parsed.evidenceClass ?? fallback.evidenceClass ?? 'unspecified'),
    reasoning: String(parsed.reasoning ?? fallback.reasoning ?? ''),
    authorityBand:
      parsed.authorityBand != null && Number.isFinite(Number(parsed.authorityBand))
        ? Number(parsed.authorityBand)
        : fallback.authorityBand ?? null,
    approvalState: approval,
    availability: parsed.availability != null ? String(parsed.availability) : null,
    apiStatus: parsed.apiStatus != null ? String(parsed.apiStatus) : null,
    freshness: parsed.freshness != null ? String(parsed.freshness) : null,
    reliability: parsed.reliability != null ? String(parsed.reliability) : null,
    health: parsed.health != null ? String(parsed.health) : null,
    lastSync: parsed.lastSync != null ? String(parsed.lastSync) : null,
    evidenceScore:
      parsed.evidenceScore != null && Number.isFinite(Number(parsed.evidenceScore))
        ? Number(parsed.evidenceScore)
        : null,
    confidence:
      parsed.confidence != null && Number.isFinite(Number(parsed.confidence))
        ? Number(parsed.confidence)
        : null,
    issues,
  };
}

function mapSource(row: SourceRow): RegisteredSource {
  const configuration = parseConfiguration(row.configurationJson);
  return {
    id: row.id,
    name: row.name,
    sourceType: row.sourceType,
    baseUrl: row.baseUrl,
    authorityScore:
      row.authorityScore != null && Number.isFinite(Number(row.authorityScore))
        ? Number(row.authorityScore)
        : null,
    status: row.status,
    configuration,
    signalCount: Number(row.signalCount ?? 0),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function deriveIssues(sources: RegisteredSource[]): SourceIssue[] {
  const issues: SourceIssue[] = [];
  const seenNames = new Map<string, string>();

  for (const source of sources) {
    if (source.status === 'FAILED' || source.status === 'OFFLINE') {
      issues.push({
        id: `${source.id}-failed`,
        severity: 'CRITICAL',
        code: 'PROVIDER_OFFLINE',
        message: `${source.name} is ${source.status.toLowerCase()}.`,
        sourceId: source.id,
      });
    }
    if (source.status === 'MAINTENANCE') {
      issues.push({
        id: `${source.id}-maintenance`,
        severity: 'WARNING',
        code: 'MAINTENANCE',
        message: `${source.name} is in maintenance.`,
        sourceId: source.id,
      });
    }
    if (source.configuration.approvalState === 'REJECTED') {
      issues.push({
        id: `${source.id}-rejected`,
        severity: 'WARNING',
        code: 'SOURCE_REJECTED',
        message: `${source.name} was rejected by governance.`,
        sourceId: source.id,
      });
    }
    if (
      source.authorityScore != null &&
      source.authorityScore < 40 &&
      source.configuration.evidenceClass !== 'restricted_anonymous'
    ) {
      issues.push({
        id: `${source.id}-low-authority`,
        severity: 'WARNING',
        code: 'LOW_AUTHORITY',
        message: `${source.name} has low measured authority (${source.authorityScore}).`,
        sourceId: source.id,
      });
    } else if (
      source.authorityScore == null &&
      (source.configuration.authorityBand ?? 100) < 40 &&
      source.configuration.evidenceClass !== 'restricted_anonymous'
    ) {
      issues.push({
        id: `${source.id}-low-band`,
        severity: 'INFO',
        code: 'LOW_AUTHORITY_BAND',
        message: `${source.name} sits on a low policy authority band (not yet measured).`,
        sourceId: source.id,
      });
    }
    for (const note of source.configuration.issues) {
      issues.push({
        id: `${source.id}-cfg-${note.slice(0, 24)}`,
        severity: 'WARNING',
        code: 'CONFIG_ISSUE',
        message: `${source.name}: ${note}`,
        sourceId: source.id,
      });
    }

    const key = `${source.name.toLowerCase()}|${(source.baseUrl ?? '').toLowerCase()}`;
    const prior = seenNames.get(key);
    if (prior) {
      issues.push({
        id: `${source.id}-dup`,
        severity: 'WARNING',
        code: 'DUPLICATE_SOURCE',
        message: `Possible duplicate of another registered source (${source.name}).`,
        sourceId: source.id,
      });
    } else {
      seenNames.set(key, source.id);
    }
  }

  return issues.slice(0, 40);
}

/**
 * Idempotently register system source categories once a Strategy package is acknowledged.
 * Does not invent runtime health or confidence — those stay null/UNMEASURED until measured.
 */
export async function reconcileSources(): Promise<{ registered: number; created: number }> {
  const packages = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT TOP 1 CONVERT(varchar(36), id) AS id
    FROM ci_strategy_packages
    WHERE status = 'ACKNOWLEDGED'
    ORDER BY acknowledged_at DESC
  `;
  if (!packages[0]) {
    return { registered: 0, created: 0 };
  }

  const existing = await prisma.$queryRaw<
    Array<{ id: string; systemKey: string | null; status: string }>
  >`
    SELECT
      CONVERT(varchar(36), id) AS id,
      JSON_VALUE(configuration_json, '$.systemKey') AS systemKey,
      status
    FROM ci_sources
  `;

  const byKey = new Map(
    existing
      .filter((row) => row.systemKey)
      .map((row) => [String(row.systemKey), row] as const),
  );

  let created = 0;

  for (const item of SOURCE_CATEGORY_CATALOG) {
    const prior = byKey.get(item.systemKey);
    const configuration: SourceConfiguration = {
      systemKey: item.systemKey,
      origin: 'SYSTEM_POLICY',
      category: item.category,
      provider: item.provider,
      region: item.region,
      language: item.language,
      updateFrequency: item.updateFrequency,
      authentication: item.authentication,
      rateLimits: item.rateLimits,
      licensing: item.licensing,
      copyright: item.copyright,
      discoveryPriority: item.discoveryPriority,
      evidenceClass: item.evidenceClass,
      reasoning: item.reasoning,
      authorityBand: item.authorityBand,
      approvalState: item.evidenceClass === 'restricted_anonymous' ? 'DEPRIORITISED' : 'APPROVED',
      availability: null,
      apiStatus: null,
      freshness: null,
      reliability: null,
      health: null,
      lastSync: null,
      evidenceScore: null,
      confidence: null,
      issues: [],
    };
    const json = JSON.stringify(configuration);

    if (prior?.id) {
      await prisma.$executeRaw`
        UPDATE ci_sources
        SET
          name = ${item.name},
          source_type = ${item.sourceType},
          configuration_json = ${json},
          updated_at = sysutcdatetime()
        WHERE id = CONVERT(uniqueidentifier, ${prior.id})
          AND status <> 'ARCHIVED'
      `;
      continue;
    }

    await prisma.$executeRaw`
      INSERT INTO ci_sources (
        name,
        source_type,
        base_url,
        authority_score,
        status,
        configuration_json
      )
      VALUES (
        ${item.name},
        ${item.sourceType},
        ${null},
        ${null},
        ${'ACTIVE'},
        ${json}
      )
    `;
    created += 1;
  }

  if (created > 0) {
    await prisma.$executeRaw`
      INSERT INTO ci_audit_events(action, actor_type, reason, new_value)
      VALUES (
        ${'SOURCE_REGISTRY_RECONCILED'},
        ${'SERVICE'},
        ${'Registered system discovery source categories from Stage 01 source policy ladder'},
        ${String(created)}
      )
    `;
  }

  return { registered: SOURCE_CATEGORY_CATALOG.length, created };
}

export async function loadSourceRegistry(): Promise<SourceRegistryOverview> {
  try {
    const packages = await prisma.$queryRaw<
      Array<{
        strategy_version_id: string;
        version_number: number;
        checksum: string;
        status: string;
      }>
    >`
      SELECT TOP 1
        CONVERT(varchar(36), strategy_version_id) AS strategy_version_id,
        version_number,
        checksum,
        status
      FROM ci_strategy_packages
      WHERE status = 'ACKNOWLEDGED'
      ORDER BY acknowledged_at DESC
    `;

    if (packages[0]) {
      await reconcileSources();
    }

    const runs = await prisma.$queryRaw<
      Array<{
        id: string;
        status: string;
        started_at: Date | null;
        completed_at: Date | null;
        failure_reason: string | null;
      }>
    >`
      SELECT TOP 1
        CONVERT(varchar(36), id) AS id,
        status,
        started_at,
        completed_at,
        failure_reason
      FROM ci_discovery_runs
      ORDER BY created_at DESC
    `;

    const rows = await prisma.$queryRaw<SourceRow[]>`
      SELECT
        CONVERT(varchar(36), s.id) AS id,
        s.name,
        s.source_type AS sourceType,
        s.base_url AS baseUrl,
        s.authority_score AS authorityScore,
        s.status,
        s.configuration_json AS configurationJson,
        s.created_at AS createdAt,
        s.updated_at AS updatedAt,
        (
          SELECT COUNT(*)
          FROM ci_signals sig
          WHERE sig.source_id = s.id
        ) AS signalCount
      FROM ci_sources s
      WHERE s.status <> 'ARCHIVED'
      ORDER BY
        CASE WHEN JSON_VALUE(s.configuration_json, '$.discoveryPriority') IS NULL THEN 0
             ELSE TRY_CONVERT(int, JSON_VALUE(s.configuration_json, '$.discoveryPriority')) END DESC,
        s.name ASC
    `;

    const auditRows = await prisma.$queryRaw<
      Array<{
        id: string;
        action: string;
        actorType: string;
        createdAt: Date;
        reason: string | null;
      }>
    >`
      SELECT TOP 20
        CONVERT(varchar(36), id) AS id,
        action,
        actor_type AS actorType,
        created_at AS createdAt,
        reason
      FROM ci_audit_events
      WHERE action LIKE 'SOURCE%'
         OR action LIKE 'STRATEGY_PACKAGE%'
         OR action LIKE 'DISCOVERY%'
      ORDER BY created_at DESC
    `;

    const sources = rows.map(mapSource);
    const packageRow = packages[0];
    const run = runs[0];

    const healthy = sources.filter(
      (item) => item.status === 'ACTIVE' || item.status === 'HEALTHY',
    ).length;
    const failed = sources.filter(
      (item) =>
        item.status === 'FAILED' ||
        item.status === 'OFFLINE' ||
        item.status === 'ERROR',
    ).length;
    const providers = new Set(sources.map((item) => item.configuration.provider));
    const approved = sources.filter((item) => item.configuration.approvalState === 'APPROVED')
      .length;
    const pending = sources.filter((item) => item.configuration.approvalState === 'PENDING')
      .length;
    const confidenceValues = sources
      .map((item) => item.configuration.confidence)
      .filter((value): value is number => value != null && value >= 1);
    const measuredConfidence = confidenceValues.length;
    const avgConfidence =
      measuredConfidence > 0
        ? Math.round(
            confidenceValues.reduce((sum, value) => sum + value, 0) / measuredConfidence,
          )
        : null;
    const discoveryReadiness =
      sources.length === 0
        ? 0
        : Math.round((healthy / Math.max(1, sources.length)) * 100);

    return {
      available: true,
      strategy: packageRow
        ? {
            versionId: packageRow.strategy_version_id,
            versionNumber: Number(packageRow.version_number),
            checksum: packageRow.checksum,
            status: packageRow.status,
          }
        : undefined,
      run: run
        ? {
            id: run.id,
            status: run.status,
            startedAt: run.started_at?.toISOString() ?? new Date(0).toISOString(),
            completedAt: run.completed_at?.toISOString() ?? null,
            failureReason: run.failure_reason,
          }
        : undefined,
      metrics: {
        registered: sources.length,
        activeProviders: providers.size,
        healthy,
        failed,
        measuredConfidence,
        avgConfidence,
        discoveryReadiness,
        signalLinks: sources.reduce((sum, item) => sum + item.signalCount, 0),
        approved,
        pending,
      },
      sources,
      issues: deriveIssues(sources),
      audit: auditRows.map((row) => ({
        id: row.id,
        action: row.action,
        actorType: row.actorType,
        createdAt: row.createdAt.toISOString(),
        reason: row.reason,
      })),
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    return {
      available: false,
      reason:
        error instanceof Error
          ? error.message.replace(/password|secret|token/gi, '[redacted]')
          : 'Source registry unavailable. Run the Content Intelligence migration.',
      metrics: {
        registered: 0,
        activeProviders: 0,
        healthy: 0,
        failed: 0,
        measuredConfidence: 0,
        avgConfidence: null,
        discoveryReadiness: 0,
        signalLinks: 0,
        approved: 0,
        pending: 0,
      },
      sources: [],
      issues: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
