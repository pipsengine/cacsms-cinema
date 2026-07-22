BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Project] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Project_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Project_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Job] (
    [id] NVARCHAR(1000) NOT NULL,
    [projectId] NVARCHAR(1000) NOT NULL,
    [sceneId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Job_status_df] DEFAULT 'DISCOVER',
    [priority] INT NOT NULL CONSTRAINT [Job_priority_df] DEFAULT 0,
    [budget] FLOAT(53),
    [idempotencyKey] NVARCHAR(1000),
    [correlationId] NVARCHAR(1000) NOT NULL,
    [attemptCount] INT NOT NULL CONSTRAINT [Job_attemptCount_df] DEFAULT 0,
    [maxAttempts] INT NOT NULL CONSTRAINT [Job_maxAttempts_df] DEFAULT 3,
    [leaseOwner] NVARCHAR(1000),
    [leaseExpiresAt] DATETIME2,
    [cancelRequestedAt] DATETIME2,
    [startedAt] DATETIME2,
    [completedAt] DATETIME2,
    [failureCode] NVARCHAR(1000),
    [errorJson] NVARCHAR(1000),
    [version] INT NOT NULL CONSTRAINT [Job_version_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Job_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Job_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Job_idempotencyKey_key] UNIQUE NONCLUSTERED ([idempotencyKey])
);

-- CreateTable
CREATE TABLE [dbo].[GenerationAttempt] (
    [id] NVARCHAR(1000) NOT NULL,
    [jobId] NVARCHAR(1000) NOT NULL,
    [stage] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [providerUsed] NVARCHAR(1000),
    [modelUsed] NVARCHAR(1000),
    [cost] FLOAT(53),
    [errorMessage] NVARCHAR(1000),
    [correlationId] NVARCHAR(1000),
    [durationMs] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [GenerationAttempt_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [GenerationAttempt_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[JobStageExecution] (
    [id] NVARCHAR(1000) NOT NULL,
    [jobId] NVARCHAR(1000) NOT NULL,
    [stage] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [JobStageExecution_status_df] DEFAULT 'PENDING',
    [attemptNumber] INT NOT NULL CONSTRAINT [JobStageExecution_attemptNumber_df] DEFAULT 1,
    [inputJson] NVARCHAR(1000),
    [outputJson] NVARCHAR(1000),
    [startedAt] DATETIME2,
    [completedAt] DATETIME2,
    [durationMs] INT,
    [failureCode] NVARCHAR(1000),
    [errorJson] NVARCHAR(1000),
    [retryDecision] NVARCHAR(1000),
    [providerId] NVARCHAR(1000),
    [modelId] NVARCHAR(1000),
    [workflowVersion] NVARCHAR(1000),
    [cost] FLOAT(53),
    [correlationId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [JobStageExecution_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [JobStageExecution_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [JobStageExecution_jobId_stage_attemptNumber_key] UNIQUE NONCLUSTERED ([jobId],[stage],[attemptNumber])
);

-- CreateTable
CREATE TABLE [dbo].[Candidate] (
    [id] NVARCHAR(1000) NOT NULL,
    [jobId] NVARCHAR(1000) NOT NULL,
    [imageUrl] NVARCHAR(1000) NOT NULL,
    [storageKey] NVARCHAR(1000),
    [sha256] NVARCHAR(1000),
    [mimeType] NVARCHAR(1000),
    [byteSize] INT,
    [score] FLOAT(53) NOT NULL CONSTRAINT [Candidate_score_df] DEFAULT 0,
    [metadata] NVARCHAR(1000) NOT NULL CONSTRAINT [Candidate_metadata_df] DEFAULT '{}',
    [candidateType] NVARCHAR(1000) NOT NULL CONSTRAINT [Candidate_candidateType_df] DEFAULT 'generated',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Candidate_status_df] DEFAULT 'GENERATED',
    [providerId] NVARCHAR(1000),
    [modelId] NVARCHAR(1000),
    [seed] NVARCHAR(1000),
    [width] INT NOT NULL CONSTRAINT [Candidate_width_df] DEFAULT 1024,
    [height] INT NOT NULL CONSTRAINT [Candidate_height_df] DEFAULT 768,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Candidate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Candidate_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Asset] (
    [id] NVARCHAR(1000) NOT NULL,
    [candidateId] NVARCHAR(1000) NOT NULL,
    [assetUrl] NVARCHAR(1000) NOT NULL,
    [version] INT NOT NULL CONSTRAINT [Asset_version_df] DEFAULT 1,
    [status] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Asset_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Asset_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AssetVersion] (
    [id] NVARCHAR(1000) NOT NULL,
    [assetId] NVARCHAR(1000) NOT NULL,
    [version] INT NOT NULL,
    [storageKey] NVARCHAR(1000) NOT NULL,
    [deliveryUrl] NVARCHAR(1000) NOT NULL,
    [sha256] NVARCHAR(1000) NOT NULL,
    [mimeType] NVARCHAR(1000) NOT NULL,
    [byteSize] INT NOT NULL,
    [width] INT NOT NULL,
    [height] INT NOT NULL,
    [metadataJson] NVARCHAR(1000) NOT NULL CONSTRAINT [AssetVersion_metadataJson_df] DEFAULT '{}',
    [provenanceJson] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AssetVersion_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AssetVersion_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AssetVersion_assetId_version_key] UNIQUE NONCLUSTERED ([assetId],[version]),
    CONSTRAINT [AssetVersion_storageKey_key] UNIQUE NONCLUSTERED ([storageKey])
);

-- CreateTable
CREATE TABLE [dbo].[FileValidation] (
    [id] NVARCHAR(1000) NOT NULL,
    [candidateId] NVARCHAR(1000) NOT NULL,
    [passed] BIT NOT NULL,
    [mimeType] NVARCHAR(1000),
    [signatureValid] BIT NOT NULL CONSTRAINT [FileValidation_signatureValid_df] DEFAULT 0,
    [decoded] BIT NOT NULL CONSTRAINT [FileValidation_decoded_df] DEFAULT 0,
    [width] INT,
    [height] INT,
    [byteSize] INT,
    [pixelVariance] FLOAT(53),
    [alphaCoverage] FLOAT(53),
    [storageWriteOk] BIT NOT NULL CONSTRAINT [FileValidation_storageWriteOk_df] DEFAULT 0,
    [readBackOk] BIT NOT NULL CONSTRAINT [FileValidation_readBackOk_df] DEFAULT 0,
    [browserSafe] BIT NOT NULL CONSTRAINT [FileValidation_browserSafe_df] DEFAULT 0,
    [sha256] NVARCHAR(1000),
    [failureCode] NVARCHAR(1000),
    [evidenceJson] NVARCHAR(1000) NOT NULL CONSTRAINT [FileValidation_evidenceJson_df] DEFAULT '[]',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FileValidation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [FileValidation_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[QualityEvaluation] (
    [id] NVARCHAR(1000) NOT NULL,
    [candidateId] NVARCHAR(1000) NOT NULL,
    [evaluatorId] NVARCHAR(1000) NOT NULL,
    [modelVersion] NVARCHAR(1000) NOT NULL,
    [score] FLOAT(53) NOT NULL,
    [confidence] FLOAT(53) NOT NULL,
    [passed] BIT NOT NULL,
    [criticalGate] BIT NOT NULL CONSTRAINT [QualityEvaluation_criticalGate_df] DEFAULT 0,
    [evidenceJson] NVARCHAR(1000) NOT NULL CONSTRAINT [QualityEvaluation_evidenceJson_df] DEFAULT '[]',
    [recommendedActions] NVARCHAR(1000) NOT NULL CONSTRAINT [QualityEvaluation_recommendedActions_df] DEFAULT '[]',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [QualityEvaluation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [QualityEvaluation_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ImageDefect] (
    [id] NVARCHAR(1000) NOT NULL,
    [candidateId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [severity] NVARCHAR(1000) NOT NULL,
    [regionJson] NVARCHAR(1000),
    [description] NVARCHAR(1000) NOT NULL,
    [evidenceJson] NVARCHAR(1000) NOT NULL CONSTRAINT [ImageDefect_evidenceJson_df] DEFAULT '[]',
    [recommendedAction] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ImageDefect_status_df] DEFAULT 'OPEN',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ImageDefect_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [resolvedAt] DATETIME2,
    CONSTRAINT [ImageDefect_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[RepairAction] (
    [id] NVARCHAR(1000) NOT NULL,
    [candidateId] NVARCHAR(1000) NOT NULL,
    [defectId] NVARCHAR(1000),
    [action] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [RepairAction_status_df] DEFAULT 'PENDING',
    [maskStorageKey] NVARCHAR(1000),
    [outputCandidateId] NVARCHAR(1000),
    [providerId] NVARCHAR(1000),
    [modelId] NVARCHAR(1000),
    [workflowVersion] NVARCHAR(1000),
    [errorJson] NVARCHAR(1000),
    [startedAt] DATETIME2,
    [completedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RepairAction_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RepairAction_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[SystemControl] (
    [id] NVARCHAR(1000) NOT NULL CONSTRAINT [SystemControl_id_df] DEFAULT 'global',
    [desiredState] NVARCHAR(1000) NOT NULL CONSTRAINT [SystemControl_desiredState_df] DEFAULT 'STOPPED',
    [reason] NVARCHAR(1000),
    [requestedBy] NVARCHAR(1000) NOT NULL CONSTRAINT [SystemControl_requestedBy_df] DEFAULT 'operator',
    [correlationId] NVARCHAR(1000) NOT NULL,
    [version] INT NOT NULL CONSTRAINT [SystemControl_version_df] DEFAULT 1,
    [updatedAt] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SystemControl_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SystemControl_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[WorkerLease] (
    [resourceKey] NVARCHAR(1000) NOT NULL,
    [ownerId] NVARCHAR(1000) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [heartbeatAt] DATETIME2 NOT NULL CONSTRAINT [WorkerLease_heartbeatAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkerLease_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [WorkerLease_pkey] PRIMARY KEY CLUSTERED ([resourceKey])
);

-- CreateTable
CREATE TABLE [dbo].[IdempotencyRecord] (
    [key] NVARCHAR(1000) NOT NULL,
    [scope] NVARCHAR(1000) NOT NULL,
    [requestHash] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [IdempotencyRecord_status_df] DEFAULT 'IN_PROGRESS',
    [statusCode] INT,
    [responseJson] NVARCHAR(1000),
    [correlationId] NVARCHAR(1000) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [IdempotencyRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [IdempotencyRecord_pkey] PRIMARY KEY CLUSTERED ([key])
);

-- CreateTable
CREATE TABLE [dbo].[AuditEvent] (
    [id] NVARCHAR(1000) NOT NULL,
    [actorType] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(1000),
    [action] NVARCHAR(1000) NOT NULL,
    [entityType] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [beforeJson] NVARCHAR(1000),
    [afterJson] NVARCHAR(1000),
    [correlationId] NVARCHAR(1000) NOT NULL,
    [ipAddress] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuditEvent_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[OutboxEvent] (
    [id] NVARCHAR(1000) NOT NULL,
    [aggregateType] NVARCHAR(1000) NOT NULL,
    [aggregateId] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [eventVersion] INT NOT NULL CONSTRAINT [OutboxEvent_eventVersion_df] DEFAULT 1,
    [payloadJson] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [OutboxEvent_status_df] DEFAULT 'PENDING',
    [attempts] INT NOT NULL CONSTRAINT [OutboxEvent_attempts_df] DEFAULT 0,
    [availableAt] DATETIME2 NOT NULL CONSTRAINT [OutboxEvent_availableAt_df] DEFAULT CURRENT_TIMESTAMP,
    [processedAt] DATETIME2,
    [lastError] NVARCHAR(1000),
    [correlationId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OutboxEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [OutboxEvent_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Project_deletedAt_idx] ON [dbo].[Project]([deletedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Job_status_priority_createdAt_idx] ON [dbo].[Job]([status], [priority], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Job_leaseExpiresAt_idx] ON [dbo].[Job]([leaseExpiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Job_deletedAt_idx] ON [dbo].[Job]([deletedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GenerationAttempt_jobId_stage_status_idx] ON [dbo].[GenerationAttempt]([jobId], [stage], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GenerationAttempt_correlationId_idx] ON [dbo].[GenerationAttempt]([correlationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [JobStageExecution_status_createdAt_idx] ON [dbo].[JobStageExecution]([status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [JobStageExecution_correlationId_idx] ON [dbo].[JobStageExecution]([correlationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Candidate_jobId_status_idx] ON [dbo].[Candidate]([jobId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Candidate_sha256_idx] ON [dbo].[Candidate]([sha256]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_candidateId_status_idx] ON [dbo].[Asset]([candidateId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FileValidation_candidateId_passed_idx] ON [dbo].[FileValidation]([candidateId], [passed]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [QualityEvaluation_candidateId_passed_criticalGate_idx] ON [dbo].[QualityEvaluation]([candidateId], [passed], [criticalGate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ImageDefect_candidateId_severity_status_idx] ON [dbo].[ImageDefect]([candidateId], [severity], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RepairAction_candidateId_status_idx] ON [dbo].[RepairAction]([candidateId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkerLease_expiresAt_idx] ON [dbo].[WorkerLease]([expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IdempotencyRecord_scope_expiresAt_idx] ON [dbo].[IdempotencyRecord]([scope], [expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditEvent_entityType_entityId_createdAt_idx] ON [dbo].[AuditEvent]([entityType], [entityId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditEvent_correlationId_idx] ON [dbo].[AuditEvent]([correlationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OutboxEvent_status_availableAt_idx] ON [dbo].[OutboxEvent]([status], [availableAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OutboxEvent_aggregateType_aggregateId_idx] ON [dbo].[OutboxEvent]([aggregateType], [aggregateId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OutboxEvent_correlationId_idx] ON [dbo].[OutboxEvent]([correlationId]);

-- AddForeignKey
ALTER TABLE [dbo].[Job] ADD CONSTRAINT [Job_projectId_fkey] FOREIGN KEY ([projectId]) REFERENCES [dbo].[Project]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[GenerationAttempt] ADD CONSTRAINT [GenerationAttempt_jobId_fkey] FOREIGN KEY ([jobId]) REFERENCES [dbo].[Job]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JobStageExecution] ADD CONSTRAINT [JobStageExecution_jobId_fkey] FOREIGN KEY ([jobId]) REFERENCES [dbo].[Job]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Candidate] ADD CONSTRAINT [Candidate_jobId_fkey] FOREIGN KEY ([jobId]) REFERENCES [dbo].[Job]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AssetVersion] ADD CONSTRAINT [AssetVersion_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[FileValidation] ADD CONSTRAINT [FileValidation_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[QualityEvaluation] ADD CONSTRAINT [QualityEvaluation_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ImageDefect] ADD CONSTRAINT [ImageDefect_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RepairAction] ADD CONSTRAINT [RepairAction_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
