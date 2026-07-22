/**
 * Authoritative Visual Production Lifecycle navigation configuration.
 * Sidebar, Control Room strip, stage overviews, and breadcrumbs must all consume this module.
 */

export type WorkflowOperationalStatus =
  | 'completed'
  | 'active'
  | 'blocked'
  | 'pending'
  | 'unavailable';

export type PageCapabilityStatus =
  | 'ready'
  | 'active'
  | 'waiting'
  | 'blocked'
  | 'failed'
  | 'completed'
  | 'not_started'
  | 'not_available';

export type LifecycleIconName =
  | 'compass'
  | 'folder'
  | 'fileText'
  | 'layers'
  | 'scan'
  | 'eye'
  | 'alertTriangle'
  | 'fileSearch'
  | 'search'
  | 'bookOpen'
  | 'clipboardList'
  | 'users'
  | 'mapPin'
  | 'clock'
  | 'globe'
  | 'image'
  | 'shield'
  | 'checkCircle'
  | 'gitBranch'
  | 'scissors'
  | 'camera'
  | 'layout'
  | 'sun'
  | 'move'
  | 'link'
  | 'clapperboard'
  | 'listChecks'
  | 'sparkles'
  | 'ban'
  | 'crosshair'
  | 'cpu'
  | 'route'
  | 'workflow'
  | 'target'
  | 'dollarSign'
  | 'play'
  | 'history'
  | 'boxes'
  | 'gallery'
  | 'fileCheck'
  | 'scanLine'
  | 'brain'
  | 'activity'
  | 'bug'
  | 'columns'
  | 'award'
  | 'map'
  | 'landmark'
  | 'refreshCw'
  | 'wrench'
  | 'archive'
  | 'package'
  | 'gitCommit'
  | 'film'
  | 'video'
  | 'send'
  | 'barChart'
  | 'lineChart'
  | 'gauge'
  | 'messageSquare'
  | 'flask'
  | 'gitCompare'
  | 'settings'
  | 'scrollText';

export interface LifecyclePageConfig {
  id: string;
  label: string;
  href: string;
  description: string;
  icon: LifecycleIconName;
  order: number;
  /** Exact-match only when true (stage overview). */
  exact?: boolean;
  /** Match job detail descendants under this path prefix. */
  dynamicKind?: 'job' | 'asset';
  /** Marks pages that already have a functional workspace in-repo. */
  capability: 'live' | 'not_available';
  permissionKey: string;
}

export interface LifecycleStageConfig {
  id: string;
  number: string;
  label: string;
  overviewHref: string;
  description: string;
  order: number;
  /** Job status keys that map this stage to real worker progress. */
  workflowStatuses: string[];
  pages: LifecyclePageConfig[];
  permissionKey: string;
}

function page(
  partial: Omit<LifecyclePageConfig, 'permissionKey'> & { permissionKey?: string },
): LifecyclePageConfig {
  return {
    permissionKey: partial.permissionKey ?? `lifecycle.page.${partial.id}`,
    ...partial,
  };
}

export const LIFECYCLE_STAGES: LifecycleStageConfig[] = [
  {
    id: 'discover',
    number: '01',
    label: 'Discover & Interpret',
    overviewHref: '/visuals/discover',
    description: 'Ingest source material, interpret scripts, and extract visual entities and intent.',
    order: 1,
    workflowStatuses: ['DISCOVER', 'INTERPRET', 'DECOMPOSE'],
    permissionKey: 'lifecycle.stage.discover',
    pages: [
      page({ id: 'discover-overview', label: 'Stage Overview', href: '/visuals/discover', description: 'Stage purpose, gates, and corresponding pages.', icon: 'compass', order: 1, exact: true, capability: 'live' }),
      page({ id: 'project-intake', label: 'Project Intake', href: '/visuals/discover/project-intake', description: 'Capture project briefs and source packages.', icon: 'folder', order: 2, capability: 'not_available' }),
      page({ id: 'script-interpretation', label: 'Script Interpretation', href: '/visuals/discover/script-interpretation', description: 'Professional script writer and scene interpretation.', icon: 'fileText', order: 3, capability: 'live' }),
      page({ id: 'scene-decomposition', label: 'Scene Decomposition', href: '/visuals/discover/scene-decomposition', description: 'Break scripts into production scenes.', icon: 'layers', order: 4, capability: 'not_available' }),
      page({ id: 'entity-extraction', label: 'Entity Extraction', href: '/visuals/discover/entity-extraction', description: 'Extract characters, locations, and props.', icon: 'scan', order: 5, capability: 'not_available' }),
      page({ id: 'visual-intent', label: 'Visual Intent Analysis', href: '/visuals/discover/visual-intent', description: 'Derive cinematic visual intention.', icon: 'eye', order: 6, capability: 'not_available' }),
      page({ id: 'ambiguities', label: 'Ambiguity & Conflict Review', href: '/visuals/discover/ambiguities', description: 'Resolve interpretation conflicts.', icon: 'alertTriangle', order: 7, capability: 'not_available' }),
      page({ id: 'evidence', label: 'Interpretation Evidence', href: '/visuals/discover/evidence', description: 'Persisted interpretation evidence trail.', icon: 'fileSearch', order: 8, capability: 'not_available' }),
    ],
  },
  {
    id: 'research',
    number: '02',
    label: 'Research & Requirements',
    overviewHref: '/visuals/research',
    description: 'Compile visual requirements, geography, history, culture, and acceptance criteria.',
    order: 2,
    workflowStatuses: ['RESEARCH', 'VERIFY_CONTEXT', 'BUILD_REQUIREMENTS'],
    permissionKey: 'lifecycle.stage.research',
    pages: [
      page({ id: 'research-overview', label: 'Stage Overview', href: '/visuals/research', description: 'Stage purpose, gates, and corresponding pages.', icon: 'compass', order: 1, exact: true, capability: 'live' }),
      page({ id: 'research-workspace', label: 'Research Workspace', href: '/visuals/research/workspace', description: 'Primary research operations surface.', icon: 'search', order: 2, capability: 'not_available' }),
      page({ id: 'research-sources', label: 'Source & Evidence Review', href: '/visuals/research/sources', description: 'Validate sourced claims and citations.', icon: 'bookOpen', order: 3, capability: 'not_available' }),
      page({ id: 'requirements-compiler', label: 'Visual Requirements Compiler', href: '/visuals/research/requirements-compiler', description: 'Compile typed visual requirements.', icon: 'clipboardList', order: 4, capability: 'not_available' }),
      page({ id: 'character-requirements', label: 'Character Requirements', href: '/visuals/research/character-requirements', description: 'Identity and continuity requirements.', icon: 'users', order: 5, capability: 'not_available' }),
      page({ id: 'geographic-profile', label: 'Location & Geography Profile', href: '/visuals/research/geographic-profile', description: 'Geographic and location constraints.', icon: 'mapPin', order: 6, capability: 'not_available' }),
      page({ id: 'historical-profile', label: 'Historical & Period Profile', href: '/visuals/research/historical-profile', description: 'Period accuracy constraints.', icon: 'clock', order: 7, capability: 'not_available' }),
      page({ id: 'cultural-intelligence', label: 'Cultural Intelligence', href: '/visuals/research/cultural-intelligence', description: 'Cultural safety and authenticity.', icon: 'globe', order: 8, capability: 'not_available' }),
      page({ id: 'reference-retrieval', label: 'Reference Retrieval', href: '/visuals/research/reference-retrieval', description: 'Approved reference asset retrieval.', icon: 'image', order: 9, capability: 'not_available' }),
      page({ id: 'constraint-resolution', label: 'Constraint Resolution', href: '/visuals/research/constraint-resolution', description: 'Resolve conflicting constraints.', icon: 'shield', order: 10, capability: 'not_available' }),
      page({ id: 'acceptance-criteria', label: 'Acceptance Criteria', href: '/visuals/research/acceptance-criteria', description: 'Mandatory acceptance gates.', icon: 'checkCircle', order: 11, capability: 'not_available' }),
    ],
  },
  {
    id: 'scene-planning',
    number: '03',
    label: 'Scene & Cinematography',
    overviewHref: '/visuals/scene-planning',
    description: 'Build scene graphs, shots, cinematography plans, and storyboards.',
    order: 3,
    workflowStatuses: ['BUILD_SCENE_GRAPH', 'RESOLVE_CONFLICTS', 'PLAN_CINEMATOGRAPHY', 'RETRIEVE_REFERENCES', 'VALIDATE_REFERENCES'],
    permissionKey: 'lifecycle.stage.scene-planning',
    pages: [
      page({ id: 'scene-overview', label: 'Stage Overview', href: '/visuals/scene-planning', description: 'Stage purpose, gates, and corresponding pages.', icon: 'compass', order: 1, exact: true, capability: 'live' }),
      page({ id: 'scene-graph', label: 'Scene Graph Builder', href: '/visuals/scene-planning/scene-graph', description: 'Construct deterministic scene graphs.', icon: 'gitBranch', order: 2, capability: 'not_available' }),
      page({ id: 'shot-decomposition', label: 'Shot Decomposition', href: '/visuals/scene-planning/shot-decomposition', description: 'Decompose scenes into shots.', icon: 'scissors', order: 3, capability: 'not_available' }),
      page({ id: 'cinematography', label: 'Cinematography Planner', href: '/visuals/scene-planning/cinematography', description: 'Camera, lens, and movement plans.', icon: 'camera', order: 4, capability: 'not_available' }),
      page({ id: 'composition', label: 'Composition Planner', href: '/visuals/scene-planning/composition', description: 'Frame composition policy.', icon: 'layout', order: 5, capability: 'not_available' }),
      page({ id: 'lighting-colour', label: 'Lighting & Colour Plan', href: '/visuals/scene-planning/lighting-colour', description: 'Lighting and colour direction.', icon: 'sun', order: 6, capability: 'not_available' }),
      page({ id: 'character-blocking', label: 'Character Blocking', href: '/visuals/scene-planning/character-blocking', description: 'Spatial character blocking.', icon: 'move', order: 7, capability: 'not_available' }),
      page({ id: 'continuity', label: 'Continuity Planner', href: '/visuals/scene-planning/continuity', description: 'Continuity locks and violations.', icon: 'link', order: 8, capability: 'not_available' }),
      page({ id: 'storyboard-workspace', label: 'Storyboard Workspace', href: '/storyboard/storyboard-editor', description: 'Shot board, continuity, and asset lineage.', icon: 'clapperboard', order: 9, capability: 'live' }),
      page({ id: 'readiness', label: 'Shot Readiness Review', href: '/visuals/scene-planning/readiness', description: 'Review shot readiness for generation.', icon: 'listChecks', order: 10, capability: 'not_available' }),
    ],
  },
  {
    id: 'generation-planning',
    number: '04',
    label: 'Prompt & Model Plan',
    overviewHref: '/visuals/generation-planning',
    description: 'Compile prompts, select models, and compose generation workflows.',
    order: 4,
    workflowStatuses: ['PLAN_WORKFLOW', 'COMPILE_PROMPT', 'SELECT_MODEL', 'RUN_PREFLIGHT', 'QUEUE'],
    permissionKey: 'lifecycle.stage.generation-planning',
    pages: [
      page({ id: 'genplan-overview', label: 'Stage Overview', href: '/visuals/generation-planning', description: 'Stage purpose, gates, and corresponding pages.', icon: 'compass', order: 1, exact: true, capability: 'live' }),
      page({ id: 'prompt-compiler', label: 'Prompt Compiler', href: '/visuals/generation-planning/prompt-compiler', description: 'Compile hierarchical generation prompts.', icon: 'sparkles', order: 2, capability: 'not_available' }),
      page({ id: 'negative-prompts', label: 'Negative Prompt Rules', href: '/visuals/generation-planning/negative-prompts', description: 'Negative constraints and bans.', icon: 'ban', order: 3, capability: 'not_available' }),
      page({ id: 'reference-conditioning', label: 'Reference Conditioning', href: '/visuals/generation-planning/reference-conditioning', description: 'Condition generation on references.', icon: 'crosshair', order: 4, capability: 'not_available' }),
      page({ id: 'model-selector', label: 'Model Selector', href: '/visuals/generation-planning/model-selector', description: 'Choose image-capable models.', icon: 'cpu', order: 5, capability: 'not_available' }),
      page({ id: 'provider-router', label: 'Provider Router', href: '/visuals/generation-planning/provider-router', description: 'Route work across providers.', icon: 'route', order: 6, capability: 'not_available' }),
      page({ id: 'workflow-composer', label: 'Workflow Composer', href: '/visuals/generation-planning/workflow-composer', description: 'Compose generation workflows.', icon: 'workflow', order: 7, capability: 'not_available' }),
      page({ id: 'candidate-strategy', label: 'Candidate Strategy', href: '/visuals/generation-planning/candidate-strategy', description: 'Plan candidate diversity and counts.', icon: 'target', order: 8, capability: 'not_available' }),
      page({ id: 'cost-plan', label: 'Cost & Resource Plan', href: '/visuals/generation-planning/cost-plan', description: 'Budget and resource planning.', icon: 'dollarSign', order: 9, capability: 'not_available' }),
      page({ id: 'preflight', label: 'Generation Preflight', href: '/visuals/generation-planning/preflight', description: 'Preflight storage and provider checks.', icon: 'play', order: 10, capability: 'not_available' }),
      page({ id: 'versions', label: 'Prompt & Workflow Versions', href: '/visuals/generation-planning/versions', description: 'Versioned prompt and workflow artifacts.', icon: 'history', order: 11, capability: 'not_available' }),
    ],
  },
  {
    id: 'generation',
    number: '05',
    label: 'Generate & Validate',
    overviewHref: '/visuals/generation',
    description: 'Generate candidates, validate files, and diagnose generation failures.',
    order: 5,
    workflowStatuses: ['GENERATE_CANDIDATES', 'VALIDATE_FILES', 'REMOVE_DUPLICATES'],
    permissionKey: 'lifecycle.stage.generation',
    pages: [
      page({ id: 'generation-overview', label: 'Stage Overview', href: '/visuals/generation', description: 'Stage purpose, gates, and corresponding pages.', icon: 'compass', order: 1, exact: true, capability: 'live' }),
      page({ id: 'image-generator', label: 'Image Generator Workspace', href: '/visuals/image-generator', description: 'Enqueue jobs and review validated candidates.', icon: 'image', order: 2, capability: 'live' }),
      page({ id: 'generation-queue', label: 'Generation Queue', href: '/visuals/generation/queue', description: 'Persisted generation job queue.', icon: 'boxes', order: 3, capability: 'live' }),
      page({ id: 'active-job', label: 'Active Job Detail', href: '/visuals/generation/jobs', description: 'Inspect a selected generation job.', icon: 'activity', order: 4, dynamicKind: 'job', capability: 'live' }),
      page({ id: 'candidate-gallery', label: 'Candidate Gallery', href: '/visuals/generation/candidates', description: 'Browse validated generation candidates.', icon: 'gallery', order: 5, capability: 'live' }),
      page({ id: 'technical-validation', label: 'Technical Validation', href: '/visuals/generation/technical-validation', description: 'File integrity and decode validation.', icon: 'fileCheck', order: 6, capability: 'not_available' }),
      page({ id: 'blank-detection', label: 'Blank-Image Detection', href: '/visuals/generation/blank-detection', description: 'Blank and low-variance rejection.', icon: 'scanLine', order: 7, capability: 'not_available' }),
      page({ id: 'semantic-validation', label: 'Semantic Validation', href: '/visuals/generation/semantic-validation', description: 'Semantic alignment checks.', icon: 'brain', order: 8, capability: 'not_available' }),
      page({ id: 'attempts', label: 'Generation Attempts', href: '/visuals/generation/attempts', description: 'Attempt history and durations.', icon: 'history', order: 9, capability: 'live' }),
      page({ id: 'failures', label: 'Failure Diagnostics', href: '/visuals/generation/failures', description: 'Generation failure codes and evidence.', icon: 'bug', order: 10, capability: 'live' }),
    ],
  },
  {
    id: 'quality',
    number: '06',
    label: 'Evaluate & Repair',
    overviewHref: '/visuals/quality',
    description: 'Evaluate quality, diagnose defects, and run autonomous repair.',
    order: 6,
    workflowStatuses: ['SCORE_CANDIDATES', 'DIAGNOSE_DEFECTS', 'REPAIR_OR_REGENERATE', 'VERIFY_IDENTITY', 'VERIFY_CONTINUITY', 'VERIFY_GEOGRAPHY', 'VERIFY_HISTORY', 'UPSCALE', 'POST_PROCESS', 'FINAL_QA'],
    permissionKey: 'lifecycle.stage.quality',
    pages: [
      page({ id: 'quality-overview', label: 'Stage Overview', href: '/visuals/quality', description: 'Stage purpose, gates, and corresponding pages.', icon: 'compass', order: 1, exact: true, capability: 'live' }),
      page({ id: 'candidate-comparison', label: 'Candidate Comparison', href: '/visuals/quality/candidate-comparison', description: 'Compare candidate quality side by side.', icon: 'columns', order: 2, capability: 'not_available' }),
      page({ id: 'evaluation', label: 'Quality Evaluation', href: '/visuals/quality/evaluation', description: 'Semantic quality evaluation results.', icon: 'award', order: 3, capability: 'not_available' }),
      page({ id: 'quality-evidence', label: 'Quality Evidence', href: '/visuals/quality/evidence', description: 'Persisted quality evidence and exceptions.', icon: 'shield', order: 4, capability: 'live' }),
      page({ id: 'anatomy-identity', label: 'Anatomy & Identity Review', href: '/visuals/quality/anatomy-identity', description: 'Identity and anatomy gates.', icon: 'users', order: 5, capability: 'not_available' }),
      page({ id: 'composition-review', label: 'Composition Review', href: '/visuals/quality/composition', description: 'Composition quality review.', icon: 'layout', order: 6, capability: 'not_available' }),
      page({ id: 'geography-culture', label: 'Geography & Culture Review', href: '/visuals/quality/geography-culture', description: 'Geography and culture validation.', icon: 'map', order: 7, capability: 'not_available' }),
      page({ id: 'historical-accuracy', label: 'Historical Accuracy Review', href: '/visuals/quality/historical-accuracy', description: 'Historical accuracy validation.', icon: 'landmark', order: 8, capability: 'not_available' }),
      page({ id: 'continuity-validation', label: 'Continuity Validation', href: '/visuals/quality/continuity-validation', description: 'Continuity validation gates.', icon: 'link', order: 9, capability: 'not_available' }),
      page({ id: 'defects', label: 'Defect Diagnosis', href: '/visuals/quality/defects', description: 'Diagnosed image defects.', icon: 'bug', order: 10, capability: 'not_available' }),
      page({ id: 'repair', label: 'Autonomous Repair Workspace', href: '/visuals/quality/repair', description: 'Defect-directed repair operations.', icon: 'wrench', order: 11, capability: 'not_available' }),
      page({ id: 'repair-history', label: 'Repair History', href: '/visuals/quality/repair-history', description: 'Persisted repair attempts.', icon: 'history', order: 12, capability: 'not_available' }),
      page({ id: 'exceptions', label: 'Exception Resolution', href: '/visuals/quality/exceptions', description: 'Human-exception resolution queue.', icon: 'alertTriangle', order: 13, capability: 'live' }),
    ],
  },
  {
    id: 'delivery',
    number: '07',
    label: 'Approve & Deliver',
    overviewHref: '/visuals/delivery',
    description: 'Approve assets, manage lineage, and prepare video handoff.',
    order: 7,
    workflowStatuses: ['APPROVE', 'VERSION', 'DELIVER'],
    permissionKey: 'lifecycle.stage.delivery',
    pages: [
      page({ id: 'delivery-overview', label: 'Stage Overview', href: '/visuals/delivery', description: 'Stage purpose, gates, and corresponding pages.', icon: 'compass', order: 1, exact: true, capability: 'live' }),
      page({ id: 'approval-queue', label: 'Autonomous Approval Queue', href: '/visuals/delivery/approval-queue', description: 'Assets awaiting approval.', icon: 'listChecks', order: 2, capability: 'not_available' }),
      page({ id: 'approval-decision', label: 'Approval Decision', href: '/visuals/delivery/approval-decision', description: 'Record approval decisions.', icon: 'checkCircle', order: 3, capability: 'not_available' }),
      page({ id: 'approved-assets', label: 'Approved Assets', href: '/visuals/delivery/approved-assets', description: 'Approved production assets.', icon: 'package', order: 4, capability: 'live' }),
      page({ id: 'asset-detail', label: 'Asset Detail', href: '/visuals/delivery/assets', description: 'Inspect a selected approved asset.', icon: 'archive', order: 5, dynamicKind: 'asset', capability: 'live' }),
      page({ id: 'asset-lineage', label: 'Asset Versions & Lineage', href: '/visuals/delivery/asset-lineage', description: 'Immutable asset version lineage.', icon: 'gitCommit', order: 6, capability: 'not_available' }),
      page({ id: 'renditions', label: 'Rendition Manager', href: '/visuals/delivery/renditions', description: 'Manage delivery renditions.', icon: 'layers', order: 7, capability: 'not_available' }),
      page({ id: 'storyboard-handoff', label: 'Storyboard Handoff', href: '/visuals/delivery/storyboard-handoff', description: 'Hand off approved frames to storyboard.', icon: 'film', order: 8, capability: 'not_available' }),
      page({ id: 'video-readiness', label: 'Image-to-Video Readiness', href: '/visuals/delivery/video-readiness', description: 'Validate image inputs for video assembly.', icon: 'video', order: 9, capability: 'live' }),
      page({ id: 'destinations', label: 'Delivery Destinations', href: '/visuals/delivery/destinations', description: 'Configure delivery destinations.', icon: 'send', order: 10, capability: 'not_available' }),
      page({ id: 'delivery-history', label: 'Delivery History', href: '/visuals/delivery/history', description: 'Delivery event history.', icon: 'history', order: 11, capability: 'not_available' }),
    ],
  },
  {
    id: 'learning',
    number: '08',
    label: 'Learn',
    overviewHref: '/visuals/learning',
    description: 'Capture analytics, benchmarks, and routing learning signals.',
    order: 8,
    workflowStatuses: ['LEARN'],
    permissionKey: 'lifecycle.stage.learning',
    pages: [
      page({ id: 'learning-overview', label: 'Stage Overview', href: '/visuals/learning', description: 'Stage purpose, gates, and corresponding pages.', icon: 'compass', order: 1, exact: true, capability: 'live' }),
      page({ id: 'production-analytics', label: 'Production Analytics', href: '/visuals/learning/production-analytics', description: 'Production throughput analytics.', icon: 'barChart', order: 2, capability: 'not_available' }),
      page({ id: 'quality-analytics', label: 'Quality Analytics', href: '/visuals/learning/quality-analytics', description: 'Quality trend analytics.', icon: 'lineChart', order: 3, capability: 'not_available' }),
      page({ id: 'provider-performance', label: 'Provider Performance', href: '/visuals/learning/provider-performance', description: 'Provider success and cost.', icon: 'gauge', order: 4, capability: 'not_available' }),
      page({ id: 'model-performance', label: 'Model Performance', href: '/visuals/learning/model-performance', description: 'Model success analytics.', icon: 'cpu', order: 5, capability: 'not_available' }),
      page({ id: 'prompt-performance', label: 'Prompt Performance', href: '/visuals/learning/prompt-performance', description: 'Prompt effectiveness analytics.', icon: 'sparkles', order: 6, capability: 'not_available' }),
      page({ id: 'workflow-performance', label: 'Workflow Performance', href: '/visuals/learning/workflow-performance', description: 'Workflow latency and yield.', icon: 'workflow', order: 7, capability: 'not_available' }),
      page({ id: 'cost-analytics', label: 'Cost Analytics', href: '/visuals/learning/cost-analytics', description: 'Spend and budget analytics.', icon: 'dollarSign', order: 8, capability: 'not_available' }),
      page({ id: 'feedback', label: 'Feedback & Learning Signals', href: '/visuals/learning/feedback', description: 'Operator and system feedback.', icon: 'messageSquare', order: 9, capability: 'not_available' }),
      page({ id: 'benchmarks', label: 'Benchmark Studio', href: '/visuals/learning/benchmarks', description: 'Benchmark suites and scores.', icon: 'flask', order: 10, capability: 'not_available' }),
      page({ id: 'regression-results', label: 'Regression Results', href: '/visuals/learning/regression-results', description: 'Regression suite outcomes.', icon: 'gitCompare', order: 11, capability: 'not_available' }),
      page({ id: 'routing-optimizer', label: 'Routing Policy Optimizer', href: '/visuals/learning/routing-optimizer', description: 'Optimize provider routing policy.', icon: 'settings', order: 12, capability: 'not_available' }),
      page({ id: 'learning-audit', label: 'Learning Audit', href: '/visuals/learning/audit', description: 'Audited learning events.', icon: 'scrollText', order: 13, capability: 'not_available' }),
    ],
  },
];

export function getLifecycleStageById(id: string): LifecycleStageConfig | undefined {
  return LIFECYCLE_STAGES.find((stage) => stage.id === id);
}

export function getLifecycleStageByOverviewHref(href: string): LifecycleStageConfig | undefined {
  return LIFECYCLE_STAGES.find((stage) => stage.overviewHref === href);
}

export function pageCount(stage: LifecycleStageConfig): number {
  return stage.pages.length;
}

/** Normalize pathname (strip query/hash). */
export function normalizePath(pathname: string): string {
  const bare = pathname.split('?')[0]?.split('#')[0] || pathname;
  if (bare.length > 1 && bare.endsWith('/')) return bare.slice(0, -1);
  return bare || '/';
}

export function matchesPageRoute(pathname: string, page: LifecyclePageConfig): boolean {
  const path = normalizePath(pathname);
  const href = normalizePath(page.href);

  if (page.exact) return path === href;

  if (page.dynamicKind === 'job') {
    return path === href || path.startsWith(`${href}/`);
  }
  if (page.dynamicKind === 'asset') {
    return path === href || path.startsWith(`${href}/`);
  }

  return path === href || path.startsWith(`${href}/`);
}

export function findActiveLifecyclePage(pathname: string): {
  stage: LifecycleStageConfig;
  page: LifecyclePageConfig;
} | null {
  const path = normalizePath(pathname);
  let best: { stage: LifecycleStageConfig; page: LifecyclePageConfig; score: number } | null = null;

  for (const stage of LIFECYCLE_STAGES) {
    for (const page of stage.pages) {
      if (!matchesPageRoute(path, page)) continue;
      const score = page.exact ? 10_000 : normalizePath(page.href).length;
      if (!best || score > best.score) best = { stage, page, score };
    }
  }

  return best ? { stage: best.stage, page: best.page } : null;
}

export function findStageForPathname(pathname: string): LifecycleStageConfig | null {
  return findActiveLifecyclePage(pathname)?.stage ?? null;
}

export function isStageOverviewActive(pathname: string, stage: LifecycleStageConfig): boolean {
  return normalizePath(pathname) === normalizePath(stage.overviewHref);
}

export function deriveWorkflowStatusFromQueue(
  queue: Record<string, number> | null | undefined,
  stage: LifecycleStageConfig,
): WorkflowOperationalStatus {
  if (!queue) return 'unavailable';

  const blocked = (queue.HUMAN_EXCEPTION_REQUIRED ?? 0) > 0
    && stage.workflowStatuses.some((status) => (queue[status] ?? 0) + (queue[`PROCESSING:${status}`] ?? 0) === 0)
    && stage.id === 'quality';

  const processing = stage.workflowStatuses.reduce(
    (sum, status) => sum + (queue[`PROCESSING:${status}`] ?? 0),
    0,
  );
  const waiting = stage.workflowStatuses.reduce((sum, status) => sum + (queue[status] ?? 0), 0);

  if (processing > 0) return 'active';
  if (blocked) return 'blocked';
  if (waiting > 0) return 'pending';

  // Do not invent "completed" without explicit evidence of gate passage.
  return 'pending';
}

export function stageJobCount(queue: Record<string, number> | null | undefined, stage: LifecycleStageConfig): number | null {
  if (!queue) return null;
  return stage.workflowStatuses.reduce(
    (sum, status) => sum + (queue[status] ?? 0) + (queue[`PROCESSING:${status}`] ?? 0),
    0,
  );
}

export function withContextQuery(href: string, context: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(context)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  if (!query) return href;
  return href.includes('?') ? `${href}&${query}` : `${href}?${query}`;
}
