/**
 * Divergence metrics between direct and consolidated U.S. equity feed views.
 */

import type { UsEquityFeedView, UsEquityViewDivergence } from './types.ts';

export function measureUsEquityViewDivergence(
  direct: UsEquityFeedView | null,
  consolidated: UsEquityFeedView | null,
): UsEquityViewDivergence | null {
  if (!direct && !consolidated) {
    return null;
  }

  const directVenueCoverageCount = direct?.venueBbos.length ?? 0;
  const consolidatedVenueCoverageCount = consolidated?.venueBbos.length ?? 0;

  const directBid = direct?.nbbo?.bid?.priceMinorUnits ?? null;
  const consolidatedBid = consolidated?.nbbo?.bid?.priceMinorUnits ?? null;

  let quoteDivergenceBps: number | null = null;
  if (directBid !== null && consolidatedBid !== null && consolidatedBid > 0n) {
    const diff = Number(directBid - consolidatedBid);
    quoteDivergenceBps = (diff / Number(consolidatedBid)) * 10_000;
  }

  const directLatency = direct?.observedAt ? Date.parse(direct.observedAt) : null;
  const consolidatedLatency = consolidated?.observedAt ? Date.parse(consolidated.observedAt) : null;
  let latencyDifferenceMs: number | null = null;
  if (directLatency !== null && consolidatedLatency !== null) {
    latencyDifferenceMs = directLatency - consolidatedLatency;
  }

  return Object.freeze({
    quoteDivergenceBps,
    latencyDifferenceMs,
    directVenueCoverageCount,
    consolidatedVenueCoverageCount,
    venueCoverageDifference: directVenueCoverageCount - consolidatedVenueCoverageCount,
    substituted: false as const,
  });
}
