/**
 * Local/dev screenplay builder used when Gemini credentials are absent.
 * Produces a valid GeneratedScreenplay-shaped object from the persisted brief.
 */

export interface LocalGeneratedScene {
  title: string;
  purpose: string;
  narrativeBeat: string;
  narration: string;
  visualIntention: string;
  locationPeriod: string;
  emotionalDirection: string;
  cameraDirection: string;
  soundDirection: string;
  durationSec: number;
}

export interface LocalGeneratedScreenplay {
  logline: string;
  genre: string;
  scenes: LocalGeneratedScene[];
  continuityIssues: Array<{
    scenePosition?: number;
    code: string;
    severity: string;
    description: string;
    recommendedAction: string;
  }>;
}

export interface LocalScriptBrief {
  title: string;
  logline?: string | null;
  genre?: string | null;
  targetDurationSec: number;
  projectName: string;
  projectDescription?: string | null;
}

const BEATS = ['Setup', 'Context', 'Rising Action', 'Turning Point', 'Climax', 'Resolution'] as const;

export function buildLocalScreenplay(brief: LocalScriptBrief): LocalGeneratedScreenplay {
  const target = Math.max(60, brief.targetDurationSec || 900);
  const sceneCount = Math.min(12, Math.max(3, Math.round(target / 120)));
  const baseDuration = Math.floor(target / sceneCount);
  let remaining = target - baseDuration * sceneCount;

  const logline = (brief.logline?.trim()
    || `A focused cinematic study of ${brief.title} within ${brief.projectName}.`);
  const genre = (brief.genre?.trim() || 'Drama');
  const setting = brief.projectDescription?.trim() || brief.projectName;

  const scenes: LocalGeneratedScene[] = [];
  for (let index = 0; index < sceneCount; index += 1) {
    const durationSec = baseDuration + (remaining > 0 ? 1 : 0);
    if (remaining > 0) remaining -= 1;
    const beat = BEATS[Math.min(index, BEATS.length - 1)];
    const sceneNumber = index + 1;
    scenes.push({
      title: `${brief.title} — Beat ${sceneNumber}`,
      purpose: `Advance the story through the ${beat.toLowerCase()} beat while preserving source fidelity for ${brief.title}.`,
      narrativeBeat: beat,
      narration: `In this beat, the narrative deepens around ${brief.title}, carrying forward the logline: ${logline}`,
      visualIntention: `Cinematic still capturing ${setting} with clear subject hierarchy, motivated lighting, and coherent spatial depth.`,
      locationPeriod: setting.slice(0, 500) || 'Unspecified location / present day',
      emotionalDirection: index === sceneCount - 1 ? 'Resolved and reflective' : 'Focused and escalating',
      cameraDirection: '16:9 cinematic frame with natural perspective and stable eye-level composition.',
      soundDirection: 'Diegetic ambience with restrained score support; no invented dialogue captions.',
      durationSec: Math.min(900, Math.max(10, durationSec)),
    });
  }

  return {
    logline,
    genre,
    scenes,
    continuityIssues: [
      {
        code: 'LOCAL_DEV_PROVIDER',
        severity: 'LOW',
        description: 'Screenplay was produced by the local-dev template provider because Gemini credentials were not configured.',
        recommendedAction: 'Replace GEMINI_API_KEY with a valid key and regenerate when production-quality LLM output is required.',
      },
    ],
  };
}
