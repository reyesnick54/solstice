/**
 * HELIOS M07 qualification gate.
 * Emits HELIOS_MULTI_ASSET_M07_GOLD_MARKET_DATA_QUALIFIED when all checks pass.
 */

export const HELIOS_MULTI_ASSET_M07_GOLD_MARKET_DATA_QUALIFIED =
  'HELIOS_MULTI_ASSET_M07_GOLD_MARKET_DATA_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M07_GOLD_MARKET_DATA_BLOCKED =
  'HELIOS_MULTI_ASSET_M07_GOLD_MARKET_DATA_BLOCKED' as const;

export type GoldMarketDataQualificationChecks = {
  readonly gldMappingWorks: boolean;
  readonly goldReferenceIdentityDistinct: boolean;
  readonly goldFuturesFamilyRegistered: boolean;
  readonly specificContractIdentityRegistered: boolean;
  readonly fourHourBarsOrdered: boolean;
  readonly fourHourTrendHistorySufficient: boolean;
  readonly knowableAtSemanticsEnforced: boolean;
  readonly noLookAhead: boolean;
  readonly staleDataRejected: boolean;
  readonly sessionHandlingWorks: boolean;
  readonly expirationMetadataPresent: boolean;
  readonly rollStatePresent: boolean;
  readonly continuousSeriesExists: boolean;
  readonly continuousSeriesNonExecutable: boolean;
  readonly etfFuturesSeparation: boolean;
  readonly noGldFabricationForFutures: boolean;
  readonly persistenceWorks: boolean;
  readonly entitlementCaptured: boolean;
  readonly providerOutageHandled: boolean;
  readonly marketStateExposed: boolean;
};

export type GoldMarketDataQualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M07_GOLD_MARKET_DATA_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M07_GOLD_MARKET_DATA_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateGoldMarketDataQualification(
  checks: GoldMarketDataQualificationChecks,
): GoldMarketDataQualificationResult {
  const blockers: string[] = [];
  if (!checks.gldMappingWorks) blockers.push('GLD mapping failed');
  if (!checks.goldReferenceIdentityDistinct) blockers.push('gold reference identity not distinct');
  if (!checks.goldFuturesFamilyRegistered) blockers.push('gold futures family not registered');
  if (!checks.specificContractIdentityRegistered) blockers.push('specific contract identity missing');
  if (!checks.fourHourBarsOrdered) blockers.push('4h bars not ordered');
  if (!checks.fourHourTrendHistorySufficient) blockers.push('insufficient 4h trend history');
  if (!checks.knowableAtSemanticsEnforced) blockers.push('knowableAt semantics not enforced');
  if (!checks.noLookAhead) blockers.push('look-ahead detected');
  if (!checks.staleDataRejected) blockers.push('stale data not rejected');
  if (!checks.sessionHandlingWorks) blockers.push('session handling failed');
  if (!checks.expirationMetadataPresent) blockers.push('expiration metadata missing');
  if (!checks.rollStatePresent) blockers.push('roll state missing');
  if (!checks.continuousSeriesExists) blockers.push('continuous research series missing');
  if (!checks.continuousSeriesNonExecutable) blockers.push('continuous series is executable');
  if (!checks.etfFuturesSeparation) blockers.push('ETF/futures not separated');
  if (!checks.noGldFabricationForFutures) blockers.push('GLD fabrication path for futures');
  if (!checks.persistenceWorks) blockers.push('persistence failed');
  if (!checks.entitlementCaptured) blockers.push('entitlement not captured');
  if (!checks.providerOutageHandled) blockers.push('provider outage not handled');
  if (!checks.marketStateExposed) blockers.push('MarketState not exposed');
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M07_GOLD_MARKET_DATA_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M07_GOLD_MARKET_DATA_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
