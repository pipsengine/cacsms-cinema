import type { SectionKey } from '@/lib/idea-qualification/contracts';

export const sections: Array<{ key: SectionKey; title: string; description: string }> = [
  [
    'intake',
    'Intelligence Intake',
    'Verify and acknowledge provenance-linked candidate packages from Content Intelligence.',
  ],
  [
    'candidate-pool',
    'Candidate Pool',
    'Inspect every received idea without losing source-run traceability.',
  ],
  [
    'evidence',
    'Evidence Sufficiency',
    'Validate authority, corroboration, recency, rights and claim coverage.',
  ],
  [
    'strategic-fit',
    'Strategic Fit',
    'Measure alignment with the active Strategy Package and portfolio objectives.',
  ],
  [
    'audience-value',
    'Audience Value',
    'Assess demand, usefulness, learning outcomes and likely audience benefit.',
  ],
  [
    'originality',
    'Originality Analysis',
    'Evaluate novelty, distinct angle and contribution beyond existing coverage.',
  ],
  [
    'duplicates',
    'Duplicate Detection',
    'Block semantic overlap with published, planned and in-production content.',
  ],
  [
    'feasibility',
    'Production Feasibility',
    'Assess research, budget, schedule, provider and resource constraints.',
  ],
  [
    'visual-potential',
    'Visual Potential',
    'Verify that the idea can support credible scenes, evidence and cinematography.',
  ],
  [
    'risk',
    'Risk & Sensitivity',
    'Evaluate factual, legal, ethical, cultural, privacy and platform risks.',
  ],
  [
    'scoring',
    'Qualification Scoring',
    'Persist factor scores, weights, model versions and explanations.',
  ],
  [
    'gates',
    'Mandatory Gates',
    'Apply absolute thresholds that a high total score cannot override.',
  ],
  [
    'ranking',
    'Qualified Ranking',
    'Rank only gate-passing ideas using portfolio-aware constraints.',
  ],
  [
    'decisions',
    'Decision Register',
    'Retain explainable qualify, reject, block and reassess decisions.',
  ],
  [
    'selected-ideas',
    'Selected Ideas',
    'Manage qualified ideas selected for content-project creation.',
  ],
  [
    'handoffs',
    'Project Handoffs',
    'Track durable project-creation requests and downstream acknowledgement.',
  ],
  [
    'failures',
    'Failure & Recovery',
    'Diagnose retryable jobs, exhausted attempts and genuine blockers.',
  ],
  [
    'audit',
    'Qualification Audit',
    'Inspect immutable inputs, scores, gates, decisions and external effects.',
  ],
].map(([key, title, description]) => ({
  key: key as SectionKey,
  title,
  description,
}));

export const getSection = (key: string) => sections.find((section) => section.key === key);
