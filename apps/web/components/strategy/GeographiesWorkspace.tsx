'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Globe2, Landmark, Map, MapPin, Shield, ShieldAlert } from 'lucide-react';
import type { StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';
import { strategyApi } from '@/apps/web/lib/strategy-api';
import {
  configDisplay,
  CULTURE_FIELDS,
  CONSTRAINT_FIELDS,
  fieldLabel,
  filledFieldCount,
  filterGeographyRecords,
  geographyFieldGroups,
  geographySubtitle,
  hasCountry,
  isGeographyPolicyProfile,
  isGeographyStub,
  PLACE_FIELDS,
  type GeographyFilter,
} from '@/apps/web/lib/strategy-geographies';
import styles from './geographies.module.css';

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
  if (!value.trim()) {
    return <span className={styles.notSet}>Not set</span>;
  }
  return <p>{value}</p>;
}

const PANEL_ICONS = {
  place: Map,
  culture: Landmark,
  constraints: Shield,
} as const;

export function GeographiesWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<StrategyOverview | null>(null);
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GeographyFilter>('all');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const systemRunning = systemState === 'RUNNING';
  const groups = useMemo(() => geographyFieldGroups(), []);

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
      const list = (await strategyApi.list(next.versionId, 'geographies')).filter(
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

  const filtered = useMemo(
    () => filterGeographyRecords(records, query, filter),
    [records, query, filter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    records.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const policyProfiles = records.filter(isGeographyPolicyProfile);
  const policyReady = policyProfiles.length > 0;

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
        <div className={styles.skeletonHero} />
        <div className={styles.skeletonGrid}>
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
        </div>
        <div className={styles.skeletonDossier} />
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
      <header className={styles.hero}>
        <p className={styles.crumb}>
          Strategy & Fields
          <span aria-hidden> / </span>
          Country & Regional Profiles
        </p>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>Country & Regional Profiles</h1>
            <p className={styles.lede}>
              Autonomous atlas of country and regional authenticity policy. Stage 01 reconciles
              system geography profiles while Running — observe-only, no form input.
            </p>
          </div>
          <div className={styles.badges}>
            <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
            <span className={`${styles.badge} ${statusTone(overview.status)}`}>{overview.status}</span>
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.opsLine} aria-label="Geography operations summary">
          <span>
            System{' '}
            <strong data-state={systemState}>{systemState.replaceAll('_', ' ')}</strong>
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
            Profiles <strong>{policyProfiles.length || records.length}</strong>
          </span>
          <span className={styles.opsSep} aria-hidden>
            ·
          </span>
          <span>
            With country <strong>{records.filter(hasCountry).length}</strong>
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
            ? 'Observe-only atlas. Stage 01 has reconciled country and regional policy profiles. Global Start / Stop remain in the top bar — this page never edits records.'
            : systemRunning
              ? 'System is Running. Stage 01 is reconciling geography policy into durable profiles. This atlas updates automatically.'
              : 'System is idle. Global Start runs Stage 01 autonomy to materialise geography policy profiles here. No human form input on this page.'}
        </p>

        <div className={styles.toolbar}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search countries, regions, languages, constraints…"
            aria-label="Search country and regional profiles"
          />
          <div className={styles.chips} role="group" aria-label="Profile filters">
            {(
              [
                ['all', 'All'],
                ['with_country', 'With country'],
                ['stub_only', 'Stub only'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`${styles.chip} ${filter === value ? styles.chipActive : ''}`}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length ? (
          <div className={styles.cardGrid} role="list" aria-label="Geography dossier cards">
            {filtered.map((record) => {
              const config = record.configuration ?? {};
              const active = record.id === selectedId;
              const stub = isGeographyStub(record);
              const policy = isGeographyPolicyProfile(record);
              const country = configDisplay(config, 'country');
              const region = configDisplay(config, 'region');
              const languages = configDisplay(config, 'supportedLanguages');
              const placeFilled = filledFieldCount(record, PLACE_FIELDS);
              const cultureFilled = filledFieldCount(record, CULTURE_FIELDS);
              const constraintFilled = filledFieldCount(record, CONSTRAINT_FIELDS);
              return (
                <button
                  key={record.id ?? record.name}
                  type="button"
                  role="listitem"
                  className={`${styles.card} ${active ? styles.cardSelected : ''}`}
                  aria-pressed={active}
                  onClick={() => setSelectedId(record.id ?? null)}
                >
                  <div className={styles.cardTop}>
                    <h2 className={styles.cardTitle}>
                      <MapPin size={16} aria-hidden />
                      {record.name}
                    </h2>
                    <span className={`${styles.badge} ${statusTone(record.status)}`}>
                      {record.status}
                    </span>
                  </div>
                  <p className={styles.cardMeta}>{geographySubtitle(record)}</p>
                  <div className={styles.chipRow}>
                    {country ? (
                      <span className={styles.metaChip}>{country}</span>
                    ) : (
                      <span className={styles.notSet}>Country not set</span>
                    )}
                    {region ? <span className={styles.metaChip}>{region}</span> : null}
                    {languages ? <span className={styles.metaChip}>{languages}</span> : null}
                    {policy ? <span className={styles.stubChip}>System policy</span> : null}
                    {stub ? <span className={styles.stubChip}>Baseline stub</span> : null}
                  </div>
                  <div className={styles.coverage}>
                    <span>
                      Place <strong>{placeFilled}/{PLACE_FIELDS.length}</strong>
                    </span>
                    <span>
                      Culture <strong>{cultureFilled}/{CULTURE_FIELDS.length}</strong>
                    </span>
                    <span>
                      Rules <strong>{constraintFilled}/{CONSTRAINT_FIELDS.length}</strong>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyAtlas}>
            <Globe2 size={36} aria-hidden color="#0f766e" />
            <h3>{systemRunning ? 'Awaiting Stage 01 geography reconcile' : 'Atlas not started'}</h3>
            <p>
              {systemRunning
                ? 'Stage 01 is writing geography policy profiles. This atlas refreshes automatically — no manual configuration on this page.'
                : 'Start the system from the top bar. Stage 01 autonomy reconciles country and regional policy into this atlas.'}
            </p>
          </div>
        )}

        {selected ? (
          <section className={styles.dossier} aria-label="Selected geography dossier">
            <div className={styles.dossierHead}>
              <div>
                <h2>{selected.name}</h2>
                <p>
                  {geographySubtitle(selected)}
                  {selected.description ? ` — ${selected.description}` : ''}
                </p>
              </div>
              <span className={`${styles.badge} ${statusTone(selected.status)}`}>
                {selected.status}
              </span>
            </div>

            <div className={styles.dossierPanels}>
              {groups.map((group) => {
                const Icon = PANEL_ICONS[group.id];
                const config = selected.configuration ?? {};
                return (
                  <article key={group.id} className={styles.panel}>
                    <div className={styles.panelHead}>
                      <Icon size={16} aria-hidden />
                      <h3>{group.label}</h3>
                    </div>
                    <div className={styles.fieldList}>
                      {group.fields.map((key) => (
                        <div key={key} className={styles.fieldRow}>
                          <span>{fieldLabel(key)}</span>
                          <FieldValue value={configDisplay(config, key)} />
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className={styles.provenance}>
              <span>
                Origin <strong>{configDisplay(selected.configuration, 'origin') || '—'}</strong>
              </span>
              <span>
                System key{' '}
                <strong>{configDisplay(selected.configuration, 'systemKey') || '—'}</strong>
              </span>
              <span>
                Priority <strong>{selected.priority}</strong>
              </span>
              <span>
                Effective from{' '}
                <strong>
                  {selected.effectiveFrom
                    ? new Date(selected.effectiveFrom).toLocaleString()
                    : '—'}
                </strong>
              </span>
              {isGeographyStub(selected) ? (
                <span>
                  Note <strong>Baseline stub — not a fabricated country set</strong>
                </span>
              ) : null}
            </div>
          </section>
        ) : null}

        <p className={styles.footerHint}>
          Observe-only atlas. Global Start / Stop stay in the top bar. Empty place, culture, and
          constraint fields show as Not set until Stage 01 writes real values.
        </p>
      </div>
    </motion.main>
  );
}
