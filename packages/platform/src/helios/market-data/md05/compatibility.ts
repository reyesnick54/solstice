/**
 * Economic equivalence checks for provider consensus — incompatible observations are never averaged.
 */

import type { FeedDivergenceField, InboundMarketTick } from './types.ts';

const PRICE_TOLERANCE_BPS = 5n;

export function economicallyEquivalent(left: InboundMarketTick, right: InboundMarketTick): boolean {
  return listDivergenceFields(left, right).length === 0;
}

export function listDivergenceFields(left: InboundMarketTick, right: InboundMarketTick): FeedDivergenceField[] {
  const fields: FeedDivergenceField[] = [];
  if (left.symbol !== right.symbol) fields.push('symbol');
  if (left.venueId !== right.venueId) fields.push('venue');
  if (left.currency !== right.currency) fields.push('currency');
  if (left.sourceTimestamp !== right.sourceTimestamp) fields.push('timestamp');
  if (!pricesWithinTolerance(left.priceMinorUnits, right.priceMinorUnits)) fields.push('price');
  if (left.sizeMinorUnits !== right.sizeMinorUnits) fields.push('size');
  if (left.marketStatus !== right.marketStatus) fields.push('marketStatus');
  return fields;
}

function pricesWithinTolerance(left: bigint, right: bigint): boolean {
  if (left === right) {
    return true;
  }
  const delta = left > right ? left - right : right - left;
  const max = left > right ? left : right;
  if (max === 0n) {
    return true;
  }
  return delta * 10_000n <= max * PRICE_TOLERANCE_BPS;
}
