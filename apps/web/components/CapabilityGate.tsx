import { Construction, ShieldAlert } from 'lucide-react';

export function CapabilityGate({
  title,
  description,
  phase,
  requirements,
}: {
  title: string;
  description: string;
  phase: string;
  requirements: string[];
}) {
  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">CACSMS production capability</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
        <div className="flex items-start gap-4 bg-amber-50 px-6 py-5">
          <div className="rounded-xl bg-white p-2.5 text-amber-700 ring-1 ring-amber-200"><Construction className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold text-amber-950">Capability gated — not production ready</h2>
            <p className="mt-1 text-sm leading-6 text-amber-800">{phase}. No mock records, simulated status, or frontend-only mutations are exposed while its backend and MSSQL foundations are incomplete.</p>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldAlert className="h-4 w-4 text-slate-500" />Required before activation</div>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {requirements.map((requirement) => <li key={requirement} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{requirement}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
