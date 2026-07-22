'use client';

import type {
  FrameUpdateEvent,
  HistoryEvent,
  LockedAssetRef,
  ReadinessCheck,
  SceneVideoGenerator,
  TimelineClip,
  VideoException,
  WorkspaceTabId,
} from '../types';
import styles from '../video-assembly.module.css';

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
    { id: 'timeline', label: 'Timeline' },
    { id: 'readiness', label: 'Readiness' },
    { id: 'assets', label: 'Assets' },
    { id: 'events', label: 'Frame events' },
    { id: 'generators', label: 'Generators' },
    { id: 'exceptions', label: 'Exceptions' },
    { id: 'history', label: 'History' },
  ];

  return (
    <div className={styles.tabs} role="tablist" aria-label="Video assembly workspace">
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

export function ReadinessPanel({ checks, clips }: { checks: ReadinessCheck[]; clips: TimelineClip[] }) {
  if (!checks.length) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>No readiness evaluations</h3>
        <p>Video-readiness evaluator results will appear here when permanent AssetVersion and continuity checks are connected.</p>
      </div>
    );
  }

  const clipMap = new Map(clips.map((clip) => [clip.id, clip.shotCode]));

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Shot</th>
            <th>Check</th>
            <th>Result</th>
            <th>Severity</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.id}>
              <td>{clipMap.get(check.clipId) || check.clipId}</td>
              <td><strong>{check.code}</strong></td>
              <td>{check.passed ? 'Passed' : 'Failed'}</td>
              <td>{check.severity}</td>
              <td className={styles.wrapCellWide}>{check.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AssetsPanel({ assets }: { assets: LockedAssetRef[] }) {
  if (!assets.length) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>No locked assets</h3>
        <p>Permanent AssetVersion references for video handoff will list here after approval locks are connected.</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>AssetVersion</th>
            <th>Clip</th>
            <th>SHA</th>
            <th>Dimensions</th>
            <th>Permanent</th>
            <th>Video ready</th>
            <th>Locked</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td><strong>{asset.assetVersionId}</strong></td>
              <td>{asset.clipId}</td>
              <td>{asset.sha256Preview}</td>
              <td>{asset.width}×{asset.height}</td>
              <td>{asset.permanent ? 'Yes' : 'No'}</td>
              <td>{asset.videoReady ? 'Yes' : 'No'}</td>
              <td>{new Date(asset.lockedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FrameEventsPanel({ events }: { events: FrameUpdateEvent[] }) {
  if (!events.length) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>No frame update events</h3>
        <p>Storyboard frame update events that invalidate or refresh video readiness will stream here.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.historyList} ${styles.paddedList}`}>
      {events.map((event) => (
        <article key={event.id} className={styles.historyCard}>
          <header>
            <strong>{event.type.replaceAll('_', ' ')}</strong>
            <span className={styles.pill}>{event.shotCode}</span>
          </header>
          <p>{event.detail}</p>
          <p className={styles.actionHint}>
            {new Date(event.at).toLocaleString()}
            {event.correlationId ? ` · ${event.correlationId}` : ''}
          </p>
        </article>
      ))}
    </div>
  );
}

export function GeneratorsPanel({ generators }: { generators: SceneVideoGenerator[] }) {
  if (!generators.length) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>No generators registered</h3>
        <p>Scene Video Generator and Timeline contracts will appear here when provider adapters are connected.</p>
      </div>
    );
  }

  return (
    <div className={styles.generatorGrid}>
      {generators.map((generator) => (
        <article key={generator.id} className={styles.generatorCard}>
          <header>
            <strong>{generator.name}</strong>
            <span className={`${styles.pill} ${styles.pillReview}`}>{generator.status}</span>
          </header>
          <p><b>Contract:</b> {generator.contract}</p>
          <p className={styles.actionHint}>{generator.lastMessage}</p>
        </article>
      ))}
    </div>
  );
}

export function ExceptionsPanel({ exceptions }: { exceptions: VideoException[] }) {
  if (!exceptions.length) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>No exceptions</h3>
        <p>Human-exception cases that block safe video handoff will surface here.</p>
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

export function HistoryPanel({ history }: { history: HistoryEvent[] }) {
  if (!history.length) {
    return (
      <div className={styles.emptyState} role="status">
        <h3>No history</h3>
        <p>Audited video readiness and assembly events will list here once autonomy is persisted.</p>
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
