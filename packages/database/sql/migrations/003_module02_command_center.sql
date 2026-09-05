/* Module 02 — Command Center operational schema */
IF OBJECT_ID('dbo.WorkflowStageDefinitions','U') IS NULL
BEGIN
 CREATE TABLE dbo.WorkflowStageDefinitions(
  WorkflowStageDefinitionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_WorkflowStageDefinitions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  StageKey NVARCHAR(80) NOT NULL, StageOrder INT NOT NULL, DisplayName NVARCHAR(120) NOT NULL,
  PhaseName NVARCHAR(100) NOT NULL, ModuleNumber INT NOT NULL, IsHumanGate BIT NOT NULL DEFAULT 0,
  IsActive BIT NOT NULL DEFAULT 1, CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_WorkflowStageDefinitions_Key UNIQUE(StageKey), CONSTRAINT UQ_WorkflowStageDefinitions_Order UNIQUE(StageOrder)
 );
END;
GO
IF OBJECT_ID('dbo.ProjectStageExecutions','U') IS NULL
BEGIN
 CREATE TABLE dbo.ProjectStageExecutions(
  ProjectStageExecutionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProjectStageExecutions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  ContentProjectId UNIQUEIDENTIFIER NOT NULL, WorkflowStageDefinitionId UNIQUEIDENTIFIER NOT NULL,
  Status NVARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED', ProgressPercent DECIMAL(5,2) NOT NULL DEFAULT 0,
  StartedAt DATETIME2 NULL, CompletedAt DATETIME2 NULL, PausedAt DATETIME2 NULL,
  AssignedUserId UNIQUEIDENTIFIER NULL, LastError NVARCHAR(1000) NULL, UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ProjectStageExecutions_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId),
  CONSTRAINT FK_ProjectStageExecutions_Definition FOREIGN KEY(WorkflowStageDefinitionId) REFERENCES dbo.WorkflowStageDefinitions(WorkflowStageDefinitionId),
  CONSTRAINT FK_ProjectStageExecutions_AssignedUser FOREIGN KEY(AssignedUserId) REFERENCES dbo.Users(UserId),
  CONSTRAINT UQ_ProjectStageExecutions UNIQUE(ContentProjectId,WorkflowStageDefinitionId),
  CONSTRAINT CK_ProjectStageExecutions_Status CHECK(Status IN('NOT_STARTED','IN_PROGRESS','COMPLETED','AWAITING_APPROVAL','PAUSED','BLOCKED','FAILED','AI_PROCESSING')),
  CONSTRAINT CK_ProjectStageExecutions_Progress CHECK(ProgressPercent BETWEEN 0 AND 100)
 );
 CREATE INDEX IX_ProjectStageExecutions_Project_Status ON dbo.ProjectStageExecutions(ContentProjectId,Status);
END;
GO
IF OBJECT_ID('dbo.ProjectControlEvents','U') IS NULL
BEGIN
 CREATE TABLE dbo.ProjectControlEvents(
  ProjectControlEventId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProjectControlEvents PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  ContentProjectId UNIQUEIDENTIFIER NOT NULL, Action NVARCHAR(30) NOT NULL, PreviousStatus NVARCHAR(30) NULL,
  NewStatus NVARCHAR(30) NOT NULL, Reason NVARCHAR(1000) NULL, PerformedByUserId UNIQUEIDENTIFIER NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ProjectControlEvents_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId),
  CONSTRAINT FK_ProjectControlEvents_User FOREIGN KEY(PerformedByUserId) REFERENCES dbo.Users(UserId),
  CONSTRAINT CK_ProjectControlEvents_Action CHECK(Action IN('START','PAUSE','RESUME','STOP','RESTART'))
 );
 CREATE INDEX IX_ProjectControlEvents_Project_Created ON dbo.ProjectControlEvents(ContentProjectId,CreatedAt DESC);
END;
GO
IF OBJECT_ID('dbo.WorkItems','U') IS NULL
BEGIN
 CREATE TABLE dbo.WorkItems(
  WorkItemId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_WorkItems PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  WorkspaceId UNIQUEIDENTIFIER NOT NULL, ContentProjectId UNIQUEIDENTIFIER NULL, StageKey NVARCHAR(80) NULL,
  Title NVARCHAR(220) NOT NULL, Description NVARCHAR(1000) NULL, WorkType NVARCHAR(40) NOT NULL DEFAULT 'TASK',
  Priority NVARCHAR(20) NOT NULL DEFAULT 'MEDIUM', Status NVARCHAR(30) NOT NULL DEFAULT 'OPEN',
  AssignedUserId UNIQUEIDENTIFIER NULL, DueAt DATETIME2 NULL, CompletedAt DATETIME2 NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_WorkItems_Workspace FOREIGN KEY(WorkspaceId) REFERENCES dbo.Workspaces(WorkspaceId),
  CONSTRAINT FK_WorkItems_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId),
  CONSTRAINT FK_WorkItems_User FOREIGN KEY(AssignedUserId) REFERENCES dbo.Users(UserId),
  CONSTRAINT CK_WorkItems_Priority CHECK(Priority IN('LOW','MEDIUM','HIGH','URGENT')),
  CONSTRAINT CK_WorkItems_Status CHECK(Status IN('OPEN','IN_PROGRESS','WAITING','COMPLETED','CANCELLED'))
 );
 CREATE INDEX IX_WorkItems_Assignee_Status ON dbo.WorkItems(AssignedUserId,Status,DueAt);
END;
GO
IF OBJECT_ID('dbo.Notifications','U') IS NULL
BEGIN
 CREATE TABLE dbo.Notifications(
  NotificationId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  WorkspaceId UNIQUEIDENTIFIER NULL, UserId UNIQUEIDENTIFIER NOT NULL, Category NVARCHAR(40) NOT NULL,
  Severity NVARCHAR(20) NOT NULL DEFAULT 'INFO', Title NVARCHAR(220) NOT NULL, Message NVARCHAR(1500) NOT NULL,
  ActionUrl NVARCHAR(500) NULL, IsRead BIT NOT NULL DEFAULT 0, ReadAt DATETIME2 NULL, CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Notifications_Workspace FOREIGN KEY(WorkspaceId) REFERENCES dbo.Workspaces(WorkspaceId),
  CONSTRAINT FK_Notifications_User FOREIGN KEY(UserId) REFERENCES dbo.Users(UserId),
  CONSTRAINT CK_Notifications_Severity CHECK(Severity IN('INFO','SUCCESS','WARNING','CRITICAL'))
 );
 CREATE INDEX IX_Notifications_User_Unread ON dbo.Notifications(UserId,IsRead,CreatedAt DESC);
END;
GO
IF OBJECT_ID('dbo.AgentRuns','U') IS NULL
BEGIN
 CREATE TABLE dbo.AgentRuns(
  AgentRunId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_AgentRuns PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  WorkspaceId UNIQUEIDENTIFIER NOT NULL, ContentProjectId UNIQUEIDENTIFIER NULL, AgentKey NVARCHAR(100) NOT NULL,
  AgentName NVARCHAR(150) NOT NULL, StageKey NVARCHAR(80) NULL, Status NVARCHAR(30) NOT NULL,
  ProgressPercent DECIMAL(5,2) NOT NULL DEFAULT 0, Provider NVARCHAR(100) NULL, Model NVARCHAR(150) NULL,
  StartedAt DATETIME2 NULL, FinishedAt DATETIME2 NULL, ErrorMessage NVARCHAR(1000) NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_AgentRuns_Workspace FOREIGN KEY(WorkspaceId) REFERENCES dbo.Workspaces(WorkspaceId),
  CONSTRAINT FK_AgentRuns_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId),
  CONSTRAINT CK_AgentRuns_Status CHECK(Status IN('ONLINE','RUNNING','WAITING','COMPLETED','FAILED','DISABLED')),
  CONSTRAINT CK_AgentRuns_Progress CHECK(ProgressPercent BETWEEN 0 AND 100)
 );
 CREATE INDEX IX_AgentRuns_Workspace_Status ON dbo.AgentRuns(WorkspaceId,Status,UpdatedAt DESC);
END;
GO
IF OBJECT_ID('dbo.GenerationUsage','U') IS NULL
BEGIN
 CREATE TABLE dbo.GenerationUsage(
  GenerationUsageId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_GenerationUsage PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  WorkspaceId UNIQUEIDENTIFIER NOT NULL, ContentProjectId UNIQUEIDENTIFIER NULL, UsageType NVARCHAR(40) NOT NULL,
  Provider NVARCHAR(100) NOT NULL, Model NVARCHAR(150) NULL, Quantity DECIMAL(18,4) NOT NULL DEFAULT 1,
  Unit NVARCHAR(30) NOT NULL DEFAULT 'generation', EstimatedCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  Currency CHAR(3) NOT NULL DEFAULT 'USD', CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_GenerationUsage_Workspace FOREIGN KEY(WorkspaceId) REFERENCES dbo.Workspaces(WorkspaceId),
  CONSTRAINT FK_GenerationUsage_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId)
 );
 CREATE INDEX IX_GenerationUsage_Workspace_Created ON dbo.GenerationUsage(WorkspaceId,CreatedAt DESC);
END;
GO
IF OBJECT_ID('dbo.PublishingSchedule','U') IS NULL
BEGIN
 CREATE TABLE dbo.PublishingSchedule(
  PublishingScheduleId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_PublishingSchedule PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  WorkspaceId UNIQUEIDENTIFIER NOT NULL, ContentProjectId UNIQUEIDENTIFIER NOT NULL, Platform NVARCHAR(50) NOT NULL,
  ScheduledAt DATETIME2 NOT NULL, Status NVARCHAR(30) NOT NULL DEFAULT 'SCHEDULED', ExternalPublishId NVARCHAR(250) NULL,
  PublishedAt DATETIME2 NULL, CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_PublishingSchedule_Workspace FOREIGN KEY(WorkspaceId) REFERENCES dbo.Workspaces(WorkspaceId),
  CONSTRAINT FK_PublishingSchedule_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId),
  CONSTRAINT CK_PublishingSchedule_Status CHECK(Status IN('DRAFT','SCHEDULED','PUBLISHING','PUBLISHED','FAILED','CANCELLED'))
 );
 CREATE INDEX IX_PublishingSchedule_Workspace_Time ON dbo.PublishingSchedule(WorkspaceId,ScheduledAt);
END;
GO
