import type {
  Candidate,
  QualificationOverview,
  SectionKey,
} from '@/lib/idea-qualification/contracts';

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
