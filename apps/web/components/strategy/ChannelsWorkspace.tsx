'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  configDisplay,
  fieldLabel,
  INSPECTOR_FIELDS,
  isChannelPolicyProfile,
  isChannelStub,
  MATRIX_COLUMNS,
  matrixCell,
  sortChannels,
  type CellTone,
  type MatrixColumn,
} from '@/apps/web/lib/strategy-channels';
import styles from './channels.module.css';

function relativeRefresh(iso: string | null, now: number) {
  if (!iso) return '—';
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function toneClass(tone: CellTone) {
  switch (tone) {
    case 'ok':
      return styles.toneOk;
    case 'staged':
      return styles.toneStaged;
    case 'gap':
      return styles.toneGap;
    case 'blocked':
      return styles.toneBlocked;
    default:
      return styles.toneUnknown;
  }
}

export function ChannelsWorkspace() {
  const loadSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCell, setActiveCell] = useState<MatrixColumn['id'] | null>(null);
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

      const list = (await strategyApi.list(next.versionId, 'channels')).filter(
        (record) => record.status !== 'ARCHIVED',
      );
      if (seq !== loadSeq.current || controller.signal.aborted) return;

      setRecords(list);
      setSoftError('');
      setLastLoadedAt(new Date().toISOString());

      const prefer = selectedIdRef.current;
      const selected = prefer ? list.find((item) => item.id === prefer) : null;
      if (!selected) {
        const first = sortChannels(list.filter(isChannelPolicyProfile))[0] ?? list[0];
        setSelectedId(first?.id ?? null);
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

  const policy = useMemo(() => records.filter(isChannelPolicyProfile), [records]);
  const policyReady = policy.length > 0;
  const stubOnly = records.length > 0 && !policyReady && records.every(isChannelStub);
  const rows = useMemo(
    () => sortChannels(policyReady ? policy : records.filter((r) => !isChannelStub(r))),
    [policy, policyReady, records],
  );
  const selected = rows.find((item) => item.id === selectedId) ?? null;

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
      <header className={styles.bar}>
        <div>
          <h1>Channel Strategy</h1>
          <p>
            Enablement × provider matrix. Cells are the product — not a dossier list. Stage 01 writes
            rows while Running.
          </p>
        </div>
        <div className={styles.ops} aria-label="Operations">
          <span>
            SYS <strong>{systemState}</strong>
          </span>
          <span>
            S01{' '}
            <strong>{policyReady ? 'RECONCILED' : systemRunning ? 'RECONCILING' : 'IDLE'}</strong>
          </span>
          <span>
            ROWS <strong>{rows.length}</strong>
          </span>
          <span>
            REF <strong>{relativeRefresh(lastLoadedAt, now)}</strong>
          </span>
        </div>
      </header>

      <div className={styles.wrap}>
        {softError ? (
          <p className={styles.errorBanner} role="status">
            {softError}
          </p>
        ) : null}

        {!rows.length ? (
          <section className={styles.empty}>
            <h2>{stubOnly || !records.length ? 'Matrix not yet written' : 'No channels'}</h2>
            <p>
              {systemRunning
                ? 'Stage 01 is reconciling channel enablement rows.'
                : 'Press Start in the top bar. Stage 01 writes the matrix automatically.'}
            </p>
          </section>
        ) : (
          <div className={styles.layout}>
            <div className={styles.matrixWrap}>
              <table className={styles.matrix} aria-label="Channel enablement matrix">
                <thead>
                  <tr>
                    <th scope="col">Channel</th>
                    {MATRIX_COLUMNS.map((col) => (
                      <th key={col.id} scope="col">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((record) => (
                    <tr key={record.id ?? record.name}>
                      <th scope="row" className={styles.rowHead}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(record.id ?? null);
                            setActiveCell(null);
                          }}
                        >
                          <strong>{record.name}</strong>
                          <span>{configDisplay(record.configuration, 'lane') || 'channel'}</span>
                        </button>
                      </th>
                      {MATRIX_COLUMNS.map((col) => {
                        const cell = matrixCell(record, col.id);
                        const active =
                          record.id === selectedId && activeCell === col.id;
                        return (
                          <td key={col.id}>
                            <button
                              type="button"
                              className={`${styles.cellBtn} ${active ? styles.cellActive : ''}`}
                              onClick={() => {
                                setSelectedId(record.id ?? null);
                                setActiveCell(col.id);
                              }}
                            >
                              <span className={`${styles.cellLabel} ${toneClass(cell.tone)}`}>
                                {cell.label}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <aside className={styles.drawer} aria-label="Channel inspector">
              {selected ? (
                <>
                  <header className={styles.drawerHead}>
                    <h2>{selected.name}</h2>
                    <p>
                      {activeCell
                        ? `${MATRIX_COLUMNS.find((c) => c.id === activeCell)?.label}: ${matrixCell(selected, activeCell).detail || '—'}`
                        : selected.description || 'Select a matrix cell for column detail.'}
                    </p>
                  </header>
                  <dl className={styles.drawerBody}>
                    {INSPECTOR_FIELDS.map((key) => (
                      <div key={key}>
                        <dt>{fieldLabel(key)}</dt>
                        <dd>{configDisplay(selected.configuration, key) || 'Not set'}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <p className={styles.emptyDrawer}>Select a row or cell.</p>
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
