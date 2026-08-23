import { Money } from '../../../money/src/money.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { InstrumentId } from '../ids.ts';
import type { InvestmentQuantity } from '../quantity.ts';
import type { InstrumentPrice } from '../price.ts';
import type { UnrealizedPnL, RealizedPnL } from '../pnl.ts';
import type { ProductAssetClass } from './types.ts';

export type PriceFreshness = {
  readonly source: string;
  readonly timestamp: UtcInstant;
  readonly freshnessMs: bigint;
  readonly quality: 'FRESH' | 'STALE' | 'UNAVAILABLE' | 'OUTLIER';
  readonly stale: boolean;
};

/**
 * Client-safe holding. Monetary fields are Money. Quantity is scaled
 * integer units. No percentage-return field lives here.
 */
export type HoldingView = {
  readonly instrumentId: InstrumentId;
  readonly identifier: string;
  readonly displayName: string;
  readonly assetClass: ProductAssetClass;
  readonly quantity: InvestmentQuantity;
  readonly averageCost: Money;
  readonly remainingCost: Money;
  readonly marketPrice: InstrumentPrice | null;
  readonly marketValue: Money | null;
  readonly unrealized: UnrealizedPnL | null;
  readonly realized: Money;
  readonly income: Money;
  readonly currency: string;
  readonly valuation: PriceFreshness;
};

export function averageCostFromLots(remainingCost: Money, quantity: InvestmentQuantity): Money {
  if (quantity.units === 0n) {
    return Money.zero(remainingCost.currency);
  }
  return remainingCost.allocate(100_000_000n, quantity.units, 'FLOOR');
}

export function freezeHolding(view: HoldingView): HoldingView {
  return Object.freeze({
    ...view,
    valuation: Object.freeze({ ...view.valuation }),
  });
}

export function aggregateRealized(
  rows: readonly RealizedPnL[],
  instrumentId: InstrumentId,
  currency: string,
): Money {
  return rows
    .filter((row) => row.instrumentId === instrumentId)
    .reduce((sum, row) => sum.plus(row.realized), Money.zero(currency));
}
