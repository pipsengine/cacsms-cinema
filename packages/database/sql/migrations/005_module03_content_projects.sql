/* Module 03 — Content Projects */
IF COL_LENGTH('dbo.ContentProjects','Description') IS NULL ALTER TABLE dbo.ContentProjects ADD Description NVARCHAR(1500) NULL;
IF COL_LENGTH('dbo.ContentProjects','ContentType') IS NULL ALTER TABLE dbo.ContentProjects ADD ContentType NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.ContentProjects','PrimaryPlatform') IS NULL ALTER TABLE dbo.ContentProjects ADD PrimaryPlatform NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.ContentProjects','TargetAudience') IS NULL ALTER TABLE dbo.ContentProjects ADD TargetAudience NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.ContentProjects','TargetCountriesJson') IS NULL ALTER TABLE dbo.ContentProjects ADD TargetCountriesJson NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.ContentProjects','Language') IS NULL ALTER TABLE dbo.ContentProjects ADD Language NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.ContentProjects','PlannedDurationSeconds') IS NULL ALTER TABLE dbo.ContentProjects ADD PlannedDurationSeconds INT NULL;
IF COL_LENGTH('dbo.ContentProjects','AspectRatio') IS NULL ALTER TABLE dbo.ContentProjects ADD AspectRatio NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.ContentProjects','Category') IS NULL ALTER TABLE dbo.ContentProjects ADD Category NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.ContentProjects','Objective') IS NULL ALTER TABLE dbo.ContentProjects ADD Objective NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.ContentProjects','Priority') IS NULL ALTER TABLE dbo.ContentProjects ADD Priority NVARCHAR(20) NOT NULL CONSTRAINT DF_ContentProjects_Priority DEFAULT 'MEDIUM';
IF COL_LENGTH('dbo.ContentProjects','DeadlineAt') IS NULL ALTER TABLE dbo.ContentProjects ADD DeadlineAt DATETIME2 NULL;
IF COL_LENGTH('dbo.ContentProjects','BudgetLimit') IS NULL ALTER TABLE dbo.ContentProjects ADD BudgetLimit DECIMAL(18,2) NULL;
IF COL_LENGTH('dbo.ContentProjects','CreativeDirection') IS NULL ALTER TABLE dbo.ContentProjects ADD CreativeDirection NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.ContentProjects','CreatedByUserId') IS NULL ALTER TABLE dbo.ContentProjects ADD CreatedByUserId UNIQUEIDENTIFIER NULL;
IF COL_LENGTH('dbo.ContentProjects','ArchivedAt') IS NULL ALTER TABLE dbo.ContentProjects ADD ArchivedAt DATETIME2 NULL;
GO

IF OBJECT_ID('dbo.ProjectDistributionTargets','U') IS NULL
BEGIN
 CREATE TABLE dbo.ProjectDistributionTargets(
  ProjectDistributionTargetId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProjectDistributionTargets PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  ContentProjectId UNIQUEIDENTIFIER NOT NULL,
  Platform NVARCHAR(50) NOT NULL,
  ContentFormat NVARCHAR(50) NOT NULL,
  IsPrimary BIT NOT NULL CONSTRAINT DF_ProjectDistributionTargets_Primary DEFAULT 0,
  AspectRatio NVARCHAR(20) NULL,
  TargetDurationSeconds INT NULL,
  Status NVARCHAR(30) NOT NULL CONSTRAINT DF_ProjectDistributionTargets_Status DEFAULT 'PLANNED',
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ProjectDistributionTargets_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ProjectDistributionTargets_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId) ON DELETE CASCADE,
  CONSTRAINT CK_ProjectDistributionTargets_Status CHECK(Status IN('PLANNED','READY','PUBLISHED','DISABLED'))
 );
 CREATE INDEX IX_ProjectDistributionTargets_Project ON dbo.ProjectDistributionTargets(ContentProjectId);
END;
GO

IF OBJECT_ID('dbo.ProjectCollaborators','U') IS NULL
BEGIN
 CREATE TABLE dbo.ProjectCollaborators(
  ContentProjectId UNIQUEIDENTIFIER NOT NULL,
  UserId UNIQUEIDENTIFIER NOT NULL,
  ProjectRole NVARCHAR(50) NOT NULL,
  AddedAt DATETIME2 NOT NULL CONSTRAINT DF_ProjectCollaborators_AddedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_ProjectCollaborators PRIMARY KEY(ContentProjectId,UserId),
  CONSTRAINT FK_ProjectCollaborators_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId) ON DELETE CASCADE,
  CONSTRAINT FK_ProjectCollaborators_User FOREIGN KEY(UserId) REFERENCES dbo.Users(UserId)
 );
END;
GO

IF OBJECT_ID('dbo.ProjectAssets','U') IS NULL
BEGIN
 CREATE TABLE dbo.ProjectAssets(
  ProjectAssetId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProjectAssets PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  ContentProjectId UNIQUEIDENTIFIER NOT NULL,
  StageKey NVARCHAR(80) NULL,
  AssetType NVARCHAR(50) NOT NULL,
  FileName NVARCHAR(260) NOT NULL,
  StorageUrl NVARCHAR(1000) NULL,
  MimeType NVARCHAR(150) NULL,
  FileSizeBytes BIGINT NULL,
  VersionNumber INT NOT NULL CONSTRAINT DF_ProjectAssets_Version DEFAULT 1,
  IsMaster BIT NOT NULL CONSTRAINT DF_ProjectAssets_Master DEFAULT 0,
  Status NVARCHAR(30) NOT NULL CONSTRAINT DF_ProjectAssets_Status DEFAULT 'ACTIVE',
  MetadataJson NVARCHAR(MAX) NULL,
  CreatedByUserId UNIQUEIDENTIFIER NULL,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ProjectAssets_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ProjectAssets_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId) ON DELETE CASCADE,
  CONSTRAINT FK_ProjectAssets_User FOREIGN KEY(CreatedByUserId) REFERENCES dbo.Users(UserId),
  CONSTRAINT CK_ProjectAssets_Status CHECK(Status IN('ACTIVE','APPROVED','REJECTED','SUPERSEDED','ARCHIVED'))
 );
 CREATE INDEX IX_ProjectAssets_Project_Stage ON dbo.ProjectAssets(ContentProjectId,StageKey,AssetType);
END;
GO

IF OBJECT_ID('dbo.ProjectVersions','U') IS NULL
BEGIN
 CREATE TABLE dbo.ProjectVersions(
  ProjectVersionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProjectVersions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  ContentProjectId UNIQUEIDENTIFIER NOT NULL,
  VersionType NVARCHAR(60) NOT NULL,
  VersionNumber INT NOT NULL,
  SourceStageKey NVARCHAR(80) NULL,
  Title NVARCHAR(250) NOT NULL,
  SnapshotJson NVARCHAR(MAX) NOT NULL,
  ChangeSummary NVARCHAR(1000) NULL,
  IsApproved BIT NOT NULL CONSTRAINT DF_ProjectVersions_Approved DEFAULT 0,
  CreatedByUserId UNIQUEIDENTIFIER NULL,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ProjectVersions_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ProjectVersions_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId) ON DELETE CASCADE,
  CONSTRAINT FK_ProjectVersions_User FOREIGN KEY(CreatedByUserId) REFERENCES dbo.Users(UserId),
  CONSTRAINT UQ_ProjectVersions_Type UNIQUE(ContentProjectId,VersionType,VersionNumber)
 );
 CREATE INDEX IX_ProjectVersions_Project_Type ON dbo.ProjectVersions(ContentProjectId,VersionType,VersionNumber DESC);
END;
GO

IF OBJECT_ID('dbo.ProjectApprovals','U') IS NULL
BEGIN
 CREATE TABLE dbo.ProjectApprovals(
  ProjectApprovalId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProjectApprovals PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  ContentProjectId UNIQUEIDENTIFIER NOT NULL,
  StageKey NVARCHAR(80) NULL,
  ApprovalType NVARCHAR(80) NOT NULL,
  Status NVARCHAR(30) NOT NULL CONSTRAINT DF_ProjectApprovals_Status DEFAULT 'PENDING',
  RequestedByUserId UNIQUEIDENTIFIER NULL,
  AssignedToUserId UNIQUEIDENTIFIER NULL,
  DecisionByUserId UNIQUEIDENTIFIER NULL,
  RequestNote NVARCHAR(1000) NULL,
  DecisionComment NVARCHAR(2000) NULL,
  RequestedAt DATETIME2 NOT NULL CONSTRAINT DF_ProjectApprovals_RequestedAt DEFAULT SYSUTCDATETIME(),
  DecidedAt DATETIME2 NULL,
  CONSTRAINT FK_ProjectApprovals_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId) ON DELETE CASCADE,
  CONSTRAINT FK_ProjectApprovals_Requester FOREIGN KEY(RequestedByUserId) REFERENCES dbo.Users(UserId),
  CONSTRAINT FK_ProjectApprovals_Assignee FOREIGN KEY(AssignedToUserId) REFERENCES dbo.Users(UserId),
  CONSTRAINT FK_ProjectApprovals_Decider FOREIGN KEY(DecisionByUserId) REFERENCES dbo.Users(UserId),
  CONSTRAINT CK_ProjectApprovals_Status CHECK(Status IN('PENDING','APPROVED','REJECTED','RETURNED','CANCELLED'))
 );
 CREATE INDEX IX_ProjectApprovals_Project_Status ON dbo.ProjectApprovals(ContentProjectId,Status);
END;
GO

IF OBJECT_ID('dbo.ProjectActivities','U') IS NULL
BEGIN
 CREATE TABLE dbo.ProjectActivities(
  ProjectActivityId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProjectActivities PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  ContentProjectId UNIQUEIDENTIFIER NOT NULL,
  ActivityType NVARCHAR(60) NOT NULL,
  StageKey NVARCHAR(80) NULL,
  Title NVARCHAR(250) NOT NULL,
  Details NVARCHAR(2000) NULL,
  ActorType NVARCHAR(20) NOT NULL CONSTRAINT DF_ProjectActivities_Actor DEFAULT 'SYSTEM',
  ActorUserId UNIQUEIDENTIFIER NULL,
  AgentName NVARCHAR(150) NULL,
  MetadataJson NVARCHAR(MAX) NULL,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ProjectActivities_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ProjectActivities_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId) ON DELETE CASCADE,
  CONSTRAINT FK_ProjectActivities_User FOREIGN KEY(ActorUserId) REFERENCES dbo.Users(UserId),
  CONSTRAINT CK_ProjectActivities_Actor CHECK(ActorType IN('HUMAN','AI','SYSTEM'))
 );
 CREATE INDEX IX_ProjectActivities_Project_Created ON dbo.ProjectActivities(ContentProjectId,CreatedAt DESC);
END;
GO

IF OBJECT_ID('dbo.ProjectHandoffs','U') IS NULL
BEGIN
 CREATE TABLE dbo.ProjectHandoffs(
  ProjectHandoffId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProjectHandoffs PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  ContentProjectId UNIQUEIDENTIFIER NOT NULL,
  FromStageKey NVARCHAR(80) NOT NULL,
  ToStageKey NVARCHAR(80) NOT NULL,
  OutputType NVARCHAR(80) NOT NULL,
  ProjectVersionId UNIQUEIDENTIFIER NULL,
  OutputReference NVARCHAR(500) NULL,
  PayloadJson NVARCHAR(MAX) NULL,
  Status NVARCHAR(30) NOT NULL CONSTRAINT DF_ProjectHandoffs_Status DEFAULT 'READY',
  CreatedByUserId UNIQUEIDENTIFIER NULL,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ProjectHandoffs_CreatedAt DEFAULT SYSUTCDATETIME(),
  ConsumedAt DATETIME2 NULL,
  CONSTRAINT FK_ProjectHandoffs_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId) ON DELETE CASCADE,
  CONSTRAINT FK_ProjectHandoffs_Version FOREIGN KEY(ProjectVersionId) REFERENCES dbo.ProjectVersions(ProjectVersionId),
  CONSTRAINT FK_ProjectHandoffs_User FOREIGN KEY(CreatedByUserId) REFERENCES dbo.Users(UserId),
  CONSTRAINT CK_ProjectHandoffs_Status CHECK(Status IN('READY','CONSUMED','REJECTED','SUPERSEDED'))
 );
 CREATE INDEX IX_ProjectHandoffs_Project_ToStage ON dbo.ProjectHandoffs(ContentProjectId,ToStageKey,Status);
END;
GO
