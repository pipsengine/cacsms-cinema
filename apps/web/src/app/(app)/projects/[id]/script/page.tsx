'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useState} from 'react';
import {AppShell} from '@/components/app-shell';
import {Status} from '@/components/ui';
import {scriptProject,scriptSections,claimLinks,retentionChecks,scriptVersions} from '@/lib/module07-data';

export default function ScriptStudio(){
  const {id}=useParams<{id:string}>();
  const [active,setActive]=useState<string>(scriptSections[0].id);
  const totalWords=scriptSections.reduce((a,b)=>a+b.words,0);
  const v=scriptVersions[0];
  const cur=scriptSections.find(s=>s.id===active);
  return (
    <AppShell
      eyebrow="PROJECT / SCRIPT STUDIO"
      title="Script Studio"
      actions={<><button className="btn secondary">Save draft</button><button className="btn primary">Submit for review</button></>}
    >
      <div className="script-project-head">
        <div>
          <span className="project-code">{scriptProject.code}</span>
          <h2>{scriptProject.title}</h2>
          <p>Concept CON-001 selected from approved Research Pack; all evidence governed by Module 06 Fact Verification.</p>
        </div>
        <div>
          <Status tone="blue">v{scriptProject.scriptVersion} · {scriptProject.status}</Status>
          <small>{v.number} · {v.words.toLocaleString()} words · {v.duration}</small>
        </div>
      </div>
      <nav className="script-tabs">
        <Link href={`/projects/${id}/script/concepts`}>Concept Studio</Link>
        <Link className="active" href={`/projects/${id}/script`}>Script Studio</Link>
        <Link href={`/projects/${id}/script/claims`}>Fact &amp; Claim Links</Link>
        <Link href={`/projects/${id}/script/retention`}>Retention</Link>
        <Link href={`/projects/${id}/script/versions`}>Versions</Link>
      </nav>
      <div className="script-studio-layout">
        <aside className="script-outline">
          <div className="script-outline-head"><b>Outline</b><span>{scriptSections.length} sections</span></div>
          <div className="script-outline-list">
            {scriptSections.map(s=>(
              <button key={s.id} className={`script-section-btn ${active===s.id?'active':''}`} onClick={()=>setActive(s.id)}>
                <b><i>{String(s.order)}</i>{s.title}</b>
                <small><span>{s.type}</span><span>{s.start} / {s.words}w</span></small>
              </button>
            ))}
          </div>
        </aside>
        <section className="script-editor">
          <div className="script-editor-head">
            <div>
              <b>{cur?.title}</b>
              <span>Section {cur?.type} · {cur?.start}–{cur?.end}</span>
            </div>
            <div className="script-editor-tools">
              <button title="Bold">B</button>
              <button title="Evidence">§</button>
              <button title="Retention">↻</button>
              <button title="Citation">¶</button>
            </div>
          </div>
          <div className="script-section-meta">
            <div><span>Word count</span><b>{cur?.words}</b></div>
            <div>
              <span>Status</span>
              <Status tone={cur?.status==='APPROVED'?'green':cur?.status==='REVIEW'?'amber':'gray'}>{cur?.status}</Status>
            </div>
            <div><span>Purpose</span><b style={{fontSize:8}}>{cur?.purpose?.slice(0,48)}…</b></div>
          </div>
          <div className="script-canvas">
            <textarea defaultValue={cur?.content}/>
          </div>
          <div className="script-editor-foot">
            <small>v{v.number} · {claimLinks.length} claim links attached · retention scored</small>
            <small>{totalWords.toLocaleString()} words · {v.duration} estimated · 3 APPROVED · 2 REVIEW · 1 DRAFT</small>
          </div>
        </section>
        <aside className="script-assistant">
          <section className="ai-panel">
            <div className="ai-panel-head"><b>Assistant prompts</b><span>v2 / v1</span></div>
            <div className="ai-panel-body">
              <button className="ai-prompt-chip">Rewrite this section more conversational, 30% shorter</button>
              <button className="ai-prompt-chip">Insert a concrete statistic or concrete example to this paragraph</button>
              <button className="ai-prompt-chip">Flag any claim that needs a source citation</button>
              <button className="ai-prompt-chip">Suggest a visual / callback to open</button>
            </div>
          </section>
          <section className="ai-panel">
            <div className="ai-panel-head"><b>Evidence coverage</b><span>{claimLinks.length} claims</span></div>
            <div className="context-list">
              {claimLinks.map(c=>(
                <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',gap:8}}>
                  <span style={{fontSize:10}}>{c.code}</span>
                  <span className={`claim-chip ${c.verification==='VERIFIED'?'verified':c.verification==='CONFLICTING'?'conflicting':'pending'}`}>{c.verification}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="ai-panel">
            <div className="ai-panel-head"><b>Retention signals</b><span>{retentionChecks.length} checks</span></div>
            <div className="assistant-tools">
              <button className="primary">Run retention pass</button>
              <button>Run claims audit</button>
              <button>Suggest reorder</button>
              <button>Summarise takeaways</button>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
