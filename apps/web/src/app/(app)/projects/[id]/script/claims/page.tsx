'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {AppShell} from '@/components/app-shell';
import {claimLinks,scriptProject} from '@/lib/module07-data';

export default function ClaimLinks(){
  const {id}=useParams<{id:string}>();
  return (
    <AppShell
      eyebrow="PROJECT / CLAIM LINKS"
      title="Fact & Claim Links"
      actions={<><button className="btn secondary">Refresh audit</button><button className="btn primary">Link new claim</button></>}
    >
      <div className="script-project-head">
        <div>
          <span className="project-code">{scriptProject.code}</span>
          <h2>{scriptProject.title}</h2>
          <p>Every factual claim in the script must be traceably attached to a verified research claim; unverified or conflicting claims block submit.</p>
        </div>
        <div>
          <span className="pill green">VERIFIED {claimLinks.filter(c=>c.verification==='VERIFIED').length}/{claimLinks.length}</span>
          <small>{claimLinks.filter(c=>c.usage!=='APPROVED').length} NEEDS_REVIEW</small>
        </div>
      </div>
      <nav className="script-tabs">
        <Link href={`/projects/${id}/script/concepts`}>Concept Studio</Link>
        <Link href={`/projects/${id}/script`}>Script Studio</Link>
        <Link className="active" href={`/projects/${id}/script/claims`}>Fact &amp; Claim Links</Link>
        <Link href={`/projects/${id}/script/retention`}>Retention</Link>
        <Link href={`/projects/${id}/script/versions`}>Versions</Link>
      </nav>
      <section className="workspace-card claim-register">
        <div className="card-head">
          <div><b>Script claim register</b><small>Every use within the current script version</small></div>
          <span className="pill blue">EVIDENCE GOVERNED</span>
        </div>
        <div className="claim-head">
          <span>Claim code</span><span>Material claim text</span><span>Attached section</span><span>Source ref</span><span>Verification</span><span>Usage</span>
        </div>
        {claimLinks.map(c=>(
          <div className="claim-row" key={c.id}>
            <div><b>{c.code}</b><small>Confidence {Math.round(c.confidence*100)}%</small></div>
            <div><b style={{fontSize:9}}>{c.claimText}</b><small>{c.usage}</small></div>
            <div><b>{c.section}</b><small>Inline usage</small></div>
            <div><b>{c.source}</b><small>Module 06 · Research</small></div>
            <span className={`claim-chip ${c.verification==='VERIFIED'?'verified':c.verification==='CONFLICTING'?'conflicting':'pending'}`}>{c.verification}</span>
            <span className={`pill ${c.usage==='APPROVED'?'green':c.usage==='NEEDS_REVIEW'?'amber':'gray'}`}>{c.usage.replace('_',' ')}</span>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
