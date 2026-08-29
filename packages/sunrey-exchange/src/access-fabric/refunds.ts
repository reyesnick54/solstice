import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { Money } from '../../../money/src/money.ts';
import type {
  CapacityReservation,
  ConsiderationLeg,
  RefundSettlementIntent,
} from './types.ts';
import { isMonetaryConsideration, type RefundReason } from './taxonomy.ts';
import { prorateConsiderationUnits } from './consideration.ts';

/**
 * Refund and cancellation settlement intents.
 *
 * A correction is always a new compensating entry. No intent produced here
 * edits or deletes an existing ledger posting, custody transfer, chain transfer,
 * or entitlement consumption; each one describes the opposite movement that the
 * clearing adapter will execute on the same canonical rail.
 */
export function refundSettlementIntent(input: {
  readonly reservationId: string;
  readonly reason: RefundReason;
  readonly legs: readonly ConsiderationLeg[];
  readonly at: UtcInstant;
}): RefundSettlementIntent {
  if (input.legs.length === 0) {
    throw new TypeError('a refund intent must name at least one consideration leg');
  }
  const requiresAuthority = input.legs.some((leg) => leg.kind === 'FIAT');
  return Object.freeze({
    intentId: `xarf_${randomUUID().replace(/-/g, '')}`,
    reservationId: input.reservationId,
    reason: input.reason,
    legs: Object.freeze([...input.legs]),
    compensating: true,
    editsOriginalPosting: false,
    requiresExecutionAuthority: requiresAuthority,
    createdAt: input.at,
  });
}

/** Cancel an unfulfilled reservation and return the whole consideration. */
export function cancellationIntentFor(input: {
  readonly reservation: CapacityReservation;
  readonly reason: RefundReason;
  readonly at: UtcInstant;
}): RefundSettlementIntent {
  return refundSettlementIntent({
    reservationId: input.reservation.reservationId,
    reason: input.reason,
    legs: input.reservation.consideration.legs,
    at: input.at,
  });
}

/** Compensate one committed leg after another leg of the same step failed. */
export function compensationIntentFor(input: {
  readonly reservationId: string;
  readonly leg: ConsiderationLeg;
  readonly at: UtcInstant;
}): RefundSettlementIntent {
  return refundSettlementIntent({
    reservationId: input.reservationId,
    reason: 'CLEARING_COMPENSATION',
    legs: [input.leg],
    at: input.at,
  });
}

/**
 * Split reserved consideration into the part earned by attested delivery and
 * the undelivered remainder. Integer arithmetic only: captured plus remainder is
 * exactly the reserved amount, per leg and per denomination.
 */
export function splitConsiderationForPartialDelivery(input: {
  readonly legs: readonly ConsiderationLeg[];
  readonly reservedQuantity: bigint;
  readonly deliveredQuantity: bigint;
}): {
  readonly captured: readonly ConsiderationLeg[];
  readonly remainder: readonly ConsiderationLeg[];
} {
  const captured: ConsiderationLeg[] = [];
  const remainder: ConsiderationLeg[] = [];

  for (const leg of input.legs) {
    const split = prorateConsiderationUnits({
      reservedUnits: legUnits(leg),
      reservedQuantity: input.reservedQuantity,
      deliveredQuantity: input.deliveredQuantity,
    });
    if (split.capturedUnits > 0n) {
      captured.push(withUnits(leg, split.capturedUnits));
    }
    if (split.remainderUnits > 0n) {
      remainder.push(withUnits(leg, split.remainderUnits));
    }
  }

  return Object.freeze({
    captured: Object.freeze(captured),
    remainder: Object.freeze(remainder),
  });
}

export function legUnits(leg: ConsiderationLeg): bigint {
  if (leg.kind === 'FIAT') {
    return leg.amount.minorUnits;
  }
  if (leg.kind === 'SUNREY_COIN' || leg.kind === 'MOONREY_COIN') {
    return leg.amount.scaledUnits;
  }
  return leg.units;
}

export function withUnits(leg: ConsiderationLeg, units: bigint): ConsiderationLeg {
  if (leg.kind === 'FIAT') {
    return Object.freeze({ ...leg, amount: Money.fromMinorUnits(units, leg.amount.currency) });
  }
  if (leg.kind === 'SUNREY_COIN' || leg.kind === 'MOONREY_COIN') {
    return Object.freeze({
      ...leg,
      amount: AssetQuantity.fromScaledUnits(units, leg.amount.assetId),
    });
  }
  return Object.freeze({ ...leg, units });
}

/**
 * Total refundable per denomination. Reported side by side; monetary and
 * non-monetary consideration are never added together and entitlement units are
 * never expressed as money.
 */
export function refundableByDenomination(
  intent: RefundSettlementIntent,
): readonly {
  readonly denomination: string;
  readonly units: bigint;
  readonly monetary: boolean;
}[] {
  const totals = new Map<string, { units: bigint; monetary: boolean }>();
  for (const leg of intent.legs) {
    const denomination =
      leg.kind === 'FIAT'
        ? leg.amount.currency
        : leg.kind === 'SUNREY_COIN' || leg.kind === 'MOONREY_COIN'
          ? leg.amount.assetId
          : leg.kind === 'ACCESS_ENTITLEMENT'
            ? leg.unit
            : leg.permittedUse;
    const current = totals.get(denomination) ?? { units: 0n, monetary: isMonetaryConsideration(leg.kind) };
    totals.set(denomination, {
      units: current.units + legUnits(leg),
      monetary: current.monetary,
    });
  }
  return Object.freeze(
    [...totals.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([denomination, value]) =>
        Object.freeze({ denomination, units: value.units, monetary: value.monetary }),
      ),
  );
}
