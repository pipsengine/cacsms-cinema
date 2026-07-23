-- Strategy autonomy runs (Start/Stop) for section bootstrap without human form input.
-- Does not fabricate production measurement values.

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'[dbo].[strategy_autonomy_runs]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[strategy_autonomy_runs] (
      [id] uniqueidentifier NOT NULL,
      [version_id] uniqueidentifier NOT NULL,
      [section_key] varchar(40) NOT NULL,
      [idempotency_key] varchar(100) NOT NULL,
      [status] varchar(30) NOT NULL,
      [cancel_requested] bit NOT NULL CONSTRAINT [strategy_autonomy_runs_cancel_df] DEFAULT 0,
      [summary_json] nvarchar(max) NULL,
      [failure_reason] nvarchar(2000) NULL,
      [started_at] datetime2 NULL,
      [completed_at] datetime2 NULL,
      [created_at] datetime2 NOT NULL CONSTRAINT [strategy_autonomy_runs_created_at_df] DEFAULT sysutcdatetime(),
      [updated_at] datetime2 NOT NULL CONSTRAINT [strategy_autonomy_runs_updated_at_df] DEFAULT sysutcdatetime(),
      CONSTRAINT [strategy_autonomy_runs_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [strategy_autonomy_runs_version_id_fkey]
        FOREIGN KEY ([version_id]) REFERENCES [dbo].[content_strategy_versions]([id]),
      CONSTRAINT [UQ_strategy_autonomy_idempotency] UNIQUE ([idempotency_key]),
      CONSTRAINT [CK_strategy_autonomy_runs_status] CHECK (
        [status] IN ('QUEUED','RUNNING','COMPLETED','PARTIAL','FAILED','CANCELLED')
      ),
      CONSTRAINT [CK_strategy_autonomy_runs_summary_json] CHECK (
        [summary_json] IS NULL OR ISJSON([summary_json]) = 1
      )
    );

    CREATE INDEX [IX_strategy_autonomy_runs_section]
      ON [dbo].[strategy_autonomy_runs]([version_id], [section_key], [created_at] DESC);
  END

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
