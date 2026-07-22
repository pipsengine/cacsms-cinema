'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertOctagon, LoaderCircle, Pause, Play, Server, Square, TriangleAlert, Workflow } from 'lucide-react';
import { JOB_STATUSES } from '@/lib/job-status';

interface JobRecord { id: string; sceneId: string | null; status: string; priority: number; project: { name: string }; attempts: unknown[]; candidates: unknown[] }
interface Control { desiredState: string; reason: string | null; version: number }

const terminal = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'HUMAN_EXCEPTION_REQUIRED']);

export default function ImageGeneratorWorkspace() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [control, setControl] = useState<Control | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [jobsResponse, controlResponse] = await Promise.all([fetch('/api/jobs', { cache: 'no-store' }), fetch('/api/v1/system/control', { cache: 'no-store' })]);
      if (!jobsResponse.ok || !controlResponse.ok) throw new Error('Operational state could not be loaded.');
      setJobs(await jobsResponse.json());
      setControl(await controlResponse.json());
      setError(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Operational state is unavailable.'); }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [refresh]);

  const activeJob = useMemo(() => jobs.find((job) => !terminal.has(job.status) && !job.status.startsWith('PROCESSING:')) ?? jobs.find((job) => job.status.startsWith('PROCESSING:')), [jobs]);
  const activeStage = activeJob?.status.replace('PROCESSING:', '') ?? null;
  const progress = activeStage ? Math.max(0, (JOB_STATUSES.indexOf(activeStage as never) / (JOB_STATUSES.length - 4)) * 100) : 0;

  async function changeControl(action: 'start' | 'pause' | 'resume' | 'stop' | 'emergency_stop') {
    setBusy(true);
    try {
      const response = await fetch('/api/v1/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-Correlation-Id': crypto.randomUUID() },
        body: JSON.stringify({ action, reason: action === 'emergency_stop' ? 'Operator emergency stop' : `Operator requested ${action}` }),
      });
      if (!response.ok) throw new Error((await response.json()).error?.message ?? 'Control request failed.');
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Control request failed.'); }
    finally { setBusy(false); }
  }

  if (!control && !error) return <div className="flex h-full items-center justify-center text-sm text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading persisted operations…</div>;

  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-5"><div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center"><div><h1 className="text-xl font-semibold text-slate-950">Autonomous Image Operations</h1><div className="mt-2 flex items-center gap-3 text-sm text-slate-500"><span className="flex items-center gap-1.5"><Activity className={`h-4 w-4 ${control?.desiredState === 'RUNNING' ? 'text-emerald-500' : 'text-amber-500'}`} />{control?.desiredState ?? 'Unavailable'}</span><span>•</span><span>{jobs.filter((job) => !terminal.has(job.status)).length} persisted jobs</span></div></div><div className="flex flex-wrap gap-2"><ControlButton icon={Play} label={control?.desiredState === 'PAUSED' ? 'Resume' : 'Start'} disabled={busy || control?.desiredState === 'RUNNING'} onClick={() => void changeControl(control?.desiredState === 'PAUSED' ? 'resume' : 'start')} /><ControlButton icon={Pause} label="Pause" disabled={busy || control?.desiredState !== 'RUNNING'} onClick={() => void changeControl('pause')} /><ControlButton icon={Square} label="Stop" disabled={busy || control?.desiredState === 'STOPPED'} onClick={() => void changeControl('stop')} /><ControlButton danger icon={AlertOctagon} label="Emergency stop" disabled={busy || control?.desiredState === 'EMERGENCY_STOP'} onClick={() => void changeControl('emergency_stop')} /></div></div></header>
      <main className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="font-semibold text-slate-900">Active lifecycle</h2><p className="mt-1 text-xs text-slate-500">Progress is calculated only from the persisted stage.</p></div>{activeJob ? <div className="p-6"><div className="flex items-start justify-between"><div><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{activeJob.sceneId ?? 'Scene unassigned'}</span><h3 className="mt-3 font-semibold text-slate-950">{activeJob.project.name}</h3></div><span className="text-sm font-medium text-slate-600">{activeStage?.replaceAll('_', ' ')}</span></div><div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} /></div><div className="mt-3 flex justify-between text-xs text-slate-500"><span>{activeJob.attempts.length} attempts</span><span>{progress.toFixed(1)}%</span><span>{activeJob.candidates.length} candidates</span></div></div> : <Empty message="No active job is persisted." />}</section>
        <aside className="space-y-6"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><Workflow className="h-5 w-5 text-indigo-600" /><div><h2 className="font-semibold text-slate-900">Queue state</h2><p className="text-xs text-slate-500">MSSQL-backed</p></div></div><dl className="mt-5 space-y-3 text-sm"><Row label="Running control" value={control?.desiredState ?? 'Unknown'} /><Row label="Active jobs" value={`${jobs.filter((job) => !terminal.has(job.status)).length}`} /><Row label="Exceptions" value={`${jobs.filter((job) => job.status === 'HUMAN_EXCEPTION_REQUIRED').length}`} /></dl></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex gap-3"><Server className="mt-0.5 h-5 w-5 text-amber-700" /><div><h2 className="font-semibold text-amber-950">Providers not configured</h2><p className="mt-1 text-sm leading-6 text-amber-800">The engine will raise an explicit human exception instead of simulating generation or silently using placeholders.</p></div></div></div></aside>
      </main>
      {error && <div className="fixed bottom-5 right-5 flex max-w-md gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-lg"><TriangleAlert className="h-5 w-5 shrink-0" />{error}</div>}
    </div>
  );
}

function ControlButton({ icon: Icon, label, disabled, danger = false, onClick }: { icon: typeof Play; label: string; disabled: boolean; danger?: boolean; onClick: () => void }) { return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-40 ${danger ? 'bg-rose-600 text-white hover:bg-rose-700' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{label}</button>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between"><dt className="text-slate-500">{label}</dt><dd className="font-medium text-slate-900">{value}</dd></div>; }
function Empty({ message }: { message: string }) { return <div className="flex flex-col items-center px-6 py-16 text-center"><Workflow className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-700">{message}</p></div>; }
