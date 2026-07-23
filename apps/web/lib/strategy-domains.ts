export type DomainFormValues = {
  name: string;
  description: string;
  status: string;
  priority: number;
  fieldName: string;
  domainName: string;
  rationale: string;
  coverageStatus: string;
  allowedState: string;
  countries: string;
  audiences: string;
  formats: string;
  evidenceRequirement: string;
  sensitivity: string;
  seasonalRelevance: string;
  frequencyLimit: string;
  authorityRequirement: string;
  parentDomain: string;
  systemKey: string;
  origin: string;
};

function joinList(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(', ');
  if (typeof value === 'string') return value;
  return '';
}

export function recordToDomainForm(record: {
  name: string;
  description?: string;
  status: string;
  priority: number;
  configuration?: Record<string, unknown>;
}): DomainFormValues {
  const config = record.configuration ?? {};
  return {
    name: record.name,
    description: record.description ?? String(config.description ?? ''),
    status: record.status || 'ACTIVE',
    priority: Number(record.priority ?? 50),
    fieldName: String(config.fieldName ?? ''),
    domainName: String(config.domainName ?? ''),
    rationale: String(config.rationale ?? ''),
    coverageStatus: String(config.coverageStatus ?? ''),
    allowedState: String(config.allowedState ?? ''),
    countries: joinList(config.countries),
    audiences: joinList(config.audiences),
    formats: joinList(config.formats),
    evidenceRequirement: String(config.evidenceRequirement ?? ''),
    sensitivity: String(config.sensitivity ?? ''),
    seasonalRelevance: String(config.seasonalRelevance ?? ''),
    frequencyLimit: String(config.frequencyLimit ?? 'UNMEASURED'),
    authorityRequirement: String(config.authorityRequirement ?? ''),
    parentDomain: String(config.parentDomain ?? ''),
    systemKey: String(config.systemKey ?? ''),
    origin: String(config.origin ?? ''),
  };
}

export const DOMAIN_FIELD_LABELS = [
  ['fieldName', 'Field Name'],
  ['domainName', 'Domain Name'],
  ['description', 'Description'],
  ['rationale', 'Rationale'],
  ['coverageStatus', 'Coverage Status'],
  ['allowedState', 'Allowed State'],
  ['countries', 'Countries'],
  ['audiences', 'Audiences'],
  ['formats', 'Formats'],
  ['evidenceRequirement', 'Evidence Requirement'],
  ['sensitivity', 'Sensitivity'],
  ['seasonalRelevance', 'Seasonal Relevance'],
  ['frequencyLimit', 'Frequency Limit'],
  ['authorityRequirement', 'Authority Requirement'],
  ['parentDomain', 'Parent Domain'],
] as const;
