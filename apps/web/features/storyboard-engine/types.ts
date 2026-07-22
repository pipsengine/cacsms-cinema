/**
 * Storyboard Engine domain types.
 * Shaped for future API integration — replace presentation fixtures with live payloads.
 */

export type AutonomyControlState =
  | 'NOT_STARTED'
  | 'RUNNING'
  | 'PAUSED'
  | 'STOPPED'
  | 'EMERGENCY_STOPPED'
  | 'UNAVAILABLE';

export type ShotStatus =
  | 'QUEUED'
  | 'PLANNING'
  | 'READY'
  | 'GENERATING'
  | 'EVALUATING'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'BLOCKED'
  | 'FAILED';

export type ContinuitySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ContinuityIssueStatus = 'OPEN' | 'RESOLVED' | 'WAIVED';
export type ExceptionStatus = 'OPEN' | 'IN_REVIEW' | 'ESCALATED' | 'RESOLVED';
export type AssetVersionStatus = 'DRAFT' | 'CANDIDATE' | 'APPROVED' | 'SUPERSEDED';

export type WorkspaceTabId =
  | 'board'
  | 'continuity'
  | 'cinematography'
  | 'assets'
  | 'exceptions'
  | 'history';

/** Distinguishes design fixtures from live API-backed data. */
export type DataProvenance = 'presentation' | 'live' | 'empty';

export interface StoryboardSummary {
  storyboardId: string | null;
  title: string;
  scriptTitle: string | null;
  sceneCount: number | null;
  shotCount: number | null;
  approvedShots: number | null;
  openContinuityIssues: number | null;
  openExceptions: number | null;
  assetVersions: number | null;
  videoReadyShots: number | null;
}

export interface AutonomySnapshot {
  state: AutonomyControlState;
  currentStage: string | null;
  correlationId: string | null;
  updatedAt: string | null;
  /** Human-readable reason when controls cannot execute (no backend). */
  unavailableReason: string | null;
}

export interface PipelineStage {
  id: string;
  label: string;
  /** Persisted stage status once APIs exist. */
  status: 'pending' | 'active' | 'complete' | 'blocked' | 'skipped';
}

export interface StoryboardShot {
  id: string;
  sequence: number;
  shotCode: string;
  sceneRef: string;
  title: string;
  description: string;
  camera: string;
  lens: string;
  movement: string;
  durationSec: number;
  status: ShotStatus;
  continuityLock: boolean;
  hasApprovedAsset: boolean;
  /** Presentation-only placeholder label — never a remote image URL. */
  frameLabel: string;
}

export interface ContinuityIssue {
  id: string;
  shotId: string | null;
  code: string;
  severity: ContinuitySeverity;
  status: ContinuityIssueStatus;
  description: string;
  recommendedAction: string;
}

export interface StoryboardException {
  id: string;
  shotId: string | null;
  code: string;
  status: ExceptionStatus;
  title: string;
  detail: string;
  raisedAt: string;
}

export interface AssetVersionRecord {
  id: string;
  shotId: string;
  version: number;
  status: AssetVersionStatus;
  sha256Preview: string;
  mimeType: string;
  width: number;
  height: number;
  createdAt: string;
  videoReady: boolean;
}

export interface HistoryEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
}

export interface StoryboardWorkspaceModel {
  provenance: DataProvenance;
  summary: StoryboardSummary;
  autonomy: AutonomySnapshot;
  pipeline: PipelineStage[];
  shots: StoryboardShot[];
  continuityIssues: ContinuityIssue[];
  exceptions: StoryboardException[];
  assets: AssetVersionRecord[];
  history: HistoryEvent[];
  cinematographyNotes: string[];
}
