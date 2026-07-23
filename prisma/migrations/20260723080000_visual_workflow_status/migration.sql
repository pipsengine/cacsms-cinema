-- Visual workflow persisted status tables (MSSQL)
BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'[dbo].[VisualWorkflowRun]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[VisualWorkflowRun] (
      [id] NVARCHAR(1000) NOT NULL,
      [projectId] NVARCHAR(1000) NOT NULL,
      [scriptId] NVARCHAR(1000) NULL,
      [jobId] NVARCHAR(1000) NULL,
      [status] NVARCHAR(1000) NOT NULL CONSTRAINT [VisualWorkflowRun_status_df] DEFAULT 'NOT_STARTED',
      [currentStageId] NVARCHAR(1000) NULL,
      [currentTaskId] NVARCHAR(1000) NULL,
      [progressPercent] FLOAT(53) NULL,
      [startedAt] DATETIME2 NULL,
      [pausedAt] DATETIME2 NULL,
      [completedAt] DATETIME2 NULL,
      [stoppedAt] DATETIME2 NULL,
      [lastHeartbeatAt] DATETIME2 NULL,
      [stopOrFailureReason] NVARCHAR(1000) NULL,
      [checkpointJson] NVARCHAR(MAX) NULL,
      [correlationId] NVARCHAR(1000) NOT NULL,
      [version] INT NOT NULL CONSTRAINT [VisualWorkflowRun_version_df] DEFAULT 1,
      [createdAt] DATETIME2 NOT NULL CONSTRAINT [VisualWorkflowRun_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
      [updatedAt] DATETIME2 NOT NULL,
      CONSTRAINT [VisualWorkflowRun_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [VisualWorkflowRun_jobId_key] UNIQUE NONCLUSTERED ([jobId]),
      CONSTRAINT [VisualWorkflowRun_projectId_fkey] FOREIGN KEY ([projectId]) REFERENCES [dbo].[Project]([id]) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE INDEX [VisualWorkflowRun_projectId_status_updatedAt_idx] ON [dbo].[VisualWorkflowRun]([projectId],[status],[updatedAt]);
    CREATE INDEX [VisualWorkflowRun_status_lastHeartbeatAt_idx] ON [dbo].[VisualWorkflowRun]([status],[lastHeartbeatAt]);
    CREATE INDEX [VisualWorkflowRun_correlationId_idx] ON [dbo].[VisualWorkflowRun]([correlationId]);
  END

  IF OBJECT_ID(N'[dbo].[VisualWorkflowStageRun]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[VisualWorkflowStageRun] (
      [id] NVARCHAR(1000) NOT NULL,
      [workflowRunId] NVARCHAR(1000) NOT NULL,
      [stageId] NVARCHAR(1000) NOT NULL,
      [stageOrder] INT NOT NULL,
      [status] NVARCHAR(1000) NOT NULL CONSTRAINT [VisualWorkflowStageRun_status_df] DEFAULT 'NOT_STARTED',
      [progressPercent] FLOAT(53) NULL,
      [completedTaskCount] INT NOT NULL CONSTRAINT [VisualWorkflowStageRun_completedTaskCount_df] DEFAULT 0,
      [totalTaskCount] INT NOT NULL CONSTRAINT [VisualWorkflowStageRun_totalTaskCount_df] DEFAULT 0,
      [currentTaskId] NVARCHAR(1000) NULL,
      [blockingExceptionCount] INT NOT NULL CONSTRAINT [VisualWorkflowStageRun_blockingExceptionCount_df] DEFAULT 0,
      [attemptCount] INT NOT NULL CONSTRAINT [VisualWorkflowStageRun_attemptCount_df] DEFAULT 0,
      [startedAt] DATETIME2 NULL,
      [completedAt] DATETIME2 NULL,
      [inputRefsJson] NVARCHAR(MAX) NULL,
      [outputRefsJson] NVARCHAR(MAX) NULL,
      [errorClassification] NVARCHAR(1000) NULL,
      [retryEligible] BIT NOT NULL CONSTRAINT [VisualWorkflowStageRun_retryEligible_df] DEFAULT 0,
      [checkpointJson] NVARCHAR(MAX) NULL,
      [version] INT NOT NULL CONSTRAINT [VisualWorkflowStageRun_version_df] DEFAULT 1,
      [createdAt] DATETIME2 NOT NULL CONSTRAINT [VisualWorkflowStageRun_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
      [updatedAt] DATETIME2 NOT NULL,
      CONSTRAINT [VisualWorkflowStageRun_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [VisualWorkflowStageRun_workflowRunId_stageId_key] UNIQUE NONCLUSTERED ([workflowRunId],[stageId]),
      CONSTRAINT [VisualWorkflowStageRun_workflowRunId_fkey] FOREIGN KEY ([workflowRunId]) REFERENCES [dbo].[VisualWorkflowRun]([id]) ON DELETE CASCADE ON UPDATE CASCADE
    );
  END

  IF OBJECT_ID(N'[dbo].[VisualWorkflowPageStatus]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[VisualWorkflowPageStatus] (
      [id] NVARCHAR(1000) NOT NULL,
      [workflowRunId] NVARCHAR(1000) NOT NULL,
      [stageId] NVARCHAR(1000) NOT NULL,
      [pageId] NVARCHAR(1000) NOT NULL,
      [status] NVARCHAR(1000) NOT NULL CONSTRAINT [VisualWorkflowPageStatus_status_df] DEFAULT 'NOT_STARTED',
      [recordCount] INT NULL,
      [blockingIssueCount] INT NOT NULL CONSTRAINT [VisualWorkflowPageStatus_blockingIssueCount_df] DEFAULT 0,
      [progressPercent] FLOAT(53) NULL,
      [lastActivityAt] DATETIME2 NULL,
      [startedAt] DATETIME2 NULL,
      [completedAt] DATETIME2 NULL,
      [statusReason] NVARCHAR(1000) NULL,
      [createdAt] DATETIME2 NOT NULL CONSTRAINT [VisualWorkflowPageStatus_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
      [updatedAt] DATETIME2 NOT NULL,
      CONSTRAINT [VisualWorkflowPageStatus_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [VisualWorkflowPageStatus_workflowRunId_stageId_pageId_key] UNIQUE NONCLUSTERED ([workflowRunId],[stageId],[pageId]),
      CONSTRAINT [VisualWorkflowPageStatus_workflowRunId_fkey] FOREIGN KEY ([workflowRunId]) REFERENCES [dbo].[VisualWorkflowRun]([id]) ON DELETE CASCADE ON UPDATE CASCADE
    );
  END

  IF OBJECT_ID(N'[dbo].[VisualWorkflowTask]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[VisualWorkflowTask] (
      [id] NVARCHAR(1000) NOT NULL,
      [workflowRunId] NVARCHAR(1000) NOT NULL,
      [stageId] NVARCHAR(1000) NOT NULL,
      [pageId] NVARCHAR(1000) NULL,
      [taskType] NVARCHAR(1000) NOT NULL,
      [status] NVARCHAR(1000) NOT NULL CONSTRAINT [VisualWorkflowTask_status_df] DEFAULT 'NOT_STARTED',
      [sequenceOrder] INT NOT NULL,
      [weight] FLOAT(53) NOT NULL CONSTRAINT [VisualWorkflowTask_weight_df] DEFAULT 1,
      [applicable] BIT NOT NULL CONSTRAINT [VisualWorkflowTask_applicable_df] DEFAULT 1,
      [attemptCount] INT NOT NULL CONSTRAINT [VisualWorkflowTask_attemptCount_df] DEFAULT 0,
      [maxAttempts] INT NOT NULL CONSTRAINT [VisualWorkflowTask_maxAttempts_df] DEFAULT 3,
      [retryEligible] BIT NOT NULL CONSTRAINT [VisualWorkflowTask_retryEligible_df] DEFAULT 1,
      [idempotencyKey] NVARCHAR(1000) NULL,
      [startedAt] DATETIME2 NULL,
      [completedAt] DATETIME2 NULL,
      [inputRefsJson] NVARCHAR(MAX) NULL,
      [outputRefsJson] NVARCHAR(MAX) NULL,
      [errorDetails] NVARCHAR(1000) NULL,
      [createdAt] DATETIME2 NOT NULL CONSTRAINT [VisualWorkflowTask_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
      [updatedAt] DATETIME2 NOT NULL,
      CONSTRAINT [VisualWorkflowTask_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [VisualWorkflowTask_idempotencyKey_key] UNIQUE NONCLUSTERED ([idempotencyKey]),
      CONSTRAINT [VisualWorkflowTask_workflowRunId_fkey] FOREIGN KEY ([workflowRunId]) REFERENCES [dbo].[VisualWorkflowRun]([id]) ON DELETE CASCADE ON UPDATE CASCADE
    );
  END

  IF OBJECT_ID(N'[dbo].[VisualWorkflowGate]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[VisualWorkflowGate] (
      [id] NVARCHAR(1000) NOT NULL,
      [workflowRunId] NVARCHAR(1000) NOT NULL,
      [stageId] NVARCHAR(1000) NOT NULL,
      [gateType] NVARCHAR(1000) NOT NULL,
      [mandatory] BIT NOT NULL CONSTRAINT [VisualWorkflowGate_mandatory_df] DEFAULT 1,
      [result] NVARCHAR(1000) NOT NULL CONSTRAINT [VisualWorkflowGate_result_df] DEFAULT 'PENDING',
      [measuredScore] FLOAT(53) NULL,
      [requiredThreshold] FLOAT(53) NULL,
      [calculationBasis] NVARCHAR(1000) NULL,
      [evidenceJson] NVARCHAR(MAX) NULL,
      [evaluatedAt] DATETIME2 NULL,
      [createdAt] DATETIME2 NOT NULL CONSTRAINT [VisualWorkflowGate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
      [updatedAt] DATETIME2 NOT NULL,
      CONSTRAINT [VisualWorkflowGate_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [VisualWorkflowGate_workflowRunId_stageId_gateType_key] UNIQUE NONCLUSTERED ([workflowRunId],[stageId],[gateType]),
      CONSTRAINT [VisualWorkflowGate_workflowRunId_fkey] FOREIGN KEY ([workflowRunId]) REFERENCES [dbo].[VisualWorkflowRun]([id]) ON DELETE CASCADE ON UPDATE CASCADE
    );
  END

  IF OBJECT_ID(N'[dbo].[VisualWorkflowException]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[VisualWorkflowException] (
      [id] NVARCHAR(1000) NOT NULL,
      [workflowRunId] NVARCHAR(1000) NOT NULL,
      [stageId] NVARCHAR(1000) NULL,
      [taskId] NVARCHAR(1000) NULL,
      [classification] NVARCHAR(1000) NOT NULL,
      [severity] NVARCHAR(1000) NOT NULL,
      [blocking] BIT NOT NULL CONSTRAINT [VisualWorkflowException_blocking_df] DEFAULT 1,
      [status] NVARCHAR(1000) NOT NULL CONSTRAINT [VisualWorkflowException_status_df] DEFAULT 'OPEN',
      [safeDescription] NVARCHAR(1000) NOT NULL,
      [retryEligible] BIT NOT NULL CONSTRAINT [VisualWorkflowException_retryEligible_df] DEFAULT 0,
      [resolutionDetails] NVARCHAR(1000) NULL,
      [createdAt] DATETIME2 NOT NULL CONSTRAINT [VisualWorkflowException_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
      [resolvedAt] DATETIME2 NULL,
      CONSTRAINT [VisualWorkflowException_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [VisualWorkflowException_workflowRunId_fkey] FOREIGN KEY ([workflowRunId]) REFERENCES [dbo].[VisualWorkflowRun]([id]) ON DELETE CASCADE ON UPDATE CASCADE
    );
  END

  IF OBJECT_ID(N'[dbo].[VisualWorkflowEvent]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[VisualWorkflowEvent] (
      [id] NVARCHAR(1000) NOT NULL,
      [workflowRunId] NVARCHAR(1000) NOT NULL,
      [stageId] NVARCHAR(1000) NULL,
      [eventType] NVARCHAR(1000) NOT NULL,
      [previousStatus] NVARCHAR(1000) NULL,
      [newStatus] NVARCHAR(1000) NULL,
      [actorType] NVARCHAR(1000) NOT NULL,
      [correlationId] NVARCHAR(1000) NOT NULL,
      [metadataJson] NVARCHAR(MAX) NULL,
      [createdAt] DATETIME2 NOT NULL CONSTRAINT [VisualWorkflowEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT [VisualWorkflowEvent_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [VisualWorkflowEvent_workflowRunId_fkey] FOREIGN KEY ([workflowRunId]) REFERENCES [dbo].[VisualWorkflowRun]([id]) ON DELETE CASCADE ON UPDATE CASCADE
    );
  END

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
