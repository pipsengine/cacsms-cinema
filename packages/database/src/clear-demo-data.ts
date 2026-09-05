import { closeDb, getDb, sql } from './index.js';
import { loadRootEnv } from './load-env.js';

loadRootEnv({ override: true });

try {
  const db = await getDb();
  // Remove Module 02 demo operational rows; keep catalog/roles/admin identity.
  await db.request().query(`
    DELETE FROM dbo.ProjectHandoffs;
    DELETE FROM dbo.ProjectActivities;
    DELETE FROM dbo.ProjectApprovals;
    DELETE FROM dbo.ProjectVersions;
    DELETE FROM dbo.ProjectAssets;
    DELETE FROM dbo.ProjectCollaborators;
    DELETE FROM dbo.ProjectDistributionTargets;
    DELETE FROM dbo.ProjectControlEvents;
    DELETE FROM dbo.ProjectStageExecutions;
    DELETE FROM dbo.PublishingSchedule;
    DELETE FROM dbo.GenerationUsage;
    DELETE FROM dbo.AgentRuns;
    DELETE FROM dbo.Notifications;
    DELETE FROM dbo.WorkItems;
    DELETE FROM dbo.ContentProjects;
  `);

  await db.request()
    .input('email', sql.NVarChar(320), process.env.BOOTSTRAP_ADMIN_EMAIL || 'cacsms@cacsms.com')
    .input('name', sql.NVarChar(150), process.env.BOOTSTRAP_ADMIN_NAME || 'Cacsms Limited')
    .query(`
      UPDATE dbo.Users
      SET DisplayName = @name, UpdatedAt = SYSUTCDATETIME()
      WHERE Email = @email;

      SELECT Email, DisplayName, IsProtected, IsActive
      FROM dbo.Users WHERE Email = @email;
    `).then(r => console.log('Admin updated:', r.recordset[0]));

  console.log('Cleared demo operational data from db_Cacsms-Cinema.');
} finally {
  await closeDb();
}
