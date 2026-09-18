import { Money } from '../../../../money/src/money.ts';
import type { HeliosFill, HeliosOrderAggregation } from './types.ts';

/**
 * Derive order aggregation from canonical fill data.
 * Do not trust UI-calculated fill aggregation.
 */
export function aggregateFills(
  fills: readonly HeliosFill[],
  requestedQuantityUnits: string,
  currency: string,
): HeliosOrderAggregation {
  if (fills.length === 0) {
    return Object.freeze({
      filledQuantityUnits: '0',
      remainingQuantityUnits: requestedQuantityUnits,
      weightedAveragePriceMinor: '0',
      totalFeeMinor: '0',
      currency,
      fillCount: 0,
    });
  }

  let totalQty = 0n;
  let weightedPriceSum = 0n;
  let totalFee = 0n;

  for (const fill of fills) {
    const qty = BigInt(fill.quantityUnits);
    const price = BigInt(fill.priceMinorUnits);
    const fee = BigInt(fill.feeMinorUnits);
    totalQty += qty;
    weightedPriceSum += qty * price;
    totalFee += fee;
  }

  const requested = BigInt(requestedQuantityUnits);
  const remaining = requested > totalQty ? requested - totalQty : 0n;
  const weightedAvg = totalQty > 0n ? weightedPriceSum / totalQty : 0n;

  return Object.freeze({
    filledQuantityUnits: totalQty.toString(),
    remainingQuantityUnits: remaining.toString(),
    weightedAveragePriceMinor: weightedAvg.toString(),
    totalFeeMinor: totalFee.toString(),
    currency,
    fillCount: fills.length,
  });
}

export function deriveOrderStatusFromAggregation(
  aggregation: HeliosOrderAggregation,
  requestedQuantityUnits: string,
  cancelStatus: string | null,
): 'PARTIALLY_FILLED' | 'FILLED' | 'PARTIALLY_FILLED_THEN_CANCELLED' {
  const filled = BigInt(aggregation.filledQuantityUnits);
  const requested = BigInt(requestedQuantityUnits);

  if (cancelStatus === 'CANCELLED' || cancelStatus === 'CANCEL_ACKNOWLEDGED') {
    if (filled > 0n && filled < requested) {
      return 'PARTIALLY_FILLED_THEN_CANCELLED';
    }
  }

  if (filled >= requested && requested > 0n) {
    return 'FILLED';
  }
  if (filled > 0n) {
    return 'PARTIALLY_FILLED';
  }
  return 'PARTIALLY_FILLED';
}

export function computeTotalNotional(fills: readonly HeliosFill[], currency: string): Money {
  let total = 0n;
  for (const fill of fills) {
    total += BigInt(fill.notionalMinorUnits);
  }
  return Money.fromMinorUnits(total, currency);
}
