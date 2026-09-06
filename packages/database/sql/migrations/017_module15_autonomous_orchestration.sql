-- Module 15 — Autonomous End-to-End Orchestration (idempotent)

IF OBJECT_ID(N'dbo.OrchestrationRuns', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.OrchestrationRuns (
    RunId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    WorkspaceId UNIQUEIDENTIFIER NOT NULL,
    ProjectId UNIQUEIDENTIFIER NOT NULL,
    WorkflowVersionNo INT NOT NULL DEFAULT 1,
    StageKey NVARCHAR(64) NOT NULL,
    AgentCapability NVARCHAR(80) NULL,
    TriggeredBy NVARCHAR(64) NOT NULL DEFAULT N'ORCHESTRATOR_v15',
    PayloadJson NVARCHAR(MAX) NULL,
    ResultJson NVARCHAR(MAX) NULL,
    Status NVARCHAR(32) NOT NULL DEFAULT N'QUEUED',
    AttemptNo INT NOT NULL DEFAULT 1,
    MaxRetries INT NOT NULL DEFAULT 3,
    NextPollAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    SlaDueAt DATETIME2 NULL,
    StartedAt DATETIME2 NULL,
    CompletedAt DATETIME2 NULL,
    ErrorMessage NVARCHAR(2000) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE UNIQUE INDEX UX_OrchestrationRuns_Idempotency
    ON dbo.OrchestrationRuns (WorkspaceId, ProjectId, StageKey, WorkflowVersionNo)
    INCLUDE (Status, AttemptNo, MaxRetries, NextPollAt, RunId)
    WHERE Status = N'SUCCESS';
END;

IF OBJECT_ID(N'dbo.OrchestrationRunEvents', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.OrchestrationRunEvents (
    RunEventId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    RunId UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.OrchestrationRuns(RunId) ON DELETE CASCADE,
    EventType NVARCHAR(32) NOT NULL,
    Severity NVARCHAR(16) NOT NULL DEFAULT N'INFO',
    DetailJson NVARCHAR(MAX) NULL,
    Actor NVARCHAR(64) NOT NULL DEFAULT N'ORCHESTRATOR_v15',
    EventAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID(N'dbo.OrchestratorHeartbeats', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.OrchestratorHeartbeats (
    WorkerId NVARCHAR(64) NOT NULL PRIMARY KEY,
    WorkspaceId UNIQUEIDENTIFIER NULL,
    StartedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    LastHeartbeat DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    PollCount BIGINT NOT NULL DEFAULT 0,
    ProcessId INT NULL,
    MachineName NVARCHAR(200) NULL,
    Status NVARCHAR(16) NOT NULL DEFAULT N'RUNNING',
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID(N'dbo.AgentCapabilityMap', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AgentCapabilityMap (
    AgentCapability NVARCHAR(80) NOT NULL PRIMARY KEY,
    RepositoryFunction NVARCHAR(120) NOT NULL,
    DefaultPayloadJson NVARCHAR(MAX) NULL,
    DispatchPhase NVARCHAR(32) NOT NULL DEFAULT N'TRANSACT',
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;

-- 5 indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_OrchestrationRuns_Workspace_Project_Status' AND object_id = OBJECT_ID(N'dbo.OrchestrationRuns'))
  CREATE INDEX IX_OrchestrationRuns_Workspace_Project_Status
  ON dbo.OrchestrationRuns (WorkspaceId, ProjectId, Status) INCLUDE (StageKey, AttemptNo, NextPollAt);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_OrchestrationRuns_Stage_Status_NextPoll' AND object_id = OBJECT_ID(N'dbo.OrchestrationRuns'))
  CREATE INDEX IX_OrchestrationRuns_Stage_Status_NextPoll
  ON dbo.OrchestrationRuns (StageKey, Status, NextPollAt) INCLUDE (ProjectId, WorkspaceId, RunId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_OrchestrationRuns_Status_DeadLetter' AND object_id = OBJECT_ID(N'dbo.OrchestrationRuns'))
  CREATE INDEX IX_OrchestrationRuns_Status_DeadLetter
  ON dbo.OrchestrationRuns (Status) INCLUDE (ProjectId, StageKey, UpdatedAt, ErrorMessage)
  WHERE Status = N'DEAD_LETTER';

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_OrchestrationRunEvents_RunId_EventAt' AND object_id = OBJECT_ID(N'dbo.OrchestrationRunEvents'))
  CREATE INDEX IX_OrchestrationRunEvents_RunId_EventAt
  ON dbo.OrchestrationRunEvents (RunId, EventAt DESC) INCLUDE (EventType, Severity, Actor);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_OrchestratorHeartbeats_LastHeartbeat' AND object_id = OBJECT_ID(N'dbo.OrchestratorHeartbeats'))
  CREATE INDEX IX_OrchestratorHeartbeats_LastHeartbeat
  ON dbo.OrchestratorHeartbeats (LastHeartbeat DESC) INCLUDE (WorkerId, Status, ProcessId);
