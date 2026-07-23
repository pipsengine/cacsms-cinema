-- Idea Qualification Stage 03 tables (MSSQL)
-- No fabricated candidates, scores, metrics, or acknowledgements.

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'[dbo].[iq_intake_packages]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[iq_intake_packages] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [iq_intake_packages_id_df] DEFAULT newid(),
      [source_run_id] uniqueidentifier NOT NULL,
      [strategy_version_id] uniqueidentifier NOT NULL,
      [checksum] char(64) NOT NULL,
      [package_json] nvarchar(max) NOT NULL,
      [status] varchar(20) NOT NULL,
      [received_at] datetime2 NOT NULL CONSTRAINT [iq_intake_packages_received_at_df] DEFAULT sysutcdatetime(),
      [acknowledged_at] datetime2 NULL,
      CONSTRAINT [iq_intake_packages_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [UQ_iq_intake] UNIQUE ([source_run_id], [checksum]),
      CONSTRAINT [CK_iq_intake_packages_status] CHECK ([status] IN ('RECEIVED','ACKNOWLEDGED','REJECTED')),
      CONSTRAINT [CK_iq_intake_packages_package_json] CHECK (ISJSON([package_json]) = 1)
    );
  END

  IF OBJECT_ID(N'[dbo].[iq_cycles]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[iq_cycles] (
      [id] uniqueidentifier NOT NULL,
      [intake_package_id] uniqueidentifier NOT NULL,
      [idempotency_key] varchar(100) NOT NULL,
      [status] varchar(30) NOT NULL,
      [started_at] datetime2 NULL,
      [completed_at] datetime2 NULL,
      [failure_reason] nvarchar(2000) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [iq_cycles_created_at_df] DEFAULT sysutcdatetime(),
      [row_version] rowversion,
      CONSTRAINT [iq_cycles_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [iq_cycles_intake_package_id_fkey]
        FOREIGN KEY ([intake_package_id]) REFERENCES [dbo].[iq_intake_packages]([id]),
      CONSTRAINT [iq_cycles_idempotency_key_key] UNIQUE ([idempotency_key]),
      CONSTRAINT [CK_iq_cycles_status] CHECK (
        [status] IN ('QUEUED','RUNNING','COMPLETED','PARTIAL','FAILED','BLOCKED','CANCELLED')
      )
    );
  END

  IF OBJECT_ID(N'[dbo].[iq_candidates]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[iq_candidates] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [iq_candidates_id_df] DEFAULT newid(),
      [cycle_id] uniqueidentifier NOT NULL,
      [upstream_opportunity_id] uniqueidentifier NOT NULL,
      [title] nvarchar(300) NOT NULL,
      [summary] nvarchar(max) NOT NULL,
      [domain] nvarchar(160) NOT NULL,
      [geography] nvarchar(160) NULL,
      [audience] nvarchar(160) NULL,
      [format_hint] nvarchar(100) NULL,
      [status] varchar(30) NOT NULL,
      [score] decimal(6,2) NOT NULL CONSTRAINT [iq_candidates_score_df] DEFAULT 0,
      [confidence] decimal(5,2) NOT NULL CONSTRAINT [iq_candidates_confidence_df] DEFAULT 0,
      [gate_status] varchar(20) NOT NULL CONSTRAINT [iq_candidates_gate_status_df] DEFAULT 'NOT_EVALUATED',
      [decision] varchar(20) NULL,
      [decision_reason] nvarchar(2000) NULL,
      [source_payload_json] nvarchar(max) NOT NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [iq_candidates_created_at_df] DEFAULT sysutcdatetime(),
      [updated_at] datetime2 NOT NULL CONSTRAINT [iq_candidates_updated_at_df] DEFAULT sysutcdatetime(),
      [row_version] rowversion,
      CONSTRAINT [iq_candidates_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [iq_candidates_cycle_id_fkey]
        FOREIGN KEY ([cycle_id]) REFERENCES [dbo].[iq_cycles]([id]),
      CONSTRAINT [UQ_iq_upstream_candidate] UNIQUE ([cycle_id], [upstream_opportunity_id]),
      CONSTRAINT [CK_iq_candidates_status] CHECK (
        [status] IN ('RECEIVED','NORMALISING','EVALUATING','QUALIFIED','REJECTED','BLOCKED','SELECTED','HANDED_OFF','ARCHIVED')
      ),
      CONSTRAINT [CK_iq_candidates_source_payload_json] CHECK (ISJSON([source_payload_json]) = 1)
    );
  END

  IF OBJECT_ID(N'[dbo].[iq_evidence_checks]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[iq_evidence_checks] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [iq_evidence_checks_id_df] DEFAULT newid(),
      [candidate_id] uniqueidentifier NOT NULL,
      [rule_code] varchar(100) NOT NULL,
      [rule_version] int NOT NULL,
      [status] varchar(20) NOT NULL,
      [severity] varchar(20) NOT NULL,
      [blocking] bit NOT NULL,
      [evidence_json] nvarchar(max) NULL,
      [checked_at] datetime2 NOT NULL CONSTRAINT [iq_evidence_checks_checked_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [iq_evidence_checks_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [iq_evidence_checks_candidate_id_fkey]
        FOREIGN KEY ([candidate_id]) REFERENCES [dbo].[iq_candidates]([id]),
      CONSTRAINT [UQ_iq_evidence_rule] UNIQUE ([candidate_id], [rule_code], [rule_version])
    );
  END

  IF OBJECT_ID(N'[dbo].[iq_duplicate_checks]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[iq_duplicate_checks] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [iq_duplicate_checks_id_df] DEFAULT newid(),
      [candidate_id] uniqueidentifier NOT NULL,
      [compared_asset_type] varchar(30) NOT NULL,
      [compared_asset_id] uniqueidentifier NOT NULL,
      [similarity] decimal(5,2) NOT NULL,
      [model_version] varchar(80) NOT NULL,
      [blocking] bit NOT NULL,
      [explanation] nvarchar(max) NULL,
      [checked_at] datetime2 NOT NULL CONSTRAINT [iq_duplicate_checks_checked_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [iq_duplicate_checks_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [iq_duplicate_checks_candidate_id_fkey]
        FOREIGN KEY ([candidate_id]) REFERENCES [dbo].[iq_candidates]([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[iq_risk_assessments]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[iq_risk_assessments] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [iq_risk_assessments_id_df] DEFAULT newid(),
      [candidate_id] uniqueidentifier NOT NULL,
      [category] varchar(40) NOT NULL,
      [severity] varchar(20) NOT NULL,
      [likelihood] decimal(5,2) NOT NULL,
      [risk_score] decimal(5,2) NOT NULL,
      [blocking] bit NOT NULL,
      [mitigation] nvarchar(2000) NULL,
      [evidence_json] nvarchar(max) NULL,
      [assessed_at] datetime2 NOT NULL CONSTRAINT [iq_risk_assessments_assessed_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [iq_risk_assessments_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [iq_risk_assessments_candidate_id_fkey]
        FOREIGN KEY ([candidate_id]) REFERENCES [dbo].[iq_candidates]([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[iq_scores]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[iq_scores] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [iq_scores_id_df] DEFAULT newid(),
      [candidate_id] uniqueidentifier NOT NULL,
      [model_version] varchar(80) NOT NULL,
      [factors_json] nvarchar(max) NOT NULL,
      [weights_json] nvarchar(max) NOT NULL,
      [thresholds_json] nvarchar(max) NOT NULL,
      [total_score] decimal(6,2) NOT NULL,
      [confidence] decimal(5,2) NOT NULL,
      [explanation] nvarchar(max) NULL,
      [scored_at] datetime2 NOT NULL CONSTRAINT [iq_scores_scored_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [iq_scores_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [iq_scores_candidate_id_fkey]
        FOREIGN KEY ([candidate_id]) REFERENCES [dbo].[iq_candidates]([id]),
      CONSTRAINT [CK_iq_scores_factors_json] CHECK (ISJSON([factors_json]) = 1),
      CONSTRAINT [CK_iq_scores_weights_json] CHECK (ISJSON([weights_json]) = 1),
      CONSTRAINT [CK_iq_scores_thresholds_json] CHECK (ISJSON([thresholds_json]) = 1)
    );
  END

  IF OBJECT_ID(N'[dbo].[iq_gate_results]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[iq_gate_results] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [iq_gate_results_id_df] DEFAULT newid(),
      [candidate_id] uniqueidentifier NOT NULL,
      [score_id] uniqueidentifier NOT NULL,
      [gate_code] varchar(100) NOT NULL,
      [actual_value] decimal(8,2) NULL,
      [required_value] nvarchar(100) NULL,
      [status] varchar(20) NOT NULL,
      [blocking] bit NOT NULL,
      [explanation] nvarchar(max) NULL,
      [evaluated_at] datetime2 NOT NULL CONSTRAINT [iq_gate_results_evaluated_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [iq_gate_results_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [iq_gate_results_candidate_id_fkey]
        FOREIGN KEY ([candidate_id]) REFERENCES [dbo].[iq_candidates]([id]),
      CONSTRAINT [iq_gate_results_score_id_fkey]
        FOREIGN KEY ([score_id]) REFERENCES [dbo].[iq_scores]([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[iq_rankings]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[iq_rankings] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [iq_rankings_id_df] DEFAULT newid(),
      [cycle_id] uniqueidentifier NOT NULL,
      [candidate_id] uniqueidentifier NOT NULL,
      [rank_position] int NOT NULL,
      [portfolio_effect_json] nvarchar(max) NULL,
      [ranked_at] datetime2 NOT NULL CONSTRAINT [iq_rankings_ranked_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [iq_rankings_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [iq_rankings_cycle_id_fkey]
        FOREIGN KEY ([cycle_id]) REFERENCES [dbo].[iq_cycles]([id]),
      CONSTRAINT [iq_rankings_candidate_id_fkey]
        FOREIGN KEY ([candidate_id]) REFERENCES [dbo].[iq_candidates]([id]),
      CONSTRAINT [UQ_iq_rank_position] UNIQUE ([cycle_id], [rank_position]),
      CONSTRAINT [UQ_iq_rank_candidate] UNIQUE ([cycle_id], [candidate_id])
    );
  END

  IF OBJECT_ID(N'[dbo].[iq_decisions]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[iq_decisions] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [iq_decisions_id_df] DEFAULT newid(),
      [candidate_id] uniqueidentifier NOT NULL,
      [decision] varchar(20) NOT NULL,
      [reason] nvarchar(2000) NOT NULL,
      [decision_source] varchar(30) NOT NULL CONSTRAINT [iq_decisions_decision_source_df] DEFAULT 'SYSTEM',
      [policy_version] varchar(80) NULL,
      [score_id] uniqueidentifier NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [iq_decisions_created_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [iq_decisions_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [iq_decisions_candidate_id_fkey]
        FOREIGN KEY ([candidate_id]) REFERENCES [dbo].[iq_candidates]([id]),
      CONSTRAINT [iq_decisions_score_id_fkey]
        FOREIGN KEY ([score_id]) REFERENCES [dbo].[iq_scores]([id]),
      CONSTRAINT [CK_iq_decisions_decision] CHECK ([decision] IN ('QUALIFY','REJECT','BLOCK','REASSESS'))
    );
  END

  IF OBJECT_ID(N'[dbo].[iq_handoffs]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[iq_handoffs] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [iq_handoffs_id_df] DEFAULT newid(),
      [candidate_id] uniqueidentifier NOT NULL,
      [status] varchar(30) NOT NULL,
      [idempotency_key] varchar(100) NOT NULL,
      [checksum] char(64) NOT NULL,
      [payload_json] nvarchar(max) NOT NULL,
      [content_project_id] uniqueidentifier NULL,
      [retry_count] int NOT NULL CONSTRAINT [iq_handoffs_retry_count_df] DEFAULT 0,
      [acknowledged_at] datetime2 NULL,
      [failure_reason] nvarchar(2000) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [iq_handoffs_created_at_df] DEFAULT sysutcdatetime(),
      [updated_at] datetime2 NOT NULL CONSTRAINT [iq_handoffs_updated_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [iq_handoffs_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [iq_handoffs_candidate_id_fkey]
        FOREIGN KEY ([candidate_id]) REFERENCES [dbo].[iq_candidates]([id]),
      CONSTRAINT [iq_handoffs_idempotency_key_key] UNIQUE ([idempotency_key]),
      CONSTRAINT [CK_iq_handoffs_status] CHECK ([status] IN ('PENDING','DISPATCHED','ACKNOWLEDGED','FAILED','BLOCKED')),
      CONSTRAINT [CK_iq_handoffs_payload_json] CHECK (ISJSON([payload_json]) = 1)
    );
  END

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_iq_single_open_handoff'
      AND object_id = OBJECT_ID(N'[dbo].[iq_handoffs]')
  )
  BEGIN
    CREATE UNIQUE INDEX [UX_iq_single_open_handoff]
      ON [dbo].[iq_handoffs]([candidate_id])
      WHERE [status] IN ('PENDING','DISPATCHED','ACKNOWLEDGED');
  END

  IF OBJECT_ID(N'[dbo].[iq_blockers]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[iq_blockers] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [iq_blockers_id_df] DEFAULT newid(),
      [cycle_id] uniqueidentifier NULL,
      [candidate_id] uniqueidentifier NULL,
      [severity] varchar(20) NOT NULL,
      [message] nvarchar(2000) NOT NULL,
      [recommendation] nvarchar(2000) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [iq_blockers_created_at_df] DEFAULT sysutcdatetime(),
      [resolved_at] datetime2 NULL,
      CONSTRAINT [iq_blockers_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [iq_blockers_cycle_id_fkey]
        FOREIGN KEY ([cycle_id]) REFERENCES [dbo].[iq_cycles]([id]),
      CONSTRAINT [iq_blockers_candidate_id_fkey]
        FOREIGN KEY ([candidate_id]) REFERENCES [dbo].[iq_candidates]([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[iq_jobs]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[iq_jobs] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [iq_jobs_id_df] DEFAULT newid(),
      [cycle_id] uniqueidentifier NULL,
      [job_type] varchar(60) NOT NULL,
      [status] varchar(20) NOT NULL,
      [attempt_count] int NOT NULL CONSTRAINT [iq_jobs_attempt_count_df] DEFAULT 0,
      [max_attempts] int NOT NULL CONSTRAINT [iq_jobs_max_attempts_df] DEFAULT 5,
      [next_attempt_at] datetime2 NULL,
      [lease_until] datetime2 NULL,
      [payload_json] nvarchar(max) NULL,
      [last_error] nvarchar(2000) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [iq_jobs_created_at_df] DEFAULT sysutcdatetime(),
      [updated_at] datetime2 NOT NULL CONSTRAINT [iq_jobs_updated_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [iq_jobs_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [iq_jobs_cycle_id_fkey]
        FOREIGN KEY ([cycle_id]) REFERENCES [dbo].[iq_cycles]([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[iq_outbox]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[iq_outbox] (
      [id] bigint IDENTITY(1,1) NOT NULL,
      [event_type] varchar(100) NOT NULL,
      [aggregate_id] uniqueidentifier NOT NULL,
      [payload_json] nvarchar(max) NOT NULL,
      [status] varchar(20) NOT NULL CONSTRAINT [iq_outbox_status_df] DEFAULT 'PENDING',
      [attempts] int NOT NULL CONSTRAINT [iq_outbox_attempts_df] DEFAULT 0,
      [next_attempt_at] datetime2 NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [iq_outbox_created_at_df] DEFAULT sysutcdatetime(),
      [processed_at] datetime2 NULL,
      CONSTRAINT [iq_outbox_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [CK_iq_outbox_payload_json] CHECK (ISJSON([payload_json]) = 1)
    );
  END

  IF OBJECT_ID(N'[dbo].[iq_audit_events]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[iq_audit_events] (
      [id] bigint IDENTITY(1,1) NOT NULL,
      [cycle_id] uniqueidentifier NULL,
      [candidate_id] uniqueidentifier NULL,
      [action] varchar(100) NOT NULL,
      [actor_type] varchar(30) NOT NULL CONSTRAINT [iq_audit_events_actor_type_df] DEFAULT 'SYSTEM',
      [actor_reference] nvarchar(200) NULL,
      [request_id] varchar(100) NULL,
      [correlation_id] varchar(100) NULL,
      [previous_value] nvarchar(max) NULL,
      [new_value] nvarchar(max) NULL,
      [reason] nvarchar(1000) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [iq_audit_events_created_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [iq_audit_events_pkey] PRIMARY KEY CLUSTERED ([id])
    );
  END

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_iq_candidates_status_score'
      AND object_id = OBJECT_ID(N'[dbo].[iq_candidates]')
  )
  BEGIN
    CREATE INDEX [IX_iq_candidates_status_score]
      ON [dbo].[iq_candidates]([status], [gate_status], [score] DESC);
  END

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_iq_jobs_claim'
      AND object_id = OBJECT_ID(N'[dbo].[iq_jobs]')
  )
  BEGIN
    CREATE INDEX [IX_iq_jobs_claim]
      ON [dbo].[iq_jobs]([status], [next_attempt_at]);
  END

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_iq_outbox_claim'
      AND object_id = OBJECT_ID(N'[dbo].[iq_outbox]')
  )
  BEGIN
    CREATE INDEX [IX_iq_outbox_claim]
      ON [dbo].[iq_outbox]([status], [next_attempt_at]);
  END

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_iq_blockers_open'
      AND object_id = OBJECT_ID(N'[dbo].[iq_blockers]')
  )
  BEGIN
    CREATE INDEX [IX_iq_blockers_open]
      ON [dbo].[iq_blockers]([severity], [created_at] DESC)
      WHERE [resolved_at] IS NULL;
  END

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
