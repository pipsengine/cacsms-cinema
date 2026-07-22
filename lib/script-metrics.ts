export interface ScriptSceneFields {
  purpose: string;
  narration: string;
  visualIntention: string;
  locationPeriod: string;
  emotionalDirection: string;
  cameraDirection: string;
  soundDirection: string;
  durationSec: number;
}

export function calculateSceneReadiness(scene: ScriptSceneFields): number {
  const textFields = [scene.purpose, scene.narration, scene.visualIntention, scene.locationPeriod, scene.emotionalDirection, scene.cameraDirection, scene.soundDirection];
  const completed = textFields.filter((value) => value.trim().length >= 8).length + (scene.durationSec > 0 ? 1 : 0);
  return Math.round((completed / 8) * 100);
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
