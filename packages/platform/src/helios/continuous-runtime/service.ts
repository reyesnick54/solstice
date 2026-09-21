import { randomUUID } from 'node:crypto';

import type { Clock } from '../../../../config/src/clock.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { evaluateMandateEligibility } from './mandate-gate.ts';
import { runBoundedCycle } from './cycle.ts';
import { HeliosRuntimeScheduler } from './scheduler.ts';
import { HeliosRuntimeSupervision } from './supervision.ts';
import { InMemoryHeliosRuntimeStore } from './store.ts';
import type {
  HeliosRuntimePorts,
  MandateFundingState,
  MandateRuntimeConfig,
  MandateRuntimeRegistration,
  RuntimeStoreSnapshot,
  TickOnceResult,
} from './types.ts';

export type RegisterMandateInput = {
  readonly customerId: string;
  readonly subjectId: string;
  readonly mandateId: string;
  readonly workOrderId: string;
  readonly fundingState: MandateFundingState;
  readonly config: MandateRuntimeConfig;
};

export class HeliosContinuousRuntimeService {
  readonly store: InMemoryHeliosRuntimeStore;
  private readonly clock: Clock;
  private readonly scheduler: HeliosRuntimeScheduler;
  readonly supervision: HeliosRuntimeSupervision;
  private readonly ports: HeliosRuntimePorts;
  private readonly workerId: string;

  constructor(input: {
    readonly clock: Clock;
    readonly ports: HeliosRuntimePorts;
    readonly workerId?: string;
    readonly store?: InMemoryHeliosRuntimeStore;
  }) {
    this.clock = input.clock;
    this.ports = input.ports;
    this.workerId = input.workerId ?? `helios-runtime-${randomUUID().slice(0, 8)}`;
    this.store = input.store ?? new InMemoryHeliosRuntimeStore();
    this.scheduler = new HeliosRuntimeScheduler({
      clock: this.clock,
      store: this.store,
      workerId: this.workerId,
    });
    this.supervision = new HeliosRuntimeSupervision({ clock: this.clock, store: this.store });
  }

  now(): UtcInstant {
    return this.clock.now();
  }

  registerMandate(input: RegisterMandateInput): MandateRuntimeRegistration {
    const registration = Object.freeze({
      registrationId: `hmr_${randomUUID()}`,
      customerId: input.customerId,
      subjectId: input.subjectId,
      mandateId: input.mandateId,
      workOrderId: input.workOrderId,
      fundingState: input.fundingState,
      config: input.config,
      registeredAt: this.now(),
      active: true,
    });
    this.store.putRegistration(registration);
    this.scheduler.seedInitialSchedule(registration);
    return registration;
  }

  deactivateMandate(registrationId: string): void {
    const existing = this.store.getRegistration(registrationId);
    if (!existing) return;
    this.store.putRegistration(Object.freeze({ ...existing, active: false }));
  }

  recoverAfterRestart(): readonly MandateRuntimeRegistration[] {
    const recoveredLeases = this.scheduler.recoverExpiredLeases();
    if (recoveredLeases.length > 0) {
      return this.store.listActiveRegistrations();
    }
    return Object.freeze([]);
  }

  async tickOnce(input?: { readonly limit?: number }): Promise<TickOnceResult> {
    const startMs = Date.now();
    this.scheduler.recoverExpiredLeases();

    let processed = 0;
    let skipped = 0;
    let duplicates = 0;
    let cyclesCompleted = 0;
    let noActions = 0;

    const claimed = this.scheduler.claimDueWork(input?.limit ?? 10);
    for (const { item, queueLatencyMs } of claimed) {
      this.store.recordQueueLatency(queueLatencyMs);
      const registration = this.store.getRegistration(item.registrationId);
      if (!registration || !registration.active) {
        this.scheduler.completeWork(item.scheduleId);
        skipped += 1;
        continue;
      }

      const supervision = this.supervision.evaluate(registration);
      if (supervision.blocked && !supervision.exitOnly) {
        this.scheduler.completeWork(item.scheduleId);
        this.scheduleFollowUp(registration, item.cadenceProfile);
        skipped += 1;
        continue;
      }

      if (
        !this.scheduler.shouldRunProfile({
          profile: item.cadenceProfile,
          assetClasses: registration.config.assetClasses,
          marketSessionOpen: (assetClass) => this.ports.marketSessionOpen({ assetClass, now: this.now() }),
        })
      ) {
        this.scheduler.completeWork(item.scheduleId);
        this.scheduleFollowUp(registration, item.cadenceProfile);
        skipped += 1;
        continue;
      }

      const mandate = this.ports.mandateLookup(registration.mandateId);
      const eligibility = evaluateMandateEligibility({
        registration,
        mandate,
        ports: this.ports,
        now: this.now(),
      });

      if (!eligibility.eligible && !supervision.exitOnly) {
        this.scheduler.completeWork(item.scheduleId);
        this.scheduleFollowUp(registration, item.cadenceProfile);
        if (eligibility.runtimeState === 'IDLE' || eligibility.runtimeState === 'WAITING_FOR_MARKET') {
          noActions += 1;
          this.store.incrementMetric('noActionDecisions');
        }
        skipped += 1;
        continue;
      }

      const resumeFrom = this.store.getIncompleteCycle(registration.registrationId);
      const cycleStartMs = Date.now();
      const cycle = runBoundedCycle({
        store: this.store,
        registration,
        ports: this.ports,
        now: this.now(),
        runtimeState: eligibility.eligible ? 'ACTIVE' : eligibility.runtimeState,
        exitOnly: supervision.exitOnly,
        ...(resumeFrom ? { resumeFrom } : {}),
        mandateLookup: this.ports.mandateLookup,
      });
      this.store.recordDecisionLatency(Date.now() - cycleStartMs);

      if (cycle.outcome === 'NO_ACTION') noActions += 1;
      if (cycle.completedAt) cyclesCompleted += 1;

      this.scheduler.completeWork(item.scheduleId);
      this.scheduleFollowUp(registration, item.cadenceProfile);
      processed += 1;
    }

    this.store.recordDecisionLatency(Date.now() - startMs);
    return Object.freeze({ processed, skipped, duplicates, cyclesCompleted, noActions });
  }

  snapshot(): RuntimeStoreSnapshot {
    return this.store.snapshot();
  }

  static fromSnapshot(input: {
    readonly clock: Clock;
    readonly ports: HeliosRuntimePorts;
    readonly snapshot: RuntimeStoreSnapshot;
    readonly workerId?: string;
  }): HeliosContinuousRuntimeService {
    const store = InMemoryHeliosRuntimeStore.fromSnapshot(input.snapshot);
    return new HeliosContinuousRuntimeService({
      clock: input.clock,
      ports: input.ports,
      store,
      ...(input.workerId ? { workerId: input.workerId } : {}),
    });
  }

  private scheduleFollowUp(
    registration: MandateRuntimeRegistration,
    cadenceProfile: MandateRuntimeRegistration['config']['cadenceProfiles'][number],
  ): void {
    const idempotencyKey = `tick:${registration.registrationId}:${cadenceProfile}:${this.now()}`;
    const result = this.scheduler.scheduleNext({
      registration,
      cadenceProfile,
      idempotencyKey,
    });
    if (result === 'DUPLICATE') {
      this.store.incrementMetric('noActionDecisions');
    }
  }
}

export function defaultPermissivePorts(
  overrides: Partial<HeliosRuntimePorts> = {},
): HeliosRuntimePorts {
  return Object.freeze({
    mandateLookup: () => undefined,
    marketSessionOpen: () => true,
    marketDataFresh: () => true,
    providerAvailable: () => true,
    reconciliationRequired: () => false,
    riskPermitsNewEntries: () => true,
    compliancePermitsAction: () => true,
    qualifiedOpportunityExists: () => true,
    strategyEligible: () => true,
    growDeploymentPaused: () => false,
    ...overrides,
  });
}
