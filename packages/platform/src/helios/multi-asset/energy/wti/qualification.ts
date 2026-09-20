/**
 * M08 — WTI energy data qualification gate.
 */

export const HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED =
  'HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_BLOCKED =
  'HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_BLOCKED' as const;

export type WtiEnergyQualificationChecks = {
  readonly wtiReferenceIdentity: boolean;
  readonly oilProxyIdentity: boolean;
  readonly futuresFamilyIdentity: boolean;
  readonly contractIdentity: boolean;
  readonly expirationMetadata: boolean;
  readonly rollLogic: boolean;
  readonly firstNoticeHandling: boolean;
  readonly fourHourBars: boolean;
  readonly continuousSeriesResearch: boolean;
  readonly continuousSeriesNonExecutable: boolean;
  readonly providerFailureHandling: boolean;
  readonly staleDataHandling: boolean;
  readonly entitlementHandling: boolean;
  readonly persistenceRoundTrip: boolean;
  readonly marketStateComposition: boolean;
  readonly trendReadiness4h: boolean;
  readonly eventMetadataHooks: boolean;
  readonly distinctIdentityEnforcement: boolean;
};

export type WtiEnergyQualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const CHECK_MESSAGES: Array<[keyof WtiEnergyQualificationChecks, string]> = [
  ['wtiReferenceIdentity', 'WTI commodity reference identity missing'],
  ['oilProxyIdentity', 'oil ETF proxy identity missing'],
  ['futuresFamilyIdentity', 'WTI futures family identity missing'],
  ['contractIdentity', 'WTI futures contract identity missing'],
  ['expirationMetadata', 'contract expiration metadata missing'],
  ['rollLogic', 'futures roll logic not working'],
  ['firstNoticeHandling', 'first-notice handling not working'],
  ['fourHourBars', '4h OHLCV bars not available'],
  ['continuousSeriesResearch', 'continuous series not available for research'],
  ['continuousSeriesNonExecutable', 'continuous series executability guard missing'],
  ['providerFailureHandling', 'provider failure handling missing'],
  ['staleDataHandling', 'stale data handling missing'],
  ['entitlementHandling', 'entitlement handling missing'],
  ['persistenceRoundTrip', 'persistence round-trip failed'],
  ['marketStateComposition', 'MarketState composition failed'],
  ['trendReadiness4h', '4h trend data readiness not proven'],
  ['eventMetadataHooks', 'event metadata hooks missing'],
  ['distinctIdentityEnforcement', 'distinct identity enforcement missing'],
];

export function evaluateWtiEnergyQualification(
  checks: WtiEnergyQualificationChecks,
): WtiEnergyQualificationResult {
  const blockers: string[] = [];
  for (const [key, message] of CHECK_MESSAGES) {
    if (!checks[key]) {
      blockers.push(message);
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
