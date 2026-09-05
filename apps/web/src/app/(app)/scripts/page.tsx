'use client';
import Link from 'next/link';
import {AppShell} from '@/components/app-shell';
import {Status} from '@/components/ui';
import {concepts,scriptProject,scriptSections,claimLinks,retentionChecks,scriptVersions} from '@/lib/module07-data';

export default function ScriptRegister(){
  const approvedConcepts = concepts.filter(x=>x.status==='APPROVED').length;
  const totalWords = scriptSections.reduce((a,b)=>a+b.words,0);
  const blocking = retentionChecks.filter(r=>r.status==='ACTION'&&(r.type==='DURATION'||r.type==='REPEAT')).length;
  const verifiedClaims = claimLinks.filter(c=>c.verification==='VERIFIED').length;
  return (
    <AppShell
      eyebrow="PRODUCTION PIPELINE / CREATIVE"
      title="Concept & Script Production"
      actions={<Link className="btn primary" href={`/projects/${scriptProject.id}/script`}>Open Script Studio</Link>}
    >
      <p className="page-subtitle">Generate narrative concepts, select the strongest, produce the evidence-backed script, audit retention and version the deliverable.</p>
      <div className="script-kpis">
        <K l="Active scripts" v="1" n="In production pipeline" tone="blue"/>
        <K l="In review" v={scriptVersions.filter(v=>v.status==='IN_REVIEW').length} n="v2 snapshot live" tone="amber"/>
        <K l="Approved versions" v={scriptVersions.filter(v=>v.status==='APPROVED').length} n="Released downstream ready" tone="green"/>
        <K l="Pending concepts" v={`${approvedConcepts}/${concepts.length}`} n="Shortlisted + rejected" tone="purple"/>
        <K l="Total script words" v={totalWords.toLocaleString()} n={`Duration ${scriptVersions[0].duration}`} tone="red"/>
      </div>
      <section className="workspace-card script-register">
        <div className="card-head">
          <div><b>Script projects</b><small>Projects flowing from approved Research Packs into the narrative pipeline</small></div>
        </div>
        <div className="script-table-head">
          <span>Project</span><span>Title & Concept</span><span>Selected concept</span><span>Script</span><span>Words</span><span>Duration</span><span>Evidence</span><span>Status</span><span/>
        </div>
        <div className="script-table-row">
          <div><b className="script-code">{scriptProject.code}</b><strong>{scriptProject.title}</strong></div>
          <div><span>6 sections · CON-001 approved</span><small>Cold open, 4 chapters, takeaway</small></div>
          <Status tone={approvedConcepts>0?'green':'gray'}>{approvedConcepts} concept{approvedConcepts===1?'':'s'} APPROVED</Status>
          <Status tone="blue">v{scriptProject.scriptVersion} · {scriptProject.status}</Status>
          <strong>{totalWords.toLocaleString()}</strong>
          <strong>{scriptVersions[0].duration}</strong>
          <div><b>{verifiedClaims}/{claimLinks.length}</b><small>{blocking} retention actions</small></div>
          <Status tone="blue">IN REVIEW</Status>
          <Link className="btn secondary small" href={`/projects/${scriptProject.id}/script`}>Open Studio →</Link>
        </div>
      </section>
    </AppShell>
  );
}
function K({l,v,n,tone}:{l:string;v:any;n:string;tone?:string}){
  return <article className={`script-kpi ${tone||''}`}><span>{l}</span><strong>{v}</strong><small>{n}</small></article>;
}
