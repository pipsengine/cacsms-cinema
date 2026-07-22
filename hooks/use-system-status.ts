'use client';

import { useEffect, useState } from 'react';

export interface SystemStatus {
  isHealthy: boolean;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  systemUptime: string;
  lastChecked: string;
}

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/system/status');
        if (!response.ok) throw new Error('Failed to fetch status');

        const data = await response.json();
        setStatus(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return { status, loading, error };
}
