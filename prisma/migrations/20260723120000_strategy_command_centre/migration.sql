-- Strategy Command Centre tables (MSSQL)
-- Empty draft only; no fabricated production metrics.

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'[dbo].[content_strategies]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[content_strategies] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [content_strategies_id_df] DEFAULT newid(),
      [name] nvarchar(200) NOT NULL,
      [description] nvarchar(1000) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [content_strategies_created_at_df] DEFAULT sysutcdatetime(),
      [archived_at] datetime2 NULL,
      [row_version] rowversion,
      CONSTRAINT [content_strategies_pkey] PRIMARY KEY CLUSTERED ([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[content_strategy_versions]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[content_strategy_versions] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [content_strategy_versions_id_df] DEFAULT newid(),
      [strategy_id] uniqueidentifier NOT NULL,
      [version_number] int NOT NULL,
      [status] varchar(20) NOT NULL,
      [effective_date] datetime2 NULL,
      [last_validated_at] datetime2 NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [content_strategy_versions_created_at_df] DEFAULT sysutcdatetime(),
      [updated_at] datetime2 NOT NULL CONSTRAINT [content_strategy_versions_updated_at_df] DEFAULT sysutcdatetime(),
      [row_version] rowversion,
      CONSTRAINT [content_strategy_versions_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [content_strategy_versions_strategy_id_fkey]
        FOREIGN KEY ([strategy_id]) REFERENCES [dbo].[content_strategies]([id]),
      CONSTRAINT [UQ_strategy_version] UNIQUE ([strategy_id], [version_number]),
      CONSTRAINT [CK_content_strategy_versions_status] CHECK (
        [status] IN ('DRAFT','IN_REVIEW','INVALID','READY','ACTIVE','SUPERSEDED','ARCHIVED','BLOCKED')
      )
    );
  END

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_one_active_strategy'
      AND object_id = OBJECT_ID(N'[dbo].[content_strategy_versions]')
  )
  BEGIN
    CREATE UNIQUE INDEX [UX_one_active_strategy]
      ON [dbo].[content_strategy_versions]([strategy_id])
      WHERE [status] = 'ACTIVE';
  END

  IF OBJECT_ID(N'[dbo].[strategy_records]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[strategy_records] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [strategy_records_id_df] DEFAULT newid(),
      [version_id] uniqueidentifier NOT NULL,
      [section_key] varchar(40) NOT NULL,
      [record_name] nvarchar(240) NOT NULL,
      [record_type] nvarchar(100) NULL,
      [status] varchar(20) NOT NULL CONSTRAINT [strategy_records_status_df] DEFAULT 'ACTIVE',
      [priority] int NOT NULL CONSTRAINT [strategy_records_priority_df] DEFAULT 50,
      [configuration_json] nvarchar(max) NOT NULL CONSTRAINT [strategy_records_configuration_json_df] DEFAULT '{}',
      [effective_from] datetime2 NULL,
      [effective_to] datetime2 NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [strategy_records_created_at_df] DEFAULT sysutcdatetime(),
      [updated_at] datetime2 NOT NULL CONSTRAINT [strategy_records_updated_at_df] DEFAULT sysutcdatetime(),
      [archived_at] datetime2 NULL,
      [row_version] rowversion,
      CONSTRAINT [strategy_records_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [strategy_records_version_id_fkey]
        FOREIGN KEY ([version_id]) REFERENCES [dbo].[content_strategy_versions]([id]),
      CONSTRAINT [CK_strategy_records_priority] CHECK ([priority] BETWEEN 0 AND 100),
      CONSTRAINT [CK_strategy_records_configuration_json] CHECK (ISJSON([configuration_json]) = 1)
    );
    CREATE INDEX [IX_strategy_records_section]
      ON [dbo].[strategy_records]([version_id], [section_key], [status])
      INCLUDE ([record_name], [priority]);
  END

  IF OBJECT_ID(N'[dbo].[strategy_taxonomy_relationships]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[strategy_taxonomy_relationships] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [strategy_taxonomy_relationships_id_df] DEFAULT newid(),
      [version_id] uniqueidentifier NOT NULL,
      [parent_record_id] uniqueidentifier NOT NULL,
      [child_record_id] uniqueidentifier NOT NULL,
      [relationship_type] varchar(30) NOT NULL,
      CONSTRAINT [strategy_taxonomy_relationships_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [strategy_taxonomy_relationships_version_id_fkey]
        FOREIGN KEY ([version_id]) REFERENCES [dbo].[content_strategy_versions]([id]),
      CONSTRAINT [strategy_taxonomy_relationships_parent_record_id_fkey]
        FOREIGN KEY ([parent_record_id]) REFERENCES [dbo].[strategy_records]([id]),
      CONSTRAINT [strategy_taxonomy_relationships_child_record_id_fkey]
        FOREIGN KEY ([child_record_id]) REFERENCES [dbo].[strategy_records]([id]),
      CONSTRAINT [UQ_taxonomy_edge] UNIQUE ([version_id], [parent_record_id], [child_record_id], [relationship_type])
    );
  END

  IF OBJECT_ID(N'[dbo].[strategy_validation_runs]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[strategy_validation_runs] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [strategy_validation_runs_id_df] DEFAULT newid(),
      [version_id] uniqueidentifier NOT NULL,
      [idempotency_key] varchar(100) NULL,
      [status] varchar(20) NOT NULL,
      [started_at] datetime2 NOT NULL CONSTRAINT [strategy_validation_runs_started_at_df] DEFAULT sysutcdatetime(),
      [completed_at] datetime2 NULL,
      [summary_json] nvarchar(max) NULL,
      CONSTRAINT [strategy_validation_runs_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [strategy_validation_runs_version_id_fkey]
        FOREIGN KEY ([version_id]) REFERENCES [dbo].[content_strategy_versions]([id]),
      CONSTRAINT [CK_strategy_validation_runs_summary_json]
        CHECK ([summary_json] IS NULL OR ISJSON([summary_json]) = 1)
    );
  END

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_validation_idempotency'
      AND object_id = OBJECT_ID(N'[dbo].[strategy_validation_runs]')
  )
  BEGIN
    CREATE UNIQUE INDEX [UX_validation_idempotency]
      ON [dbo].[strategy_validation_runs]([version_id], [idempotency_key])
      WHERE [idempotency_key] IS NOT NULL;
  END

  IF OBJECT_ID(N'[dbo].[strategy_validation_results]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[strategy_validation_results] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [strategy_validation_results_id_df] DEFAULT newid(),
      [run_id] uniqueidentifier NOT NULL,
      [rule_code] varchar(80) NOT NULL,
      [rule_version] int NOT NULL,
      [severity] varchar(20) NOT NULL,
      [passed] bit NOT NULL,
      [blocking] bit NOT NULL,
      [section_key] varchar(40) NULL,
      [affected_record_id] uniqueidentifier NULL,
      [explanation] nvarchar(1000) NOT NULL,
      [recommendation] nvarchar(1000) NULL,
      [checked_at] datetime2 NOT NULL CONSTRAINT [strategy_validation_results_checked_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [strategy_validation_results_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [strategy_validation_results_run_id_fkey]
        FOREIGN KEY ([run_id]) REFERENCES [dbo].[strategy_validation_runs]([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[strategy_blockers]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[strategy_blockers] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [strategy_blockers_id_df] DEFAULT newid(),
      [version_id] uniqueidentifier NOT NULL,
      [severity] varchar(20) NOT NULL,
      [section_key] varchar(40) NULL,
      [message] nvarchar(1000) NOT NULL,
      [recommendation] nvarchar(1000) NULL,
      [resolved_at] datetime2 NULL,
      [first_detected_at] datetime2 NOT NULL CONSTRAINT [strategy_blockers_first_detected_at_df] DEFAULT sysutcdatetime(),
      [last_checked_at] datetime2 NOT NULL CONSTRAINT [strategy_blockers_last_checked_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [strategy_blockers_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [strategy_blockers_version_id_fkey]
        FOREIGN KEY ([version_id]) REFERENCES [dbo].[content_strategy_versions]([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[strategy_packages]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[strategy_packages] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [strategy_packages_id_df] DEFAULT newid(),
      [version_id] uniqueidentifier NOT NULL,
      [checksum] char(64) NOT NULL,
      [package_json] nvarchar(max) NOT NULL,
      [generated_at] datetime2 NOT NULL CONSTRAINT [strategy_packages_generated_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [strategy_packages_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [strategy_packages_version_id_key] UNIQUE ([version_id]),
      CONSTRAINT [strategy_packages_version_id_fkey]
        FOREIGN KEY ([version_id]) REFERENCES [dbo].[content_strategy_versions]([id]),
      CONSTRAINT [CK_strategy_packages_package_json] CHECK (ISJSON([package_json]) = 1)
    );
  END

  IF OBJECT_ID(N'[dbo].[strategy_handoffs]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[strategy_handoffs] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [strategy_handoffs_id_df] DEFAULT newid(),
      [package_id] uniqueidentifier NOT NULL,
      [status] varchar(30) NOT NULL,
      [retry_count] int NOT NULL CONSTRAINT [strategy_handoffs_retry_count_df] DEFAULT 0,
      [acknowledged_checksum] char(64) NULL,
      [consumed_at] datetime2 NULL,
      [failure_reason] nvarchar(1000) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [strategy_handoffs_created_at_df] DEFAULT sysutcdatetime(),
      [updated_at] datetime2 NOT NULL CONSTRAINT [strategy_handoffs_updated_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [strategy_handoffs_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [strategy_handoffs_package_id_fkey]
        FOREIGN KEY ([package_id]) REFERENCES [dbo].[strategy_packages]([id])
    );
  END

  IF OBJECT_ID(N'[dbo].[strategy_outbox]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[strategy_outbox] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [strategy_outbox_id_df] DEFAULT newid(),
      [event_type] varchar(100) NOT NULL,
      [aggregate_id] uniqueidentifier NOT NULL,
      [payload_json] nvarchar(max) NOT NULL,
      [status] varchar(20) NOT NULL CONSTRAINT [strategy_outbox_status_df] DEFAULT 'PENDING',
      [attempts] int NOT NULL CONSTRAINT [strategy_outbox_attempts_df] DEFAULT 0,
      [next_attempt_at] datetime2 NOT NULL CONSTRAINT [strategy_outbox_next_attempt_at_df] DEFAULT sysutcdatetime(),
      [created_at] datetime2 NOT NULL CONSTRAINT [strategy_outbox_created_at_df] DEFAULT sysutcdatetime(),
      [processed_at] datetime2 NULL,
      CONSTRAINT [strategy_outbox_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [CK_strategy_outbox_payload_json] CHECK (ISJSON([payload_json]) = 1)
    );
    CREATE INDEX [IX_strategy_outbox_pending]
      ON [dbo].[strategy_outbox]([status], [next_attempt_at]);
  END

  IF OBJECT_ID(N'[dbo].[strategy_audit_events]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[strategy_audit_events] (
      [id] uniqueidentifier NOT NULL CONSTRAINT [strategy_audit_events_id_df] DEFAULT newid(),
      [version_id] uniqueidentifier NULL,
      [action] varchar(100) NOT NULL,
      [actor_type] varchar(30) NOT NULL,
      [actor_reference] nvarchar(200) NULL,
      [request_id] varchar(100) NULL,
      [correlation_id] varchar(100) NULL,
      [previous_value] nvarchar(max) NULL,
      [new_value] nvarchar(max) NULL,
      [reason] nvarchar(1000) NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [strategy_audit_events_created_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [strategy_audit_events_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [CK_strategy_audit_events_actor_type]
        CHECK ([actor_type] IN ('SYSTEM','DEVELOPMENT_USER','SERVICE'))
    );
  END

  IF OBJECT_ID(N'[dbo].[strategy_objectives]', N'V') IS NULL
    EXEC(N'CREATE VIEW [dbo].[strategy_objectives] AS SELECT * FROM [dbo].[strategy_records] WHERE section_key = ''objectives''');
  IF OBJECT_ID(N'[dbo].[strategy_domains]', N'V') IS NULL
    EXEC(N'CREATE VIEW [dbo].[strategy_domains] AS SELECT * FROM [dbo].[strategy_records] WHERE section_key = ''domains''');
  IF OBJECT_ID(N'[dbo].[strategy_taxonomy_nodes]', N'V') IS NULL
    EXEC(N'CREATE VIEW [dbo].[strategy_taxonomy_nodes] AS SELECT * FROM [dbo].[strategy_records] WHERE section_key = ''taxonomy''');
  IF OBJECT_ID(N'[dbo].[strategy_geographies]', N'V') IS NULL
    EXEC(N'CREATE VIEW [dbo].[strategy_geographies] AS SELECT * FROM [dbo].[strategy_records] WHERE section_key = ''geographies''');
  IF OBJECT_ID(N'[dbo].[strategy_audiences]', N'V') IS NULL
    EXEC(N'CREATE VIEW [dbo].[strategy_audiences] AS SELECT * FROM [dbo].[strategy_records] WHERE section_key = ''audiences''');
  IF OBJECT_ID(N'[dbo].[strategy_editorial_policies]', N'V') IS NULL
    EXEC(N'CREATE VIEW [dbo].[strategy_editorial_policies] AS SELECT * FROM [dbo].[strategy_records] WHERE section_key = ''editorial-policy''');
  IF OBJECT_ID(N'[dbo].[strategy_format_policies]', N'V') IS NULL
    EXEC(N'CREATE VIEW [dbo].[strategy_format_policies] AS SELECT * FROM [dbo].[strategy_records] WHERE section_key = ''formats''');
  IF OBJECT_ID(N'[dbo].[strategy_channel_policies]', N'V') IS NULL
    EXEC(N'CREATE VIEW [dbo].[strategy_channel_policies] AS SELECT * FROM [dbo].[strategy_records] WHERE section_key = ''channels''');
  IF OBJECT_ID(N'[dbo].[strategy_localisation_rules]', N'V') IS NULL
    EXEC(N'CREATE VIEW [dbo].[strategy_localisation_rules] AS SELECT * FROM [dbo].[strategy_records] WHERE section_key = ''localisation''');
  IF OBJECT_ID(N'[dbo].[strategy_source_policies]', N'V') IS NULL
    EXEC(N'CREATE VIEW [dbo].[strategy_source_policies] AS SELECT * FROM [dbo].[strategy_records] WHERE section_key = ''source-policy''');
  IF OBJECT_ID(N'[dbo].[strategy_risk_policies]', N'V') IS NULL
    EXEC(N'CREATE VIEW [dbo].[strategy_risk_policies] AS SELECT * FROM [dbo].[strategy_records] WHERE section_key = ''risk-policy''');
  IF OBJECT_ID(N'[dbo].[strategy_selection_thresholds]', N'V') IS NULL
    EXEC(N'CREATE VIEW [dbo].[strategy_selection_thresholds] AS SELECT * FROM [dbo].[strategy_records] WHERE section_key = ''selection-thresholds''');
  IF OBJECT_ID(N'[dbo].[strategy_portfolio_allocations]', N'V') IS NULL
    EXEC(N'CREATE VIEW [dbo].[strategy_portfolio_allocations] AS SELECT * FROM [dbo].[strategy_records] WHERE section_key = ''portfolio''');

  -- Development seed: empty DRAFT only (idempotent)
  IF NOT EXISTS (SELECT 1 FROM [dbo].[content_strategies] WHERE archived_at IS NULL)
  BEGIN
    DECLARE @strategy uniqueidentifier = newid();
    DECLARE @version uniqueidentifier = newid();
    INSERT INTO [dbo].[content_strategies]([id], [name], [description])
    VALUES (@strategy, N'CACSMS Content Strategy', N'Initial development strategy');
    INSERT INTO [dbo].[content_strategy_versions]([id], [strategy_id], [version_number], [status])
    VALUES (@version, @strategy, 1, 'DRAFT');
    INSERT INTO [dbo].[strategy_audit_events]([version_id], [action], [actor_type], [reason])
    VALUES (
      @version,
      'DRAFT_CREATED',
      'DEVELOPMENT_USER',
      N'Initial schema seed; no production metrics or policy records were fabricated'
    );
  END

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
