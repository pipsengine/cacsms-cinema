'use client';

import { useCallback, useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Database,
  Film,
  FolderKanban,
  ImageIcon,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Workflow,
} from 'lucide-react';

interface DashboardData {
  generatedAt: string;
  system: {
    api: string;
    database: string;
    isHealthy: boolean;
  };
  metrics: {
    projects: number;
    activeJobs: number;
    completedJobs: number;
    approvedAssets: number;
    candidates: number;
    totalAttempts: number;
    successRate: number;
    averageLatencyMs: number;
    totalCost: number;
  };
  queue: Record<string, number>;
  recentJobs: Array<{
    id: string;
    sceneId: string | null;
    projectName: string;
    status: string;
    priority: number;
    updatedAt: string;
    attemptCount: number;
    candidateCount: number;
    provider: string | null;
    latestAttemptStatus: string | null;
  }>;
}

const PIPELINE = [
  'DISCOVER',
  'INTERPRET',
  'COMPILE_PROMPT',
  'GENERATE_CANDIDATES',
  'EVALUATE',
  'DIAGNOSE',
  'REPAIR',
  'APPROVE',
];

const formatStatus = (status: string) =>
  status.replace('PROCESSING:', '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    try {
      const response = await fetch('/api/dashboard', { cache: 'no-store' });
      if (!response.ok) throw new Error('The operational dashboard could not reach its data services.');
      setData(await response.json());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dashboard data is unavailable.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadDashboard(), 0);
    const interval = window.setInterval(() => void loadDashboard(true), 15000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadDashboard]);

  if (!data && !error) return <DashboardSkeleton />;

  return (
    <div className="min-h-full bg-[#f6f8fb]">
      <section className="border-b border-slate-200/80 bg-white px-6 py-7 lg:px-10">
        <div className="mx-auto flex max-w-[1500px] flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
              <Sparkles className="h-4 w-4" />
              Autonomous Media Studio
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 lg:text-3xl">
              Visual Intelligence Control Room
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Live production state, quality signals, and asset delivery across the CACSMS image pipeline.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SystemBadge healthy={data?.system.isHealthy ?? false} />
            <button
              type="button"
              onClick={() => void loadDashboard(true)}
              disabled={refreshing}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href="/visuals/image-generator"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Open workspace <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1500px] space-y-6 px-6 py-7 lg:px-10">
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <TriangleAlert className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={FolderKanban} label="Active projects" value={data?.metrics.projects ?? 0} detail="Persisted in MSSQL" tone="indigo" />
          <MetricCard icon={Workflow} label="Jobs in production" value={data?.metrics.activeJobs ?? 0} detail={`${data?.metrics.completedJobs ?? 0} delivered`} tone="blue" />
          <MetricCard icon={ShieldCheck} label="Approved assets" value={data?.metrics.approvedAssets ?? 0} detail={`${data?.metrics.candidates ?? 0} candidates evaluated`} tone="emerald" />
          <MetricCard icon={Activity} label="Attempt success rate" value={`${(data?.metrics.successRate ?? 0).toFixed(1)}%`} detail={`${data?.metrics.totalAttempts ?? 0} recorded attempts`} tone="violet" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.7fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <PanelHeading title="Production pipeline" description="Current jobs by persisted lifecycle stage" icon={Workflow} />
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {PIPELINE.map((stage) => {
                const count = (data?.queue[stage] ?? 0) + (data?.queue[`PROCESSING:${stage}`] ?? 0);
                return (
                  <div key={stage} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-500 shadow-sm ring-1 ring-slate-200">
                        {PIPELINE.indexOf(stage) + 1}
                      </span>
                      <span className={`h-2.5 w-2.5 rounded-full ${count > 0 ? 'bg-indigo-500 shadow-[0_0_0_4px_rgba(99,102,241,.12)]' : 'bg-slate-300'}`} />
                    </div>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{formatStatus(stage)}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">{count}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm">
            <div className="border-b border-white/10 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300"><Database className="h-5 w-5" /></div>
                <div>
                  <h2 className="font-semibold">System readiness</h2>
                  <p className="mt-0.5 text-xs text-slate-400">Live service checks</p>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <ReadinessRow label="Dashboard API" value={data?.system.api ?? 'unknown'} />
              <ReadinessRow label="MSSQL persistence" value={data?.system.database ?? 'unknown'} />
              <ReadinessRow label="Average stage latency" value={`${((data?.metrics.averageLatencyMs ?? 0) / 1000).toFixed(2)}s`} neutral />
              <ReadinessRow label="Recorded provider cost" value={`$${(data?.metrics.totalCost ?? 0).toFixed(2)}`} neutral />
              <div className="border-t border-white/10 pt-4 text-xs leading-5 text-slate-400">
                Updated {data ? new Date(data.generatedAt).toLocaleTimeString() : '—'} · refreshes every 15 seconds
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.55fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <PanelHeading title="Recent production activity" description="Most recently updated jobs from MSSQL" icon={Clock3} />
            {data?.recentJobs.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                    <tr><th className="px-5 py-3 font-semibold">Scene</th><th className="px-5 py-3 font-semibold">Stage</th><th className="px-5 py-3 font-semibold">Evidence</th><th className="px-5 py-3 font-semibold">Updated</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentJobs.map((job) => (
                      <tr key={job.id} className="transition hover:bg-slate-50/70">
                        <td className="px-5 py-4"><p className="font-medium text-slate-900">{job.sceneId ?? 'Unassigned scene'}</p><p className="mt-0.5 text-xs text-slate-500">{job.projectName}</p></td>
                        <td className="px-5 py-4"><StatusPill status={job.status} /></td>
                        <td className="px-5 py-4 text-slate-600"><span className="font-medium text-slate-900">{job.candidateCount}</span> candidates · <span className="font-medium text-slate-900">{job.attemptCount}</span> attempts<p className="mt-0.5 text-xs text-slate-400">{job.provider ?? 'Provider not selected'}</p></td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-500">{new Date(job.updatedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState />
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <PanelHeading title="Production tools" description="Continue the media workflow" icon={Film} />
            <div className="space-y-2 p-4">
              <QuickLink href="/visuals/image-generator" icon={ImageIcon} title="Image operations" subtitle="Queue, candidates, and quality" />
              <QuickLink href="/storyboards" icon={Film} title="Storyboards" subtitle="Shot planning and continuity" />
              <QuickLink href="/library/assets" icon={CheckCircle2} title="Approved assets" subtitle="Versions and delivery lineage" />
              <QuickLink href="/health" icon={Activity} title="System health" subtitle="Services and diagnostics" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone }: { icon: ComponentType<{ className?: string }>; label: string; value: string | number; detail: string; tone: 'indigo' | 'blue' | 'emerald' | 'violet' }) {
  const tones = { indigo: 'bg-indigo-50 text-indigo-700', blue: 'bg-sky-50 text-sky-700', emerald: 'bg-emerald-50 text-emerald-700', violet: 'bg-violet-50 text-violet-700' };
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p></div><div className={`rounded-xl p-2.5 ${tones[tone]}`}><Icon className="h-5 w-5" /></div></div><p className="mt-4 text-xs text-slate-500">{detail}</p></div>;
}

function PanelHeading({ title, description, icon: Icon }: { title: string; description: string; icon: ComponentType<{ className?: string }> }) {
  return <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4"><div className="rounded-lg bg-slate-100 p-2 text-slate-600"><Icon className="h-4 w-4" /></div><div><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{description}</p></div></div>;
}

function SystemBadge({ healthy }: { healthy: boolean }) {
  return <div className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${healthy ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><span className={`h-2 w-2 rounded-full ${healthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />{healthy ? 'Systems operational' : 'Review required'}</div>;
}

function ReadinessRow({ label, value, neutral = false }: { label: string; value: string; neutral?: boolean }) {
  return <div className="flex items-center justify-between gap-4 text-sm"><span className="text-slate-400">{label}</span><span className={`font-medium capitalize ${neutral ? 'text-white' : 'text-emerald-300'}`}>{value}</span></div>;
}

function StatusPill({ status }: { status: string }) {
  const completed = status === 'COMPLETED';
  const failed = status === 'FAILED';
  const style = completed ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : failed ? 'bg-rose-50 text-rose-700 ring-rose-600/20' : 'bg-indigo-50 text-indigo-700 ring-indigo-600/20';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style}`}>{formatStatus(status)}</span>;
}

function QuickLink({ href, icon: Icon, title, subtitle }: { href: string; icon: ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return <Link href={href} className="group flex items-center gap-3 rounded-xl p-3 transition hover:bg-slate-50"><div className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition group-hover:border-indigo-200 group-hover:text-indigo-600"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-900">{title}</p><p className="truncate text-xs text-slate-500">{subtitle}</p></div><ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-indigo-500" /></Link>;
}

function EmptyState() {
  return <div className="flex flex-col items-center px-6 py-14 text-center"><div className="rounded-2xl bg-slate-100 p-3 text-slate-400"><Workflow className="h-6 w-6" /></div><h3 className="mt-4 font-semibold text-slate-900">No production jobs yet</h3><p className="mt-1 max-w-sm text-sm text-slate-500">Create a project and generation job to begin populating this live dashboard.</p><Link href="/visuals/image-generator" className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700">Open image operations →</Link></div>;
}

function DashboardSkeleton() {
  return <div className="flex min-h-full items-center justify-center bg-[#f6f8fb]"><div className="flex items-center gap-3 text-sm font-medium text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin text-indigo-600" />Loading live production data…</div></div>;
}
