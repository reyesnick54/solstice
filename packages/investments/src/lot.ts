import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { Money } from '../../money/src/money.ts';
import type { FillId, InstrumentId, LotId } from './ids.ts';
import {
  addQuantity,
  quantityCmp,
  subtractQuantity,
  type InvestmentQuantity,
  type QuantityFailure,
} from './quantity.ts';
import type { InstrumentPrice } from './price.ts';
import { notionalMoney, type PriceFailure } from './price.ts';

/**
 * Simulation/accounting lot method is FIFO.
 * This is not a customer tax election and is not tax advice.
 */
export type PositionLot = {
  readonly lotId: LotId;
  readonly instrumentId: InstrumentId;
  readonly acquiredAt: UtcInstant;
  readonly quantity: InvestmentQuantity;
  readonly remainingQuantity: InvestmentQuantity;
  readonly acquisitionUnitCost: InstrumentPrice;
  readonly totalCost: Money;
  readonly remainingCost: Money;
  readonly currency: string;
  readonly sourceFillId: FillId;
  readonly taxTreatment: 'FIFO_SIMULATION_ACCOUNTING_METHOD';
  readonly taxAdvice: false;
};

export type LotConsumption = {
  readonly lotId: LotId;
  readonly consumedQuantity: InvestmentQuantity;
  readonly consumedCost: Money;
  readonly remainingLot: PositionLot;
};

export type LotFailure = QuantityFailure | PriceFailure | { readonly code: 'LOT_CURRENCY'; readonly message: string };

export function freezeLot(lot: PositionLot): PositionLot {
  return Object.freeze({ ...lot, taxAdvice: false as const, taxTreatment: 'FIFO_SIMULATION_ACCOUNTING_METHOD' });
}

export function consumeLotsFifo(
  lots: readonly PositionLot[],
  quantity: InvestmentQuantity,
): Result<{ readonly consumed: readonly LotConsumption[]; readonly remaining: readonly PositionLot[] }, LotFailure> {
  let remainingToSell = quantity;
  const consumed: LotConsumption[] = [];
  const remaining: PositionLot[] = [];
  const ordered = [...lots].sort((left, right) => (left.acquiredAt < right.acquiredAt ? -1 : 1));
  for (const lot of ordered) {
    if (remainingToSell.units === 0n) {
      remaining.push(lot);
      continue;
    }
    const take = quantityCmp(lot.remainingQuantity, remainingToSell) <= 0 ? lot.remainingQuantity : remainingToSell;
    const leftover = subtractQuantity(lot.remainingQuantity, take);
    if (!leftover.ok) {
      return leftover;
    }
    const consumedCost = proportionalCost(lot, take);
    if (!consumedCost.ok) {
      return consumedCost;
    }
    const leftoverCost = lot.remainingCost.minus(consumedCost.value);
    consumed.push({
      lotId: lot.lotId,
      consumedQuantity: take,
      consumedCost: consumedCost.value,
      remainingLot: freezeLot({
        ...lot,
        remainingQuantity: leftover.value,
        remainingCost: leftoverCost,
      }),
    });
    if (leftover.value.units > 0n) {
      remaining.push(
        freezeLot({
          ...lot,
          remainingQuantity: leftover.value,
          remainingCost: leftoverCost,
        }),
      );
    }
    const next = subtractQuantity(remainingToSell, take);
    if (!next.ok) {
      return next;
    }
    remainingToSell = next.value;
  }
  if (remainingToSell.units > 0n) {
    return err({ code: 'INVALID_QUANTITY', message: 'sell quantity exceeds owned lots' });
  }
  return ok({ consumed: Object.freeze(consumed), remaining: Object.freeze(remaining) });
}

export function openLot(input: {
  readonly lotId: LotId;
  readonly instrumentId: InstrumentId;
  readonly acquiredAt: UtcInstant;
  readonly quantity: InvestmentQuantity;
  readonly unitCost: InstrumentPrice;
  readonly sourceFillId: FillId;
}): Result<PositionLot, LotFailure> {
  const total = notionalMoney(input.quantity, input.unitCost);
  if (!total.ok) {
    return total;
  }
  return ok(
    freezeLot({
      lotId: input.lotId,
      instrumentId: input.instrumentId,
      acquiredAt: input.acquiredAt,
      quantity: input.quantity,
      remainingQuantity: input.quantity,
      acquisitionUnitCost: input.unitCost,
      totalCost: total.value,
      remainingCost: total.value,
      currency: input.unitCost.currency,
      sourceFillId: input.sourceFillId,
      taxTreatment: 'FIFO_SIMULATION_ACCOUNTING_METHOD',
      taxAdvice: false,
    }),
  );
}

function proportionalCost(lot: PositionLot, take: InvestmentQuantity): Result<Money, LotFailure> {
  if (lot.remainingQuantity.units === 0n) {
    return err({ code: 'INVALID_QUANTITY', message: 'lot has no remaining quantity' });
  }
  const numerator = lot.remainingCost.minorUnits * take.units;
  if (numerator % lot.remainingQuantity.units !== 0n) {
    return err({
      code: 'NOTIONAL_REMAINDER',
      message: 'lot cost allocation is not exact in minor units',
    });
  }
  return ok(Money.fromMinorUnits(numerator / lot.remainingQuantity.units, lot.currency));
}

export function splitAdjustLots(
  lots: readonly PositionLot[],
  numerator: bigint,
  denominator: bigint,
): Result<readonly PositionLot[], LotFailure> {
  if (numerator <= 0n || denominator <= 0n) {
    return err({ code: 'INVALID_QUANTITY', message: 'split ratio must be positive integers' });
  }
  const adjusted: PositionLot[] = [];
  for (const lot of lots) {
    const nextQtyUnits = (lot.remainingQuantity.units * numerator) / denominator;
    if ((lot.remainingQuantity.units * numerator) % denominator !== 0n) {
      return err({ code: 'NOTIONAL_REMAINDER', message: 'split does not preserve exact quantity scale' });
    }
    const originalQty = addQuantity(
      { units: 0n, scale: lot.quantity.scale },
      { units: (lot.quantity.units * numerator) / denominator, scale: lot.quantity.scale },
    );
    if (!originalQty.ok) {
      return originalQty;
    }
    adjusted.push(
      freezeLot({
        ...lot,
        quantity: originalQty.value,
        remainingQuantity: { units: nextQtyUnits, scale: lot.remainingQuantity.scale },
        remainingCost: lot.remainingCost,
        totalCost: lot.totalCost,
      }),
    );
  }
  return ok(Object.freeze(adjusted));
}
