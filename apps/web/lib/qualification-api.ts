import type {
  Candidate,
  QualificationOverview,
  SectionKey,
} from '@/lib/idea-qualification/contracts';
import type { IntelligenceIntakeOverview } from '@/lib/idea-qualification/intake';
import type { CandidatePoolOverview } from '@/lib/idea-qualification/candidate-pool';
import type { EvidenceSufficiencyOverview } from '@/lib/idea-qualification/evidence';
import type { StrategicFitOverview } from '@/lib/idea-qualification/strategic-fit';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    let detail = '';
    try {
      detail = ((await response.json()) as { message?: string }).message ?? '';
    } catch {
      detail = '';
    }
    throw new Error(detail || `Service returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const qualificationApi = {
  overview: () => request<QualificationOverview>('/idea-qualification/overview'),
  intake: () => request<IntelligenceIntakeOverview>('/idea-qualification/intake'),
  candidatePool: () =>
    request<CandidatePoolOverview>('/idea-qualification/candidate-pool'),
  evidence: () =>
    request<EvidenceSufficiencyOverview>('/idea-qualification/evidence'),
  strategicFit: () =>
    request<StrategicFitOverview>('/idea-qualification/strategic-fit'),
  list: (section: SectionKey) =>
    request<Candidate[]>(`/idea-qualification/${section}`),
  run: () =>
    request<{ cycleId: string; status: string }>('/idea-qualification/cycles', {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: '{}',
    }),
  consumeIntake: () =>
    request<{ status: string; checksum: string }>('/idea-qualification/intake/consume', {
      method: 'POST',
      body: '{}',
    }),
  handoff: (id: string) =>
    request(`/idea-qualification/candidates/${id}/handoff`, {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: '{}',
    }),
};
