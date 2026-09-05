# Module 08 — Character, Scene & Storyboard Studio

Turns an approved Script Package into a locked Character Bible (identity, appearance, wardrobe states), a scene matrix (shot, lens, camera, lighting, image/animation prompts, SFX and music cues), a keyframe storyboard, a continuity audit across scenes, and a versioned review/approval that hands off to downstream `IMAGE_GENERATION` and `VIDEO_GENERATION` stages.

## Database

**Migration:** `packages/database/sql/migrations/010_module08_character_scene_storyboard.sql`

Twelve `IF OBJECT_ID IS NULL` tables with FKs, `UNIQUE` constraints, `PERSISTED DurationSeconds`, and covering indexes:

| Table | Purpose |
|---|---|
| `CharacterBibles` | Head per `ContentProjectId UNIQUE`. `ApprovedScriptVersionId FK ScriptVersions NOT NULL`. `Status CK in DRAFT / IN_PROGRESS / IN_REVIEW / APPROVED / RETURNED / LOCKED`. `CurrentVersionNumber INT`. `CreatedBy / ApprovedBy FK Users`. |
| `Characters` | Personas per bible. `CharacterBibleId FK`. `CharacterCode UNIQUE ≤ 30` (per bible). 11 descriptor columns (`CharacterName ≤ 150`, `CharacterRole ≤ 100`, `AgeRange`, `Gender`, `Nationality`, `SkinTone`, `FaceDescription`, `HairDescription`, `BuildDescription`, `DefaultWardrobe`, `VoiceProfile`) plus `MasterPrompt` / `NegativePrompt` / `ReferenceAssetId FK ProjectAssets NULLABLE` / `SortOrder INT`. `IsLocked BIT DEFAULT 0`. |
| `CharacterWardrobeStates` | Immutable per-scene wardrobe tokens. `CharacterId FK`. `WardrobeCode UNIQUE ≤ 30` per character. `StateName ≤ 150`. `Description NVARCHAR(2000)`. `ContinuityNotes NVARCHAR(2000)`. `IsLocked BIT DEFAULT 1`. |
| `ProductionLocations` | Environment baselines. `ContentProjectId FK`. `LocationCode UNIQUE ≤ 30`. `Name ≤ 250`, `Geography ≤ 500`, `Type ≤ 100`, `MasterPrompt / NegativePrompt / LightingBaseline / VisualIdentity` all NVARCHAR(MAX). `IsLocked BIT DEFAULT 1`. |
| `ScenePackages` | Head per project. `ContentProjectId UNIQUE`, `ApprovedScriptVersionId FK`, `CharacterBibleId FK`. `Status CK`. `TotalScenes INT`, `TotalDurationSeconds INT`, `ContinuityScore DECIMAL(5,2)`. `CurrentVersionNumber INT`. `CreatedBy / ApprovedBy`. |
| `Scenes` | Ordered matrix. `ScenePackageId FK`. `SceneNumber INT UNIQUE (per package)`. `DurationSeconds AS (EndSecond - StartSecond) PERSISTED NOT NULL`. `SceneCode ≤ 30`, `Title ≤ 250`, `Chapter ≤ 200`. `ScriptSectionId FK ScriptSections NULLABLE`. 22 generation columns: `Dialogue`, `Voiceover`, `VisualDescription`, `ShotType`, `CameraMovement`, `Lens`, `Framing`, `Lighting`, `Mood`, `ImagePrompt`, `NegativePrompt`, `AnimationPrompt`, `SfxCue`, `MusicCue`, `TransitionIn`, `TransitionOut`, `GenerationStatus CK DRAFT / IN_PROGRESS / COMPLETED / FAILED`, `ApprovalStatus CK DRAFT / NEEDS_REVIEW / APPROVED / RETURNED`. |
| `SceneCharacters` | Join (Scene, Character, WardrobeState). PK `(SceneId, CharacterId)`. `ScreenPosition ≤ 100`, `ActionDirection NVARCHAR(1000)`, `Emotion NVARCHAR(250)`, `ContinuityNotes NVARCHAR(1500)`. |
| `StoryboardFrames` | Keyframes. `SceneId FK`. `FrameOrder INT`; `UNIQUE (SceneId, FrameOrder)`. `FrameType CK KEYFRAME / INBETWEEN / ESTABLISHING / CLOSEUP` DEFAULT KEYFRAME. `Status CK DRAFT / APPROVED / DISCARDED`. `Caption NVARCHAR(1000)`. `ReferenceAssetId FK NULLABLE`. |
| `ContinuityChecks` | Audit results per scene package. `ScenePackageId FK`. `CheckType CK WARDROBE / LOCATION / TIMELINE / CHARACTER / DIALOGUE / LIGHTING / PROP`. `Severity CK HIGH / MEDIUM / LOW`. `Status CK OPEN / IN_REVIEW / RESOLVED / IGNORED DEFAULT OPEN`. `SceneId FK NULLABLE`. `Finding / Recommendation / ResolvedNotes NVARCHAR(MAX)`. `ResolvedBy FK Users NULLABLE`. |
| `ScenePackageVersions` | Snapshot per submit. `UNIQUE (ScenePackageId, VersionNumber)`. `Status CK DRAFT / IN_REVIEW / APPROVED / RETURNED`. `SnapshotJson NVARCHAR(MAX)`. `ChangeSummary ≤ 2000`. `CreatedBy / ReviewedBy FK Users`. |
| `CharacterBibleVersions` | Mirror for character bibles. `UNIQUE (CharacterBibleId, VersionNumber)`. Same Status / Snapshot / ChangeSummary / Created/Reviewed columns. |
| `ProjectHandoffs` (existing extended) | APPROVE inserts `FromStageKey = 'SCENE_MATRIX'` to `ToStageKey IN ('IMAGE_GENERATION','VIDEO_GENERATION')` with `OutputType = 'Approved Scene Production Package'`. |

Covering indexes: `IX_Scenes_Package (ScenePackageId, SceneNumber, SceneCode) INCLUDE (DurationSeconds, ApprovalStatus, GenerationStatus)`. `IX_ContinuityChecks_Package (ScenePackageId, Status, Severity) INCLUDE (CheckType, SceneId)`.

**Bootstrap demo data:** `packages/database/src/bootstrap-module08.ts`

Requires Module 01 workspace `Slug = 'cacsms-cinema'` and a Module 07 APPROVED Script for `ContentProject.Code = 'CAC-2026-000124'` ("Hidden AI"). If `ScriptDocuments.ApprovedVersionId` is missing, the bootstrap promotes the latest APPROVED `ScriptVersions` row and flips `StageKey = 'SCRIPT'` to COMPLETED first so the precondition holds. Populates:

- 2 `Characters` — CHR-001 **Amara Okafor** (locked, 3 wardrobe states) / CHR-002 **Tunde Bello** (locked)
- 3 `CharacterWardrobeStates` — WRD-A1 Amara Morning, WRD-A2 Amara Office, WRD-T1 Tunde Trading-Floor
- 3 `ProductionLocations` — LOC-001 Amara Apartment · LOC-002 Lagos Office · LOC-003 City Commute
- 5 `Scenes` — SC-001..SC-005 with `StartSecond/EndSecond`, matrix columns pre-filled, `ApprovalStatus` APPROVED / NEEDS_REVIEW mix
- 4 `ContinuityChecks` — WARDROBE MEDIUM OPEN / LOCATION LOW RESOLVED / TIMELINE MEDIUM OPEN / CHARACTER HIGH RESOLVED
- 2 versions — CharacterBible v1 APPROVED, ScenePackage v1 IN_REVIEW
- Stage progression — `CHARACTER_BIBLE COMPLETED 100%`, `SCENE_MATRIX AWAITING_APPROVAL 92%`

Run with: `pnpm --filter @cacsms/database db:bootstrap-module08`

Package script added at `packages/database/package.json`:
- `"db:bootstrap-module08": "tsx src/bootstrap-module08.ts"` (between module07 and `clear-demo`)

## API endpoints (apps/api/src/server.ts — version 0.8.0)

8 Module 08 endpoints. Request bodies are Zod-parsed. Write and submit/decide operations use MSSQL transactions. Multi-recordset reads cast `(r.recordsets as any)` for strict-TypeScript compatibility, and `server.ts` declares the error-handler signature as `(err:any, req, reply) => …` to satisfy Fastify 5 strict types.

| Method | Path | Contract |
|---|---|---|
| GET | `/api/scene-planning-projects` | Workspace-scoped list of projects where Script is APPROVED. KPI join: `ScriptVersionId`, `CharacterBibleStatus`, `ScenePackageStatus`, `TotalScenes`, `TotalDurationSeconds`, `ContinuityScore`. Order by `UpdatedAt DESC`. |
| GET | `/api/projects/:projectId/production-planning` | One round-trip with 6 recordsets after the head: `characters` (with wardrobe-state count), `locations`, `scenes` (join `ProductionLocations`), `continuity` (HIGH first), `character versions`, `scene package versions`. Returns `{project, characterBible, scenePackage, characters, locations, scenes, continuity, characterVersions, sceneVersions}`. **409 `"Approved Script Package is required"`** if no approved upstream script. |
| POST | `/api/projects/:projectId/production-planning/start` | Idempotent starter. Inserts base `CharacterBibles` + `ScenePackages` rows if absent. Flips `CHARACTER_BIBLE` and `SCENE_MATRIX` stages to `IN_PROGRESS 10%`. Returns the full get-production-planning shape. |
| POST | `/api/projects/:projectId/production-planning/characters` | Save character. Body: `{characterCode, characterName, characterRole?, ageRange?, gender?, nationality?, skinTone?, faceDescription?, hairDescription?, buildDescription?, defaultWardrobe?, voiceProfile?, masterPrompt?, negativePrompt?}`. MERGE BY `(CharacterBibleId, CharacterCode)`. Auto-starts production-planning if CB missing. Audit `CHARACTER_SAVED`. |
| POST | `/api/projects/:projectId/production-planning/scenes` | Save scene. Body `{sceneNumber, sceneCode, title, chapter?, startSecond, endSecond, dialogue?, voiceover?, visualDescription?, shotType?, cameraMovement?, lens?, lighting?, mood?, imagePrompt?, negativePrompt?, animationPrompt?, sfxCue?, musicCue?, transitionIn?, transitionOut?}`. Zod refine `endSecond > startSecond`. MERGE BY `(ScenePackageId, SceneNumber)`. After save, recomputes `ScenePackages.TotalScenes = COUNT(Scenes)` and `TotalDurationSeconds = SUM(DurationSeconds PERSISTED)`. Audit `SCENE_SAVED`. |
| POST | `/api/projects/:projectId/production-planning/submit` | Submit for review. **Hard gates**: (a) every character `IsLocked = 1`, (b) `scenes.length >= 1`, (c) **zero unresolved HIGH-severity** continuity checks. On success: bumps `CB.CurrentVersionNumber` + `SP.CurrentVersionNumber`, inserts `CharacterBibleVersions.Status = IN_REVIEW` and `ScenePackageVersions.Status = IN_REVIEW` with Snapshot JSON, flips stages to `AWAITING_APPROVAL 92%`. Audit `PRODUCTION_PLANNING_SUBMITTED`. |
| POST | `/api/projects/:projectId/production-planning/decision` | Decision `{decision: 'APPROVE' \| 'RETURN', comment? ≤ 5000}`. Audit key `PRODUCTION_PLANNING_APPROVE / PRODUCTION_PLANNING_RETURN`. RETURN: sets CB/SP `Status = RETURNED`, stages `IN_PROGRESS 75%`. APPROVE transaction: flips both versions `APPROVED` (with ReviewedBy/ReviewedAt) → writes `ProjectVersions` for both `CHARACTER_BIBLE` and `SCENE_PACKAGE` → inserts two `ProjectHandoff` rows `('SCENE_MATRIX' -> 'IMAGE_GENERATION', status READY)` + `('SCENE_MATRIX' -> 'VIDEO_GENERATION', status READY)` → inserts `ProjectActivities.ActivityType = 'PRODUCTION_BLUEPRINT_APPROVED'`. |
| GET | `/health` | Service `cacsms-cinema-api`, `version: '0.8.0'`, `module01..module08 = 'ready'`. |

Smoke test: `pnpm --filter @cacsms/api test` prints Module 01..08 contract lines.

## Web routes

AppShell PRODUCTION PIPELINE group: 5th live slot is **Scene & Storyboard** (icon `▦`) at `/scenes`. Sidebar footer chip: `Module 08 · Scene & Storyboard`. Eyebrow default `CACSMS CINEMA`; brand title + workspace mini + breadcrumbs all singular.

| Route | Page | Purpose |
|---|---|---|
| `/scenes` | `apps/web/src/app/(app)/scenes/page.tsx` | Scene & Storyboard Register. 5 KPI tiles (Active productions · Locked characters · Scene readiness X/Y · Continuity issues · Total scene seconds). 9-column register grid: Project · Title & Context · Script · Character Bible · Scenes · Continuity · Storyboard · Status · Open. Governance chain under grid: Approved Script → Locked Character Bible + Scene Package → AI Generation Studio. |
| `/projects/[id]/production/characters` | `apps/web/src/app/(app)/projects/[id]/production/characters/page.tsx` | Character Bible. 5-tab pill nav (`scene-tabs`): Character Bible · Scene Matrix · Storyboard · Continuity · Versions. 2-col `character-grid` card with 140 px initial portrait placeholder + 8-spec `spec-grid` (age/gender/nationality/skin/hair/build/wardrobe/voice) + `MASTER CHARACTER PROMPT` (blue outline) and `NEGATIVE / CONTINUITY PROMPT` (danger-red outline) locked textareas. Wardrobe-state table below (Character · Code · State · Locked appearance · Status). Actions: ＋ Add character · Lock & submit bible. |
| `/projects/[id]/production/scenes` | `apps/web/src/app/(app)/projects/[id]/production/scenes/page.tsx` | Scene Matrix editor. `scene-workspace` 280/1fr split. Left `scene-list workspace-card`: 5 scene buttons (SC-001..SC-005) with numeric scene-no, status pill, and `active` blue highlight via `useState`. Right `scene-detail`: `scene-meta` card with timecode/duration/characters/location and shot/camera/lens/lighting 4-column `meta-row`; plus matrix-fields (DIALOGUE / VOICEOVER / VISUAL DESCRIPTION + blue `IMAGE GENERATION PROMPT` + red `NEGATIVE PROMPT` + purple `VIDEO/ANIMATION PROMPT` wide labels, then SFX/MUSIC/TRANSITION OUT). Locked-production-locations register at foot. |
| `/projects/[id]/production/storyboard` | `apps/web/src/app/(app)/projects/[id]/production/storyboard/page.tsx` | Storyboard overview. `storyboard-grid` 2-col cards per scene. Each card: `story-image` gradient keyframe placeholder with scene-code/shot-type chips; `story-info` header with Scene Title, Chapter, Timecode, Duration, Status pill; visual paragraph; `story-footer` with frame count, shot/lens summary, Open frames → CTA. Ready counter chip in header (APPROVED/total). |
| `/projects/[id]/production/continuity` | `apps/web/src/app/(app)/projects/[id]/production/continuity/page.tsx` | Continuity manager. 5 KPIs (identity locks, location locks, continuity score, blocking-open, total). `continuity-layout` 1/300 split. Main: per-check card with ⟁ icon, HIGH/MEDIUM/LOW severity-chip (red/amber/green), OPEN/RESOLVED status, plus "blocking" inset red highlight for unresolved HIGH. Aside: Summary 4-tile (avg / HIGH open / resolved / MED open) and GENERATION GATE handoff card with green GATE OPEN / red GATE CLOSED pill. |
| `/projects/[id]/production/versions` | `apps/web/src/app/(app)/projects/[id]/production/versions/page.tsx` | Versions & Governance. Two 2-col cards: Character Bible versions (v1 APPROVED — 2 locked, CHR-001/002, Today 06:47, Identity & wardrobe locks accepted) · Scene Package versions (v1 IN REVIEW — 5 scenes 16 frames, Today 07:05, Awaiting continuity). Governance chain below: `Approved Script v2 → Character Bible v1 + Scene Package v1 → AI Generation Studio` with module labels and frozen-version IDs. |

Shared additions:
- `apps/web/src/components/app-shell.tsx` — Fifth PRODUCTION PIPELINE slot `{label:'Scene & Storyboard', href:'/scenes', icon:'▦'}` (no longer `future:true`). Sidebar chip `<small>Module 08 · Scene & Storyboard</small>`.
- `apps/web/src/lib/module08-data.ts` — static demo fallback for `NEXT_PUBLIC_DEMO_MODE=true`. Exports: `sceneProject` (id `…1124`, `CAC-2026-000124`, Hidden AI, v2 IN_PROGRESS), `characters[2]`, `wardrobes[3]`, `locations[3]`, `scenes[5]` with character arrays for chip rendering, `continuity[4]` (2 open, 1 HIGH resolved), `storyboard[5]` (frame counts 3/3/4/3/3 + statuses APPROVED/IN_REVIEW).
- `apps/web/src/styles/globals.css` — appended **Module 08** classes after Module 07 `@media` block. Grouped under comment `/* Module 08 — Character, Scene & Storyboard Studio */`: `.scene-kpis` (5-col, blue/purple/green/amber/red), `.scene-register` + `.scene-table-head/row` (9-col grid 1.1/1.8/1/.8/.6/.7/.7/.8/.7), `.scene-tabs` pill nav + `.active #eef4ff`, `.character-grid` / `.character-card` / `.character-portrait` / `.character-body` / `.spec-grid / .four-col / .span-2`, `.prompt-block` / `.prompt-block.danger`, `.scene-workspace` 280/1fr `sticky top:88px`, `.scene-list-head / button.active`, `.scene-no`, `.scene-meta / .meta-row`, `.matrix-fields / label.wide / .prompt-blue / .prompt-purple / .prompt-red`, `.storyboard-grid / .story-card / .story-image / .story-info / .story-footer`, `.continuity-layout / .continuity-main / .continuity-aside / .continuity-check.blocking / .continuity-icon / .severity-chip HIGH|MEDIUM|LOW`, `.governance-chain / .chain-row` + `<i>` arrow rotated 90° at ≤820 px. Reflow breakpoints at `@media(max-width: 1100px)` → single-col layouts; `820px` → scene-kpis 3-col, meta-row 2-col; `520px` → kpis 1-col, scene-list full-width.

## Inventory & pipeline position

| Component | Count / demo seed |
|---|---|
| SQL tables | 12 (CharacterBibles · Characters · CharacterWardrobeStates · ProductionLocations · ScenePackages · Scenes · SceneCharacters · StoryboardFrames · ContinuityChecks · ScenePackageVersions · CharacterBibleVersions · ProjectHandoffs extended) |
| API endpoints | 8 (register · production-planning GET · start · character save · scene save · submit · decide · /health v0.8.0) |
| Next.js pages | 6 (scenes register · characters · scene matrix · storyboard · continuity · versions) |
| Demo characters | 2 (CHR-001 Amara Okafor LOCKED · CHR-002 Tunde Bello LOCKED) + 3 wardrobe states |
| Demo locations | 3 (Amara Apartment · Lagos Office · City Commute) all LOCKED |
| Demo scenes | 5 (SC-001..SC-005) — 125 seconds / 02:05 · APPROVED + NEEDS_REVIEW mix |
| Demo continuity | 4 checks (WARDROBE MED OPEN · LOCATION LOW RESOLVED · TIMELINE MED OPEN · CHARACTER HIGH RESOLVED) |
| Demo storyboard | 16 frames across 5 scenes (frames: 3/3/4/3/3) |
| Demo versions | Character Bible v1 APPROVED · Scene Package v1 IN REVIEW |
| Workflow stages on bootstrap | CHARACTER_BIBLE = COMPLETED 100% · SCENE_MATRIX = AWAITING_APPROVAL 92% |

**Upstream prerequisites (enforced at API + bootstrap level):** Approved Script v2 from Module 07 for project `CAC-2026-000124`. Bootstrap-module08 auto-promotes `ScriptDocuments.ApprovedVersionId` if the latest version is APPROVED but no explicit link exists yet.

**Downstream handoffs on APPROVE:** `WorkflowStage IMAGE_GENERATION = READY` and `WorkflowStage VIDEO_GENERATION = READY` handoff rows are inserted by the decide transaction, both with `OutputReference = ScenePackageVersionId` and a compound payload JSON that binds the approved `CharacterBibleVersionId` and `ScenePackageVersionId` together so generation stages can rebuild the exact locked assets. Future Module 09 / 10 consume these handoffs.
