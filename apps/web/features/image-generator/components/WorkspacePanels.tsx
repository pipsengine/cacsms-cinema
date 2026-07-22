'use client';

import { ImageOff } from 'lucide-react';
import {
  displayStage,
  relativeTime,
  type CandidateRecord,
  type JobRecord,
  type ProjectRecord,
} from '../types';
import styles from '../image-generator.module.css';

export function QueuePanel({
  jobs,
  projects,
  selectedJobId,
  projectId,
  onSelectJob,
  onSelectProject,
  onCreateJob,
  createBusy,
}: {
  jobs: JobRecord[];
  projects: ProjectRecord[];
  selectedJobId: string | null;
  projectId: string;
  onSelectJob: (id: string) => void;
  onSelectProject: (id: string) => void;
  onCreateJob: () => void;
  createBusy: boolean;
}) {
  return (
    <section className={styles.panel} aria-label="Generation queue">
      <div className={styles.panelHead}>
        <div>
          <h2>Queue</h2>
          <small>{jobs.length} job(s)</small>
        </div>
      </div>
      <div className={styles.createBar}>
        <label className={styles.srOnly} htmlFor="ig-project">Project</label>
        <select
          id="ig-project"
          value={projectId}
          onChange={(event) => onSelectProject(event.target.value)}
        >
          <option value="">Select project…</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={!projectId || createBusy}
          onClick={onCreateJob}
        >
          {createBusy ? 'Creating…' : 'Enqueue job'}
        </button>
      </div>
      {!jobs.length ? (
        <div className={styles.emptyState} role="status">
          <h3>No jobs</h3>
          <p>Enqueue a job at DISCOVER, then Start the worker so stages can advance.</p>
        </div>
      ) : (
        <div className={styles.queueList} role="list">
          {jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              role="listitem"
              className={`${styles.queueRow} ${job.id === selectedJobId ? styles.queueRowActive : ''}`}
              onClick={() => onSelectJob(job.id)}
              aria-pressed={job.id === selectedJobId}
            >
              <div>
                <strong>{job.project?.name || job.projectId}</strong>
                <small>{job.id.slice(0, 8)}</small>
              </div>
              <div>
                <strong>{displayStage(job.status)}</strong>
                <small>{relativeTime(job.updatedAt)}</small>
              </div>
              <span className={styles.pill}>{job.candidates?.length ?? 0}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function JobDetailPanel({ job }: { job: JobRecord | null }) {
  if (!job) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>Select a job</h3>
        <p>Job details, attempts, and failure codes appear here.</p>
      </div>
    );
  }

  const attempts = job.attempts || [];

  return (
    <div className={styles.detailStack}>
      <section className={styles.detailSection}>
        <h3>Job</h3>
        <div className={styles.kv}><span>Project</span><strong>{job.project?.name || job.projectId}</strong></div>
        <div className={styles.kv}><span>Status</span><strong>{displayStage(job.status)}</strong></div>
        <div className={styles.kv}><span>Scene</span><strong>{job.sceneId || '—'}</strong></div>
        <div className={styles.kv}><span>Priority</span><strong>{job.priority}</strong></div>
        <div className={styles.kv}><span>Budget</span><strong>{job.budget == null ? '—' : `$${job.budget}`}</strong></div>
        <div className={styles.kv}><span>Failure</span><strong>{job.failureCode || 'None'}</strong></div>
        <div className={styles.kv}><span>Updated</span><strong>{new Date(job.updatedAt).toLocaleString()}</strong></div>
      </section>
      <section className={styles.detailSection}>
        <h3>Attempts</h3>
        {attempts.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Provider</th>
                  <th>Model</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {attempts.slice(0, 12).map((attempt) => (
                  <tr key={attempt.id}>
                    <td>{attempt.stage}</td>
                    <td>{attempt.status}</td>
                    <td>{attempt.providerUsed || '—'}</td>
                    <td>{attempt.modelUsed || '—'}</td>
                    <td>{attempt.durationMs == null ? '—' : `${attempt.durationMs} ms`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.softCopy}>No attempts yet — awaiting worker execution.</p>
        )}
        {attempts[0]?.errorMessage ? (
          <p className={styles.mutedCopy}>{attempts[0].errorMessage}</p>
        ) : null}
      </section>
    </div>
  );
}

export function CandidatesPanel({
  candidates,
  selectedId,
  onSelect,
  jobLabel,
}: {
  candidates: CandidateRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  jobLabel: string | null;
}) {
  if (!jobLabel) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>No job selected</h3>
        <p>Validated candidates for the selected job appear here after generation.</p>
      </div>
    );
  }

  if (!candidates.length) {
    return (
      <div className={styles.emptyState} role="status">
        <ImageOff size={28} aria-hidden />
        <h3>No candidates yet</h3>
        <p>
          Candidates appear after GENERATE_CANDIDATES passes integrity gates. Blank or failed outputs are never
          shown as success.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.candidateGrid} role="list">
      {candidates.map((candidate) => {
        const active = candidate.id === selectedId;
        const hasImage = Boolean(candidate.imageUrl);
        return (
          <button
            key={candidate.id}
            type="button"
            role="listitem"
            className={`${styles.candidateCard} ${active ? styles.candidateCardActive : ''}`}
            onClick={() => onSelect(candidate.id)}
            aria-pressed={active}
          >
            {hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.candidateImage} src={candidate.imageUrl} alt={`Candidate ${candidate.id.slice(0, 8)}`} />
            ) : (
              <div className={styles.candidatePlaceholder}>No image delivered</div>
            )}
            <div className={styles.candidateBody}>
              <strong>{candidate.status}</strong>
              <p>
                Score {Number.isFinite(candidate.score) ? candidate.score.toFixed(2) : '—'}
                {candidate.providerId ? ` · ${candidate.providerId}` : ''}
              </p>
              <p>
                {candidate.width && candidate.height ? `${candidate.width}×${candidate.height}` : 'Dimensions pending'}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
