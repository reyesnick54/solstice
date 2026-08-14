/**
 * Pyramid Data Index — a MARKET_SIGNAL over observed activity.
 * Structurally incapable of being presented as a price guarantee or
 * a forecast. There is no projection, expected-value, or forward-price
 * field. Figures are historical observations from this process only.
 * This index never fabricates buyers, demand, or clearing prices.
 */
export type MarketSignalKind = 'MARKET_SIGNAL';

export type CategoryCount = {
  readonly category: string;
  readonly requestCount: bigint;
};

export type GeographicCount = {
  readonly jurisdiction: string;
  readonly requestCount: bigint;
};

export type HistoricalClearingPrice = {
  readonly requestId: string;
  readonly compensationMinorUnits: bigint;
  readonly asset: 'PYR';
  readonly settledAt: string;
};

export type PyramidDataIndex = {
  readonly kind: MarketSignalKind;
  readonly buyerDemandRequestCount: bigint;
  readonly availableContributorCount: bigint;
  readonly averageCompensationMinorUnits: bigint;
  readonly averageCompensationNote: 'historical_integer_mean_of_settled_compensation';
  readonly geographicDemand: readonly GeographicCount[];
  readonly categoryDemand: readonly CategoryCount[];
  readonly historicalClearingPrices: readonly HistoricalClearingPrice[];
};

export type ForbiddenPdiFields =
  | 'forwardPrice'
  | 'projectedPrice'
  | 'expectedValue'
  | 'forecast'
  | 'priceGuarantee'
  | 'projectedClearing'
  | 'expectedCompensation';

export type PyramidDataIndexHasNoForwardPrice =
  Extract<keyof PyramidDataIndex, ForbiddenPdiFields> extends never ? true : false;

export function buildMarketSignal(input: {
  readonly requestCount: bigint;
  readonly availableContributorCount: bigint;
  readonly geographicDemand: readonly GeographicCount[];
  readonly categoryDemand: readonly CategoryCount[];
  readonly historicalClearingPrices: readonly HistoricalClearingPrice[];
}): PyramidDataIndex {
  let sum = 0n;
  for (const row of input.historicalClearingPrices) {
    sum += row.compensationMinorUnits;
  }
  const n = BigInt(input.historicalClearingPrices.length);
  const average = n === 0n ? 0n : sum / n;
  return Object.freeze({
    kind: 'MARKET_SIGNAL',
    buyerDemandRequestCount: input.requestCount,
    availableContributorCount: input.availableContributorCount,
    averageCompensationMinorUnits: average,
    averageCompensationNote: 'historical_integer_mean_of_settled_compensation',
    geographicDemand: Object.freeze(input.geographicDemand.slice()),
    categoryDemand: Object.freeze(input.categoryDemand.slice()),
    historicalClearingPrices: Object.freeze(input.historicalClearingPrices.slice()),
  });
}
