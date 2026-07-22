CREATE TABLE [dbo].[Script] (
  [id] NVARCHAR(1000) NOT NULL, [projectId] NVARCHAR(1000) NOT NULL, [title] NVARCHAR(1000) NOT NULL,
  [logline] NVARCHAR(MAX), [genre] NVARCHAR(1000), [targetDurationSec] INT NOT NULL CONSTRAINT [Script_targetDurationSec_df] DEFAULT 900,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Script_status_df] DEFAULT 'DRAFT', [version] INT NOT NULL CONSTRAINT [Script_version_df] DEFAULT 1,
  [deletedAt] DATETIME2, [createdAt] DATETIME2 NOT NULL CONSTRAINT [Script_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL, CONSTRAINT [Script_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [Script_projectId_fkey] FOREIGN KEY ([projectId]) REFERENCES [dbo].[Project]([id]) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX [Script_projectId_deletedAt_updatedAt_idx] ON [dbo].[Script]([projectId], [deletedAt], [updatedAt]);

CREATE TABLE [dbo].[ScriptScene] (
  [id] NVARCHAR(1000) NOT NULL, [scriptId] NVARCHAR(1000) NOT NULL, [position] INT NOT NULL, [sceneNumber] NVARCHAR(1000) NOT NULL,
  [title] NVARCHAR(1000) NOT NULL, [purpose] NVARCHAR(MAX) NOT NULL CONSTRAINT [ScriptScene_purpose_df] DEFAULT '',
  [narrativeBeat] NVARCHAR(1000) NOT NULL CONSTRAINT [ScriptScene_narrativeBeat_df] DEFAULT 'Context',
  [narration] NVARCHAR(MAX) NOT NULL CONSTRAINT [ScriptScene_narration_df] DEFAULT '', [visualIntention] NVARCHAR(MAX) NOT NULL CONSTRAINT [ScriptScene_visualIntention_df] DEFAULT '',
  [locationPeriod] NVARCHAR(MAX) NOT NULL CONSTRAINT [ScriptScene_locationPeriod_df] DEFAULT '', [emotionalDirection] NVARCHAR(MAX) NOT NULL CONSTRAINT [ScriptScene_emotionalDirection_df] DEFAULT '',
  [cameraDirection] NVARCHAR(MAX) NOT NULL CONSTRAINT [ScriptScene_cameraDirection_df] DEFAULT '', [soundDirection] NVARCHAR(MAX) NOT NULL CONSTRAINT [ScriptScene_soundDirection_df] DEFAULT '',
  [durationSec] INT NOT NULL CONSTRAINT [ScriptScene_durationSec_df] DEFAULT 60, [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ScriptScene_status_df] DEFAULT 'DRAFT',
  [readinessScore] FLOAT(53), [version] INT NOT NULL CONSTRAINT [ScriptScene_version_df] DEFAULT 1, [staleAt] DATETIME2,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [ScriptScene_createdAt_df] DEFAULT CURRENT_TIMESTAMP, [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [ScriptScene_pkey] PRIMARY KEY CLUSTERED ([id]), CONSTRAINT [ScriptScene_scriptId_fkey] FOREIGN KEY ([scriptId]) REFERENCES [dbo].[Script]([id]) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX [ScriptScene_scriptId_position_key] ON [dbo].[ScriptScene]([scriptId], [position]);
CREATE UNIQUE INDEX [ScriptScene_scriptId_sceneNumber_key] ON [dbo].[ScriptScene]([scriptId], [sceneNumber]);
CREATE INDEX [ScriptScene_scriptId_status_idx] ON [dbo].[ScriptScene]([scriptId], [status]);

CREATE TABLE [dbo].[ScriptEvidence] (
  [id] NVARCHAR(1000) NOT NULL, [sceneId] NVARCHAR(1000) NOT NULL, [claim] NVARCHAR(MAX) NOT NULL, [sourceTitle] NVARCHAR(1000) NOT NULL,
  [sourceUrl] NVARCHAR(MAX), [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ScriptEvidence_status_df] DEFAULT 'UNVERIFIED', [confidence] FLOAT(53), [notes] NVARCHAR(MAX),
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [ScriptEvidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP, [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [ScriptEvidence_pkey] PRIMARY KEY CLUSTERED ([id]), CONSTRAINT [ScriptEvidence_sceneId_fkey] FOREIGN KEY ([sceneId]) REFERENCES [dbo].[ScriptScene]([id]) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX [ScriptEvidence_sceneId_status_idx] ON [dbo].[ScriptEvidence]([sceneId], [status]);

CREATE TABLE [dbo].[ScriptContinuityIssue] (
  [id] NVARCHAR(1000) NOT NULL, [scriptId] NVARCHAR(1000) NOT NULL, [sceneId] NVARCHAR(1000), [code] NVARCHAR(1000) NOT NULL,
  [severity] NVARCHAR(1000) NOT NULL, [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ScriptContinuityIssue_status_df] DEFAULT 'OPEN',
  [description] NVARCHAR(MAX) NOT NULL, [evidenceJson] NVARCHAR(MAX) NOT NULL CONSTRAINT [ScriptContinuityIssue_evidenceJson_df] DEFAULT '[]',
  [recommendedAction] NVARCHAR(MAX) NOT NULL, [createdAt] DATETIME2 NOT NULL CONSTRAINT [ScriptContinuityIssue_createdAt_df] DEFAULT CURRENT_TIMESTAMP, [resolvedAt] DATETIME2,
  CONSTRAINT [ScriptContinuityIssue_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [ScriptContinuityIssue_scriptId_fkey] FOREIGN KEY ([scriptId]) REFERENCES [dbo].[Script]([id]) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT [ScriptContinuityIssue_sceneId_fkey] FOREIGN KEY ([sceneId]) REFERENCES [dbo].[ScriptScene]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX [ScriptContinuityIssue_scriptId_status_severity_idx] ON [dbo].[ScriptContinuityIssue]([scriptId], [status], [severity]);
CREATE INDEX [ScriptContinuityIssue_sceneId_idx] ON [dbo].[ScriptContinuityIssue]([sceneId]);

CREATE TABLE [dbo].[ScriptRevision] (
  [id] NVARCHAR(1000) NOT NULL, [scriptId] NVARCHAR(1000) NOT NULL, [version] INT NOT NULL, [snapshotJson] NVARCHAR(MAX) NOT NULL,
  [changeSummary] NVARCHAR(1000) NOT NULL, [actorType] NVARCHAR(1000) NOT NULL, [actorId] NVARCHAR(1000), [correlationId] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [ScriptRevision_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [ScriptRevision_pkey] PRIMARY KEY CLUSTERED ([id]), CONSTRAINT [ScriptRevision_scriptId_fkey] FOREIGN KEY ([scriptId]) REFERENCES [dbo].[Script]([id]) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX [ScriptRevision_scriptId_version_key] ON [dbo].[ScriptRevision]([scriptId], [version]);
CREATE INDEX [ScriptRevision_correlationId_idx] ON [dbo].[ScriptRevision]([correlationId]);

CREATE TABLE [dbo].[ScriptAutomationRun] (
  [id] NVARCHAR(1000) NOT NULL, [scriptId] NVARCHAR(1000) NOT NULL, [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ScriptAutomationRun_status_df] DEFAULT 'QUEUED',
  [stage] NVARCHAR(1000) NOT NULL CONSTRAINT [ScriptAutomationRun_stage_df] DEFAULT 'OUTLINE', [providerId] NVARCHAR(1000), [modelId] NVARCHAR(1000),
  [inputHash] NVARCHAR(1000) NOT NULL, [outputJson] NVARCHAR(MAX), [failureCode] NVARCHAR(1000), [errorJson] NVARCHAR(MAX), [correlationId] NVARCHAR(1000) NOT NULL,
  [startedAt] DATETIME2, [completedAt] DATETIME2, [createdAt] DATETIME2 NOT NULL CONSTRAINT [ScriptAutomationRun_createdAt_df] DEFAULT CURRENT_TIMESTAMP, [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [ScriptAutomationRun_pkey] PRIMARY KEY CLUSTERED ([id]), CONSTRAINT [ScriptAutomationRun_scriptId_fkey] FOREIGN KEY ([scriptId]) REFERENCES [dbo].[Script]([id]) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX [ScriptAutomationRun_scriptId_status_createdAt_idx] ON [dbo].[ScriptAutomationRun]([scriptId], [status], [createdAt]);
CREATE INDEX [ScriptAutomationRun_correlationId_idx] ON [dbo].[ScriptAutomationRun]([correlationId]);
