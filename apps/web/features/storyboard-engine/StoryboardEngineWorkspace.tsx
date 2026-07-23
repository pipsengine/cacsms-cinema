'use client';

import { useMemo, useState } from 'react';
import { Info, LayoutGrid } from 'lucide-react';
import { PipelineTimeline } from './components/PipelineTimeline';
import { ShotBoard } from './components/ShotBoard';
import { ShotDetailPanel } from './components/ShotDetailPanel';
import { StoryboardHeader } from './components/StoryboardHeader';
import { SummaryMetrics } from './components/SummaryMetrics';
import {
  AssetsPanel,
  CinematographyOverview,
  ContinuityPanel,
  ExceptionsPanel,
  HistoryPanel,
  WorkspaceTabs,
} from './components/WorkspacePanels';
import { STORYBOARD_EMPTY_MODEL, STORYBOARD_PRESENTATION_FIXTURES } from './sample-data';
import type { DataProvenance, WorkspaceTabId } from './types';
import styles from './storyboard-engine.module.css';

/**
 * Storyboard Engine workspace (frontend presentation).
 * Swap `model` source for live API payloads when storyboard backends exist.
 */
export function StoryboardEngineWorkspace() {
  const [provenance, setProvenance] = useState<DataProvenance>('presentation');
  const [tab, setTab] = useState<WorkspaceTabId>('board');
  const [selectedShotId, setSelectedShotId] = useState<string | null>(
    STORYBOARD_PRESENTATION_FIXTURES.shots[0]?.id ?? null,
  );
  const [toast, setToast] = useState<string | null>(null);

  const model = provenance === 'empty' ? STORYBOARD_EMPTY_MODEL : STORYBOARD_PRESENTATION_FIXTURES;

  const selectedShot = useMemo(
    () => model.shots.find((shot) => shot.id === selectedShotId) || model.shots[0] || null,
    [model.shots, selectedShotId],
  );

  function showPresentation() {
    setProvenance('presentation');
    setSelectedShotId(STORYBOARD_PRESENTATION_FIXTURES.shots[0]?.id ?? null);
    setTab('board');
    setToast(null);
  }

  function showEmpty() {
    setProvenance('empty');
    setSelectedShotId(null);
    setTab('board');
    setToast(null);
  }

  return (
    <div className={styles.content}>
      <StoryboardHeader
        description="Persisted shots, cinematography, continuity, quality evidence, and immutable asset lineage for downstream video readiness."
        provenance={provenance}
        onShowPresentation={showPresentation}
        onShowEmpty={showEmpty}
      />

      {provenance === 'presentation' ? (
        <aside className={styles.banner} role="note">
          <div className={styles.bannerIcon}>
            <Info size={16} aria-hidden />
          </div>
          <div>
            <strong>Presentation layout — not live production data</strong>
            Sample shots and issues illustrate hierarchy only. They are not backend results and will be
            replaced by persisted storyboard APIs without redesigning this workspace.
          </div>
        </aside>
      ) : null}

      <p className={styles.observeNote}>
        Observe-only. Start or stop the entire system from the Control Room or top bar.
      </p>
      <SummaryMetrics summary={model.summary} />
      <PipelineTimeline stages={model.pipeline} />

      <WorkspaceTabs
        tab={tab}
        onChange={setTab}
        counts={{
          board: model.shots.length || undefined,
          continuity: model.continuityIssues.length || undefined,
          assets: model.assets.length || undefined,
          exceptions: model.exceptions.length || undefined,
          history: model.history.length || undefined,
        }}
      />

      {tab === 'board' ? (
        <div className={styles.workspace}>
          <section className={styles.panel} aria-label="Shot board">
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitleWithIcon}>
                  <LayoutGrid size={14} aria-hidden />
                  Shot board
                </h2>
                <small>
                  {model.summary.scriptTitle
                    ? `Linked script: ${model.summary.scriptTitle}`
                    : 'No linked script'}
                </small>
              </div>
            </div>
            <ShotBoard
              shots={model.shots}
              selectedShotId={selectedShot?.id ?? null}
              onSelect={setSelectedShotId}
            />
          </section>
          <aside className={styles.panel} aria-label="Shot detail">
            <div className={styles.panelHead}>
              <div>
                <h2>Inspection</h2>
                <small>Continuity, cinematography, and exceptions</small>
              </div>
            </div>
            <ShotDetailPanel
              shot={selectedShot}
              continuityIssues={model.continuityIssues}
              exceptions={model.exceptions}
              cinematographyNotes={model.cinematographyNotes}
            />
          </aside>
        </div>
      ) : null}

      {tab === 'continuity' ? (
        <section className={styles.panel} aria-label="Continuity">
          <div className={styles.panelHead}>
            <div>
              <h2>Continuity locks &amp; violations</h2>
              <small>Identity, wardrobe, geography, and temporal consistency</small>
            </div>
          </div>
          <ContinuityPanel issues={model.continuityIssues} />
        </section>
      ) : null}

      {tab === 'cinematography' ? (
        <section className={styles.panel} aria-label="Cinematography">
          <div className={styles.panelHead}>
            <div>
              <h2>Cinematography planner</h2>
              <small>Sequence-level policy applied during shot decomposition</small>
            </div>
          </div>
          <CinematographyOverview notes={model.cinematographyNotes} />
        </section>
      ) : null}

      {tab === 'assets' ? (
        <section className={styles.panel} aria-label="Assets">
          <div className={styles.panelHead}>
            <div>
              <h2>Asset version lineage</h2>
              <small>Immutable versions and video-readiness handoff</small>
            </div>
          </div>
          <AssetsPanel assets={model.assets} />
        </section>
      ) : null}

      {tab === 'exceptions' ? (
        <section className={styles.panel} aria-label="Exceptions">
          <div className={styles.panelHead}>
            <div>
              <h2>Human exceptions</h2>
              <small>Cases autonomy cannot resolve safely</small>
            </div>
          </div>
          <ExceptionsPanel exceptions={model.exceptions} />
        </section>
      ) : null}

      {tab === 'history' ? (
        <section className={styles.panel} aria-label="History">
          <div className={styles.panelHead}>
            <div>
              <h2>History &amp; audit trail</h2>
              <small>Operator and system events</small>
            </div>
          </div>
          <HistoryPanel history={model.history} />
        </section>
      ) : null}

      {toast ? (
        <div className={`${styles.toast} ${styles.toastWarn}`} role="status">
          {toast}
          <button type="button" className={`${styles.ghostBtn} ${styles.toastDismiss}`} onClick={() => setToast(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
