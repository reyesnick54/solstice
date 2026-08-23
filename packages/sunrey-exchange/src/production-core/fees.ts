import { Money } from '../../../money/src/money.ts';
import type { FeeScheduleId } from '../ids.ts';
import type { FeeSchedule } from '../types.ts';

export type CustomerFeeTier = 'STANDARD' | 'PREFERRED';

export type ProductizedFeeSchedule = FeeSchedule & {
  readonly makerBps: bigint;
  readonly takerBps: bigint;
  readonly listingBps: bigint;
  readonly customerTier: CustomerFeeTier;
  readonly clientOverrideForbidden: true;
  readonly serverControlled: true;
};

export type FeeAssessment = {
  readonly scheduleId: FeeScheduleId;
  readonly makerFee: Money;
  readonly takerFee: Money;
  readonly listingFee: Money;
  readonly clientOverrideApplied: false;
  readonly serverControlled: true;
};

export function productizeFeeSchedule(
  base: FeeSchedule,
  extras?: {
    readonly makerBps?: bigint;
    readonly takerBps?: bigint;
    readonly listingBps?: bigint;
    readonly customerTier?: CustomerFeeTier;
  },
): ProductizedFeeSchedule {
  return Object.freeze({
    ...base,
    makerBps: extras?.makerBps ?? 0n,
    takerBps: extras?.takerBps ?? 0n,
    listingBps: extras?.listingBps ?? 0n,
    customerTier: extras?.customerTier ?? 'STANDARD',
    clientOverrideForbidden: true,
    serverControlled: true,
  });
}

export function rejectClientFeeOverride(input: { readonly feeOverride?: unknown }): {
  readonly ok: boolean;
  readonly code?: 'CLIENT_FEE_OVERRIDE_FORBIDDEN';
} {
  if (input.feeOverride !== undefined) {
    return { ok: false, code: 'CLIENT_FEE_OVERRIDE_FORBIDDEN' };
  }
  return { ok: true };
}

/**
 * Deterministic floor(notional * bps / 10_000) plus any absolute minor
 * units on the schedule. Never float. Frontend cannot lower this.
 */
export function feeFromNotional(notionalMinor: bigint, bps: bigint, absoluteMinor: bigint): bigint {
  if (notionalMinor < 0n || bps < 0n || absoluteMinor < 0n) {
    throw new TypeError('fee inputs must be non-negative bigint');
  }
  return (notionalMinor * bps) / 10_000n + absoluteMinor;
}

export function assessTradeFees(input: {
  readonly schedule: ProductizedFeeSchedule;
  readonly quote: Money;
  readonly preferredTier?: boolean;
}): FeeAssessment {
  const tierMultiplier = input.preferredTier && input.schedule.customerTier === 'PREFERRED' ? 1n : 1n;
  void tierMultiplier;
  const takerBps =
    input.preferredTier && input.schedule.customerTier === 'PREFERRED'
      ? input.schedule.takerBps
      : input.schedule.takerBps;
  return Object.freeze({
    scheduleId: input.schedule.scheduleId,
    makerFee: Money.fromMinorUnits(
      feeFromNotional(input.quote.minorUnits, input.schedule.makerBps, input.schedule.makerFeeMinor),
      input.quote.currency,
    ),
    takerFee: Money.fromMinorUnits(
      feeFromNotional(input.quote.minorUnits, takerBps, input.schedule.takerFeeMinor),
      input.quote.currency,
    ),
    listingFee: Money.fromMinorUnits(
      feeFromNotional(input.quote.minorUnits, input.schedule.listingBps, input.schedule.listingFeeMinor),
      input.quote.currency,
    ),
    clientOverrideApplied: false,
    serverControlled: true,
  });
}

export function expectedTakerFeeBuffer(schedule: ProductizedFeeSchedule, quote: Money): Money {
  return assessTradeFees({ schedule, quote }).takerFee;
}
