export type ProjectStatus='NOT_STARTED'|'IN_PROGRESS'|'COMPLETED'|'AWAITING_APPROVAL'|'PAUSED'|'BLOCKED'|'FAILED';
export type DemoProject={id:string;code:string;title:string;status:ProjectStatus;mode:string;progress:number;completed:number;total:number;stage:string;updated:string;owner:string;platform:string;deadline:string};
export const dashboardProjects:DemoProject[]=[
{id:'11111111-1111-1111-1111-111111111111',code:'CAC-2026-000124',title:'The Hidden AI Already Running Your Everyday Life',status:'IN_PROGRESS',mode:'AI Assisted',progress:48,completed:9,total:22,stage:'Image Generation',updated:'4 min ago',owner:'Pips Engine',platform:'YouTube',deadline:'08 Sep'},
{id:'22222222-2222-2222-2222-222222222222',code:'CAC-2026-000123',title:'What Happens When AI Becomes Your Boss?',status:'AWAITING_APPROVAL',mode:'Semi-Autonomous',progress:77,completed:16,total:22,stage:'Final Approval',updated:'18 min ago',owner:'Pips Engine',platform:'YouTube',deadline:'06 Sep'},
{id:'33333333-3333-3333-3333-333333333333',code:'CAC-2026-000122',title:'The Robot Waiter That Changed a Restaurant',status:'PAUSED',mode:'AI Assisted',progress:41,completed:8,total:22,stage:'Video Generation',updated:'1 hr ago',owner:'Pips Engine',platform:'YouTube Shorts',deadline:'09 Sep'},
{id:'44444444-4444-4444-4444-444444444444',code:'CAC-2026-000121',title:'7 Things Your Smartphone Knows About You',status:'BLOCKED',mode:'AI Assisted',progress:28,completed:5,total:22,stage:'Fact Check',updated:'2 hrs ago',owner:'Pips Engine',platform:'YouTube',deadline:'07 Sep'},
{id:'55555555-5555-5555-5555-555555555555',code:'CAC-2026-000120',title:'Why One Day on Venus Is Longer Than Its Year',status:'COMPLETED',mode:'Semi-Autonomous',progress:100,completed:22,total:22,stage:'Completed',updated:'Yesterday',owner:'Pips Engine',platform:'YouTube Shorts',deadline:'Done'}
];
export const stages=['Strategy & Brief','Opportunity Discovery','Research','Idea Scoring','Concept Approval','Script','Fact Check','Character Bible','Scene Matrix','Image Generation','Video Generation','Voice & Dialogue','Music & SFX','Edit & Assembly','Quality Assurance','Thumbnail','SEO & Metadata','Final Approval','Publishing','Performance Monitoring','AI Learning','Content Recycling'];
export const demoTasks=[
{id:'a1',title:'Approve final content package',project:'CAC-2026-000123',projectTitle:'What Happens When AI Becomes Your Boss?',type:'Approval',priority:'URGENT',status:'OPEN',due:'Today, 17:00',stage:'Final Approval'},
{id:'a2',title:'Resolve conflicting source claim',project:'CAC-2026-000121',projectTitle:'7 Things Your Smartphone Knows About You',type:'Exception',priority:'HIGH',status:'IN_PROGRESS',due:'Today, 18:30',stage:'Fact Check'},
{id:'a3',title:'Review image variants for scenes 10–14',project:'CAC-2026-000124',projectTitle:'The Hidden AI Already Running Your Everyday Life',type:'Review',priority:'HIGH',status:'OPEN',due:'Tomorrow, 10:00',stage:'Image Generation'},
{id:'a4',title:'Choose video provider fallback',project:'CAC-2026-000122',projectTitle:'The Robot Waiter That Changed a Restaurant',type:'Decision',priority:'MEDIUM',status:'WAITING',due:'Tomorrow, 12:00',stage:'Video Generation'},
{id:'a5',title:'Confirm publishing slot',project:'CAC-2026-000120',projectTitle:'Why One Day on Venus Is Longer Than Its Year',type:'Publishing',priority:'LOW',status:'COMPLETED',due:'Completed',stage:'Publishing'}
];
export const demoNotifications=[
{id:'n1',severity:'CRITICAL',category:'Workflow',title:'Project blocked at Fact Check',message:'CAC-2026-000121 has a conflicting factual claim that requires human resolution before Script can continue.',time:'12 min ago',read:false,action:'Open exception'},
{id:'n2',severity:'WARNING',category:'Approval',title:'Final approval is waiting',message:'What Happens When AI Becomes Your Boss? is ready for final human approval.',time:'18 min ago',read:false,action:'Review now'},
{id:'n3',severity:'INFO',category:'Generation',title:'Image batch completed',message:'Scenes 10–14 generated 20 image variants. Five selections are awaiting review.',time:'34 min ago',read:false,action:'Review images'},
{id:'n4',severity:'SUCCESS',category:'Publishing',title:'Video published successfully',message:'Why One Day on Venus Is Longer Than Its Year was published to YouTube Shorts.',time:'Yesterday, 19:02',read:true,action:'View analytics'},
{id:'n5',severity:'INFO',category:'Security',title:'New session signed in',message:'A new authenticated session was created for your account.',time:'Yesterday, 08:16',read:true,action:'Review sessions'}
];
export const demoAgents=[
{name:'Image Director',key:'image-agent',status:'RUNNING',stage:'Image Generation',project:'CAC-2026-000124',progress:72,provider:'Image subscription'},
{name:'Continuity Guardian',key:'continuity-agent',status:'RUNNING',stage:'Image Generation',project:'CAC-2026-000124',progress:83,provider:'Cacsms Agent'},
{name:'Publishing Agent',key:'publishing-agent',status:'WAITING',stage:'Publishing',project:'CAC-2026-000123',progress:0,provider:'YouTube'},
{name:'Fact Checker',key:'fact-agent',status:'FAILED',stage:'Fact Check',project:'CAC-2026-000121',progress:63,provider:'Research Agent'},
{name:'Analytics Agent',key:'analytics-agent',status:'ONLINE',stage:'Performance',project:'—',progress:0,provider:'YouTube Analytics'}
];
export const schedule=[
{time:'06 Sep · 18:00',platform:'YouTube',code:'CAC-2026-000123',title:'What Happens When AI Becomes Your Boss?',status:'Ready after approval'},
{time:'08 Sep · 17:30',platform:'YouTube',code:'CAC-2026-000124',title:'The Hidden AI Already Running Your Everyday Life',status:'In production'},
{time:'09 Sep · 12:00',platform:'Shorts',code:'CAC-2026-000122',title:'The Robot Waiter That Changed a Restaurant',status:'At risk'}
];
