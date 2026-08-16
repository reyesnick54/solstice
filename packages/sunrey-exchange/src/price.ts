import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { Money } from '../../money/src/money.ts';

export type PriceRounding = 'FLOOR' | 'CEILING' | 'EXACT';

/**
 * Deterministic fixed-precision price. Never float.
 * `priceUnits` is quote minor units per one whole base unit
 * (for USD, cents per 1.000000 coin when basePrecision is 6).
 */
export type ExchangePrice = {
  readonly baseAssetId: string;
  readonly quoteAssetId: string;
  readonly quoteKind: 'FIAT_MONEY' | 'ASSET';
  readonly priceUnits: bigint;
  readonly quoteScale: number;
  readonly basePrecision: number;
  readonly rounding: PriceRounding;
};

export function exchangePrice(input: {
  readonly baseAssetId: string;
  readonly quoteAssetId: string;
  readonly quoteKind: 'FIAT_MONEY' | 'ASSET';
  readonly priceUnits: bigint;
  readonly quoteScale?: number;
  readonly basePrecision: number;
  readonly rounding?: PriceRounding;
}): ExchangePrice {
  if (typeof input.priceUnits !== 'bigint') {
    throw new TypeError('ExchangePrice.priceUnits must be bigint');
  }
  if (input.priceUnits <= 0n) {
    throw new TypeError('ExchangePrice must be positive');
  }
  if (!Number.isInteger(input.basePrecision) || input.basePrecision < 0) {
    throw new TypeError('basePrecision must be a non-negative integer');
  }
  return Object.freeze({
    baseAssetId: input.baseAssetId,
    quoteAssetId: input.quoteAssetId,
    quoteKind: input.quoteKind,
    priceUnits: input.priceUnits,
    quoteScale: input.quoteScale ?? 2,
    basePrecision: input.basePrecision,
    rounding: input.rounding ?? 'EXACT',
  });
}

export function comparePrice(a: ExchangePrice, b: ExchangePrice): number {
  assertCompatible(a, b);
  if (a.priceUnits === b.priceUnits) {
    return 0;
  }
  return a.priceUnits < b.priceUnits ? -1 : 1;
}

export function quoteForQuantity(price: ExchangePrice, quantity: AssetQuantity): bigint {
  if (quantity.assetId !== price.baseAssetId) {
    throw new TypeError(`quantity asset ${quantity.assetId} does not match price base ${price.baseAssetId}`);
  }
  if (!quantity.isPositive()) {
    throw new TypeError('quantity must be positive');
  }
  const divisor = 10n ** BigInt(price.basePrecision);
  const raw = quantity.scaledUnits * price.priceUnits;
  const quotient = raw / divisor;
  const remainder = raw % divisor;
  if (remainder === 0n || price.rounding === 'FLOOR') {
    return quotient;
  }
  if (price.rounding === 'CEILING') {
    return quotient + 1n;
  }
  throw new TypeError('quote amount is not exact at listing precision; rounding leakage is forbidden');
}

export function quoteMoney(price: ExchangePrice, quantity: AssetQuantity, currency: Money['currency']): Money {
  if (price.quoteKind !== 'FIAT_MONEY') {
    throw new TypeError('quoteMoney requires FIAT_MONEY quote');
  }
  return Money.fromMinorUnits(quoteForQuantity(price, quantity), currency);
}

function assertCompatible(a: ExchangePrice, b: ExchangePrice): void {
  if (
    a.baseAssetId !== b.baseAssetId ||
    a.quoteAssetId !== b.quoteAssetId ||
    a.quoteScale !== b.quoteScale ||
    a.basePrecision !== b.basePrecision
  ) {
    throw new TypeError('incompatible ExchangePrice pair');
  }
}
