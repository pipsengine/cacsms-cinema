'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AutonomyControlBar } from './components/AutonomyControlBar';
import { ImageGeneratorHeader } from './components/ImageGeneratorHeader';
import { JobStageProgress } from './components/JobStageProgress';
import { CandidatesPanel, JobDetailPanel, QueuePanel } from './components/WorkspacePanels';
import {
  TERMINAL_STATUSES,
  type DashboardPayload,
  type JobRecord,
  type ProjectRecord,
} from './types';
import styles from './image-generator.module.css';

/**
 * Image Generator — job queue, selected-job progress, candidates.
 * Fleet KPIs / studio lifecycle overview belong on the Control Room (/).
 */
export function ImageGeneratorWorkspace({
  initialJobId = null,
  focus = 'all',
}: {
  initialJobId?: string | null;
  focus?: 'all' | 'queue' | 'job' | 'candidates' | 'attempts' | 'failures';
} = {}) {
  const [controlState, setControlState] = useState('UNAVAILABLE');
  const [isHealthy, setIsHealthy] = useState(false);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [controlBusy, setControlBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [dashboardResponse, jobsResponse, projectsResponse] = await Promise.all([
        fetch('/api/dashboard', { cache: 'no-store' }),
        fetch('/api/jobs', { cache: 'no-store' }),
        fetch('/api/projects', { cache: 'no-store' }),
      ]);

      if (!jobsResponse.ok) throw new Error('Generation queue could not be loaded.');
      if (!projectsResponse.ok) throw new Error('Projects could not be loaded.');

      const nextJobs = await jobsResponse.json() as JobRecord[];
      const nextProjects = await projectsResponse.json() as ProjectRecord[];

      if (dashboardResponse.ok) {
        const dashboard = await dashboardResponse.json() as DashboardPayload;
        setControlState(dashboard.system.controlState);
        setIsHealthy(dashboard.system.isHealthy);
      } else {
        setIsHealthy(false);
        setControlState('UNAVAILABLE');
      }

      setJobs(nextJobs);
      setProjects(nextProjects);
      setProjectId((current) => current || nextProjects[0]?.id || '');
      setSelectedJobId((current) => {
        const preferred = initialJobId || current;
        if (preferred && nextJobs.some((job) => job.id === preferred)) return preferred;
        if (initialJobId) return initialJobId;
        const active = nextJobs.find((job) => !TERMINAL_STATUSES.has(job.status));
        return active?.id || nextJobs[0]?.id || null;
      });
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Image generator workspace unavailable.');
    } finally {
      setLoading(false);
    }
  }, [initialJobId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 10000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    if (initialJobId) setSelectedJobId(initialJobId);
  }, [initialJobId]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) || null,
    [jobs, selectedJobId],
  );

  const candidates = selectedJob?.candidates || [];

  async function changeControl(action: 'start' | 'pause' | 'resume' | 'stop' | 'emergency_stop') {
    setControlBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/system/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'X-Correlation-Id': crypto.randomUUID(),
        },
        body: JSON.stringify({
          action,
          reason:
            action === 'emergency_stop'
              ? 'Operator emergency stop from Image Generator'
              : `Operator requested ${action} from Image Generator`,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'Control request failed.');
      setNotice(`Worker control: ${action.replaceAll('_', ' ')}.`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Control request failed.');
    } finally {
      setControlBusy(false);
    }
  }

  async function createJob() {
    if (!projectId) {
      setError('Select a project before enqueueing a job.');
      return;
    }
    setCreateBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ projectId, priority: 0 }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Job creation failed.');
      setNotice('Job enqueued at DISCOVER. Start the worker to advance stages.');
      setSelectedJobId(result.id);
      setSelectedCandidateId(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Job creation failed.');
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className={styles.content} data-focus={focus}>
      <ImageGeneratorHeader />
      {focus !== 'all' ? (
        <p className={styles.focusNote} role="status">
          Lifecycle view: {focus.replaceAll('_', ' ')}
        </p>
      ) : null}
      {loading ? (
        <div className={styles.loadingBanner} role="status">
          <span className={styles.spinner} aria-hidden />
          Loading generation queue…
        </div>
      ) : null}

      {error ? (
        <aside className={styles.banner} role="alert">
          <div className={styles.bannerIcon}>!</div>
          <div>
            <strong>Workspace error</strong>
            {error}
          </div>
        </aside>
      ) : null}

      {notice ? (
        <aside className={`${styles.banner} ${styles.noticeBanner}`} role="status">
          <div className={`${styles.bannerIcon} ${styles.noticeIcon}`}>✓</div>
          <div>
            <strong>Update</strong>
            {notice}
          </div>
        </aside>
      ) : null}

      <AutonomyControlBar
        controlState={controlState}
        isHealthy={isHealthy}
        selectedJob={selectedJob}
        busy={controlBusy}
        onAction={(action) => void changeControl(action)}
      />

      <div className={styles.generatorWorkspace}>
        <QueuePanel
          jobs={jobs}
          projects={projects}
          selectedJobId={selectedJobId}
          projectId={projectId}
          onSelectJob={(id) => {
            setSelectedJobId(id);
            setSelectedCandidateId(null);
          }}
          onSelectProject={setProjectId}
          onCreateJob={() => void createJob()}
          createBusy={createBusy}
        />

        <section className={styles.panel} aria-label="Selected job">
          <div className={styles.panelHead}>
            <div>
              <h2>Selected job</h2>
              <small>Stage progress, attempts, and failure evidence</small>
            </div>
          </div>
          <div className={styles.jobMain}>
            <JobStageProgress job={selectedJob} />
            <JobDetailPanel job={selectedJob} />
          </div>
        </section>

        <section className={styles.panel} aria-label="Candidates">
          <div className={styles.panelHead}>
            <div>
              <h2>Candidates</h2>
              <small>
                {selectedJob
                  ? `${candidates.length} validated output(s)`
                  : 'Select a job'}
              </small>
            </div>
          </div>
          <CandidatesPanel
            candidates={candidates}
            selectedId={selectedCandidateId}
            onSelect={setSelectedCandidateId}
            jobLabel={selectedJob ? (selectedJob.project?.name || selectedJob.projectId) : null}
          />
        </section>
      </div>
    </div>
  );
}
