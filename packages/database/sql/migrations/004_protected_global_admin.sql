-- Protected global super-administrator support
IF COL_LENGTH('dbo.Users', 'IsProtected') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD IsProtected BIT NOT NULL CONSTRAINT DF_Users_IsProtected DEFAULT 0;
END;
GO

-- INSTEAD OF DELETE: runs before FK checks, so protected rows cannot be removed at all
IF OBJECT_ID('dbo.TR_Users_PreventProtectedDelete', 'TR') IS NOT NULL
  DROP TRIGGER dbo.TR_Users_PreventProtectedDelete;
GO
CREATE TRIGGER dbo.TR_Users_PreventProtectedDelete
ON dbo.Users
INSTEAD OF DELETE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (SELECT 1 FROM deleted WHERE IsProtected = 1)
  BEGIN
    RAISERROR('Protected global administrator accounts cannot be deleted.', 16, 1);
    RETURN;
  END

  DELETE u
  FROM dbo.Users u
  INNER JOIN deleted d ON d.UserId = u.UserId;
END;
GO

-- Prevent deactivation / unprotect / email reassignment of protected accounts
IF OBJECT_ID('dbo.TR_Users_PreventProtectedTamper', 'TR') IS NOT NULL
  DROP TRIGGER dbo.TR_Users_PreventProtectedTamper;
GO
CREATE TRIGGER dbo.TR_Users_PreventProtectedTamper
ON dbo.Users
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1
    FROM inserted i
    INNER JOIN deleted d ON d.UserId = i.UserId
    WHERE d.IsProtected = 1
      AND (
        i.IsProtected = 0
        OR i.IsActive = 0
        OR i.Email <> d.Email
      )
  )
  BEGIN
    RAISERROR('Protected global administrator accounts cannot be deactivated, unprotected, or have their email changed.', 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
  END
END;
GO
