'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BookOpen, ScrollText, ShieldAlert } from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  CHARTER_RULE_FIELDS,
  chapterKey,
  configDisplay,
  fieldLabel,
  filledRuleCount,
  filterEditorialRecords,
  isEditorialPolicyChapter,
  isEditorialStub,
} from '@/apps/web/lib/strategy-editorial';
import styles from './editorial.module.css';

function statusTone(status?: string) {
  switch (status) {
    case 'ACTIVE':
    case 'READY':
    case 'RUNNING':
      return styles.toneReady;
    case 'INVALID':
    case 'BLOCKED':
    case 'FAILED':
    case 'EMERGENCY_STOP':
      return styles.toneBlocked;
    case 'IN_REVIEW':
    case 'PAUSED':
    case 'QUEUED':
      return styles.toneWarning;
    case 'STOPPED':
    case 'UNAVAILABLE':
      return styles.toneIdle;
    case 'DRAFT':
    default:
      return styles.toneDraft;
  }
}

function relativeRefresh(iso: string | null, now: number) {
  if (!iso) return '—';
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function FieldValue({ value }: { value: string }) {
  if (!value.trim()) return <span className={styles.notSet}>Not set</span>;
  return <>{value}</>;
}

export function EditorialWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const systemRunning = systemState === 'RUNNING';

  async function load(preferId?: string | null) {
    setBusy(true);
    setError('');
    try {
      const [next, dashboard] = await Promise.all([
        strategyApi.overview(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setLastLoadedAt(new Date().toISOString());
      if (!next.available || !next.versionId) {
        setRecords([]);
        setSelectedId(null);
        return;
      }
      const list = (await strategyApi.list(next.versionId, 'editorial-policy')).filter(
        (record) => record.status !== 'ARCHIVED',
      );
      setRecords(list);
      const targetId = preferId ?? selectedId;
      const selected = targetId ? list.find((item) => item.id === targetId) : list[0];
      setSelectedId(selected?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unavailable');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load(selectedId);
    }, systemRunning ? 3000 : 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemRunning, selectedId]);

  useEffect(() => {
    const onControlChanged = () => void load(selectedId);
    window.addEventListener('cacsms:system-control-changed', onControlChanged);
    return () => window.removeEventListener('cacsms:system-control-changed', onControlChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const chapters = useMemo(() => {
    const live = records.filter((record) => !isEditorialStub(record));
    const policy = live.filter(isEditorialPolicyChapter);
    const source = policy.length > 0 ? policy : live;
    return filterEditorialRecords(source, query);
  }, [records, query]);

  const selected =
    chapters.find((item) => item.id === selectedId) ??
    records.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!chapters.length) return;
    if (selectedId && chapters.some((item) => item.id === selectedId)) return;
    setSelectedId(chapters[0]?.id ?? null);
  }, [chapters, selectedId]);

  const policyChapters = records.filter(isEditorialPolicyChapter);
  const policyReady = policyChapters.length > 0;
  const stubOnly = records.length > 0 && !policyReady && records.every(isEditorialStub);

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
      };

  if (busy && !overview) {
    return (
      <main className={styles.page}>
        <div className={styles.skeletonHead} />
        <div className={styles.skeletonGrid}>
          <div className={styles.skeletonToc} />
          <div className={styles.skeletonCharter} />
        </div>
      </main>
    );
  }

  if (error || !overview?.available) {
    return (
      <main className={styles.page}>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Strategy service unavailable</h2>
          <p>{error || overview?.reason}</p>
          <p>Reconnecting automatically…</p>
        </section>
      </main>
    );
  }

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.masthead}>
        <p className={styles.crumb}>
          Strategy & Fields
          <span aria-hidden> / </span>
          Editorial & Brand Policy
        </p>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>Editorial & Brand Policy</h1>
            <p className={styles.lede}>
              Charter for voice, factuality, representation, and disclosure. Stage 01 writes
              chapters while Running — this page is observe-only.
            </p>
          </div>
          <div className={styles.badges}>
            <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
            <span className={`${styles.badge} ${statusTone(overview.status)}`}>{overview.status}</span>
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.opsLine} aria-label="Editorial operations summary">
          <span>
            System <strong>{systemState.replaceAll('_', ' ')}</strong>
          </span>
          <span className={styles.opsSep} aria-hidden>
            ·
          </span>
          <span>
            Stage 01{' '}
            <strong>{policyReady ? 'Policy reconciled' : systemRunning ? 'Reconciling…' : 'Idle'}</strong>
          </span>
          <span className={styles.opsSep} aria-hidden>
            ·
          </span>
          <span>
            Chapters <strong>{policyChapters.length || (stubOnly ? 0 : records.length)}</strong>
          </span>
          <span className={styles.opsSep} aria-hidden>
            ·
          </span>
          <span>
            Last refresh <strong>{relativeRefresh(lastLoadedAt, now)}</strong>
          </span>
        </div>

        <p className={styles.notice}>
          {policyReady
            ? 'Observe-only charter. Stage 01 has reconciled editorial chapters. Global control stays in the top bar.'
            : systemRunning
              ? 'System is Running. Stage 01 is reconciling editorial & brand policy into charter chapters. This view updates automatically.'
              : 'Observe-only. No form input — Start the system from the top bar so Stage 01 can write editorial chapters.'}
        </p>

        <div className={styles.toolbar}>
          <input
            id="editorial-search"
            type="search"
            placeholder="Search editorial & brand policy"
            aria-label="Search editorial and brand policy"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </div>

        {!chapters.length ? (
          <section className={styles.empty}>
            <ScrollText size={28} aria-hidden />
            <h3>{stubOnly || !records.length ? 'Charter not yet written' : 'No matching chapters'}</h3>
            <p>
              {stubOnly || !records.length
                ? systemRunning
                  ? 'Stage 01 will replace the stub with normative charter chapters shortly.'
                  : 'Press Start in the global control bar. While Running, Stage 01 reconciles editorial policy into chapters.'
                : 'Try a different search term.'}
            </p>
          </section>
        ) : (
          <div className={styles.layout}>
            <aside className={styles.toc} aria-label="Charter table of contents">
              <h2>
                <BookOpen size={16} aria-hidden style={{ marginRight: 6, verticalAlign: -2 }} />
                Contents
              </h2>
              <p>Select a chapter to read its articles.</p>
              <ul className={styles.tocList}>
                {chapters.map((record) => {
                  const rules = filledRuleCount(record);
                  const active = record.id === selected?.id;
                  return (
                    <li key={record.id}>
                      <button
                        type="button"
                        className={`${styles.tocItem} ${active ? styles.tocItemActive : ''}`}
                        onClick={() => setSelectedId(record.id)}
                        aria-current={active ? 'true' : undefined}
                      >
                        <strong>{record.name}</strong>
                        <span>
                          {chapterKey(record)} · {rules}/{CHARTER_RULE_FIELDS.length} rules ·{' '}
                          {record.status}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <article className={styles.charter} aria-label="Selected charter chapter">
              {selected ? (
                <>
                  <header className={styles.charterHead}>
                    <div>
                      <h2>{selected.name}</h2>
                      <p>{selected.description || 'Normative editorial rules for this chapter.'}</p>
                    </div>
                    <span className={`${styles.badge} ${statusTone(selected.status)}`}>
                      {selected.status}
                    </span>
                  </header>

                  <dl className={styles.ruleList}>
                    {CHARTER_RULE_FIELDS.map((key) => {
                      const value = configDisplay(selected.configuration, key);
                      return (
                        <div key={key} className={styles.ruleRow}>
                          <dt>{fieldLabel(key)}</dt>
                          <dd>
                            <FieldValue value={value} />
                          </dd>
                        </div>
                      );
                    })}
                  </dl>

                  <footer className={styles.provenance}>
                    <span>
                      Chapter <strong>{chapterKey(selected)}</strong>
                    </span>
                    <span>
                      Priority <strong>{selected.priority}</strong>
                    </span>
                    <span>
                      Key{' '}
                      <strong>{configDisplay(selected.configuration, 'systemKey') || '—'}</strong>
                    </span>
                    <span>
                      Effective from <strong>{selected.effectiveFrom ?? '—'}</strong>
                    </span>
                  </footer>
                </>
              ) : null}
            </article>
          </div>
        )}

        <p className={styles.footerHint}>
          Normative charter only — no compliance scores. Changes apply on the next Stage 01
          reconcile while the system is Running.
        </p>
      </div>
    </motion.main>
  );
}
