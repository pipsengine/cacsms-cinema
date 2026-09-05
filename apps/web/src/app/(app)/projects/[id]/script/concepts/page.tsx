'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {AppShell} from '@/components/app-shell';
import {Status} from '@/components/ui';
import {concepts,scriptProject} from '@/lib/module07-data';

export default function ConceptStudio(){
  const {id}=useParams<{id:string}>();
  return (
    <AppShell
      eyebrow="PROJECT / CONCEPT STUDIO"
      title="Concept Studio"
      actions={<><button className="btn secondary">Regenerate concepts</button><button className="btn primary">Lock concept</button></>}
    >
      <div className="script-project-head">
        <div>
          <span className="project-code">{scriptProject.code}</span>
          <h2>{scriptProject.title}</h2>
          <p>Four narrative concepts seeded from this opportunity; exactly one advances into selected then approved to drive Script Studio.</p>
        </div>
        <div>
          <Status tone="purple">CONCEPT APPROVAL</Status>
          <small>{concepts.filter(c=>c.status!=='REJECTED').length} live · {concepts.length} candidates</small>
        </div>
      </div>
      <nav className="script-tabs">
        <Link className="active" href={`/projects/${id}/script/concepts`}>Concept Studio</Link>
        <Link href={`/projects/${id}/script`}>Script Studio</Link>
        <Link href={`/projects/${id}/script/claims`}>Fact &amp; Claim Links</Link>
        <Link href={`/projects/${id}/script/retention`}>Retention</Link>
        <Link href={`/projects/${id}/script/versions`}>Versions</Link>
      </nav>
      <div className="concept-card-grid">
        {concepts.map(c=>(
          <article key={c.id} className={`concept-card ${c.status==='APPROVED'?'selected':''} ${c.status==='REJECTED'?'rejected':''}`}>
            <div className="concept-head">
              <div>
                <b>{c.code} · {c.status}</b>
                <h3>{c.title}</h3>
                <p>{c.angle}</p>
              </div>
              <Status tone={c.status==='APPROVED'?'green':c.status==='SHORTLISTED'?'blue':c.status==='REJECTED'?'red':'gray'}>{c.status}</Status>
            </div>
            <div className="concept-scores">
              <S l="Overall" v={c.score} pct={c.score}/>
              <S l="Retention" v={c.retention} pct={c.retention}/>
              <S l="Global" v={c.globalAppeal} pct={c.globalAppeal}/>
              <S l="Visual" v={c.visual} pct={c.visual}/>
              <S l="Safety" v={c.safety} pct={c.safety}/>
            </div>
            <div className="concept-detail">
              <div><span>Hook</span><b>"{c.hook.slice(0,82)}…</b></div>
              <div><span>Structure</span><b>{c.structure.length} acts: {c.structure.join(', ')}</b></div>
              {c.selectedAt && (
                <div><span>Selected at</span><b>{new Date(c.selectedAt).toLocaleString()}</b></div>
              )}
            </div>
            <div className="concept-actions">
              {c.status==='APPROVED' ? (
                <>
                  <button className="success">✓ APPROVED</button>
                  <button className="primary">Use in Script</button>
                </>
              ) : c.status==='SHORTLISTED' ? (
                <>
                  <button className="primary">SELECT</button>
                  <button className="success">APPROVE</button>
                  <button className="danger">REJECT</button>
                </>
              ) : c.status==='REJECTED' ? (
                <>
                  <button className="amber">REVIEW</button>
                </>
              ) : (
                <>
                  <button className="amber">SHORTLIST</button>
                  <button className="primary">SELECT</button>
                  <button className="success">APPROVE</button>
                  <button className="danger">REJECT</button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
function S({l,v,pct}:{l:string;v:number;pct:number}){
  return <div><span>{l}</span><b>{v}</b><i><b style={{width:`${pct}%`}}/></i></div>;
}
