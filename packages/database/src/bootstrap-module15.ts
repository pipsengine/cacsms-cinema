import {getDb,sql,closeDb} from './client.js';
async function main(){const db=await getDb();const ws=(await db.request().query(`SELECT TOP 1 WorkspaceId FROM dbo.Workspaces ORDER BY CreatedAt`)).recordset[0];if(!ws){console.log('Module 15 bootstrap skipped: no workspace');await closeDb();process.exit(0)}const workspaceId=ws.WorkspaceId;
const capabilityRows:[string,string,string,string][]=[
 ['STRATEGY_BRIEF','saveStrategyBrief','{"status":"DRAFT"}','TRANSACT'],
 ['STRATEGY_BRIEF_SUBMIT','submitStrategyBrief','{"changeSummary":"Autonomous draft"}','TRANSACT'],
 ['STRATEGY_BRIEF_DECIDE','decideStrategyBrief','{"decision":"APPROVE"}','DECIDE'],
 ['OPPORTUNITY_DISCOVERY','createDiscoveryRun','{}','TRANSACT'],
 ['OPPORTUNITY_SELECT','decideOpportunity','{"decision":"SELECT"}','DECIDE'],
 ['RESEARCH','startResearchPack','{}','TRANSACT'],
 ['RESEARCH_SAVE','saveResearchPack','{}','TRANSACT'],
 ['RESEARCH_SUBMIT','submitResearchPack','{"changeSummary":"Autonomous pack"}','TRANSACT'],
 ['RESEARCH_DECIDE','decideResearchPack','{"decision":"APPROVE"}','DECIDE'],
 ['CONCEPT_APPROVAL','generateScriptConcepts','{}','TRANSACT'],
 ['CONCEPT_DECIDE','decideScriptConcept','{"decision":"APPROVE"}','DECIDE'],
 ['SCRIPT','startScriptDocument','{}','TRANSACT'],
 ['SCRIPT_SAVE','saveScriptSections','{}','TRANSACT'],
 ['SCRIPT_SUBMIT','submitScript','{"changeSummary":"Autonomous script"}','TRANSACT'],
 ['SCRIPT_DECIDE','decideScript','{"decision":"APPROVE"}','DECIDE'],
 ['CHARACTER_BIBLE','startProductionPlanning','{}','TRANSACT'],
 ['CHARACTER_BIBLE_SAVE','saveCharacter','{}','TRANSACT'],
 ['SCENE_MATRIX_SAVE','saveScene','{}','TRANSACT'],
 ['PRODUCTION_PLANNING_SUBMIT','submitProductionPlanning','{}','TRANSACT'],
 ['PRODUCTION_PLANNING_DECIDE','decideProductionPlanning','{"decision":"APPROVE"}','DECIDE'],
 ['IMAGE_GENERATION','createGenerationJob','{"modality":"IMAGE"}','TRANSACT'],
 ['VIDEO_GENERATION','createGenerationJob','{"modality":"VIDEO"}','TRANSACT'],
 ['VOICE_DIALOGUE','createGenerationJob','{"modality":"VOICE"}','TRANSACT'],
 ['MUSIC_SFX','createGenerationJob','{"modality":"AUDIO"}','TRANSACT'],
 ['GENERATION_ASSET_REGISTER','registerGeneratedAsset','{}','TRANSACT'],
 ['GENERATION_ASSET_APPROVE','decideGeneratedAsset','{"decision":"APPROVE"}','DECIDE'],
 ['GENERATION_COMPLETE','completeGenerationStage','{}','COMPLETE'],
 ['EDIT_ASSEMBLY','saveEditTimeline','{}','TRANSACT'],
 ['QUALITY_ASSURANCE','updateQACheck','{"status":"PASSED"}','TRANSACT'],
 ['MASTER_VIDEO_DECIDE','decideMasterVideo','{"decision":"APPROVE"}','DECIDE'],
 ['THUMBNAIL','saveThumbnailVariant','{}','TRANSACT'],
 ['THUMBNAIL_DECIDE','decideThumbnailVariant','{"decision":"APPROVE"}','DECIDE'],
 ['SEO_METADATA','saveMetadataPackage','{}','TRANSACT'],
 ['PACKAGING_CHECK','updatePackagingCheck','{"status":"PASSED"}','TRANSACT'],
 ['PACKAGING_VERSION','createPackagingVersion','{}','TRANSACT'],
 ['PACKAGING_DECIDE','decidePackagingVersion','{"decision":"APPROVE"}','DECIDE'],
 ['FINAL_APPROVAL_CHECK','updateReleaseCheck','{"status":"PASSED"}','TRANSACT'],
 ['FINAL_APPROVAL_DECIDE','decideReleaseApproval','{"decision":"APPROVE"}','DECIDE'],
 ['PUBLISHING','createPublishJob','{}','TRANSACT'],
 ['PUBLISH_CONTROL','controlPublishJob','{"action":"QUEUE"}','TRANSACT'],
 ['PUBLICATION_REGISTER','registerPublication','{"externalPublicationId":"DEMO-PUB-001"}','COMPLETE'],
 ['PERFORMANCE_SNAPSHOT_1H','ingestPerformanceSnapshot','{"window":"1H"}','TRANSACT'],
 ['PERFORMANCE_SNAPSHOT_6H','ingestPerformanceSnapshot','{"window":"6H"}','TRANSACT'],
 ['PERFORMANCE_SNAPSHOT_24H','ingestPerformanceSnapshot','{"window":"24H"}','TRANSACT'],
 ['PERFORMANCE_SNAPSHOT_48H','ingestPerformanceSnapshot','{"window":"48H"}','TRANSACT'],
 ['LEARNING_INSIGHT_DECIDE','decideLearningInsight','{"decision":"APPROVE"}','DECIDE'],
 ['LEARNING_FEEDBACK_APPLY','applyLearningFeedback','{}','COMPLETE'],
 ['RECYCLING_DECIDE','decideContentRecyclingPlan','{"decision":"APPROVE"}','DECIDE']
];
for(const c of capabilityRows)await db.request().input('cap',sql.NVarChar(80),c[0]).input('fn',sql.NVarChar(120),c[1]).input('payload',sql.NVarChar(sql.MAX),c[2]).input('phase',sql.NVarChar(32),c[3]).query(`MERGE dbo.AgentCapabilityMap t USING(SELECT @cap AgentCapability)s ON t.AgentCapability=s.AgentCapability WHEN MATCHED THEN UPDATE SET RepositoryFunction=@fn,DefaultPayloadJson=@payload,DispatchPhase=@phase,UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(AgentCapability,RepositoryFunction,DefaultPayloadJson,DispatchPhase) VALUES(@cap,@fn,@payload,@phase);`);
const orchestratorSettings:[string,string][]=[
 ['orchestrator.enabled','true'],
 ['orchestrator.poll_interval_ms','5000'],
 ['orchestrator.concurrency','1'],
 ['orchestrator.learning_approval_threshold','85'],
 ['orchestrator.recycling_approval_priority','HIGH'],
 ['orchestrator.default_sla_multiplier','1.0'],
 ['orchestrator.boot_recovery','true']
];
for(const s of orchestratorSettings)await db.request().input('ws',sql.UniqueIdentifier,workspaceId).input('key',sql.NVarChar(160),s[0]).input('val',sql.NVarChar(sql.MAX),s[1]).query(`MERGE dbo.SystemSettings t USING(SELECT @ws WorkspaceId,@key SettingKey)s ON t.WorkspaceId=s.WorkspaceId AND t.SettingKey=s.SettingKey WHEN MATCHED THEN UPDATE SET SettingValue=@val,UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(WorkspaceId,SettingKey,SettingValue,ValueType) VALUES(@ws,@key,@val,'STRING');`);
const autoPolicies:[string,string,string,string,string,string,number,number][]=[
 ['ORCH_FAIL','Stage dispatch failure','STAGE_FAILED','ERROR','IN_APP','ADMIN',15,1],
 ['ORCH_RETRY_3','Stage retries exhausted (3x)','RETRY_EXHAUSTED','WARNING','IN_APP','ADMIN',30,1],
 ['ORCH_DEAD_LETTER','Stage is DEAD_LETTER','DEAD_LETTER','CRITICAL','IN_APP,EMAIL','SUPER_ADMIN',5,1],
 ['ORCH_SLA_BREACH','Stage SLA exceeded','SLA_OVERDUE','WARNING','IN_APP','OWNER,ADMIN',60,1],
 ['ORCH_BUDGET_GATE','Budget hard-stop gate','BUDGET_GATE_FAIL','CRITICAL','IN_APP,EMAIL','ADMIN',5,1]
];
for(const p of autoPolicies)await db.request().input('ws',sql.UniqueIdentifier,workspaceId).input('key',sql.NVarChar(120),p[0]).input('name',sql.NVarChar(180),p[1]).input('evt',sql.NVarChar(120),p[2]).input('sev',sql.NVarChar(30),p[3]).input('ch',sql.NVarChar(300),p[4]).input('rec',sql.NVarChar(600),p[5]).input('esc',sql.Int,p[6]).input('en',sql.Bit,p[7]).query(`MERGE dbo.NotificationPolicies t USING(SELECT @ws WorkspaceId,@key PolicyKey)s ON t.WorkspaceId=s.WorkspaceId AND t.PolicyKey=s.PolicyKey WHEN MATCHED THEN UPDATE SET Name=@name,TriggerEvent=@evt,Severity=@sev,Channels=@ch,RecipientRule=@rec,EscalationMinutes=@esc,IsEnabled=@en,UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(WorkspaceId,PolicyKey,Name,TriggerEvent,Severity,Channels,RecipientRule,EscalationMinutes,IsEnabled) VALUES(@ws,@key,@name,@evt,@sev,@ch,@rec,@esc,@en);`);
await db.request().input('wid',sql.NVarChar(64),'api-main').input('ws',sql.UniqueIdentifier,workspaceId).input('pid',sql.Int,process.pid).input('host',sql.NVarChar(200),(process.env.COMPUTERNAME||'localhost')).query(`MERGE dbo.OrchestratorHeartbeats t USING(SELECT @wid WorkerId)s ON t.WorkerId=s.WorkerId WHEN MATCHED THEN UPDATE SET WorkspaceId=@ws,LastHeartbeat=SYSUTCDATETIME(),ProcessId=@pid,MachineName=@host,Status='RUNNING',UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(WorkerId,WorkspaceId,ProcessId,MachineName,Status) VALUES(@wid,@ws,@pid,@host,'RUNNING');`);
console.log('Module 15 autonomous orchestration bootstrap complete');await closeDb();process.exit(0)}main().catch(async e=>{console.error(e);try{await closeDb()}catch{}process.exit(1)});
