/**
 * HELIOS AAF07 external market-data certification qualification marker.
 */

export const HELIOS_AAF07_EXTERNAL_MARKET_DATA_CERTIFICATION_QUALIFIED =
  'HELIOS_AAF07_EXTERNAL_MARKET_DATA_CERTIFICATION_QUALIFIED' as const;

export const HELIOS_AAF07_EXTERNAL_MARKET_DATA_CERTIFICATION_BLOCKED =
  'HELIOS_AAF07_EXTERNAL_MARKET_DATA_CERTIFICATION_BLOCKED' as const;

export type Aaf07MarketDataQualificationResult = {
  readonly marker:
    | typeof HELIOS_AAF07_EXTERNAL_MARKET_DATA_CERTIFICATION_QUALIFIED
    | typeof HELIOS_AAF07_EXTERNAL_MARKET_DATA_CERTIFICATION_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAaf07MarketDataQualification(input: {
  readonly finnhubHarnessPassed: boolean;
  readonly coingeckoHarnessPassed: boolean;
  readonly silentFixtureGuardPassed: boolean;
  readonly capabilityContractPresent: boolean;
  readonly certificationStatesPresent: boolean;
  readonly healthEvidenceSealed: boolean;
  readonly metricsRecorded: boolean;
}): Aaf07MarketDataQualificationResult {
  const blockers: string[] = [];
  if (!input.capabilityContractPresent) blockers.push('capability_contract');
  if (!input.certificationStatesPresent) blockers.push('certification_states');
  if (!input.finnhubHarnessPassed) blockers.push('finnhub_harness');
  if (!input.coingeckoHarnessPassed) blockers.push('coingecko_harness');
  if (!input.silentFixtureGuardPassed) blockers.push('silent_fixture_guard');
  if (!input.healthEvidenceSealed) blockers.push('health_evidence');
  if (!input.metricsRecorded) blockers.push('metrics');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_AAF07_EXTERNAL_MARKET_DATA_CERTIFICATION_QUALIFIED
      : HELIOS_AAF07_EXTERNAL_MARKET_DATA_CERTIFICATION_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
