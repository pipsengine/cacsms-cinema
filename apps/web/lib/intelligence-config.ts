import type { SectionKey } from '@/lib/content-intelligence/contracts';

export const sections: Array<{ key: SectionKey; title: string; description: string }> = [
  ['sources', 'Source Registry', 'Manage approved discovery sources and provider health.'],
  ['discovery', 'Discovery Runs', 'Schedule and inspect evidence-backed autonomous discovery.'],
  ['trends', 'Trend Intelligence', 'Track durable, emerging and declining subject signals.'],
  ['audience-demand', 'Audience Demand', 'Measure questions, search intent and unmet audience needs.'],
  ['knowledge-gaps', 'Knowledge Gaps', 'Identify under-covered subjects against the Knowledge Universe.'],
  ['topic-opportunities', 'Topic Opportunities', 'Combine verified signals into explainable opportunities.'],
  ['competitors', 'Competitor Intelligence', 'Analyse coverage saturation without copying protected work.'],
  ['candidates', 'Candidate Ideas', 'Review generated documentary and content candidates.'],
  ['verification', 'Evidence Verification', 'Verify claims, sources, recency, authority and corroboration.'],
  ['duplicates', 'Duplicate Detection', 'Detect semantic overlap with existing and planned content.'],
  ['scoring', 'Opportunity Scoring', 'Apply strategy thresholds and absolute quality gates.'],
  ['ranking', 'Ranking & Selection', 'Rank qualifying candidates with portfolio-aware controls.'],
  ['portfolio', 'Portfolio Balance', 'Maintain field, geography, audience and format diversity.'],
  ['handoffs', 'Idea Qualification Handoffs', 'Track durable delivery and receiving-module acknowledgement.'],
  ['failures', 'Failure & Recovery', 'Diagnose retryable and blocked intelligence jobs.'],
  ['audit', 'Intelligence Audit', 'Inspect immutable runs, decisions, inputs and score explanations.'],
].map(([key, title, description]) => ({
  key: key as SectionKey,
  title,
  description,
}));

export const getSection = (key: string) => sections.find((section) => section.key === key);
