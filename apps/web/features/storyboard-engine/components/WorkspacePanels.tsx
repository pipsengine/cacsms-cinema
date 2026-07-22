'use client';

import type {
  AssetVersionRecord,
  ContinuityIssue,
  HistoryEvent,
  StoryboardException,
  WorkspaceTabId,
} from '../types';
import styles from '../storyboard-engine.module.css';

interface ContinuityPanelProps {
  issues: ContinuityIssue[];
}

function severityClass(severity: ContinuityIssue['severity']): string {
  if (severity === 'CRITICAL') return `${styles.pill} ${styles.severityCritical}`;
  if (severity === 'HIGH') return `${styles.pill} ${styles.severityHigh}`;
  if (severity === 'MEDIUM') return `${styles.pill} ${styles.severityMedium}`;
  return `${styles.pill} ${styles.severityLow}`;
}

export function ContinuityPanel({ issues }: ContinuityPanelProps) {
  if (!issues.length) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>No continuity issues</h3>
        <p>Continuity locks and violations will appear here when the storyboard continuity service is connected.</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Shot</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Description</th>
            <th>Recommended action</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td><strong>{issue.code}</strong></td>
              <td>{issue.shotId || '—'}</td>
              <td><span className={severityClass(issue.severity)}>{issue.severity}</span></td>
              <td>{issue.status}</td>
              <td className={styles.wrapCellWide}>{issue.description}</td>
              <td className={styles.wrapCell}>{issue.recommendedAction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExceptionsPanel({ exceptions }: { exceptions: StoryboardException[] }) {
  if (!exceptions.length) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>No exceptions</h3>
        <p>Human-exception cases that autonomy cannot safely resolve will surface here.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.exceptionList} ${styles.paddedList}`}>
      {exceptions.map((item) => (
        <article key={item.id} className={styles.exceptionCard}>
          <header>
            <strong>{item.title}</strong>
            <span className={`${styles.pill} ${styles.pillBlocked}`}>{item.status}</span>
          </header>
          <p>{item.detail}</p>
          <p className={styles.actionHint}>
            <b>Code:</b> {item.code} · <b>Raised:</b> {new Date(item.raisedAt).toLocaleString()}
          </p>
        </article>
      ))}
    </div>
  );
}

export function AssetsPanel({ assets }: { assets: AssetVersionRecord[] }) {
  if (!assets.length) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>No asset versions</h3>
        <p>Immutable AssetVersion lineage and video-readiness flags will appear after approval workflows are connected.</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Shot</th>
            <th>Version</th>
            <th>Status</th>
            <th>SHA preview</th>
            <th>Dimensions</th>
            <th>Video ready</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td><strong>{asset.id}</strong></td>
              <td>{asset.shotId}</td>
              <td>v{asset.version}</td>
              <td>{asset.status}</td>
              <td>{asset.sha256Preview}</td>
              <td>{asset.width}×{asset.height}</td>
              <td>{asset.videoReady ? 'Yes' : 'No'}</td>
              <td>{new Date(asset.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HistoryPanel({ history }: { history: HistoryEvent[] }) {
  if (!history.length) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>No history</h3>
        <p>Audited storyboard events will list here once autonomy and operator actions are persisted.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.historyList} ${styles.paddedList}`}>
      {history.map((event) => (
        <article key={event.id} className={styles.historyCard}>
          <header>
            <strong>{event.action}</strong>
            <span className={styles.pill}>{event.actor}</span>
          </header>
          <p>{event.detail}</p>
          <p className={styles.actionHint}>{new Date(event.at).toLocaleString()}</p>
        </article>
      ))}
    </div>
  );
}

export function CinematographyOverview({ notes }: { notes: string[] }) {
  if (!notes.length) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>No cinematography plan</h3>
        <p>Shot decomposition and cinematography planner output will appear here when available.</p>
      </div>
    );
  }

  return (
    <div className={styles.detailSection}>
      <h3>Sequence cinematography policy</h3>
      <ul className={styles.noteList}>
        {notes.map((note) => <li key={note}>{note}</li>)}
      </ul>
    </div>
  );
}

export function WorkspaceTabs({
  tab,
  onChange,
  counts,
}: {
  tab: WorkspaceTabId;
  onChange: (tab: WorkspaceTabId) => void;
  counts: Partial<Record<WorkspaceTabId, number>>;
}) {
  const items: Array<{ id: WorkspaceTabId; label: string }> = [
    { id: 'board', label: 'Shot board' },
    { id: 'continuity', label: 'Continuity' },
    { id: 'cinematography', label: 'Cinematography' },
    { id: 'assets', label: 'Assets' },
    { id: 'exceptions', label: 'Exceptions' },
    { id: 'history', label: 'History' },
  ];

  return (
    <div className={styles.tabs} role="tablist" aria-label="Storyboard workspace">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          className={tab === item.id ? styles.activeTab : undefined}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {typeof counts[item.id] === 'number' ? <b>{counts[item.id]}</b> : null}
        </button>
      ))}
    </div>
  );
}
