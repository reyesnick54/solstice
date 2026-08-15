import { Money } from '../../money/src/money.ts';
import type { InstrumentId, LotId } from './ids.ts';
import type { InvestmentQuantity } from './quantity.ts';
import type { LotConsumption } from './lot.ts';

/**
 * Realized P&L is an accounting result for the configured FIFO simulation
 * method. It is not a taxable-income determination.
 */
export type RealizedPnL = {
  readonly instrumentId: InstrumentId;
  readonly quantity: InvestmentQuantity;
  readonly proceeds: Money;
  readonly costBasis: Money;
  readonly fees: Money;
  readonly realized: Money;
  readonly currency: string;
  readonly lotsConsumed: readonly LotId[];
  readonly taxAdvice: false;
  readonly taxableIncomeDetermination: false;
};

export type UnrealizedPnL = {
  readonly instrumentId: InstrumentId;
  readonly marketValue: Money;
  readonly remainingCost: Money;
  readonly unrealized: Money;
  readonly currency: string;
  readonly withdrawable: false;
  readonly postedToCashLedger: false;
};

export function realizedFromSale(input: {
  readonly instrumentId: InstrumentId;
  readonly quantity: InvestmentQuantity;
  readonly proceeds: Money;
  readonly fees: Money;
  readonly consumed: readonly LotConsumption[];
}): RealizedPnL {
  let cost = Money.zero(input.proceeds.currency);
  const lots: LotId[] = [];
  for (const row of input.consumed) {
    cost = cost.plus(row.consumedCost);
    lots.push(row.lotId);
  }
  const realized = input.proceeds.minus(cost).minus(input.fees);
  return Object.freeze({
    instrumentId: input.instrumentId,
    quantity: input.quantity,
    proceeds: input.proceeds,
    costBasis: cost,
    fees: input.fees,
    realized,
    currency: input.proceeds.currency,
    lotsConsumed: Object.freeze(lots),
    taxAdvice: false,
    taxableIncomeDetermination: false,
  });
}

export function unrealizedFromValuation(input: {
  readonly instrumentId: InstrumentId;
  readonly marketValue: Money;
  readonly remainingCost: Money;
}): UnrealizedPnL {
  return Object.freeze({
    instrumentId: input.instrumentId,
    marketValue: input.marketValue,
    remainingCost: input.remainingCost,
    unrealized: input.marketValue.minus(input.remainingCost),
    currency: input.marketValue.currency,
    withdrawable: false,
    postedToCashLedger: false,
  });
}
