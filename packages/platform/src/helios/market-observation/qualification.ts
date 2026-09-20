/**
 * HELIOS Multi-Asset M02 qualification gate.
 */

export const HELIOS_MULTI_ASSET_M02_MARKET_OBSERVATIONS_QUALIFIED =
  'HELIOS_MULTI_ASSET_M02_MARKET_OBSERVATIONS_QUALIFIED' as const;

export const HELIOS_MULTI_ASSET_M02_MARKET_OBSERVATIONS_BLOCKED =
  'HELIOS_MULTI_ASSET_M02_MARKET_OBSERVATIONS_BLOCKED' as const;

export type MarketObservationQualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M02_MARKET_OBSERVATIONS_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M02_MARKET_OBSERVATIONS_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMarketObservationQualification(input: {
  readonly spy15mBars: number;
  readonly btc1hBars: number;
  readonly gold4hBars: number;
  readonly chronologicalOrdering: boolean;
  readonly persistenceRestart: boolean;
  readonly staleDataHandled: boolean;
  readonly delayedDataHandled: boolean;
  readonly knowableAtSemantics: boolean;
  readonly duplicateHandling: boolean;
  readonly entitlementEnforcement: boolean;
  readonly invalidOhlcRejected: boolean;
  readonly providerLineage: boolean;
  readonly orderBookValidation: boolean;
}): MarketObservationQualificationResult {
  const blockers: string[] = [];
  if (input.spy15mBars < 1) blockers.push('spy_15m');
  if (input.btc1hBars < 1) blockers.push('btc_1h');
  if (input.gold4hBars < 1) blockers.push('gold_4h');
  if (!input.chronologicalOrdering) blockers.push('chronological_ordering');
  if (!input.persistenceRestart) blockers.push('persistence_restart');
  if (!input.staleDataHandled) blockers.push('stale_data');
  if (!input.delayedDataHandled) blockers.push('delayed_data');
  if (!input.knowableAtSemantics) blockers.push('knowable_at');
  if (!input.duplicateHandling) blockers.push('duplicate_handling');
  if (!input.entitlementEnforcement) blockers.push('entitlement_enforcement');
  if (!input.invalidOhlcRejected) blockers.push('invalid_ohlc');
  if (!input.providerLineage) blockers.push('provider_lineage');
  if (!input.orderBookValidation) blockers.push('order_book_validation');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_MULTI_ASSET_M02_MARKET_OBSERVATIONS_QUALIFIED
      : HELIOS_MULTI_ASSET_M02_MARKET_OBSERVATIONS_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
