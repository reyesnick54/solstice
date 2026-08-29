import { randomUUID } from 'node:crypto';

import { addMs, isExpired, type Clock } from '../../config/src/clock.ts';
import { isErr } from '../../domain/src/result.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import type { IdentityAuthorityPort } from '../../identity/src/index.ts';
import type { ComplianceKernel } from '../../kernel/src/kernel.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { ACTION_TYPES, type ConfirmCapacityReservationIntent } from '../../permissions/src/action-types.ts';
import type { AuthorizationDecision } from '../../permissions/src/decision.ts';
import type { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { availableUnits, quotableUnits, type CapacitySourcePort } from './capacity-source.ts';
import {
  EVIDENCE_CAPACITY_ACTIVATED,
  EVIDENCE_CAPACITY_CANCELLED,
  EVIDENCE_CAPACITY_COMPENSATED,
  EVIDENCE_CAPACITY_CONFIRMED,
  EVIDENCE_CAPACITY_EXPIRED,
  EVIDENCE_CAPACITY_FAILED,
  EVIDENCE_CAPACITY_HELD,
  EVIDENCE_CAPACITY_REQUESTED,
  EVIDENCE_CAPACITY_WAITLISTED,
} from './evidence.ts';
import { asCapacityPoolId, asCapacityReservationId } from './ids.ts';
import { canTransitionReservation } from './lifecycle.ts';
import type { AccessPolicyPort } from './policy.ts';
import { freezeReservation, type CapacityStore } from './store.ts';
import type { SettlementIntentPort } from './settlement-port.ts';
import type { CapacityPool, CapacityQuote, CapacityReservation } from './types.ts';
import { authorizeCapacityIntent, type CapacityAuthorizePorts } from './authorize.ts';
import { CapacityStore } from './store.ts';
import { WaitlistStore } from './waitlist.ts';

export const DEFAULT_HOLD_TTL_MS = 10n * 60n * 1000n;
export const DEFAULT_CONFIRMATION_TTL_MS = 15n * 60n * 1000n;

export type CapacityEngineOutcome<T> =
  | { readonly outcome: 'OK'; readonly value: T; readonly replay?: boolean }
  | { readonly outcome: 'KERNEL_REFUSED'; readonly decision: AuthorizationDecision }
  | { readonly outcome: 'REJECTED'; readonly code: string; readonly message: string; readonly decision?: AuthorizationDecision | null };

export type CapacityReservationEnginePorts = {
  readonly kernel: ComplianceKernel;
  readonly issuer: AuthorityIssuer;
  readonly evidence: EvidenceVault;
  readonly events: DomainEventLog;
  readonly clock: Clock;
  readonly identity: IdentityAuthorityPort;
  readonly capacitySource: CapacitySourcePort;
  readonly policy: AccessPolicyPort;
  readonly settlement: SettlementIntentPort;
  readonly store?: CapacityStore;
  readonly waitlist?: WaitlistStore;
  readonly holdTtlMs?: bigint;
  readonly confirmationTtlMs?: bigint;
};

/**
 * ACCESS-07: canonical Capacity Reservation Engine.
 * Reserves existing productive capacity. Does not create capacity.
 */
export class CapacityReservationEngine {
  private readonly ports: CapacityAuthorizePorts;
  private readonly capacitySource: CapacitySourcePort;
  private readonly policy: AccessPolicyPort;
  private readonly settlement: SettlementIntentPort;
  readonly store: CapacityStore;
  readonly waitlist: WaitlistStore;
  private readonly holdTtlMs: bigint;
  private readonly confirmationTtlMs: bigint;

  constructor(ports: CapacityReservationEnginePorts) {
    this.ports = {
      kernel: ports.kernel,
      issuer: ports.issuer,
      evidence: ports.evidence,
      events: ports.events,
      clock: ports.clock,
      identity: ports.identity,
    };
    this.capacitySource = ports.capacitySource;
    this.policy = ports.policy;
    this.settlement = ports.settlement;
    this.store = ports.store ?? new CapacityStore();
    this.waitlist = ports.waitlist ?? new WaitlistStore();
    this.holdTtlMs = ports.holdTtlMs ?? DEFAULT_HOLD_TTL_MS;
    this.confirmationTtlMs = ports.confirmationTtlMs ?? DEFAULT_CONFIRMATION_TTL_MS;
    this.syncPoolsFromSource();
  }

  syncPoolsFromSource(): void {
    for (const pool of this.capacitySource.listPools()) {
      const existing = this.store.getPool(pool.poolId);
      if (!existing) {
        this.store.putPool(pool);
        continue;
      }
      this.store.putPool({
        ...existing,
        totalUnits: pool.totalUnits,
        resourceLabel: pool.resourceLabel,
        windowStart: pool.windowStart,
        windowEnd: pool.windowEnd,
        partialAllowed: pool.partialAllowed,
        updatedAt: pool.updatedAt,
      });
    }
  }

  quote(input: {
    readonly poolId: string;
    readonly requestedUnits: number;
    readonly actorId: string;
    readonly accountId: string;
  }): CapacityEngineOutcome<CapacityQuote> {
    const pool = this.requirePool(input.poolId);
    if (!pool) {
      return { outcome: 'REJECTED', code: 'POOL_NOT_FOUND', message: 'capacity pool does not exist' };
    }
    const policyVersion = this.policy.currentVersion();
    const policy = this.policy.check({
      stage: 'QUOTE',
      actorId: input.actorId,
      accountId: input.accountId,
      poolId: pool.poolId,
      resourceId: pool.resourceId,
      requestedUnits: input.requestedUnits,
      policyVersion,
    });
    if (policy.outcome === 'DENY') {
      return { outcome: 'REJECTED', code: policy.code, message: policy.message };
    }
    const available = availableUnits(pool);
    const quoteUnits = quotableUnits(pool, input.requestedUnits, pool.partialAllowed);
    return {
      outcome: 'OK',
      value: Object.freeze({
        poolId: pool.poolId,
        resourceId: pool.resourceId,
        resourceLabel: pool.resourceLabel,
        windowStart: pool.windowStart,
        windowEnd: pool.windowEnd,
        availableUnits: available,
        requestedUnits: input.requestedUnits,
        quotableUnits: quoteUnits,
        partialAllowed: pool.partialAllowed,
        policyVersion,
        quotedAt: this.ports.clock.now(),
      }),
    };
  }

  requestReservation(input: {
    readonly poolId: string;
    readonly requestedUnits: number;
    readonly actorId: string;
    readonly accountId: string;
    readonly jurisdiction: string;
    readonly idempotencyKey: string;
  }): CapacityEngineOutcome<CapacityReservation> {
    const existing = this.store.getByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return { outcome: 'OK', value: existing, replay: true };
    }
    const pool = this.requirePool(input.poolId);
    if (!pool) {
      return { outcome: 'REJECTED', code: 'POOL_NOT_FOUND', message: 'capacity pool does not exist' };
    }
    const policyVersion = this.policy.currentVersion();
    const discovery = this.policy.check({
      stage: 'DISCOVERY',
      actorId: input.actorId,
      accountId: input.accountId,
      poolId: pool.poolId,
      resourceId: pool.resourceId,
      requestedUnits: input.requestedUnits,
      policyVersion,
    });
    if (discovery.outcome === 'DENY') {
      return { outcome: 'REJECTED', code: discovery.code, message: discovery.message };
    }
    const now = this.ports.clock.now();
    const evidence = this.ports.evidence.seal(EVIDENCE_CAPACITY_REQUESTED, {
      poolId: input.poolId,
      requestedUnits: input.requestedUnits,
      actorId: input.actorId,
      accountId: input.accountId,
      idempotencyKey: input.idempotencyKey,
    });
    const reservation = freezeReservation({
      reservationId: asCapacityReservationId(this.store.newReservationId()),
      poolId: pool.poolId,
      resourceId: pool.resourceId,
      actorId: input.actorId,
      accountId: input.accountId,
      jurisdiction: input.jurisdiction,
      requestedUnits: input.requestedUnits,
      heldUnits: 0,
      confirmedUnits: 0,
      state: 'REQUESTED',
      idempotencyKey: input.idempotencyKey,
      holdExpiresAt: null,
      confirmationExpiresAt: null,
      authorityId: null,
      policyVersion,
      evidenceRefs: [evidence.evidenceId],
      settlementIntentId: null,
      createdAt: now,
      updatedAt: now,
      epoch: 0,
    });
    this.store.putReservation(reservation);
    return { outcome: 'OK', value: reservation };
  }

  async placeHold(input: {
    readonly reservationId: string;
    readonly actorId: string;
  }): Promise<CapacityEngineOutcome<CapacityReservation>> {
    const reservation = this.store.getReservation(input.reservationId);
    if (!reservation) {
      return { outcome: 'REJECTED', code: 'RESERVATION_NOT_FOUND', message: 'reservation does not exist' };
    }
    if (reservation.state === 'HELD') {
      return { outcome: 'OK', value: reservation, replay: true };
    }
    if (reservation.state !== 'REQUESTED') {
      return { outcome: 'REJECTED', code: 'ILLEGAL_STATE', message: `cannot hold from ${reservation.state}` };
    }
    const pool = this.requirePool(reservation.poolId as string);
    if (!pool) {
      return this.failReservation(reservation, 'CAPACITY_SOURCE_GONE', 'capacity source disappeared');
    }
    const policy = this.policy.check({
      stage: 'HOLD',
      actorId: input.actorId,
      accountId: reservation.accountId,
      poolId: pool.poolId,
      resourceId: pool.resourceId,
      requestedUnits: reservation.requestedUnits,
      policyVersion: reservation.policyVersion,
    });
    if (policy.outcome === 'DENY') {
      return { outcome: 'REJECTED', code: policy.code, message: policy.message };
    }
    return this.store.withPoolLock(pool.poolId, () => {
      const currentPool = this.store.getPool(pool.poolId)!;
      const holdResult = this.store.placeSoftHold({
        poolId: pool.poolId,
        units: reservation.requestedUnits,
        expectedEpoch: currentPool.epoch,
        now: this.ports.clock.now(),
        partialAllowed: currentPool.partialAllowed,
      });
      if (isErr(holdResult)) {
        if (holdResult.error.code === 'POOL_CAPACITY_EXCEEDED') {
          const entry = this.waitlist.enqueue({
            poolId: pool.poolId,
            actorId: reservation.actorId,
            accountId: reservation.accountId,
            requestedUnits: reservation.requestedUnits,
            idempotencyKey: `${reservation.idempotencyKey}:waitlist`,
            now: this.ports.clock.now(),
          });
          this.ports.evidence.seal(EVIDENCE_CAPACITY_WAITLISTED, {
            reservationId: reservation.reservationId,
            waitlistEntryId: entry.entryId,
          });
        }
        return { outcome: 'REJECTED', code: holdResult.error.code, message: holdResult.error.message };
      }
      const now = this.ports.clock.now();
      const evidence = this.ports.evidence.seal(EVIDENCE_CAPACITY_HELD, {
        reservationId: reservation.reservationId,
        heldUnits: holdResult.value.heldUnits,
        poolEpoch: holdResult.value.pool.epoch,
      });
      const next = freezeReservation({
        ...reservation,
        state: 'HELD',
        heldUnits: holdResult.value.heldUnits,
        holdExpiresAt: addMs(now, this.holdTtlMs),
        updatedAt: now,
        epoch: reservation.epoch + 1,
        evidenceRefs: [...reservation.evidenceRefs, evidence.evidenceId],
      });
      this.store.putReservation(next);
      return { outcome: 'OK', value: next };
    });
  }

  async confirmReservation(input: {
    readonly reservationId: string;
    readonly actorId: string;
    readonly intent: ConfirmCapacityReservationIntent;
  }): Promise<CapacityEngineOutcome<CapacityReservation>> {
    const reservation = this.store.getReservation(input.reservationId);
    if (!reservation) {
      return { outcome: 'REJECTED', code: 'RESERVATION_NOT_FOUND', message: 'reservation does not exist' };
    }
    if (reservation.state === 'CONFIRMED' || reservation.state === 'ACTIVE') {
      return { outcome: 'OK', value: reservation, replay: true };
    }
    if (reservation.state !== 'HELD') {
      return { outcome: 'REJECTED', code: 'ILLEGAL_STATE', message: `cannot confirm from ${reservation.state}` };
    }
    const now = this.ports.clock.now();
    if (reservation.holdExpiresAt !== null && isExpired(reservation.holdExpiresAt, now)) {
      await this.expireHold(reservation.reservationId as string);
      return { outcome: 'REJECTED', code: 'HOLD_EXPIRED', message: 'soft hold has expired' };
    }
    const pool = this.requirePool(reservation.poolId as string);
    if (!pool) {
      return this.failReservation(reservation, 'CAPACITY_SOURCE_GONE', 'capacity source disappeared');
    }
    if (this.capacitySource.poolValidAt && !this.capacitySource.poolValidAt(pool.poolId, now)) {
      return this.failReservation(reservation, 'CAPACITY_SOURCE_GONE', 'capacity source no longer valid');
    }
    const policy = this.policy.check({
      stage: 'CONFIRM',
      actorId: input.actorId,
      accountId: reservation.accountId,
      poolId: pool.poolId,
      resourceId: pool.resourceId,
      requestedUnits: reservation.heldUnits,
      policyVersion: reservation.policyVersion,
    });
    if (policy.outcome === 'DENY') {
      return { outcome: 'REJECTED', code: policy.code, message: policy.message };
    }
    const authorized = authorizeCapacityIntent(this.ports, input.intent, {
      jurisdiction: reservation.jurisdiction as never,
    });
    if (authorized.outcome === 'KERNEL_REFUSED') {
      return { outcome: 'KERNEL_REFUSED', decision: authorized.decision };
    }
    if (authorized.outcome === 'REJECTED') {
      return {
        outcome: 'REJECTED',
        code: authorized.code,
        message: authorized.message,
        decision: authorized.decision,
      };
    }
    return this.store.withPoolLock(pool.poolId, async () => {
      const currentPool = this.store.getPool(pool.poolId)!;
      const confirmResult = this.store.confirmHold({
        poolId: pool.poolId,
        heldUnits: reservation.heldUnits,
        expectedEpoch: currentPool.epoch,
        now,
      });
      if (isErr(confirmResult)) {
        await this.compensateFailedConfirmation(reservation, confirmResult.error.code);
        return { outcome: 'REJECTED', code: confirmResult.error.code, message: confirmResult.error.message };
      }
      const evidence = this.ports.evidence.seal(EVIDENCE_CAPACITY_CONFIRMED, {
        reservationId: reservation.reservationId,
        authorityId: authorized.verified.authorityId,
        heldUnits: reservation.heldUnits,
      });
      const settlementIntentId = randomUUID();
      this.settlement.emit({
        intentId: settlementIntentId,
        reservationId: reservation.reservationId,
        accountId: reservation.accountId,
        actorId: reservation.actorId,
        kind: 'RESERVATION_CONFIRMED',
        createdAt: now,
      });
      const next = freezeReservation({
        ...reservation,
        state: 'CONFIRMED',
        confirmedUnits: reservation.heldUnits,
        holdExpiresAt: null,
        confirmationExpiresAt: addMs(now, this.confirmationTtlMs),
        authorityId: authorized.verified.authorityId,
        settlementIntentId,
        updatedAt: now,
        epoch: reservation.epoch + 1,
        evidenceRefs: [...reservation.evidenceRefs, evidence.evidenceId],
      });
      this.store.putReservation(next);
      return { outcome: 'OK', value: next };
    });
  }

  async activateReservation(input: {
    readonly reservationId: string;
    readonly actorId: string;
  }): Promise<CapacityEngineOutcome<CapacityReservation>> {
    const reservation = this.store.getReservation(input.reservationId);
    if (!reservation) {
      return { outcome: 'REJECTED', code: 'RESERVATION_NOT_FOUND', message: 'reservation does not exist' };
    }
    if (reservation.state === 'ACTIVE') {
      return { outcome: 'OK', value: reservation, replay: true };
    }
    if (reservation.state !== 'CONFIRMED') {
      return { outcome: 'REJECTED', code: 'ILLEGAL_STATE', message: `cannot activate from ${reservation.state}` };
    }
    const now = this.ports.clock.now();
    if (
      reservation.confirmationExpiresAt !== null &&
      isExpired(reservation.confirmationExpiresAt, now)
    ) {
      return { outcome: 'REJECTED', code: 'AUTHORITY_STALE', message: 'confirmation authorization has expired' };
    }
    if (!reservation.authorityId) {
      return { outcome: 'REJECTED', code: 'AUTHORITY_MISSING', message: 'confirmation requires verified authority' };
    }
    const pool = this.requirePool(reservation.poolId as string);
    if (!pool) {
      return this.failReservation(reservation, 'CAPACITY_SOURCE_GONE', 'capacity source disappeared');
    }
    const policy = this.policy.check({
      stage: 'ACTIVATION',
      actorId: input.actorId,
      accountId: reservation.accountId,
      poolId: pool.poolId,
      resourceId: pool.resourceId,
      requestedUnits: reservation.confirmedUnits,
      policyVersion: reservation.policyVersion,
    });
    if (policy.outcome === 'DENY') {
      return { outcome: 'REJECTED', code: policy.code, message: policy.message };
    }
    const evidence = this.ports.evidence.seal(EVIDENCE_CAPACITY_ACTIVATED, {
      reservationId: reservation.reservationId,
      authorityId: reservation.authorityId,
    });
    const next = freezeReservation({
      ...reservation,
      state: 'ACTIVE',
      confirmationExpiresAt: null,
      updatedAt: now,
      epoch: reservation.epoch + 1,
      evidenceRefs: [...reservation.evidenceRefs, evidence.evidenceId],
    });
    this.store.putReservation(next);
    return { outcome: 'OK', value: next };
  }

  async completeReservation(input: {
    readonly reservationId: string;
  }): Promise<CapacityEngineOutcome<CapacityReservation>> {
    const reservation = this.store.getReservation(input.reservationId);
    if (!reservation) {
      return { outcome: 'REJECTED', code: 'RESERVATION_NOT_FOUND', message: 'reservation does not exist' };
    }
    if (reservation.state === 'COMPLETED') {
      return { outcome: 'OK', value: reservation, replay: true };
    }
    if (!canTransitionReservation(reservation.state, 'COMPLETED')) {
      return { outcome: 'REJECTED', code: 'ILLEGAL_STATE', message: `cannot complete from ${reservation.state}` };
    }
    const now = this.ports.clock.now();
    const pool = this.store.getPool(reservation.poolId);
    if (pool) {
      await this.store.withPoolLock(pool.poolId, () => {
        const currentPool = this.store.getPool(pool.poolId)!;
        this.store.releaseFirmReservation({
          poolId: pool.poolId,
          units: reservation.confirmedUnits,
          expectedEpoch: currentPool.epoch,
          now,
        });
      });
    }
    const evidence = this.ports.evidence.seal('ACCESS_CAPACITY_COMPLETED', {
      reservationId: reservation.reservationId,
    });
    this.settlement.emit({
      intentId: randomUUID(),
      reservationId: reservation.reservationId,
      accountId: reservation.accountId,
      actorId: reservation.actorId,
      kind: 'RESERVATION_COMPLETED',
      createdAt: now,
    });
    const next = freezeReservation({
      ...reservation,
      state: 'COMPLETED',
      updatedAt: now,
      epoch: reservation.epoch + 1,
      evidenceRefs: [...reservation.evidenceRefs, evidence.evidenceId],
    });
    this.store.putReservation(next);
    return { outcome: 'OK', value: next };
  }

  async cancelReservation(input: {
    readonly reservationId: string;
    readonly actorId: string;
  }): Promise<CapacityEngineOutcome<CapacityReservation>> {
    const reservation = this.store.getReservation(input.reservationId);
    if (!reservation) {
      return { outcome: 'REJECTED', code: 'RESERVATION_NOT_FOUND', message: 'reservation does not exist' };
    }
    if (reservation.state === 'CANCELLED') {
      return { outcome: 'OK', value: reservation, replay: true };
    }
    if (!canTransitionReservation(reservation.state, 'CANCELLED')) {
      return { outcome: 'REJECTED', code: 'ILLEGAL_STATE', message: `cannot cancel from ${reservation.state}` };
    }
    const now = this.ports.clock.now();
    const pool = this.store.getPool(reservation.poolId);
    if (pool) {
      await this.store.withPoolLock(pool.poolId, () => {
        const currentPool = this.store.getPool(pool.poolId)!;
        if (reservation.state === 'HELD') {
          this.store.releaseSoftHold({
            poolId: pool.poolId,
            units: reservation.heldUnits,
            expectedEpoch: currentPool.epoch,
            now,
          });
        } else if (reservation.state === 'CONFIRMED' || reservation.state === 'ACTIVE') {
          this.store.releaseFirmReservation({
            poolId: pool.poolId,
            units: reservation.confirmedUnits,
            expectedEpoch: currentPool.epoch,
            now,
          });
        }
      });
    }
    const evidence = this.ports.evidence.seal(EVIDENCE_CAPACITY_CANCELLED, {
      reservationId: reservation.reservationId,
      actorId: input.actorId,
    });
    this.settlement.emit({
      intentId: randomUUID(),
      reservationId: reservation.reservationId,
      accountId: reservation.accountId,
      actorId: reservation.actorId,
      kind: 'RESERVATION_CANCELLED',
      createdAt: now,
    });
    const next = freezeReservation({
      ...reservation,
      state: 'CANCELLED',
      updatedAt: now,
      epoch: reservation.epoch + 1,
      evidenceRefs: [...reservation.evidenceRefs, evidence.evidenceId],
    });
    this.store.putReservation(next);
    return { outcome: 'OK', value: next };
  }

  async expireHold(reservationId: string): Promise<CapacityEngineOutcome<CapacityReservation>> {
    const reservation = this.store.getReservation(reservationId);
    if (!reservation) {
      return { outcome: 'REJECTED', code: 'RESERVATION_NOT_FOUND', message: 'reservation does not exist' };
    }
    if (reservation.state === 'EXPIRED') {
      return { outcome: 'OK', value: reservation, replay: true };
    }
    if (reservation.state !== 'HELD') {
      return { outcome: 'REJECTED', code: 'ILLEGAL_STATE', message: `cannot expire from ${reservation.state}` };
    }
    const now = this.ports.clock.now();
    const pool = this.store.getPool(reservation.poolId);
    if (pool) {
      await this.store.withPoolLock(pool.poolId, () => {
        const currentPool = this.store.getPool(pool.poolId)!;
        this.store.releaseSoftHold({
          poolId: pool.poolId,
          units: reservation.heldUnits,
          expectedEpoch: currentPool.epoch,
          now,
        });
      });
    }
    const evidence = this.ports.evidence.seal(EVIDENCE_CAPACITY_EXPIRED, {
      reservationId: reservation.reservationId,
    });
    const next = freezeReservation({
      ...reservation,
      state: 'EXPIRED',
      heldUnits: 0,
      updatedAt: now,
      epoch: reservation.epoch + 1,
      evidenceRefs: [...reservation.evidenceRefs, evidence.evidenceId],
    });
    this.store.putReservation(next);
    return { outcome: 'OK', value: next };
  }

  expireDueHolds(): readonly CapacityReservation[] {
    const now = this.ports.clock.now();
    const expired: CapacityReservation[] = [];
    for (const reservation of this.store.listReservations()) {
      if (
        reservation.state === 'HELD' &&
        reservation.holdExpiresAt !== null &&
        isExpired(reservation.holdExpiresAt, now)
      ) {
        const pool = this.store.getPool(reservation.poolId);
        if (pool) {
          this.store.releaseSoftHold({
            poolId: pool.poolId,
            units: reservation.heldUnits,
            expectedEpoch: pool.epoch,
            now,
          });
        }
        const evidence = this.ports.evidence.seal(EVIDENCE_CAPACITY_EXPIRED, {
          reservationId: reservation.reservationId,
        });
        const next = freezeReservation({
          ...reservation,
          state: 'EXPIRED',
          heldUnits: 0,
          updatedAt: now,
          epoch: reservation.epoch + 1,
          evidenceRefs: [...reservation.evidenceRefs, evidence.evidenceId],
        });
        this.store.putReservation(next);
        expired.push(next);
      }
    }
    return expired;
  }

  private async failReservation(
    reservation: CapacityReservation,
    code: string,
    message: string,
  ): Promise<CapacityEngineOutcome<CapacityReservation>> {
    const now = this.ports.clock.now();
    const pool = this.store.getPool(reservation.poolId);
    if (pool && reservation.state === 'HELD') {
      await this.store.withPoolLock(pool.poolId, () => {
        const currentPool = this.store.getPool(pool.poolId)!;
        this.store.releaseSoftHold({
          poolId: pool.poolId,
          units: reservation.heldUnits,
          expectedEpoch: currentPool.epoch,
          now,
        });
      });
    } else if (pool && (reservation.state === 'CONFIRMED' || reservation.state === 'ACTIVE')) {
      await this.store.withPoolLock(pool.poolId, () => {
        const currentPool = this.store.getPool(pool.poolId)!;
        this.store.releaseFirmReservation({
          poolId: pool.poolId,
          units: reservation.confirmedUnits,
          expectedEpoch: currentPool.epoch,
          now,
        });
      });
    }
    const evidence = this.ports.evidence.seal(EVIDENCE_CAPACITY_FAILED, {
      reservationId: reservation.reservationId,
      code,
      message,
    });
    const next = freezeReservation({
      ...reservation,
      state: 'FAILED',
      heldUnits: 0,
      updatedAt: now,
      epoch: reservation.epoch + 1,
      evidenceRefs: [...reservation.evidenceRefs, evidence.evidenceId],
    });
    this.store.putReservation(next);
    return { outcome: 'REJECTED', code, message };
  }

  private async compensateFailedConfirmation(
    reservation: CapacityReservation,
    code: string,
  ): Promise<void> {
    const now = this.ports.clock.now();
    const pool = this.store.getPool(reservation.poolId);
    if (pool) {
      await this.store.withPoolLock(pool.poolId, () => {
        const currentPool = this.store.getPool(pool.poolId)!;
        this.store.releaseSoftHold({
          poolId: pool.poolId,
          units: reservation.heldUnits,
          expectedEpoch: currentPool.epoch,
          now,
        });
      });
    }
    const evidence = this.ports.evidence.seal(EVIDENCE_CAPACITY_COMPENSATED, {
      reservationId: reservation.reservationId,
      reason: code,
    });
    const next = freezeReservation({
      ...reservation,
      state: 'FAILED',
      heldUnits: 0,
      updatedAt: now,
      epoch: reservation.epoch + 1,
      evidenceRefs: [...reservation.evidenceRefs, evidence.evidenceId],
    });
    this.store.putReservation(next);
  }

  private requirePool(poolId: string): CapacityPool | undefined {
    this.syncPoolsFromSource();
    return this.store.getPool(asCapacityPoolId(poolId));
  }

  buildConfirmIntent(input: {
    readonly reservation: CapacityReservation;
    readonly actorId: string;
    readonly idempotencyKey: string;
  }): ConfirmCapacityReservationIntent {
    const now = this.ports.clock.now();
    return {
      id: asIntentId(randomUUID()),
      actionType: ACTION_TYPES.CONFIRM_CAPACITY_RESERVATION,
      payload: {
        accountId: input.reservation.accountId as never,
        reservationId: input.reservation.reservationId as string,
        poolId: input.reservation.poolId as string,
        units: input.reservation.heldUnits,
      },
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId,
      requestedAt: now,
      purpose: 'CUSTOMER_DIGITAL_ASSET',
    };
  }
}
