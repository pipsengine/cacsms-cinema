'use client';

import { useEffect, useState } from 'react';

export interface Job {
  id: string;
  projectId: string;
  sceneId?: string;
  status: string;
  priority: number;
  budget?: number;
  createdAt: string;
  updatedAt: string;
  project?: any;
  attempts?: any[];
  candidates?: any[];
}

export function useJobs(filters?: { status?: string; projectId?: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const params = new URLSearchParams();
        if (filters?.status) params.append('status', filters.status);
        if (filters?.projectId) params.append('projectId', filters.projectId);

        const response = await fetch(`/api/jobs?${params}`);
        if (!response.ok) throw new Error('Failed to fetch jobs');

        const data = await response.json();
        setJobs(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
    const interval = setInterval(fetchJobs, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [filters?.status, filters?.projectId]);

  return { jobs, loading, error };
}

export function useJob(jobId: string) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const fetchJob = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) throw new Error('Failed to fetch job');

        const data = await response.json();
        setJob(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
    const interval = setInterval(fetchJob, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [jobId]);

  return { job, loading, error };
}

export async function createJob(projectId: string, data: any) {
  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, ...data }),
  });

  if (!response.ok) throw new Error('Failed to create job');
  return response.json();
}

export async function updateJobStatus(jobId: string, status: string) {
  const response = await fetch(`/api/jobs/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) throw new Error('Failed to update job');
  return response.json();
}
