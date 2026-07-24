'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Copyright,
  Download,
  Gavel,
  Globe2,
  Lock,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
  XCircle,
} from 'lucide-react';
import type {
  RiskCandidate,
  RiskSensitivityOverview,
} from '@/lib/idea-qualification/risk';
import { qualificationApi } from '@/apps/web/lib/qualification-api';
import styles from './risk-sensitivity.module.css';

type TabId =
  | 'overview'
  | 'table'
  | 'score'
  | 'dimensions'
  | 'legal'
  | 'ethical'
  | 'cultural'
  | 'privacy'
  | 'platforms'
  | 'copyright'
  | 'misinfo'
  | 'reputation'
  | 'security'
  | 'heatmap'
  | 'findings'
  | 'mitigations'
  | 'escalation'
  | 'predictive'
  | 'explain'
  | 'recommendations'
  | 'governance'
  | 'analytics'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'table', label: 'Evaluation Table' },
  { id: 'score', label: 'Risk Score' },
  { id: 'dimensions', label: 'Dimensions' },
  { id: 'legal', label: 'Legal' },
  { id: 'ethical', label: 'Ethical' },
  { id: 'cultural', label: 'Cultural' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'platforms', label: 'Platforms' },
  { id: 'copyright', label: 'Copyright' },
  { id: 'misinfo', label: 'Misinformation' },
  { id: 'reputation', label: 'Reputation' },
  { id: 'security', label: 'Security' },
  { id: 'heatmap', label: 'Heat Map' },
  { id: 'findings', label: 'Findings' },
  { id: 'mitigations', label: 'Mitigations' },
  { id: 'escalation', label: 'Escalation' },
  { id: 'predictive', label: 'Predictive' },
  { id: 'explain', label: 'Explainability' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'governance', label: 'Governance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit' },
];

const EMPTY_COPY =
  'The Risk & Sensitivity Engine automatically evaluates every qualified documentary idea for legal, ethical, cultural, political, privacy, security, copyright, and platform-compliance risks. Using enterprise governance rules, explainable AI, policy intelligence, and predictive risk analytics, the engine assigns an Overall Risk Score, identifies potential issues, recommends mitigation strategies, and determines whether additional legal or executive review is required. As production progresses, risk assessments are continuously updated, ensuring that only compliant, responsible, and publication-ready content advances through the production lifecycle.';

function statusTone(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'LOW':
    case 'PROCEED':
    case 'ALLOWED':
    case 'CLEAR':
    case 'RUNNING':
      return styles.toneReady;
    case 'HIGH':
    case 'CRITICAL':
    case 'REJECT':
    case 'PROHIBITED':
    case 'BLOCKING':
      return styles.toneBlocked;
    case 'MEDIUM':
    case 'REVISE':
    case 'ESCALATE':
    case 'RESTRICTED':
    case 'REQUIRES REVIEW':
    case 'WARNING':
    case 'PENDING':
    case 'UNMEASURED':
    case 'AWAIT SCORING':
    case 'OBSERVE_ONLY':
    case 'EVALUATED':
    case 'SCORED':
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

function exportPayload(overview: RiskSensitivityOverview, format: 'json' | 'csv') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `risk-sensitivity-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const header = [
    'id',
    'title',
    'overallRisk',
    'legal',
    'ethical',
    'copyright',
    'privacy',
    'band',
    'recommendation',
  ];
  const lines = [
    header.join(','),
    ...overview.candidates.map((item) =>
      [
        item.id,
        JSON.stringify(item.title),
        item.overallRiskScore ?? '',
        item.legalRisk ?? '',
        item.ethicalRisk ?? '',
        item.copyrightRisk ?? '',
        item.privacyRisk ?? '',
        item.riskBand,
        item.recommendation,
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `risk-sensitivity-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RiskSensitivityWorkspace() {
  const reduceMotion = useReducedMotion();
  const [overview, setOverview] = useState<RiskSensitivityOverview | null>(null);
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
        qualificationApi.risk(),
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
    () => [...new Set(candidates.map((item) => item.riskBand))].sort(),
    [candidates],
  );

  const filtered = useMemo(
    () =>
      candidates.filter((item) => {
        if (statusFilter !== 'all' && item.riskBand !== statusFilter) return false;
        if (!needle) return true;
        const haystack = [
          item.title,
          item.domain,
          item.riskBand,
          item.recommendation,
          item.geography,
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

  const kpis = useMemo(() => {
    const m = metrics;
    return [
      {
        label: 'Overall Risk Score',
        value: m?.overallRiskScore != null ? `${m.overallRiskScore}%` : 'UNMEAS.',
        meta: 'Avg risk / risk factor',
        accent: '#EF4444',
        icon: ShieldAlert,
        bars: sparkBars(m?.overallRiskScore ?? 0),
        drill: 'score' as TabId,
      },
      {
        label: 'Legal Risk',
        value: m?.legalRisk != null ? `${m.legalRisk}%` : 'UNMEAS.',
        meta: 'Legal category assessments',
        accent: '#F97316',
        icon: Gavel,
        bars: sparkBars(m?.legalRisk ?? 0),
        drill: 'legal' as TabId,
      },
      {
        label: 'Ethical Risk',
        value: m?.ethicalRisk != null ? `${m.ethicalRisk}%` : 'UNMEAS.',
        meta: 'Ethics category assessments',
        accent: '#7C3AED',
        icon: Scale,
        bars: sparkBars(m?.ethicalRisk ?? 0),
        drill: 'ethical' as TabId,
      },
      {
        label: 'Copyright Risk',
        value: m?.copyrightRisk != null ? `${m.copyrightRisk}%` : 'UNMEAS.',
        meta: 'Copyright / IP assessments',
        accent: '#F59E0B',
        icon: Copyright,
        bars: sparkBars(m?.copyrightRisk ?? 0),
        drill: 'copyright' as TabId,
      },
      {
        label: 'Privacy Risk',
        value: m?.privacyRisk != null ? `${m.privacyRisk}%` : 'UNMEAS.',
        meta: 'Privacy / PII assessments',
        accent: '#0EA5E9',
        icon: Lock,
        bars: sparkBars(m?.privacyRisk ?? 0),
        drill: 'privacy' as TabId,
      },
      {
        label: 'Cultural Sensitivity',
        value: m?.culturalSensitivity != null ? `${m.culturalSensitivity}%` : 'UNMEAS.',
        meta: 'Cultural / regional sensitivity',
        accent: '#14B8A6',
        icon: Globe2,
        bars: sparkBars(m?.culturalSensitivity ?? 0),
        drill: 'cultural' as TabId,
      },
      {
        label: 'Political Sensitivity',
        value: m?.politicalSensitivity != null ? `${m.politicalSensitivity}%` : 'UNMEAS.',
        meta: 'Political / regulatory risk',
        accent: '#EF4444',
        icon: AlertTriangle,
        bars: sparkBars(m?.politicalSensitivity ?? 0),
        drill: 'dimensions' as TabId,
      },
      {
        label: 'Platform Compliance',
        value: m?.platformCompliance != null ? `${m.platformCompliance}%` : 'UNMEAS.',
        meta: 'Platform policy risk',
        accent: '#2563EB',
        icon: ShieldCheck,
        bars: sparkBars(m?.platformCompliance ?? 0),
        drill: 'platforms' as TabId,
      },
      {
        label: 'Security Risk',
        value: m?.securityRisk != null ? `${m.securityRisk}%` : 'UNMEAS.',
        meta: 'Security assessments',
        accent: '#F97316',
        icon: Lock,
        bars: sparkBars(m?.securityRisk ?? 0),
        drill: 'security' as TabId,
      },
      {
        label: 'AI Confidence',
        value: m?.aiConfidence != null ? String(m.aiConfidence) : 'UNMEAS.',
        meta: 'Measured candidate confidence',
        accent: '#22C55E',
        icon: CheckCircle2,
        bars: sparkBars(m?.aiConfidence ?? 0),
        drill: 'governance' as TabId,
      },
      {
        label: 'Overall Recommendation',
        value: m?.proceedRate != null ? `${m.proceedRate}%` : 'UNMEAS.',
        meta: 'Proceed rate',
        accent: '#2563EB',
        icon: Sparkles,
        bars: sparkBars(m?.proceedRate ?? 0),
        drill: 'recommendations' as TabId,
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

  if (!overview?.available) {
    return (
      <main className={styles.page}>
        <p className={styles.crumb}>Idea Qualification / Risk & Sensitivity</p>
        <h1 className={styles.title}>Enterprise Risk Intelligence Centre</h1>
        <section className={styles.unavailable}>
          <AlertTriangle size={18} aria-hidden />
          <div>
            <strong>Risk & Sensitivity unavailable</strong>
            <p>{overview?.reason || error || 'Unable to load risk ledger.'}</p>
          </div>
          <button type="button" className={styles.chip} onClick={() => void load()}>
            Retry
          </button>
        </section>
      </main>
    );
  }

  const showEmpty = !candidates.length;
  const showWaiting =
    !overview.meta.intakeStatus && overview.meta.cycleStatus === 'NOT_STARTED' && showEmpty;

  const poolOnlyTabs: TabId[] = [
    'table',
    'recommendations',
    'governance',
    'analytics',
    'audit',
  ];

  return (
    <motion.main className={styles.page} {...motionProps}>
      <header className={styles.titleRow}>
        <div>
          <p className={styles.crumb}>
            Content Lifecycle / 03 Idea Qualification / Risk & Sensitivity
          </p>
          <h1 className={styles.title}>Enterprise Risk Intelligence Centre</h1>
          <p className={styles.lede}>
            Evaluate factual, legal, ethical, cultural, privacy, and platform risks before Research
            &amp; Evidence.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.toneDraft}`}>Stage 03 Risk</span>
          <span className={`${styles.badge} ${statusTone(overview?.meta.cycleStatus)}`}>
            Cycle {overview?.meta.cycleStatus ?? 'IDLE'}
          </span>
          <span className={`${styles.badge} ${styles.toneDraft}`}>
            Blocking {overview?.metrics.blockingFindings ?? 0}
          </span>
          <span className={`${styles.badge} ${statusTone(systemState)}`}>{systemState}</span>
        </div>
      </header>

      <div className={styles.infoNotice} role="status">
        <Sparkles size={16} aria-hidden />
        <div>
          <strong>Observation only · autonomous risk governance</strong>
          Findings come from persisted <code>iq_risk_assessments</code> and the{' '}
          <code>risk</code> score factor. Escalation routing is observe-only — Legal / Compliance /
          Editorial Board actions are not executed from this page. Predictive incident rates stay
          UNMEASURED until those models write payloads.
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

      <section className={`${styles.kpiGrid} ${styles.kpiGridDense}`} aria-label="Risk KPIs">
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

      <section className={styles.lifecycle} aria-label="Risk pipeline">
        <div className={styles.lifecycleHead}>
          <h2>Risk & sensitivity workflow</h2>
          <span>
            Legal → Ethical → Privacy → Platform → Security → Mitigation → Score → Proceed / Revise /
            Escalate / Reject
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
            <strong>Waiting for qualified candidates</strong>
            Risk scoring starts after Stage 03 candidates receive persisted risk assessments or risk
            factor scores.
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <section className={styles.emptyHero} role="status">
          <div>
            <h2>{EMPTY_COPY}</h2>
            <p className={styles.lede}>
              Qualified Idea → Legal → Ethical → Privacy → Platform → Security → Mitigation → Overall
              Risk Score → Proceed / Revise / Escalate / Reject.
            </p>
          </div>
          <ul className={styles.emptySteps}>
            <li>
              <strong>1. Assess</strong>
              Legal &amp; ethical
            </li>
            <li>
              <strong>2. Protect</strong>
              Privacy &amp; security
            </li>
            <li>
              <strong>3. Mitigate</strong>
              Policy &amp; remediation
            </li>
            <li>
              <strong>4. Decide</strong>
              Risk gate
            </li>
          </ul>
        </section>
      ) : null}

      <section className={styles.workspace} aria-label="Risk workspace">
        <aside className={styles.panel} aria-label="Risk Explorer">
          <div className={styles.panelHead}>
            <h2>Risk Explorer</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className={styles.tabBody}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Candidate, domain, band, recommendation…"
              />
            </label>
            <label className={styles.field}>
              <span>Risk band</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All bands</option>
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
                        risk {item.overallRiskScore ?? '—'} · {item.recommendation}
                      </span>
                      <span className={styles.explorerBadges}>
                        <span className={`${styles.chip} ${statusTone(item.riskBand)}`}>
                          {item.riskBand}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.center}`} aria-label="Risk detail">
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
            {tab === 'overview' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Candidate overview</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Title</dt>
                      <dd>{selected.title}</dd>
                    </div>
                    <div>
                      <dt>Domain</dt>
                      <dd>{selected.domain}</dd>
                    </div>
                    <div>
                      <dt>Overall risk</dt>
                      <dd>
                        {selected.overallRiskScore != null
                          ? `${selected.overallRiskScore}%`
                          : 'UNMEASURED'}
                      </dd>
                    </div>
                    <div>
                      <dt>Band</dt>
                      <dd>
                        <span className={`${styles.chip} ${statusTone(selected.riskBand)}`}>
                          {selected.riskBand}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Recommendation</dt>
                      <dd>
                        <span className={`${styles.chip} ${statusTone(selected.recommendation)}`}>
                          {selected.recommendation}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>AI summary</h3>
                  <p>{selected.aiSummary}</p>
                  <ul className={styles.bulletList}>
                    {selected.explainability.slice(0, 6).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Pool snapshot</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Total</dt>
                      <dd>{metrics?.totalCandidates ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Low risk</dt>
                      <dd>{metrics?.lowRiskCount ?? 0}</dd>
                    </div>
                    <div>
                      <dt>High / critical</dt>
                      <dd>{metrics?.highRiskCount ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Escalate / Reject</dt>
                      <dd>
                        {metrics?.escalateCount ?? 0} / {metrics?.rejectCount ?? 0}
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            ) : null}

            {tab === 'table' ? (
              <EvaluationTable items={filtered} onSelect={setSelectedId} />
            ) : null}

            {tab === 'score' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    Overall Risk{' '}
                    {selected.overallRiskScore != null
                      ? `${selected.overallRiskScore}%`
                      : 'UNMEASURED'}{' '}
                    <span className={`${styles.chip} ${statusTone(selected.riskBand)}`}>
                      {selected.riskBand} RISK
                    </span>
                  </h3>
                  <p className={styles.lede}>
                    AI Confidence:{' '}
                    {selected.measuredConfidence
                      ? measured(selected.confidence)
                      : 'UNMEASURED'}
                  </p>
                  <div className={styles.waterfall}>
                    {[
                      ['Legal', selected.legalRisk],
                      ['Ethical', selected.ethicalRisk],
                      ['Copyright', selected.copyrightRisk],
                      ['Privacy', selected.privacyRisk],
                      ['Cultural', selected.culturalSensitivity],
                      ['Political', selected.politicalSensitivity],
                      ['Platform', selected.platformCompliance],
                      ['Security', selected.securityRisk],
                    ].map(([label, value]) => (
                      <div key={String(label)} className={styles.waterfallRow}>
                        <span>{label}</span>
                        <div className={styles.radarBar}>
                          <i
                            className={styles.radarFill}
                            style={{
                              width: `${Math.max(0, Math.min(100, Number(value) || 0))}%`,
                            }}
                          />
                        </div>
                        <strong>{value != null ? `${value}%` : 'UNMEAS.'}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === 'dimensions' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Multi-dimensional risk assessment</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Dimension</th>
                        <th>Score</th>
                        <th>Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.dimensions.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{row.score ?? 'UNMEASURED'}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(row.level)}`}>
                              {row.level}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'legal' && selected ? (
              <SignalList title="Legal compliance engine" items={selected.legal} />
            ) : null}

            {tab === 'ethical' && selected ? (
              <SignalList title="Ethical review engine" items={selected.ethical} />
            ) : null}

            {tab === 'cultural' && selected ? (
              <SignalList title="Cultural sensitivity analysis" items={selected.cultural} />
            ) : null}

            {tab === 'privacy' && selected ? (
              <SignalList title="Privacy assessment" items={selected.privacy} />
            ) : null}

            {tab === 'platforms' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Platform policy compliance</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Platform</th>
                        <th>Status</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.platforms.map((row) => (
                        <tr key={row.platform}>
                          <td>{row.platform}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                          <td>{row.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'copyright' && selected ? (
              <SignalList title="Copyright intelligence" items={selected.copyright} />
            ) : null}

            {tab === 'misinfo' && selected ? (
              <MetricBars title="Misinformation & fact risk" rows={selected.misinformation} />
            ) : null}

            {tab === 'reputation' && selected ? (
              <SignalList title="Reputational risk analysis" items={selected.reputational} />
            ) : null}

            {tab === 'security' && selected ? (
              <SignalList title="Security assessment" items={selected.security} />
            ) : null}

            {tab === 'heatmap' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Risk heat map</h3>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Risk area</th>
                        <th>Level</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.heatMap.map((row) => (
                        <tr key={row.area}>
                          <td>{row.area}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(row.level)}`}>
                              {row.level}
                            </span>
                          </td>
                          <td>{row.score ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'findings' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Explainable risk findings</h3>
                  {!selected.findings.length ? (
                    <p className={styles.lede}>No iq_risk_assessments persisted for this candidate.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Severity</th>
                          <th>Score</th>
                          <th>Blocking</th>
                          <th>Reason</th>
                          <th>Policy</th>
                          <th>Mitigation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.findings.map((row) => (
                          <tr key={row.id}>
                            <td>{row.category}</td>
                            <td>
                              <span className={`${styles.chip} ${statusTone(row.severity)}`}>
                                {row.severity}
                              </span>
                            </td>
                            <td>{row.riskScore}</td>
                            <td>{row.blocking ? 'Yes' : 'No'}</td>
                            <td>{row.reason}</td>
                            <td>{display(row.policy)}</td>
                            <td>{display(row.mitigation)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'mitigations' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>AI mitigation recommendations</h3>
                  <ul className={styles.bulletList}>
                    {selected.mitigations.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'escalation' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Escalation workflow</h3>
                  <p className={styles.lede}>
                    Routes are observe-only. Stage pages do not create human review tickets.
                  </p>
                  <table className={styles.auditTable}>
                    <thead>
                      <tr>
                        <th>Route</th>
                        <th>Reason</th>
                        <th>Priority</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.escalations.map((row) => (
                        <tr key={`${row.route}-${row.reason}`}>
                          <td>{row.route}</td>
                          <td>{row.reason}</td>
                          <td>
                            <span className={`${styles.chip} ${statusTone(row.priority)}`}>
                              {row.priority}
                            </span>
                          </td>
                          <td>{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              </div>
            ) : null}

            {tab === 'predictive' && selected ? (
              <MetricBars title="Predictive risk intelligence" rows={selected.predictive} />
            ) : null}

            {tab === 'explain' && selected ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>
                    Recommendation <strong>{selected.recommendation}</strong>
                  </h3>
                  <ul className={styles.bulletList}>
                    {selected.explainability.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className={styles.lede}>
                    Confidence:{' '}
                    {selected.measuredConfidence
                      ? measured(selected.confidence)
                      : 'UNMEASURED'}
                  </p>
                </article>
                <article className={styles.detailCard}>
                  <h3>Lifecycle</h3>
                  <ul className={styles.timeline}>
                    {selected.lifecycle.map((step) => (
                      <li key={step.key}>
                        <CircleDot size={14} aria-hidden />
                        <div>
                          <strong>{step.label}</strong>
                          <span>
                            {step.done ? 'Complete' : 'Pending'}
                            {step.at ? ` · ${new Date(step.at).toLocaleString()}` : ''}
                          </span>
                        </div>
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
                  {(overview?.recommendations.length ?? 0) === 0 ? (
                    <p className={styles.lede}>No recommendations until candidates are scored.</p>
                  ) : (
                    <table className={styles.auditTable}>
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Reason</th>
                          <th>Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview?.recommendations.map((item) => (
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
                  )}
                </article>
              </div>
            ) : null}

            {tab === 'governance' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Governance & audit</h3>
                  <dl className={styles.kv}>
                    <div>
                      <dt>Model versions</dt>
                      <dd>
                        {overview?.governance.modelVersions.length
                          ? overview.governance.modelVersions.join(', ')
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Risk assessments</dt>
                      <dd>{overview?.governance.riskAssessments ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Decisions logged</dt>
                      <dd>{overview?.governance.decisionsLogged ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Audit events</dt>
                      <dd>{overview?.governance.auditEvents ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Data sources</dt>
                      <dd>
                        iq_candidates · iq_scores · iq_risk_assessments · iq_evidence_checks ·
                        iq_audit_events
                      </dd>
                    </div>
                    {selected ? (
                      <div>
                        <dt>Candidate model</dt>
                        <dd>{display(selected.modelVersion)}</dd>
                      </div>
                    ) : null}
                  </dl>
                </article>
                <article className={styles.detailCard}>
                  <h3>Continuous learning</h3>
                  <p className={styles.lede}>
                    Predicted vs actual legal challenges, platform rejections, copyright claims, and
                    audience complaints remain UNMEASURED until post-publication outcomes are
                    persisted.
                  </p>
                </article>
              </div>
            ) : null}

            {tab === 'analytics' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard}>
                  <h3>Risk band distribution</h3>
                  <ul className={styles.bulletList}>
                    {overview?.analytics.bandDistribution.map((row) => (
                      <li key={row.label}>
                        {row.label}: {row.count}
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Recommendation mix</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.analytics.recommendationDistribution.length ?? 0) === 0 ? (
                      <li>No recommendations yet.</li>
                    ) : (
                      overview?.analytics.recommendationDistribution.map((row) => (
                        <li key={row.label}>
                          {row.label}: {row.count}
                        </li>
                      ))
                    )}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Severity distribution</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.analytics.severityDistribution.length ?? 0) === 0 ? (
                      <li>No severity records yet.</li>
                    ) : (
                      overview?.analytics.severityDistribution.map((row) => (
                        <li key={row.label}>
                          {row.label}: {row.count}
                        </li>
                      ))
                    )}
                  </ul>
                </article>
                <article className={styles.detailCard}>
                  <h3>Category exposure</h3>
                  <ul className={styles.bulletList}>
                    {(overview?.categoryDistribution.length ?? 0) === 0 ? (
                      <li>No category assessments yet.</li>
                    ) : (
                      overview?.categoryDistribution.slice(0, 12).map((row) => (
                        <li key={row.label}>
                          {row.label}: avg {row.avgScore ?? 'UNMEAS.'} ({row.count})
                        </li>
                      ))
                    )}
                  </ul>
                </article>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className={styles.detailGrid}>
                <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                  <h3>Risk audit ledger</h3>
                  {(overview?.audit.length ?? 0) === 0 ? (
                    <p className={styles.lede}>No risk-related audit events persisted yet.</p>
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
                        {overview?.audit.map((row) => (
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

            {!selected && !poolOnlyTabs.includes(tab) ? (
              <div className={styles.emptyInline}>
                <BrainCircuit size={18} aria-hidden />
                <p>Select a candidate to inspect risk & sensitivity detail.</p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.insights}`} aria-label="AI Insights">
          <div className={styles.panelHead}>
            <h2>AI Insights</h2>
            <span>Observe only</span>
          </div>
          <div className={styles.tabBody}>
            <div className={styles.insightStack}>
              <article className={styles.insightCard}>
                <h3>Engine posture</h3>
                <p>
                  {metrics?.overallRiskScore != null
                    ? `Pool average overall risk ${metrics.overallRiskScore}%.`
                    : 'Awaiting risk assessments / risk factor writes.'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Selected signal</h3>
                <p>
                  {selected
                    ? `${selected.title} · ${selected.recommendation}`
                    : 'No candidate selected.'}
                </p>
              </article>
              <article className={styles.insightCard}>
                <h3>Notifications</h3>
                {(overview?.notifications.length ?? 0) === 0 ? (
                  <p>No risk alerts.</p>
                ) : (
                  <ul className={styles.bulletList}>
                    {overview?.notifications.slice(0, 6).map((note) => (
                      <li key={note.id}>
                        <span className={`${styles.chip} ${statusTone(note.severity)}`}>
                          {note.severity}
                        </span>{' '}
                        {note.message}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
              <article className={styles.insightCard}>
                <h3>
                  <CheckCircle2 size={14} aria-hidden /> Gate posture
                </h3>
                <p>
                  Low {metrics?.lowRiskCount ?? 0} · High {metrics?.highRiskCount ?? 0} · Escalate{' '}
                  {metrics?.escalateCount ?? 0}
                </p>
              </article>
              {(metrics?.blockingFindings ?? 0) > 0 ? (
                <article className={styles.insightCard}>
                  <h3>
                    <XCircle size={14} aria-hidden /> Blocking pressure
                  </h3>
                  <p>{metrics?.blockingFindings} blocking risk findings across the pool.</p>
                </article>
              ) : null}
            </div>
          </div>
        </aside>
      </section>
    </motion.main>
  );
}

function MetricBars({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: number | null }>;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>{title}</h3>
        <div className={styles.waterfall}>
          {rows.map((row) => (
            <div key={row.label} className={styles.waterfallRow}>
              <span>{row.label}</span>
              <div className={styles.radarBar}>
                <i
                  className={styles.radarFill}
                  style={{ width: `${Math.max(0, Math.min(100, row.value ?? 0))}%` }}
                />
              </div>
              <strong>{row.value != null ? `${row.value}%` : 'UNMEAS.'}</strong>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function SignalList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; status: string; detail: string }>;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>{title}</h3>
        <ul className={styles.bulletList}>
          {items.map((item) => (
            <li key={item.label}>
              <span className={`${styles.chip} ${statusTone(item.status)}`}>{item.status}</span>{' '}
              <strong>{item.label}</strong> — {item.detail}
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}

function EvaluationTable({
  items,
  onSelect,
}: {
  items: RiskCandidate[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.detailGrid}>
      <article className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
        <h3>Risk & sensitivity evaluation</h3>
        <table className={styles.auditTable}>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Overall</th>
              <th>Legal</th>
              <th>Ethical</th>
              <th>Copyright</th>
              <th>Privacy</th>
              <th>Band</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {!items.length ? (
              <tr>
                <td colSpan={8}>
                  <div className={styles.emptyInline}>
                    <p>No candidates in the risk ledger.</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} onClick={() => onSelect(item.id)}>
                  <td>{item.title}</td>
                  <td>{item.overallRiskScore ?? '—'}</td>
                  <td>{item.legalRisk ?? '—'}</td>
                  <td>{item.ethicalRisk ?? '—'}</td>
                  <td>{item.copyrightRisk ?? '—'}</td>
                  <td>{item.privacyRisk ?? '—'}</td>
                  <td>{item.riskBand}</td>
                  <td>{item.recommendation}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </article>
    </div>
  );
}
