'use client';

import { Activity, Database, LoaderCircle, Server, TriangleAlert } from 'lucide-react';
import { useSystemStatus } from '@/hooks/use-system-status';

export default function SystemHealthPage() {
  const { status, loading, error } = useSystemStatus();
  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading measured health…</div>;
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Measured services</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">System Health</h1><p className="mt-2 text-sm text-slate-500">Only persisted database and API signals are shown; uninstrumented CPU, memory, and provider metrics are omitted.</p></div>
      {error && <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><TriangleAlert className="h-5 w-5" />{error}</div>}
      <div className="grid gap-4 md:grid-cols-3">
        <HealthCard icon={Server} label="Autonomous control" value={status?.systemState || 'Unavailable'} healthy={status?.systemState === 'RUNNING'} />
        <HealthCard icon={Database} label="MSSQL workflow state" value={status?.isHealthy ? 'Healthy' : 'Review required'} healthy={Boolean(status?.isHealthy)} />
        <HealthCard icon={Activity} label="Exceptions" value={`${status?.exceptionJobs ?? 0}`} healthy={(status?.exceptionJobs ?? 0) === 0} />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-semibold text-slate-900">Persisted workload</h2><dl className="mt-5 grid gap-5 sm:grid-cols-5"><Metric label="Active" value={status?.activeJobs ?? 0} /><Metric label="Completed" value={status?.completedJobs ?? 0} /><Metric label="Failed" value={status?.failedJobs ?? 0} /><Metric label="Exceptions" value={status?.exceptionJobs ?? 0} /><Metric label="Average attempt" value={`${((status?.averageProcessingTime ?? 0) / 1000).toFixed(2)}s`} /></dl></div>
    </div>
  );
}

function HealthCard({ icon: Icon, label, value, healthy }: { icon: typeof Server; label: string; value: string; healthy: boolean }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Icon className={`h-6 w-6 ${healthy ? 'text-emerald-600' : 'text-amber-600'}`} /><p className="mt-4 text-sm text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-950">{value}</p></div>; }
function Metric({ label, value }: { label: string; value: string | number }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-2xl font-semibold text-slate-950">{value}</dd></div>; }
