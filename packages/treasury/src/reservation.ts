import type { Money } from '../../money/src/money.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { ReservationId, TreasuryAccountId } from './ids.ts';
import type { ReservationState } from './types.ts';

/**
 * Treasury liquidity reservation. Distinct from the customer's payment hold.
 * Customer hold: does the customer have enough money?
 * Treasury reservation: does Solstice/provider/corridor have settlement liquidity?
 */
export type TreasuryLiquidityReservation = {
  readonly reservationId: ReservationId;
  readonly treasuryAccountId: TreasuryAccountId;
  readonly paymentId: string | null;
  readonly amount: Money;
  readonly currency: string;
  readonly state: ReservationState;
  readonly idempotencyKey: string;
  readonly authorityId: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly expiresAt: UtcInstant | null;
};

export function freezeReservation(row: TreasuryLiquidityReservation): TreasuryLiquidityReservation {
  if (row.amount.currency !== row.currency) {
    throw new Error('reservation currency must match amount currency');
  }
  if (row.amount.isNegative() || row.amount.isZero()) {
    throw new Error('reservation amount must be positive');
  }
  return Object.freeze({ ...row });
}

export function canRelease(state: ReservationState): boolean {
  return state === 'ACTIVE';
}

export function canCommit(state: ReservationState): boolean {
  return state === 'ACTIVE';
}

export function canReuseAfterUnknown(state: ReservationState): boolean {
  return state !== 'ACTIVE';
}
