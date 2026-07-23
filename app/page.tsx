'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, Boxes, BrainCircuit, CheckCircle2, ChevronRight, CircleDollarSign, Clock3,
  FileSearch, Film, Folder, Gauge, Image as ImageIcon, Lightbulb, MapPin, Play, RefreshCw, ShieldCheck,
  Sparkles, Target, WandSparkles, Wrench, XCircle,
} from 'lucide-react';
import styles from './control-room.module.css';
import { LIFECYCLE_STAGES } from '@/apps/web/config/lifecycle-navigation';
import { ContentLifecyclePanel } from '@/apps/web/features/lifecycle/ContentLifecyclePanel';
import { ControlRoomLifecycleStrip } from '@/apps/web/features/lifecycle/ControlRoomLifecycleStrip';

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
const POLL_MS = 3000;
const NIGERIA_TZ = 'Africa/Lagos';

const tools = [
  ['Strategy & Fields', '/strategy', Target],
  ['Content Intelligence', '/content-intelligence', BrainCircuit],
  ['Idea Qualification', '/ideas', Lightbulb],
  ['Research & Evidence', '/research', FileSearch],
  ['Image Workspace', '/visuals/image-generator', ImageIcon],
  ['Generation Queue', '/visuals/generation/queue', Boxes],
  ['Storyboard Workspace', '/storyboard/storyboard-editor', Sparkles],
  ['Quality Evidence', '/visuals/quality/evidence', ShieldCheck],
  ['Exception Resolution', '/visuals/quality/exceptions', Wrench],
  ['Approved Assets', '/visuals/delivery/approved-assets', CheckCircle2],
] as const;

const displayStage = (value: string) =>
  value.replace('PROCESSING:', '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function ControlRoomLandingPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setRefreshing(true);
    try {
      const response = await fetch('/api/dashboard', { cache: 'no-store' });
      if (!response.ok) throw new Error('The control room could not load its persisted production state.');
      setData(await response.json());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Production state is unavailable.');
    } finally {
      if (!options?.silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh({ silent: true }), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh({ silent: true });
    };
    const onControlChanged = () => void refresh({ silent: true });
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('cacsms:system-control-changed', onControlChanged);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('cacsms:system-control-changed', onControlChanged);
    };
  }, [refresh]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const activeJob = useMemo(
    () => data?.recentJobs.find((job) => !TERMINAL.has(job.status.replace('PROCESSING:', '')) && !TERMINAL.has(job.status)),
    [data],
  );
  const activeGroup = activeJob
    ? Math.max(
        0,
        LIFECYCLE_STAGES.findIndex((group) =>
          group.workflowStatuses.includes(activeJob.status.replace('PROCESSING:', '')),
        ),
      )
    : -1;

  const exceptionTotal =
    (data?.quality.criticalFailures ?? 0) +
    (data?.metrics.exceptionJobs ?? 0);
  const systemPercent = systemStatusPercent(data);
  const controlState = data?.system.controlState ?? 'UNAVAILABLE';

  return (
    <div className={styles.content}>
      <div className={styles.headingRow}>
        <div>
          <p className={styles.eyebrow}>AUTONOMOUS MEDIA STUDIO</p>
          <h1>CACSMS Control Room</h1>
          <p className={styles.subtitle}>
            Live production state, quality signals, and asset delivery. Start or stop the system from the
            top bar — stages advance automatically while Running.
          </p>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => void refresh()}
          disabled={refreshing}
          aria-label="Refresh control room"
        >
          <RefreshCw size={14} className={refreshing ? styles.spin : undefined} aria-hidden />
          Refresh
        </button>
      </div>

      <section className={styles.controlBar} style={{ marginTop: 14 }} aria-label="Live production summary">
        <div className={styles.meta}>
          <span>Last heartbeat</span>
          <strong>{data ? relativeTime(data.generatedAt, now) : 'Waiting…'}</strong>
        </div>
        <div className={styles.meta}>
          <span>Database</span>
          <strong>{data?.system.database === 'connected' ? 'Connected' : 'Checking…'}</strong>
        </div>
        <div className={styles.meta}>
          <span>Mode</span>
          <strong>Autonomous</strong>
        </div>
        <div className={styles.meta}>
          <span>Exceptions</span>
          <strong>{exceptionTotal}</strong>
        </div>

        <div
          className={styles.systemMeter}
          role="meter"
          aria-label="System status"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={systemPercent}
          aria-valuetext={`${systemPercent}% ${meterCaption(controlState)}`}
        >
          <SystemStatusDisc percent={systemPercent} controlState={controlState} />
          <div className={styles.systemMeterCopy}>
            <span>System status</span>
            <strong className={meterToneClass(controlState, styles)}>
              {systemPercent}% · {meterCaption(controlState)}
            </strong>
          </div>
        </div>

        <div className={styles.budget}>
          <span>Recorded Provider Cost</span>
          <strong>${(data?.metrics.totalCost ?? 0).toFixed(2)} total</strong>
        </div>
      </section>

      <section className={styles.metrics}>
        <Metric label="Active Projects" value={data?.metrics.projects ?? '—'} icon={Folder} tone="blue" />
        <Metric label="Queued Jobs" value={data?.metrics.queuedJobs ?? '—'} icon={Boxes} tone="purple" />
        <Metric label="Active Jobs" value={data?.metrics.activeJobs ?? '—'} icon={Play} tone="green" />
        <Metric label="Approved Assets" value={data?.metrics.approvedAssets ?? '—'} icon={ShieldCheck} tone="teal" />
        <Metric
          label="Success Rate"
          value={data?.metrics.totalAttempts ? `${data.metrics.successRate.toFixed(1)}%` : 'No data'}
          icon={Gauge}
          tone="orange"
        />
        <Metric
          label="Blank Image Rate"
          value={
            data?.metrics.blankImageRate === null || data?.metrics.blankImageRate === undefined
              ? 'No data'
              : `${data.metrics.blankImageRate.toFixed(1)}%`
          }
          icon={ImageIcon}
          tone="orange"
        />
        <Metric
          label="Average Quality"
          value={
            data?.metrics.averageQuality === null || data?.metrics.averageQuality === undefined
              ? 'No data'
              : `${data.metrics.averageQuality.toFixed(1)}%`
          }
          icon={Sparkles}
          tone="purple"
        />
        <Metric
          label="Current Cost"
          value={`$${(data?.metrics.totalCost ?? 0).toFixed(2)}`}
          icon={CircleDollarSign}
          tone="blue"
        />
      </section>

      <section className={`${styles.panel} ${styles.production}`}>
        <div className={styles.sectionHead}>
          <h2>Active Production</h2>
          <span className={styles.liveBadge} aria-live="polite">
            <span className={styles.liveDot} aria-hidden />
            Live · updates every {POLL_MS / 1000}s
          </span>
        </div>
        <div className={styles.emptyProduction}>
          <div className={styles.emptyArt}>
            <Film size={68} />
            <span>{activeJob ? activeJob.projectName : 'No job currently running'}</span>
            <Link href="/visuals/image-generator">Open generation queue</Link>
          </div>
          <div className={styles.jobDetails}>
            <div className={styles.detailGrid}>
              <span>Project</span>
              <b>{activeJob?.projectName ?? '—'}</b>
              <span>Provider / Model</span>
              <b>{activeJob?.provider ?? '—'}</b>
              <span>Scene</span>
              <b>{activeJob?.sceneId ?? '—'}</b>
              <span>Workflow</span>
              <b>{activeJob ? displayStage(activeJob.status) : '—'}</b>
              <span>Attempts</span>
              <b>{activeJob?.attemptCount ?? '—'}</b>
              <span>Last Updated</span>
              <b>{activeJob ? relativeTime(activeJob.updatedAt, now) : '—'}</b>
            </div>
            <div className={styles.waiting}>
              <strong>{activeJob ? displayStage(activeJob.status) : 'Waiting for production'}</strong>
              <div>
                <i
                  style={{
                    width: `${activeGroup < 0 ? 0 : ((activeGroup + 1) / LIFECYCLE_STAGES.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.lowerGrid}>
        <div className={styles.leftColumn}>
          <ContentLifecyclePanel />
          <ControlRoomLifecycleStrip queue={data?.queue} activeWorkflowIndex={activeGroup} />

          <div className={styles.dataGrid}>
            <section className={`${styles.panel} ${styles.activityPanel}`}>
              <h2>
                <Clock3 size={19} /> Recent Production Activity
              </h2>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Scene</th>
                      <th>Stage</th>
                      <th>Evidence</th>
                      <th>Provider / Model</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recentJobs.map((job) => (
                      <tr key={job.id}>
                        <td>
                          <span>{job.sceneId ?? job.projectName}</span>
                        </td>
                        <td>{displayStage(job.status)}</td>
                        <td>
                          <em className={job.failureCode ? styles.exceptionEvidence : styles.normalEvidence}>
                            {job.evidence}
                          </em>
                        </td>
                        <td>{job.provider ?? 'Not selected'}</td>
                        <td title={formatNigeria(job.updatedAt)}>
                          {relativeTime(job.updatedAt, now)}
                        </td>
                      </tr>
                    ))}
                    {!data?.recentJobs.length && (
                      <tr>
                        <td colSpan={5} className={styles.emptyTable}>
                          No production activity has been recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Link className={styles.footerLink} href="/visuals/generation/queue">
                View all activity →
              </Link>
            </section>
            <section className={`${styles.panel} ${styles.exceptions}`}>
              <h2>
                <ShieldCheck size={19} /> Quality &amp; Exceptions
              </h2>
              <ExceptionRow
                icon={AlertTriangle}
                label="Critical failures"
                count={data?.quality.criticalFailures ?? 0}
                tone="red"
              />
              <ExceptionRow
                icon={Wrench}
                label="Repairs in progress"
                count={data?.quality.repairsInProgress ?? 0}
                tone="blue"
              />
              <ExceptionRow
                icon={XCircle}
                label="Rejected candidates"
                count={data?.quality.rejectedCandidates ?? 0}
                tone="red"
              />
              <ExceptionRow
                icon={CheckCircle2}
                label="Continuity violations"
                count={data?.quality.continuityViolations ?? 0}
                tone="purple"
              />
              <ExceptionRow
                icon={MapPin}
                label="Geographic failures"
                count={data?.quality.geographicFailures ?? 0}
                tone="purple"
              />
              <Link className={styles.footerLink} href="/visuals/quality/exceptions">
                Review exceptions →
              </Link>
            </section>
          </div>
        </div>

        <aside className={`${styles.panel} ${styles.toolPanel}`}>
          <h2>
            <WandSparkles size={19} /> Production Tools
          </h2>
          {tools.map(([label, href, Icon]) => (
            <Link href={href} key={label}>
              <Icon size={19} />
              <span>{label}</span>
              <ChevronRight size={17} />
            </Link>
          ))}
        </aside>
      </div>
      {error && (
        <div className={styles.errorToast}>
          <AlertTriangle size={18} />
          {error}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ size?: number }>;
  tone: string;
}) {
  const noData = value === 'No data';
  return (
    <article className={styles.metric}>
      <div className={`${styles.metricIcon} ${styles[tone]}`}>
        <Icon size={18} />
      </div>
      <div>
        <span>{label}</span>
        <strong className={noData ? styles.noData : ''}>{value}</strong>
      </div>
    </article>
  );
}

function ExceptionRow({
  icon: Icon,
  label,
  count,
  tone,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  count: number;
  tone: string;
}) {
  return (
    <div className={styles.exceptionRow}>
      <Icon className={styles[tone]} size={17} />
      <span>{label}</span>
      <strong>{count}</strong>
    </div>
  );
}

function relativeTime(value: string, now: number) {
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
}

function formatNigeria(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: NIGERIA_TZ,
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));
}

function systemStatusPercent(data: DashboardData | null): number {
  if (!data) return 0;
  const state = data.system.controlState;
  if (state === 'STOPPED' || state === 'EMERGENCY_STOP' || state === 'UNAVAILABLE') return 0;

  const { completedJobs, activeJobs, queuedJobs, exceptionJobs, successRate, totalAttempts } =
    data.metrics;
  const workload = completedJobs + activeJobs + queuedJobs + exceptionJobs;

  let percent = 0;
  if (workload > 0) {
    percent = (completedJobs / workload) * 70;
    if (activeJobs > 0) percent += Math.min(20, (activeJobs / workload) * 20);
    if (totalAttempts > 0) percent += (successRate / 100) * 10;
    percent -= Math.min(25, (exceptionJobs / Math.max(1, workload)) * 25);
  } else if (state === 'RUNNING') {
    // Started with no jobs yet — baseline online readiness
    percent = data.system.isHealthy ? 15 : 5;
  } else if (state === 'PAUSED') {
    percent = data.system.isHealthy ? 8 : 0;
  }

  return Math.max(0, Math.min(100, Math.round(percent)));
}

function meterCaption(controlState: string) {
  switch (controlState) {
    case 'RUNNING':
      return 'Running';
    case 'PAUSED':
      return 'Paused';
    case 'EMERGENCY_STOP':
      return 'Emergency';
    case 'STOPPED':
      return 'Idle';
    default:
      return 'Unavailable';
  }
}

function meterToneClass(
  controlState: string,
  sheet: typeof styles,
): string | undefined {
  switch (controlState) {
    case 'RUNNING':
      return sheet.meterRunning;
    case 'PAUSED':
      return sheet.meterPaused;
    case 'EMERGENCY_STOP':
      return sheet.meterEmergency;
    case 'STOPPED':
      return sheet.meterIdle;
    default:
      return sheet.meterIdle;
  }
}

function SystemStatusDisc({
  percent,
  controlState,
}: {
  percent: number;
  controlState: string;
}) {
  const size = 52;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const strokeColor =
    controlState === 'RUNNING'
      ? '#15803d'
      : controlState === 'PAUSED'
        ? '#c2410c'
        : controlState === 'EMERGENCY_STOP'
          ? '#b91c1c'
          : '#94a3b8';

  return (
    <div className={styles.systemDisc} aria-hidden>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e8edf5"
          strokeWidth={stroke}
        />
        <circle
          className={styles.systemDiscProgress}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className={styles.systemDiscValue}>{percent}%</span>
    </div>
  );
}
