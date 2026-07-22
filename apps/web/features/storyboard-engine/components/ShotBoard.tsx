'use client';

import { Film, ImageOff } from 'lucide-react';
import type { StoryboardShot } from '../types';
import styles from '../storyboard-engine.module.css';

interface ShotBoardProps {
  shots: StoryboardShot[];
  selectedShotId: string | null;
  onSelect: (shotId: string) => void;
}

function statusPill(status: StoryboardShot['status']): string {
  switch (status) {
    case 'APPROVED':
    case 'READY':
      return `${styles.pill} ${styles.pillApproved}`;
    case 'NEEDS_REVIEW':
    case 'PLANNING':
    case 'EVALUATING':
    case 'GENERATING':
      return `${styles.pill} ${styles.pillReview}`;
    case 'BLOCKED':
    case 'FAILED':
      return `${styles.pill} ${styles.pillBlocked}`;
    default:
      return `${styles.pill} ${styles.pillQueued}`;
  }
}

function frameClass(status: StoryboardShot['status']): string {
  if (status === 'APPROVED') return `${styles.shotFrame} ${styles.shotFrameApproved}`;
  if (status === 'BLOCKED' || status === 'FAILED') return `${styles.shotFrame} ${styles.shotFrameBlocked}`;
  return styles.shotFrame;
}

export function ShotBoard({ shots, selectedShotId, onSelect }: ShotBoardProps) {
  if (!shots.length) {
    return (
      <div className={styles.emptyState} role="status">
        <ImageOff size={28} aria-hidden />
        <h3>No shots yet</h3>
        <p>
          Awaiting storyboard decomposition from an approved script. Shots will appear here once the
          persisted storyboard API is connected.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.shotGrid} role="list" aria-label="Shot board">
      {shots.map((shot) => {
        const active = shot.id === selectedShotId;
        return (
          <button
            key={shot.id}
            type="button"
            role="listitem"
            className={`${styles.shotCard} ${active ? styles.shotCardActive : ''}`}
            onClick={() => onSelect(shot.id)}
            aria-pressed={active}
          >
            <div className={frameClass(shot.status)}>
              <Film size={18} aria-hidden />
              <span>{shot.frameLabel}</span>
            </div>
            <div className={styles.shotBody}>
              <strong>
                {shot.shotCode} · {shot.title}
              </strong>
              <div className={styles.shotMeta}>
                <span className={statusPill(shot.status)}>{shot.status.replaceAll('_', ' ')}</span>
                <span className={styles.pill}>Scene {shot.sceneRef}</span>
                {shot.continuityLock ? <span className={`${styles.pill} ${styles.pillReady}`}>Locked</span> : null}
              </div>
              <p>{shot.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
