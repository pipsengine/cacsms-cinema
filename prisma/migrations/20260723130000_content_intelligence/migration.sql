-- Content Intelligence Stage 02 tables (MSSQL)
-- No fabricated opportunities, metrics, or provider results.

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'[dbo].[ci_strategy_packages]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[ci_strategy_packages] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [ci_strategy_packages_id_df] DEFAULT newid(),
      [strategy_version_id] uniqueidentifier NOT NULL,
      [version_number] int NOT NULL,
      [checksum] char(64) NOT NULL,
      [package_json] nvarchar(max) NOT NULL,
      [status] varchar(20) NOT NULL,
      [received_at] datetime2 NOT NULL CONSTRAINT [ci_strategy_packages_received_at_df] DEFAULT sysutcdatetime(),
      [acknowledged_at] datetime2 NULL,
      CONSTRAINT [ci_strategy_packages_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [UQ_ci_package] UNIQUE ([strategy_version_id], [checksum]),
      CONSTRAINT [CK_ci_strategy_packages_status] CHECK ([status] IN ('RECEIVED','ACKNOWLEDGED','REJECTED')),
      CONSTRAINT [CK_ci_strategy_packages_package_json] CHECK (ISJSON([package_json]) = 1)
    );
  END

  IF OBJECT_ID(N'[dbo].[ci_sources]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[ci_sources] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [ci_sources_id_df] DEFAULT newid(),
      [name] nvarchar(200) NOT NULL,
      [source_type] varchar(40) NOT NULL,
      [base_url] nvarchar(1000) NULL,
      [authority_score] decimal(5,2) NULL,
      [status] varchar(20) NOT NULL CONSTRAINT [ci_sources_status_df] DEFAULT 'ACTIVE',
      [configuration_json] nvarchar(max) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [ci_sources_created_at_df] DEFAULT sysutcdatetime(),
      [updated_at] datetime2 NOT NULL CONSTRAINT [ci_sources_updated_at_df] DEFAULT sysutcdatetime(),
      [row_version] rowversion,
      CONSTRAINT [ci_sources_pkey] PRIMARY KEY CLUSTERED ([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[ci_discovery_runs]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[ci_discovery_runs] (
      [id] uniqueidentifier NOT NULL,
      [strategy_package_id] uniqueidentifier NOT NULL,
      [idempotency_key] varchar(100) NOT NULL,
      [status] varchar(30) NOT NULL,
      [started_at] datetime2 NULL,
      [completed_at] datetime2 NULL,
      [failure_reason] nvarchar(2000) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [ci_discovery_runs_created_at_df] DEFAULT sysutcdatetime(),
      [row_version] rowversion,
      CONSTRAINT [ci_discovery_runs_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [ci_discovery_runs_strategy_package_id_fkey]
        FOREIGN KEY ([strategy_package_id]) REFERENCES [dbo].[ci_strategy_packages]([id]),
      CONSTRAINT [ci_discovery_runs_idempotency_key_key] UNIQUE ([idempotency_key]),
      CONSTRAINT [CK_ci_discovery_runs_status] CHECK (
        [status] IN ('QUEUED','RUNNING','COMPLETED','PARTIAL','FAILED','BLOCKED','CANCELLED')
      )
    );
  END

  IF OBJECT_ID(N'[dbo].[ci_signals]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[ci_signals] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [ci_signals_id_df] DEFAULT newid(),
      [run_id] uniqueidentifier NOT NULL,
      [source_id] uniqueidentifier NULL,
      [signal_type] varchar(30) NOT NULL,
      [subject] nvarchar(300) NOT NULL,
      [summary] nvarchar(max) NOT NULL,
      [evidence_url] nvarchar(1500) NULL,
      [observed_at] datetime2 NULL,
      [confidence] decimal(5,2) NOT NULL,
      [fingerprint] char(64) NOT NULL,
      [raw_metadata_json] nvarchar(max) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [ci_signals_created_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [ci_signals_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [ci_signals_run_id_fkey]
        FOREIGN KEY ([run_id]) REFERENCES [dbo].[ci_discovery_runs]([id]),
      CONSTRAINT [ci_signals_source_id_fkey]
        FOREIGN KEY ([source_id]) REFERENCES [dbo].[ci_sources]([id]),
      CONSTRAINT [UQ_ci_signal] UNIQUE ([run_id], [fingerprint]),
      CONSTRAINT [CK_ci_signals_confidence] CHECK ([confidence] BETWEEN 0 AND 100)
    );
  END

  IF OBJECT_ID(N'[dbo].[ci_opportunities]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[ci_opportunities] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [ci_opportunities_id_df] DEFAULT newid(),
      [run_id] uniqueidentifier NOT NULL,
      [title] nvarchar(300) NOT NULL,
      [summary] nvarchar(max) NOT NULL,
      [domain] nvarchar(160) NOT NULL,
      [geography] nvarchar(160) NULL,
      [audience] nvarchar(160) NULL,
      [format_hint] nvarchar(100) NULL,
      [status] varchar(30) NOT NULL,
      [score] decimal(6,2) NOT NULL CONSTRAINT [ci_opportunities_score_df] DEFAULT 0,
      [confidence] decimal(5,2) NOT NULL CONSTRAINT [ci_opportunities_confidence_df] DEFAULT 0,
      [duplicate_similarity] decimal(5,2) NULL,
      [risk_score] decimal(5,2) NULL,
      [score_explanation_json] nvarchar(max) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [ci_opportunities_created_at_df] DEFAULT sysutcdatetime(),
      [updated_at] datetime2 NOT NULL CONSTRAINT [ci_opportunities_updated_at_df] DEFAULT sysutcdatetime(),
      [row_version] rowversion,
      CONSTRAINT [ci_opportunities_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [ci_opportunities_run_id_fkey]
        FOREIGN KEY ([run_id]) REFERENCES [dbo].[ci_discovery_runs]([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[ci_opportunity_signals]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[ci_opportunity_signals] (
      [opportunity_id] uniqueidentifier NOT NULL,
      [signal_id] uniqueidentifier NOT NULL,
      CONSTRAINT [ci_opportunity_signals_pkey] PRIMARY KEY CLUSTERED ([opportunity_id], [signal_id]),
      CONSTRAINT [ci_opportunity_signals_opportunity_id_fkey]
        FOREIGN KEY ([opportunity_id]) REFERENCES [dbo].[ci_opportunities]([id]),
      CONSTRAINT [ci_opportunity_signals_signal_id_fkey]
        FOREIGN KEY ([signal_id]) REFERENCES [dbo].[ci_signals]([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[ci_verifications]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[ci_verifications] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [ci_verifications_id_df] DEFAULT newid(),
      [opportunity_id] uniqueidentifier NOT NULL,
      [rule_code] varchar(100) NOT NULL,
      [rule_version] int NOT NULL CONSTRAINT [ci_verifications_rule_version_df] DEFAULT 1,
      [status] varchar(20) NOT NULL,
      [severity] varchar(20) NOT NULL,
      [blocking] bit NOT NULL,
      [evidence_json] nvarchar(max) NULL,
      [checked_at] datetime2 NOT NULL CONSTRAINT [ci_verifications_checked_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [ci_verifications_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [ci_verifications_opportunity_id_fkey]
        FOREIGN KEY ([opportunity_id]) REFERENCES [dbo].[ci_opportunities]([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[ci_scores]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[ci_scores] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [ci_scores_id_df] DEFAULT newid(),
      [opportunity_id] uniqueidentifier NOT NULL,
      [model_version] varchar(50) NOT NULL,
      [factors_json] nvarchar(max) NOT NULL,
      [weights_json] nvarchar(max) NOT NULL,
      [total_score] decimal(6,2) NOT NULL,
      [gate_status] varchar(20) NOT NULL,
      [explanation] nvarchar(max) NULL,
      [scored_at] datetime2 NOT NULL CONSTRAINT [ci_scores_scored_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [ci_scores_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [ci_scores_opportunity_id_fkey]
        FOREIGN KEY ([opportunity_id]) REFERENCES [dbo].[ci_opportunities]([id]),
      CONSTRAINT [CK_ci_scores_factors_json] CHECK (ISJSON([factors_json]) = 1),
      CONSTRAINT [CK_ci_scores_weights_json] CHECK (ISJSON([weights_json]) = 1)
    );
  END

  IF OBJECT_ID(N'[dbo].[ci_rankings]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[ci_rankings] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [ci_rankings_id_df] DEFAULT newid(),
      [run_id] uniqueidentifier NOT NULL,
      [opportunity_id] uniqueidentifier NOT NULL,
      [rank_position] int NOT NULL,
      [selection_status] varchar(30) NOT NULL,
      [portfolio_effect_json] nvarchar(max) NULL,
      [ranked_at] datetime2 NOT NULL CONSTRAINT [ci_rankings_ranked_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [ci_rankings_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [ci_rankings_run_id_fkey]
        FOREIGN KEY ([run_id]) REFERENCES [dbo].[ci_discovery_runs]([id]),
      CONSTRAINT [ci_rankings_opportunity_id_fkey]
        FOREIGN KEY ([opportunity_id]) REFERENCES [dbo].[ci_opportunities]([id]),
      CONSTRAINT [UQ_ci_rank] UNIQUE ([run_id], [rank_position])
    );
  END

  IF OBJECT_ID(N'[dbo].[ci_handoffs]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[ci_handoffs] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [ci_handoffs_id_df] DEFAULT newid(),
      [opportunity_id] uniqueidentifier NOT NULL,
      [status] varchar(30) NOT NULL,
      [retry_count] int NOT NULL CONSTRAINT [ci_handoffs_retry_count_df] DEFAULT 0,
      [checksum] char(64) NOT NULL,
      [idempotency_key] varchar(100) NOT NULL,
      [acknowledged_at] datetime2 NULL,
      [failure_reason] nvarchar(2000) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [ci_handoffs_created_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [ci_handoffs_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [ci_handoffs_opportunity_id_fkey]
        FOREIGN KEY ([opportunity_id]) REFERENCES [dbo].[ci_opportunities]([id]),
      CONSTRAINT [ci_handoffs_idempotency_key_key] UNIQUE ([idempotency_key])
    );
  END

  IF OBJECT_ID(N'[dbo].[ci_blockers]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[ci_blockers] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [ci_blockers_id_df] DEFAULT newid(),
      [run_id] uniqueidentifier NULL,
      [severity] varchar(20) NOT NULL,
      [message] nvarchar(2000) NOT NULL,
      [recommendation] nvarchar(2000) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [ci_blockers_created_at_df] DEFAULT sysutcdatetime(),
      [resolved_at] datetime2 NULL,
      CONSTRAINT [ci_blockers_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [ci_blockers_run_id_fkey]
        FOREIGN KEY ([run_id]) REFERENCES [dbo].[ci_discovery_runs]([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[ci_jobs]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[ci_jobs] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [ci_jobs_id_df] DEFAULT newid(),
      [run_id] uniqueidentifier NULL,
      [job_type] varchar(50) NOT NULL,
      [status] varchar(20) NOT NULL,
      [attempt_count] int NOT NULL CONSTRAINT [ci_jobs_attempt_count_df] DEFAULT 0,
      [max_attempts] int NOT NULL CONSTRAINT [ci_jobs_max_attempts_df] DEFAULT 5,
      [next_attempt_at] datetime2 NULL,
      [lease_until] datetime2 NULL,
      [payload_json] nvarchar(max) NULL,
      [last_error] nvarchar(2000) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [ci_jobs_created_at_df] DEFAULT sysutcdatetime(),
      [updated_at] datetime2 NOT NULL CONSTRAINT [ci_jobs_updated_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [ci_jobs_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [ci_jobs_run_id_fkey]
        FOREIGN KEY ([run_id]) REFERENCES [dbo].[ci_discovery_runs]([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[ci_outbox]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[ci_outbox] (
      [id] bigint IDENTITY(1,1) NOT NULL,
      [event_type] varchar(80) NOT NULL,
      [aggregate_id] uniqueidentifier NOT NULL,
      [payload_json] nvarchar(max) NOT NULL,
      [status] varchar(20) NOT NULL CONSTRAINT [ci_outbox_status_df] DEFAULT 'PENDING',
      [attempts] int NOT NULL CONSTRAINT [ci_outbox_attempts_df] DEFAULT 0,
      [next_attempt_at] datetime2 NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [ci_outbox_created_at_df] DEFAULT sysutcdatetime(),
      [processed_at] datetime2 NULL,
      CONSTRAINT [ci_outbox_pkey] PRIMARY KEY CLUSTERED ([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[ci_audit_events]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[ci_audit_events] (
      [id] bigint IDENTITY(1,1) NOT NULL,
      [run_id] uniqueidentifier NULL,
      [opportunity_id] uniqueidentifier NULL,
      [action] varchar(100) NOT NULL,
      [actor_type] varchar(30) NOT NULL CONSTRAINT [ci_audit_events_actor_type_df] DEFAULT 'SYSTEM',
      [actor_reference] nvarchar(200) NULL,
      [request_id] varchar(100) NULL,
      [correlation_id] varchar(100) NULL,
      [previous_value] nvarchar(max) NULL,
      [new_value] nvarchar(max) NULL,
      [reason] nvarchar(1000) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [ci_audit_events_created_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [ci_audit_events_pkey] PRIMARY KEY CLUSTERED ([id])
    );
  END

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ci_opportunities_status_score'
      AND object_id = OBJECT_ID(N'[dbo].[ci_opportunities]')
  )
  BEGIN
    CREATE INDEX [IX_ci_opportunities_status_score]
      ON [dbo].[ci_opportunities]([status], [score] DESC);
  END

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ci_signals_type_observed'
      AND object_id = OBJECT_ID(N'[dbo].[ci_signals]')
  )
  BEGIN
    CREATE INDEX [IX_ci_signals_type_observed]
      ON [dbo].[ci_signals]([signal_type], [observed_at] DESC);
  END

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ci_jobs_claim'
      AND object_id = OBJECT_ID(N'[dbo].[ci_jobs]')
  )
  BEGIN
    CREATE INDEX [IX_ci_jobs_claim]
      ON [dbo].[ci_jobs]([status], [next_attempt_at]);
  END

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ci_outbox_claim'
      AND object_id = OBJECT_ID(N'[dbo].[ci_outbox]')
  )
  BEGIN
    CREATE INDEX [IX_ci_outbox_claim]
      ON [dbo].[ci_outbox]([status], [next_attempt_at]);
  END

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
