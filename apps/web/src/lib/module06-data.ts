export const researchProject={id:'11111111-1111-1111-1111-111111111124',code:'CAC-2026-000124',title:'The Hidden AI Already Running Your Everyday Life',status:'IN_REVIEW',version:1,opportunity:'The AI Systems Making Decisions About You Before You Notice',score:92};
export const researchQuestions=[
{id:'q1',question:'How do recommendation systems rank content for users?',priority:'HIGH',status:'ANSWERED',answer:'They combine behavioural and contextual signals to estimate relevance; exact methods vary by platform.'},
{id:'q2',question:'Where is AI used in fraud detection and transaction risk?',priority:'HIGH',status:'ANSWERED',answer:'Financial institutions use statistical and machine-learning models to flag patterns associated with fraud risk.'},
{id:'q3',question:'Which claims about personalized pricing are defensible?',priority:'HIGH',status:'OPEN',answer:'Requires market-specific evidence and careful distinction between dynamic pricing, segmentation and individualized pricing.'},
{id:'q4',question:'What limitations should the documentary state explicitly?',priority:'MEDIUM',status:'ANSWERED',answer:'Not every automated rule is AI; outputs are probabilistic and can be wrong.'}
];
export const sources=[
{id:'s1',type:'PRIMARY',publisher:'NIST',title:'Artificial Intelligence Risk Management Framework',url:'https://www.nist.gov/itl/ai-risk-management-framework',quality:'HIGH',authority:96,recency:86,relevance:93,approved:true},
{id:'s2',type:'PRIMARY',publisher:'Google',title:'How YouTube recommendations work',url:'https://support.google.com/youtube/',quality:'HIGH',authority:88,recency:83,relevance:96,approved:true},
{id:'s3',type:'PRIMARY',publisher:'Meta',title:'How AI influences what you see on Facebook and Instagram',url:'https://transparency.meta.com/',quality:'HIGH',authority:90,recency:82,relevance:94,approved:true},
{id:'s4',type:'SECONDARY',publisher:'OECD',title:'AI principles and responsible AI resources',url:'https://oecd.ai/',quality:'HIGH',authority:92,recency:88,relevance:84,approved:true},
{id:'s5',type:'SECONDARY',publisher:'Academic / industry literature',title:'Machine learning approaches to fraud detection',url:'',quality:'MEDIUM',authority:82,recency:78,relevance:89,approved:false}
];
export const claims=[
{id:'c1',code:'CLM-001',text:'Recommendation systems rank and recommend content using signals about likely relevance rather than presenting all available content equally.',status:'VERIFIED',confidence:96,materiality:'HIGH',usage:'APPROVED',evidence:3},
{id:'c2',code:'CLM-002',text:'Machine-learning models are widely used as part of fraud-detection systems to identify suspicious transaction patterns.',status:'VERIFIED',confidence:94,materiality:'HIGH',usage:'APPROVED',evidence:2},
{id:'c3',code:'CLM-003',text:'A consumer may receive a different price solely because an AI system predicted their willingness to pay.',status:'NEEDS_REVIEW',confidence:54,materiality:'HIGH',usage:'HOLD',evidence:1},
{id:'c4',code:'CLM-004',text:'Not every automated digital decision should be described as artificial intelligence.',status:'VERIFIED',confidence:98,materiality:'HIGH',usage:'APPROVED',evidence:2},
{id:'c5',code:'CLM-005',text:'Recommendation outputs are probabilistic and may reflect imperfect signals or biases.',status:'VERIFIED',confidence:91,materiality:'MEDIUM',usage:'APPROVED',evidence:3}
];
export const contradictions=[{subject:'Personalized pricing',a:'Some reporting uses personalized pricing broadly.',b:'Primary evidence often supports dynamic or segmented pricing rather than one-to-one willingness-to-pay predictions.',status:'OPEN'}];
export const risks=[{category:'Accuracy',severity:'HIGH',description:'Overstating what an algorithm knows about an individual.',mitigation:'Use probabilistic language and approved claims only.',status:'OPEN'},{category:'Privacy',severity:'MEDIUM',description:'Visuals could imply access to private personal data.',mitigation:'Use fictionalized interfaces and avoid real personal information.',status:'MITIGATED'}];
export const timeline=[{date:'2010s',title:'Large-scale recommendation systems mature',description:'Consumer platforms increasingly use machine learning to rank and recommend content.'},{date:'2020s',title:'Generative AI expands public awareness',description:'Public attention shifts from hidden ranking systems toward visible generative AI interfaces.'}];
export const entities=[{type:'ORGANIZATION',name:'NIST',role:'Responsible AI and risk-management reference',sensitivity:'LOW'},{type:'SYSTEM',name:'Recommendation systems',role:'Primary technical concept in story',sensitivity:'MEDIUM'},{type:'SYSTEM',name:'Fraud detection models',role:'Example of invisible AI decision support',sensitivity:'MEDIUM'}];
