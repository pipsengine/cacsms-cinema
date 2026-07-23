export type ObjectiveFormValues = {
  name: string;
  description: string;
  status: string;
  priority: number;
  category: string;
  desiredOutcome: string;
  targetMetric: string;
  baselineValue: string;
  targetValue: string;
  measurementPeriod: string;
  startDate: string;
  endDate: string;
  applicableFields: string;
  applicableAudiences: string;
  regions: string;
  channels: string;
  formats: string;
  dependencies: string;
  constraints: string;
  successCriteria: string;
};

export const emptyObjectiveForm = (): ObjectiveFormValues => ({
  name: '',
  description: '',
  status: 'ACTIVE',
  priority: 50,
  category: '',
  desiredOutcome: '',
  targetMetric: '',
  baselineValue: '',
  targetValue: '',
  measurementPeriod: '',
  startDate: '',
  endDate: '',
  applicableFields: '',
  applicableAudiences: '',
  regions: '',
  channels: '',
  formats: '',
  dependencies: '',
  constraints: '',
  successCriteria: '',
});

export const OBJECTIVE_CATEGORIES = [
  'Awareness',
  'Education',
  'Engagement',
  'Authority',
  'Conversion',
  'Retention',
  'Compliance',
  'Other',
] as const;

export const MEASUREMENT_PERIODS = [
  'Weekly',
  'Monthly',
  'Quarterly',
  'Semi-annual',
  'Annual',
  'Campaign window',
] as const;

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(', ');
  if (typeof value === 'string') return value;
  return '';
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function toIsoDate(value: string): string | null {
  if (!value.trim()) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return `${value.trim()}T00:00:00.000Z`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function recordToObjectiveForm(record: {
  name: string;
  description?: string;
  status: string;
  priority: number;
  configuration?: Record<string, unknown>;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}): ObjectiveFormValues {
  const config = record.configuration ?? {};
  return {
    name: record.name,
    description: record.description ?? String(config.description ?? ''),
    status: record.status || 'ACTIVE',
    priority: Number(record.priority ?? 50),
    category: String(config.category ?? ''),
    desiredOutcome: String(config.desiredOutcome ?? ''),
    targetMetric: String(config.targetMetric ?? ''),
    baselineValue: String(config.baselineValue ?? ''),
    targetValue: String(config.targetValue ?? ''),
    measurementPeriod: String(config.measurementPeriod ?? ''),
    startDate: toDateInput(record.effectiveFrom ?? String(config.startDate ?? '')),
    endDate: toDateInput(record.effectiveTo ?? String(config.endDate ?? '')),
    applicableFields: joinList(config.applicableFields),
    applicableAudiences: joinList(config.applicableAudiences),
    regions: joinList(config.regions),
    channels: joinList(config.channels),
    formats: joinList(config.formats),
    dependencies: joinList(config.dependencies),
    constraints: String(config.constraints ?? ''),
    successCriteria: String(config.successCriteria ?? ''),
  };
}

export function objectiveFormToRecord(form: ObjectiveFormValues) {
  const name = form.name.trim();
  if (name.length < 2) {
    throw new Error('Objective name must be at least 2 characters');
  }

  return {
    name,
    description: form.description.trim(),
    status: form.status || 'ACTIVE',
    priority: Math.max(0, Math.min(100, Number(form.priority) || 0)),
    configuration: {
      description: form.description.trim(),
      category: form.category.trim(),
      desiredOutcome: form.desiredOutcome.trim(),
      targetMetric: form.targetMetric.trim(),
      baselineValue: form.baselineValue.trim(),
      targetValue: form.targetValue.trim(),
      measurementPeriod: form.measurementPeriod.trim(),
      startDate: form.startDate.trim(),
      endDate: form.endDate.trim(),
      applicableFields: splitList(form.applicableFields),
      applicableAudiences: splitList(form.applicableAudiences),
      regions: splitList(form.regions),
      channels: splitList(form.channels),
      formats: splitList(form.formats),
      dependencies: splitList(form.dependencies),
      constraints: form.constraints.trim(),
      successCriteria: form.successCriteria.trim(),
    },
    effectiveFrom: toIsoDate(form.startDate),
    effectiveTo: toIsoDate(form.endDate),
  };
}
