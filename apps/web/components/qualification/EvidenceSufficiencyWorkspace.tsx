'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Download,
  FileSearch,
  Fingerprint,
  Gauge,
  Layers3,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
  XCircle,
} from 'lucide-react';
import type {
  EvidenceCandidate,
  EvidenceSufficiencyOverview,
} from '@/lib/idea-qualification/evidence';
import { qualificationApi } from '@/apps/web/lib/qualification-api';
import styles from './evidence-sufficiency.module.css';

type TabId =
  | 'overview'
  | 'table'
  | 'summary'
  | 'coverage'
  | 'authority'
  | 'corroboration'
  | 'recency'
  | 'rights'
  | 'explain'
  | 'contradictions'
  | 'gaps'
  | 'bias'
  | 'recommendations'
  | 'analytics'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'table', label: 'Evaluation Table' },
  { id: 'summary', label: 'Evidence Summary' },
  { id: 'coverage', label: 'Coverage Matrix' },
  { id: 'authority', label: 'Authority' },
  { id: 'corroboration', label: 'Corroboration' },
  { id: 'recency', label: 'Recency' },
  { id: 'rights', label: 'Rights' },
  { id: 'explain', label: 'Explainability' },
  { id: 'contradictions', label: 'Contradictions' },
  { id: 'gaps', label: 'Gap Analysis' },
  { id: 'bias', label: 'Bias' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit' },
];

const EMPTY_COPY =
  'The Evidence Sufficiency Engine automatically determines whether each candidate documentary has enough trustworthy, diverse, current, authoritative, and legally usable evidence to proceed. Every claim is analysed for corroboration, authority, recency, rights clearance, contradiction, and completeness. Once candidate ideas begin entering this stage, detailed evidence scorecards, explainable AI decisions, coverage matrices, confidence metrics, and governance records will be displayed here.';

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'COMPLETE':
    case 'COVERED':
    case 'PASSED':
    case 'PASS':
    case 'CLEARED':
    case 'OBSERVED':
    case 'EVIDENCE COMPLETE':
    case 'RUNNING':
      return styles.toneReady;
    case 'INSUFFICIENT':
    case 'MISSING':
    case 'FAILED':
    case 'FAIL':
    case 'BLOCKED':
    case 'CRITICAL':
      return styles.toneBlocked;
    case 'PARTIAL':
    case 'PENDING':
    case 'LIMITED':
    case 'WARNING':
    case 'UNMEASURED':
    case 'NEEDS REVIEW':
      return styles.toneWarning;
    default:
      return styles.toneDraft;
  }
}

function display(value?: string | number | null) {
  if (value == null || value === '') return '—';
  return String(value);
}

function measured(value?: string | number | null) {
  if (value == null || value === '') return 'UNMEASURED';
  return String(value);
}

function sparkBars(seed: number) {
  return [4, 7, 5, 9, 6, 10, 8].map((base, index) =>
    Math.max(3, ((base + seed + index * 2) % 10) + 3),
  );
}

function coverageGlyph(status: string) {
  if (status === 'COVERED') return '✅';
  if (status === 'PARTIAL') return '⚠';
  if (status === 'MISSING') return '❌';
  return '?';
}

function exportPayload(overview: EvidenceSufficiencyOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `evidence-sufficiency-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'id',
    'title',
    'evidenceScore',
    'sources',
    'verifiedClaims',
    'authority',
    'status',
  ];
  const lines = [
    header.join(','),
    ...overview.candidates.map((item) =>
      [
        item.id,
        JSON.stringify(item.title),
        item.evidenceScore ?? '',
        item.sourcesAnalysed,
        item.verifiedClaims,
        item.authorityScore ?? '',
        item.sufficiencyStatus,
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `evidence-sufficiency-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function EvidenceSufficiencyWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<EvidenceSufficiencyOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tab, setTab] = useState<TabId>('overview');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [systemState, setSystemState] = useState('UNAVAILABLE');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const systemRunning = systemState === 'RUNNING';

  async function load(preferId?: string | null) {
    setBusy(true);
    setError('');
    try {
      const [next, dashboard] = await Promise.all([
        qualificationApi.evidence(),
        fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<{ system?: { controlState?: string } }>;
        }),
      ]);
      setOverview(next);
      setSystemState(dashboard?.system?.controlState ?? 'UNAVAILABLE');
      setSyncedAt(new Date().toISOString());
      const items = next.candidates ?? [];
      const targetId = preferId ?? selectedId;
      const selected = targetId ? items.find((item) => item.id === targetId) : items[0];
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

  const candidates = overview?.candidates ?? [];
  const metrics = overview?.metrics;
  const needle = query.trim().toLowerCase();

  const statuses = useMemo(
    () => [...new Set(candidates.map((item) => item.sufficiencyStatus))].sort(),
    [candidates],
  );

  const filtered = useMemo(
    () =>
      candidates.filter((item) => {
        if (statusFilter !== 'all' && item.sufficiencyStatus !== statusFilter) return false;
        if (!needle) return true;
        const haystack = [
          item.title,
          item.domain,
          item.summary,
          item.sufficiencyStatus,
          item.recommendation,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      }),
    [candidates, needle, statusFilter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    candidates.find((item) => item.id === selectedId) ??
    null;

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((item) => item.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const maxRule = Math.max(
    1,
    ...(overview?.analytics.ruleDistribution.map((item) => item.count) ?? [1]),
  );

  const kpis = useMemo(() => {
    const m = metrics;
    return [
      {
        label: 'Total Candidate Ideas',
        value: String(m?.totalCandidates ?? 0),
        meta: 'Pool under evidence review',
        accent: '#2563EB',
        icon: Layers3,
        bars: sparkBars(m?.totalCandidates ?? 0),
        drill: 'table' as TabId,
      },
      {
        label: 'Evidence Complete',
        value: String(m?.evidenceComplete ?? 0),
        meta: 'Sufficiency COMPLETE',
        accent: '#22C55E',
        icon: CheckCircle2,
        bars: sparkBars(m?.evidenceComplete ?? 0),
        drill: 'table' as TabId,
      },
      {
        label: 'Evidence Insufficient',
        value: String(m?.evidenceInsufficient ?? 0),
        meta: 'Blocking / low score',
        accent: '#EF4444',
        icon: XCircle,
        bars: sparkBars(m?.evidenceInsufficient ?? 0),
        drill: 'gaps' as TabId,
      },
      {
        label: 'Sources Analysed',
        value: String(m?.sourcesAnalysed ?? 0),
        meta: 'Persisted evidence checks',
        accent: '#0EA5E9',
        icon: FileSearch,
        bars: sparkBars(m?.sourcesAnalysed ?? 0),
        drill: 'summary' as TabId,
      },
      {
        label: 'Claims Verified',
        value: String(m?.claimsVerified ?? 0),
        meta: 'Passed checks',
        accent: '#14B8A6',
        icon: ShieldCheck,
        bars: sparkBars(m?.claimsVerified ?? 0),
        drill: 'corroboration' as TabId,
      },
      {
        label: 'Avg Evidence Score',
        value: m?.averageEvidenceScore != null ? `${m.averageEvidenceScore}%` : 'UNMEAS.',
        meta: 'Factor / check pass rate',
        accent: '#7C3AED',
        icon: Gauge,
        bars: sparkBars(m?.averageEvidenceScore ?? 0),
        drill: 'explain' as TabId,
      },
      {
        label: 'Authority Score',
        value: m?.authorityScore != null ? `${m.authorityScore}` : 'UNMEAS.',
        meta: 'Authority rules / payloads',
        accent: '#2563EB',
        icon: Fingerprint,
        bars: sparkBars(m?.authorityScore ?? 0),
        drill: 'authority' as TabId,
      },
      {
        label: 'Corroboration Score',
        value: m?.corroborationScore != null ? `${m.corroborationScore}` : 'UNMEAS.',
        meta: 'Independent support checks',
        accent: '#0EA5E9',
        icon: Scale,
        bars: sparkBars(m?.corroborationScore ?? 0),
        drill: 'corroboration' as TabId,
      },
      {
        label: 'Rights Cleared',
        value: String(m?.rightsCleared ?? 0),
        meta: 'Candidates with cleared rights',
        accent: '#22C55E',
        icon: ShieldCheck,
        bars: sparkBars(m?.rightsCleared ?? 0),
        drill: 'rights' as TabId,
      },
      {
        label: 'Avg Source Age',
        value:
          m?.averageSourceAgeDays != null ? `${m.averageSourceAgeDays}d` : 'UNMEAS.',
        meta: 'From publishedAt in evidence_json',
        accent: '#64748B',
        icon: Timer,
        bars: sparkBars(m?.averageSourceAgeDays ?? 0),
        drill: 'recency' as TabId,
      },
      {
        label: 'Contradictions Found',
        value: String(m?.contradictionsFound ?? 0),
        meta: 'Failed contradiction checks',
        accent: '#F59E0B',
        icon: AlertTriangle,
        bars: sparkBars(m?.contradictionsFound ?? 0),
        drill: 'contradictions' as TabId,
      },
      {
        label: 'Evidence Confidence',
        value: m?.evidenceConfidence != null ? `${m.evidenceConfidence}%` : 'UNMEAS.',
        meta: 'Candidate confidence avg',
        accent: '#7C3AED',
        icon: BrainCircuit,
        bars: sparkBars(m?.evidenceConfidence ?? 0),
        drill: 'explain' as TabId,
      },
    ];
  }, [metrics]);

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35 },
      };

  if (busy && !overview) {
    return (
      <main className={styles.page}>
        <div className={styles.skeletonTop} />
        <div className={styles.skeletonGrid}>
          <div className={styles.skeletonPanel} />
          <div className={styles.skeletonPanel} />
          <div className={styles.skeletonPanel} />
        </div>
      </main>
    );
  }

  if (error || (overview && !overview.available)) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Idea Qualification / Evidence Sufficiency</p>
        <h1 className={styles.title}>Evidence Validation Command Centre</h1>
        <section className={styles.unavailable}>
          <ShieldAlert size={28} aria-hidden />
          <h2>Evidence Sufficiency unavailable</h2>
          <p>{error || overview?.reason}</p>
          <button type="button" className={styles.chip} onClick={() => void load()}>
            Retry connection
          </button>
        </section>
      </main>
    );
  }

  const showWaiting = !overview?.meta.intakeStatus;
  const showEmpty = Boolean(overview?.meta.intakeStatus) && candidates.length === 0;

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 03 Idea Qualification / Evidence Sufficiency
          </p>
          <h1 className={styles.title}>Evidence Validation Command Centre</h1>
          <p className={styles.lede}>
            Validate authority, corroboration, recency, rights and claim coverage before a candidate
            advances to Strategic Fit.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 03 Evidence</span>
          <span className={`${styles.badge} ${statusTone(overview?.meta.cycleStatus)}`}>
            Cycle {overview?.meta.cycleStatus ?? 'IDLE'}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous evidence validation</strong>
          Scores are reconstructed from persisted <code>iq_evidence_checks</code> and score
          factors. Source-type taxonomy, jurisdiction rights, and bias classifiers stay UNMEASURED
          unless present in check payloads.
          {syncedAt ? ` Last synchronized ${new Date(syncedAt).toLocaleString()}.` : ''}
          <span style={{ marginLeft: 12 }}>
            <button
              type="button"
              className={styles.chip}
              onClick={() => overview && exportPayload(overview, 'json')}
            >
              <Download size={12} aria-hidden /> JSON
            </button>{' '}
            <button
              type="button"
              className={styles.chip}
              onClick={() => overview && exportPayload(overview, 'csv')}
            >
              <Download size={12} aria-hidden /> CSV
            </button>
          </span>
        </div>
      </div>

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Evidence KPIs">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              type="button"
              className={styles.kpiCard}
              style={{ ['--accent' as string]: kpi.accent }}
              title={kpi.meta}
              onClick={() => setTab(kpi.drill)}
            >
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>{kpi.label}</span>
                <Icon size={16} className={styles.kpiIcon} aria-hidden />
              </div>
              <div className={styles.kpiValue}>{kpi.value}</div>
              <div className={styles.kpiMeta}>
                <span>{kpi.meta}</span>
                <span className={styles.spark} aria-hidden>
                  {kpi.bars.map((height, index) => (
                    <i key={`${kpi.label}-${index}`} style={{ height: `${height}px` }} />
                  ))}
                </span>
              </div>
            </button>
          );
        })}
      </section>

      <section className={styles.lifecycle} aria-label="Evidence validation pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Evidence validation workflow</h2>
          <span>
            Collect → Authority → Corroboration → Recency → Claims → Bias → Rights → Sufficiency →
            Research Ready
          </span>
        </div>
        <div className={styles.lifecycleTrack}>
          {(overview?.pipeline ?? []).map((stage) => (
            <div key={stage.key} className={styles.stage} data-state={stage.state}>
              <span className={styles.stageIcon}>
                <Workflow size={14} aria-hidden />
              </span>
              <strong>{stage.label}</strong>
            </div>
          ))}
        </div>
      </section>

      {showWaiting ? (
        <div className={styles.waitingBanner} role="status">
          <Timer size={18} aria-hidden />
          <div>
            <strong>Waiting for Intelligence Intake</strong>
            Evidence validation activates after candidate packages are acknowledged and the
            qualification cycle writes evidence checks.
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>{EMPTY_COPY}</h2>
            <p className={styles.lede}>
              Candidate Pool → Evidence Collection → Authority → Corroboration → Recency → Rights →
              Sufficiency → Strategic Fit.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Collect</strong>
              Persist evidence checks
            </li>
            <li>
              <strong>2. Validate</strong>
              Authority + corroboration
            </li>
            <li>
              <strong>3. Clear</strong>
              Rights + contradictions
            </li>
            <li>
              <strong>4. Decide</strong>
              Sufficiency gate
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Evidence workspace">
        <aside className={styles.panel} aria-label="Evidence Explorer">
          <div className={styles.panelHead}>
            <h2>Evidence Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Candidate, topic, recommendation…"
              />
            </label>
            <label className={styles.field}>
              <span>Sufficiency</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            {!filtered.length ? (
              <div className={styles.emptyInline}>
                <p>No candidates match the current filters.</p>
              </div>
            ) : (
              <ul className={styles.explorerList}>
                {filtered.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`${styles.explorerItem} ${
                        selected?.id === item.id ? styles.explorerItemActive : ''
                      }`}
                      onClick={() => {
                        setSelectedId(item.id);
                        setTab('explain');
                      }}
                    >
                      <span className={styles.explorerTitle}>{item.title}</span>
                      <span className={styles.explorerMeta}>
                        {item.domain} · score{' '}
                        {item.evidenceScore != null ? `${item.evidenceScore}%` : 'UNMEAS.'} ·{' '}
                        {item.sourcesAnalysed} sources
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.sufficiencyStatus)}`}>
                          {item.sufficiencyStatus}
                        </span>
                        <span className={`${styles.chip} ${statusTone(item.recommendation)}`}>
                          {item.recommendation}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Evidence detail">
          <div className={styles.tabs} role="tablist">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`${styles.tab} ${tab === item.id ? styles.tabActive : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={styles.tabBody} role="tabpanel">
            {tab === 'overview' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Notifications</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.notifications ?? []).slice(0, 8).map((note) => (
                      <li key={note.id}>
                        <span className={`${styles.chip} ${statusTone(note.severity)}`}>
                          {note.severity}
                        </span>{' '}
                        {note.message}
                      </li>
                    ))}
                    {!overview?.notifications.length ? <li>No evidence alerts.</li> : null}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Rule distribution</h3>
                  <div className={styles.waterfall}>
                    {(overview?.analytics.ruleDistribution ?? []).map((item) => (
                      <div key={item.label} className={styles.waterfallRow}>
                        <span>{item.label}</span>
                        <div className={styles.radarBar}>
                          <div
                            className={styles.radarFill}
                            style={{ width: `${(item.count / maxRule) * 100}%` }}
                          />
                        </div>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                    {!overview?.analytics.ruleDistribution.length ? (
                      <p className={styles.lede}>No evidence rules persisted yet.</p>
                    ) : null}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'table' ? (
              <EvidenceTable
                items={filtered}
                onSelect={(id) => {
                  setSelectedId(id);
                  setTab('explain');
                }}
              />
            ) : null}

            {tab === 'summary' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Evidence summary · {selected.title}</h3>
                  <p>{selected.aiSummary}</p>
                  <div className={styles.metricGrid}>
                    {selected.sourceBreakdown.map((row) => (
                      <div key={row.label} className={styles.metricTile}>
                        <span>{row.label}</span>
                        <strong>{measured(row.count)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'coverage' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Evidence coverage matrix</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th>Coverage</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.coverage.map((cell) => (
                        <tr key={cell.topic}>
                          <td>{cell.topic}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(cell.status)}`}>
                              {coverageGlyph(cell.status)} {cell.status}
                            </span>
                          </td>
                          <td>{cell.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'authority' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Source authority</h3>
                  <p className={styles.lede}>
                    Authority score: {measured(selected.authorityScore)}
                  </p>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Source / rule</th>
                        <th>Category</th>
                        <th>Authority</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.checks
                        .filter((check) => check.category === 'Authority' || check.authorityScore != null)
                        .map((check) => (
                          <tr key={check.id}>
                            <td>{check.sourceLabel ?? check.ruleCode}</td>
                            <td>{check.category}</td>
                            <td>{measured(check.authorityScore)}</td>
                            <td>{check.status}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!selected.checks.some(
                    (check) => check.category === 'Authority' || check.authorityScore != null,
                  ) ? (
                    <p className={styles.lede}>
                      No authority payloads persisted. Scores appear when evidence_json includes
                      authorityScore / publisher fields.
                    </p>
                  ) : null}
                </article>
              </div>
            ) : null}

            {tab === 'corroboration' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Corroboration engine</h3>
                  <p className={styles.lede}>
                    Corroboration score: {measured(selected.corroborationScore)}
                  </p>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Claim</th>
                        <th>Supporting sources</th>
                        <th>Confidence</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.claims.map((claim) => (
                        <tr key={`${claim.claim}-${claim.status}`}>
                          <td>{claim.claim}</td>
                          <td>{measured(claim.supportingSources)}</td>
                          <td>
                            {claim.confidence != null ? `${claim.confidence}%` : 'UNMEAS.'}
                          </td>
                          <td>{claim.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!selected.claims.length ? (
                    <p className={styles.lede}>No claim-level corroboration payloads yet.</p>
                  ) : null}
                </article>
              </div>
            ) : null}

            {tab === 'recency' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Recency & freshness</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Recency score</dt>
                      <dd>{measured(selected.recencyScore)}</dd>
                    </div>
                    <div>
                      <dt>Average source age</dt>
                      <dd>
                        {selected.freshness.averageAgeDays != null
                          ? `${selected.freshness.averageAgeDays} days`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Last updated</dt>
                      <dd>
                        {selected.freshness.lastUpdated
                          ? new Date(selected.freshness.lastUpdated).toLocaleString()
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Stale sources (&gt;5y)</dt>
                      <dd>{measured(selected.freshness.staleSources)}</dd>
                    </div>
                    <div>
                      <dt>Newly published (&lt;1y)</dt>
                      <dd>{measured(selected.freshness.newlyPublished)}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'rights' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Rights & licensing</h3>
                  <ul className={styles.bulletList}>
                    {selected.rights.map((row) => (
                      <li key={row.label}>
                        <span className={`${styles.chip} ${statusTone(row.status)}`}>
                          {row.status}
                        </span>{' '}
                        {row.label}
                      </li>
                    ))}
                  </ul>
                  <p className={styles.lede}>
                    Rights score: {measured(selected.rightsScore)}. Detailed copyright / CC /
                    commercial usage fields remain UNMEASURED unless encoded in evidence_json.
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'explain' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    Evidence sufficiency:{' '}
                    {selected.evidenceScore != null ? `${selected.evidenceScore}%` : 'UNMEASURED'}
                  </h3>
                  <ul className={styles.bulletList}>
                    {selected.explainability.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Confidence breakdown</h3>
                  <div className={styles.metricGrid}>
                    {selected.confidenceBreakdown.map((row) => (
                      <div key={row.label} className={styles.metricTile}>
                        <span>{row.label}</span>
                        <strong>{measured(row.value)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
                <article className={styles.detailCard}>
                  <h3>Validation lifecycle</h3>
                  <ul className={styles.timeline}>
                    {selected.lifecycle.map((step) => (
                      <li key={step.key}>
                        <CircleDot size={14} aria-hidden />
                        <div>
                          <strong>
                            {step.label}
                            {step.done ? ' ✓' : ''}
                          </strong>
                          <span>{step.done ? 'Observed' : 'Pending'}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'contradictions' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Contradiction detection</h3>
                  {!selected.contradictionsList.length ? (
                    <p className={styles.lede}>
                      No contradiction checks persisted for this candidate (
                      {selected.contradictions} failed contradiction signals).
                    </p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Claim</th>
                          <th>Source A</th>
                          <th>Source B</th>
                          <th>Resolution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.contradictionsList.map((row) => (
                          <tr key={`${row.claim}-${row.sourceA}`}>
                            <td>{row.claim}</td>
                            <td>{row.sourceA}</td>
                            <td>{row.sourceB}</td>
                            <td>{row.resolution}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'gaps' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Evidence gap analysis</h3>
                  <ul className={styles.bulletList}>
                    {selected.gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                    {!selected.gaps.length ? (
                      <li>No coverage gaps inferred from persisted rule codes.</li>
                    ) : null}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'bias' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Bias detection</h3>
                  <ul className={styles.bulletList}>
                    {selected.biasSignals.map((signal) => (
                      <li key={signal.label}>
                        <span className={`${styles.chip} ${statusTone(signal.status)}`}>
                          {signal.status}
                        </span>{' '}
                        {signal.label} — {signal.detail}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'recommendations' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>AI recommendations</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Reason</th>
                        <th>Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overview?.recommendations ?? []).map((item) => (
                        <tr key={item.id}>
                          <td>
                            <span className={`${styles.chip} ${statusTone(item.action)}`}>
                              {item.action}
                            </span>
                          </td>
                          <td>{item.reason}</td>
                          <td>{item.priority}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'analytics' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Check status distribution</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.analytics.statusDistribution ?? []).map((item) => (
                      <li key={item.label}>
                        {item.label}: {item.count}
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Severity distribution</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.analytics.severityDistribution ?? []).map((item) => (
                      <li key={item.label}>
                        {item.label}: {item.count}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Evidence audit trail</h3>
                  {!overview?.audit.length ? (
                    <p className={styles.lede}>No evidence-related audit events persisted yet.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Action</th>
                          <th>Actor</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.audit.map((row) => (
                          <tr key={row.id}>
                            <td>{new Date(row.createdAt).toLocaleString()}</td>
                            <td>{row.action}</td>
                            <td>{row.actorType}</td>
                            <td>{display(row.reason)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {[
              'summary',
              'coverage',
              'authority',
              'corroboration',
              'recency',
              'rights',
              'explain',
              'contradictions',
              'gaps',
              'bias',
            ].includes(tab) && !selected ? (
              <div className={styles.emptyInline}>
                <FileSearch size={22} aria-hidden />
                <p>Select a candidate to inspect evidence sufficiency detail.</p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.insights}`} aria-label="AI Insights">
          <div className={styles.panelHead}>
            <h2>AI Explainability</h2>
            <BrainCircuit size={16} aria-hidden />
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightStack}>
              <article className={styles.insightCard}>
                <h3>Selected candidate</h3>
                <p>{selected?.title ?? 'Select a candidate for XAI detail.'}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Sufficiency</h3>
                <p>
                  {selected
                    ? `${selected.sufficiencyStatus} · ${
                        selected.evidenceScore != null
                          ? `${selected.evidenceScore}%`
                          : 'UNMEAS.'
                      }`
                    : '—'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Recommendation</h3>
                <p>{selected?.recommendation ?? '—'}</p>
              </article>
              <article className={styles.insightCard}>
                <h3>Why</h3>
                <ul className={styles.bulletList}>
                  {(selected?.explainability ?? ['—']).slice(0, 6).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </aside>
      </section>
    </motion.main>
  );
}

function EvidenceTable({
  items,
  onSelect,
}: {
  items: EvidenceCandidate[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>Evidence evaluation table</h3>
        <table className={styles.auditTable}>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Evidence Score</th>
              <th>Sources</th>
              <th>Verified Claims</th>
              <th>Authority</th>
              <th>Recency</th>
              <th>Rights</th>
              <th>Confidence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} onClick={() => onSelect(item.id)}>
                <td>{item.title}</td>
                <td>
                  {item.evidenceScore != null ? `${item.evidenceScore}%` : 'UNMEAS.'}
                </td>
                <td>{item.sourcesAnalysed}</td>
                <td>{item.verifiedClaims}</td>
                <td>{measured(item.authorityScore)}</td>
                <td>{measured(item.recencyScore)}</td>
                <td>{measured(item.rightsScore)}</td>
                <td>
                  {item.measuredConfidence ? `${item.confidence}%` : 'UNMEAS.'}
                </td>
                <td>{item.sufficiencyStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length ? (
          <div className={styles.emptyInline}>
            <p>No evidence evaluations to display.</p>
          </div>
        ) : null}
      </article>
    </div>
  );
}
