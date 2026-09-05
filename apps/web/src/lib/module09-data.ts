export const genProject={id:'11111111-1111-1111-1111-111111111124',code:'CAC-2026-000124',title:'The Hidden AI Already Running Your Everyday Life',status:'IN_PROGRESS',scenePackageVersion:1,characterBibleVersion:1,progress:46};
export const providerSummary=[
{key:'OPENAI_IMAGE',name:'Image Agent Subscription',cap:'IMAGE',model:'Configured image model',status:'CONNECTED',refs:true,batch:true,usage:'184 credits',health:99.8},
{key:'GOOGLE_VIDEO',name:'Video Agent Subscription',cap:'VIDEO',model:'Configured video model',status:'CONNECTED',refs:true,batch:true,usage:'62 generations',health:98.6},
{key:'ELEVENLABS',name:'Voice Agent',cap:'VOICE',model:'Multilingual voice',status:'CONNECTED',refs:false,batch:true,usage:'41.2k chars',health:99.9},
{key:'AUDIO_AGENT',name:'Music & SFX Agent',cap:'AUDIO',model:'Production audio',status:'CONNECTED',refs:false,batch:true,usage:'27 renders',health:97.9}
];
export const genScenes=[
{scene:'SC-001',title:'Before Breakfast',image:'APPROVED',video:'COMPLETED',voice:'APPROVED',audio:'APPROVED',imageVariants:4,videoVariants:2,cost:2.84},
{scene:'SC-002',title:'Invisible Ranking',image:'APPROVED',video:'IN_PROGRESS',voice:'APPROVED',audio:'APPROVED',imageVariants:3,videoVariants:1,cost:2.21},
{scene:'SC-003',title:'Morning Commute',image:'NEEDS_REVIEW',video:'NOT_STARTED',voice:'COMPLETED',audio:'COMPLETED',imageVariants:4,videoVariants:0,cost:0.88},
{scene:'SC-004',title:'Office Arrival',image:'APPROVED',video:'QUEUED',voice:'IN_PROGRESS',audio:'COMPLETED',imageVariants:3,videoVariants:0,cost:0.74},
{scene:'SC-005',title:'Recommendation Loop',image:'IN_PROGRESS',video:'NOT_STARTED',voice:'COMPLETED',audio:'QUEUED',imageVariants:2,videoVariants:0,cost:0.31}
];
export const jobs=[
{id:'JOB-1098',scene:'SC-002',cap:'VIDEO',provider:'Video Agent Subscription',model:'Configured video model',status:'IN_PROGRESS',progress:63,attempt:1,cost:1.75,queued:'07:19',eta:'Processing'},
{id:'JOB-1099',scene:'SC-004',cap:'VIDEO',provider:'Video Agent Subscription',model:'Configured video model',status:'QUEUED',progress:0,attempt:1,cost:1.75,queued:'07:24',eta:'Next'},
{id:'JOB-1100',scene:'SC-005',cap:'IMAGE',provider:'Image Agent Subscription',model:'Configured image model',status:'IN_PROGRESS',progress:38,attempt:1,cost:.18,queued:'07:28',eta:'Processing'},
{id:'JOB-1101',scene:'SC-004',cap:'VOICE',provider:'Voice Agent',model:'Multilingual voice',status:'IN_PROGRESS',progress:71,attempt:1,cost:.06,queued:'07:31',eta:'Processing'},
{id:'JOB-1094',scene:'SC-003',cap:'IMAGE',provider:'Image Agent Subscription',model:'Configured image model',status:'FAILED',progress:100,attempt:2,cost:.34,queued:'07:06',eta:'Retry available'}
];
export const imageVariants=[
{id:'IMG-301',scene:'SC-003',v:1,status:'REJECTED',score:74,provider:'Image Agent Subscription',reason:'Wardrobe continuity mismatch',uri:'/generation/image-placeholder'},
{id:'IMG-302',scene:'SC-003',v:2,status:'PENDING',score:91,provider:'Image Agent Subscription',reason:'Reference lock restored',uri:'/generation/image-placeholder'},
{id:'IMG-303',scene:'SC-003',v:3,status:'PENDING',score:88,provider:'Image Agent Subscription',reason:'Alternative camera position',uri:'/generation/image-placeholder'}
];
export const voices=[
{speaker:'Narrator',voice:'Cacsms Neutral Nigerian English',scenes:'SC-001, SC-002, SC-003, SC-005',status:'LOCKED',speed:'0.98×',emotion:'Curious documentary'},
{speaker:'Amara',voice:'Warm Nigerian Female 30s',scenes:'SC-004',status:'LOCKED',speed:'1.00×',emotion:'Natural conversational'},
{speaker:'Tunde',voice:'Relaxed Nigerian Male 30s',scenes:'SC-004',status:'LOCKED',speed:'1.00×',emotion:'Friendly professional'}
];
