'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clapperboard,
  Film,
  Layers3,
  ShieldAlert,
} from 'lucide-react';
import type { StoryboardSummary } from '../types';
import styles from '../storyboard-engine.module.css';

function valueOrEmpty(value: number | null | undefined) {
  if (value === null || value === undefined) return <span className={styles.noData}>No data</span>;
  return <strong>{value}</strong>;
}

interface SummaryMetricsProps {
  summary: StoryboardSummary;
}

export function SummaryMetrics({ summary }: SummaryMetricsProps) {
  return (
    <section className={styles.summaryRow} aria-label="Storyboard summary">
      <article className={styles.metricCard}>
        <div className={`${styles.metricIcon} ${styles.metricIconBlue}`}><Film size={15} aria-hidden /></div>
        <div>
          <span>Shots</span>
          {valueOrEmpty(summary.shotCount)}
        </div>
      </article>
      <article className={styles.metricCard}>
        <div className={`${styles.metricIcon} ${styles.metricIconGreen}`}><CheckCircle2 size={15} aria-hidden /></div>
        <div>
          <span>Approved</span>
          {valueOrEmpty(summary.approvedShots)}
        </div>
      </article>
      <article className={styles.metricCard}>
        <div className={`${styles.metricIcon} ${styles.metricIconAmber}`}><ShieldAlert size={15} aria-hidden /></div>
        <div>
          <span>Continuity open</span>
          {valueOrEmpty(summary.openContinuityIssues)}
        </div>
      </article>
      <article className={styles.metricCard}>
        <div className={`${styles.metricIcon} ${styles.metricIconRed}`}><AlertTriangle size={15} aria-hidden /></div>
        <div>
          <span>Exceptions</span>
          {valueOrEmpty(summary.openExceptions)}
        </div>
      </article>
      <article className={styles.metricCard}>
        <div className={`${styles.metricIcon} ${styles.metricIconIndigo}`}><Layers3 size={15} aria-hidden /></div>
        <div>
          <span>Asset versions</span>
          {valueOrEmpty(summary.assetVersions)}
        </div>
      </article>
      <article className={styles.metricCard}>
        <div className={`${styles.metricIcon} ${styles.metricIconTeal}`}><Clapperboard size={15} aria-hidden /></div>
        <div>
          <span>Video-ready</span>
          {valueOrEmpty(summary.videoReadyShots)}
        </div>
      </article>
    </section>
  );
}
