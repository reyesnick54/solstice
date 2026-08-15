import { Money } from '../../money/src/money.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { QUANTITY_SCALE, quantityScaleFactor, type InvestmentQuantity } from './quantity.ts';

/**
 * Fixed-point instrument price.
 *
 * A price is Money per one whole share (quantity scale units = 10^8).
 * USD $100.00 is `minorUnits = 10000n` with currency `USD`.
 *
 * Precision: currency minor units (2 for USD/EUR/GBP, 2 for SAR/AED in this
 * simulation catalog). There is no JavaScript number in the arithmetic path.
 *
 * Notional = quantity.units * price.minorUnits / 10^QUANTITY_SCALE
 * using truncating integer division toward zero after an explicit remainder
 * check. Remainders are rejected so cost basis cannot silently lose cents.
 */
export type InstrumentPrice = {
  readonly minorUnits: bigint;
  readonly currency: string;
};

export type PriceFailure = {
  readonly code: 'FLOATING_POINT_PRICE' | 'INVALID_PRICE' | 'CURRENCY_MISMATCH' | 'NOTIONAL_REMAINDER';
  readonly message: string;
};

const INTEGER_RE = /^-?\d+$/;

export function priceFromMinorUnits(minorUnits: bigint, currency: string): Result<InstrumentPrice, PriceFailure> {
  if (typeof minorUnits !== 'bigint') {
    return err({ code: 'FLOATING_POINT_PRICE', message: 'price minor units must be bigint' });
  }
  if (minorUnits <= 0n) {
    return err({ code: 'INVALID_PRICE', message: 'price must be greater than zero' });
  }
  if (currency.length === 0) {
    return err({ code: 'INVALID_PRICE', message: 'price currency is required' });
  }
  return ok(Object.freeze({ minorUnits, currency }));
}

export function priceFromMinorUnitsString(
  value: string,
  currency: string,
): Result<InstrumentPrice, PriceFailure> {
  if (typeof value !== 'string' || !INTEGER_RE.test(value)) {
    return err({
      code: 'FLOATING_POINT_PRICE',
      message: 'price must be an integer minor-units string; floating-point is rejected',
    });
  }
  return priceFromMinorUnits(BigInt(value), currency);
}

export function priceFromMoney(money: Money): Result<InstrumentPrice, PriceFailure> {
  return priceFromMinorUnits(money.minorUnits, money.currency);
}

export function moneyFromPrice(price: InstrumentPrice): Money {
  return Money.fromMinorUnits(price.minorUnits, price.currency);
}

/**
 * Convert quantity × unit price into Money.
 * Rejects a remainder so the notional is exact in minor units.
 */
export function notionalMoney(
  quantity: InvestmentQuantity,
  price: InstrumentPrice,
): Result<Money, PriceFailure> {
  if (quantity.scale !== QUANTITY_SCALE) {
    return err({ code: 'INVALID_PRICE', message: 'quantity scale must be 8' });
  }
  const numerator = quantity.units * price.minorUnits;
  const denominator = quantityScaleFactor();
  if (numerator % denominator !== 0n) {
    return err({
      code: 'NOTIONAL_REMAINDER',
      message: 'quantity × price is not exact in currency minor units',
    });
  }
  return ok(Money.fromMinorUnits(numerator / denominator, price.currency));
}

export function serializePrice(price: InstrumentPrice): { readonly minorUnits: string; readonly currency: string } {
  return { minorUnits: price.minorUnits.toString(), currency: price.currency };
}
