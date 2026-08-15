import type { UtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import type { InvestmentAccountId, InstrumentId } from './ids.ts';
import { addQuantity, subtractQuantity, zeroQuantity, type InvestmentQuantity } from './quantity.ts';
import type { PositionLot } from './lot.ts';

/**
 * Investment position state. Not a substitute for ledger cash accounting.
 * Quantity is InvestmentQuantity, never Money.
 */
export type PortfolioPosition = {
  readonly investmentAccountId: InvestmentAccountId;
  readonly instrumentId: InstrumentId;
  readonly quantity: InvestmentQuantity;
  readonly availableQuantity: InvestmentQuantity;
  readonly settledQuantity: InvestmentQuantity;
  readonly unsettledQuantity: InvestmentQuantity;
  readonly remainingCost: Money;
  readonly currency: string;
  readonly updatedAt: UtcInstant;
};

export function emptyPosition(
  investmentAccountId: InvestmentAccountId,
  instrumentId: InstrumentId,
  currency: string,
  at: UtcInstant,
): PortfolioPosition {
  const zero = zeroQuantity();
  return Object.freeze({
    investmentAccountId,
    instrumentId,
    quantity: zero,
    availableQuantity: zero,
    settledQuantity: zero,
    unsettledQuantity: zero,
    remainingCost: Money.zero(currency),
    currency,
    updatedAt: at,
  });
}

export function positionFromLots(
  investmentAccountId: InvestmentAccountId,
  instrumentId: InstrumentId,
  lots: readonly PositionLot[],
  settledQuantity: InvestmentQuantity,
  at: UtcInstant,
  currency: string,
): PortfolioPosition {
  let quantity = zeroQuantity();
  let remainingCost = Money.zero(currency);
  for (const lot of lots) {
    if (lot.instrumentId !== instrumentId || lot.remainingQuantity.units === 0n) {
      continue;
    }
    const next = addQuantity(quantity, lot.remainingQuantity);
    if (!next.ok) {
      throw new Error(next.error.message);
    }
    quantity = next.value;
    remainingCost = remainingCost.plus(lot.remainingCost);
  }
  const unsettled = subtractQuantity(quantity, settledQuantity);
  const unsettledQty = unsettled.ok ? unsettled.value : zeroQuantity();
  return Object.freeze({
    investmentAccountId,
    instrumentId,
    quantity,
    availableQuantity: settledQuantity,
    settledQuantity,
    unsettledQuantity: unsettledQty,
    remainingCost,
    currency,
    updatedAt: at,
  });
}
