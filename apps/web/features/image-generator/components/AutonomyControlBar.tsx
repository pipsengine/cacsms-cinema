'use client';

import { OctagonX, Pause, Play, Square } from 'lucide-react';
import { displayStage, titleCase, type JobRecord } from '../types';
import styles from '../image-generator.module.css';

type ControlAction = 'start' | 'pause' | 'resume' | 'stop' | 'emergency_stop';

interface AutonomyControlBarProps {
  controlState: string;
  isHealthy: boolean;
  selectedJob: JobRecord | null;
  busy: boolean;
  onAction: (action: ControlAction) => void;
}

function statusDotClass(state: string, healthy: boolean): string {
  if (!healthy) return `${styles.statusDot} ${styles.statusDotUnavailable}`;
  if (state === 'RUNNING') return `${styles.statusDot} ${styles.statusDotRunning}`;
  if (state === 'PAUSED') return `${styles.statusDot} ${styles.statusDotPaused}`;
  if (state === 'STOPPED' || state === 'EMERGENCY_STOP') return `${styles.statusDot} ${styles.statusDotStopped}`;
  return `${styles.statusDot} ${styles.statusDotUnavailable}`;
}

export function AutonomyControlBar({
  controlState,
  isHealthy,
  selectedJob,
  busy,
  onAction,
}: AutonomyControlBarProps) {
  return (
    <section className={styles.controlBar} aria-label="Generation controls">
      <div className={styles.statusCluster}>
        <span className={statusDotClass(controlState, isHealthy)} aria-hidden />
        <span>
          Worker: <b>{titleCase(controlState)}</b>
          {!isHealthy ? <span> · Unavailable</span> : null}
        </span>
      </div>
      <div className={styles.metaBlock}>
        <span>Selected job</span>
        <strong>
          {selectedJob
            ? `${selectedJob.project?.name || selectedJob.projectId} · ${displayStage(selectedJob.status)}`
            : 'None selected'}
        </strong>
      </div>
      <div className={styles.controls} role="group" aria-label="Worker controls">
        <button
          type="button"
          className={`${styles.controlBtn} ${styles.controlBtnPrimary}`}
          disabled={busy || controlState === 'RUNNING'}
          onClick={() => onAction('start')}
        >
          <Play size={14} aria-hidden /> Start
        </button>
        <button type="button" className={styles.controlBtn} disabled={busy || controlState !== 'RUNNING'} onClick={() => onAction('pause')}>
          <Pause size={14} aria-hidden /> Pause
        </button>
        <button type="button" className={styles.controlBtn} disabled={busy || controlState !== 'PAUSED'} onClick={() => onAction('resume')}>
          <Play size={14} aria-hidden /> Resume
        </button>
        <button type="button" className={styles.controlBtn} disabled={busy || controlState === 'STOPPED'} onClick={() => onAction('stop')}>
          <Square size={14} aria-hidden /> Stop
        </button>
        <button
          type="button"
          className={`${styles.controlBtn} ${styles.controlBtnDanger}`}
          disabled={busy || controlState === 'EMERGENCY_STOP'}
          onClick={() => onAction('emergency_stop')}
        >
          <OctagonX size={14} aria-hidden /> Emergency Stop
        </button>
      </div>
    </section>
  );
}
