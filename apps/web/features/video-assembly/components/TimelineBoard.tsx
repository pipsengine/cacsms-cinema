'use client';

import { ImageOff, Video } from 'lucide-react';
import type { ReadinessCheck, TimelineClip, VideoException } from '../types';
import styles from '../video-assembly.module.css';

function readinessPill(status: TimelineClip['readiness']): string {
  switch (status) {
    case 'READY':
      return `${styles.pill} ${styles.pillApproved}`;
    case 'NEEDS_REVIEW':
    case 'STALE':
    case 'NOT_EVALUATED':
      return `${styles.pill} ${styles.pillReview}`;
    case 'BLOCKED':
    case 'FAILED':
      return `${styles.pill} ${styles.pillBlocked}`;
    default:
      return `${styles.pill} ${styles.pillQueued}`;
  }
}

function previewClass(status: TimelineClip['readiness']): string {
  if (status === 'READY') return `${styles.clipPreview} ${styles.clipPreviewReady}`;
  if (status === 'BLOCKED' || status === 'FAILED') return `${styles.clipPreview} ${styles.clipPreviewBlocked}`;
  if (status === 'STALE' || status === 'NEEDS_REVIEW') return `${styles.clipPreview} ${styles.clipPreviewStale}`;
  return styles.clipPreview;
}

export function TimelineBoard({
  clips,
  selectedClipId,
  estimatedDurationSec,
  onSelect,
}: {
  clips: TimelineClip[];
  selectedClipId: string | null;
  estimatedDurationSec: number | null;
  onSelect: (clipId: string) => void;
}) {
  if (!clips.length) {
    return (
      <div className={styles.emptyState} role="status">
        <ImageOff size={28} aria-hidden />
        <h3>No timeline clips</h3>
        <p>
          Awaiting approved, continuity-safe AssetVersions from storyboard delivery. Timeline clips appear
          here once video-readiness APIs are connected.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.ruler}>
        <span>Sequence timeline</span>
        <span>{estimatedDurationSec == null ? 'Duration: No data' : `Est. ${estimatedDurationSec}s`}</span>
      </div>
      <div className={styles.timelineTrack} role="list" aria-label="Video timeline">
        {clips.map((clip) => {
          const active = clip.id === selectedClipId;
          return (
            <button
              key={clip.id}
              type="button"
              role="listitem"
              className={`${styles.timelineClip} ${active ? styles.timelineClipActive : ''}`}
              onClick={() => onSelect(clip.id)}
              aria-pressed={active}
            >
              <div className={previewClass(clip.readiness)}>
                <Video size={16} aria-hidden />
                <span>{clip.durationSec}s · {clip.kind}</span>
              </div>
              <div className={styles.clipBody}>
                <strong>{clip.shotCode} · {clip.title}</strong>
                <div className={styles.shotMeta}>
                  <span className={readinessPill(clip.readiness)}>{clip.readiness.replaceAll('_', ' ')}</span>
                  {clip.videoReady ? <span className={`${styles.pill} ${styles.pillReady}`}>Video ready</span> : null}
                </div>
                <p>{clip.notes}</p>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function ClipDetailPanel({
  clip,
  checks,
  exceptions,
}: {
  clip: TimelineClip | null;
  checks: ReadinessCheck[];
  exceptions: VideoException[];
}) {
  if (!clip) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>No clip selected</h3>
        <p>Select a timeline clip to inspect readiness checks, AssetVersion locks, and exceptions.</p>
      </div>
    );
  }

  const relatedChecks = checks.filter((item) => item.clipId === clip.id);
  const relatedExceptions = exceptions.filter((item) => item.clipId === clip.id);

  return (
    <div className={styles.detailStack}>
      <section className={styles.detailSection}>
        <h3>Clip brief</h3>
        <div className={styles.kv}><span>Shot</span><strong>{clip.shotCode}</strong></div>
        <div className={styles.kv}><span>Scene</span><strong>{clip.sceneRef}</strong></div>
        <div className={styles.kv}><span>Kind</span><strong>{clip.kind}</strong></div>
        <div className={styles.kv}><span>Duration</span><strong>{clip.durationSec}s</strong></div>
        <div className={styles.kv}><span>Readiness</span><strong>{clip.readiness.replaceAll('_', ' ')}</strong></div>
        <p className={styles.mutedCopy}>{clip.notes}</p>
      </section>
      <section className={styles.detailSection}>
        <h3>Asset lock</h3>
        <div className={styles.kv}><span>AssetVersion</span><strong>{clip.assetVersionId || 'Missing'}</strong></div>
        <div className={styles.kv}><span>SHA</span><strong>{clip.assetShaPreview || '—'}</strong></div>
        <div className={styles.kv}><span>Continuity</span><strong>{clip.continuitySafe ? 'Safe' : 'Unsafe'}</strong></div>
        <div className={styles.kv}><span>Video ready</span><strong>{clip.videoReady ? 'Yes' : 'No'}</strong></div>
      </section>
      <section className={styles.detailSection}>
        <h3>Readiness checks</h3>
        {relatedChecks.length ? (
          <div className={styles.issueList}>
            {relatedChecks.map((check) => (
              <article key={check.id} className={styles.issueCard}>
                <header>
                  <strong>{check.code}</strong>
                  <span className={check.passed ? `${styles.pill} ${styles.pillApproved}` : `${styles.pill} ${styles.pillBlocked}`}>
                    {check.passed ? 'Passed' : 'Failed'}
                  </span>
                </header>
                <p>{check.detail}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.softCopy}>No readiness checks for this clip.</p>
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
          <p className={styles.softCopy}>No human exceptions on this clip.</p>
        )}
      </section>
    </div>
  );
}
