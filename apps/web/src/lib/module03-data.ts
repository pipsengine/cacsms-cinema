import type {ProjectStatus} from './module02-data';
export type ProjectPriority='LOW'|'MEDIUM'|'HIGH'|'URGENT';
export type ContentProject={id:string;code:string;title:string;description:string;status:ProjectStatus;mode:string;progress:number;completed:number;total:number;stage:string;owner:string;platform:string;type:string;category:string;objective:string;audience:string;countries:string[];language:string;duration:string;aspectRatio:string;priority:ProjectPriority;deadline:string;budget:number;updated:string;creativeDirection:string};
export const projectCatalog:ContentProject[]=[
{id:'11111111-1111-1111-1111-111111111111',code:'CAC-2026-000124',title:'The Hidden AI Already Running Your Everyday Life',description:'A cinematic explainer revealing the everyday AI systems people use without noticing.',status:'IN_PROGRESS',mode:'AI_ASSISTED',progress:48,completed:9,total:22,stage:'Image Generation',owner:'Pips Engine',platform:'YouTube',type:'Long Form',category:'AI & Technology',objective:'Educate & grow subscribers',audience:'Global English-speaking viewers, 16–45',countries:['Global','United States','United Kingdom','Canada'],language:'English',duration:'8–10 min',aspectRatio:'16:9',priority:'HIGH',deadline:'08 Sep 2026',budget:85,updated:'4 min ago',creativeDirection:'Cinematic documentary'},
{id:'22222222-2222-2222-2222-222222222222',code:'CAC-2026-000123',title:'What Happens When AI Becomes Your Boss?',description:'Future-of-work narrative exploring autonomous management and human decision making.',status:'AWAITING_APPROVAL',mode:'SEMI_AUTONOMOUS',progress:77,completed:16,total:22,stage:'Final Approval',owner:'Pips Engine',platform:'YouTube',type:'Long Form',category:'Future of Work',objective:'Drive watch time',audience:'Professionals and technology-curious adults',countries:['Global','United States','United Kingdom'],language:'English',duration:'9 min',aspectRatio:'16:9',priority:'URGENT',deadline:'06 Sep 2026',budget:110,updated:'18 min ago',creativeDirection:'Premium documentary'},
{id:'33333333-3333-3333-3333-333333333333',code:'CAC-2026-000122',title:'The Robot Waiter That Changed a Restaurant',description:'Short-form Nigerian social story about automation entering hospitality.',status:'PAUSED',mode:'AI_ASSISTED',progress:41,completed:8,total:22,stage:'Video Generation',owner:'Pips Engine',platform:'YouTube Shorts',type:'Short Form',category:'AI Stories',objective:'Reach new viewers',audience:'Global social video audience, 13–40',countries:['Nigeria','Global'],language:'English',duration:'120 sec',aspectRatio:'9:16',priority:'MEDIUM',deadline:'09 Sep 2026',budget:45,updated:'1 hr ago',creativeDirection:'Realistic social cinema'},
{id:'44444444-4444-4444-4444-444444444444',code:'CAC-2026-000121',title:'7 Things Your Smartphone Knows About You',description:'Privacy-focused technology explainer with practical actions.',status:'BLOCKED',mode:'AI_ASSISTED',progress:28,completed:5,total:22,stage:'Fact Check',owner:'Pips Engine',platform:'YouTube',type:'Long Form',category:'Cybersecurity',objective:'Educate',audience:'Smartphone users, 15–55',countries:['Global'],language:'English',duration:'6–7 min',aspectRatio:'16:9',priority:'HIGH',deadline:'07 Sep 2026',budget:60,updated:'2 hrs ago',creativeDirection:'Clean technology documentary'},
{id:'55555555-5555-5555-5555-555555555555',code:'CAC-2026-000120',title:'Why One Day on Venus Is Longer Than Its Year',description:'Fast science fact story built for high-retention short-form viewing.',status:'COMPLETED',mode:'SEMI_AUTONOMOUS',progress:100,completed:22,total:22,stage:'Completed',owner:'Pips Engine',platform:'YouTube Shorts',type:'Short Form',category:'Science',objective:'Reach & engagement',audience:'Students and general audience',countries:['Global'],language:'English',duration:'60 sec',aspectRatio:'9:16',priority:'LOW',deadline:'Completed',budget:25,updated:'Yesterday',creativeDirection:'Premium science short'}
];
export const projectAssets=[
{id:'as1',type:'IMAGE',name:'SC09-master-character-reference.png',stage:'Character Bible',version:3,status:'APPROVED',size:'4.8 MB',created:'Today · 11:24'},
{id:'as2',type:'IMAGE',name:'SC10-city-ai-visual-v4.png',stage:'Image Generation',version:4,status:'ACTIVE',size:'5.2 MB',created:'Today · 12:02'},
{id:'as3',type:'DOCUMENT',name:'research-pack-v2.json',stage:'Research',version:2,status:'APPROVED',size:'128 KB',created:'Yesterday · 16:38'},
{id:'as4',type:'SCRIPT',name:'approved-script-v3.json',stage:'Script',version:3,status:'APPROVED',size:'76 KB',created:'Yesterday · 19:11'},
{id:'as5',type:'AUDIO',name:'scene-01-narration-v2.wav',stage:'Voice & Dialogue',version:2,status:'ACTIVE',size:'12.4 MB',created:'Today · 12:17'}
];
export const projectVersions=[
{id:'v6',type:'PROJECT_SNAPSHOT',version:6,title:'Pre-production snapshot',stage:'Scene Matrix',by:'Pips Engine',summary:'Scene matrix approved; generation package created.',approved:true,created:'Today · 09:05'},
{id:'v5',type:'SCRIPT',version:3,title:'Approved script',stage:'Script',by:'Pips Engine',summary:'Hook tightened and factual citations aligned.',approved:true,created:'Yesterday · 19:11'},
{id:'v4',type:'RESEARCH_PACK',version:2,title:'Research pack',stage:'Research',by:'Research Agent',summary:'Added primary-source references and conflict notes.',approved:true,created:'Yesterday · 16:38'},
{id:'v3',type:'CONTENT_BRIEF',version:1,title:'Initial content brief',stage:'Strategy & Brief',by:'Pips Engine',summary:'Initial approved strategic direction.',approved:true,created:'02 Sep · 14:22'}
];
export const projectApprovals=[
{id:'ap1',type:'Scene package approval',stage:'Scene Matrix',status:'APPROVED',requested:'03 Sep · 08:30',decision:'03 Sep · 09:05',assignee:'Pips Engine',comment:'Approved for asset generation.'},
{id:'ap2',type:'Script approval',stage:'Script',status:'APPROVED',requested:'02 Sep · 18:42',decision:'02 Sep · 19:11',assignee:'Pips Engine',comment:'Proceed with scene planning.'},
{id:'ap3',type:'Image batch review',stage:'Image Generation',status:'PENDING',requested:'Today · 12:08',decision:'—',assignee:'Pips Engine',comment:'Scenes 10–14 require master selections.'}
];
export const projectActivity=[
{id:'ac1',actor:'AI',name:'Image Director',title:'Generated image batch',detail:'20 variants generated for scenes 10–14 using locked character references.',stage:'Image Generation',time:'12 min ago'},
{id:'ac2',actor:'SYSTEM',name:'Workflow Engine',title:'Created approval work item',detail:'Human review requested for the latest image batch.',stage:'Image Generation',time:'14 min ago'},
{id:'ac3',actor:'HUMAN',name:'Pips Engine',title:'Approved scene package',detail:'Scene Matrix v1 approved and handed off to Image Generation.',stage:'Scene Matrix',time:'Today · 09:05'},
{id:'ac4',actor:'AI',name:'Continuity Guardian',title:'Continuity validation passed',detail:'Character, wardrobe and location anchors validated across 28 scenes.',stage:'Scene Matrix',time:'Today · 08:54'},
{id:'ac5',actor:'HUMAN',name:'Pips Engine',title:'Approved script v3',detail:'Script locked for downstream scene production.',stage:'Script',time:'Yesterday · 19:11'},
{id:'ac6',actor:'SYSTEM',name:'Handoff Engine',title:'Research pack consumed',detail:'Research Pack v2 became Script Studio input.',stage:'Script',time:'Yesterday · 16:40'}
];
export const projectHandoffs=[
{from:'Strategy & Brief',to:'Opportunity Discovery',output:'Content Brief v1',status:'CONSUMED'},
{from:'Opportunity Discovery',to:'Research',output:'Selected Opportunity v1',status:'CONSUMED'},
{from:'Research',to:'Idea Scoring',output:'Research Pack v2',status:'CONSUMED'},
{from:'Scene Matrix',to:'Image Generation',output:'Scene Package v1',status:'CONSUMED'},
{from:'Image Generation',to:'Video Generation',output:'Approved Image Masters',status:'WAITING'}
];
