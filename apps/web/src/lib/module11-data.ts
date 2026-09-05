export const packagingProject={id:'11111111-1111-1111-1111-111111111124',code:'CAC-2026-000124',title:'The Hidden AI Already Running Your Everyday Life',masterVersion:'MASTER v3',masterVideoVersionId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa31',duration:'08:39',status:'IN_PROGRESS',packageVersion:'v2'};
export const thumbnailVariants=[
{id:'TH-201',label:'Curiosity Face + Hidden AI',status:'SHORTLISTED',score:91,clarity:94,emotion:88,curiosity:95,mobile:92,contrast:89,click:91,headline:'AI IS ALREADY CHOOSING',concept:'Human face looking at ordinary apps while a subtle AI decision layer appears behind them.',provider:'Image Agent',version:'Prompt v4'},
{id:'TH-202',label:'Everyday Life Split Screen',status:'APPROVED',score:94,clarity:96,emotion:90,curiosity:96,mobile:95,contrast:94,click:95,headline:'YOU NEVER NOTICED THIS',concept:'Split-screen morning routine with invisible algorithm decisions highlighted through clean visual cues.',provider:'Image Agent',version:'Prompt v5'},
{id:'TH-203',label:'Phone + Invisible Decisions',status:'REJECTED',score:78,clarity:84,emotion:71,curiosity:82,mobile:75,contrast:86,click:76,headline:'WHO REALLY DECIDES?',concept:'Phone close-up with branching recommendation choices.',provider:'Image Agent',version:'Prompt v3'}
];
export const metadata={
 primaryTitle:'The Hidden AI Already Running Your Everyday Life',
 alternates:['AI Is Making More Decisions for You Than You Realize','The Invisible Algorithms Running Your Daily Life','You Use AI Every Day — Even When You Don’t Know It'],
 description:'Artificial intelligence is already shaping what we watch, buy, read and even which routes we take — often without us noticing. This documentary-style explainer reveals the invisible decision systems working behind ordinary moments, how recommendation and ranking systems influence choices, and what human control still means in an AI-driven world.',
 keywords:['artificial intelligence','AI everyday life','recommendation algorithms','how AI works','machine learning','technology documentary','AI explained'],
 tags:['artificial intelligence','AI','machine learning','algorithms','technology','future tech','AI documentary'],
 hashtags:['#ArtificialIntelligence','#AI','#Technology','#MachineLearning','#CacsmsCinema'],
 category:'Science & Technology',language:'English',audience:'Not made for kids',playlist:'AI & The Future',license:'Standard YouTube License'
};
export const chapters=[
{time:'00:00',title:'The AI You Never See',status:'READY'},
{time:'00:42',title:'Invisible Ranking',status:'READY'},
{time:'01:31',title:'Your Morning Commute',status:'READY'},
{time:'02:24',title:'AI at Work',status:'READY'},
{time:'03:15',title:'The Recommendation Loop',status:'READY'},
{time:'04:06',title:'The Pattern Revealed',status:'READY'},
{time:'05:02',title:'Where Human Choice Begins',status:'READY'},
{time:'06:10',title:'What Comes Next',status:'READY'}
];
export const captionTracks=[
{id:'CAP-EN',language:'English',kind:'FULL_CAPTIONS',status:'APPROVED',coverage:100,source:'Master transcript v2',format:'SRT + VTT'},
{id:'CAP-EN-CLEAN',language:'English',kind:'CLEAN_TRANSCRIPT',status:'APPROVED',coverage:100,source:'Master transcript v2',format:'TXT'},
{id:'CAP-FR',language:'French',kind:'TRANSLATED_CAPTIONS',status:'NOT_STARTED',coverage:0,source:'Pending translation',format:'SRT'},
{id:'CAP-ES',language:'Spanish',kind:'TRANSLATED_CAPTIONS',status:'NOT_STARTED',coverage:0,source:'Pending translation',format:'SRT'}
];
export const platformVariants=[
{platform:'YouTube',format:'Long Form',aspect:'16:9',duration:'08:39',title:'The Hidden AI Already Running Your Everyday Life',thumbnail:'TH-202',caption:'CAP-EN',status:'READY',score:96},
{platform:'YouTube Shorts',format:'Short',aspect:'9:16',duration:'00:59',title:'AI Is Already Making These Decisions for You',thumbnail:'Auto frame + text-safe',caption:'Burned-in + SRT',status:'DRAFT',score:88},
{platform:'TikTok',format:'Short',aspect:'9:16',duration:'00:46',title:'You Use AI Before Breakfast Without Knowing It',thumbnail:'Cover frame',caption:'Burned-in',status:'DRAFT',score:86},
{platform:'Instagram',format:'Reel',aspect:'9:16',duration:'00:60',title:'The Invisible AI in Your Everyday Life',thumbnail:'Cover frame',caption:'Burned-in',status:'DRAFT',score:87},
{platform:'Facebook',format:'Video',aspect:'16:9',duration:'03:10',title:'How Invisible AI Shapes Everyday Choices',thumbnail:'TH-202 adapted',caption:'CAP-EN',status:'PLANNED',score:82},
{platform:'X',format:'Video',aspect:'16:9',duration:'02:12',title:'The AI decisions happening around you every day',thumbnail:'TH-202 adapted',caption:'Burned-in',status:'PLANNED',score:80}
];
export const packagingChecks=[
{id:'PKG-001',check:'Approved master video linked',severity:'BLOCKING',status:'PASSED',evidence:'MASTER v3 · exact MasterVideoVersionId bound.'},
{id:'PKG-002',check:'Primary thumbnail approved',severity:'BLOCKING',status:'PASSED',evidence:'TH-202 approved as primary thumbnail.'},
{id:'PKG-003',check:'Title within platform limits',severity:'HIGH',status:'PASSED',evidence:'Primary YouTube title 55 characters.'},
{id:'PKG-004',check:'Description opening optimized',severity:'MEDIUM',status:'PASSED',evidence:'Primary topic and value proposition appear in opening lines.'},
{id:'PKG-005',check:'Captions cover full master duration',severity:'BLOCKING',status:'PASSED',evidence:'English captions 100% coverage.'},
{id:'PKG-006',check:'Chapters align to master timecodes',severity:'HIGH',status:'PASSED',evidence:'8 chapters validated against approved master.'},
{id:'PKG-007',check:'Platform audience / category settings complete',severity:'BLOCKING',status:'NEEDS_REVIEW',evidence:'Facebook and X variants require final audience setting confirmation.'},
{id:'PKG-008',check:'No unsupported factual claim added in metadata',severity:'BLOCKING',status:'PASSED',evidence:'Metadata claims remain within approved research/script scope.'}
];
export const packagingVersions=[
{version:'v1',status:'RETURNED',created:'05 Sep 2026 · 17:02',thumbnail:'TH-201',title:'The Invisible AI Already Controlling Your Day',summary:'Returned: title overstated control and thumbnail text too dense.'},
{version:'v2',status:'IN_REVIEW',created:'05 Sep 2026 · 17:46',thumbnail:'TH-202',title:'The Hidden AI Already Running Your Everyday Life',summary:'Claims corrected, thumbnail improved, YouTube package ready; two platform settings need review.'}
];
