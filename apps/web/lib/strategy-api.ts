import type { SectionKey, StrategyOverview, StrategyRecord } from '@/lib/strategy/contracts';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ message: res.statusText }))) as {
      message?: string;
    };
    throw new Error(body.message || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const strategyApi = {
  overview: () => request<StrategyOverview>('/strategy/overview'),
  list: (versionId: string, section: SectionKey) =>
    request<StrategyRecord[]>(`/strategy/versions/${versionId}/${section}`),
  create: (versionId: string, section: SectionKey, data: StrategyRecord) =>
    request<StrategyRecord>(`/strategy/versions/${versionId}/${section}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (versionId: string, section: SectionKey, recordId: string, data: StrategyRecord) =>
    request<StrategyRecord>(`/strategy/versions/${versionId}/${section}/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  validate: (versionId: string) =>
    request(`/strategy/versions/${versionId}/validate`, {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
    }),
  activate: (versionId: string) =>
    request(`/strategy/versions/${versionId}/activate`, {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
    }),
  startObjectivesRun: () =>
    request<{ runId: string; status: string; created?: number; updated?: number }>(
      '/strategy/objectives/runs',
      {
        method: 'POST',
        body: '{}',
        headers: { 'idempotency-key': crypto.randomUUID() },
      },
    ),
  stopObjectivesRun: (runId?: string) =>
    request<{ runId: string | null; status: string }>('/strategy/objectives/runs/stop', {
      method: 'POST',
      body: JSON.stringify({ runId }),
    }),
  audit: (versionId: string) =>
    request<
      Array<{
        id: string;
        action: string;
        actorType: string;
        createdAt: string;
        reason: string | null;
      }>
    >(`/strategy/versions/${versionId}/audit`),
};
