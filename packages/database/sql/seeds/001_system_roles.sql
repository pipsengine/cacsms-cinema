MERGE dbo.Roles AS target
USING (VALUES
    ('Super Admin','Full platform administration',1),
    ('Content Manager','Owns content operations and approvals',1),
    ('Reviewer','Reviews and approves assigned workflow stages',1),
    ('Creator','Creates and edits content projects',1),
    ('Viewer','Read-only access',1)
) AS source(Name, Description, IsSystemRole)
ON target.Name = source.Name
WHEN MATCHED THEN UPDATE SET Description = source.Description, IsSystemRole = source.IsSystemRole
WHEN NOT MATCHED THEN INSERT (Name, Description, IsSystemRole) VALUES (source.Name, source.Description, source.IsSystemRole);
GO
