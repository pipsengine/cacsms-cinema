'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  configDisplay,
  isSourcePolicyClass,
  isSourceStub,
  LADDER_GATE_ROWS,
  matchesSourceQuery,
  sortEvidenceLadder,
  sourceState,
} from '@/apps/web/lib/strategy-source';
import styles from './source-policy.module.css';

function relativeRefresh(iso: string | null, now: number) {
  if (!iso) return '—';
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function sealClass(state: string) {
  if (state === 'ALLOWED') return styles.sealAllowed;
  if (state === 'CONDITIONAL') return styles.sealConditional;
  if (state === 'RESTRICTED') return styles.sealRestricted;
  return styles.sealConditional;
}

function rungClass(state: string) {
  if (state === 'ALLOWED') return styles.rungAllowed;
  if (state === 'CONDITIONAL') return styles.rungConditional;
  if (state === 'RESTRICTED') return styles.rungRestricted;
  return '';
}

export function SourcePolicyWorkspace() {
  const loadSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const openIdRef = useRef<string | null>(null);

  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [softError, setSoftError] = useState('');
  const [hardError, setHardError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const systemRunning = systemState === 'RUNNING';
  openIdRef.current = openId;

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
        setOpenId(null);
        setSoftError(next.reason || 'Strategy version unavailable');
        setLastLoadedAt(new Date().toISOString());
        return;
      }

      const list = (await strategyApi.list(next.versionId, 'source-policy')).filter(
        (record) => record.status !== 'ARCHIVED',
      );
      if (seq !== loadSeq.current || controller.signal.aborted) return;

      setRecords(list);
      setSoftError('');
      setLastLoadedAt(new Date().toISOString());

      const prefer = openIdRef.current;
      if (prefer && list.some((item) => item.id === prefer)) return;
      const firstPolicy = sortEvidenceLadder(list.filter(isSourcePolicyClass))[0];
      setOpenId(firstPolicy?.id ?? list[0]?.id ?? null);
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

  const policy = useMemo(() => records.filter(isSourcePolicyClass), [records]);
  const policyReady = policy.length > 0;
  const stubOnly = records.length > 0 && !policyReady && records.every(isSourceStub);

  const ladder = useMemo(() => {
    const source = policyReady ? policy : records.filter((r) => !isSourceStub(r));
    const needle = query.trim().toLowerCase();
    return sortEvidenceLadder(source.filter((r) => matchesSourceQuery(r, needle)));
  }, [records, policy, policyReady, query]);

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
      <header className={styles.head}>
        <h1>Evidence & Source Policy</h1>
        <p>
          Fail-closed evidence ladder — strongest rungs at the top. Stage 01 writes classes while
          Running. Observe-only.
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
          Rungs <strong>{policy.length || (stubOnly ? 0 : records.length)}</strong>
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
        <input
          className={styles.search}
          type="search"
          placeholder="Filter ladder rungs…"
          aria-label="Filter evidence ladder"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {!ladder.length ? (
          <section className={styles.empty}>
            <h2>{stubOnly || !records.length ? 'Ladder not yet written' : 'No matching rungs'}</h2>
            <p>
              {stubOnly || !records.length
                ? systemRunning
                  ? 'Stage 01 is reconciling evidence classes.'
                  : 'Press Start in the top bar. Stage 01 writes the evidence ladder automatically.'
                : 'Clear the filter to see all rungs.'}
            </p>
          </section>
        ) : (
          <div className={styles.ladder} role="list" aria-label="Evidence statute ladder">
            {ladder.map((record, index) => {
              const state = sourceState(record);
              const open = record.id === openId;
              const restricted = state === 'RESTRICTED';
              return (
                <article
                  key={record.id ?? record.name}
                  role="listitem"
                  className={`${styles.rung} ${rungClass(state)}`}
                >
                  <button
                    type="button"
                    className={`${styles.rungButton} ${open ? styles.rungOpen : ''}`}
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : record.id ?? null)}
                  >
                    <span className={styles.rank}>R{index + 1}</span>
                    <span>
                      <h2 className={styles.rungTitle}>{record.name}</h2>
                      <p className={styles.rungSub}>{record.description}</p>
                    </span>
                    <span className={`${styles.seal} ${sealClass(state)}`}>{state}</span>
                  </button>

                  {open ? (
                    <>
                      {restricted ? (
                        <p className={styles.failClosed}>
                          Fail-closed: blocked as sole evidence for material claims.
                        </p>
                      ) : null}
                      <dl className={styles.gates}>
                        {LADDER_GATE_ROWS.map((row) => (
                          <div key={row.key} className={styles.gateRow}>
                            <dt>{row.label}</dt>
                            <dd>{configDisplay(record.configuration, row.key) || 'Not set'}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
