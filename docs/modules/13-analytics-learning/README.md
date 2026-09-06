# Module 13 · Analytics & AI Learning

Governed performance capture, explainable diagnosis, human-reviewed channel knowledge, closed-loop downstream feedback, and content recycling plan generation for published content.

## Scope Inventory

### SQL Schema (`015_module13_analytics_learning.sql`)

12 idempotent tables (IF OBJECT_ID IS NULL) + 4 indexes:

| Table | Owner key | Notes |
|---|---|---|
| `AnalyticsProfiles` | PublicationId (UQ FK → Publications) | Entry-point created after Module 12 PublicationId locks; Status = MONITORING |
| `PerformanceSnapshots` | AnalyticsProfileId | Immutable 1H/6H/24H/48H capture windows; impressions/views/CTR/watchtime/subscribers/revenue |
| `RetentionPoints` | AnalyticsProfileId | Retention curve points (second × retained %); diagram axis mapping |
| `AudienceGeographies` | AnalyticsProfileId | Country/share/views breakdown for audience analysis |
| `TrafficSources` | AnalyticsProfileId | Browse/suggested/search/external/channel acquisition mix |
| `PerformanceBenchmarks` | WorkspaceId | Channel median baseline (comparison for anomaly detection) |
| `AnalyticsAnomalies` | AnalyticsProfileId | Severity INFO/MEDIUM/HIGH, Status OPEN/ACKNOWLEDGED/RESOLVED |
| `ContentExperiments` | AnalyticsProfileId | A/B packaging variants (title/thumbnail; never overwrite master video) |
| `LearningInsights` | WorkspaceId + OpportunityId (nullable) | AI-proposed lessons; Status PROPOSED → APPROVED/REJECTED |
| `ChannelKnowledge` | WorkspaceId + RuleKey (UQ) | Approved lessons accumulated; EvidenceCount incremented on MERGE |
| `LearningFeedback` | LearningInsightId FK | READY → APPLIED; TargetModule OPPORTUNITY_INTELLIGENCE |
| `ContentRecyclingPlans` | PublicationId + ProjectId + LearningInsightId (nullable FK) | HIGH/MEDIUM priority derivatives; creates new independent work branch |
| `AnalyticsIngestionRuns` | AnalyticsProfileId | Pipeline run ledger for ingestion audit |

Indexes: `IX_PerformanceSnapshots_ProfileTime (DESC)` · `IX_AnalyticsProfiles_WSStatus` · `IX_LearningInsights_WSStatusCreated` · `IX_AnalyticsIngestionRuns_ProfileCreated (DESC)`.

Bootstrap (`db:bootstrap-module13`): inspects Module 12 PublishJob table for an eligible publication; inserts 1 profile + 4 snapshot rows + 9 retention points + 6 geographies + 5 traffic rows + 2 anomalies + 4 PROPOSED insights + 3 recycling proposals; if no Publication exists, logs skip and exits cleanly.

### API Endpoints (`apps/api` Fastify v5)

7 endpoints registered after `/publication` POST:

| Method | Route | Repository export | Governing gate |
|---|---|---|---|
| GET | `/analytics-projects?workspaceId=` | `listAnalyticsProjects` | List ContentProjects joined with TOP 1 latest snapshot row |
| GET | `/projects/:projectId/analytics?workspaceId=` | `getAnalyticsWorkspace` | Returns 409 `Published content required` if no profile; 10 parallel recordset queries (Promise.all + per-query `.recordset` destructuring) |
| POST | `/projects/:projectId/analytics/snapshots` | `ingestPerformanceSnapshot` | Full 17-field zod body; computes nextIngestionAt via DATEADD; inserts profile + snapshot |
| PATCH | `/analytics/anomalies/:anomalyId` | `updateAnalyticsAnomaly` | Status → OPEN/ACKNOWLEDGED/RESOLVED with zod enum |
| POST | `/analytics/insights/:insightId/decision` | `decideLearningInsight` | **Human govern gate**. APPROVE branch: MERGE ChannelKnowledge (UQ (WS, RuleKey)) + INSERT LearningFeedback (TargetModule='OPPORTUNITY_INTELLIGENCE', Status READY) + Stage AI_LEARNING 100% |
| POST | `/analytics/feedback/:feedbackId/apply` | `applyLearningFeedback` | 404 if missing; SET AppliedAt + StageExec AI_LEARNING 100% COMPLETED |
| POST | `/analytics/recycling/:planId/decision` | `decideContentRecyclingPlan` | APPROVE branch: Stage CONTENT_RECYCLING 50% + ProjectActivity RECYCLING_PLAN_APPROVED insert |

Health endpoint reports `version: '0.13.0'` with `module13: 'ready'`.

### Web Routes (`apps/web` Next.js 15 App Router)

8 pages (app-shell PRODUCTION PIPELINE slot #10 → `href: '/analytics'`; sidebar footer chip `Module 13 · Analytics & AI Learning`):

| Route | Scope | Layout |
|---|---|---|
| `/analytics` | Static workspace dashboard | 4 StatCards (48h Views/CTR/Avg Viewed/Score); 5-step post-flow Published→Metrics→Diagnosis→Learning→Feedback; metric-board 6-cell + attention anomalies + insights link |
| `/projects/[id]/analytics` | Performance dashboard (default) | `'use client'` `useParams<{id:string}>()`; AnalyticsTabs pill strip; lineage-strip; 4 StatCards; trend-chart 4 growing bars; traffic mix; 48h metric data-table (4 snapshots) |
| `/projects/[id]/analytics/retention` | Retention | Retention-chart CSS absolute plot 9 points (s/410 * 94+2 %, pct * 0.72 %) · SVG ret-line overlay; 4 diagnostic rows x Strong/green |
| `/projects/[id]/analytics/audience` | Audience & Acquisition | Geography 6-country table; 5 traffic bar-rows; 3 compact cards (global/home/discovery) |
| `/projects/[id]/analytics/diagnostics` | Experiments & Alerts | Anomaly data-table × 2; empty-intel experiment creation |
| `/projects/[id]/analytics/learning` | AI Learning Review | Callout warning human-gate; learning-grid 2×2 4 cards Approve/Reject controls · Confidence/Impact scores |
| `/projects/[id]/analytics/knowledge` | Channel Knowledge & Feedback | Knowledge rows (statement + evidence + conf%); feedback-queue × 3; closed-loop 5-cell feedback-flow diagram Published → Diagnosis → Proposal → Approval → Opportunity |
| `/projects/[id]/analytics/recycling` | Content Recycling | Info callout never-overwrite-master; Recycling plan data-table × 3 HIGH/MEDIUM; 5-stage workflow flow Winning → Derivative → Approval → Branch → Publish |

`AnalyticsTabs` = 7-link `sub-tabs` pill Performance/Retention/Audience/Experiments & Alerts/AI Learning/Knowledge & Feedback/Content Recycling.

## Upstream / Downstream Handoffs

### Upstream from Module 12 (Approval & Publishing)
- **Publication ExternalId / PublicationId**: `AnalyticsProfiles.PublicationId` (UQ FK) — analytics only starts when Publication is actually registered (`registerPublication` in Module 12).
- **PublicationId governed lock**: No profile → `getAnalyticsWorkspace` returns HTTP 409 `Published content required`; prevents phantom analytic work.

### Downstream to Module 05 (Opportunity Intelligence) + others
- **LearningInsight APPROVE → ChannelKnowledge MERGE**: `EvidenceCount += 1` (UQ workspace+RuleKey) so lessons accumulate across publications.
- **LearningFeedback TargetModule = 'OPPORTUNITY_INTELLIGENCE'**: Created with Status = READY on insight approve; when `applyLearningFeedback` called → `AppliedAt = GETUTCDATE()` + StageExec `AI_LEARNING` 100% COMPLETED; downstream M05 Opportunity scoring context / future prompt weights consume READY channel knowledge.
- **Recycling APPROVE → Stage `CONTENT_RECYCLING` 50%** + ProjectActivity `RECYCLING_PLAN_APPROVED`; creates a new independent derivative project branch (never overwrites original publication).
- **`NEXT_PUBLIC_DEMO_MODE=true`**: pages fall back to `lib/module13-data.ts` fixtures (Hidden AI 48h project id ending in `1124`).
