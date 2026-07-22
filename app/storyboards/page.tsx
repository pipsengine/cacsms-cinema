import { CapabilityGate } from '@/apps/web/components/CapabilityGate';

export default function StoryboardEditorPage() {
  return <CapabilityGate title="Storyboard Engine" description="Persisted shots, cinematography, continuity, quality evidence, and immutable asset lineage." phase="Scheduled after the professional Script Writer" requirements={['Storyboard and Shot MSSQL models', 'Shot decomposition and cinematography planner', 'Continuity locks and violations', 'Approved AssetVersion and video-readiness integration']} />;
}
