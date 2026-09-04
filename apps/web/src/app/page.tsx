const statuses = [
  { label: 'Not Started', className: 'status status-neutral' },
  { label: 'In Progress', className: 'status status-warning' },
  { label: 'Completed', className: 'status status-success' },
  { label: 'Awaiting Approval', className: 'status status-info' },
  { label: 'Failed / Blocked', className: 'status status-danger' },
  { label: 'AI Processing', className: 'status status-ai' }
];

export default function HomePage() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">ACG</div>
        <div className="brand-copy">
          <strong>Autonomous Content Generator</strong>
          <span>Repository foundation</span>
        </div>
        <nav>
          <a className="active">Foundation</a>
          <a>Command</a>
          <a>Strategy</a>
          <a>Pre-Production</a>
          <a>Production</a>
          <a>Post-Production</a>
          <a>Packaging</a>
          <a>Approval & Release</a>
          <a>Growth</a>
          <a>Automation</a>
          <a>Management</a>
        </nav>
      </aside>
      <section className="content">
        <div className="eyebrow">SYSTEM FOUNDATION</div>
        <h1>Production repository initialized</h1>
        <p className="lead">This is the permanent base we will extend module by module. The first production page will replace this foundation screen once implementation begins.</p>
        <div className="card-grid">
          <article className="card"><span>Architecture</span><strong>Modular Monorepo</strong><p>Web, API, shared UI, types, database and infrastructure separated cleanly.</p></article>
          <article className="card"><span>Workflow</span><strong>Input → Output → Handoff</strong><p>Every future module must produce a versioned output contract consumed downstream.</p></article>
          <article className="card"><span>Design System</span><strong>White Enterprise UI</strong><p>Professional Figma-style layouts with restrained cards, tables and consistent status chips.</p></article>
        </div>
        <section className="panel">
          <div><span className="section-kicker">GLOBAL WORKFLOW STATES</span><h2>One status language across the platform</h2></div>
          <div className="status-row">{statuses.map((s) => <span className={s.className} key={s.label}>{s.label}</span>)}</div>
        </section>
      </section>
    </main>
  );
}
