import { prisma } from '@/lib/db';

export type EvidenceCheckRow = {
  id: string;
  ruleCode: string;
  ruleVersion: number;
  status: string;
  severity: string;
  blocking: boolean;
  evidenceJson: string | null;
  checkedAt: string;
  category: string;
  authorityScore: number | null;
  sourceLabel: string | null;
  claim: string | null;
  publishedAt: string | null;
  rightsStatus: string | null;
};

export type EvidenceCoverageCell = {
  topic: string;
  status: 'COVERED' | 'PARTIAL' | 'MISSING' | 'UNMEASURED';
  detail: string;
};

export type EvidenceCandidate = {
  id: string;
  title: string;
  summary: string;
  domain: string;
  audience: string | null;
  geography: string | null;
  status: string;
  gateStatus: string;
  candidateStatus: string;
  evidenceScore: number | null;
  authorityScore: number | null;
  corroborationScore: number | null;
  recencyScore: number | null;
  rightsScore: number | null;
  confidence: number | null;
  measuredConfidence: boolean;
  sourcesAnalysed: number;
  verifiedClaims: number;
  failedChecks: number;
  blockingFailures: number;
  contradictions: number;
  sufficiencyStatus: 'COMPLETE' | 'INSUFFICIENT' | 'PARTIAL' | 'PENDING';
  recommendation: string;
  explainability: string[];
  aiSummary: string;
  sourceBreakdown: Array<{ label: string; count: number | null }>;
  coverage: EvidenceCoverageCell[];
  checks: EvidenceCheckRow[];
  claims: Array<{
    claim: string;
    supportingSources: number | null;
    confidence: number | null;
    status: string;
  }>;
  contradictionsList: Array<{
    claim: string;
    sourceA: string;
    sourceB: string;
    resolution: string;
  }>;
  gaps: string[];
  confidenceBreakdown: Array<{ label: string; value: number | null }>;
  biasSignals: Array<{ label: string; status: string; detail: string }>;
  freshness: {
    averageAgeDays: number | null;
    lastUpdated: string | null;
    staleSources: number | null;
    newlyPublished: number | null;
  };
  rights: Array<{ label: string; status: string }>;
  lifecycle: Array<{ key: string; label: string; done: boolean }>;
  createdAt: string;
  updatedAt: string;
};

export type EvidenceSufficiencyOverview = {
  available: boolean;
  reason?: string;
  meta: {
    cycleStatus: string;
    intakeStatus: string | null;
    lastCheckedAt: string | null;
  };
  metrics: {
    totalCandidates: number;
    evidenceComplete: number;
    evidenceInsufficient: number;
    sourcesAnalysed: number;
    claimsVerified: number;
    averageEvidenceScore: number | null;
    authorityScore: number | null;
    corroborationScore: number | null;
    rightsCleared: number;
    averageSourceAgeDays: number | null;
    contradictionsFound: number;
    evidenceConfidence: number | null;
  };
  pipeline: Array<{
    key: string;
    label: string;
    state: 'pending' | 'active' | 'done' | 'failed';
  }>;
  candidates: EvidenceCandidate[];
  recommendations: Array<{
    id: string;
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    candidateId?: string;
  }>;
  analytics: {
    ruleDistribution: Array<{ label: string; count: number }>;
    statusDistribution: Array<{ label: string; count: number }>;
    severityDistribution: Array<{ label: string; count: number }>;
  };
  notifications: Array<{
    id: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
  }>;
  audit: Array<{
    id: string;
    action: string;
    actorType: string;
    createdAt: string;
    reason: string | null;
  }>;
  lastUpdated: string;
};

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseJson(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

function categorizeRule(ruleCode: string): string {
  const hay = ruleCode.toLowerCase();
  if (/authority|publisher|domain|credibility/.test(hay)) return 'Authority';
  if (/corrob|support|independent|claim/.test(hay)) return 'Corroboration';
  if (/recency|fresh|stale|age|date/.test(hay)) return 'Recency';
  if (/right|license|copyright|usage|cc-/.test(hay)) return 'Rights';
  if (/bias|diversity|editorial/.test(hay)) return 'Bias';
  if (/contradict|conflict|inconsist/.test(hay)) return 'Contradiction';
  if (/coverage|complete|gap|sufficien/.test(hay)) return 'Coverage';
  if (/source|evidence|verify/.test(hay)) return 'Source';
  return 'General';
}

function passedStatus(status: string): boolean {
  return ['PASSED', 'PASS', 'OK', 'CLEARED', 'COMPLETE'].includes(status.toUpperCase());
}

function failedStatus(status: string): boolean {
  return ['FAILED', 'FAIL', 'REJECTED', 'INSUFFICIENT', 'MISSING'].includes(status.toUpperCase());
}

function scoreFromChecks(
  checks: Array<{ status: string; category: string }>,
  category?: string,
): number | null {
  const subset = category
    ? checks.filter((item) => item.category === category)
    : checks;
  if (!subset.length) return null;
  const passed = subset.filter((item) => passedStatus(item.status)).length;
  return Math.round((passed / subset.length) * 100);
}

function coverageFromChecks(
  checks: Array<{ ruleCode: string; status: string; category: string }>,
): EvidenceCoverageCell[] {
  const topics = [
    { topic: 'Historical Context', match: /histor|context|timeline/i },
    { topic: 'Timeline', match: /timeline|chronolog|date/i },
    { topic: 'Statistics', match: /stat|metric|quant/i },
    { topic: 'Interviews', match: /interview|testimon/i },
    { topic: 'Official Records', match: /official|government|record|filing/i },
    { topic: 'Images', match: /image|photo|visual|footage/i },
    { topic: 'Maps', match: /map|geo|cartog/i },
    { topic: 'Expert Commentary', match: /expert|academic|peer|commentary/i },
  ];

  if (!checks.length) {
    return topics.map((topic) => ({
      topic: topic.topic,
      status: 'UNMEASURED' as const,
      detail: 'No evidence checks persisted',
    }));
  }

  return topics.map((topic) => {
    const related = checks.filter(
      (check) => topic.match.test(check.ruleCode) || topic.match.test(check.category),
    );
    if (!related.length) {
      return {
        topic: topic.topic,
        status: 'UNMEASURED' as const,
        detail: 'No matching rule_code persisted',
      };
    }
    const passed = related.filter((check) => passedStatus(check.status)).length;
    const failed = related.filter((check) => failedStatus(check.status)).length;
    if (failed > 0 && passed === 0) {
      return { topic: topic.topic, status: 'MISSING', detail: `${failed} failed checks` };
    }
    if (failed > 0 && passed > 0) {
      return {
        topic: topic.topic,
        status: 'PARTIAL',
        detail: `${passed} passed / ${failed} failed`,
      };
    }
    return {
      topic: topic.topic,
      status: 'COVERED',
      detail: `${passed} passed checks`,
    };
  });
}

function recommendationFor(input: {
  sufficiency: EvidenceCandidate['sufficiencyStatus'];
  gaps: string[];
  interviewsMissing: boolean;
  academicWeak: boolean;
  rightsFailed: boolean;
}): string {
  if (input.sufficiency === 'COMPLETE') return 'Evidence Complete';
  if (input.rightsFailed) return 'Acquire cleared rights / archive footage';
  if (input.interviewsMissing) return 'More Interviews Needed';
  if (input.academicWeak) return 'Additional Academic Sources';
  if (input.gaps.some((gap) => /government|official/i.test(gap))) {
    return 'Request Government Records';
  }
  if (input.gaps.some((gap) => /image|footage|visual/i.test(gap))) {
    return 'Acquire Archive Footage';
  }
  if (input.sufficiency === 'INSUFFICIENT') return 'Conduct Field Research';
  if (input.sufficiency === 'PARTIAL') return 'Delay Production';
  return 'Continue evidence validation';
}

export async function loadEvidenceSufficiency(): Promise<EvidenceSufficiencyOverview> {
  try {
    const intake = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT TOP 1 status
      FROM iq_intake_packages
      WHERE status = 'ACKNOWLEDGED'
      ORDER BY acknowledged_at DESC
    `;

    const cycles = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT TOP 1 status
      FROM iq_cycles
      ORDER BY created_at DESC
    `;

    const candidateRows = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        summary: string;
        domain: string;
        audience: string | null;
        geography: string | null;
        status: string;
        gateStatus: string;
        confidence: number | string;
        evidenceFactor: number | string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >`
      SELECT TOP 100
        CONVERT(varchar(36), c.id) AS id,
        c.title,
        c.summary,
        c.domain,
        c.audience,
        c.geography,
        c.status,
        c.gate_status AS gateStatus,
        c.confidence,
        s.evidence_factor AS evidenceFactor,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt
      FROM iq_candidates c
      OUTER APPLY (
        SELECT TOP 1
          TRY_CONVERT(float, JSON_VALUE(factors_json, '$.evidence')) AS evidence_factor
        FROM iq_scores sc
        WHERE sc.candidate_id = c.id
        ORDER BY sc.scored_at DESC
      ) s
      ORDER BY c.updated_at DESC
    `;

    const checkRows = await prisma.$queryRaw<
      Array<{
        id: string;
        candidateId: string;
        ruleCode: string;
        ruleVersion: number | bigint;
        status: string;
        severity: string;
        blocking: boolean | number;
        evidenceJson: string | null;
        checkedAt: Date;
      }>
    >`
      SELECT TOP 2000
        CONVERT(varchar(36), id) AS id,
        CONVERT(varchar(36), candidate_id) AS candidateId,
        rule_code AS ruleCode,
        rule_version AS ruleVersion,
        status,
        severity,
        blocking,
        evidence_json AS evidenceJson,
        checked_at AS checkedAt
      FROM iq_evidence_checks
      ORDER BY checked_at DESC
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
      SELECT TOP 40
        CONVERT(varchar(36), id) AS id,
        action,
        actor_type AS actorType,
        created_at AS createdAt,
        reason
      FROM iq_audit_events
      WHERE action LIKE '%EVIDENCE%'
         OR action LIKE '%VERIFY%'
         OR action LIKE '%SOURCE%'
         OR action LIKE '%RIGHT%'
      ORDER BY created_at DESC
    `;

    const checksByCandidate = new Map<string, typeof checkRows>();
    for (const row of checkRows) {
      const list = checksByCandidate.get(row.candidateId) ?? [];
      list.push(row);
      checksByCandidate.set(row.candidateId, list);
    }

    const candidates: EvidenceCandidate[] = candidateRows.map((row) => {
      const rawChecks = checksByCandidate.get(row.id) ?? [];
      const checks: EvidenceCheckRow[] = rawChecks.map((check) => {
        const payload = parseJson(check.evidenceJson);
        const category = categorizeRule(check.ruleCode);
        return {
          id: check.id,
          ruleCode: check.ruleCode,
          ruleVersion: Number(check.ruleVersion),
          status: check.status,
          severity: check.severity,
          blocking: Boolean(check.blocking),
          evidenceJson: check.evidenceJson,
          checkedAt: check.checkedAt.toISOString(),
          category,
          authorityScore: num(payload.authorityScore ?? payload.authority),
          sourceLabel:
            typeof payload.source === 'string'
              ? payload.source
              : typeof payload.publisher === 'string'
                ? payload.publisher
                : typeof payload.label === 'string'
                  ? payload.label
                  : null,
          claim: typeof payload.claim === 'string' ? payload.claim : null,
          publishedAt:
            typeof payload.publishedAt === 'string'
              ? payload.publishedAt
              : typeof payload.date === 'string'
                ? payload.date
                : null,
          rightsStatus:
            typeof payload.rightsStatus === 'string'
              ? payload.rightsStatus
              : typeof payload.license === 'string'
                ? payload.license
                : null,
        };
      });

      const categorized = checks.map((check) => ({
        status: check.status,
        category: check.category,
        ruleCode: check.ruleCode,
      }));
      const evidenceFactor = num(row.evidenceFactor);
      const evidenceScore =
        evidenceFactor ?? scoreFromChecks(categorized) ?? (checks.length ? null : null);
      const authorityScore =
        avg(
          checks
            .map((check) => check.authorityScore)
            .filter((value): value is number => value != null),
        ) ?? scoreFromChecks(categorized, 'Authority');
      const corroborationScore = scoreFromChecks(categorized, 'Corroboration');
      const recencyScore = scoreFromChecks(categorized, 'Recency');
      const rightsScore = scoreFromChecks(categorized, 'Rights');
      const verifiedClaims = checks.filter((check) => passedStatus(check.status)).length;
      const failedChecks = checks.filter((check) => failedStatus(check.status)).length;
      const blockingFailures = checks.filter(
        (check) => check.blocking && failedStatus(check.status),
      ).length;
      const contradictionChecks = checks.filter((check) => check.category === 'Contradiction');
      const contradictions = contradictionChecks.filter((check) =>
        failedStatus(check.status),
      ).length;

      let sufficiencyStatus: EvidenceCandidate['sufficiencyStatus'] = 'PENDING';
      if (!checks.length && evidenceFactor == null) sufficiencyStatus = 'PENDING';
      else if (blockingFailures > 0 || (evidenceScore != null && evidenceScore < 60)) {
        sufficiencyStatus = 'INSUFFICIENT';
      } else if (
        (evidenceScore != null && evidenceScore >= 85 && failedChecks === 0) ||
        (checks.length > 0 && failedChecks === 0 && verifiedClaims >= Math.max(1, checks.length))
      ) {
        sufficiencyStatus = 'COMPLETE';
      } else if (checks.length > 0 || evidenceFactor != null) {
        sufficiencyStatus = 'PARTIAL';
      }

      const coverage = coverageFromChecks(categorized);
      const gaps = coverage
        .filter((cell) => cell.status === 'MISSING' || cell.status === 'PARTIAL')
        .map((cell) => `${cell.topic}: ${cell.detail}`);

      const claims = checks
        .filter((check) => check.claim || check.category === 'Corroboration')
        .slice(0, 12)
        .map((check) => ({
          claim: check.claim ?? check.ruleCode,
          supportingSources: num(parseJson(check.evidenceJson).supportingSources),
          confidence: num(parseJson(check.evidenceJson).confidence) ?? (passedStatus(check.status) ? 90 : failedStatus(check.status) ? 40 : null),
          status: check.status,
        }));

      const contradictionsList = contradictionChecks.slice(0, 8).map((check) => {
        const payload = parseJson(check.evidenceJson);
        return {
          claim: check.claim ?? check.ruleCode,
          sourceA: typeof payload.sourceA === 'string' ? payload.sourceA : 'Source A',
          sourceB: typeof payload.sourceB === 'string' ? payload.sourceB : 'Source B',
          resolution:
            typeof payload.resolution === 'string'
              ? payload.resolution
              : failedStatus(check.status)
                ? 'Needs Review'
                : 'Resolved',
        };
      });

      const ages = checks
        .map((check) => check.publishedAt)
        .filter((value): value is string => Boolean(value))
        .map((value) => {
          const published = new Date(value).getTime();
          if (!Number.isFinite(published)) return null;
          return Math.max(0, Math.round((Date.now() - published) / 86400000));
        })
        .filter((value): value is number => value != null);

      const interviewsMissing = coverage.some(
        (cell) => cell.topic === 'Interviews' && (cell.status === 'MISSING' || cell.status === 'PARTIAL'),
      );
      const academicWeak = coverage.some(
        (cell) =>
          cell.topic === 'Expert Commentary' &&
          (cell.status === 'MISSING' || cell.status === 'PARTIAL' || cell.status === 'UNMEASURED'),
      );
      const rightsFailed =
        checks.some(
          (check) => check.category === 'Rights' && failedStatus(check.status),
        ) || (rightsScore != null && rightsScore < 60);

      const recommendation = recommendationFor({
        sufficiency: sufficiencyStatus,
        gaps,
        interviewsMissing,
        academicWeak,
        rightsFailed,
      });

      const explainability: string[] = [];
      if (evidenceScore != null) explainability.push(`Evidence sufficiency: ${evidenceScore}%`);
      explainability.push(`${checks.length} evidence checks persisted`);
      explainability.push(`${verifiedClaims} checks passed`);
      if (authorityScore != null) explainability.push(`Authority score ${authorityScore}`);
      if (corroborationScore != null) {
        explainability.push(`Corroboration score ${corroborationScore}`);
      }
      if (failedChecks > 0) explainability.push(`${failedChecks} failed checks require attention`);
      if (gaps.length) explainability.push(`${gaps.length} coverage gaps identified`);
      if (!checks.length && evidenceFactor == null) {
        explainability.push('No evidence checks persisted yet for this candidate');
      }

      const confidence = num(row.confidence);
      const measuredConfidence = confidence != null && confidence >= 1;

      return {
        id: row.id,
        title: row.title,
        summary: row.summary,
        domain: row.domain,
        audience: row.audience,
        geography: row.geography,
        status: sufficiencyStatus,
        gateStatus: row.gateStatus,
        candidateStatus: row.status,
        evidenceScore,
        authorityScore,
        corroborationScore,
        recencyScore,
        rightsScore,
        confidence,
        measuredConfidence,
        sourcesAnalysed: checks.length,
        verifiedClaims,
        failedChecks,
        blockingFailures,
        contradictions,
        sufficiencyStatus,
        recommendation,
        explainability,
        aiSummary:
          checks.length || evidenceFactor != null
            ? `${row.title} evidence status is ${sufficiencyStatus.toLowerCase()} with ${
                evidenceScore != null ? `${evidenceScore}%` : 'UNMEASURED'
              } evidence score across ${checks.length} persisted checks (${verifiedClaims} passed, ${failedChecks} failed). ${recommendation}.`
            : `${row.title} is awaiting evidence validation records from the autonomous qualification cycle.`,
        sourceBreakdown: [
          { label: 'Total evidence items', count: checks.length },
          { label: 'Primary sources', count: null },
          { label: 'Secondary sources', count: null },
          { label: 'Academic sources', count: null },
          { label: 'Government publications', count: null },
          { label: 'Industry reports', count: null },
          { label: 'Books', count: null },
          { label: 'Interviews', count: null },
          { label: 'Official documents', count: null },
          { label: 'Internal knowledge', count: null },
          { label: 'Multimedia assets', count: null },
          {
            label: 'Rule-backed checks',
            count: checks.length,
          },
        ],
        coverage,
        checks,
        claims,
        contradictionsList,
        gaps,
        confidenceBreakdown: [
          { label: 'Historical claims', value: scoreFromChecks(categorized, 'Coverage') },
          { label: 'Technical claims', value: null },
          { label: 'Financial claims', value: null },
          { label: 'Scientific claims', value: null },
          { label: 'Geographic data', value: null },
          { label: 'Biographical information', value: null },
          { label: 'Overall evidence', value: evidenceScore },
        ],
        biasSignals: [
          {
            label: 'Political bias',
            status: scoreFromChecks(categorized, 'Bias') == null ? 'UNMEASURED' : 'EVALUATED',
            detail: 'Derived only when bias rule_codes exist',
          },
          {
            label: 'Source diversity',
            status: checks.length >= 3 ? 'OBSERVED' : checks.length ? 'LIMITED' : 'UNMEASURED',
            detail: `${checks.length} distinct checks`,
          },
          {
            label: 'Commercial / regional / cultural bias',
            status: 'UNMEASURED',
            detail: 'No dedicated bias payload fields persisted',
          },
        ],
        freshness: {
          averageAgeDays: avg(ages),
          lastUpdated: checks[0]?.checkedAt ?? null,
          staleSources: ages.filter((age) => age > 365 * 5).length || null,
          newlyPublished: ages.filter((age) => age <= 365).length || null,
        },
        rights: [
          {
            label: 'Rights checks',
            status:
              rightsScore == null
                ? 'UNMEASURED'
                : rightsScore >= 80
                  ? 'CLEARED'
                  : rightsFailed
                    ? 'BLOCKED'
                    : 'PARTIAL',
          },
          {
            label: 'Copyright / CC / commercial usage',
            status: 'UNMEASURED',
          },
        ],
        lifecycle: [
          { key: 'collect', label: 'Evidence Collection', done: checks.length > 0 },
          {
            key: 'authority',
            label: 'Authority Validation',
            done: authorityScore != null,
          },
          {
            key: 'corroboration',
            label: 'Source Corroboration',
            done: corroborationScore != null,
          },
          { key: 'recency', label: 'Recency Analysis', done: recencyScore != null },
          {
            key: 'claims',
            label: 'Claim Coverage',
            done: verifiedClaims > 0,
          },
          {
            key: 'bias',
            label: 'Bias Detection',
            done: categorized.some((item) => item.category === 'Bias'),
          },
          {
            key: 'rights',
            label: 'Rights Verification',
            done: rightsScore != null,
          },
          {
            key: 'sufficiency',
            label: 'Evidence Sufficiency',
            done: sufficiencyStatus === 'COMPLETE' || sufficiencyStatus === 'INSUFFICIENT',
          },
          {
            key: 'research',
            label: 'Research Ready',
            done: sufficiencyStatus === 'COMPLETE',
          },
        ],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });

    const evidenceComplete = candidates.filter((item) => item.sufficiencyStatus === 'COMPLETE').length;
    const evidenceInsufficient = candidates.filter(
      (item) => item.sufficiencyStatus === 'INSUFFICIENT',
    ).length;
    const sourcesAnalysed = candidates.reduce((sum, item) => sum + item.sourcesAnalysed, 0);
    const claimsVerified = candidates.reduce((sum, item) => sum + item.verifiedClaims, 0);
    const contradictionsFound = candidates.reduce((sum, item) => sum + item.contradictions, 0);
    const rightsCleared = candidates.filter((item) =>
      item.rights.some((right) => right.status === 'CLEARED'),
    ).length;

    const ruleCounts = new Map<string, number>();
    const statusCounts = new Map<string, number>();
    const severityCounts = new Map<string, number>();
    for (const check of checkRows) {
      ruleCounts.set(check.ruleCode, (ruleCounts.get(check.ruleCode) ?? 0) + 1);
      statusCounts.set(check.status, (statusCounts.get(check.status) ?? 0) + 1);
      severityCounts.set(check.severity, (severityCounts.get(check.severity) ?? 0) + 1);
    }

    const recommendations: EvidenceSufficiencyOverview['recommendations'] = [];
    for (const item of candidates.slice(0, 12)) {
      recommendations.push({
        id: `ev-rec-${item.id}`,
        action: item.recommendation,
        reason: `${item.title} · ${item.sufficiencyStatus} · score ${
          item.evidenceScore ?? 'UNMEAS.'
        }`,
        priority:
          item.sufficiencyStatus === 'INSUFFICIENT' || item.blockingFailures > 0
            ? 'HIGH'
            : item.sufficiencyStatus === 'PARTIAL'
              ? 'MEDIUM'
              : 'LOW',
        candidateId: item.id,
      });
    }

    const notifications: EvidenceSufficiencyOverview['notifications'] = [];
    for (const item of candidates.slice(0, 10)) {
      if (item.sufficiencyStatus === 'COMPLETE') {
        notifications.push({
          id: `ok-${item.id}`,
          severity: 'INFO',
          message: `Evidence complete: ${item.title}`,
        });
      }
      if (item.sufficiencyStatus === 'INSUFFICIENT') {
        notifications.push({
          id: `insuf-${item.id}`,
          severity: 'CRITICAL',
          message: `Evidence insufficient: ${item.title}`,
        });
      }
      if (item.contradictions > 0) {
        notifications.push({
          id: `contra-${item.id}`,
          severity: 'WARNING',
          message: `Contradiction detected: ${item.title}`,
        });
      }
      if (item.blockingFailures > 0) {
        notifications.push({
          id: `block-${item.id}`,
          severity: 'CRITICAL',
          message: `Blocking evidence failure: ${item.title}`,
        });
      }
    }

    const hasChecks = checkRows.length > 0;
    const pipeline = [
      'collect',
      'authority',
      'corroboration',
      'recency',
      'claims',
      'bias',
      'rights',
      'sufficiency',
      'research',
    ].map((key, index) => {
      const labels: Record<string, string> = {
        collect: 'Evidence Collection',
        authority: 'Authority Validation',
        corroboration: 'Source Corroboration',
        recency: 'Recency Analysis',
        claims: 'Claim Coverage',
        bias: 'Bias Detection',
        rights: 'Rights Verification',
        sufficiency: 'Evidence Sufficiency',
        research: 'Research Ready',
      };
      let state: 'pending' | 'active' | 'done' | 'failed' = 'pending';
      if (evidenceInsufficient > 0 && key === 'sufficiency') state = 'failed';
      else if (evidenceComplete > 0 && index <= 8) state = 'done';
      else if (hasChecks && index <= 2) state = 'done';
      else if (hasChecks && index === 3) state = 'active';
      else if (intake[0] && index === 0) state = 'active';
      return { key, label: labels[key], state };
    });

    return {
      available: true,
      meta: {
        cycleStatus: cycles[0]?.status ?? 'NOT_STARTED',
        intakeStatus: intake[0]?.status ?? null,
        lastCheckedAt: checkRows[0]?.checkedAt.toISOString() ?? null,
      },
      metrics: {
        totalCandidates: candidates.length,
        evidenceComplete,
        evidenceInsufficient,
        sourcesAnalysed,
        claimsVerified,
        averageEvidenceScore: avg(
          candidates
            .map((item) => item.evidenceScore)
            .filter((value): value is number => value != null),
        ),
        authorityScore: avg(
          candidates
            .map((item) => item.authorityScore)
            .filter((value): value is number => value != null),
        ),
        corroborationScore: avg(
          candidates
            .map((item) => item.corroborationScore)
            .filter((value): value is number => value != null),
        ),
        rightsCleared,
        averageSourceAgeDays: avg(
          candidates
            .map((item) => item.freshness.averageAgeDays)
            .filter((value): value is number => value != null),
        ),
        contradictionsFound,
        evidenceConfidence: avg(
          candidates
            .filter((item) => item.measuredConfidence)
            .map((item) => item.confidence as number),
        ),
      },
      pipeline,
      candidates,
      recommendations,
      analytics: {
        ruleDistribution: [...ruleCounts.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 12),
        statusDistribution: [...statusCounts.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count),
        severityDistribution: [...severityCounts.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count),
      },
      notifications,
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
          : 'Evidence Sufficiency unavailable',
      meta: {
        cycleStatus: 'UNAVAILABLE',
        intakeStatus: null,
        lastCheckedAt: null,
      },
      metrics: {
        totalCandidates: 0,
        evidenceComplete: 0,
        evidenceInsufficient: 0,
        sourcesAnalysed: 0,
        claimsVerified: 0,
        averageEvidenceScore: null,
        authorityScore: null,
        corroborationScore: null,
        rightsCleared: 0,
        averageSourceAgeDays: null,
        contradictionsFound: 0,
        evidenceConfidence: null,
      },
      pipeline: [],
      candidates: [],
      recommendations: [],
      analytics: {
        ruleDistribution: [],
        statusDistribution: [],
        severityDistribution: [],
      },
      notifications: [],
      audit: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}
