import type { StrategyRecord } from '@/lib/strategy/contracts';
import { configDisplay, fieldLabel } from '@/apps/web/lib/strategy-taxonomy';

export type LocaleFamily = 'english' | 'hausa' | 'yoruba' | 'igbo' | 'pidgin' | 'other';

export type AdaptationStep = {
  id: string;
  label: string;
  field: string;
};

export { configDisplay, fieldLabel };

/** Vertical adaptation ladder shown under the constellation. */
export const ADAPTATION_LADDER: AdaptationStep[] = [
  { id: 'translate', label: 'Translate', field: 'translationRules' },
  { id: 'voice', label: 'Voice & orthography', field: 'transliterationRules' },
  { id: 'accent', label: 'Accent / VO', field: 'accentPreferences' },
  { id: 'captions', label: 'Captions', field: 'captions' },
  { id: 'culture', label: 'Cultural adaptation', field: 'culturalAdaptation' },
  { id: 'review', label: 'Human review', field: 'humanReview' },
];

export function isLocalisationStub(record: StrategyRecord): boolean {
  const key = String(record.configuration?.systemKey ?? '');
  return (
    key === 'policy.localisation' ||
    ((record.name === 'Localisation' || record.name === 'Language & Localisation') &&
      !key.startsWith('loc.'))
  );
}

export function isLocalisationPolicyKit(record: StrategyRecord): boolean {
  return String(record.configuration?.systemKey ?? '').startsWith('loc.');
}

export function localeFamily(record: StrategyRecord): LocaleFamily {
  const family = String(record.configuration?.localeFamily ?? '').toLowerCase();
  if (
    family === 'english' ||
    family === 'hausa' ||
    family === 'yoruba' ||
    family === 'igbo' ||
    family === 'pidgin'
  ) {
    return family;
  }
  return 'other';
}

export function isHubLocale(record: StrategyRecord): boolean {
  return localeFamily(record) === 'english' || String(record.configuration?.systemKey) === 'loc.en-ng';
}

export function familyShort(family: LocaleFamily): string {
  switch (family) {
    case 'english':
      return 'EN';
    case 'hausa':
      return 'HA';
    case 'yoruba':
      return 'YO';
    case 'igbo':
      return 'IG';
    case 'pidgin':
      return 'PCM';
    default:
      return '?';
  }
}

/** Hub first, then satellites by priority. */
export function sortLocaleConstellation(records: StrategyRecord[]): StrategyRecord[] {
  return [...records].sort((a, b) => {
    const hubDelta = Number(isHubLocale(b)) - Number(isHubLocale(a));
    if (hubDelta) return hubDelta;
    return b.priority - a.priority || a.name.localeCompare(b.name);
  });
}

export function requiresHumanReview(record: StrategyRecord): boolean {
  const review = configDisplay(record.configuration, 'humanReview').toLowerCase();
  return review.includes('required') || review.includes('mandatory') || review.includes('every');
}

export function languageStack(record: StrategyRecord): string[] {
  const primary = configDisplay(record.configuration, 'primaryLanguage');
  const secondary = configDisplay(record.configuration, 'secondaryLanguages');
  return [primary, ...secondary.split(/[,;]/).map((s) => s.trim())].filter(Boolean);
}
