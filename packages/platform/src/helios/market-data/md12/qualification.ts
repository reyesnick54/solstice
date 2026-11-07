/**
 * HELIOS MD12 qualification gate.
 */

export const HELIOS_MD12_DATA_QUALITY_MICROSTRUCTURE_QUALIFIED =
  'HELIOS_MD12_DATA_QUALITY_MICROSTRUCTURE_QUALIFIED' as const;
export const HELIOS_MD12_DATA_QUALITY_MICROSTRUCTURE_BLOCKED =
  'HELIOS_MD12_DATA_QUALITY_MICROSTRUCTURE_BLOCKED' as const;

export type Md12QualificationChecks = {
  readonly qualityStateExposesComponents: boolean;
  readonly anomaliesNeverAutoDeleted: boolean;
  readonly staleQuoteDetected: boolean;
  readonly crossedBookDetected: boolean;
  readonly lockedBookDetected: boolean;
  readonly zeroSizeDetected: boolean;
  readonly impossiblePriceDetected: boolean;
  readonly priceSpikeDetected: boolean;
  readonly duplicateTradeDetected: boolean;
  readonly tradeOutsideMarketDetected: boolean;
  readonly sequenceDiscontinuityDetected: boolean;
  readonly latencySpikeDetected: boolean;
  readonly timestampReversalDetected: boolean;
  readonly providerDivergenceDetected: boolean;
  readonly venueDivergenceDetected: boolean;
  readonly classificationsSupported: boolean;
  readonly microstructureFeaturesLineage: boolean;
  readonly liquidityStateExposed: boolean;
  readonly strategyLabRejectsLowIntegrity: boolean;
};

export type Md12QualificationResult = {
  readonly marker:
    | typeof HELIOS_MD12_DATA_QUALITY_MICROSTRUCTURE_QUALIFIED
    | typeof HELIOS_MD12_DATA_QUALITY_MICROSTRUCTURE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMd12Qualification(checks: Md12QualificationChecks): Md12QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Md12QualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MD12_DATA_QUALITY_MICROSTRUCTURE_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MD12_DATA_QUALITY_MICROSTRUCTURE_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
