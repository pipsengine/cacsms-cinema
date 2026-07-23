import { prisma } from '@/lib/db';
import { IntelligenceService } from '@/lib/content-intelligence/service';
import { QualificationService } from '@/lib/idea-qualification/service';
import { ResearchService } from '@/lib/research-evidence/service';
import { REQUIRED_SECTIONS, isMutableStrategyStatus, type SectionKey } from '@/lib/strategy/contracts';
import { StrategyRepository } from '@/lib/strategy/repository';
import { StrategyService } from '@/lib/strategy/service';

/**
 * Advances content lifecycle stages while SystemControl.desiredState === RUNNING.
 * Humans only Start/Stop globally; this worker iterates stages without per-page triggers.
 */
export class ContentLifecycleOrchestrator {
  private static lastTickAt = 0;
  private static readonly MIN_TICK_MS = 2500;

  /**
   * Allow an immediate tick after Start even if the worker recently polled.
   */
  static async tick(options?: { force?: boolean }): Promise<void> {
    if (!process.env.DATABASE_URL) return;

    const now = Date.now();
    if (!options?.force && now - this.lastTickAt < this.MIN_TICK_MS) return;
    this.lastTickAt = now;

    const control = await prisma.systemControl.findUnique({ where: { id: 'global' } });
    if (control?.desiredState !== 'RUNNING') return;

    const cycleKey = `lifecycle-v${control.version ?? 0}`;
    const steps: Array<{ name: string; run: () => Promise<unknown> }> = [
      { name: 'strategy', run: () => this.advanceStrategy(cycleKey) },
      { name: 'content-intelligence', run: () => this.advanceContentIntelligence(cycleKey) },
      { name: 'idea-qualification', run: () => this.advanceIdeaQualification(cycleKey) },
      { name: 'research-evidence', run: () => this.advanceResearch(cycleKey) },
    ];

    for (const step of steps) {
      const stillRunning = await prisma.systemControl.findUnique({ where: { id: 'global' } });
      if (stillRunning?.desiredState !== 'RUNNING') {
        await this.requestStrategyStop();
        return;
      }
      try {
        await step.run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[lifecycle] ${step.name}: ${message}`);
        // Fail-closed per stage: wait for evidence/providers on later ticks; do not fabricate.
        break;
      }
    }
  }

  private static async requestStrategyStop() {
    try {
      const service = new StrategyService();
      await service.stopObjectivesRun();
    } catch {
      // best-effort
    }
  }

  private static async advanceStrategy(cycleKey: string) {
    const repo = new StrategyRepository();
    const service = new StrategyService();
    await repo.ensureDraft();

    const overview = await repo.overview();
    if (!overview.versionId) return { status: 'NO_VERSION' };

    if (overview.status === 'ACTIVE') {
      return { status: 'ACTIVE', versionId: overview.versionId };
    }

    if (!isMutableStrategyStatus(overview.status)) {
      return { status: overview.status };
    }

    await service.startObjectivesRun(`${cycleKey}-objectives`);
    await service.reconcileDomains(overview.versionId);
    await this.ensureMandatorySectionStubs(overview.versionId);

    await service.validate(overview.versionId, `${cycleKey}-validate`);
    const afterValidate = await repo.overview();
    if (afterValidate.status === 'READY' && afterValidate.versionId) {
      await service.activate(afterValidate.versionId, `${cycleKey}-activate`);
      return { status: 'ACTIVE' };
    }
    return { status: afterValidate.status };
  }

  private static async ensureMandatorySectionStubs(versionId: string) {
    const repo = new StrategyRepository();
    for (const section of REQUIRED_SECTIONS) {
      if (section === 'objectives' || section === 'domains') continue;
      const existing = await repo.list(versionId, section);
      const hasActive = existing.some((record) => record.status === 'ACTIVE');
      if (hasActive) continue;

      await repo.create(versionId, section, {
        name: labelForSection(section),
        description: `System policy stub for ${section}. No production metrics were fabricated.`,
        status: 'ACTIVE',
        priority: 50,
        configuration: {
          systemKey: `policy.${section}`,
          origin: 'SYSTEM_POLICY',
          baselineValue: 'UNMEASURED',
          targetValue: 'UNMEASURED',
        },
        effectiveFrom: null,
        effectiveTo: null,
      });
    }
  }

  private static async advanceContentIntelligence(cycleKey: string) {
    const service = new IntelligenceService();
    await service.consumeStrategy({});
    return service.startRun(`${cycleKey}-ci`);
  }

  private static async advanceIdeaQualification(cycleKey: string) {
    const service = new QualificationService();
    await service.consumeIntake({});
    return service.startCycle(`${cycleKey}-iq`);
  }

  private static async advanceResearch(cycleKey: string) {
    const service = new ResearchService();
    await service.consumeIntake({});
    return service.startCycle(`${cycleKey}-re`);
  }
}

function labelForSection(key: SectionKey) {
  return key.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
