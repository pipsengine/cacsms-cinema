'use client';

import {
  AlertTriangle,
  OctagonX,
  Pause,
  Play,
  Square,
} from 'lucide-react';
import type { AutonomySnapshot } from '../types';
import styles from '../storyboard-engine.module.css';

type ControlAction = 'start' | 'pause' | 'resume' | 'stop' | 'emergency_stop';

interface AutonomyControlBarProps {
  autonomy: AutonomySnapshot;
  onAction: (action: ControlAction) => void;
}

function statusDotClass(state: AutonomySnapshot['state']): string {
  if (state === 'RUNNING') return `${styles.statusDot} ${styles.statusDotRunning}`;
  if (state === 'PAUSED') return `${styles.statusDot} ${styles.statusDotPaused}`;
  if (state === 'STOPPED' || state === 'EMERGENCY_STOPPED') return `${styles.statusDot} ${styles.statusDotStopped}`;
  return `${styles.statusDot} ${styles.statusDotUnavailable}`;
}

function statusLabel(state: AutonomySnapshot['state']): string {
  switch (state) {
    case 'NOT_STARTED':
      return 'Not started';
    case 'RUNNING':
      return 'Running';
    case 'PAUSED':
      return 'Paused';
    case 'STOPPED':
      return 'Stopped';
    case 'EMERGENCY_STOPPED':
      return 'Emergency stopped';
    default:
      return 'Unavailable';
  }
}

export function AutonomyControlBar({ autonomy, onAction }: AutonomyControlBarProps) {
  const unavailable = autonomy.state === 'UNAVAILABLE';

  return (
    <section className={styles.controlBar} aria-label="Autonomous storyboard controls">
      <div className={styles.statusCluster}>
        <span className={statusDotClass(autonomy.state)} aria-hidden />
        <span>
          Autonomy: <b>{statusLabel(autonomy.state)}</b>
        </span>
      </div>
      <div className={styles.metaBlock}>
        <span>Current stage</span>
        <strong>{autonomy.currentStage || 'Awaiting execution'}</strong>
      </div>
      <div className={styles.metaBlock}>
        <span>Correlation</span>
        <strong>{autonomy.correlationId || '—'}</strong>
      </div>
      <div className={styles.controls} role="group" aria-label="Lifecycle controls">
        <button
          type="button"
          className={`${styles.controlBtn} ${styles.controlBtnPrimary}`}
          disabled={unavailable}
          onClick={() => onAction('start')}
        >
          <Play size={14} aria-hidden />
          Start
        </button>
        <button type="button" className={styles.controlBtn} disabled={unavailable} onClick={() => onAction('pause')}>
          <Pause size={14} aria-hidden />
          Pause
        </button>
        <button type="button" className={styles.controlBtn} disabled={unavailable} onClick={() => onAction('resume')}>
          <Play size={14} aria-hidden />
          Resume
        </button>
        <button type="button" className={styles.controlBtn} disabled={unavailable} onClick={() => onAction('stop')}>
          <Square size={14} aria-hidden />
          Stop
        </button>
        <button
          type="button"
          className={`${styles.controlBtn} ${styles.controlBtnDanger}`}
          disabled={unavailable}
          onClick={() => onAction('emergency_stop')}
        >
          <OctagonX size={14} aria-hidden />
          Emergency Stop
        </button>
      </div>
      {unavailable && autonomy.unavailableReason ? (
        <p className={styles.srOnly}>{autonomy.unavailableReason}</p>
      ) : null}
      {unavailable ? (
        <div className={`${styles.metaBlock} ${styles.integrationNote}`}>
          <span className={styles.integrationNoteLabel}>
            <AlertTriangle size={12} aria-hidden />
            Integration pending
          </span>
          <strong className={styles.integrationNoteText}>{autonomy.unavailableReason}</strong>
        </div>
      ) : null}
    </section>
  );
}
