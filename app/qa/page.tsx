import { CapabilityGate } from '@/apps/web/components/CapabilityGate';

export default function QualityAssurancePage() {
  return <CapabilityGate title="Quality Evidence Dashboard" description="Evidence-based technical, semantic, identity, continuity, geographic, historical, and safety gates." phase="Scheduled after real candidate generation and file validation" requirements={['Versioned evaluator contracts and registry', 'Persisted scores, confidence, evidence, and defects', 'Critical-gate policy that cannot be overridden by averages', 'Golden-scene benchmarks and quality target reporting']} />;
}
