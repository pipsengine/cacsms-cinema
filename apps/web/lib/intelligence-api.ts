import type { IntelligenceOverview, Opportunity, SectionKey } from '@/lib/content-intelligence/contracts';

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

export const intelligenceApi = {
  overview: () => request<IntelligenceOverview>('/content-intelligence/overview'),
  list: (section: SectionKey) =>
    request<Opportunity[]>(`/content-intelligence/${section}`),
  run: () =>
    request<{ runId: string; status: string }>('/content-intelligence/runs', {
      method: 'POST',
      body: '{}',
      headers: { 'idempotency-key': crypto.randomUUID() },
    }),
  consumeActiveStrategy: () =>
    request<{ status: string; checksum: string }>(
      '/content-intelligence/strategy-packages/consume',
      { method: 'POST', body: '{}' },
    ),
};
