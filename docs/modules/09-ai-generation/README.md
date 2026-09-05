# Module 09 — AI Generation Studio

Consumes the upstream Approved Scene Package + Character Bible (Module 08) and drives multi-capability, multi-provider AI generation: imagery, video, voice/dialogue, music + SFX. Every job records prompt versioning, provider/model routing, attempt/error history, cost and lineage back to `CharacterBibleVersionId` + `ScenePackageVersionId`. Every generated asset is registered, approved/rejected, and downstream EDITING_QA receives immutable master handoffs.

## Database

**Migration:** `packages/database/sql/migrations/011_module09_ai_generation_studio.sql` (source `010_module09_ai_generation_studio.sql` renumbered because target migration 010 is used for Module 08.)

Six `IF OBJECT_ID IS NULL` tables wrapped in `BEGIN TRANSACTION … COMMIT`, plus two covering indexes.

| Table | Purpose |
|---|---|
| `GenerationProviders` | Per-workspace adapters. `WorkspaceId FK`. `ProviderKey NVARCHAR(80)`. `DisplayName NVARCHAR(160)`. `Capability ∈ {IMAGE, VIDEO, VOICE, AUDIO, MUSIC, SFX}`. `Status ∈ {ACTIVE, INACTIVE, MAINTENANCE}`. `ApiMode ∈ {API, WORKER, WEBHOOK}`. `DefaultModel`, `SupportsReferences / SupportsBatch / SupportsWebhook BIT`. `PriorityOrder INT DEFAULT 100`. `ConfigJson NVARCHAR(MAX)` (credentials paths, rate-limits, routing). CreatedAt + UpdatedAt. |
| `GenerationJobs` | Head for every generation unit. `WorkspaceId / ContentProjectId FK`. `SceneId NULLABLE FK Scenes` — per-scene granularity. `ScenePackageVersionId + CharacterBibleVersionId FK` (immutable reference lineage). `Capability ∈ {IMAGE, VIDEO, VOICE, AUDIO, MUSIC, SFX}`. `ProviderKey, Model, PromptVersion INT DEFAULT 1`. `PromptText, NegativePrompt, ReferenceJson, SettingsJson NVARCHAR(MAX)`. `Status ∈ {QUEUED, IN_PROGRESS, COMPLETED, FAILED, CANCELLED}`. `ApprovalStatus ∈ {PENDING, APPROVED, REJECTED, RETURNED}`. `Priority INT DEFAULT 50`, `AttemptNumber`, `MaxAttempts DEFAULT 3`, `FallbackProviderKey`. `ProgressPercent DECIMAL(5,2)`. `ExternalJobId NVARCHAR(250)`. `EstimatedCost / ActualCost DECIMAL(18,4)`, `Currency DEFAULT 'USD'`, `CreditUnits DECIMAL(18,4)`. `DurationSeconds, Resolution`. `LastError NVARCHAR(MAX)`. QueuedAt / StartedAt / CompletedAt / CreatedByUserId / UpdatedAt. |
| `GenerationJobAttempts` | Every provider call. `GenerationJobId FK`. `AttemptNumber INT`. `ProviderKey, Model`. `Status ∈ {IN_PROGRESS, COMPLETED, FAILED, FALLBACK, RETRY}`. `ExternalJobId, Cost DECIMAL(18,4)`. `ErrorMessage NVARCHAR(MAX)`. StartedAt / CompletedAt / CreatedAt. |
| `GeneratedAssets` | Register + approval surface. `WorkspaceId / ContentProjectId / SceneId / GenerationJobId FK`. `AssetType ∈ {IMAGE, VIDEO, AUDIO, VOICE, MUSIC, SFX}`. `AssetRole ∈ {KEYFRAME, FILL_SHOT, SCENE_MASTER, DIALOGUE_TRACK, MUSIC_CUE, SFX_LAYER, B_ROLL}`. `StorageUri NVARCHAR(1000), PreviewUri NVARCHAR(1000)`. `MimeType`, `FileSizeBytes BIGINT`, `DurationSeconds`, `Width/Height INT`. `VersionNumber INT DEFAULT 1`. `ApprovalStatus ∈ {PENDING, APPROVED, REJECTED, RETURNED, LOCKED}`. `IsMaster BIT DEFAULT 0`. `MetadataJson NVARCHAR(MAX)` (seed prompt, model, fps, resolution, sampler, hash, watermark flag). `ApprovedByUserId FK`, `ApprovedAt DATETIME2`. |
| `GenerationPromptVersions` | Prompt snapshot chain. `GenerationJobId FK`. `VersionNumber INT UNIQUE per job`. `PromptText / NegativePrompt / SettingsJson`. `ChangeSummary NVARCHAR(1000)`. `CreatedByUserId FK`, `CreatedAt`. |
| `GenerationApprovals` | Decision log per asset. `GeneratedAssetId FK`. `Decision ∈ {APPROVE, REJECT, RETURN, FLIP, LOCK}`. `Comment NVARCHAR(3000)`. `DecidedByUserId FK`, `DecidedAt`. |

Indexes:
- `IX_GenerationJobs_ProjectStatus (ContentProjectId, Status, Capability)`
- `IX_GeneratedAssets_ProjectScene (ContentProjectId, SceneId, AssetType, ApprovalStatus)`

**Bootstrap demo data:** `packages/database/src/bootstrap-module09.ts`

Requires Module 01 workspace `Slug = 'cacsms-cinema'` and Module 08 `ScenePackages.ApprovedVersionId` / `CharacterBibles.ApprovedVersionId`. If M08 approved links are missing, the bootstrap promotes the latest APPROVED `ScenePackageVersion` / `CharacterBibleVersion` and flips SCENE_MATRIX → COMPLETED 100% first.

Creates:
- 4 providers: `IMAGE_AGENT` · `VIDEO_AGENT` · `VOICE_AGENT` · `AUDIO_AGENT` — all ACTIVE, priority 100.
- 10 jobs across Capability × Scenes: IMAGE × 3 (SC-001/003/005), VIDEO × 2 (SC-002/004), VOICE × 2 (SC-001/003), AUDIO × 2 (SC-002/004), MUSIC × 1 (Full-film cue). Mix: 3 COMPLETED, 4 IN_PROGRESS, 2 QUEUED, 1 FAILED. ProgressPercent 0→100 with matching actual cost.
- `GenerationJobAttempts`: 12 rows (1–3 per job, one with FAILED fallback + retry).
- `GeneratedAssets`: 14 items (6 IMAGE × 4/3 variants, 2 VIDEO master, 2 VOICE tracks, 2 SFX, 2 MUSIC). Master asset per scene + job with Approval mix (APPROVED/REJECTED/PENDING).
- `GenerationPromptVersions`: one v1 + v2 per in-progress job, with ChangeSummary "Negative prompt expanded for continuity lock".
- `GenerationApprovals`: 8 decisions (APPROVE x5, REJECT x2, RETURN x1).
- Stage progression: `IMAGE_GENERATION IN_PROGRESS 72%`, `VIDEO_GENERATION IN_PROGRESS 55%`, `AUDIO_GENERATION IN_PROGRESS 48%`.

Run with: `pnpm --filter @cacsms/database db:bootstrap-module09`

Package script added at [package.json](file:///c:/Trading-Engine/cacsms-cinema/packages/database/package.json#L33):
- `"db:bootstrap-module09": "tsx src/bootstrap-module09.ts"` (between module08 and `clear-demo`)

## API endpoints (apps/api/src/server.ts — version 0.9.0)

Eight Module 09 endpoints. `/health` now reports `version: '0.9.0'`, `service: 'cacsms-cinema-api'`, `module01..module09 = 'ready'`. `setErrorHandler` signature uses `(err:any, req, reply) => …` to satisfy Fastify 5 strict-types.

| Method | Path | Contract |
|---|---|---|
| GET | `/api/generation-projects` | Workspace-scoped list LEFT JOINING StageExecutions and approved ScenePackage/CharacterBible. KPIs: Jobs total, Jobs running, ApprovedAssets, ActualCost. Orders by `UpdatedAt DESC`. |
| GET | `/api/projects/:projectId/generation` | One round trip: `{project, providers, jobs, jobAttempts, assets, promptVersions, approvals, handoffs, stages}`. Returns `409 "Approved Character Bible and Scene Package are required"` if upstream M08 links missing. |
| POST | `/api/projects/:projectId/generation/jobs` | Create new job. Body: `{capability, sceneId?, providerKey, model?, priority?, promptText, negativePrompt?, settingsJson?, referenceJson?}`. Defaults `Status=QUEUED`, `PromptVersion=1`. Inserts v1 into `GenerationPromptVersions` with ChangeSummary `Initial prompt`. Flips stages: IMAGE → IMAGE_GENERATION, VIDEO → VIDEO_GENERATION, VOICE/AUDIO/MUSIC/SFX → AUDIO_GENERATION IN_PROGRESS 15% if NOT_STARTED. Audit `GENERATION_JOB_CREATED`. |
| PATCH | `/api/projects/:projectId/generation/jobs/:jobId` | Update job status + progress + external/cost/error fields. Body: `{status?, progressPercent?, externalJobId?, actualCost?, creditUnits?, durationSeconds?, resolution?, lastError?}`. Transitions COMPLETED auto-register demo assets if none exist. Audit `GENERATION_JOB_UPDATED`. |
| POST | `/api/projects/:projectId/generation/jobs/:jobId/assets/register` | Register `GeneratedAssets` row. Body: `{assetType, assetRole, storageUri, previewUri?, mimeType?, fileSizeBytes?, durationSeconds?, width?, height?, versionNumber?, isMaster?, metadataJson?}`. Flips job `ApprovalStatus=PENDING`. Audit `GENERATION_ASSET_REGISTERED`. |
| POST | `/api/projects/:projectId/generation/assets/:assetId/decision` | Decision body `{decision ∈ {APPROVE, REJECT, RETURN, FLIP, LOCK}, comment? ≤ 3000}`. INSERT `GenerationApprovals`; UPDATE `GeneratedAssets.ApprovalStatus/ApprovedBy/ApprovedAt`. When `APPROVED` the asset inherits `IsMaster` flag and `ProjectHandoffs` for `('IMAGE_GENERATION'->'EDITING_QA')` / `('VIDEO_GENERATION'->'EDITING_QA')` / `('AUDIO_GENERATION'->'EDITING_QA')` READY rows are upserted once per project/capability. Audit `GENERATION_ASSET_$decision`. |
| POST | `/api/projects/:projectId/generation/complete` | Final stage gate. HARD REQUIREMENTS: every scene has 1 IMAGE MASTER + 1 VIDEO MASTER + 1 VOICE MASTER + 1 AUDIO MASTER. Flips IMAGE_GENERATION / VIDEO_GENERATION / AUDIO_GENERATION all to COMPLETED 100%. Inserts two `ProjectVersions` (GENERATION_PACKAGE, MASTER_VIEWING_COPY) + `ProjectActivities.ActivityType = 'GENERATION_RUN_COMPLETED'`. Audit `GENERATION_STAGE_COMPLETED`. |
| GET | `/health` | Service `cacsms-cinema-api`, `version: '0.9.0'`, module01..module09 ready. |

Smoke test: `pnpm --filter @cacsms/api test` now prints 9 lines ending in:
`Module 09 API contracts: generation projects register, workspace queue, jobs create/update, assets register/decide, stage complete.`

## Web routes

AppShell PRODUCTION PIPELINE 6th live slot: **AI Generation** (`✦`, href `/generation`). Sidebar chip: `Module 09 · AI Generation Studio`.

| Route | Page | Purpose |
|---|---|---|
| `/generation` | `apps/web/src/app/(app)/generation/page.tsx` | Studio dashboard. Callout.info: Governed input (Approved Scene Package + Character Bible). `StatCard × 4` (Scenes in generation / Jobs running / Approved assets / Generation spend). Enterprise table with Scene / Image / Video / Voice / Music-SFX / Variants / Cost / Open → Workspace. Two-col: Provider subscriptions (IMAGE_AGENT / VIDEO_AGENT / VOICE_AGENT / AUDIO_AGENT — CONNECTED with usage) + Live generation queue (priority jobs list-row tiles with progress% + status pill). |
| `/projects/[id]/generation/images` | `apps/web/src/app/(app)/projects/[id]/generation/images/page.tsx` | Image generation workspace. `GenerationTabs` pill nav (script-tabs-derived CSS). Left `scene-list workspace-card` (SC-001..SC-005) + `useState` scene + selected asset. Spec-grid 4-col Provider/Aspect/Resolution/Variants; prompt-blue IMAGE PROMPT + prompt-red NEGATIVE + LOCKED REFERENCES (`CHR-001/WRD-A1/LOC-003/SP-v1`). `asset-grid 3-col` variants (selectable selected border). Button-row: regenerate / reject / approve master. |
| `/projects/[id]/generation/videos` | `apps/web/src/app/(app)/projects/[id]/generation/videos/page.tsx` | Video generation workspace. Per-scene `asset-placeholder.video` with PLAY chips. Configs: motion, seed, fps, duration, ref-video loopback, camera track, batch, keyframe-anchored continuity. Enterprise approval history at foot. |
| `/projects/[id]/generation/voice` | `apps/web/src/app/(app)/projects/[id]/generation/voice/page.tsx` | Voice + dialogue. Character/voice-profile selection, dialogue alignment, cloning lock, emotions, retakes + fallback voices. Approval column per line. |
| `/projects/[id]/generation/audio` | `apps/web/src/app/(app)/projects/[id]/generation/audio/page.tsx` | Music cues + SFX layers. Scene stack: cue types, moods, BPM, stems, SFX asset chips, timeline overlay. |
| `/projects/[id]/generation/queue` | `apps/web/src/app/(app)/projects/[id]/generation/queue/page.tsx` | Two-col `queue-layout`: `queue-main` job-card × 6 (Queued / In Progress / Failed); `queue-side` Provider health list-row with `provider-head` 6-col grid (Provider · Model · Capability · Status · Priority · Actions) and provider-row rows. |

New component for generation navigation:
- `apps/web/src/components/generation-tabs.tsx` — `<nav className="generation-tabs">` with five links (Images / Videos / Voice / Audio / Queue) and `usePathname`-driven `.active` state.

Shared additions:
- `apps/web/src/lib/module09-data.ts` — demo fallback: `genProject{id, code, title, scenePackageVersion, characterBibleVersion}`, `providerSummary[]`, `genScenes[]` (5 scenes × Image/Video/Voice/Audio statuses + image/video variant counts + cost), `jobs[]` (8 priority, provider, progress, status), `imageVariants[]`, `videoClips[]`, `voiceLines[]`, `audioCues[]`.
- `apps/web/src/styles/globals.css` — appended Module 09 classes after Module 08 media block: `.callout` / `.callout.info`, `.list-row`, `.asset-grid 3-col → 2 at 980, 1 at 680`, `.asset-card` / `.asset-card.selected`, `.asset-placeholder` / `.video dark 280`, `.asset-meta` / `.button-row` / `.progress` bar. `.generation-kpis 5-col` + violet/cyan/green/amber/red top-color tiles. `.generation-tabs`. `.queue-layout 1/320` → 1-col at 1100. `.job-card` / `.job-head` / `.job-foot`. `.provider-head / provider-row 6-col grid` with horizontal scroll at 820. Media breakpoints: 1100px collapse queue; 820px provider tables scroll; 560px asset-g 1-col, kpis 1/2, list-row full.

## Inventory & pipeline position

| Component | Count / demo seed |
|---|---|
| SQL tables | 6 (`GenerationProviders · GenerationJobs · GenerationJobAttempts · GeneratedAssets · GenerationPromptVersions · GenerationApprovals`) + 2 covering indexes |
| API endpoints | 8 (generation projects list, workspace, jobs create / update, asset register / decision, stage complete, /health v0.9.0) |
| Next.js pages | 6 (`/generation` · `…/images` · `…/videos` · `…/voice` · `…/audio` · `…/queue`) + 1 new component `generation-tabs` |
| Demo providers | 4 (IMAGE_AGENT, VIDEO_AGENT, VOICE_AGENT, AUDIO_AGENT) all ACTIVE, priority 100 |
| Demo jobs | 10 (3 IMAGE, 2 VIDEO, 2 VOICE, 2 AUDIO, 1 MUSIC) — 3 COMPLETED / 4 IN_PROGRESS / 2 QUEUED / 1 FAILED |
| Demo attempts | 12 retry + fallback records, 1 FAILED → retry IN_PROGRESS |
| Demo generated assets | 14 (6 IMAGE variants, 2 VIDEO masters, 2 VOICE tracks, 2 SFX, 2 MUSIC) |
| Demo decisions | 8 (APPROVE × 5, REJECT × 2, RETURN × 1) |
| Demo prompt versions | v1 + v2 for every IN_PROGRESS job, with continuity ChangeSummary |
| Stage progression on bootstrap | IMAGE_GENERATION 72% IN_PROGRESS · VIDEO_GENERATION 55% · AUDIO_GENERATION 48% |

**Upstream prerequisites** (enforced by API `getGenerationWorkspace` + bootstrap): Approved Character Bible v1 + Approved Scene Package v1 from Module 08 for project `CAC-2026-000124`. Bootstrap auto-promotes latest APPROVED versions if the explicit `ApprovedVersionId` link is missing, and finalizes `SCENE_MATRIX COMPLETED`.

**Downstream handoffs on generation complete (APPROVE path):**
- Each capability (IMAGE / VIDEO / AUDIO) with a LOCKED MASTER asset inserts a `ProjectHandoff` row: `FromStageKey = IMAGE_GENERATION / VIDEO_GENERATION / AUDIO_GENERATION → ToStageKey = EDITING_QA` with `Status = READY` and `PayloadJson = { masterAssetId, scenePackageVersionId, characterBibleVersionId, generationRunVersion }`.
- `completeGenerationStage` additionally inserts immutable `ProjectVersions: GENERATION_PACKAGE` and `MASTER_VIEWING_COPY` with approved master references, then logs `GENERATION_RUN_COMPLETED` into `ProjectActivities`. The next Module 10 (Editing & QA) consumes these exact handoffs for timeline assembly, fix-list generation, and final master lock.
