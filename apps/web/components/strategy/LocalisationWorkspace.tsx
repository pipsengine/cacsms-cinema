'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  ADAPTATION_LADDER,
  configDisplay,
  familyShort,
  isHubLocale,
  isLocalisationPolicyKit,
  isLocalisationStub,
  languageStack,
  localeFamily,
  requiresHumanReview,
  sortLocaleConstellation,
} from '@/apps/web/lib/strategy-localisation';
import styles from './localisation.module.css';

const SAT_POS = [styles.pos0, styles.pos1, styles.pos2, styles.pos3];

function relativeRefresh(iso: string | null, now: number) {
  if (!iso) return '—';
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export function LocalisationWorkspace() {
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

      const list = (await strategyApi.list(next.versionId, 'localisation')).filter(
        (record) => record.status !== 'ARCHIVED',
      );
      if (seq !== loadSeq.current || controller.signal.aborted) return;

      setRecords(list);
      setSoftError('');
      setLastLoadedAt(new Date().toISOString());

      const prefer = selectedIdRef.current;
      if (!(prefer && list.some((item) => item.id === prefer))) {
        const ordered = sortLocaleConstellation(list.filter(isLocalisationPolicyKit));
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

  const kits = useMemo(() => records.filter(isLocalisationPolicyKit), [records]);
  const policyReady = kits.length > 0;
  const stubOnly = records.length > 0 && !policyReady && records.every(isLocalisationStub);
  const ordered = useMemo(
    () => sortLocaleConstellation(policyReady ? kits : records.filter((r) => !isLocalisationStub(r))),
    [kits, policyReady, records],
  );
  const hub = ordered.find(isHubLocale) ?? ordered[0] ?? null;
  const satellites = ordered.filter((r) => r.id !== hub?.id);
  const selected = ordered.find((r) => r.id === selectedId) ?? hub;

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
      <header className={styles.top}>
        <h1>Language & Localisation</h1>
        <p>
          Locale constellation — EN-NG hub with language satellites. Not a format card grid. Stage 01
          writes kits while Running.
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
          Kits <strong>{ordered.length}</strong>
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

      {!ordered.length ? (
        <section className={styles.empty}>
          <h2>{stubOnly || !records.length ? 'Constellation not yet written' : 'No locales'}</h2>
          <p>
            {systemRunning
              ? 'Stage 01 is reconciling localisation kits.'
              : 'Press Start in the top bar. Stage 01 writes the locale map automatically.'}
          </p>
        </section>
      ) : (
        <div className={styles.stage}>
          <div className={styles.constellation} aria-label="Locale constellation">
            {hub ? (
              <button
                type="button"
                className={`${styles.hub} ${selected?.id === hub.id ? styles.hubActive : ''}`}
                onClick={() => setSelectedId(hub.id ?? null)}
              >
                <strong>{familyShort(localeFamily(hub))}</strong>
                <span>Hub</span>
              </button>
            ) : null}
            {satellites.map((record, index) => {
              const family = localeFamily(record);
              const gated = family === 'pidgin';
              return (
                <button
                  key={record.id ?? record.name}
                  type="button"
                  className={`${styles.sat} ${SAT_POS[index % SAT_POS.length]} ${
                    selected?.id === record.id ? styles.satActive : ''
                  } ${gated ? styles.satGated : ''}`}
                  onClick={() => setSelectedId(record.id ?? null)}
                >
                  <strong>{familyShort(family)}</strong>
                  <span>{gated ? 'Gated' : 'Satellite'}</span>
                </button>
              );
            })}
            <p className={styles.orbitHint}>Select hub or satellite → adaptation ladder</p>
          </div>

          <aside className={styles.ladderPanel} aria-label="Adaptation ladder">
            {selected ? (
              <>
                <h2>{selected.name}</h2>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
                  {selected.description}
                </p>
                <div className={styles.stack}>
                  {languageStack(selected).map((lang) => (
                    <span key={lang} className={styles.stackChip}>
                      {lang}
                    </span>
                  ))}
                </div>
                <ol className={styles.ladder}>
                  {ADAPTATION_LADDER.map((step, index) => (
                    <li key={step.id} className={styles.step}>
                      <span className={styles.stepIndex}>{index + 1}</span>
                      <div>
                        <p className={styles.stepLabel}>{step.label}</p>
                        <p className={styles.stepValue}>
                          {configDisplay(selected.configuration, step.field) || 'Not set'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                {requiresHumanReview(selected) ? (
                  <p className={styles.reviewBanner}>Human review flagged for this locale kit.</p>
                ) : null}
              </>
            ) : null}
          </aside>
        </div>
      )}
    </main>
  );
}
