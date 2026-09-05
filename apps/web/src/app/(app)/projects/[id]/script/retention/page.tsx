'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {AppShell} from '@/components/app-shell';
import {Status} from '@/components/ui';
import {retentionChecks,scriptProject,scriptVersions} from '@/lib/module07-data';

export default function Retention(){
  const {id}=useParams<{id:string}>();
  const avg=Math.round(retentionChecks.reduce((a,b)=>a+b.score,0)/retentionChecks.length);
  const blocking=retentionChecks.filter(r=>r.status==='ACTION').length;
  const fmt = (sec:number) => {
    const d=new Date(0); d.setSeconds(sec); return d.toISOString().substring(14,19);
  };
  return (
    <AppShell
      eyebrow="PROJECT / RETENTION"
      title="Retention Audit"
      actions={<><button className="btn secondary">Re-run retention model</button><button className="btn primary">Resolve all actions</button></>}
    >
      <div className="script-project-head">
        <div>
          <span className="project-code">{scriptProject.code}</span>
          <h2>{scriptProject.title}</h2>
          <p>Per-section retention, drop-off and blocking issues; any unresolved DURATION or REPEAT blocks submit.</p>
        </div>
        <div>
          <Status tone={avg>=85?'green':avg>=75?'amber':'red'}>{avg}% AVG</Status>
          <small>{blocking} ACTION blocking · script v{scriptVersions[0].number}</small>
        </div>
      </div>
      <nav className="script-tabs">
        <Link href={`/projects/${id}/script/concepts`}>Concept Studio</Link>
        <Link href={`/projects/${id}/script`}>Script Studio</Link>
        <Link href={`/projects/${id}/script/claims`}>Fact &amp; Claim Links</Link>
        <Link className="active" href={`/projects/${id}/script/retention`}>Retention</Link>
        <Link href={`/projects/${id}/script/versions`}>Versions</Link>
      </nav>
      <div className="retention-layout">
        <main className="retention-main">
          {retentionChecks.map(r=>(
            <section key={r.id} className={`retention-check ${r.status==='ACTION'?'blocking':''} ${r.status==='KEEP'?'resolved':''}`}>
              <div className={`retention-icon ${r.status==='ACTION'?'action':'keep'}`}>
                {r.status==='ACTION' ? '!' : '✓'}
              </div>
              <div className="retention-copy">
                <b>Section {r.section} · {r.type} — Score {r.score}</b>
                <p>{r.note}</p>
                <small>
                  <span>Window <b>{fmt(r.startSecond)}–{fmt(r.endSecond)}</b></span>
                  <span>Type <b>{r.type}</b></span>
                  <span>Check <b>#{r.id.replace('r','')}</b></span>
                </small>
              </div>
              <div className="retention-state">
                {r.status==='ACTION' ? (
                  <>
                    <div className="retention-gauge">
                      <strong style={{color:r.score<82?'#b42318':'#b54708'}}>{r.score}</strong>
                      <span>ACTION</span>
                    </div>
                    <button className="btn small primary">Resolve</button>
                  </>
                ) : (
                  <>
                    <div className="retention-gauge">
                      <strong style={{color:'#067647'}}>{r.score}</strong>
                      <span>KEEP</span>
                    </div>
                    <Status tone="green">KEEP</Status>
                  </>
                )}
              </div>
            </section>
          ))}
        </main>
        <aside className="retention-side">
          <section className="retention-summary">
            <h4>Retention summary</h4>
            <div>
              <div><span>Avg score</span><b className="green">{avg}%</b></div>
              <div><span>Blocking</span><b className="red">{blocking} open</b></div>
              <div><span>Kept</span><b className="green">{retentionChecks.length-blocking} checks</b></div>
              <div><span>Strongest</span><b className="amber">Cliff 95</b></div>
            </div>
          </section>
          <section className="workspace-card">
            <div className="card-head">
              <div><b>Per-section scores</b><small>ordered by timeline</small></div>
            </div>
            <div className="retention-score-bars">
              {retentionChecks.map(r=>(
                <div key={r.id}>
                  <span>S{r.section} {r.type}</span>
                  <i><b className={r.score<82?'low':r.score<88?'mid':''} style={{width:`${r.score}%`}}/></i>
                  <strong>{r.score}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="handoff-box">
            <span>SUBMIT GATE</span>
            <b>All ACTION resolved → SCRIPT → CHARACTER_BIBLE + SCENE_MATRIX</b>
            <p>Submit is blocked while retention blocking entries remain unresolved and any CONFLICTING claim-links remain. Resolve then re-audit.</p>
            <div><strong>SCRIPT IN_REVIEW</strong><em>→ FACT_CHECK gate</em></div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
