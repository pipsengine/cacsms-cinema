import type { SectionKey } from '@/lib/research-evidence/contracts';

export const sections: Array<{ key: SectionKey; title: string; description: string }> = [
  [
    'intake',
    'Qualified Project Intake',
    'Verify the selected-idea package, active strategy, project identity and upstream checksum.',
  ],
  [
    'research-brief',
    'Research Brief',
    'Define scope, objectives, exclusions, deliverables, jurisdictions and completion rules.',
  ],
  [
    'questions',
    'Research Questions',
    'Decompose the approved idea into answerable primary, secondary and verification questions.',
  ],
  [
    'source-discovery',
    'Source Discovery',
    'Acquire candidate government, academic, archival, journalistic, dataset and interview sources.',
  ],
  [
    'source-library',
    'Source Library',
    'Retain immutable source snapshots, metadata, retrieval history and provenance.',
  ],
  [
    'source-evaluation',
    'Source Evaluation',
    'Assess authority, relevance, recency, independence, bias, corrections and conflicts of interest.',
  ],
  [
    'claims',
    'Claim Register',
    'Break the narrative premise into atomic factual, statistical, historical and interpretive claims.',
  ],
  [
    'evidence-map',
    'Claim–Evidence Map',
    'Link every material claim to supporting, contextual and contradicting evidence.',
  ],
  [
    'corroboration',
    'Corroboration',
    'Enforce claim-specific source counts, independence and primary-source preferences.',
  ],
  [
    'contradictions',
    'Contradictions',
    'Surface unresolved conflicts, competing interpretations and evidence uncertainty.',
  ],
  [
    'fact-checking',
    'Fact Verification',
    'Verify dates, names, quantities, quotations, causality and contextual accuracy.',
  ],
  [
    'citations',
    'Citations & Provenance',
    'Generate stable citations with authorship, publication, retrieval and locator details.',
  ],
  [
    'rights',
    'Rights & Licensing',
    'Verify copyright, licence, quotation, image, archive and dataset reuse permissions.',
  ],
  [
    'regional-authenticity',
    'Regional Authenticity',
    'Validate local terminology, geography, culture, history and representation.',
  ],
  [
    'risk',
    'Research Risk',
    'Control legal, privacy, ethical, political, medical, financial and misinformation risks.',
  ],
  [
    'dossier',
    'Research Dossier',
    'Compile the canonical evidence-backed package for Script & Narrative.',
  ],
  [
    'handoffs',
    'Script Handoffs',
    'Track durable dossier delivery and downstream checksum acknowledgement.',
  ],
  [
    'failures',
    'Failure & Recovery',
    'Diagnose provider, extraction, verification, rights and handoff failures.',
  ],
  [
    'audit',
    'Research Audit',
    'Inspect immutable research actions, evidence changes, decisions and external effects.',
  ],
].map(([key, title, description]) => ({
  key: key as SectionKey,
  title,
  description,
}));

export const getSection = (key: string) => sections.find((section) => section.key === key);
