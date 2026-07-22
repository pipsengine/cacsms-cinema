'use client';

import { Workflow } from 'lucide-react';
import type { PipelineStage } from '../types';
import styles from '../video-assembly.module.css';

function stepClass(status: PipelineStage['status']): string {
  if (status === 'complete') return `${styles.step} ${styles.stepComplete}`;
  if (status === 'active') return `${styles.step} ${styles.stepActive}`;
  if (status === 'blocked') return `${styles.step} ${styles.stepBlocked}`;
  return styles.step;
}

function glyph(status: PipelineStage['status'], index: number): string {
  if (status === 'complete') return '✓';
  if (status === 'blocked') return '!';
  if (status === 'active') return '•';
  return String(index + 1);
}

export function PipelineTimeline({ stages }: { stages: PipelineStage[] }) {
  return (
    <section className={styles.pipeline} aria-label="Autonomous video pipeline">
      <div className={styles.pipelineHead}>
        <h2>
          <Workflow size={15} aria-hidden />
          Autonomous pipeline
        </h2>
        <small>Stages bind to persisted video workflow status during integration</small>
      </div>
      <ol className={styles.steps}>
        {stages.map((stage, index) => (
          <li key={stage.id} className={stepClass(stage.status)}>
            <i aria-hidden>{glyph(stage.status, index)}</i>
            <span>{stage.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
