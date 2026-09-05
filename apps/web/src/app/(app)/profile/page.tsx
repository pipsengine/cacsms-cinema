'use client';
import {useEffect, useState} from 'react';
import {AppShell} from '@/components/app-shell';
import {SectionCard, Status} from '@/components/ui';
import {apiFetch} from '@/lib/api';

type Me = {id: string; email: string; name: string; mfaEnabled: boolean; lastLoginAt?: string | null; role?: string | null};

export default function Profile() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<Me>('/api/auth/me').then(setMe).catch(e => setError(e instanceof Error ? e.message : 'Unable to load profile'));
  }, []);

  const initials = (me?.name || '?').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AppShell title="Profile & Security">
      {error && <div className="notice red">{error}</div>}
      <div className="profile-grid">
        <div className="profile-main">
          <SectionCard title="Personal information" subtitle="Your identity is used in approvals, assignments and the audit trail.">
            <div className="profile-hero"><div className="avatar huge">{initials}</div><div><p>Loaded from your account in Microsoft SQL Server.</p></div></div>
            <div className="form-grid">
              <label>Display name<input value={me?.name || ''} readOnly/></label>
              <label>Email address<input value={me?.email || ''} disabled/></label>
              <label>Role<input value={me?.role || '—'} readOnly/></label>
              <label>Last sign-in<input value={me?.lastLoginAt ? new Date(me.lastLoginAt).toLocaleString() : '—'} readOnly/></label>
            </div>
          </SectionCard>
          <SectionCard title="Sign-in security" subtitle="Account protection status from the live database.">
            <div className="setting-list">
              <div><span className="setting-icon">✦</span><div><b>Multi-factor authentication</b><p>{me?.mfaEnabled ? 'Authenticator protection is enabled.' : 'MFA is not enabled.'}</p></div><Status tone={me?.mfaEnabled ? 'green' : 'gray'}>{me?.mfaEnabled ? 'Enabled' : 'Off'}</Status></div>
            </div>
          </SectionCard>
        </div>
        <aside>
          <SectionCard title="Account access">
            <div className="info-stack">
              <span>Email</span><b>{me?.email || '—'}</b>
              <span>Role</span><b>{me?.role || '—'}</b>
              <span>Account status</span><Status>Active</Status>
            </div>
          </SectionCard>
        </aside>
      </div>
    </AppShell>
  );
}
