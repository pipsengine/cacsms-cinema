SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.ContentBriefs','U') IS NULL
BEGIN
 CREATE TABLE dbo.ContentBriefs(
  ContentBriefId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ContentBriefs PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  ContentProjectId UNIQUEIDENTIFIER NOT NULL,
  CurrentVersionNumber INT NOT NULL CONSTRAINT DF_ContentBriefs_Version DEFAULT 1,
  Status NVARCHAR(30) NOT NULL CONSTRAINT DF_ContentBriefs_Status DEFAULT 'DRAFT',
  PrimaryObjective NVARCHAR(120) NULL,
  SecondaryObjectivesJson NVARCHAR(MAX) NULL,
  AudienceSummary NVARCHAR(1200) NULL,
  AudienceAgeRange NVARCHAR(60) NULL,
  AudienceKnowledgeLevel NVARCHAR(80) NULL,
  AudienceInterestsJson NVARCHAR(MAX) NULL,
  TargetCountriesJson NVARCHAR(MAX) NULL,
  DistributionPlatformsJson NVARCHAR(MAX) NULL,
  CreativeDirection NVARCHAR(120) NULL,
  StoryApproach NVARCHAR(120) NULL,
  VoiceStyle NVARCHAR(250) NULL,
  VisualStyle NVARCHAR(500) NULL,
  DesiredDurationSeconds INT NULL,
  AspectRatio NVARCHAR(20) NULL,
  Language NVARCHAR(50) NULL,
  CallToAction NVARCHAR(1000) NULL,
  MonetizationObjective NVARCHAR(500) NULL,
  ContentRestrictions NVARCHAR(2000) NULL,
  RequiredElements NVARCHAR(2000) NULL,
  AvoidElements NVARCHAR(2000) NULL,
  ReferenceCreators NVARCHAR(1000) NULL,
  ResearchFocus NVARCHAR(2000) NULL,
  SuccessDefinition NVARCHAR(2000) NULL,
  Notes NVARCHAR(2000) NULL,
  ApprovedVersionId UNIQUEIDENTIFIER NULL,
  ApprovedByUserId UNIQUEIDENTIFIER NULL,
  ApprovedAt DATETIME2 NULL,
  CreatedByUserId UNIQUEIDENTIFIER NULL,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ContentBriefs_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_ContentBriefs_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_ContentBriefs_Project UNIQUE(ContentProjectId),
  CONSTRAINT FK_ContentBriefs_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId) ON DELETE CASCADE,
  CONSTRAINT FK_ContentBriefs_Approver FOREIGN KEY(ApprovedByUserId) REFERENCES dbo.Users(UserId),
  CONSTRAINT FK_ContentBriefs_Creator FOREIGN KEY(CreatedByUserId) REFERENCES dbo.Users(UserId),
  CONSTRAINT CK_ContentBriefs_Status CHECK(Status IN('DRAFT','IN_REVIEW','APPROVED','RETURNED','SUPERSEDED'))
 );
 CREATE INDEX IX_ContentBriefs_Status ON dbo.ContentBriefs(Status,UpdatedAt DESC);
END;
GO

IF OBJECT_ID('dbo.ContentBriefVersions','U') IS NULL
BEGIN
 CREATE TABLE dbo.ContentBriefVersions(
  ContentBriefVersionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ContentBriefVersions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  ContentBriefId UNIQUEIDENTIFIER NOT NULL,
  VersionNumber INT NOT NULL,
  Status NVARCHAR(30) NOT NULL CONSTRAINT DF_ContentBriefVersions_Status DEFAULT 'DRAFT',
  SnapshotJson NVARCHAR(MAX) NOT NULL,
  ChangeSummary NVARCHAR(1000) NULL,
  CreatedByUserId UNIQUEIDENTIFIER NULL,
  ReviewedByUserId UNIQUEIDENTIFIER NULL,
  ReviewComment NVARCHAR(2000) NULL,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ContentBriefVersions_CreatedAt DEFAULT SYSUTCDATETIME(),
  ReviewedAt DATETIME2 NULL,
  CONSTRAINT FK_ContentBriefVersions_Brief FOREIGN KEY(ContentBriefId) REFERENCES dbo.ContentBriefs(ContentBriefId) ON DELETE CASCADE,
  CONSTRAINT FK_ContentBriefVersions_Creator FOREIGN KEY(CreatedByUserId) REFERENCES dbo.Users(UserId),
  CONSTRAINT FK_ContentBriefVersions_Reviewer FOREIGN KEY(ReviewedByUserId) REFERENCES dbo.Users(UserId),
  CONSTRAINT UQ_ContentBriefVersions UNIQUE(ContentBriefId,VersionNumber),
  CONSTRAINT CK_ContentBriefVersions_Status CHECK(Status IN('DRAFT','IN_REVIEW','APPROVED','RETURNED','SUPERSEDED'))
 );
 CREATE INDEX IX_ContentBriefVersions_Brief ON dbo.ContentBriefVersions(ContentBriefId,VersionNumber DESC);
END;
GO

IF COL_LENGTH('dbo.ContentBriefs','ApprovedVersionId') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_ContentBriefs_ApprovedVersion')
 ALTER TABLE dbo.ContentBriefs ADD CONSTRAINT FK_ContentBriefs_ApprovedVersion FOREIGN KEY(ApprovedVersionId) REFERENCES dbo.ContentBriefVersions(ContentBriefVersionId);
GO

IF OBJECT_ID('dbo.ContentBriefAudienceSegments','U') IS NULL
BEGIN
 CREATE TABLE dbo.ContentBriefAudienceSegments(
  AudienceSegmentId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ContentBriefAudienceSegments PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  ContentBriefId UNIQUEIDENTIFIER NOT NULL,
  SegmentName NVARCHAR(150) NOT NULL,
  Description NVARCHAR(1000) NULL,
  AgeRange NVARCHAR(60) NULL,
  MarketsJson NVARCHAR(MAX) NULL,
  InterestsJson NVARCHAR(MAX) NULL,
  NeedsJson NVARCHAR(MAX) NULL,
  PriorityOrder INT NOT NULL CONSTRAINT DF_ContentBriefAudienceSegments_Order DEFAULT 1,
  CONSTRAINT FK_ContentBriefAudienceSegments_Brief FOREIGN KEY(ContentBriefId) REFERENCES dbo.ContentBriefs(ContentBriefId) ON DELETE CASCADE
 );
END;
GO

IF OBJECT_ID('dbo.ContentBriefPlatformStrategies','U') IS NULL
BEGIN
 CREATE TABLE dbo.ContentBriefPlatformStrategies(
  PlatformStrategyId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ContentBriefPlatformStrategies PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  ContentBriefId UNIQUEIDENTIFIER NOT NULL,
  Platform NVARCHAR(60) NOT NULL,
  ContentFormat NVARCHAR(80) NOT NULL,
  IsPrimary BIT NOT NULL CONSTRAINT DF_ContentBriefPlatformStrategies_Primary DEFAULT 0,
  TargetDurationSeconds INT NULL,
  AspectRatio NVARCHAR(20) NULL,
  PlatformGoal NVARCHAR(500) NULL,
  PackagingNotes NVARCHAR(1000) NULL,
  CONSTRAINT FK_ContentBriefPlatformStrategies_Brief FOREIGN KEY(ContentBriefId) REFERENCES dbo.ContentBriefs(ContentBriefId) ON DELETE CASCADE,
  CONSTRAINT UQ_ContentBriefPlatformStrategies UNIQUE(ContentBriefId,Platform,ContentFormat)
 );
END;
GO

IF OBJECT_ID('dbo.ContentBriefReferences','U') IS NULL
BEGIN
 CREATE TABLE dbo.ContentBriefReferences(
  BriefReferenceId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ContentBriefReferences PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  ContentBriefId UNIQUEIDENTIFIER NOT NULL,
  ReferenceType NVARCHAR(50) NOT NULL,
  Title NVARCHAR(250) NOT NULL,
  Url NVARCHAR(1000) NULL,
  Notes NVARCHAR(1000) NULL,
  IsRequired BIT NOT NULL CONSTRAINT DF_ContentBriefReferences_Required DEFAULT 0,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ContentBriefReferences_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ContentBriefReferences_Brief FOREIGN KEY(ContentBriefId) REFERENCES dbo.ContentBriefs(ContentBriefId) ON DELETE CASCADE
 );
END;
GO

IF OBJECT_ID('dbo.ContentBriefSuccessMetrics','U') IS NULL
BEGIN
 CREATE TABLE dbo.ContentBriefSuccessMetrics(
  BriefSuccessMetricId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ContentBriefSuccessMetrics PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  ContentBriefId UNIQUEIDENTIFIER NOT NULL,
  MetricKey NVARCHAR(80) NOT NULL,
  DisplayName NVARCHAR(150) NOT NULL,
  TargetValue DECIMAL(18,4) NULL,
  TargetUnit NVARCHAR(50) NULL,
  PriorityOrder INT NOT NULL CONSTRAINT DF_ContentBriefSuccessMetrics_Order DEFAULT 1,
  Notes NVARCHAR(500) NULL,
  CONSTRAINT FK_ContentBriefSuccessMetrics_Brief FOREIGN KEY(ContentBriefId) REFERENCES dbo.ContentBriefs(ContentBriefId) ON DELETE CASCADE,
  CONSTRAINT UQ_ContentBriefSuccessMetrics UNIQUE(ContentBriefId,MetricKey)
 );
END;
GO
