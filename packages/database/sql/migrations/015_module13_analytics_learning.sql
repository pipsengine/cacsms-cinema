/* Module 13 — Analytics & AI Learning */
IF OBJECT_ID('dbo.AnalyticsProfiles','U') IS NULL CREATE TABLE dbo.AnalyticsProfiles(
 AnalyticsProfileId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
 WorkspaceId UNIQUEIDENTIFIER NOT NULL, ContentProjectId UNIQUEIDENTIFIER NOT NULL, PublicationId UNIQUEIDENTIFIER NOT NULL,
 Status NVARCHAR(30) NOT NULL DEFAULT 'MONITORING', MonitoringWindowHours INT NOT NULL DEFAULT 48,
 LastIngestedAt DATETIME2 NULL, NextIngestionAt DATETIME2 NULL, BaselineScore DECIMAL(5,2) NULL,
 OverallPerformanceScore DECIMAL(5,2) NULL, LearningStatus NVARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
 CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_AnalyticsProfiles_Workspace FOREIGN KEY(WorkspaceId) REFERENCES dbo.Workspaces(WorkspaceId),
 CONSTRAINT FK_AnalyticsProfiles_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId),
 CONSTRAINT FK_AnalyticsProfiles_Publication FOREIGN KEY(PublicationId) REFERENCES dbo.Publications(PublicationId),
 CONSTRAINT UQ_AnalyticsProfiles_Publication UNIQUE(PublicationId)
);
IF OBJECT_ID('dbo.PerformanceSnapshots','U') IS NULL CREATE TABLE dbo.PerformanceSnapshots(
 PerformanceSnapshotId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY, AnalyticsProfileId UNIQUEIDENTIFIER NOT NULL,
 CapturedAt DATETIME2 NOT NULL, WindowLabel NVARCHAR(50) NULL, Impressions BIGINT NULL, Views BIGINT NULL, UniqueViewers BIGINT NULL,
 WatchTimeMinutes DECIMAL(18,2) NULL, AverageViewDurationSeconds DECIMAL(18,2) NULL, AveragePercentageViewed DECIMAL(8,3) NULL,
 ClickThroughRate DECIMAL(8,3) NULL, Likes BIGINT NULL, Comments BIGINT NULL, Shares BIGINT NULL, Saves BIGINT NULL,
 SubscribersGained BIGINT NULL, SubscribersLost BIGINT NULL, Revenue DECIMAL(18,4) NULL, RPM DECIMAL(18,4) NULL, CPM DECIMAL(18,4) NULL,
 EngagementRate DECIMAL(8,3) NULL, MetadataJson NVARCHAR(MAX) NULL,
 CONSTRAINT FK_PerformanceSnapshots_Profile FOREIGN KEY(AnalyticsProfileId) REFERENCES dbo.AnalyticsProfiles(AnalyticsProfileId)
);
IF OBJECT_ID('dbo.RetentionPoints','U') IS NULL CREATE TABLE dbo.RetentionPoints(
 RetentionPointId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY, PerformanceSnapshotId UNIQUEIDENTIFIER NOT NULL,
 SecondMark INT NOT NULL, RetentionPercent DECIMAL(8,3) NOT NULL, RelativeRetentionPercent DECIMAL(8,3) NULL, Marker NVARCHAR(120) NULL,
 CONSTRAINT FK_RetentionPoints_Snapshot FOREIGN KEY(PerformanceSnapshotId) REFERENCES dbo.PerformanceSnapshots(PerformanceSnapshotId)
);
IF OBJECT_ID('dbo.AudienceGeographies','U') IS NULL CREATE TABLE dbo.AudienceGeographies(
 AudienceGeographyId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY, AnalyticsProfileId UNIQUEIDENTIFIER NOT NULL,
 CountryCode NVARCHAR(10) NOT NULL, CountryName NVARCHAR(120) NOT NULL, Views BIGINT NULL, WatchTimeMinutes DECIMAL(18,2) NULL,
 ViewPercent DECIMAL(8,3) NULL, Revenue DECIMAL(18,4) NULL,
 CONSTRAINT FK_AudienceGeographies_Profile FOREIGN KEY(AnalyticsProfileId) REFERENCES dbo.AnalyticsProfiles(AnalyticsProfileId)
);
IF OBJECT_ID('dbo.TrafficSources','U') IS NULL CREATE TABLE dbo.TrafficSources(
 TrafficSourceId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY, AnalyticsProfileId UNIQUEIDENTIFIER NOT NULL,
 SourceType NVARCHAR(120) NOT NULL, Views BIGINT NULL, WatchTimeMinutes DECIMAL(18,2) NULL, ViewPercent DECIMAL(8,3) NULL,
 CONSTRAINT FK_TrafficSources_Profile FOREIGN KEY(AnalyticsProfileId) REFERENCES dbo.AnalyticsProfiles(AnalyticsProfileId)
);
IF OBJECT_ID('dbo.PerformanceBenchmarks','U') IS NULL CREATE TABLE dbo.PerformanceBenchmarks(
 PerformanceBenchmarkId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY, WorkspaceId UNIQUEIDENTIFIER NOT NULL,
 Platform NVARCHAR(60) NOT NULL, ContentFormat NVARCHAR(80) NULL, MetricKey NVARCHAR(100) NOT NULL, WindowHours INT NOT NULL,
 MedianValue DECIMAL(18,4) NULL, TopQuartileValue DECIMAL(18,4) NULL, SampleSize INT NOT NULL DEFAULT 0,
 CalculatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_PerformanceBenchmarks_Workspace FOREIGN KEY(WorkspaceId) REFERENCES dbo.Workspaces(WorkspaceId)
);
IF OBJECT_ID('dbo.AnalyticsAnomalies','U') IS NULL CREATE TABLE dbo.AnalyticsAnomalies(
 AnalyticsAnomalyId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY, AnalyticsProfileId UNIQUEIDENTIFIER NOT NULL,
 DetectedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), Severity NVARCHAR(20) NOT NULL, MetricKey NVARCHAR(100) NOT NULL,
 Title NVARCHAR(300) NOT NULL, Details NVARCHAR(3000) NULL, ExpectedValue DECIMAL(18,4) NULL, ActualValue DECIMAL(18,4) NULL,
 Status NVARCHAR(30) NOT NULL DEFAULT 'OPEN', Resolution NVARCHAR(3000) NULL,
 CONSTRAINT FK_AnalyticsAnomalies_Profile FOREIGN KEY(AnalyticsProfileId) REFERENCES dbo.AnalyticsProfiles(AnalyticsProfileId)
);
IF OBJECT_ID('dbo.ContentExperiments','U') IS NULL CREATE TABLE dbo.ContentExperiments(
 ContentExperimentId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY, AnalyticsProfileId UNIQUEIDENTIFIER NOT NULL,
 ExperimentType NVARCHAR(60) NOT NULL, Name NVARCHAR(250) NOT NULL, Hypothesis NVARCHAR(2000) NULL, VariantA NVARCHAR(MAX) NULL,
 VariantB NVARCHAR(MAX) NULL, StartedAt DATETIME2 NULL, EndedAt DATETIME2 NULL, Status NVARCHAR(30) NOT NULL DEFAULT 'DRAFT',
 Winner NVARCHAR(20) NULL, LiftPercent DECIMAL(8,3) NULL, ResultSummary NVARCHAR(3000) NULL, CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_ContentExperiments_Profile FOREIGN KEY(AnalyticsProfileId) REFERENCES dbo.AnalyticsProfiles(AnalyticsProfileId)
);
IF OBJECT_ID('dbo.LearningInsights','U') IS NULL CREATE TABLE dbo.LearningInsights(
 LearningInsightId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY, WorkspaceId UNIQUEIDENTIFIER NOT NULL,
 ContentProjectId UNIQUEIDENTIFIER NULL, AnalyticsProfileId UNIQUEIDENTIFIER NULL, InsightType NVARCHAR(60) NOT NULL,
 Category NVARCHAR(80) NOT NULL, Title NVARCHAR(300) NOT NULL, InsightText NVARCHAR(5000) NOT NULL, EvidenceJson NVARCHAR(MAX) NULL,
 ConfidenceScore DECIMAL(5,2) NULL, ImpactScore DECIMAL(5,2) NULL, Status NVARCHAR(30) NOT NULL DEFAULT 'PROPOSED',
 ApprovedByUserId UNIQUEIDENTIFIER NULL, ApprovedAt DATETIME2 NULL, CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_LearningInsights_Workspace FOREIGN KEY(WorkspaceId) REFERENCES dbo.Workspaces(WorkspaceId)
);
IF OBJECT_ID('dbo.ChannelKnowledge','U') IS NULL CREATE TABLE dbo.ChannelKnowledge(
 ChannelKnowledgeId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY, WorkspaceId UNIQUEIDENTIFIER NOT NULL,
 KnowledgeKey NVARCHAR(160) NOT NULL, Category NVARCHAR(80) NOT NULL, Statement NVARCHAR(4000) NOT NULL,
 EvidenceCount INT NOT NULL DEFAULT 1, ConfidenceScore DECIMAL(5,2) NULL, LastEvidenceAt DATETIME2 NULL, Status NVARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
 CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_ChannelKnowledge_Workspace FOREIGN KEY(WorkspaceId) REFERENCES dbo.Workspaces(WorkspaceId),
 CONSTRAINT UQ_ChannelKnowledge_Key UNIQUE(WorkspaceId,KnowledgeKey)
);
IF OBJECT_ID('dbo.LearningFeedback','U') IS NULL CREATE TABLE dbo.LearningFeedback(
 LearningFeedbackId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY, WorkspaceId UNIQUEIDENTIFIER NOT NULL,
 LearningInsightId UNIQUEIDENTIFIER NOT NULL, TargetModule NVARCHAR(80) NOT NULL, TargetRule NVARCHAR(160) NULL,
 PayloadJson NVARCHAR(MAX) NULL, Status NVARCHAR(30) NOT NULL DEFAULT 'READY', AppliedAt DATETIME2 NULL,
 CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_LearningFeedback_Workspace FOREIGN KEY(WorkspaceId) REFERENCES dbo.Workspaces(WorkspaceId),
 CONSTRAINT FK_LearningFeedback_Insight FOREIGN KEY(LearningInsightId) REFERENCES dbo.LearningInsights(LearningInsightId)
);
CREATE INDEX IX_PerformanceSnapshots_ProfileTime ON dbo.PerformanceSnapshots(AnalyticsProfileId,CapturedAt DESC);
CREATE INDEX IX_AnalyticsProfiles_WorkspaceStatus ON dbo.AnalyticsProfiles(WorkspaceId,Status,UpdatedAt DESC);
CREATE INDEX IX_LearningInsights_WorkspaceStatus ON dbo.LearningInsights(WorkspaceId,Status,CreatedAt DESC);
IF OBJECT_ID('dbo.ContentRecyclingPlans','U') IS NULL CREATE TABLE dbo.ContentRecyclingPlans(
 ContentRecyclingPlanId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY, WorkspaceId UNIQUEIDENTIFIER NOT NULL,
 ContentProjectId UNIQUEIDENTIFIER NOT NULL, PublicationId UNIQUEIDENTIFIER NOT NULL, SourceInsightId UNIQUEIDENTIFIER NULL,
 TargetPlatform NVARCHAR(60) NOT NULL, TargetFormat NVARCHAR(80) NOT NULL, WorkingTitle NVARCHAR(500) NULL,
 Rationale NVARCHAR(3000) NULL, TransformationBrief NVARCHAR(MAX) NULL, Priority NVARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
 Status NVARCHAR(30) NOT NULL DEFAULT 'PROPOSED', CreatedByUserId UNIQUEIDENTIFIER NULL, ApprovedByUserId UNIQUEIDENTIFIER NULL,
 ApprovedAt DATETIME2 NULL, CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_ContentRecyclingPlans_Workspace FOREIGN KEY(WorkspaceId) REFERENCES dbo.Workspaces(WorkspaceId),
 CONSTRAINT FK_ContentRecyclingPlans_Project FOREIGN KEY(ContentProjectId) REFERENCES dbo.ContentProjects(ContentProjectId),
 CONSTRAINT FK_ContentRecyclingPlans_Publication FOREIGN KEY(PublicationId) REFERENCES dbo.Publications(PublicationId)
);
IF OBJECT_ID('dbo.AnalyticsIngestionRuns','U') IS NULL CREATE TABLE dbo.AnalyticsIngestionRuns(
 AnalyticsIngestionRunId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY, AnalyticsProfileId UNIQUEIDENTIFIER NOT NULL,
 Platform NVARCHAR(60) NOT NULL, ProviderKey NVARCHAR(100) NOT NULL, Status NVARCHAR(30) NOT NULL DEFAULT 'QUEUED',
 WindowStart DATETIME2 NULL, WindowEnd DATETIME2 NULL, StartedAt DATETIME2 NULL, CompletedAt DATETIME2 NULL,
 RecordsReceived INT NULL, ErrorCode NVARCHAR(120) NULL, ErrorMessage NVARCHAR(3000) NULL, ProviderResponseJson NVARCHAR(MAX) NULL,
 CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_AnalyticsIngestionRuns_Profile FOREIGN KEY(AnalyticsProfileId) REFERENCES dbo.AnalyticsProfiles(AnalyticsProfileId)
);
CREATE INDEX IX_AnalyticsIngestionRuns_ProfileCreated ON dbo.AnalyticsIngestionRuns(AnalyticsProfileId,CreatedAt DESC);
