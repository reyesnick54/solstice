/**
 * HELIOS Multi-Asset Expansion M03 qualification gate.
 */

export const HELIOS_MULTI_ASSET_M03_MARKET_CALENDAR_CONTRACTS_QUALIFIED =
  'HELIOS_MULTI_ASSET_M03_MARKET_CALENDAR_CONTRACTS_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M03_MARKET_CALENDAR_CONTRACTS_BLOCKED =
  'HELIOS_MULTI_ASSET_M03_MARKET_CALENDAR_CONTRACTS_BLOCKED' as const;

export type MultiAssetM03QualificationChecks = {
  readonly equityRegularSession: boolean;
  readonly equityPreMarket: boolean;
  readonly equityPostMarket: boolean;
  readonly equityWeekendClosed: boolean;
  readonly equityHolidayClosed: boolean;
  readonly cryptoWeekendOpen: boolean;
  readonly cryptoMaintenanceWindow: boolean;
  readonly futuresCrossesUtcMidnight: boolean;
  readonly futuresExpiration: boolean;
  readonly futuresFirstNoticeModeled: boolean;
  readonly rollWindow: boolean;
  readonly frontContractResolution: boolean;
  readonly expiredContractBlocked: boolean;
  readonly continuousSeriesNonExecutable: boolean;
  readonly daylightSavingsTransition: boolean;
  readonly unknownCalendarFailClosed: boolean;
  readonly haltedRequiresAuthoritativeEvidence: boolean;
  readonly tradabilityIntegrated: boolean;
};

export type MultiAssetM03QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M03_MARKET_CALENDAR_CONTRACTS_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M03_MARKET_CALENDAR_CONTRACTS_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMultiAssetM03Qualification(
  checks: MultiAssetM03QualificationChecks,
): MultiAssetM03QualificationResult {
  const blockers: string[] = [];
  const entries: Array<[keyof MultiAssetM03QualificationChecks, string]> = [
    ['equityRegularSession', 'equity regular session resolution failed'],
    ['equityPreMarket', 'equity pre-market resolution failed'],
    ['equityPostMarket', 'equity post-market resolution failed'],
    ['equityWeekendClosed', 'equity weekend closure failed'],
    ['equityHolidayClosed', 'equity holiday closure failed'],
    ['cryptoWeekendOpen', 'crypto weekend open failed'],
    ['cryptoMaintenanceWindow', 'crypto maintenance window failed'],
    ['futuresCrossesUtcMidnight', 'futures UTC midnight crossing failed'],
    ['futuresExpiration', 'futures expiration evaluation failed'],
    ['futuresFirstNoticeModeled', 'futures first notice modeling failed'],
    ['rollWindow', 'roll window evaluation failed'],
    ['frontContractResolution', 'front contract resolution failed'],
    ['expiredContractBlocked', 'expired contract blocking failed'],
    ['continuousSeriesNonExecutable', 'continuous series executability guard failed'],
    ['daylightSavingsTransition', 'daylight savings transition failed'],
    ['unknownCalendarFailClosed', 'unknown calendar fail-closed failed'],
    ['haltedRequiresAuthoritativeEvidence', 'halted state evidence guard failed'],
    ['tradabilityIntegrated', 'tradability integration failed'],
  ];
  for (const [key, message] of entries) {
    if (!checks[key]) blockers.push(message);
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M03_MARKET_CALENDAR_CONTRACTS_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M03_MARKET_CALENDAR_CONTRACTS_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
