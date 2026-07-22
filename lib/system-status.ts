import { prisma } from './db';

export interface SystemStatus {
  isHealthy: boolean;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  systemUptime: string;
  lastChecked: Date;
}

export class SystemStatusMonitor {
  private static startTime = new Date();

  static async getStatus(): Promise<SystemStatus> {
    try {
      const jobs = await prisma.job.findMany();
      const activeJobs = jobs.filter(j => 
        j.status !== 'COMPLETED' && j.status !== 'FAILED'
      ).length;
      const completedJobs = jobs.filter(j => j.status === 'COMPLETED').length;
      const failedJobs = jobs.filter(j => j.status === 'FAILED').length;

      const attempts = await prisma.generationAttempt.findMany();
      const completedAttempts = attempts.filter(a => a.durationMs).map(a => a.durationMs!);
      const averageProcessingTime = completedAttempts.length > 0
        ? completedAttempts.reduce((a, b) => a + b, 0) / completedAttempts.length
        : 0;

      const uptime = this.calculateUptime();

      return {
        isHealthy: failedJobs === 0 || (failedJobs / jobs.length) < 0.1,
        activeJobs,
        completedJobs,
        failedJobs,
        averageProcessingTime,
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
        averageProcessingTime: 0,
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
