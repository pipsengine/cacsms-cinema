import { prisma } from './db';

export interface SystemStatus {
  isHealthy: boolean;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  exceptionJobs: number;
  averageProcessingTime: number;
  systemState: string;
  systemUptime: string;
  lastChecked: Date;
}

export class SystemStatusMonitor {
  private static startTime = new Date();

  static async getStatus(): Promise<SystemStatus> {
    try {
      const [statusCounts, attemptMetrics, control] = await Promise.all([
        prisma.job.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
        prisma.generationAttempt.aggregate({ where: { durationMs: { not: null } }, _avg: { durationMs: true } }),
        prisma.systemControl.findUnique({ where: { id: 'global' } }),
      ]);
      const counts = new Map(statusCounts.map((entry) => [entry.status, entry._count._all]));
      const activeJobs = statusCounts.filter((entry) => !['COMPLETED', 'FAILED', 'CANCELLED', 'HUMAN_EXCEPTION_REQUIRED'].includes(entry.status)).reduce((sum, entry) => sum + entry._count._all, 0);
      const completedJobs = counts.get('COMPLETED') || 0;
      const failedJobs = counts.get('FAILED') || 0;
      const exceptionJobs = counts.get('HUMAN_EXCEPTION_REQUIRED') || 0;
      const averageProcessingTime = attemptMetrics._avg.durationMs || 0;

      const uptime = this.calculateUptime();

      return {
        isHealthy: failedJobs === 0 && exceptionJobs === 0,
        activeJobs,
        completedJobs,
        failedJobs,
        exceptionJobs,
        averageProcessingTime,
        systemState: control?.desiredState || 'STOPPED',
        systemUptime: uptime,
        lastChecked: new Date(),
      };
    } catch (error) {
      console.error('Failed to get system status:', error);
      return {
        isHealthy: false,
        activeJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        exceptionJobs: 0,
        averageProcessingTime: 0,
        systemState: 'UNKNOWN',
        systemUptime: '0h',
        lastChecked: new Date(),
      };
    }
  }

  private static calculateUptime(): string {
    const now = new Date();
    const diffMs = now.getTime() - this.startTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }
}
