'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {AppShell} from '@/components/app-shell';
import {scriptProject,scriptVersions} from '@/lib/module07-data';

const reviews = [
  {
    id:'rev1', version:2, decision:'RETURN',
    comment:'Sections 2 (Kitchen) metaphor is excellent but the 2.1M nearest-neighbour users statistic needs wording review — CLAIM-R-015 is flagged CONFLICTING between vendor blog vs vendor data team, so inline usage MUST be softened until resolved.',
    by:'Research Lead', at:'2026-09-05T07:10:00Z'
  },
  {
    id:'rev2', version:1, decision:'APPROVE',
    comment:'First approved cut from CON-001; promoted to v2 expansion after Section 2 "Five Models, One Kitchen" was added.',
    by:'Pips Engine', at:'2026-09-03T16:44:00Z'
  }
];

export default function ScriptVersions(){
  const {id}=useParams<{id:string}>();
  return (
    <AppShell
      eyebrow="PROJECT / VERSIONS"
      title="Script Versions & Governance"
      actions={<><button className="btn secondary">Snapshot new version</button><button className="btn primary">Approve v2</button></>}
    >
      <div className="script-project-head">
        <div>
          <span className="project-code">{scriptProject.code}</span>
          <h2>{scriptProject.title}</h2>
          <p>Immutable snapshots, change summaries and review decisions; approvals propagate downstream.</p>
        </div>
        <div>
          <span className="pill blue">CURRENT v{scriptVersions[0].number}</span>
          <small>{scriptVersions.length} snapshots</small>
        </div>
      </div>
      <nav className="script-tabs">
        <Link href={`/projects/${id}/script/concepts`}>Concept Studio</Link>
        <Link href={`/projects/${id}/script`}>Script Studio</Link>
        <Link href={`/projects/${id}/script/claims`}>Fact &amp; Claim Links</Link>
        <Link href={`/projects/${id}/script/retention`}>Retention</Link>
        <Link className="active" href={`/projects/${id}/script/versions`}>Versions</Link>
      </nav>
      <div className="version-timeline">
        {scriptVersions.map(v=>{
          const created=new Date(v.createdAt);
          const ini=(s:string)=>s.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
          return (
            <section key={v.id} className={`version-card ${v.number===scriptVersions[0].number?'current':''}`}>
              <div className="version-head">
                <div>
                  <b><i>v{v.number}</i>v{v.number} · {v.status}</b>
                  <small>Created {created.toLocaleString()} · by {v.by}</small>
                </div>
                <span className={`pill ${v.status==='APPROVED'?'green':v.status==='IN_REVIEW'?'blue':'gray'}`}>{v.status}</span>
              </div>
              <div className="version-stats">
                <div><span>Words</span><b>{v.words.toLocaleString()}</b></div>
                <div><span>Duration</span><b>{v.duration}</b></div>
                <div><span>Sections</span><b>{v.number===2?6:5}</b></div>
                <div><span>Concept</span><b>CON-001</b></div>
              </div>
              <div className="version-summary">
                <p>{v.summary}</p>
                <pre>{v.number===2
                  ? '§1. Cold Open — The Ordinary Morning\n§2. Breakfast — Five Models, One Kitchen\n§3. Commute — The Silent Auction\n§4. Work — The AI That Writes Before You Do\n§5. What The Models Can Never Know\n§6. How to Live With Systems That Guess'
                  : '§1–§5 original five sections from CON-001 first draft.'
                }</pre>
              </div>
              <div className="review-list">
                <h5>Reviews</h5>
                {reviews.filter(r=>r.version===v.number).map(r=>{
                  const rat=new Date(r.at);
                  return (
                    <div key={r.id} className="review-item">
                      <div className="avatar tiny">{ini(r.by)}</div>
                      <div className="review-copy">
                        <b>
                          {r.by} ·&nbsp;
                          <span className={`decision-pill ${r.decision==='APPROVE'?'approve':'return'}`}>
                            {r.decision}
                          </span>
                        </b>
                        <small>{rat.toLocaleString()}</small>
                        <p>{r.comment}</p>
                      </div>
                      <span className={`pill ${r.decision==='APPROVE'?'green':'red'}`}>{r.decision}</span>
                    </div>
                  );
                })}
                {reviews.filter(r=>r.version===v.number).length===0 && (
                  <div className="empty-state">
                    <h3>No reviews</h3>
                    <p>No reviews on this snapshot yet.</p>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
