'use client';

import type { ContinuityIssue, StoryboardException, StoryboardShot } from '../types';
import styles from '../storyboard-engine.module.css';

interface ShotDetailPanelProps {
  shot: StoryboardShot | null;
  continuityIssues: ContinuityIssue[];
  exceptions: StoryboardException[];
  cinematographyNotes: string[];
}

function severityClass(severity: ContinuityIssue['severity']): string {
  if (severity === 'CRITICAL') return `${styles.pill} ${styles.severityCritical}`;
  if (severity === 'HIGH') return `${styles.pill} ${styles.severityHigh}`;
  if (severity === 'MEDIUM') return `${styles.pill} ${styles.severityMedium}`;
  return `${styles.pill} ${styles.severityLow}`;
}

export function ShotDetailPanel({
  shot,
  continuityIssues,
  exceptions,
  cinematographyNotes,
}: ShotDetailPanelProps) {
  if (!shot) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>No shot selected</h3>
        <p>Select a shot from the board to inspect cinematography, continuity locks, and exceptions.</p>
      </div>
    );
  }

  const relatedIssues = continuityIssues.filter((issue) => issue.shotId === shot.id);
  const relatedExceptions = exceptions.filter((item) => item.shotId === shot.id);

  return (
    <div className={styles.detailStack}>
      <section className={styles.detailSection}>
        <h3>Shot brief</h3>
        <div className={styles.kv}><span>Code</span><strong>{shot.shotCode}</strong></div>
        <div className={styles.kv}><span>Scene</span><strong>{shot.sceneRef}</strong></div>
        <div className={styles.kv}><span>Status</span><strong>{shot.status.replaceAll('_', ' ')}</strong></div>
        <div className={styles.kv}><span>Duration</span><strong>{shot.durationSec}s</strong></div>
        <p className={styles.mutedCopy}>{shot.description}</p>
      </section>

      <section className={styles.detailSection}>
        <h3>Cinematography</h3>
        <div className={styles.kv}><span>Camera</span><strong>{shot.camera}</strong></div>
        <div className={styles.kv}><span>Lens</span><strong>{shot.lens}</strong></div>
        <div className={styles.kv}><span>Movement</span><strong>{shot.movement}</strong></div>
        <div className={styles.kv}>
          <span>Continuity</span>
          <strong>{shot.continuityLock ? 'Locked' : 'Unlocked'}</strong>
        </div>
        {cinematographyNotes.length ? (
          <ul className={styles.noteList}>
            {cinematographyNotes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        ) : (
          <p className={styles.softCopy}>No cinematography notes.</p>
        )}
      </section>

      <section className={styles.detailSection}>
        <h3>Continuity on this shot</h3>
        {relatedIssues.length ? (
          <div className={styles.issueList}>
            {relatedIssues.map((issue) => (
              <article key={issue.id} className={styles.issueCard}>
                <header>
                  <strong>{issue.code}</strong>
                  <span className={severityClass(issue.severity)}>{issue.severity}</span>
                </header>
                <p>{issue.description}</p>
                <p className={styles.actionHint}><b>Action:</b> {issue.recommendedAction}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.softCopy}>No open continuity issues for this shot.</p>
        )}
      </section>

      <section className={styles.detailSection}>
        <h3>Exceptions</h3>
        {relatedExceptions.length ? (
          <div className={styles.exceptionList}>
            {relatedExceptions.map((item) => (
              <article key={item.id} className={styles.exceptionCard}>
                <header>
                  <strong>{item.title}</strong>
                  <span className={`${styles.pill} ${styles.pillBlocked}`}>{item.status}</span>
                </header>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.softCopy}>No human exceptions on this shot.</p>
        )}
      </section>
    </div>
  );
}
