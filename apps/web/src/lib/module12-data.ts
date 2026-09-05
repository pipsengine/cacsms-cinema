export const releaseProject={id:'11111111-1111-1111-1111-111111111124',code:'CAC-2026-000124',title:'The Hidden AI Already Running Your Everyday Life',packagingVersion:'Packaging v2',packagingVersionId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb221',master:'MASTER v3',status:'AWAITING_APPROVAL',progress:72,approvalStep:'2 of 2'};
export const approvalSteps=[
{id:'APR-01',step:1,name:'Content & Packaging Review',role:'Content Manager',assignee:'Amina Bello',status:'APPROVED',decision:'APPROVE',decided:'05 Sep 2026 · 17:40',comment:'Packaging, title, thumbnail and factual claim lineage reviewed.'},
{id:'APR-02',step:2,name:'Final Publisher Approval',role:'Publisher',assignee:'Pips Engine',status:'PENDING',decision:null,decided:null,comment:'Final release gate: platform connection, schedule and visibility confirmation.'}
];
export const releaseChecks=[
{id:'REL-001',category:'Governance',check:'Approved packaging version locked',severity:'BLOCKING',blocking:true,status:'PASSED',evidence:'Exact PackagingVersionId bound to release package.'},
{id:'REL-002',category:'Asset',check:'Master media accessible',severity:'BLOCKING',blocking:true,status:'PASSED',evidence:'MASTER v3 is reachable and immutable.'},
{id:'REL-003',category:'Asset',check:'Primary thumbnail accessible',severity:'BLOCKING',blocking:true,status:'PASSED',evidence:'TH-202 approved and linked.'},
{id:'REL-004',category:'Compliance',check:'Copyright / licensing clearance',severity:'BLOCKING',blocking:true,status:'PASSED',evidence:'Music, SFX, visuals and generated-asset rights checks passed.'},
{id:'REL-005',category:'Accessibility',check:'Required captions attached',severity:'HIGH',blocking:false,status:'PASSED',evidence:'English caption track approved with 100% coverage.'},
{id:'REL-006',category:'Integration',check:'Publishing platform connection healthy',severity:'BLOCKING',blocking:true,status:'NEEDS_REVIEW',evidence:'YouTube connected; derivative platform accounts not yet connected.'},
{id:'REL-007',category:'Release',check:'Publishing date/time confirmed',severity:'BLOCKING',blocking:true,status:'NEEDS_REVIEW',evidence:'Primary YouTube slot proposed for 06 Sep 2026 · 18:00 WAT.'}
];
export const connections=[
{platform:'YouTube',account:'Cacsms Tv',status:'CONNECTED',health:'HEALTHY',scopes:'Upload · Manage · Analytics',expires:'26 Sep 2026'},
{platform:'TikTok',account:'Cacsms Cinema',status:'NOT_CONNECTED',health:'—',scopes:'—',expires:'—'},
{platform:'Instagram',account:'Cacsms Cinema',status:'NOT_CONNECTED',health:'—',scopes:'—',expires:'—'},
{platform:'Facebook',account:'Cacsms Cinema',status:'NOT_CONNECTED',health:'—',scopes:'—',expires:'—'},
{platform:'X',account:'Cacsms Cinema',status:'NOT_CONNECTED',health:'—',scopes:'—',expires:'—'}
];
export const publishJobs=[
{id:'PUB-2401',platform:'YouTube',format:'Long Form',operation:'PUBLISH',status:'SCHEDULED',scheduled:'06 Sep 2026 · 18:00 WAT',attempt:'0/3',visibility:'Public',title:'The Hidden AI Already Running Your Everyday Life',connection:'Cacsms Tv',external:'Pending final approval'},
{id:'PUB-2402',platform:'YouTube Shorts',format:'Short',operation:'PUBLISH',status:'DRAFT',scheduled:'07 Sep 2026 · 12:30 WAT',attempt:'0/3',visibility:'Public',title:'AI Is Already Making These Decisions for You',connection:'Cacsms Tv',external:'Not queued'},
{id:'PUB-2403',platform:'TikTok',format:'Short',operation:'PUBLISH',status:'BLOCKED',scheduled:'07 Sep 2026 · 19:30 WAT',attempt:'0/3',visibility:'Public',title:'You Use AI Before Breakfast Without Knowing It',connection:'Not connected',external:'Connection required'},
{id:'PUB-2404',platform:'Instagram',format:'Reel',operation:'PUBLISH',status:'BLOCKED',scheduled:'08 Sep 2026 · 18:30 WAT',attempt:'0/3',visibility:'Public',title:'The Invisible AI in Your Everyday Life',connection:'Not connected',external:'Connection required'}
];
export const calendarItems=[
{date:'06 Sep',time:'18:00',platform:'YouTube',title:'The Hidden AI Already Running Your Everyday Life',status:'SCHEDULED',type:'Long Form'},
{date:'07 Sep',time:'12:30',platform:'YouTube Shorts',title:'AI Is Already Making These Decisions for You',status:'DRAFT',type:'Short'},
{date:'07 Sep',time:'19:30',platform:'TikTok',title:'You Use AI Before Breakfast Without Knowing It',status:'BLOCKED',type:'Short'},
{date:'08 Sep',time:'18:30',platform:'Instagram',title:'The Invisible AI in Your Everyday Life',status:'BLOCKED',type:'Reel'},
{date:'10 Sep',time:'17:00',platform:'Facebook',title:'How Invisible AI Shapes Everyday Choices',status:'PLANNED',type:'Video'}
];
export const releaseActivities=[
{time:'17:52',type:'SYSTEM',title:'Release package created',detail:'Packaging v2 registered as immutable final-review input.'},
{time:'17:56',type:'HUMAN',title:'Content review approved',detail:'Amina Bello approved approval step 1 of 2.'},
{time:'18:02',type:'SYSTEM',title:'YouTube connection health passed',detail:'Cacsms Tv connection reported HEALTHY.'},
{time:'18:05',type:'HUMAN',title:'Primary publish slot proposed',detail:'06 Sep 2026 · 18:00 WAT selected for YouTube long form.'}
];
