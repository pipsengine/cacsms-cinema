IF OBJECT_ID('dbo.Workspaces', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Workspaces (
        WorkspaceId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Workspaces PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
        Name NVARCHAR(150) NOT NULL,
        Slug NVARCHAR(100) NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Workspaces_IsActive DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Workspaces_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Workspaces_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Workspaces_Slug UNIQUE (Slug)
    );
END;
GO

IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        UserId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Users PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
        Email NVARCHAR(320) NOT NULL,
        DisplayName NVARCHAR(150) NOT NULL,
        PasswordHash NVARCHAR(500) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Users_Email UNIQUE (Email)
    );
END;
GO

IF OBJECT_ID('dbo.Roles', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Roles (
        RoleId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Roles PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        IsSystemRole BIT NOT NULL CONSTRAINT DF_Roles_IsSystemRole DEFAULT 0,
        CONSTRAINT UQ_Roles_Name UNIQUE (Name)
    );
END;
GO

IF OBJECT_ID('dbo.WorkspaceUsers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.WorkspaceUsers (
        WorkspaceId UNIQUEIDENTIFIER NOT NULL,
        UserId UNIQUEIDENTIFIER NOT NULL,
        RoleId UNIQUEIDENTIFIER NOT NULL,
        JoinedAt DATETIME2 NOT NULL CONSTRAINT DF_WorkspaceUsers_JoinedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_WorkspaceUsers PRIMARY KEY (WorkspaceId, UserId),
        CONSTRAINT FK_WorkspaceUsers_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES dbo.Workspaces(WorkspaceId),
        CONSTRAINT FK_WorkspaceUsers_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_WorkspaceUsers_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId)
    );
END;
GO

IF OBJECT_ID('dbo.ContentProjects', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ContentProjects (
        ContentProjectId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ContentProjects PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
        WorkspaceId UNIQUEIDENTIFIER NOT NULL,
        ContentCode NVARCHAR(30) NOT NULL,
        WorkingTitle NVARCHAR(250) NOT NULL,
        Status NVARCHAR(30) NOT NULL CONSTRAINT DF_ContentProjects_Status DEFAULT 'NOT_STARTED',
        AutonomyMode NVARCHAR(30) NOT NULL CONSTRAINT DF_ContentProjects_Autonomy DEFAULT 'AI_ASSISTED',
        OwnerUserId UNIQUEIDENTIFIER NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ContentProjects_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_ContentProjects_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_ContentProjects_Code UNIQUE (WorkspaceId, ContentCode),
        CONSTRAINT FK_ContentProjects_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES dbo.Workspaces(WorkspaceId),
        CONSTRAINT FK_ContentProjects_Owner FOREIGN KEY (OwnerUserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT CK_ContentProjects_Status CHECK (Status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','AWAITING_APPROVAL','PAUSED','BLOCKED','FAILED'))
    );
END;
GO

CREATE INDEX IX_ContentProjects_Workspace_Status ON dbo.ContentProjects (WorkspaceId, Status);
GO
