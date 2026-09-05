export const editProject={id:'11111111-1111-1111-1111-111111111124',code:'CAC-2026-000124',title:'The Hidden AI Already Running Your Everyday Life',status:'IN_PROGRESS',generationPackageVersion:1,plannedDuration:'08:45',currentDuration:'08:39',progress:72};
export const timelineScenes=[
{scene:'SC-001',title:'Before Breakfast',start:'00:00',end:'00:42',duration:'00:42',video:'MASTER',voice:'MASTER',music:'MASTER',caption:'READY',transition:'Fade through black',status:'LOCKED'},
{scene:'SC-002',title:'Invisible Ranking',start:'00:42',end:'01:31',duration:'00:49',video:'MASTER',voice:'MASTER',music:'MASTER',caption:'READY',transition:'Match cut',status:'LOCKED'},
{scene:'SC-003',title:'Morning Commute',start:'01:31',end:'02:24',duration:'00:53',video:'MASTER',voice:'MASTER',music:'MASTER',caption:'NEEDS_REVIEW',transition:'Whip pan',status:'IN_REVIEW'},
{scene:'SC-004',title:'Office Arrival',start:'02:24',end:'03:15',duration:'00:51',video:'MASTER',voice:'MASTER',music:'MASTER',caption:'READY',transition:'J-cut',status:'READY'},
{scene:'SC-005',title:'Recommendation Loop',start:'03:15',end:'04:06',duration:'00:51',video:'MASTER',voice:'MASTER',music:'MASTER',caption:'READY',transition:'Graphic wipe',status:'READY'},
{scene:'SC-006',title:'The Pattern Revealed',start:'04:06',end:'05:02',duration:'00:56',video:'MASTER',voice:'MASTER',music:'MASTER',caption:'READY',transition:'Hard cut',status:'READY'},
{scene:'SC-007',title:'Human Choice',start:'05:02',end:'06:10',duration:'01:08',video:'MASTER',voice:'MASTER',music:'MASTER',caption:'READY',transition:'L-cut',status:'READY'},
{scene:'SC-008',title:'What Comes Next',start:'06:10',end:'08:39',duration:'02:29',video:'MASTER',voice:'MASTER',music:'MASTER',caption:'READY',transition:'Fade out',status:'READY'}
];
export const tracks=[
{name:'V1 · Scene Masters',kind:'VIDEO',items:8,status:'COMPLETE',level:'100%'},
{name:'V2 · Graphics / Overlays',kind:'VIDEO',items:11,status:'IN_PROGRESS',level:'73%'},
{name:'A1 · Dialogue / VO',kind:'AUDIO',items:12,status:'COMPLETE',level:'-6 LUFS peak'},
{name:'A2 · Music',kind:'AUDIO',items:8,status:'COMPLETE',level:'-22 LUFS'},
{name:'A3 · SFX',kind:'AUDIO',items:17,status:'IN_REVIEW',level:'-18 LUFS'},
{name:'C1 · Captions',kind:'CAPTION',items:8,status:'NEEDS_REVIEW',level:'96%'}
];
export const editNotes=[
{id:'EDL-001',scene:'SC-001',time:'00:00:00',type:'PICTURE',instruction:'Open on approved kitchen master. Hold 12 frames before narrator begins.',owner:'Editor Agent',status:'APPLIED'},
{id:'EDL-014',scene:'SC-003',time:'00:01:52',type:'CAPTION',instruction:'Correct timing around “ranking model”; subtitle currently leads audio by 180 ms.',owner:'Human Editor',status:'OPEN'},
{id:'EDL-021',scene:'SC-004',time:'00:02:41',type:'AUDIO',instruction:'Use J-cut so office ambience begins 8 frames before picture transition.',owner:'Editor Agent',status:'APPLIED'},
{id:'EDL-033',scene:'SC-007',time:'00:05:34',type:'GRAPHICS',instruction:'Add restrained callout highlighting recommendation loop. No unverified statistics.',owner:'Motion Agent',status:'IN_PROGRESS'}
];
export const qaChecks=[
{id:'QA-001',category:'Completeness',check:'All required scene masters present',severity:'BLOCKING',status:'PASSED',evidence:'8/8 scenes have approved video, voice and required audio masters.'},
{id:'QA-002',category:'Duration',check:'Final duration within brief tolerance',severity:'HIGH',status:'PASSED',evidence:'08:39 actual vs 08:45 planned; -1.1% variance.'},
{id:'QA-003',category:'Captions',check:'Caption timing and spelling',severity:'HIGH',status:'FAILED',evidence:'SC-003 subtitle timing leads VO by approximately 180 ms.'},
{id:'QA-004',category:'Continuity',check:'Character / wardrobe / location continuity',severity:'BLOCKING',status:'PASSED',evidence:'All locked character and wardrobe references match approved blueprint.'},
{id:'QA-005',category:'Audio',check:'Dialogue intelligibility and loudness',severity:'HIGH',status:'PASSED',evidence:'Dialogue clear; peaks below -1 dBTP; music ducking active.'},
{id:'QA-006',category:'Format',check:'16:9 4K master / frame-rate consistency',severity:'BLOCKING',status:'PASSED',evidence:'3840×2160, 24 fps throughout.'},
{id:'QA-007',category:'Facts',check:'On-screen factual claims trace to approved research',severity:'BLOCKING',status:'PASSED',evidence:'No new factual overlays outside approved claim register.'},
{id:'QA-008',category:'Copyright',check:'Music, SFX and visual rights metadata complete',severity:'BLOCKING',status:'NEEDS_REVIEW',evidence:'One SFX asset requires licence metadata attachment.'}
];
export const masterVersions=[
{version:'v1',status:'RETURNED',duration:'08:47',resolution:'3840×2160',created:'05 Sep 2026 · 14:18',summary:'Initial assembly; returned for caption and pacing corrections.'},
{version:'v2',status:'IN_REVIEW',duration:'08:39',resolution:'3840×2160',created:'05 Sep 2026 · 16:42',summary:'Pacing revised, audio balanced, two QA items remain.'}
];
