/**
 * HELIOS Multi-Asset M17 qualification gate.
 */

export const HELIOS_MULTI_ASSET_M17_DYNAMIC_CORRELATION_QUALIFIED =
  'HELIOS_MULTI_ASSET_M17_DYNAMIC_CORRELATION_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M17_DYNAMIC_CORRELATION_BLOCKED =
  'HELIOS_MULTI_ASSET_M17_DYNAMIC_CORRELATION_BLOCKED' as const;

export type MultiAssetM17QualificationChecks = {
  readonly spyQqqHighCorrelation: boolean;
  readonly unrelatedPairLowCorrelation: boolean;
  readonly changingCorrelationDetected: boolean;
  readonly negativeCorrelationDetected: boolean;
  readonly insufficientHistoryDetected: boolean;
  readonly staleObservationsDetected: boolean;
  readonly multipleLookbackWindows: boolean;
  readonly matrixGeneration: boolean;
  readonly clusterGeneration: boolean;
  readonly restartReproducible: boolean;
  readonly noLookAhead: boolean;
  readonly opportunityGraphEvidenceUpdated: boolean;
  readonly portfolioQueryResearchOnly: boolean;
  readonly doesNotApproveOrders: boolean;
};

export type MultiAssetM17QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M17_DYNAMIC_CORRELATION_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M17_DYNAMIC_CORRELATION_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMultiAssetM17Qualification(
  checks: MultiAssetM17QualificationChecks,
): MultiAssetM17QualificationResult {
  const blockers: string[] = [];
  if (!checks.spyQqqHighCorrelation) blockers.push('SPY/QQQ high correlation scenario failed');
  if (!checks.unrelatedPairLowCorrelation) blockers.push('unrelated synthetic pair scenario failed');
  if (!checks.changingCorrelationDetected) blockers.push('changing correlation not detected');
  if (!checks.negativeCorrelationDetected) blockers.push('negative correlation not detected');
  if (!checks.insufficientHistoryDetected) blockers.push('insufficient history not detected');
  if (!checks.staleObservationsDetected) blockers.push('stale observations not detected');
  if (!checks.multipleLookbackWindows) blockers.push('multiple lookback windows not supported');
  if (!checks.matrixGeneration) blockers.push('correlation matrix generation failed');
  if (!checks.clusterGeneration) blockers.push('correlation cluster generation failed');
  if (!checks.restartReproducible) blockers.push('restart reproducibility failed');
  if (!checks.noLookAhead) blockers.push('look-ahead detected');
  if (!checks.opportunityGraphEvidenceUpdated) blockers.push('M15 opportunity graph evidence not updated');
  if (!checks.portfolioQueryResearchOnly) blockers.push('portfolio query not research-only');
  if (!checks.doesNotApproveOrders) blockers.push('correlation service must not approve orders');

  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M17_DYNAMIC_CORRELATION_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }

  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M17_DYNAMIC_CORRELATION_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
