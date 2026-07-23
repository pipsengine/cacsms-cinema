'use client';

import { useMemo, useState } from 'react';
import { Film, Info } from 'lucide-react';
import { PipelineTimeline } from './components/PipelineTimeline';
import { SummaryMetrics } from './components/SummaryMetrics';
import { ClipDetailPanel, TimelineBoard } from './components/TimelineBoard';
import { VideoHeader } from './components/VideoHeader';
import {
  AssetsPanel,
  ExceptionsPanel,
  FrameEventsPanel,
  GeneratorsPanel,
  HistoryPanel,
  ReadinessPanel,
  WorkspaceTabs,
} from './components/WorkspacePanels';
import { VIDEO_EMPTY_MODEL, VIDEO_PRESENTATION_FIXTURES } from './sample-data';
import type { DataProvenance, WorkspaceTabId } from './types';
import styles from './video-assembly.module.css';

/**
 * Image-to-Video Readiness / Video Assembly workspace (frontend presentation).
 * Swap model source for live API payloads when video backends exist.
 */
export function VideoAssemblyWorkspace() {
  const [provenance, setProvenance] = useState<DataProvenance>('presentation');
  const [tab, setTab] = useState<WorkspaceTabId>('timeline');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(
    VIDEO_PRESENTATION_FIXTURES.clips[0]?.id ?? null,
  );
  const [toast, setToast] = useState<string | null>(null);

  const model = provenance === 'empty' ? VIDEO_EMPTY_MODEL : VIDEO_PRESENTATION_FIXTURES;

  const selectedClip = useMemo(
    () => model.clips.find((clip) => clip.id === selectedClipId) || model.clips[0] || null,
    [model.clips, selectedClipId],
  );

  function showPresentation() {
    setProvenance('presentation');
    setSelectedClipId(VIDEO_PRESENTATION_FIXTURES.clips[0]?.id ?? null);
    setTab('timeline');
    setToast(null);
  }

  function showEmpty() {
    setProvenance('empty');
    setSelectedClipId(null);
    setTab('timeline');
    setToast(null);
  }

  const title =
    provenance === 'presentation' && model.summary.title
      ? model.summary.title
      : 'Image-to-Video Readiness';

  return (
    <div className={styles.content}>
      <VideoHeader
        title={title}
        description="Validated delivery of approved, continuity-safe image inputs to the video pipeline."
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
            Sample clips and readiness checks illustrate hierarchy only. They are not backend results and will be
            replaced by persisted video APIs without redesigning this workspace.
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
          timeline: model.clips.length || undefined,
          readiness: model.readinessChecks.length || undefined,
          assets: model.assets.length || undefined,
          events: model.frameEvents.length || undefined,
          generators: model.generators.length || undefined,
          exceptions: model.exceptions.length || undefined,
          history: model.history.length || undefined,
        }}
      />

      {tab === 'timeline' ? (
        <div className={styles.workspace}>
          <section className={styles.panel} aria-label="Video timeline">
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitleWithIcon}>
                  <Film size={14} aria-hidden />
                  Assembly timeline
                </h2>
                <small>
                  {model.summary.storyboardTitle
                    ? `Linked storyboard: ${model.summary.storyboardTitle}`
                    : 'No linked storyboard'}
                </small>
              </div>
            </div>
            <TimelineBoard
              clips={model.clips}
              selectedClipId={selectedClip?.id ?? null}
              estimatedDurationSec={model.summary.estimatedDurationSec}
              onSelect={setSelectedClipId}
            />
          </section>
          <aside className={styles.panel} aria-label="Clip detail">
            <div className={styles.panelHead}>
              <div>
                <h2>Inspection</h2>
                <small>Readiness, asset locks, and exceptions</small>
              </div>
            </div>
            <ClipDetailPanel
              clip={selectedClip}
              checks={model.readinessChecks}
              exceptions={model.exceptions}
            />
          </aside>
        </div>
      ) : null}

      {tab === 'readiness' ? (
        <section className={styles.panel} aria-label="Readiness">
          <div className={styles.panelHead}>
            <div>
              <h2>Video-readiness evaluator</h2>
              <small>Permanent AssetVersion, continuity, and freshness gates</small>
            </div>
          </div>
          <ReadinessPanel checks={model.readinessChecks} clips={model.clips} />
        </section>
      ) : null}

      {tab === 'assets' ? (
        <section className={styles.panel} aria-label="Assets">
          <div className={styles.panelHead}>
            <div>
              <h2>Permanent AssetVersion references</h2>
              <small>Locked inputs for scene video generation</small>
            </div>
          </div>
          <AssetsPanel assets={model.assets} />
        </section>
      ) : null}

      {tab === 'events' ? (
        <section className={styles.panel} aria-label="Frame events">
          <div className={styles.panelHead}>
            <div>
              <h2>Storyboard frame update events</h2>
              <small>Invalidation and re-evaluation signals</small>
            </div>
          </div>
          <FrameEventsPanel events={model.frameEvents} />
        </section>
      ) : null}

      {tab === 'generators' ? (
        <section className={styles.panel} aria-label="Generators">
          <div className={styles.panelHead}>
            <div>
              <h2>Scene Video Generator &amp; Timeline contracts</h2>
              <small>Provider adapters await backend registration</small>
            </div>
          </div>
          <GeneratorsPanel generators={model.generators} />
        </section>
      ) : null}

      {tab === 'exceptions' ? (
        <section className={styles.panel} aria-label="Exceptions">
          <div className={styles.panelHead}>
            <div>
              <h2>Human exceptions</h2>
              <small>Cases that block safe video handoff</small>
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
