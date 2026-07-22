'use client';

import { AlertTriangle, CheckCircle2, Clock3, Film, Layers3, ShieldAlert } from 'lucide-react';
import type { VideoSummary } from '../types';
import styles from '../video-assembly.module.css';

function valueOrEmpty(value: number | null | undefined) {
  if (value === null || value === undefined) return <span className={styles.noData}>No data</span>;
  return <strong>{value}</strong>;
}

export function SummaryMetrics({ summary }: { summary: VideoSummary }) {
  return (
    <section className={styles.summaryRow} aria-label="Video readiness summary">
      <article className={styles.metricCard}>
        <div className={`${styles.metricIcon} ${styles.metricIconBlue}`}><Film size={15} aria-hidden /></div>
        <div><span>Clips</span>{valueOrEmpty(summary.totalClips)}</div>
      </article>
      <article className={styles.metricCard}>
        <div className={`${styles.metricIcon} ${styles.metricIconGreen}`}><CheckCircle2 size={15} aria-hidden /></div>
        <div><span>Video-ready</span>{valueOrEmpty(summary.readyClips)}</div>
      </article>
      <article className={styles.metricCard}>
        <div className={`${styles.metricIcon} ${styles.metricIconRed}`}><ShieldAlert size={15} aria-hidden /></div>
        <div><span>Blocked</span>{valueOrEmpty(summary.blockedClips)}</div>
      </article>
      <article className={styles.metricCard}>
        <div className={`${styles.metricIcon} ${styles.metricIconAmber}`}><Layers3 size={15} aria-hidden /></div>
        <div><span>Stale frames</span>{valueOrEmpty(summary.staleFrames)}</div>
      </article>
      <article className={styles.metricCard}>
        <div className={`${styles.metricIcon} ${styles.metricIconRed}`}><AlertTriangle size={15} aria-hidden /></div>
        <div><span>Exceptions</span>{valueOrEmpty(summary.openExceptions)}</div>
      </article>
      <article className={styles.metricCard}>
        <div className={`${styles.metricIcon} ${styles.metricIconTeal}`}><Clock3 size={15} aria-hidden /></div>
        <div>
          <span>Est. duration</span>
          {summary.estimatedDurationSec == null
            ? <span className={styles.noData}>No data</span>
            : <strong>{summary.estimatedDurationSec}s</strong>}
        </div>
      </article>
    </section>
  );
}
