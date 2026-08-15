import type { UtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import type { InvestmentAccountId, InstrumentId, ValuationId } from './ids.ts';
import type { InvestmentQuantity } from './quantity.ts';
import type { InstrumentPrice } from './price.ts';
import type { UnrealizedPnL } from './pnl.ts';

export type ValuedPosition = {
  readonly instrumentId: InstrumentId;
  readonly quantity: InvestmentQuantity;
  readonly price: InstrumentPrice;
  readonly priceSource: 'SIMULATED_DETERMINISTIC';
  readonly marketValue: Money;
  readonly remainingCost: Money;
  readonly unrealized: UnrealizedPnL;
};

/**
 * Immutable portfolio valuation snapshot.
 * Multi-currency portfolios stay separated unless an explicit FX context
 * is supplied (this chunk does not invent FX valuation).
 */
export type PortfolioValuationSnapshot = {
  readonly valuationId: ValuationId;
  readonly investmentAccountId: InvestmentAccountId;
  readonly asOf: UtcInstant;
  readonly currency: string;
  readonly positions: readonly ValuedPosition[];
  readonly marketValue: Money;
  readonly costBasis: Money;
  readonly unrealized: Money;
  readonly cash: Money;
  readonly priceSource: 'SIMULATED_DETERMINISTIC';
  readonly fxValuationContext: null;
};

export function freezeValuationSnapshot(snapshot: PortfolioValuationSnapshot): PortfolioValuationSnapshot {
  return Object.freeze({
    ...snapshot,
    positions: Object.freeze([...snapshot.positions]),
    fxValuationContext: null,
  });
}
