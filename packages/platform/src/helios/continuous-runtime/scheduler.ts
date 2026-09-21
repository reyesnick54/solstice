import { randomUUID } from 'node:crypto';

import type { Clock } from '../../../../config/src/clock.ts';
import { addMs } from '../../../../config/src/clock.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { HeliosRuntimeCadenceProfile, HeliosRuntimeQueueKind } from './taxonomy.ts';
import { computeNextDueAt, InMemoryHeliosRuntimeStore } from './store.ts';
import type { MandateRuntimeRegistration, ScheduledWorkItem } from './types.ts';

const DEFAULT_LEASE_MS = 30_000;

export class HeliosRuntimeScheduler {
  private readonly clock: Clock;
  private readonly store: InMemoryHeliosRuntimeStore;
  private readonly workerId: string;

  constructor(input: {
    readonly clock: Clock;
    readonly store: InMemoryHeliosRuntimeStore;
    readonly workerId: string;
  }) {
    this.clock = input.clock;
    this.store = input.store;
    this.workerId = input.workerId;
  }

  now(): UtcInstant {
    return this.clock.now();
  }

  seedInitialSchedule(registration: MandateRuntimeRegistration): readonly ScheduledWorkItem[] {
    const created: ScheduledWorkItem[] = [];
    const now = this.now();
    for (const profile of registration.config.cadenceProfiles) {
      const item = this.buildScheduleItem({
        registration,
        queueKind: queueKindForProfile(profile),
        cadenceProfile: profile,
        dueAt: now,
        idempotencyKey: `seed:${registration.registrationId}:${profile}:${now}`,
      });
      const result = this.store.putScheduledWork(item);
      if (result !== 'DUPLICATE') {
        created.push(result);
      }
    }
    return Object.freeze(created);
  }

  scheduleNext(input: {
    readonly registration: MandateRuntimeRegistration;
    readonly cadenceProfile: HeliosRuntimeCadenceProfile;
    readonly idempotencyKey: string;
  }): ScheduledWorkItem | 'DUPLICATE' {
    const dueAt = computeNextDueAt(this.now(), input.cadenceProfile);
    const item = this.buildScheduleItem({
      registration: input.registration,
      queueKind: queueKindForProfile(input.cadenceProfile),
      cadenceProfile: input.cadenceProfile,
      dueAt,
      idempotencyKey: input.idempotencyKey,
    });
    return this.store.putScheduledWork(item);
  }

  claimDueWork(limit = 10): readonly { readonly item: ScheduledWorkItem; readonly queueLatencyMs: number }[] {
    const now = this.now();
    const due = this.store.listDueWork(now);
    const claimed: { item: ScheduledWorkItem; queueLatencyMs: number }[] = [];
    for (const candidate of due.slice(0, limit)) {
      const queueLatencyMs = Math.max(0, Date.parse(now) - Date.parse(candidate.dueAt));
      const claimedItem = Object.freeze({
        ...candidate,
        state: 'CLAIMED' as const,
        leaseWorkerId: this.workerId,
        leaseExpiresAt: addMs(now, DEFAULT_LEASE_MS),
      });
      this.store.updateScheduledWork(claimedItem);
      claimed.push({ item: claimedItem, queueLatencyMs });
    }
    return Object.freeze(claimed);
  }

  completeWork(scheduleId: string): ScheduledWorkItem | undefined {
    const row = this.store.getScheduledWork(scheduleId);
    if (!row) return undefined;
    const completed = Object.freeze({
      ...row,
      state: 'COMPLETED' as const,
      completedAt: this.now(),
      leaseWorkerId: null,
      leaseExpiresAt: null,
    });
    this.store.updateScheduledWork(completed);
    return completed;
  }

  skipDuplicate(scheduleId: string): void {
    const row = this.store.getScheduledWork(scheduleId);
    if (!row) return;
    this.store.updateScheduledWork(
      Object.freeze({
        ...row,
        state: 'DUPLICATE_SKIPPED',
        completedAt: this.now(),
        leaseWorkerId: null,
        leaseExpiresAt: null,
      }),
    );
  }

  recoverExpiredLeases(): readonly ScheduledWorkItem[] {
    return this.store.recoverExpiredLeases(this.now());
  }

  shouldRunProfile(input: {
    readonly profile: HeliosRuntimeCadenceProfile;
    readonly assetClasses: readonly string[];
    readonly marketSessionOpen: (assetClass: string) => boolean;
  }): boolean {
    switch (input.profile) {
      case 'CONTINUOUS_CRYPTO':
        return input.assetClasses.includes('CRYPTO');
      case 'EQUITY_SESSION':
        return input.assetClasses.some(
          (ac) => ac === 'EQUITY' || ac === 'ETF' || ac === 'INDEX',
        ) && input.marketSessionOpen('EQUITY');
      case 'FUTURES_SESSION':
        return input.assetClasses.some((ac) => ac === 'FUTURES' || ac === 'COMMODITY') &&
          input.marketSessionOpen('FUTURES');
      case 'RECONCILIATION_PERIODIC':
      case 'RISK_PERIODIC':
        return true;
      default:
        return true;
    }
  }

  private buildScheduleItem(input: {
    readonly registration: MandateRuntimeRegistration;
    readonly queueKind: HeliosRuntimeQueueKind;
    readonly cadenceProfile: HeliosRuntimeCadenceProfile;
    readonly dueAt: UtcInstant;
    readonly idempotencyKey: string;
  }): ScheduledWorkItem {
    return Object.freeze({
      scheduleId: `hrs_${randomUUID()}`,
      registrationId: input.registration.registrationId,
      customerId: input.registration.customerId,
      queueKind: input.queueKind,
      cadenceProfile: input.cadenceProfile,
      idempotencyKey: input.idempotencyKey,
      dueAt: input.dueAt,
      state: 'PENDING',
      createdAt: this.now(),
      completedAt: null,
      leaseWorkerId: null,
      leaseExpiresAt: null,
    });
  }
}

function queueKindForProfile(profile: HeliosRuntimeCadenceProfile): HeliosRuntimeQueueKind {
  switch (profile) {
    case 'CONTINUOUS_CRYPTO':
    case 'EQUITY_SESSION':
    case 'FUTURES_SESSION':
      return 'MARKET_OBSERVATION';
    case 'RECONCILIATION_PERIODIC':
      return 'RECONCILIATION';
    case 'RISK_PERIODIC':
      return 'RISK_EVALUATION';
    default:
      return 'CYCLE_TICK';
  }
}
