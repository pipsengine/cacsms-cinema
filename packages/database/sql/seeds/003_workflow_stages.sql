MERGE dbo.WorkflowStageDefinitions AS t
USING (VALUES
('STRATEGY_BRIEF',1,'Strategy & Brief','Initiation & Strategy',4,0),
('OPPORTUNITY_DISCOVERY',2,'Opportunity Discovery','Discovery & Intelligence',5,0),
('RESEARCH',3,'Research','Discovery & Intelligence',6,0),
('IDEA_SCORING',4,'Idea Scoring','Discovery & Intelligence',5,0),
('CONCEPT_APPROVAL',5,'Concept Approval','Creative Development',7,1),
('SCRIPT',6,'Script','Creative Development',7,0),
('FACT_CHECK',7,'Fact Check','Creative Development',6,0),
('CHARACTER_BIBLE',8,'Character Bible','Production Planning',8,0),
('SCENE_MATRIX',9,'Scene Matrix','Production Planning',8,0),
('IMAGE_GENERATION',10,'Image Generation','AI Asset Production',9,0),
('VIDEO_GENERATION',11,'Video Generation','AI Asset Production',9,0),
('VOICE_DIALOGUE',12,'Voice & Dialogue','AI Asset Production',9,0),
('MUSIC_SFX',13,'Music & SFX','AI Asset Production',9,0),
('EDIT_ASSEMBLY',14,'Edit & Assembly','Post-Production',10,0),
('QUALITY_ASSURANCE',15,'Quality Assurance','Post-Production',10,0),
('THUMBNAIL',16,'Thumbnail','Content Packaging',11,0),
('SEO_METADATA',17,'SEO & Metadata','Content Packaging',11,0),
('FINAL_APPROVAL',18,'Final Approval','Governance & Release',12,1),
('PUBLISHING',19,'Publishing','Governance & Release',12,0),
('PERFORMANCE',20,'Performance Monitoring','Performance & Learning',13,0),
('AI_LEARNING',21,'AI Learning','Performance & Learning',13,0),
('CONTENT_RECYCLING',22,'Content Recycling','Performance & Learning',13,0)
) s(StageKey,StageOrder,DisplayName,PhaseName,ModuleNumber,IsHumanGate)
ON t.StageKey=s.StageKey
WHEN MATCHED THEN UPDATE SET StageOrder=s.StageOrder,DisplayName=s.DisplayName,PhaseName=s.PhaseName,ModuleNumber=s.ModuleNumber,IsHumanGate=s.IsHumanGate,IsActive=1
WHEN NOT MATCHED THEN INSERT(StageKey,StageOrder,DisplayName,PhaseName,ModuleNumber,IsHumanGate) VALUES(s.StageKey,s.StageOrder,s.DisplayName,s.PhaseName,s.ModuleNumber,s.IsHumanGate);
GO
