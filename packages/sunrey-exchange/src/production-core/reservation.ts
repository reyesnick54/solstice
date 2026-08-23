import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { Money } from '../../../money/src/money.ts';
import { quoteMoney, type ExchangePrice } from '../price.ts';
import type { ExchangeHold } from '../types.ts';
import { expectedTakerFeeBuffer, type ProductizedFeeSchedule } from './fees.ts';

export type ReservationPlan =
  | {
      readonly side: 'BUY';
      readonly quote: Money;
      readonly feeBuffer: Money;
      readonly reserved: Money;
      readonly base: null;
    }
  | {
      readonly side: 'SELL';
      readonly quote: null;
      readonly feeBuffer: null;
      readonly reserved: null;
      readonly base: AssetQuantity;
    };

export function planReservation(input: {
  readonly side: 'BUY' | 'SELL';
  readonly quantity: AssetQuantity;
  readonly limitOrProtection: ExchangePrice | null;
  readonly quoteCurrency: Money['currency'];
  readonly schedule: ProductizedFeeSchedule;
}): { readonly ok: true; readonly plan: ReservationPlan } | { readonly ok: false; readonly code: string; readonly message: string } {
  if (input.side === 'SELL') {
    return {
      ok: true,
      plan: { side: 'SELL', quote: null, feeBuffer: null, reserved: null, base: input.quantity },
    };
  }
  if (!input.limitOrProtection) {
    return { ok: false, code: 'INVALID_PRICE', message: 'buy reservation requires a limit or protection price' };
  }
  const quote = quoteMoney(input.limitOrProtection, input.quantity, input.quoteCurrency);
  const feeBuffer = expectedTakerFeeBuffer(input.schedule, quote);
  return {
    ok: true,
    plan: { side: 'BUY', quote, feeBuffer, reserved: quote.plus(feeBuffer), base: null },
  };
}

export function remainingReservable(hold: ExchangeHold): { readonly fiat: bigint; readonly asset: bigint } {
  return {
    fiat: hold.remainingFiat?.minorUnits ?? 0n,
    asset: hold.remainingAsset?.scaledUnits ?? 0n,
  };
}

/**
 * Cancel may release only the uncaptured remainder. Captured fill
 * reservations must stay captured.
 */
export function releasableOnCancel(hold: ExchangeHold): {
  readonly fiat: Money | null;
  readonly asset: AssetQuantity | null;
  readonly overRelease: false;
} {
  if (hold.state === 'CAPTURED' || hold.state === 'RELEASED') {
    return { fiat: null, asset: null, overRelease: false };
  }
  return {
    fiat: hold.remainingFiat,
    asset: hold.remainingAsset,
    overRelease: false,
  };
}
