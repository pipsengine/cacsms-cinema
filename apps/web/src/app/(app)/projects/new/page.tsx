'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {AppShell} from '@/components/app-shell';
import {apiFetch} from '@/lib/api';

const steps = ['Basics', 'Audience & Distribution', 'Creative & Automation', 'Governance', 'Review'];

type Form = {
  workingTitle: string;
  description: string;
  contentType: string;
  primaryPlatform: string;
  objective: string;
  category: string;
  targetAudience: string;
  targetCountries: string[];
  language: string;
  plannedDurationSeconds: number;
  aspectRatio: string;
  creativeDirection: string;
  autonomyMode: string;
  priority: string;
  deadlineAt: string;
  budgetLimit: number;
};

const initial: Form = {
  workingTitle: '',
  description: '',
  contentType: 'Long Form',
  primaryPlatform: 'YouTube',
  objective: 'Educate',
  category: 'AI & Technology',
  targetAudience: 'Global English-speaking viewers, ages 16–45',
  targetCountries: ['Global'],
  language: 'English',
  plannedDurationSeconds: 540,
  aspectRatio: '16:9',
  creativeDirection: 'Cinematic documentary',
  autonomyMode: 'AI_ASSISTED',
  priority: 'MEDIUM',
  deadlineAt: '',
  budgetLimit: 100
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
}

export default function NewProjectPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState<{name: string; role?: string | null} | null>(null);
  const router = useRouter();

  useEffect(() => {
    apiFetch<{name: string; role?: string | null}>('/api/auth/me')
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const set = (k: keyof Form, v: any) => setForm(f => ({...f, [k]: v}));
  const valid = () => step !== 0 || form.workingTitle.trim().length >= 3;

  const next = () => {
    if (!valid()) {
      setError('Enter a working title with at least 3 characters.');
      return;
    }
    setError('');
    setStep(s => Math.min(4, s + 1));
  };

  const create = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        deadlineAt: form.deadlineAt ? new Date(form.deadlineAt).toISOString() : undefined,
        distributionTargets: [{
          platform: form.primaryPlatform,
          contentFormat: form.contentType,
          isPrimary: true,
          aspectRatio: form.aspectRatio,
          targetDurationSeconds: form.plannedDurationSeconds
        }]
      };
      const p: any = await apiFetch('/api/projects', {method: 'POST', body: JSON.stringify(payload)});
      router.push(`/projects/${p.ContentProjectId}`);
    } catch (e: any) {
      setError(e.message || 'Could not create project. If the API is not running, start the MSSQL/API services first.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      eyebrow="CONTENT OPERATIONS / PROJECTS"
      title="Create Content Project"
      actions={<Link href="/projects" className="btn secondary link-btn">Cancel</Link>}
    >
      <div className="wizard-layout">
        <aside className="wizard-rail">
          <div className="wizard-intro">
            <span className="eyebrow">NEW MASTER RECORD</span>
            <h2>Set the project foundation once.</h2>
            <p>These fields become governed inputs for every downstream production module.</p>
          </div>
          <ol>
            {steps.map((s, i) => (
              <li key={s} className={i === step ? 'active' : i < step ? 'done' : ''}>
                <span>{i < step ? '✓' : i + 1}</span>
                <div>
                  <b>{s}</b>
                  <small>{i < step ? 'Completed' : i === step ? 'Current step' : 'Not started'}</small>
                </div>
              </li>
            ))}
          </ol>
          <div className="wizard-rule">
            <b>Pipeline rule</b>
            <p>Module 04 cannot begin until this project master record exists and its initiation data is saved.</p>
          </div>
        </aside>

        <section className="wizard-main">
          <div className="wizard-head">
            <div>
              <span>Step {step + 1} of {steps.length}</span>
              <h2>{steps[step]}</h2>
            </div>
            <span className="save-state">● Draft autosave ready</span>
          </div>
          {error && <div className="form-error">! {error}</div>}
          {step === 0 && <Basics f={form} set={set} />}
          {step === 1 && <Audience f={form} set={set} />}
          {step === 2 && <Creative f={form} set={set} />}
          {step === 3 && <Governance f={form} set={set} ownerName={me?.name} ownerRole={me?.role} />}
          {step === 4 && <Review f={form} />}
          <div className="wizard-actions">
            <button className="btn secondary" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>← Back</button>
            <div>
              <span>
                {step < 4
                  ? 'You can change these settings later in Project Workspace.'
                  : 'Creating initializes all 22 workflow stages as Not Started.'}
              </span>
              {step < 4
                ? <button className="btn primary" onClick={next}>Continue →</button>
                : <button className="btn primary" disabled={saving} onClick={create}>
                    {saving ? 'Creating…' : 'Create project & initialize workflow'}
                  </button>}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Field({label, help, children, wide = false}: {label: string; help?: string; children: any; wide?: boolean}) {
  return (
    <label className={`form-field ${wide ? 'wide' : ''}`}>
      <b>{label}</b>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}

function Basics({f, set}: {f: Form; set: any}) {
  return (
    <div className="wizard-section">
      <div className="section-note">
        <b>Master content identity</b>
        <p>A unique `CAC-YYYY-######` content code will be generated automatically when the project is created.</p>
      </div>
      <div className="form-grid">
        <Field label="Working title" wide help="Use a clear internal title. SEO title variants come later.">
          <input value={f.workingTitle} onChange={e => set('workingTitle', e.target.value)} placeholder="e.g. The Hidden AI Already Running Your Everyday Life" />
        </Field>
        <Field label="Project description" wide>
          <textarea value={f.description} onChange={e => set('description', e.target.value)} placeholder="Describe the story, problem or idea in 2–4 sentences." />
        </Field>
        <Field label="Content type">
          <select value={f.contentType} onChange={e => set('contentType', e.target.value)}>
            <option>Long Form</option>
            <option>Short Form</option>
            <option>Documentary</option>
            <option>Drama / Film</option>
            <option>Explainer</option>
            <option>Social Post</option>
          </select>
        </Field>
        <Field label="Category">
          <select value={f.category} onChange={e => set('category', e.target.value)}>
            <option>AI & Technology</option>
            <option>Cybersecurity</option>
            <option>Science</option>
            <option>Business & Work</option>
            <option>Human Stories</option>
            <option>Nigeria & Africa</option>
            <option>Global Stories</option>
          </select>
        </Field>
        <Field label="Primary objective">
          <select value={f.objective} onChange={e => set('objective', e.target.value)}>
            <option>Educate</option>
            <option>Entertain</option>
            <option>Reach new viewers</option>
            <option>Drive watch time</option>
            <option>Grow subscribers</option>
            <option>Generate leads</option>
            <option>Brand awareness</option>
          </select>
        </Field>
        <Field label="Primary platform">
          <select value={f.primaryPlatform} onChange={e => set('primaryPlatform', e.target.value)}>
            <option>YouTube</option>
            <option>YouTube Shorts</option>
            <option>TikTok</option>
            <option>Instagram</option>
            <option>Facebook</option>
            <option>X</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

function Audience({f, set}: {f: Form; set: any}) {
  const countries = ['Global', 'Nigeria', 'United States', 'United Kingdom', 'Canada', 'Australia', 'South Africa', 'Ghana'];
  return (
    <div className="wizard-section">
      <div className="section-note">
        <b>Audience & distribution contract</b>
        <p>This information flows into opportunity scoring, research framing, script tone, visual direction and publishing variants.</p>
      </div>
      <div className="form-grid">
        <Field label="Target audience" wide>
          <textarea value={f.targetAudience} onChange={e => set('targetAudience', e.target.value)} />
        </Field>
        <Field label="Language">
          <select value={f.language} onChange={e => set('language', e.target.value)}>
            <option>English</option>
            <option>Neutral Nigerian English</option>
            <option>French</option>
          </select>
        </Field>
        <Field label="Aspect ratio">
          <select value={f.aspectRatio} onChange={e => set('aspectRatio', e.target.value)}>
            <option>16:9</option>
            <option>9:16</option>
            <option>1:1</option>
            <option>4:5</option>
          </select>
        </Field>
        <Field label="Planned duration (seconds)">
          <input type="number" value={f.plannedDurationSeconds} onChange={e => set('plannedDurationSeconds', Number(e.target.value))} />
        </Field>
        <Field label="Primary platform">
          <input value={f.primaryPlatform} readOnly />
        </Field>
        <Field label="Target countries" wide>
          <div className="choice-grid">
            {countries.map(c => (
              <button
                type="button"
                key={c}
                className={f.targetCountries.includes(c) ? 'selected' : ''}
                onClick={() => set(
                  'targetCountries',
                  f.targetCountries.includes(c)
                    ? f.targetCountries.filter(x => x !== c)
                    : [...f.targetCountries, c]
                )}
              >
                {f.targetCountries.includes(c) ? '✓ ' : ''}{c}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

function Creative({f, set}: {f: Form; set: any}) {
  return (
    <div className="wizard-section">
      <div className="section-note">
        <b>Human controls remain authoritative</b>
        <p>Autonomy determines what agents may execute automatically. Mandatory human approval gates remain enforceable by workflow rules.</p>
      </div>
      <div className="form-grid">
        <Field label="Creative direction" wide>
          <div className="choice-grid creative">
            {['Cinematic documentary', 'Premium explainer', 'Realistic social cinema', 'News-style documentary', 'Comedy / drama', 'Tutorial / screen-led'].map(c => (
              <button type="button" key={c} className={f.creativeDirection === c ? 'selected' : ''} onClick={() => set('creativeDirection', c)}>
                {c}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Autonomy mode" wide>
          <div className="autonomy-options">
            {[
              {k: 'MANUAL', t: 'Manual', d: 'AI recommends; human executes each stage.'},
              {k: 'AI_ASSISTED', t: 'AI Assisted', d: 'AI generates; human approves key outputs.'},
              {k: 'SEMI_AUTONOMOUS', t: 'Semi-Autonomous', d: 'Agents execute permitted stages until a human gate.'},
              {k: 'AUTONOMOUS', t: 'Autonomous', d: 'Agents run approved workflows within governance limits.'}
            ].map(x => (
              <button type="button" key={x.k} className={f.autonomyMode === x.k ? 'selected' : ''} onClick={() => set('autonomyMode', x.k)}>
                <span>{f.autonomyMode === x.k ? '●' : '○'}</span>
                <div><b>{x.t}</b><small>{x.d}</small></div>
              </button>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

function Governance({f, set, ownerName, ownerRole}: {f: Form; set: any; ownerName?: string; ownerRole?: string | null}) {
  const name = ownerName || 'Signed-in user';
  return (
    <div className="wizard-section">
      <div className="section-note">
        <b>Delivery governance</b>
        <p>Priority, deadline and budget are visible to agents, human reviewers, the Command Center and future cost controls.</p>
      </div>
      <div className="form-grid">
        <Field label="Priority">
          <select value={f.priority} onChange={e => set('priority', e.target.value)}>
            <option>LOW</option>
            <option>MEDIUM</option>
            <option>HIGH</option>
            <option>URGENT</option>
          </select>
        </Field>
        <Field label="Deadline">
          <input type="datetime-local" value={f.deadlineAt} onChange={e => set('deadlineAt', e.target.value)} />
        </Field>
        <Field label="Generation budget (USD)">
          <input type="number" min="0" step="5" value={f.budgetLimit} onChange={e => set('budgetLimit', Number(e.target.value))} />
        </Field>
        <Field label="Project owner">
          <div className="owner-picker">
            <span className="avatar tiny">{initials(name)}</span>
            <div>
              <b>{name}</b>
              <small>{ownerRole || 'Member'} · creator</small>
            </div>
          </div>
        </Field>
      </div>
      <div className="governance-card">
        <div>
          <span>✓</span>
          <div>
            <b>22-stage workflow will be initialized</b>
            <p>All stages start as <strong>Not Started</strong>. Human Start from Command Center or Project Workspace begins execution.</p>
          </div>
        </div>
        <div>
          <span>✓</span>
          <div>
            <b>Audit and version history enabled</b>
            <p>Creation, changes, approvals and handoffs are recorded.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Review({f}: {f: Form}) {
  return (
    <div className="wizard-section review-step">
      <div className="review-banner">
        <div>CC</div>
        <div>
          <span>PROJECT READY TO CREATE</span>
          <h2>{f.workingTitle || 'Untitled content project'}</h2>
          <p>The project will become the parent record for all research, scripts, scenes, generated assets, approvals, releases and analytics.</p>
        </div>
      </div>
      <div className="review-grid">
        <ReviewBox title="Content">
          <Row l="Type" v={f.contentType} />
          <Row l="Category" v={f.category} />
          <Row l="Objective" v={f.objective} />
          <Row l="Direction" v={f.creativeDirection} />
        </ReviewBox>
        <ReviewBox title="Audience & release">
          <Row l="Platform" v={f.primaryPlatform} />
          <Row l="Audience" v={f.targetAudience} />
          <Row l="Countries" v={f.targetCountries.join(', ')} />
          <Row l="Format" v={`${f.aspectRatio} · ${Math.ceil(f.plannedDurationSeconds / 60)} min planned`} />
        </ReviewBox>
        <ReviewBox title="Governance">
          <Row l="Autonomy" v={f.autonomyMode.replaceAll('_', ' ')} />
          <Row l="Priority" v={f.priority} />
          <Row l="Budget" v={`$${f.budgetLimit.toFixed(2)}`} />
          <Row l="Deadline" v={f.deadlineAt ? new Date(f.deadlineAt).toLocaleString() : 'Not set'} />
        </ReviewBox>
      </div>
      <div className="handoff-preview">
        <span>PROJECT MASTER</span>
        <b>→</b>
        <span>MODULE 04 · STRATEGY & BRIEF</span>
        <p>After creation, Module 04 will consume this project context and produce the first versioned Content Brief.</p>
      </div>
    </div>
  );
}

function ReviewBox({title, children}: {title: string; children: any}) {
  return <section className="review-box"><h3>{title}</h3>{children}</section>;
}

function Row({l, v}: {l: string; v: string}) {
  return <div className="review-row"><span>{l}</span><b>{v || '—'}</b></div>;
}
