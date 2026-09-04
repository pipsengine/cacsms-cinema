IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_ContentProjects_Status'
      AND parent_object_id = OBJECT_ID('dbo.ContentProjects', 'U')
)
BEGIN
    ALTER TABLE dbo.ContentProjects
        DROP CONSTRAINT CK_ContentProjects_Status;
END;
GO

ALTER TABLE dbo.ContentProjects
    ADD CONSTRAINT CK_ContentProjects_Status
    CHECK (Status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','AWAITING_APPROVAL','PAUSED','BLOCKED','FAILED','AI_PROCESSING'));
GO
