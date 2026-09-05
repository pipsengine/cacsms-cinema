# Module 10 — Assembly, Editing & Quality Control

Consumes the upstream Approved AI Generation Package (Module 09) and delivers timeline assembly, edit instruction tracking, automated plus human-evidence QA, master video versioning and review-to-approval governance with handoffs to downstream Packaging (Module 11). Every timeline item links to a `GeneratedAssetId` + `SceneId`; every QA check carries severity/blocking flags and evidence; every master version records immutable review decisions with downstream PACKAGING-ready handoffs on approval.

## Database

**Migration:** `packages/database/sql/migrations/012_module10_editing_quality_control.sql` (source `011_module10_editing_quality_control.sql` renumbered because target migration 011 already holds Module 09).

Seven `IF OBJECT_ID IS NULL` tables wrapped in `SET XACT_ABORT ON · BEGIN TRANSACTION … COMMIT`, plus two covering indexes.

| Table | Purpose |
|---|---|
| `EditProjects` | Head per content project. `WorkspaceId · ContentProjectId UNIQUE FK`. `GenerationPackageVersionId FK` (upstream M09 contract). `Status ∈ {NOT_STARTED, IN_PROGRESS, IN_REVIEW, COMPLETED}`. `TargetDurationSeconds · CurrentDurationSeconds`. Default tech specs: `Resolution = '3840x2160'`, `FrameRate = 24`, `AspectRatio = '16:9'`, `AudioSampleRate = 48000`. `ProgressPercent DECIMAL(5,2) 0→100`. `ApprovedMasterVersionId FK → MasterVideoVersions`. Created/UpdatedAt. |
| `EditTimelines` | Per-project versioned sequences. `EditProjectId FK`. `VersionNumber INT DEFAULT 1`. `Status ∈ {DRAFT, IN_REVIEW, APPROVED, LOCKED}`. `DurationSeconds`. `SettingsJson NVARCHAR(MAX)` (resolution/fps/sample-rate/color-space/loudness-profile). `CreatedBy FK Users`. Created/UpdatedAt. |
| `EditTimelineItems` | Every clip on the sequence. `TimelineId FK`. `SceneId NULLABLE FK Scenes`. `GeneratedAssetId NULLABLE FK → GeneratedAssets(M09)`. `TrackType ∈ {VIDEO, AUDIO, VOICE, SFX, CAPTION, GRAPHICS}`. `TrackNumber INT`. `SequenceOrder INT`. `StartSeconds / EndSeconds DECIMAL(10,3)`. `SourceIn / SourceOut` same type. `TransitionIn / TransitionOut NVARCHAR(120)`. `VolumeDb DECIMAL(5,2)`. `SpeedPercent INT DEFAULT 100`. `SettingsJson NVARCHAR(MAX)`. CreatedAt. |
| `EditInstructions` | Human + agent edit decision list (EDL). `EditProjectId FK`. `SceneId NULLABLE FK`. `TimecodeSeconds NULLABLE`. `InstructionType ∈ {PICTURE, AUDIO, CAPTION, GRAPHICS, TRANSITION, COLOR, OTHER}`. `InstructionText NVARCHAR(MAX)`. `OwnerType NVARCHAR(60)`. `Status ∈ {OPEN, IN_PROGRESS, COMPLETED, RESOLVED}`. `Priority ∈ {LOW, MEDIUM, HIGH, URGENT}`. `ResolvedAt · ResolvedBy FK`. CreatedAt. |
| `QAChecks` | Automated runs + human review. `EditProjectId FK`. `CheckKey NVARCHAR(100) UNIQUE(per project)`: `ASSET_COMPLETENESS · DURATION_TOLERANCE · CAPTION_TIMING · CONTINUITY_LOCK · AUDIO_LOUDNESS · MASTER_FORMAT · FACT_LINEAGE · COPYRIGHT_METADATA`. `Category ∈ {Completeness, Duration, Captions, Continuity, Audio, Format, Facts, Copyright}`. `CheckName NVARCHAR(200)`. `Severity ∈ {BLOCKING, HIGH, MEDIUM, LOW}`. `Status ∈ {NOT_RUN, IN_PROGRESS, PASSED, FAILED, NEEDS_REVIEW}`. `Evidence NVARCHAR(MAX)`. `IsBlocking BIT DEFAULT 0`. `Automated BIT DEFAULT 1`. `ResolvedBy/At FK`. Created/UpdatedAt. |
| `MasterVideoVersions` | Immutable master packages. `WorkspaceId · ContentProjectId · EditProjectId FK`. `TimelineId FK`. `VersionNumber INT UNIQUE(per-editproject)`. `Status ∈ {DRAFT, IN_REVIEW, APPROVED, RETURNED, LOCKED}`. `StorageUri · ReviewUri NVARCHAR(1000)`. `DurationSeconds · Resolution · Fps · MimeType · FileSizeBytes BIGINT`. `QASummaryJson NVARCHAR(MAX)` (checks snapshot). `ChangeSummary NVARCHAR(2000)`. Created/Reviewed/Approved By/At FK Users. |
| `MasterVideoReviews` | Decision log per version. `MasterVideoVersionId FK`. `Decision ∈ {APPROVE, RETURN, LOCK}`. `Comment NVARCHAR(3000)`. `DecidedBy · DecidedAt FK Users`. |

Indexes:
- `IX_EditTimelineItems_TimelineTrack (TimelineId, TrackType, TrackNumber, SequenceOrder)`
- `IX_QAChecks_EditProjectStatus (EditProjectId, Status, Severity)`

**Bootstrap demo data:** `packages/database/src/bootstrap-module10.ts`

Requires Module 01 workspace `Slug = 'cacsms-cinema'` and Module 09 `GenerationJobs` rows (COMPLETED `VIDEO_GENERATION`). If missing, bootstrap throws: `"Run Module09 bootstrap first."`. Uses the shared cross-module project id `11111111-1111-1111-1111-111111111124` / code `CAC-2026-000124`.

Creates:
- 1 `EditProjects` row: `Status IN_PROGRESS · ProgressPercent 72`. Target 525s vs Current 519s. Resolution 4K, fps 24, Aspect 16:9, Sample 48kHz.
- 1 `EditTimelines` row: `VersionNumber 2 · Status IN_REVIEW · Duration 519s · SettingsJson {res 3840x2160, fps 24, audio 48000}`.
- 8 `QAChecks` rows: 5 PASSED (completeness, duration, continuity, audio, format, facts). 1 FAILED QA-003 CAPTIONS — SC-003 subtitles lead VO by ~180 ms. 1 NEEDS_REVIEW QA-008 COPYRIGHT — one SFX asset requires licence metadata (IsBlocking 1 BLOCKING).
- 2 `MasterVideoVersions`: v1 RETURNED 527s "Initial assembly returned for caption pacing changes + audio balance". v2 IN_REVIEW 519s "Pacing revised, audio balanced, two QA items remain open".
- 1 `MasterVideoReviews` row (RETURN decision by PipsEngine for v1).
- StageExecutions: `EDIT_ASSEMBLY 72% IN_PROGRESS` + `QUALITY_ASSURANCE 75% IN_PROGRESS` StartedAt populated.
- Handoffs: M09 VIDEO_GENERATION → EDIT_ASSEMBLY READY row upserted; `EDIT_ASSEMBLY → PACKAGING PENDING` rows inserted with PayloadJson pending master APPROVE decision.

Run with: `pnpm --filter @cacsms/database db:bootstrap-module10`

Package script added at [package.json](file:///c:/Trading-Engine/cacsms-cinema/packages/database/package.json#L34):
- `"db:bootstrap-module10": "tsx src/bootstrap-module10.ts"` (between module09 and `clear-demo`)

## API endpoints (apps/api/src/server.ts — version 0.10.0)

Six Module 10 endpoints. `/health` now reports `version: '0.10.0'`, `service: 'cacsms-cinema-api'`, `module01..module10 = 'ready'`. `setErrorHandler` signature uses `(err:any, req, reply) => …` for Fastify 5 strict-types. Multi-recordset MSSQL queries cast `(r.recordsets as any)` before `rs[n]` indexing to satisfy IResult strict tuple TS7053.

| Method | Path | Contract |
|---|---|---|
| GET | `/api/editing-projects` | Workspace-scoped list with KPIs: EditProgress%, QA pass/exception counts, Master versions IN_REVIEW, Open Instructions count, Estimated handoff timeline. Orders by `UpdatedAt DESC`. |
| GET | `/api/projects/:projectId/editing` | One round trip 10x recordsets: `{editProject, timeline, timelineItems, instructions, qaChecks, masterVersions, masterReviews, upstreamHandoffs, stageExecutions, generatedAssets}`. Returns 404 if EditProject missing. |
| PATCH | `/api/editing/qa/:checkId` | Update QA check. Body: `{status ∈ {PASSED, FAILED, NEEDS_REVIEW}, evidence?, resolvedBy?}`. Updates QAChecks row; when FAILED/PASSED toggles `ResolvedAt`; writes `EDITING_QA_UPDATED` audit. |
| POST | `/api/projects/:projectId/editing/master-decision` | Decision body: `{masterVersionId, decision ∈ {APPROVE, RETURN, LOCK}, comment ≤ 3000, decidedBy?}`. INSERT `MasterVideoReviews`; UPDATE master `Status/ReviewedBy/ReviewedAt`. On APPROVE: flip `EditProjects.ApprovedMasterVersionId` FK, set `Status = COMPLETED ProgressPercent = 100`, COMPLETE `QUALITY_ASSURANCE 100% StageExecutions`, and UPSERT 3 ProjectHandoffs READY rows: (EDIT_ASSEMBLY → PACKAGING) × {VIDEO_MASTER, AUDIO_MASTER, CAPTIONS_MASTER} with PayloadJson carrying `ApprovedMasterVersionId`. Audit `EDITING_MASTER_APPROVED / _RETURNED`. |
| POST | `/api/projects/:projectId/editing/timelines` | Save upsert. Body: `{versionNumber?, durationSeconds, settingsJson, createdBy?}`. Merge: timeline with same version (default next+1) or create v++ with settings. Writes `EDITING_TIMELINE_SAVED` audit. |
| POST | `/api/projects/:projectId/editing/instructions` | Add instruction EDL row. Body: `{sceneId?, timecodeSeconds?, instructionType ∈ {PICTURE, AUDIO, CAPTION, GRAPHICS, TRANSITION, COLOR, OTHER}, instructionText, priority ∈ {LOW, MEDIUM, HIGH, URGENT}, ownerType?}`. Status OPEN default. Audit `EDITING_INSTRUCTION_ADDED`. |
| POST | `/api/projects/:projectId/editing/master-versions` | Create new master row. Body: `{versionNumber?, timelineId?, status=DRAFT, storageUri, reviewUri?, durationSeconds, resolution, fps, mimeType, fileSizeBytes?, qaSummaryJson?, changeSummary, createdBy?}`. Increments VersionNumber auto per project if not provided. Audit `EDITING_MASTER_CREATED`. |
| GET | `/health` | Service `cacsms-cinema-api`, `version: '0.10.0'`, module01..module10 ready. |

Smoke test: `pnpm --filter @cacsms/api test` now prints 10 lines ending in:
`Module 10 API contracts: editing projects workspace, timelines save, instructions add, QA checks update, master versions/decide.`

## Web routes

AppShell PRODUCTION PIPELINE 7th live slot: **Editing & QA** (`◫`, href `/editing`). Sidebar chip: `Module 10 · Editing & QA`.

| Route | Page | Purpose |
|---|---|---|
| `/editing` | `apps/web/src/app/(app)/editing/page.tsx` | Editing & QA studio dashboard. Callout.info: governed input (Approved Generation Package v1), post-flow 5-stage pipeline (Generation masters → Timeline assembly → QA → Master approval → Packaging handoff). StatCards × 4: Timeline progress, Master duration, QA passed, Master versions count. Two-col: Scene assembly list-row (5 scenes SC-001..005, status LOCKED/IN_REVIEW/READY) + QA exceptions (FAILED captions, NEEDS_REVIEW copyright blocking). |
| `/projects/[id]/editing/timeline` | `apps/web/src/app/(app)/projects/[id]/editing/timeline/page.tsx` | Timeline assembly. `EditingTabs` active=timeline. Callout info (only-approved masters contract). editing-layout 2-col: workspace-card master sequence with time-ruler + 6 track-row strips (V1 Scene Masters, V2 Graphics, A1 VO, A2 Music, A3 SFX, C1 Captions) colorized Video/Audio/Caption styles, plus Sequence inspector panel (INPUT VERSION, MASTER FORMAT, FRAME RATE, AUDIO, CAPTIONS, SAFE AREAS context-list rows). Enterprise table: Scene / Time / Video / Voice / Music / Captions / Transition / Status 8× 8 scenes. |
| `/projects/[id]/editing/instructions` | `apps/web/src/app/(app)/projects/[id]/editing/instructions/page.tsx` | Edit Decision List (EDL). Three-col compact governance callouts: PICTURE / AUDIO / GRAPHICS. Enterprise table: ID / Scene+Time / Type / Instruction / Owner / Status. Interop callout with "Cacsms Cinema remains the source of truth" brand. |
| `/projects/[id]/editing/qa` | `apps/web/src/app/(app)/projects/[id]/editing/qa/page.tsx` | QA control register. StatCards × 4: Checks passed, Blocking failures, Needs review, Master readiness. Callout warning approval gate active. Enterprise QA table: ID / Category / Quality check / Severity pill (BLOCKING/HIGH red+amber) / Evidence / Status / Resolve actions. 6 PASS / 1 FAIL captions / 1 REVIEW copyright. |
| `/projects/[id]/editing/preview` | `apps/web/src/app/(app)/projects/[id]/editing/preview/page.tsx` | Master review player. preview-layout 2-col: master-monitor screen (linear-gradient dark, PLAY chip, scrub, transport buttons). Scene-marker-grid 4-col × 8 scenes button navigation. Context-list meta: STATUS / DURATION / VIDEO / AUDIO / CAPTIONS / QA / UPSTREAM / NEXT OUTPUT. |
| `/projects/[id]/editing/versions` | `apps/web/src/app/(app)/projects/[id]/editing/versions/page.tsx` | Governance & handoff. version-governance-grid: Left enterprise Master version register (Version / Status / Duration / Resolution / Created / Change summary) with v1 RETURNED + v2 IN_REVIEW. Right aside: HANDOFF CONTRACT governance-callout (MASTER_VIDEO → Packaging), Approval requirements 7× audit-checks list (✓/⚠/○ icons for caption/copyright/human approvals). |

New components:
- `apps/web/src/components/editing-tabs.tsx` — `EditingTabs({projectId, active})` renders a `className="module-tabs"` 5-link pill strip: Timeline / Edit Instructions / Quality Assurance / Master Preview / Versions. Matches active tab against `active` prop.

Shared additions:
- `apps/web/src/lib/module10-data.ts` — demo fallback for `NEXT_PUBLIC_DEMO_MODE=true`: `editProject{id, code, title, status=IN_PROGRESS, generationPackageVersion=1, progress=72, currentDuration/plannedDuration}`. `timelineScenes[8]` (SC-001..SC-008 scenes with start/end/duration, video/voice/music MASTER, caption READY/NEEDS_REVIEW, transition, status LOCKED/IN_REVIEW/READY). `tracks[6]` (V1 masters, V2 graphics, A1 dialogue, A2 music, A3 SFX, C1 captions — all items/status/level). `editNotes[4]` EDL entries: EDL-001 APPLIED PICTURE, EDL-014 OPEN CAPTION timing 180ms, EDL-021 APPLIED J-cut AUDIO, EDL-033 IN_PROGRESS GRAPHICS. `qaChecks[8]` — see API table above. `masterVersions[v1 RETURNED, v2 IN_REVIEW]`.
- `apps/web/src/styles/globals.css` — appended Module 10 classes after Module 09 media block: `.module-tabs` (pill nav, active `#175cd3` bottom border). `.post-flow` 5-step pipeline grid with `.done / .active` color states. `.editing-layout / .preview-layout / .time-ruler / .track-row / .track-strip / .track-strip.audio.caption colored spans`. `.three-col.compact governance-callout`. `.master-monitor .monitor-screen` dark video player + `.transport` control grid + `.scrub` progress. `.scene-marker-grid 4-col buttons`. `.version-governance-grid` + `.audit-checks`. Media breakpoints: 1050px editing/previews collapse single col, post-flow stacks with rotated arrows, 2-col scene markers. 1100px version grid collapses.

## Inventory & pipeline position

| Component | Count / demo seed |
|---|---|
| SQL tables | 7 (`EditProjects · EditTimelines · EditTimelineItems · EditInstructions · QAChecks · MasterVideoVersions · MasterVideoReviews`) + 2 covering indexes |
| API endpoints | 7 (editing projects list, workspace get, QA patch update, master decision approve/return/lock, timelines save upsert, instructions add, master-versions create) + `/health v0.10.0` |
| Next.js pages | 6 (`/editing` · `…/timeline` · `…/instructions` · `…/qa` · `…/preview` · `…/versions`) + 1 new component `editing-tabs` |
| Demo EditProjects | 1 project IN_PROGRESS 72% · 519s current · 4K · 24fps |
| Demo EditTimelines | 1 timeline v2 IN_REVIEW |
| Demo EditTimelineItems | 24 logical track items (6 tracks × 4–8 scenes across VIDEO/VOICE/MUSIC/SFX/CAPTIONS/GRAPHICS) |
| Demo EditInstructions | 4 × EDL rows: PICTURE · CAPTION open 180ms · AUDIO J-cut · GRAPHICS in-progress |
| Demo QAChecks | 8 checks total — 6 PASS · 1 FAIL captions (SC-003) · 1 NEEDS_REVIEW copyright BLOCKING 1 |
| Demo MasterVideoVersions | 2 masters — v1 RETURNED / v2 IN_REVIEW |
| Demo MasterVideoReviews | 1 RETURNED record with comment on caption pacing |
| StageExecutions on bootstrap | EDIT_ASSEMBLY 72% IN_PROGRESS · QUALITY_ASSURANCE 75% IN_PROGRESS |
| Handoffs seeded | Upstream M09 VIDEO_GENERATION → EDIT_ASSEMBLY READY; downstream EDIT_ASSEMBLY → PACKAGING PENDING triplet awaiting APPROVE |

**Upstream prerequisites** (enforced by bootstrap `EXISTS GenerationJobs` + repository `getEditingWorkspace` joins): Approved AI Generation Package (Module 09) with at least one COMPLETED GenerationJob. `EditProjects.GenerationPackageVersionId NOT NULL` FK is the contract anchor — only Approved assets registered via `GeneratedAssets.IsMaster=1` can be referenced on the EditTimeline.

**Downstream handoffs on master APPROVE (post-decision path):**
- 3 `ProjectHandoffs` rows READY upserted: `FromStageKey ∈ {EDIT_ASSEMBLY}` → `ToStageKey ∈ {PACKAGING}` for Payload `{masterAssetKind: VIDEO_MASTER / AUDIO_MASTER / CAPTIONS_MASTER, ApprovedMasterVersionId}`.
- `StageExecutions` updated: `QUALITY_ASSURANCE = COMPLETED 100%`, `EDIT_ASSEMBLY = COMPLETED 100%`, next `PACKAGING = IN_PROGRESS 0% StartedAt` is pre-seeded. Module 11 (Packaging: Thumbnail Studio + SEO & Metadata) will consume these READY handoffs and build delivery formats.
