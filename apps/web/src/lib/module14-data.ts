export const agents=[
{id:'AG-01',name:'Trend Scout',type:'DISCOVERY',status:'ONLINE',mode:'AUTONOMOUS',model:'GPT-class research agent',runs:48,success:97.9,cost:18.42,last:'2 min ago'},
{id:'AG-02',name:'Research Agent',type:'RESEARCH',status:'RUNNING',mode:'HUMAN_GATED',model:'Research + web tools',runs:31,success:96.8,cost:26.70,last:'Now'},
{id:'AG-03',name:'Scriptwriter',type:'CREATIVE',status:'ONLINE',mode:'HUMAN_GATED',model:'Long-context writer',runs:22,success:100,cost:12.94,last:'14 min ago'},
{id:'AG-04',name:'Continuity Agent',type:'PRODUCTION',status:'ONLINE',mode:'ENFORCED',model:'Vision continuity',runs:109,success:98.1,cost:21.18,last:'5 min ago'},
{id:'AG-05',name:'Image Agent',type:'GENERATION',status:'ONLINE',mode:'SUBSCRIPTION',model:'Provider adapter',runs:314,success:94.6,cost:86.30,last:'1 min ago'},
{id:'AG-06',name:'Video Agent',type:'GENERATION',status:'DEGRADED',mode:'SUBSCRIPTION',model:'Provider adapter',runs:172,success:89.5,cost:214.80,last:'8 min ago'},
{id:'AG-07',name:'QA Agent',type:'QUALITY',status:'ONLINE',mode:'ENFORCED',model:'Multimodal QA',runs:84,success:99.2,cost:17.40,last:'4 min ago'},
{id:'AG-08',name:'Publishing Agent',type:'RELEASE',status:'WAITING',mode:'HUMAN_GATED',model:'Platform adapters',runs:19,success:100,cost:2.10,last:'3 h ago'},
{id:'AG-09',name:'Analytics Agent',type:'LEARNING',status:'RUNNING',mode:'AUTONOMOUS',model:'Metrics intelligence',runs:144,success:99.4,cost:7.72,last:'Now'}
];
export const workflows=[
{order:1,key:'STRATEGY_BRIEF',name:'Strategy & Brief',owner:'Content Strategist',gate:'Human approval',status:'ACTIVE',sla:'8h'},
{order:2,key:'OPPORTUNITY_DISCOVERY',name:'Opportunity Discovery',owner:'Trend Scout',gate:'Human select',status:'ACTIVE',sla:'2h'},
{order:3,key:'RESEARCH',name:'Research & Fact Intelligence',owner:'Research Agent',gate:'Research approval',status:'ACTIVE',sla:'12h'},
{order:4,key:'CONCEPT_APPROVAL',name:'Concept Approval',owner:'Creative Agent',gate:'Human approval',status:'ACTIVE',sla:'4h'},
{order:5,key:'SCRIPT',name:'Script Production',owner:'Scriptwriter',gate:'Human approval',status:'ACTIVE',sla:'8h'},
{order:6,key:'FACT_CHECK',name:'Fact Check',owner:'Fact Checker',gate:'Blocking claims clear',status:'ACTIVE',sla:'4h'},
{order:7,key:'CHARACTER_BIBLE',name:'Character Bible',owner:'Continuity Agent',gate:'Identity lock',status:'ACTIVE',sla:'4h'},
{order:8,key:'SCENE_MATRIX',name:'Scene Matrix',owner:'Director Agent',gate:'Scene package approval',status:'ACTIVE',sla:'8h'},
{order:9,key:'IMAGE_GENERATION',name:'Image Generation',owner:'Image Agent',gate:'Master images',status:'ACTIVE',sla:'12h'},
{order:10,key:'VIDEO_GENERATION',name:'Video Generation',owner:'Video Agent',gate:'Master videos',status:'ACTIVE',sla:'24h'},
{order:11,key:'VOICE_DIALOGUE',name:'Voice & Dialogue',owner:'Voice Agent',gate:'Voice masters',status:'ACTIVE',sla:'8h'},
{order:12,key:'MUSIC_SFX',name:'Music & SFX',owner:'Audio Agent',gate:'Audio cleared',status:'ACTIVE',sla:'6h'},
{order:13,key:'EDIT_ASSEMBLY',name:'Edit & Assembly',owner:'Editor Agent',gate:'Timeline complete',status:'ACTIVE',sla:'12h'},
{order:14,key:'QUALITY_ASSURANCE',name:'Quality Assurance',owner:'QA Agent',gate:'All blockers passed',status:'ACTIVE',sla:'6h'},
{order:15,key:'THUMBNAIL',name:'Thumbnail',owner:'Thumbnail Agent',gate:'Human primary selection',status:'ACTIVE',sla:'3h'},
{order:16,key:'SEO_METADATA',name:'SEO & Metadata',owner:'SEO Agent',gate:'Package approval',status:'ACTIVE',sla:'3h'},
{order:17,key:'FINAL_APPROVAL',name:'Final Approval',owner:'Publisher',gate:'Mandatory human',status:'ACTIVE',sla:'4h'},
{order:18,key:'PUBLISHING',name:'Publishing',owner:'Publishing Agent',gate:'Approved release only',status:'ACTIVE',sla:'2h'},
{order:19,key:'PERFORMANCE',name:'Performance Monitoring',owner:'Analytics Agent',gate:'Publication ID required',status:'ACTIVE',sla:'48h'},
{order:20,key:'AI_LEARNING',name:'AI Learning',owner:'Learning Agent',gate:'Human approves lessons',status:'ACTIVE',sla:'24h'},
{order:21,key:'CONTENT_RECYCLING',name:'Content Recycling',owner:'Growth Agent',gate:'Human derivative approval',status:'ACTIVE',sla:'24h'}
];
export const integrations=[
{name:'OpenAI / LLM Gateway',group:'AI',capability:'Strategy · Script · Agents',status:'CONNECTED',health:'HEALTHY',auth:'Secret vault',last:'1 min ago'},
{name:'Image Generation Subscription',group:'AI',capability:'Images · Thumbnails',status:'CONFIGURED',health:'HEALTHY',auth:'API adapter',last:'3 min ago'},
{name:'Video Generation Subscription',group:'AI',capability:'Scene video generation',status:'CONFIGURED',health:'DEGRADED',auth:'API adapter',last:'8 min ago'},
{name:'Voice Provider',group:'AI',capability:'Narration · Dialogue',status:'CONFIGURED',health:'HEALTHY',auth:'API adapter',last:'7 min ago'},
{name:'YouTube',group:'SOCIAL',capability:'Publish · Analytics',status:'CONNECTED',health:'HEALTHY',auth:'OAuth 2.0',last:'2 min ago'},
{name:'TikTok',group:'SOCIAL',capability:'Publish · Analytics',status:'NOT_CONNECTED',health:'UNKNOWN',auth:'OAuth',last:'—'},
{name:'Instagram / Facebook',group:'SOCIAL',capability:'Reels · Video · Insights',status:'NOT_CONNECTED',health:'UNKNOWN',auth:'Meta OAuth',last:'—'},
{name:'X',group:'SOCIAL',capability:'Video · Analytics',status:'NOT_CONNECTED',health:'UNKNOWN',auth:'OAuth 2.0',last:'—'}
];
export const costRows=[
{provider:'Video generation',jobs:172,credits:'1,420',month:214.80,budget:350,trend:'+12%'},
{provider:'Image generation',jobs:314,credits:'628',month:86.30,budget:150,trend:'-3%'},
{provider:'Research / LLM',jobs:101,credits:'—',month:58.06,budget:120,trend:'+8%'},
{provider:'Voice generation',jobs:88,credits:'176',month:31.44,budget:80,trend:'+2%'},
{provider:'Storage & delivery',jobs:640,credits:'—',month:19.70,budget:75,trend:'+5%'}
];
export const assets=[
{id:'AST-00982',name:'SC08_video_master_v3.mp4',type:'VIDEO',project:'CAC-2026-000124',size:'286 MB',status:'MASTER',usage:'Edit timeline',created:'04 Sep 2026'},
{id:'AST-00977',name:'SC08_image_master_v2.png',type:'IMAGE',project:'CAC-2026-000124',size:'8.2 MB',status:'MASTER',usage:'Video reference',created:'04 Sep 2026'},
{id:'AST-00971',name:'Amara_voice_master.wav',type:'AUDIO',project:'CAC-2026-000124',size:'32 MB',status:'APPROVED',usage:'Dialogue track',created:'04 Sep 2026'},
{id:'AST-00955',name:'thumbnail_primary_v2.png',type:'THUMBNAIL',project:'CAC-2026-000124',size:'4.6 MB',status:'APPROVED',usage:'YouTube release',created:'04 Sep 2026'},
{id:'AST-00921',name:'master_video_v2.mp4',type:'MASTER',project:'CAC-2026-000124',size:'1.84 GB',status:'APPROVED',usage:'Release source',created:'04 Sep 2026'}
];
export const auditRows=[
{time:'05 Sep · 18:32',actor:'Pips Engine',action:'ROLE_PERMISSION_UPDATED',entity:'Role · Content Manager',ip:'10.20.4.18',result:'SUCCESS'},
{time:'05 Sep · 18:19',actor:'System',action:'ANALYTICS_INGESTION',entity:'PUB-YT-CACSMS-000124',ip:'service',result:'SUCCESS'},
{time:'05 Sep · 17:54',actor:'Pips Engine',action:'PROVIDER_CONFIG_TEST',entity:'Video Provider',ip:'10.20.4.18',result:'WARNING'},
{time:'05 Sep · 17:40',actor:'Publishing Agent',action:'PUBLISH_JOB_COMPLETED',entity:'JOB-PUB-0041',ip:'service',result:'SUCCESS'},
{time:'05 Sep · 16:58',actor:'Pips Engine',action:'MASTER_VIDEO_APPROVED',entity:'CAC-2026-000124',ip:'10.20.4.18',result:'SUCCESS'}
];
export const notificationRules=[
{name:'Generation failure',channel:'In-app · Email',severity:'CRITICAL',recipients:'Owner + Admin',enabled:true},
{name:'Approval waiting > 4h',channel:'In-app',severity:'WARNING',recipients:'Reviewer',enabled:true},
{name:'Provider credit below 20%',channel:'In-app · Email',severity:'WARNING',recipients:'Admin',enabled:true},
{name:'Publishing failure',channel:'In-app · Email',severity:'CRITICAL',recipients:'Publisher + Admin',enabled:true},
{name:'Security event',channel:'In-app · Email',severity:'CRITICAL',recipients:'Super Admin',enabled:true},
{name:'Daily production digest',channel:'Email',severity:'INFO',recipients:'Content Manager',enabled:false}
];
export const healthServices=[
{name:'Web Application',status:'HEALTHY',latency:'42 ms',uptime:'99.99%',last:'18:40:12'},
{name:'API Service',status:'HEALTHY',latency:'58 ms',uptime:'99.98%',last:'18:40:11'},
{name:'Microsoft SQL Server',status:'HEALTHY',latency:'12 ms',uptime:'100%',last:'18:40:11'},
{name:'Generation Worker',status:'HEALTHY',latency:'—',uptime:'99.91%',last:'18:39:52'},
{name:'Video Provider',status:'DEGRADED',latency:'1.8 s',uptime:'97.8%',last:'18:39:47'},
{name:'Publishing Worker',status:'HEALTHY',latency:'—',uptime:'100%',last:'18:39:30'},
{name:'Analytics Ingestion',status:'HEALTHY',latency:'620 ms',uptime:'99.94%',last:'18:39:05'}
];
export const backups=[
{type:'Full',target:'CacsmsCinema',schedule:'Daily · 01:00 WAT',retention:'30 days',last:'05 Sep 2026 · 01:00',status:'VERIFIED',size:'3.8 GB'},
{type:'Transaction Log',target:'CacsmsCinema',schedule:'Every 15 minutes',retention:'7 days',last:'05 Sep 2026 · 18:30',status:'SUCCESS',size:'86 MB'},
{type:'Asset metadata',target:'Object storage index',schedule:'Daily · 02:00 WAT',retention:'30 days',last:'05 Sep 2026 · 02:00',status:'SUCCESS',size:'128 MB'},
{type:'Configuration export',target:'Encrypted vault',schedule:'Daily · 02:30 WAT',retention:'90 days',last:'05 Sep 2026 · 02:30',status:'SUCCESS',size:'4.2 MB'}
];
