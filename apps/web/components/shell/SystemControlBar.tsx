'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Pause, Play, Square } from 'lucide-react';
import styles from './system-control-bar.module.css';

type ControlState = string;

type DashboardSnippet = {
  generatedAt: string;
  system: {
    isHealthy: boolean;
    controlState: string;
  };
};

const NIGERIA_TZ = 'Africa/Lagos';

async function postControl(action: 'start' | 'pause' | 'resume' | 'stop' | 'emergency_stop') {
  const response = await fetch('/api/v1/system/control', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
      'X-Correlation-Id': crypto.randomUUID(),
    },
    body: JSON.stringify({
      action,
      reason:
        action === 'emergency_stop'
          ? 'Operator emergency stop'
          : `Operator requested ${action}`,
    }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(result.error?.message ?? 'Control request failed.');
  }
}

function controlStateClass(state: string): string {
  switch (state) {
    case 'RUNNING':
      return styles.stateRunning;
    case 'STOPPED':
      return styles.stateStopped;
    case 'PAUSED':
      return styles.statePaused;
    case 'EMERGENCY_STOP':
      return styles.stateEmergency;
    default:
      return styles.stateUnavailable;
  }
}

function formatNigeriaDateTime(now: Date) {
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: NIGERIA_TZ,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: NIGERIA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
  return { date, time };
}

export function SystemControlBar({
  variant = 'top',
  onChanged,
}: {
  variant?: 'top' | 'landing';
  onChanged?: () => void;
}) {
  const [data, setData] = useState<DashboardSnippet | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null until mount — avoids SSR/client clock mismatch hydration errors
  const [clock, setClock] = useState<{ date: string; time: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard', { cache: 'no-store' });
      if (!response.ok) throw new Error('Control state unavailable');
      const json = (await response.json()) as DashboardSnippet;
      setData(json);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Control state unavailable');
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    const tick = () => setClock(formatNigeriaDateTime(new Date()));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const controlState: ControlState = data?.system.controlState ?? 'UNAVAILABLE';

  async function changeControl(action: 'start' | 'pause' | 'resume' | 'stop' | 'emergency_stop') {
    setBusy(true);
    setError(null);
    try {
      await postControl(action);
      await refresh();
      onChanged?.();
      window.dispatchEvent(new CustomEvent('cacsms:system-control-changed', { detail: { action } }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Control request failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`${styles.bar} ${variant === 'landing' ? styles.landing : styles.top}`}
      aria-label="System autonomy controls"
    >
      <div className={styles.status}>
        <span
          className={data?.system.isHealthy ? styles.liveDot : styles.warningDot}
          aria-hidden
        />
        <strong>{data?.system.isHealthy ? 'Operational' : 'Unavailable'}</strong>
        <span className={styles.sep} aria-hidden>
          ·
        </span>
        <em className={controlStateClass(controlState)}>{controlState.replaceAll('_', ' ')}</em>
      </div>

      <time className={styles.clock} aria-live="polite" aria-label="Nigeria local time">
        <span className={styles.clockDate}>{clock?.date ?? '—'}</span>
        <span className={styles.clockTime}>{clock?.time ?? '--:--:--'}</span>
        <span className={styles.clockZone}>WAT</span>
      </time>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.primary}
          disabled={busy || controlState === 'RUNNING'}
          onClick={() => void changeControl('start')}
        >
          <Play size={14} aria-hidden />
          Start
        </button>
        <button
          type="button"
          disabled={busy || controlState !== 'RUNNING'}
          onClick={() => void changeControl('pause')}
        >
          <Pause size={14} aria-hidden />
          Pause
        </button>
        <button
          type="button"
          disabled={busy || controlState !== 'PAUSED'}
          onClick={() => void changeControl('resume')}
        >
          <Play size={14} aria-hidden />
          Resume
        </button>
        <button
          type="button"
          disabled={busy || controlState === 'STOPPED'}
          onClick={() => void changeControl('stop')}
        >
          <Square size={13} aria-hidden />
          Stop
        </button>
        <button
          type="button"
          className={styles.danger}
          disabled={busy || controlState === 'EMERGENCY_STOP'}
          onClick={() => void changeControl('emergency_stop')}
        >
          <AlertTriangle size={14} aria-hidden />
          Emergency Stop
        </button>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        <p className={styles.hint}>
          Global control only — stages advance automatically while Running.
        </p>
      )}
    </section>
  );
}
