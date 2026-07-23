'use client';

import { useState } from 'react';
import { AlertTriangle, Pause, Play, RotateCcw, Square } from 'lucide-react';
import styles from './lifecycle-page.module.css';

export function WorkflowControlBar({
  workflowRunId,
  version,
  allowedActions = [],
  overallStatus,
  stale,
  connectionError,
  onChanged,
}: {
  workflowRunId: string | null;
  version?: number;
  allowedActions?: string[];
  overallStatus?: string;
  stale?: boolean;
  connectionError?: string | null;
  onChanged?: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string, extra: Record<string, unknown> = {}) {
    if (!workflowRunId) return;
    setPending(action);
    setError(null);
    try {
      const response = await fetch(`/api/visual-workflows/${workflowRunId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'X-Correlation-Id': crypto.randomUUID(),
        },
        body: JSON.stringify({ expectedVersion: version, ...extra }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Control action failed.');
      onChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Control action failed.');
    } finally {
      setPending(null);
    }
  }

  const can = (action: string) => {
    if (!workflowRunId || pending) return false;
    if (action === 'emergency-stop') {
      return allowedActions.includes('emergency_stop') || allowedActions.includes('emergency-stop');
    }
    return allowedActions.includes(action) || allowedActions.includes(action.replace('-', '_'));
  };

  return (
    <section className={styles.controlBar} aria-label="Workflow controls">
      <div className={styles.controlMeta}>
        <span>Execution status</span>
        <strong>{overallStatus || 'NOT_STARTED'}</strong>
        {stale ? <em className={styles.stale}>Stale snapshot</em> : null}
      </div>
      <div className={styles.controls}>
        <button type="button" disabled={!can('start')} onClick={() => void run('start')}>
          <Play size={14} /> Start
        </button>
        <button type="button" disabled={!can('pause')} onClick={() => void run('pause')}>
          <Pause size={14} /> Pause
        </button>
        <button type="button" disabled={!can('resume')} onClick={() => void run('resume')}>
          <Play size={14} /> Resume
        </button>
        <button type="button" disabled={!can('stop')} onClick={() => void run('stop')}>
          <Square size={13} /> Stop
        </button>
        <button type="button" disabled={!can('recover')} onClick={() => void run('recover')}>
          <RotateCcw size={14} /> Recover
        </button>
        <button
          type="button"
          className={styles.danger}
          disabled={!can('emergency_stop') && !can('emergency-stop')}
          onClick={() => {
            if (!window.confirm('Emergency stop will cancel in-flight work. Continue?')) return;
            void run('emergency-stop', { confirmEmergencyStop: true });
          }}
        >
          <AlertTriangle size={14} /> Emergency Stop
        </button>
      </div>
      {connectionError ? <p className={styles.controlError}>{connectionError}</p> : null}
      {error ? <p className={styles.controlError}>{error}</p> : null}
      {pending ? <p className={styles.controlPending}>Pending: {pending}</p> : null}
    </section>
  );
}
