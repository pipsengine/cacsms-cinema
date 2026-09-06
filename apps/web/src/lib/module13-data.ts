export const analyticsProject={id:'11111111-1111-1111-1111-111111111124',code:'CAC-2026-000124',title:'The Hidden AI Already Running Your Everyday Life',platform:'YouTube',published:'03 Sep 2026 · 18:00 WAT',status:'MONITORING',score:82.7,learning:'IN PROGRESS',publicationId:'PUB-YT-CACSMS-000124'};
export const snapshots=[
{window:'1H',impressions:18400,views:2130,ctr:7.8,avd:252,apv:61.4,subs:48,revenue:7.4},
{window:'6H',impressions:98200,views:10940,ctr:8.4,avd:267,apv:65.1,subs:284,revenue:42.8},
{window:'24H',impressions:412000,views:48700,ctr:8.9,avd:279,apv:68.0,subs:1368,revenue:219.5},
{window:'48H',impressions:738000,views:90600,ctr:9.2,avd:286,apv:69.8,subs:2540,revenue:427.2}
];
export const retention=[{second:0,pct:100,label:'Hook'},{second:30,pct:82,label:'Hook hold'},{second:60,pct:76,label:'Context'},{second:120,pct:70,label:'Pattern reveal'},{second:180,pct:67,label:'Story build'},{second:240,pct:64,label:'Midpoint'},{second:300,pct:61,label:'Human choice'},{second:360,pct:58,label:'Closing'},{second:410,pct:54,label:'CTA'}];
export const geographies=[['United States','28.4%','25,730'],['United Kingdom','14.2%','12,865'],['Nigeria','12.8%','11,597'],['Canada','8.6%','7,792'],['Australia','5.1%','4,621'],['Germany','3.7%','3,352']];
export const traffic=[['Browse features','38.1%','34,519'],['Suggested videos','27.4%','24,824'],['YouTube search','16.7%','15,130'],['External','8.9%','8,063'],['Channel pages','4.6%','4,168']];
export const anomalies=[
{id:'AN-01',severity:'INFO',metric:'CTR',title:'CTR outperforming baseline',detail:'Thumbnail/title combination is 2.1 points above recent channel median.',expected:'7.1%',actual:'9.2%',status:'OPEN'},
{id:'AN-02',severity:'MEDIUM',metric:'RETENTION 30S',title:'Early retention drop',detail:'18% leave within 30 seconds; still above channel benchmark but worth testing.',expected:'85%',actual:'82%',status:'OPEN'}
];
export const insights=[
{id:'LI-01',type:'HOOK',category:'Retention',title:'Opening question + everyday examples held 82% at 30 seconds.',text:'Reveal the everyday consequence before technical explanation.',confidence:92,impact:91,status:'PROPOSED'},
{id:'LI-02',type:'THUMBNAIL',category:'Packaging',title:'Primary thumbnail exceeded channel CTR benchmark by 2.1 points.',text:'Repeat the high-contrast object + short curiosity statement pattern for invisible-tech topics.',confidence:88,impact:84,status:'PROPOSED'},
{id:'LI-03',type:'AUDIENCE',category:'Market',title:'International viewers represented more than 70% of views.',text:'Prioritize globally recognizable examples, using Nigerian examples as supporting texture.',confidence:95,impact:89,status:'PROPOSED'},
{id:'LI-04',type:'DURATION',category:'Format',title:'Retention stayed above 60% through minute five.',text:'6–8 minute explainers are currently strong for this topic family.',confidence:86,impact:78,status:'PROPOSED'}
];
export const knowledge=[
{category:'Packaging',statement:'High-contrast, low-clutter thumbnails with a short curiosity phrase outperform current channel CTR median.',evidence:'7 videos',confidence:87},
{category:'Audience',statement:'Global-first framing increases international share without eliminating Nigerian engagement.',evidence:'5 videos',confidence:84},
{category:'Format',statement:'6–8 minute AI explainers currently sustain the strongest watch-time-to-production-cost ratio.',evidence:'4 videos',confidence:81}
];
export const feedback=[
{target:'Opportunity Intelligence',rule:'MARKET_GLOBAL_FIRST',lesson:'Increase Global Appeal weight for AI explainers when evidence confidence ≥ 85%.',status:'READY'},
{target:'Opportunity Intelligence',rule:'FORMAT_6_8_MIN',lesson:'Recommend 6–8 minute format for AI explainers with comparable complexity.',status:'READY'},
{target:'Packaging',rule:'THUMBNAIL_HIGH_CONTRAST',lesson:'Prefer high-contrast low-clutter thumbnail concepts during candidate scoring.',status:'READY'}
];
export const recycling=[
{platform:'YouTube Shorts',format:'Short',title:'3 Invisible AI Decisions You Make Before Breakfast',reason:'Strong 48-hour retention and international share justify a short-form extraction.',priority:'HIGH',status:'PROPOSED'},
{platform:'TikTok',format:'Vertical Short',title:'AI Is Already Choosing What You See',reason:'Convert the highest-retention pattern-reveal section into a 45-second vertical story.',priority:'HIGH',status:'PROPOSED'},
{platform:'Instagram',format:'Reel',title:'The AI You Use Without Realising It',reason:'Reuse approved visual masters with a faster hook and caption-first packaging.',priority:'MEDIUM',status:'PROPOSED'}
];
