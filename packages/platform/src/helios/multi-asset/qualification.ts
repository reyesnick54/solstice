/**
 * HELIOS Multi-Asset Expansion M04 qualification gate.
 */

export const HELIOS_MULTI_ASSET_M04_MARKET_STATE_QUALIFIED =
  'HELIOS_MULTI_ASSET_M04_MARKET_STATE_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M04_MARKET_STATE_BLOCKED =
  'HELIOS_MULTI_ASSET_M04_MARKET_STATE_BLOCKED' as const;

export type MultiAssetM04QualificationChecks = {
  readonly healthyEquityTradable: boolean;
  readonly healthyCryptoResearchable: boolean;
  readonly healthyCommodityReference: boolean;
  readonly staleQuoteDetected: boolean;
  readonly staleBarsDetected: boolean;
  readonly providerOutageDetected: boolean;
  readonly closedMarketDetected: boolean;
  readonly providerMaintenanceDetected: boolean;
  readonly expiringFuturesDetected: boolean;
  readonly missingExecutionCapabilityDetected: boolean;
  readonly entitlementFailureDetected: boolean;
  readonly extremeSpreadDetected: boolean;
  readonly missingVolumeDetected: boolean;
  readonly contradictorySourcesDetected: boolean;
  readonly researchOnlyInstrumentDetected: boolean;
  readonly capabilitiesSeparatedFromTradability: boolean;
  readonly researchBridgeProviderNeutral: boolean;
  readonly noAiValidityChecks: boolean;
};

export type MultiAssetM04QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M04_MARKET_STATE_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M04_MARKET_STATE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMultiAssetM04Qualification(
  checks: MultiAssetM04QualificationChecks,
): MultiAssetM04QualificationResult {
  const blockers: string[] = [];
  const entries: Array<[keyof MultiAssetM04QualificationChecks, string]> = [
    ['healthyEquityTradable', 'healthy equity not TRADABLE'],
    ['healthyCryptoResearchable', 'healthy crypto not researchable'],
    ['healthyCommodityReference', 'healthy commodity reference missing'],
    ['staleQuoteDetected', 'stale quote not classified DATA_STALE'],
    ['staleBarsDetected', 'stale bars not classified DATA_STALE'],
    ['providerOutageDetected', 'provider outage not classified PROVIDER_DEGRADED'],
    ['closedMarketDetected', 'closed market not classified MARKET_CLOSED'],
    ['providerMaintenanceDetected', 'provider maintenance not classified PROVIDER_DEGRADED'],
    ['expiringFuturesDetected', 'expiring futures not classified CONTRACT_EXPIRING'],
    ['missingExecutionCapabilityDetected', 'missing execution capability not classified EXECUTION_UNAVAILABLE'],
    ['entitlementFailureDetected', 'entitlement failure not classified ENTITLEMENT_BLOCKED'],
    ['extremeSpreadDetected', 'extreme spread not classified RESEARCH_ONLY'],
    ['missingVolumeDetected', 'missing volume not handled deterministically'],
    ['contradictorySourcesDetected', 'contradictory sources not classified INSUFFICIENT_DATA'],
    ['researchOnlyInstrumentDetected', 'research-only instrument not classified RESEARCH_ONLY'],
    ['capabilitiesSeparatedFromTradability', 'capability dimensions not separated from tradability'],
    ['researchBridgeProviderNeutral', 'research bridge not provider-neutral'],
    ['noAiValidityChecks', 'AI-based validity checks detected'],
  ];
  for (const [key, message] of entries) {
    if (!checks[key]) {
      blockers.push(message);
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M04_MARKET_STATE_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M04_MARKET_STATE_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
