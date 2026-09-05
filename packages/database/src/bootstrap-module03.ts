import { closeDb, getDb, sql } from './index.js';
import { loadRootEnv } from './load-env.js';

loadRootEnv({ override: true });

const email = process.env.BOOTSTRAP_ADMIN_EMAIL || 'cacsms@cacsms.com';

try {
  const db = await getDb();
  const base = await db.request().input('email', sql.NVarChar(320), email).query(`
    SELECT u.UserId, w.WorkspaceId
    FROM dbo.Users u
    CROSS JOIN dbo.Workspaces w
    WHERE u.Email = @email AND w.Slug = 'cacsms-cinema'
  `);
  const row = base.recordset[0];
  if (!row) throw new Error('Run Module 01 bootstrap first.');
  const uid = row.UserId;
  const ws = row.WorkspaceId;

  const meta: any = {
    'CAC-2026-000124': ['A cinematic explainer revealing the everyday AI systems people use without noticing.', 'Long Form', 'YouTube', 'Global English-speaking viewers, 16–45', '["Global","United States","United Kingdom","Canada"]', 'English', 540, '16:9', 'AI & Technology', 'Educate & grow subscribers', 'HIGH', 4, 85, 'Cinematic documentary'],
    'CAC-2026-000123': ['Future-of-work narrative exploring autonomous management and human decision making.', 'Long Form', 'YouTube', 'Professionals and technology-curious adults', '["Global","United States","United Kingdom"]', 'English', 540, '16:9', 'Future of Work', 'Drive watch time', 'URGENT', 2, 110, 'Premium documentary'],
    'CAC-2026-000122': ['Short-form Nigerian social story about automation entering hospitality.', 'Short Form', 'YouTube Shorts', 'Global social video audience, 13–40', '["Nigeria","Global"]', 'English', 120, '9:16', 'AI Stories', 'Reach new viewers', 'MEDIUM', 5, 45, 'Realistic social cinema'],
    'CAC-2026-000121': ['Privacy-focused technology explainer with practical actions.', 'Long Form', 'YouTube', 'Smartphone users, 15–55', '["Global"]', 'English', 390, '16:9', 'Cybersecurity', 'Educate', 'HIGH', 3, 60, 'Clean technology documentary'],
    'CAC-2026-000120': ['Fast science fact story built for high-retention short-form viewing.', 'Short Form', 'YouTube Shorts', 'Students and general audience', '["Global"]', 'English', 60, '9:16', 'Science', 'Reach & engagement', 'LOW', -1, 25, 'Premium science short']
  };

  let updated = 0;
  for (const code of Object.keys(meta)) {
    const [desc, type, platform, audience, countries, language, duration, ratio, category, objective, priority, days, budget, creative] = meta[code];
    const result = await db.request()
      .input('ws', sql.UniqueIdentifier, ws).input('uid', sql.UniqueIdentifier, uid).input('code', sql.NVarChar(30), code)
      .input('desc', sql.NVarChar(1500), desc).input('type', sql.NVarChar(50), type).input('platform', sql.NVarChar(50), platform)
      .input('audience', sql.NVarChar(500), audience).input('countries', sql.NVarChar(sql.MAX), countries)
      .input('language', sql.NVarChar(50), language).input('duration', sql.Int, duration).input('ratio', sql.NVarChar(20), ratio)
      .input('category', sql.NVarChar(100), category).input('objective', sql.NVarChar(100), objective)
      .input('priority', sql.NVarChar(20), priority).input('days', sql.Int, days).input('budget', sql.Decimal(18, 2), budget)
      .input('creative', sql.NVarChar(100), creative)
      .query(`
        UPDATE dbo.ContentProjects
        SET Description=@desc, ContentType=@type, PrimaryPlatform=@platform, TargetAudience=@audience, TargetCountriesJson=@countries,
            Language=@language, PlannedDurationSeconds=@duration, AspectRatio=@ratio, Category=@category, Objective=@objective,
            Priority=@priority, DeadlineAt=CASE WHEN @days<0 THEN NULL ELSE DATEADD(day,@days,SYSUTCDATETIME()) END,
            BudgetLimit=@budget, CreativeDirection=@creative, CreatedByUserId=ISNULL(CreatedByUserId,@uid), UpdatedAt=SYSUTCDATETIME()
        WHERE WorkspaceId=@ws AND ContentCode=@code;
        DECLARE @p UNIQUEIDENTIFIER=(SELECT ContentProjectId FROM dbo.ContentProjects WHERE WorkspaceId=@ws AND ContentCode=@code);
        IF @p IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.ProjectDistributionTargets WHERE ContentProjectId=@p AND Platform=@platform)
          INSERT dbo.ProjectDistributionTargets(ContentProjectId,Platform,ContentFormat,IsPrimary,AspectRatio,TargetDurationSeconds)
          VALUES(@p,@platform,@type,1,@ratio,@duration);
        SELECT @@ROWCOUNT AS RowsAffected, @p AS ProjectId;
      `);
    if (result.recordset[0]?.ProjectId) updated += 1;
  }

  console.log(`Module 03 content-project bootstrap complete (enriched ${updated} existing project(s)).`);
  if (!updated) console.log('No CAC-2026-000120…124 projects found — create projects via /projects/new (live DB).');
} finally {
  await closeDb();
}
