import type {
  ResearchOverview,
  ResearchRecord,
  SectionKey,
} from '@/lib/research-evidence/contracts';

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

export const researchApi = {
  overview: () => request<ResearchOverview>('/research-evidence/overview'),
  list: (section: SectionKey) =>
    request<ResearchRecord[]>(`/research-evidence/${section}`),
  run: () =>
    request<{ runId: string; status: string }>('/research-evidence/runs', {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: '{}',
    }),
  consumeIntake: () =>
    request<{ status: string; checksum: string }>('/research-evidence/intake/consume', {
      method: 'POST',
      body: '{}',
    }),
  handoff: (id: string) =>
    request(`/research-evidence/dossiers/${id}/handoff`, {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: '{}',
    }),
};
