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
