/**
 * ACCESS-14 — Entitlement hold store for redemption workflow.
 */

import type { EntitlementHoldState } from './types.ts';

export type EntitlementHoldRecord = {
  readonly entitlementId: string;
  readonly subjectRef: string;
  readonly heldUnits: bigint;
  readonly consumedUnits: bigint;
  readonly availableUnits: bigint;
  readonly state: EntitlementHoldState;
  readonly redemptionId: string | null;
};

export class EntitlementHoldStore {
  private readonly holds = new Map<string, EntitlementHoldRecord>();
  private readonly idempotency = new Map<string, string>();

  seed(entitlementId: string, subjectRef: string, availableUnits: bigint): EntitlementHoldRecord {
    const record: EntitlementHoldRecord = Object.freeze({
      entitlementId,
      subjectRef,
      heldUnits: 0n,
      consumedUnits: 0n,
      availableUnits,
      state: 'AVAILABLE',
      redemptionId: null,
    });
    this.holds.set(entitlementId, record);
    return record;
  }

  get(entitlementId: string): EntitlementHoldRecord | null {
    return this.holds.get(entitlementId) ?? null;
  }

  hold(input: {
    readonly entitlementId: string;
    readonly redemptionId: string;
    readonly units: bigint;
    readonly idempotencyKey: string;
  }): EntitlementHoldRecord | { readonly code: 'IDEMPOTENT'; readonly record: EntitlementHoldRecord } | { readonly code: 'INSUFFICIENT' } {
    const prior = this.idempotency.get(input.idempotencyKey);
    if (prior) {
      const record = this.holds.get(prior);
      if (record) {
        return { code: 'IDEMPOTENT', record };
      }
    }
    const current = this.holds.get(input.entitlementId);
    if (!current) {
      return { code: 'INSUFFICIENT' };
    }
    if (current.availableUnits < input.units) {
      return { code: 'INSUFFICIENT' };
    }
    const next: EntitlementHoldRecord = Object.freeze({
      ...current,
      heldUnits: current.heldUnits + input.units,
      availableUnits: current.availableUnits - input.units,
      state: 'HELD',
      redemptionId: input.redemptionId,
    });
    this.holds.set(input.entitlementId, next);
    this.idempotency.set(input.idempotencyKey, input.entitlementId);
    return next;
  }

  consume(entitlementId: string, units: bigint): EntitlementHoldRecord | null {
    const current = this.holds.get(entitlementId);
    if (!current || current.heldUnits < units) {
      return null;
    }
    const next: EntitlementHoldRecord = Object.freeze({
      ...current,
      heldUnits: current.heldUnits - units,
      consumedUnits: current.consumedUnits + units,
      state: 'CONSUMED',
    });
    this.holds.set(entitlementId, next);
    return next;
  }

  release(entitlementId: string, units: bigint): EntitlementHoldRecord | null {
    const current = this.holds.get(entitlementId);
    if (!current || current.heldUnits < units) {
      return null;
    }
    const next: EntitlementHoldRecord = Object.freeze({
      ...current,
      heldUnits: current.heldUnits - units,
      availableUnits: current.availableUnits + units,
      state: current.heldUnits - units === 0n ? 'AVAILABLE' : 'HELD',
      redemptionId: current.heldUnits - units === 0n ? null : current.redemptionId,
    });
    this.holds.set(entitlementId, next);
    return next;
  }

  findByRedemptionId(redemptionId: string): EntitlementHoldRecord | null {
    for (const record of this.holds.values()) {
      if (record.redemptionId === redemptionId) {
        return record;
      }
    }
    return null;
  }

  reinstateAfterRefund(entitlementId: string, units: bigint): EntitlementHoldRecord | null {
    const current = this.holds.get(entitlementId);
    if (!current) {
      return null;
    }
    const next: EntitlementHoldRecord = Object.freeze({
      ...current,
      consumedUnits: current.consumedUnits > units ? current.consumedUnits - units : 0n,
      availableUnits: current.availableUnits + units,
      state: 'REINSTATED_AFTER_REFUND',
      redemptionId: null,
    });
    this.holds.set(entitlementId, next);
    return next;
  }
}
