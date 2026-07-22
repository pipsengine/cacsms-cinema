'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown, ChevronRight, CircleCheck, Clock3, Film, FolderOpen, LoaderCircle,
  MapPin, MoreHorizontal, Play, Plus, Save, Sparkles, Users, WandSparkles, Workflow, Zap,
} from 'lucide-react';
import styles from './script-writer.module.css';

interface Project { id: string; name: string; description: string | null }
interface Evidence { id: string; status: string; sourceTitle: string }
interface ContinuityIssue { id: string; sceneId: string | null; severity: string; status: string; description: string; recommendedAction: string }
interface AutomationRun { id: string; status: string; stage: string; failureCode: string | null; errorJson: string | null; createdAt: string }
interface Scene {
  id: string; position: number; sceneNumber: string; title: string; purpose: string; narrativeBeat: string; narration: string;
  visualIntention: string; locationPeriod: string; emotionalDirection: string; cameraDirection: string; soundDirection: string;
  durationSec: number; status: string; readinessScore: number | null; version: number; updatedAt: string;
  evidence: Evidence[]; continuityIssues: ContinuityIssue[];
}
interface Script {
  id: string; projectId: string; title: string; logline: string | null; genre: string | null; targetDurationSec: number; status: string;
  version: number; updatedAt: string; project: Project; scenes: Scene[]; continuityIssues: ContinuityIssue[]; automationRuns: AutomationRun[];
}

const editableFields = ['title', 'purpose', 'narrativeBeat', 'narration', 'visualIntention', 'locationPeriod', 'emotionalDirection', 'cameraDirection', 'soundDirection'] as const;

export default function ScriptWriterPage() {
  const router = useRouter();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [scriptId, setScriptId] = useState<string>('');
  const [sceneId, setSceneId] = useState<string>('');
  const [draft, setDraft] = useState<Scene | null>(null);
  const [tab, setTab] = useState('Scenes');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async (preferredScriptId?: string, preferredSceneId?: string) => {
    const [scriptsResponse, projectsResponse] = await Promise.all([fetch('/api/v1/scripts', { cache: 'no-store' }), fetch('/api/projects', { cache: 'no-store' })]);
    if (!scriptsResponse.ok || !projectsResponse.ok) throw new Error('Script workspace data could not be loaded.');
    const loadedScripts = await scriptsResponse.json() as Script[];
    const loadedProjects = await projectsResponse.json() as Project[];
    setScripts(loadedScripts); setProjects(loadedProjects);
    const nextScriptId = preferredScriptId || scriptId || loadedScripts[0]?.id || '';
    setScriptId(nextScriptId);
    const nextScript = loadedScripts.find((script) => script.id === nextScriptId);
    const nextSceneId = preferredSceneId || (nextScript?.scenes.some((scene) => scene.id === sceneId) ? sceneId : nextScript?.scenes[0]?.id) || '';
    setSceneId(nextSceneId);
    setDraft(nextScript?.scenes.find((scene) => scene.id === nextSceneId) || null);
  }, [sceneId, scriptId]);

  useEffect(() => { void refresh().catch((caught) => setError(caught instanceof Error ? caught.message : 'Workspace unavailable.')); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const script = scripts.find((item) => item.id === scriptId) || null;
  const totalDuration = script?.scenes.reduce((sum, scene) => sum + scene.durationSec, 0) || 0;
  const evidence = script?.scenes.flatMap((scene) => scene.evidence) || [];
  const verifiedEvidence = evidence.filter((item) => item.status === 'VERIFIED').length;
  const openIssues = script?.continuityIssues.filter((issue) => issue.status === 'OPEN') || [];
  const continuityScore = script ? Math.max(0, 100 - openIssues.reduce((total, issue) => total + (issue.severity === 'CRITICAL' ? 25 : issue.severity === 'HIGH' ? 15 : 5), 0)) : null;
  const readiness = draft?.readinessScore ?? calculateDraftReadiness(draft);
  const latestRun = script?.automationRuns[0];
  const suggestion = firstSuggestion(draft);

  function chooseScript(id: string) {
    const selected = scripts.find((item) => item.id === id);
    setScriptId(id); setSceneId(selected?.scenes[0]?.id || ''); setDraft(selected?.scenes[0] || null); setNotice(null); setError(null);
  }
  function chooseScene(scene: Scene) { setSceneId(scene.id); setDraft({ ...scene }); setNotice(null); }
  function update<K extends keyof Scene>(field: K, value: Scene[K]) { setDraft((current) => current ? { ...current, [field]: value } : current); }

  async function createScript() {
    const project = projects[0];
    if (!project) { setError('Create a project before creating a script.'); return; }
    setBusy('create'); setError(null);
    try {
      const response = await fetch('/api/v1/scripts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-Correlation-Id': crypto.randomUUID() }, body: JSON.stringify({ projectId: project.id, title: `${project.name} Screenplay`, targetDurationSec: 900 }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || 'Script creation failed.');
      await refresh(result.id, result.scenes[0]?.id); setNotice('Script created with a versioned opening scene.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Script creation failed.'); } finally { setBusy(null); }
  }

  async function saveDraft(silent = false): Promise<Scene | null> {
    if (!script || !draft) return null;
    setBusy('save'); setError(null);
    try {
      const payload = Object.fromEntries(editableFields.map((field) => [field, draft[field]]));
      const response = await fetch(`/api/v1/scripts/${script.id}/scenes/${draft.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': crypto.randomUUID() }, body: JSON.stringify({ ...payload, durationSec: draft.durationSec, version: draft.version }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || 'Scene save failed.');
      await refresh(script.id, result.id); if (!silent) setNotice('Draft saved, revision snapshotted, and downstream dependencies marked stale.');
      return result;
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Scene save failed.'); return null; } finally { setBusy(null); }
  }

  async function addScene() {
    if (!script) return;
    setBusy('add'); setError(null);
    try {
      const response = await fetch(`/api/v1/scripts/${script.id}/scenes`, { method: 'POST', headers: { 'X-Correlation-Id': crypto.randomUUID() } });
      const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || 'Scene creation failed.');
      await refresh(script.id, result.id); setNotice(`Scene ${result.sceneNumber} created.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Scene creation failed.'); } finally { setBusy(null); }
  }

  async function generateScreenplay() {
    if (!script) return;
    setBusy('generate'); setError(null); setNotice('Autonomous screenplay generation started…');
    try {
      const response = await fetch(`/api/v1/scripts/${script.id}/generate`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID(), 'X-Correlation-Id': crypto.randomUUID() } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Autonomous generation requires review.');
      await refresh(script.id); setNotice(`Autonomous screenplay completed with ${result.sceneCount} validated scenes.`);
    } catch (caught) { await refresh(script.id, sceneId); setError(caught instanceof Error ? caught.message : 'Autonomous generation failed closed.'); setNotice(null); } finally { setBusy(null); }
  }

  async function prepareStoryboard() {
    if (!script || !draft) return;
    const saved = await saveDraft(true); if (!saved) return;
    setBusy('queue');
    try {
      const response = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ projectId: script.projectId, sceneId: draft.id, priority: 0 }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Autonomous production job could not be queued.');
      router.push('/visuals/image-generator');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Queue request failed.'); } finally { setBusy(null); }
  }

  if (!scripts.length && !projects.length && !error) return <div className={styles.loading}><LoaderCircle className={styles.spinner}/>Loading professional script workspace…</div>;

  return <section className={styles.content}>
    <div className={styles.pageHeader}>
      <div><div className={styles.eyebrow}><Sparkles size={14}/> CACSMS Production Capability</div><h1>Professional Script Writer</h1><p>Develop production-ready scenes with narrative structure, evidence, continuity, and visual direction.</p></div>
      <div className={styles.headerActions}>
        {script ? <label className={styles.projectSelect}><FolderOpen size={17}/><select aria-label="Select script" value={script.id} onChange={(event) => chooseScript(event.target.value)}>{scripts.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select><ChevronDown size={15}/></label> : null}
        <button className={styles.secondary} disabled={!draft || Boolean(busy)} onClick={() => void saveDraft()}><Save size={17}/>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
        {script ? <button className={styles.primary} disabled={Boolean(busy)} onClick={() => void generateScreenplay()}><Play size={17} fill="currentColor"/>{busy === 'generate' ? 'Generating…' : 'Generate screenplay'}</button> : <button className={styles.primary} disabled={Boolean(busy)} onClick={() => void createScript()}><Plus size={17}/>{busy === 'create' ? 'Creating…' : 'Create script'}</button>}
      </div>
    </div>

    {error && <div className={styles.errorBanner}>{error}</div>}{notice && <div className={styles.noticeBanner}>{notice}</div>}
    {!script ? <EmptyScript projects={projects} onCreate={() => void createScript()} busy={Boolean(busy)} /> : <>
      <div className={styles.summaryRow}>
        <div className={styles.projectSummary}><div className={styles.poster}><Film size={22}/></div><div><span>Active production</span><strong>{script.title}</strong><small>{script.genre || 'Genre not set'} · {formatDuration(script.targetDurationSec)} target · Version {script.version}</small></div></div>
        <Summary label="Scenes" value={script.scenes.length} detail={`${script.scenes.filter((scene) => scene.status !== 'READY').length} in progress`} />
        <Summary label="Script length" value={formatDuration(totalDuration)} detail={`${Math.min(100, Math.round(totalDuration / script.targetDurationSec * 100))}% of target`} />
        <Summary label="Evidence" value={evidence.length ? `${Math.round(verifiedEvidence / evidence.length * 100)}%` : '—'} detail={evidence.length ? `${verifiedEvidence} of ${evidence.length} verified` : 'No evidence recorded'} good={evidence.length > 0 && verifiedEvidence === evidence.length} />
        <Summary label="Continuity" value={continuityScore === null ? '—' : `${continuityScore}%`} detail={openIssues.length ? `${openIssues.length} open issue${openIssues.length === 1 ? '' : 's'}` : 'No recorded conflicts'} good={!openIssues.length} />
      </div>
      <div className={styles.tabs}>{['Outline', 'Scenes', 'Continuity', 'Evidence'].map((item) => <button key={item} onClick={() => setTab(item)} className={tab === item ? styles.activeTab : ''}>{item}{item === 'Evidence' && <b>{evidence.filter((entry) => entry.status !== 'VERIFIED').length}</b>}</button>)}</div>
      <div className={styles.workspace}>
        <section className={styles.scenePanel}><div className={styles.panelHead}><div><span>Scene navigator</span><small>{script.scenes.length} scenes · {formatDuration(totalDuration)} runtime</small></div><button onClick={() => void addScene()} disabled={Boolean(busy)} aria-label="Add scene"><Plus size={18}/></button></div><div className={styles.sceneList}>{script.scenes.map((scene) => <button key={scene.id} onClick={() => chooseScene(scene)} className={`${styles.sceneCard} ${scene.id === sceneId ? styles.activeScene : ''}`}><span className={styles.sceneNo}>{scene.sceneNumber}</span><span className={styles.sceneInfo}><strong>{scene.title}</strong><small>{scene.narrativeBeat} · {formatDuration(scene.durationSec)}</small></span><span className={`${styles.state} ${styles[scene.status.toLowerCase()] || styles.draft}`}>{titleCase(scene.status)}</span><ChevronRight size={15}/></button>)}</div><button className={styles.addScene} onClick={() => void addScene()} disabled={Boolean(busy)}><Plus size={17}/> Add new scene</button></section>
        {draft ? <section className={styles.editor}><div className={styles.editorHead}><div><span>Scene {draft.sceneNumber}</span><input className={styles.titleInput} value={draft.title} onChange={(event) => update('title', event.target.value)}/><div className={styles.meta}><span><Clock3 size={14}/> {formatDuration(draft.durationSec)}</span><span><CircleCheck size={14}/> Persisted version {draft.version}</span></div></div><button className={styles.more} aria-label="More options"><MoreHorizontal size={20}/></button></div>
          <div className={styles.formGrid}><Field label="Scene purpose" value={draft.purpose} onChange={(value) => update('purpose', value)}/><label><span>Narrative beat</span><select value={draft.narrativeBeat} onChange={(event) => update('narrativeBeat', event.target.value)}><option>Opening hook</option><option>Context</option><option>Turning point</option><option>Conflict</option><option>Resolution</option><option>Closing</option></select></label></div>
          <TextField label="Narration" value={draft.narration} onChange={(value) => update('narration', value)} detail={`${wordCount(draft.narration)} words · approximately ${Math.max(0, Math.round(wordCount(draft.narration) / 2.4))} seconds`} />
          <TextField label="Visual intention" value={draft.visualIntention} onChange={(value) => update('visualIntention', value)} />
          <div className={styles.formGrid}><Field label="Location and period" value={draft.locationPeriod} onChange={(value) => update('locationPeriod', value)}/><Field label="Emotional direction" value={draft.emotionalDirection} onChange={(value) => update('emotionalDirection', value)}/></div>
          <div className={styles.directionGrid}><Direction icon={Film} label="Camera direction" value={draft.cameraDirection} onChange={(value) => update('cameraDirection', value)}/><Direction icon={WandSparkles} label="Sound direction" value={draft.soundDirection} onChange={(value) => update('soundDirection', value)}/></div>
          <div className={styles.editorFooter}><span><CircleCheck size={15}/>Readiness evidence: {readiness}%</span><button onClick={() => void saveDraft()}>Save full scene details <ChevronRight size={15}/></button></div>
        </section> : <div className={styles.noScene}>Add a scene to begin writing.</div>}
        <aside className={styles.intelligence}><div className={styles.intelTitle}><div className={styles.aiIcon}><Sparkles size={18}/></div><div><strong>Production intelligence</strong><span>Persisted scene analysis</span></div><i>{latestRun?.status === 'RUNNING' ? 'Running' : 'Active'}</i></div><div className={styles.score}><div style={{ background: `conic-gradient(#3157e8 ${readiness}%,#e8edf5 0)` }}><strong>{readiness}</strong><span>/100</span></div><div><b>Production readiness</b><small>{readiness >= 80 ? 'Core production fields are complete' : 'Required direction remains incomplete'}</small></div></div><div className={styles.progress}><i style={{ width: `${readiness}%` }}/></div>
          <div className={styles.checkGroup}><h3>Scene analysis</h3>{analysisChecks(draft).map(([label, passed]) => <div className={passed ? styles.passed : styles.missing} key={label}><CircleCheck size={16}/><span>{label}</span></div>)}</div>
          {suggestion && <div className={styles.suggestion}><div><Zap size={16}/><strong>Suggested improvement</strong></div><p>{suggestion}</p></div>}
          <div className={styles.dependencies}><h3>Production dependencies</h3><div><Users size={16}/><span>{draft?.evidence.length || 0} evidence records</span><b>{draft?.evidence.length ? 'Tracked' : 'None'}</b></div><div><MapPin size={16}/><span>Geographic context</span><b className={draft?.locationPeriod ? '' : styles.amber}>{draft?.locationPeriod ? 'Ready' : 'Missing'}</b></div><div><Workflow size={16}/><span>{openIssues.length} continuity issues</span><b className={openIssues.length ? styles.amber : ''}>{openIssues.length ? 'Review' : 'Ready'}</b></div></div>
          {latestRun?.status === 'HUMAN_EXCEPTION_REQUIRED' && <div className={styles.runException}>Autonomous run requires review: {latestRun.failureCode}</div>}
          <button className={styles.storyboard} disabled={!draft || Boolean(busy)} onClick={() => void prepareStoryboard()}>{busy === 'queue' ? 'Queuing…' : 'Prepare for storyboard'} <ChevronRight size={16}/></button>
        </aside>
      </div>
    </>}
  </section>;
}

function Summary({ label, value, detail, good = false }: { label: string; value: string | number; detail: string; good?: boolean }) { return <div className={styles.metric}><span>{label}</span><strong>{value}</strong><small className={good ? styles.good : ''}>{detail}</small></div>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)}/></label>; }
function TextField({ label, value, onChange, detail }: { label: string; value: string; onChange: (value: string) => void; detail?: string }) { return <label className={styles.textBlock}><span>{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)}/>{detail && <small>{detail}</small>}</label>; }
function Direction({ icon: Icon, label, value, onChange }: { icon: typeof Film; label: string; value: string; onChange: (value: string) => void }) { return <article><div><Icon size={17}/><strong>{label}</strong></div><textarea value={value} onChange={(event) => onChange(event.target.value)}/></article>; }
function EmptyScript({ projects, onCreate, busy }: { projects: Project[]; onCreate: () => void; busy: boolean }) { return <div className={styles.emptyState}><Film size={42}/><h2>No production script yet</h2><p>{projects.length ? 'Create a versioned script for the current project. No sample screenplay will be inserted.' : 'Create a project first, then return here to begin a versioned screenplay.'}</p><button disabled={busy || !projects.length} onClick={onCreate}><Plus size={17}/> Create first script</button></div>; }
function formatDuration(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function wordCount(value: string) { return value.trim() ? value.trim().split(/\s+/).length : 0; }
function titleCase(value: string) { return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function calculateDraftReadiness(scene: Scene | null) { if (!scene) return 0; const values = [scene.purpose, scene.narration, scene.visualIntention, scene.locationPeriod, scene.emotionalDirection, scene.cameraDirection, scene.soundDirection]; return Math.round((values.filter((value) => value.trim().length >= 8).length + (scene.durationSec > 0 ? 1 : 0)) / 8 * 100); }
function analysisChecks(scene: Scene | null): Array<[string, boolean]> { return [['Narrative objective is clear', Boolean(scene?.purpose.trim())], ['Visual direction supports narration', Boolean(scene?.visualIntention.trim() && scene?.narration.trim())], ['Duration fits production target', Boolean(scene && scene.durationSec > 0)], ['Geography is explicitly defined', Boolean(scene?.locationPeriod.trim())]]; }
function firstSuggestion(scene: Scene | null) { if (!scene) return null; if (!scene.purpose.trim()) return 'Define a precise narrative objective for this scene.'; if (!scene.narration.trim()) return 'Add narration or explicitly mark the scene as dialogue-free.'; if (!scene.visualIntention.trim()) return 'Describe observable visual action that supports the narrative beat.'; if (!scene.locationPeriod.trim()) return 'Specify location, cultural context, period, and time of day.'; if (!scene.cameraDirection.trim()) return 'Add shot scale, lens perspective, movement, and transition intent.'; if (!scene.soundDirection.trim()) return 'Define ambience, dialogue priority, music intent, and transitions.'; return null; }
