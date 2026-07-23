'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  aspectList,
  CALL_SHEET_FIELDS,
  configDisplay,
  durationBounds,
  formatDurationLabel,
  isFormatPolicyProfile,
  isFormatStub,
  sortFormatsByDuration,
  timelinePercent,
  TIMELINE_MAX_SEC,
  TIMELINE_MIN_SEC,
} from '@/apps/web/lib/strategy-formats';
import styles from './formats.module.css';

function relativeRefresh(iso: string | null, now: number) {
  if (!iso) return '—';
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function aspectBoxStyle(ratio: string): { width: number; height: number } {
  const compact = ratio.replace(/\s/g, '');
  if (compact.includes('9:16')) return { width: 28, height: 50 };
  if (compact.includes('1:1')) return { width: 40, height: 40 };
  if (compact.includes('4:3')) return { width: 48, height: 36 };
  if (compact.includes('2.39') || compact.includes('2.35')) return { width: 64, height: 28 };
  return { width: 56, height: 32 };
}

export function FormatsWorkspace() {
  const loadSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [softError, setSoftError] = useState('');
  const [hardError, setHardError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const systemRunning = systemState === 'RUNNING';
  selectedIdRef.current = selectedId;

  async function load() {
    const seq = ++loadSeq.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!overview) setInitialLoading(true);

    try {
      const [next, dashboard] = await Promise.all([
        strategyApi.overview(),
        fetch('/api/dashboard', { cache: 'no-store', signal: controller.signal }).then(
          async (response) => {
            if (!response.ok) return null;
            return response.json() as Promise<{ system?: { controlState?: string } }>;
          },
        ),
      ]);
      if (seq !== loadSeq.current || controller.signal.aborted) return;

      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setHardError('');

      if (!next.available || !next.versionId) {
        setRecords([]);
        setSelectedId(null);
        setSoftError(next.reason || 'Strategy version unavailable');
        setLastLoadedAt(new Date().toISOString());
        return;
      }

      const list = (await strategyApi.list(next.versionId, 'formats')).filter(
        (record) => record.status !== 'ARCHIVED',
      );
      if (seq !== loadSeq.current || controller.signal.aborted) return;

      setRecords(list);
      setSoftError('');
      setLastLoadedAt(new Date().toISOString());

      const prefer = selectedIdRef.current;
      if (!(prefer && list.some((item) => item.id === prefer))) {
        const ordered = sortFormatsByDuration(list.filter(isFormatPolicyProfile));
        setSelectedId(ordered[0]?.id ?? list[0]?.id ?? null);
      }
    } catch (err) {
      if (controller.signal.aborted || seq !== loadSeq.current) return;
      const message = err instanceof Error ? err.message : 'Unavailable';
      if (overview) setSoftError(`Refresh failed — showing last good data. ${message}`);
      else setHardError(message);
    } finally {
      if (seq === loadSeq.current) setInitialLoading(false);
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(t);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => void load(), systemRunning ? 3000 : 10000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemRunning]);

  useEffect(() => {
    const onControl = () => void load();
    window.addEventListener('cacsms:system-control-changed', onControl);
    return () => window.removeEventListener('cacsms:system-control-changed', onControl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const policy = useMemo(() => records.filter(isFormatPolicyProfile), [records]);
  const policyReady = policy.length > 0;
  const stubOnly = records.length > 0 && !policyReady && records.every(isFormatStub);
  const formats = useMemo(
    () => sortFormatsByDuration(policyReady ? policy : records.filter((r) => !isFormatStub(r))),
    [policy, policyReady, records],
  );
  const selected = formats.find((item) => item.id === selectedId) ?? formats[0] ?? null;
  const selectedBounds = selected ? durationBounds(selected) : null;
  const ratios = selected ? aspectList(selected) : [];

  if (initialLoading && !overview) {
    return (
      <main className={styles.page}>
        <div className={styles.skeleton} />
      </main>
    );
  }

  if (hardError || (!overview?.available && !records.length)) {
    return (
      <main className={styles.page}>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Strategy service unavailable</h2>
          <p>{hardError || overview?.reason}</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <h1>Content Format Strategy</h1>
        <p>
          Duration timeline + production call sheet. Select a band on the axis — not a card rack.
          Stage 01 writes formats while Running.
        </p>
      </header>

      <div className={styles.ops} aria-label="Operations">
        <span>
          System <strong>{systemState.replaceAll('_', ' ')}</strong>
        </span>
        <span>
          Stage 01{' '}
          <strong>{policyReady ? 'Policy reconciled' : systemRunning ? 'Reconciling…' : 'Idle'}</strong>
        </span>
        <span>
          Formats <strong>{formats.length}</strong>
        </span>
        <span>
          Refresh <strong>{relativeRefresh(lastLoadedAt, now)}</strong>
        </span>
      </div>

      {softError ? (
        <p className={styles.errorBanner} role="status">
          {softError}
        </p>
      ) : null}

      <div className={styles.body}>
        {!formats.length ? (
          <section className={styles.empty}>
            <h2>{stubOnly || !records.length ? 'Timeline not yet written' : 'No formats'}</h2>
            <p>
              {systemRunning
                ? 'Stage 01 is reconciling format briefs onto the timeline.'
                : 'Press Start in the top bar. Stage 01 plots formats on the duration axis automatically.'}
            </p>
          </section>
        ) : (
          <>
            <section className={styles.timelineCard} aria-label="Format duration timeline">
              <div className={styles.axisLabels}>
                <span>{formatDurationLabel(TIMELINE_MIN_SEC)}</span>
                <span>Duration axis</span>
                <span>{formatDurationLabel(TIMELINE_MAX_SEC)}</span>
              </div>
              <div className={styles.track}>
                {formats.map((record) => {
                  const bounds = durationBounds(record);
                  const left = timelinePercent(bounds.min);
                  const right = timelinePercent(bounds.max);
                  const width = Math.max(4, right - left);
                  const active = record.id === selected?.id;
                  return (
                    <button
                      key={record.id ?? record.name}
                      type="button"
                      className={`${styles.band} ${active ? styles.bandActive : ''}`}
                      style={{ left: `calc(${left}% + 12px)`, width: `calc(${width}% - 4px)` }}
                      aria-pressed={active}
                      title={`${record.name}: ${formatDurationLabel(bounds.min)}–${formatDurationLabel(bounds.max)}`}
                      onClick={() => setSelectedId(record.id ?? null)}
                    >
                      <span className={styles.bandLabel}>{record.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {selected && selectedBounds ? (
              <article className={styles.callSheet} aria-label="Production call sheet">
                <header className={styles.callHead}>
                  <div>
                    <h2>{selected.name}</h2>
                    <p>{selected.description}</p>
                  </div>
                  <div className={styles.durationBadge}>
                    {formatDurationLabel(selectedBounds.min)} –{' '}
                    {formatDurationLabel(selectedBounds.max)}
                  </div>
                </header>

                <div className={styles.frames} aria-label="Aspect ratio frames">
                  {(ratios.length ? ratios : ['16:9']).map((ratio) => {
                    const size = aspectBoxStyle(ratio);
                    return (
                      <div key={ratio} className={styles.frame}>
                        <div
                          className={styles.frameBox}
                          style={{ width: size.width, height: size.height }}
                        />
                        {ratio}
                      </div>
                    );
                  })}
                </div>

                <dl className={styles.sheetGrid}>
                  {CALL_SHEET_FIELDS.map((row) => (
                    <div key={row.key} className={styles.sheetRow}>
                      <dt>{row.label}</dt>
                      <dd>{configDisplay(selected.configuration, row.key) || 'Not set'}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
