'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, Boxes, CheckCircle2, ChevronRight, CircleDollarSign, Clock3,
  Film, Folder, Gauge, Image as ImageIcon, MapPin, Pause, Play, ShieldCheck,
  Sparkles, Square, WandSparkles, Wrench, XCircle, Zap,
} from 'lucide-react';
import styles from './control-room.module.css';

interface DashboardData {
  generatedAt: string;
  system: { api: string; database: string; isHealthy: boolean; controlState: string; controlVersion: number; controlUpdatedAt: string | null };
  metrics: {
    projects: number; activeJobs: number; queuedJobs: number; completedJobs: number; exceptionJobs: number;
    approvedAssets: number; candidates: number; totalAttempts: number; successRate: number;
    averageLatencyMs: number; totalCost: number; blankImageRate: number | null; averageQuality: number | null;
  };
  quality: { criticalFailures: number; repairsInProgress: number; rejectedCandidates: number; continuityViolations: number; geographicFailures: number };
  queue: Record<string, number>;
  recentJobs: Array<{
    id: string; sceneId: string | null; projectName: string; status: string; priority: number; updatedAt: string;
    attemptCount: number; candidateCount: number; provider: string | null; latestAttemptStatus: string | null;
    failureCode: string | null; evidence: string;
  }>;
}

const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'HUMAN_EXCEPTION_REQUIRED']);
const LIFECYCLE = [
  { label: 'Discover & Interpret', stages: ['DISCOVER', 'INTERPRET', 'DECOMPOSE'] },
  { label: 'Research & Requirements', stages: ['RESEARCH', 'VERIFY_CONTEXT', 'BUILD_REQUIREMENTS'] },
  { label: 'Scene & Cinematography', stages: ['BUILD_SCENE_GRAPH', 'RESOLVE_CONFLICTS', 'PLAN_CINEMATOGRAPHY', 'RETRIEVE_REFERENCES', 'VALIDATE_REFERENCES'] },
  { label: 'Prompt & Model Plan', stages: ['PLAN_WORKFLOW', 'COMPILE_PROMPT', 'SELECT_MODEL', 'RUN_PREFLIGHT', 'QUEUE'] },
  { label: 'Generate & Validate', stages: ['GENERATE_CANDIDATES', 'VALIDATE_FILES', 'REMOVE_DUPLICATES'] },
  { label: 'Evaluate & Repair', stages: ['SCORE_CANDIDATES', 'DIAGNOSE_DEFECTS', 'REPAIR_OR_REGENERATE', 'VERIFY_IDENTITY', 'VERIFY_CONTINUITY', 'VERIFY_GEOGRAPHY', 'VERIFY_HISTORY', 'UPSCALE', 'POST_PROCESS', 'FINAL_QA'] },
  { label: 'Approve & Deliver', stages: ['APPROVE', 'VERSION', 'DELIVER'] },
  { label: 'Learn', stages: ['LEARN'] },
];

const tools = [
  ['Image Workspace', '/visuals/image-generator', ImageIcon],
  ['Generation Queue', '/visuals/image-generator', Boxes],
  ['Candidate Comparison', '/visuals/image-generator', Sparkles],
  ['Quality Evidence', '/qa', ShieldCheck],
  ['Repair History', '/qa', Wrench],
  ['Approved Assets', '/library/assets', CheckCircle2],
] as const;

const displayStage = (value: string) => value.replace('PROCESSING:', '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function ControlRoomLandingPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard', { cache: 'no-store' });
      if (!response.ok) throw new Error('The control room could not load its persisted production state.');
      setData(await response.json());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Production state is unavailable.');
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 15000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [refresh]);

  const activeJob = useMemo(() => data?.recentJobs.find((job) => !TERMINAL.has(job.status)), [data]);
  const activeGroup = activeJob ? Math.max(0, LIFECYCLE.findIndex((group) => group.stages.includes(activeJob.status.replace('PROCESSING:', '')))) : -1;
  const controlState = data?.system.controlState ?? 'UNAVAILABLE';

  async function changeControl(action: 'start' | 'pause' | 'resume' | 'stop' | 'emergency_stop') {
    setBusy(true);
    try {
      const response = await fetch('/api/v1/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-Correlation-Id': crypto.randomUUID() },
        body: JSON.stringify({ action, reason: action === 'emergency_stop' ? 'Operator emergency stop from control room' : `Operator requested ${action} from control room` }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'Control request failed.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Control request failed.');
    } finally {
      setBusy(false);
    }
  }

  return <div className={styles.content}>
    <p className={styles.eyebrow}>AUTONOMOUS MEDIA STUDIO</p>
    <h1>Visual Intelligence Control Room</h1>
    <p className={styles.subtitle}>Live production state, quality signals, and asset delivery across the CACSMS image pipeline.</p>

    <section className={styles.controlBar}>
      <div className={styles.status}><span className={data?.system.isHealthy ? styles.liveDot : styles.warningDot}/><strong>{data?.system.isHealthy ? 'Operational' : 'Unavailable'}</strong><b>•</b>{titleCase(controlState)}</div>
      <div className={styles.meta}><span>Last heartbeat</span><strong>{data ? relativeTime(data.generatedAt) : 'Waiting…'}</strong></div>
      <div className={styles.meta}><span>Mode</span><strong>⚙ Autonomous</strong></div>
      <div className={styles.controls}>
        <button className={styles.primary} disabled={busy || controlState === 'RUNNING'} onClick={() => void changeControl('start')}><Play size={15}/> Start</button>
        <button disabled={busy || controlState !== 'RUNNING'} onClick={() => void changeControl('pause')}><Pause size={15}/> Pause</button>
        <button disabled={busy || controlState !== 'PAUSED'} onClick={() => void changeControl('resume')}><Play size={15}/> Resume</button>
        <button disabled={busy || controlState === 'STOPPED'} onClick={() => void changeControl('stop')}><Square size={14}/> Stop</button>
        <button className={styles.danger} disabled={busy || controlState === 'EMERGENCY_STOP'} onClick={() => void changeControl('emergency_stop')}><AlertTriangle size={16}/> Emergency Stop</button>
      </div>
      <div className={styles.budget}><span>Recorded Provider Cost</span><strong>${(data?.metrics.totalCost ?? 0).toFixed(2)} total</strong></div>
    </section>

    <section className={styles.metrics}>
      <Metric label="Active Projects" value={data?.metrics.projects ?? '—'} icon={Folder} tone="blue" />
      <Metric label="Queued Jobs" value={data?.metrics.queuedJobs ?? '—'} icon={Boxes} tone="purple" />
      <Metric label="Active Jobs" value={data?.metrics.activeJobs ?? '—'} icon={Play} tone="green" />
      <Metric label="Approved Assets" value={data?.metrics.approvedAssets ?? '—'} icon={ShieldCheck} tone="teal" />
      <Metric label="Success Rate" value={data?.metrics.totalAttempts ? `${data.metrics.successRate.toFixed(1)}%` : 'No data'} icon={Gauge} tone="orange" />
      <Metric label="Blank Image Rate" value={data?.metrics.blankImageRate === null || data?.metrics.blankImageRate === undefined ? 'No data' : `${data.metrics.blankImageRate.toFixed(1)}%`} icon={ImageIcon} tone="orange" />
      <Metric label="Average Quality" value={data?.metrics.averageQuality === null || data?.metrics.averageQuality === undefined ? 'No data' : `${data.metrics.averageQuality.toFixed(1)}%`} icon={Sparkles} tone="purple" />
      <Metric label="Current Cost" value={`$${(data?.metrics.totalCost ?? 0).toFixed(2)}`} icon={CircleDollarSign} tone="blue" />
    </section>

    <section className={`${styles.panel} ${styles.production}`}>
      <h2>Active Production</h2>
      <div className={styles.emptyProduction}>
        <div className={styles.emptyArt}><Film size={68}/><span>{activeJob ? activeJob.projectName : 'No job currently running'}</span><Link href="/visuals/image-generator">Open generation queue</Link></div>
        <div className={styles.jobDetails}>
          <div className={styles.detailGrid}>
            <span>Project</span><b>{activeJob?.projectName ?? '—'}</b><span>Provider / Model</span><b>{activeJob?.provider ?? '—'}</b>
            <span>Scene</span><b>{activeJob?.sceneId ?? '—'}</b><span>Workflow</span><b>{activeJob ? displayStage(activeJob.status) : '—'}</b>
            <span>Shot</span><b>—</b><span>Last Updated</span><b>{activeJob ? relativeTime(activeJob.updatedAt) : '—'}</b>
          </div>
          <div className={styles.waiting}><strong>{activeJob ? displayStage(activeJob.status) : 'Waiting for production'}</strong><div><i style={{ width: `${activeGroup < 0 ? 0 : ((activeGroup + 1) / LIFECYCLE.length) * 100}%` }}/></div></div>
        </div>
      </div>
    </section>

    <div className={styles.lowerGrid}>
      <div className={styles.leftColumn}>
        <section className={`${styles.panel} ${styles.lifecycle}`}>
          <div className={styles.sectionHead}><h2><Zap size={19}/> Autonomous Production Lifecycle</h2><Link href="/visuals/image-generator">View full 33-stage workflow ↗</Link></div>
          <div className={styles.steps}>{LIFECYCLE.map((group, index) => {
            const count = group.stages.reduce((total, stage) => total + (data?.queue[stage] ?? 0) + (data?.queue[`PROCESSING:${stage}`] ?? 0), 0);
            return <div className={`${styles.step} ${activeGroup === index ? styles.currentStep : ''}`} key={group.label}><i>{index + 1}</i><span>{group.label}</span><strong>{count}</strong><small>{count ? 'Active' : 'Idle'}</small></div>;
          })}</div>
        </section>

        <div className={styles.dataGrid}>
          <section className={`${styles.panel} ${styles.activityPanel}`}>
            <h2><Clock3 size={19}/> Recent Production Activity</h2>
            <div className={styles.tableWrap}><table><thead><tr><th>Scene</th><th>Stage</th><th>Evidence</th><th>Provider / Model</th><th>Updated</th></tr></thead><tbody>
              {data?.recentJobs.slice(0, 3).map((job) => <tr key={job.id}><td><span>{job.sceneId ?? job.projectName}</span></td><td>{displayStage(job.status)}</td><td><em className={job.failureCode ? styles.exceptionEvidence : styles.normalEvidence}>{job.evidence}</em></td><td>{job.provider ?? 'Not selected'}</td><td>{new Date(job.updatedAt).toLocaleString()}</td></tr>)}
              {!data?.recentJobs.length && <tr><td colSpan={5} className={styles.emptyTable}>No production activity has been recorded.</td></tr>}
            </tbody></table></div><Link className={styles.footerLink} href="/visuals/image-generator">View all activity →</Link>
          </section>
          <section className={`${styles.panel} ${styles.exceptions}`}>
            <h2><ShieldCheck size={19}/> Quality &amp; Exceptions</h2>
            <ExceptionRow icon={AlertTriangle} label="Critical failures" count={data?.quality.criticalFailures ?? 0} tone="red" />
            <ExceptionRow icon={Wrench} label="Repairs in progress" count={data?.quality.repairsInProgress ?? 0} tone="blue" />
            <ExceptionRow icon={XCircle} label="Rejected candidates" count={data?.quality.rejectedCandidates ?? 0} tone="red" />
            <ExceptionRow icon={CheckCircle2} label="Continuity violations" count={data?.quality.continuityViolations ?? 0} tone="purple" />
            <ExceptionRow icon={MapPin} label="Geographic failures" count={data?.quality.geographicFailures ?? 0} tone="purple" />
            <Link className={styles.footerLink} href="/qa">Review exceptions →</Link>
          </section>
        </div>
      </div>

      <aside className={`${styles.panel} ${styles.toolPanel}`}><h2><WandSparkles size={19}/> Production Tools</h2>{tools.map(([label, href, Icon]) => <Link href={href} key={label}><Icon size={19}/><span>{label}</span><ChevronRight size={17}/></Link>)}</aside>
    </div>
    {error && <div className={styles.errorToast}><AlertTriangle size={18}/>{error}</div>}
  </div>;
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: ComponentType<{ size?: number }>; tone: string }) {
  const noData = value === 'No data';
  return <article className={styles.metric}><div className={`${styles.metricIcon} ${styles[tone]}`}><Icon size={18}/></div><div><span>{label}</span><strong className={noData ? styles.noData : ''}>{value}</strong></div></article>;
}

function ExceptionRow({ icon: Icon, label, count, tone }: { icon: ComponentType<{ size?: number; className?: string }>; label: string; count: number; tone: string }) {
  return <div className={styles.exceptionRow}><Icon className={styles[tone]} size={17}/><span>{label}</span><strong>{count}</strong></div>;
}

function titleCase(value: string) { return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function relativeTime(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
}
