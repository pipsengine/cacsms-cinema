/**
 * Video Assembly / Image-to-Video Readiness types.
 * Shaped for future API integration — replace presentation fixtures with live payloads.
 */

export type AutonomyControlState =
  | 'NOT_STARTED'
  | 'RUNNING'
  | 'PAUSED'
  | 'STOPPED'
  | 'EMERGENCY_STOPPED'
  | 'UNAVAILABLE';

export type ReadinessStatus =
  | 'NOT_EVALUATED'
  | 'READY'
  | 'BLOCKED'
  | 'STALE'
  | 'NEEDS_REVIEW'
  | 'FAILED';

export type FrameEventType =
  | 'STORYBOARD_FRAME_UPDATED'
  | 'ASSET_VERSION_LOCKED'
  | 'READINESS_REEVALUATED'
  | 'HANDOFF_QUEUED'
  | 'GENERATOR_EXCEPTION';

export type ExceptionStatus = 'OPEN' | 'IN_REVIEW' | 'ESCALATED' | 'RESOLVED';
export type GeneratorStatus = 'IDLE' | 'QUEUED' | 'RUNNING' | 'FAILED' | 'COMPLETED' | 'UNAVAILABLE';
export type TimelineClipKind = 'still' | 'hold' | 'transition';

export type WorkspaceTabId =
  | 'timeline'
  | 'readiness'
  | 'assets'
  | 'events'
  | 'generators'
  | 'exceptions'
  | 'history';

export type DataProvenance = 'presentation' | 'live' | 'empty';

export interface VideoSummary {
  sequenceId: string | null;
  title: string;
  storyboardTitle: string | null;
  totalClips: number | null;
  readyClips: number | null;
  blockedClips: number | null;
  staleFrames: number | null;
  openExceptions: number | null;
  estimatedDurationSec: number | null;
}

export interface AutonomySnapshot {
  state: AutonomyControlState;
  currentStage: string | null;
  correlationId: string | null;
  updatedAt: string | null;
  unavailableReason: string | null;
}

export interface PipelineStage {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete' | 'blocked' | 'skipped';
}

export interface TimelineClip {
  id: string;
  order: number;
  shotCode: string;
  sceneRef: string;
  title: string;
  kind: TimelineClipKind;
  durationSec: number;
  readiness: ReadinessStatus;
  assetVersionId: string | null;
  assetShaPreview: string | null;
  continuitySafe: boolean;
  videoReady: boolean;
  notes: string;
}

export interface ReadinessCheck {
  id: string;
  clipId: string;
  code: string;
  passed: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detail: string;
}

export interface LockedAssetRef {
  id: string;
  clipId: string;
  assetVersionId: string;
  sha256Preview: string;
  mimeType: string;
  width: number;
  height: number;
  permanent: boolean;
  videoReady: boolean;
  lockedAt: string;
}

export interface FrameUpdateEvent {
  id: string;
  at: string;
  type: FrameEventType;
  shotCode: string;
  detail: string;
  correlationId: string | null;
}

export interface SceneVideoGenerator {
  id: string;
  name: string;
  status: GeneratorStatus;
  contract: string;
  lastMessage: string;
}

export interface VideoException {
  id: string;
  clipId: string | null;
  code: string;
  status: ExceptionStatus;
  title: string;
  detail: string;
  raisedAt: string;
}

export interface HistoryEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
}

export interface VideoAssemblyWorkspaceModel {
  provenance: DataProvenance;
  summary: VideoSummary;
  autonomy: AutonomySnapshot;
  pipeline: PipelineStage[];
  clips: TimelineClip[];
  readinessChecks: ReadinessCheck[];
  assets: LockedAssetRef[];
  frameEvents: FrameUpdateEvent[];
  generators: SceneVideoGenerator[];
  exceptions: VideoException[];
  history: HistoryEvent[];
}
