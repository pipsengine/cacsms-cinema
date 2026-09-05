import bcrypt from 'bcryptjs';
import { loadRootEnv } from './load-env.js';
import { closeDb, getDb, sql } from './index.js';

// Prefer repo `.env` over any stale shell exports for bootstrap credentials.
loadRootEnv({ override: true });

const email = process.env.BOOTSTRAP_ADMIN_EMAIL || 'cacsms@cacsms.com';
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'P@882w0rd';
const displayName = process.env.BOOTSTRAP_ADMIN_NAME || 'Cacsms Limited';

try {
  const db = await getDb();
  const hash = await bcrypt.hash(password, 12);
  await db.request()
    .input('email', sql.NVarChar(320), email)
    .input('name', sql.NVarChar(150), displayName)
    .input('hash', sql.NVarChar(500), hash)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @email)
        INSERT dbo.Users (Email, DisplayName, PasswordHash, MfaEnabled, IsProtected)
        VALUES (@email, @name, @hash, 1, 1);
      ELSE
        UPDATE dbo.Users
        SET DisplayName = @name,
            PasswordHash = @hash,
            IsActive = 1,
            IsProtected = 1,
            MfaEnabled = 1,
            UpdatedAt = SYSUTCDATETIME()
        WHERE Email = @email;

      IF NOT EXISTS (SELECT 1 FROM dbo.Workspaces WHERE Slug = 'cacsms-cinema')
        INSERT dbo.Workspaces (Name, Slug) VALUES (N'Cacsms Cinema', N'cacsms-cinema');

      DECLARE @u UNIQUEIDENTIFIER = (SELECT UserId FROM dbo.Users WHERE Email = @email);
      DECLARE @w UNIQUEIDENTIFIER = (SELECT WorkspaceId FROM dbo.Workspaces WHERE Slug = 'cacsms-cinema');
      DECLARE @r UNIQUEIDENTIFIER = (SELECT RoleId FROM dbo.Roles WHERE Name = N'Super Admin');

      IF @r IS NULL THROW 50001, 'Super Admin role missing — run db:seed first.', 1;

      IF NOT EXISTS (SELECT 1 FROM dbo.WorkspaceUsers WHERE WorkspaceId = @w AND UserId = @u)
        INSERT dbo.WorkspaceUsers (WorkspaceId, UserId, RoleId) VALUES (@w, @u, @r);
      ELSE
        UPDATE dbo.WorkspaceUsers SET RoleId = @r, MembershipStatus = N'ACTIVE' WHERE WorkspaceId = @w AND UserId = @u;
    `);

  // Prove undeleteability (INSTEAD OF DELETE trigger)
  let deleteBlocked = false;
  try {
    await db.request().input('email', sql.NVarChar(320), email).query(`DELETE FROM dbo.Users WHERE Email = @email`);
  } catch (err: any) {
    deleteBlocked = /Protected|cannot be deleted/i.test(String(err?.message || err));
    if (!deleteBlocked) throw err;
  }
  if (!deleteBlocked) throw new Error('Protected-delete guard failed: DELETE succeeded unexpectedly');

  const verify = await db.request().input('email', sql.NVarChar(320), email).query(`
    SELECT u.UserId, u.Email, u.DisplayName, u.IsActive, u.IsProtected, r.Name AS RoleName, w.Slug AS WorkspaceSlug
    FROM dbo.Users u
    JOIN dbo.WorkspaceUsers wu ON wu.UserId = u.UserId
    JOIN dbo.Roles r ON r.RoleId = wu.RoleId
    JOIN dbo.Workspaces w ON w.WorkspaceId = wu.WorkspaceId
    WHERE u.Email = @email
  `);
  console.log(`Module 01 bootstrap admin ready: ${email}`);
  console.log(verify.recordset[0]);
} finally {
  await closeDb();
}
