/**
 * HELIOS Multi-Asset M13 qualification gate.
 */

export const HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED =
  'HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_BLOCKED =
  'HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_BLOCKED' as const;

export type MultiAssetM13QualificationChecks = {
  readonly trendingUpDetected: boolean;
  readonly trendingDownDetected: boolean;
  readonly rangeBoundDetected: boolean;
  readonly highVolatilityDetected: boolean;
  readonly lowVolatilityDetected: boolean;
  readonly liquidityStressDetected: boolean;
  readonly regimeTransitionPersisted: boolean;
  readonly staleDataFailsClosed: boolean;
  readonly insufficientDataFailsClosed: boolean;
  readonly conflictingIndicatorsHandled: boolean;
  readonly multiTimeframeDisagreementHandled: boolean;
  readonly restartPersistenceWorks: boolean;
  readonly strategyRegimeGatingWorks: boolean;
  readonly noLookAheadEnforced: boolean;
  readonly noAiClassification: boolean;
  readonly multiCharacteristicSupported: boolean;
  readonly instrumentScopeSupported: boolean;
  readonly assetClassScopeSupported: boolean;
  readonly globalScopeSupported: boolean;
};

export type MultiAssetM13QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMultiAssetM13Qualification(
  checks: MultiAssetM13QualificationChecks,
): MultiAssetM13QualificationResult {
  const blockers: string[] = [];
  const entries = Object.entries(checks) as [keyof MultiAssetM13QualificationChecks, boolean][];
  for (const [key, passed] of entries) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
