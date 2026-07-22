import { CapabilityGate } from '@/apps/web/components/CapabilityGate';

export default function ScriptWriterPage() {
  return <CapabilityGate title="Professional Script Writer" description="Structured production scenes with evidence, continuity, risk, and dependency impact." phase="Scheduled after requirements, scene-graph, and storage foundations" requirements={['Versioned Script and Scene MSSQL models', 'Schema-validated mutation APIs with idempotency', 'Source citations and uncertainty records', 'Dependency impact and stale-asset propagation']} />;
}
