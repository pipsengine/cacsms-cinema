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
        versionId?: string | null;
        action: string;
        actorType: string;
        actorReference?: string | null;
        requestId?: string | null;
        correlationId?: string | null;
        previousValue?: string | null;
        newValue?: string | null;
        createdAt: string;
        reason: string | null;
      }>
    >(`/strategy/versions/${versionId}/audit`),
  strategyAudit: () =>
    request<
      Array<{
        id: string;
        versionId: string | null;
        versionNumber: number | null;
        versionStatus: string | null;
        action: string;
        actorType: string;
        actorReference: string | null;
        requestId: string | null;
        correlationId: string | null;
        previousValue: string | null;
        newValue: string | null;
        reason: string | null;
        createdAt: string;
      }>
    >('/strategy/audit'),
  validation: (versionId: string) =>
    request<{
      run: {
        id: string;
        status: string;
        startedAt: string;
        completedAt: string | null;
        summary: Record<string, unknown> | null;
      } | null;
      results: Array<{
        id: string;
        ruleCode: string;
        ruleVersion: number;
        severity: string;
        passed: boolean;
        blocking: boolean;
        sectionKey: string | null;
        explanation: string;
        recommendation: string | null;
        checkedAt: string;
      }>;
    }>(`/strategy/versions/${versionId}/validation`),
  versions: () =>
    request<{
      strategyId: string | null;
      currentVersionId: string | null;
      versions: Array<{
        id: string;
        versionNumber: number;
        status: string;
        effectiveDate: string | null;
        lastValidatedAt: string | null;
        createdAt: string;
        updatedAt: string;
        checksum: string | null;
        recordCount: number;
        sectionCount: number;
        sectionCounts: Record<string, number>;
        createdBy: string;
        createAction: string | null;
        createReason: string | null;
      }>;
    }>('/strategy/versions'),
  compareVersions: (leftId: string, rightId: string) =>
    request<{
      leftId: string;
      rightId: string;
      modules: Array<{
        section: string;
        label: string;
        leftCount: number;
        rightCount: number;
        added: string[];
        removed: string[];
        unchanged: number;
        modified: number;
      }>;
      totals: { added: number; removed: number; unchanged: number };
    }>(`/strategy/versions/compare?left=${encodeURIComponent(leftId)}&right=${encodeURIComponent(rightId)}`),
  rollback: (versionId: string) =>
    request<{
      id: string;
      versionNumber: number;
      status: string;
      sourceVersionId: string;
      clonedRecords: number;
    }>(`/strategy/versions/${versionId}/rollback`, {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
    }),
};
