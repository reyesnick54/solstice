import { Money } from '../../money/src/money.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { TreasuryAccountId, TreasuryPositionId } from './ids.ts';

/**
 * Currency-separated treasury position. Never sum USD + SAR + EUR.
 * Cross-currency valuation requires an explicit timestamped FX context.
 */
export type TreasuryPosition = {
  readonly positionId: TreasuryPositionId;
  readonly treasuryAccountId: TreasuryAccountId;
  readonly currency: string;
  readonly settled: Money;
  readonly available: Money;
  readonly reserved: Money;
  readonly pendingInbound: Money;
  readonly pendingOutbound: Money;
  readonly operationalBuffer: Money;
  readonly updatedAt: UtcInstant;
};

export type FxValuationContext = {
  readonly asOf: UtcInstant;
  readonly quoteCurrency: string;
  readonly rates: Readonly<Record<string, { readonly numerator: bigint; readonly denominator: bigint }>>;
  readonly note: 'explicit FX valuation — not a blended return or yield';
};

export function totalUsableLiquidity(position: TreasuryPosition): Money {
  return position.available;
}

export function assertSameCurrency(position: TreasuryPosition, amount: Money): void {
  if (position.currency !== amount.currency) {
    throw new Error(`treasury position is ${position.currency}; cannot apply ${amount.currency}`);
  }
}

export function assertNonNegative(position: TreasuryPosition): void {
  for (const field of [
    position.settled,
    position.available,
    position.reserved,
    position.pendingInbound,
    position.pendingOutbound,
    position.operationalBuffer,
  ] as const) {
    if (field.isNegative()) {
      throw new Error(`treasury position ${position.positionId} cannot be negative`);
    }
  }
}

export function freezePosition(position: TreasuryPosition): TreasuryPosition {
  assertSameCurrency(position, position.available);
  assertNonNegative(position);
  return Object.freeze({ ...position });
}

export function applyReserve(
  position: TreasuryPosition,
  amount: Money,
  now: UtcInstant,
): TreasuryPosition {
  assertSameCurrency(position, amount);
  if (amount.isNegative() || amount.isZero()) {
    throw new Error('reserve amount must be positive');
  }
  if (position.available.cmp(amount) < 0) {
    throw new Error('INSUFFICIENT_TREASURY_LIQUIDITY');
  }
  const next = freezePosition({
    ...position,
    available: position.available.minus(amount),
    reserved: position.reserved.plus(amount),
    updatedAt: now,
  });
  if (next.available.isNegative() || next.reserved.isNegative()) {
    throw new Error('treasury position cannot be negative');
  }
  return next;
}

export function applyRelease(
  position: TreasuryPosition,
  amount: Money,
  now: UtcInstant,
): TreasuryPosition {
  assertSameCurrency(position, amount);
  if (position.reserved.cmp(amount) < 0) {
    throw new Error('RELEASE_EXCEEDS_RESERVED');
  }
  return freezePosition({
    ...position,
    available: position.available.plus(amount),
    reserved: position.reserved.minus(amount),
    updatedAt: now,
  });
}

export function applyCommit(
  position: TreasuryPosition,
  amount: Money,
  now: UtcInstant,
): TreasuryPosition {
  assertSameCurrency(position, amount);
  if (position.reserved.cmp(amount) < 0) {
    throw new Error('COMMIT_EXCEEDS_RESERVED');
  }
  return freezePosition({
    ...position,
    reserved: position.reserved.minus(amount),
    settled: position.settled.minus(amount),
    pendingOutbound: position.pendingOutbound.plus(amount),
    updatedAt: now,
  });
}

export function applyReplenish(
  position: TreasuryPosition,
  amount: Money,
  now: UtcInstant,
): TreasuryPosition {
  assertSameCurrency(position, amount);
  if (!amount.isPositive()) {
    throw new Error('replenish amount must be positive');
  }
  return freezePosition({
    ...position,
    settled: position.settled.plus(amount),
    available: position.available.plus(amount),
    updatedAt: now,
  });
}

export function applyTransfer(
  source: TreasuryPosition,
  destination: TreasuryPosition,
  amount: Money,
  now: UtcInstant,
): { readonly source: TreasuryPosition; readonly destination: TreasuryPosition } {
  if (source.currency !== destination.currency) {
    throw new Error('treasury transfer requires the same currency; cross-currency needs FX valuation context');
  }
  assertSameCurrency(source, amount);
  if (source.available.cmp(amount) < 0) {
    throw new Error('INSUFFICIENT_TREASURY_LIQUIDITY');
  }
  return {
    source: freezePosition({
      ...source,
      settled: source.settled.minus(amount),
      available: source.available.minus(amount),
      updatedAt: now,
    }),
    destination: freezePosition({
      ...destination,
      settled: destination.settled.plus(amount),
      available: destination.available.plus(amount),
      updatedAt: now,
    }),
  };
}
