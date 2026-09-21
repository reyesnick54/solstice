export const HELIOS_MULTI_ASSET_M18_PORTFOLIO_EXPOSURE_GRAPH_QUALIFIED =
  'HELIOS_MULTI_ASSET_M18_PORTFOLIO_EXPOSURE_GRAPH_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M18_PORTFOLIO_EXPOSURE_GRAPH_BLOCKED =
  'HELIOS_MULTI_ASSET_M18_PORTFOLIO_EXPOSURE_GRAPH_BLOCKED' as const;

export type MultiAssetM18QualificationChecks = {
  readonly singlePositionExposure: boolean;
  readonly correlatedEquitiesCluster: boolean;
  readonly mixedEquityCrypto: boolean;
  readonly goldHedgeLikePosition: boolean;
  readonly longShortPair: boolean;
  readonly fxExposure: boolean;
  readonly venueConcentration: boolean;
  readonly strategyConcentration: boolean;
  readonly preTradeSimulation: boolean;
  readonly closedPositionRemoval: boolean;
  readonly partialFillUpdates: boolean;
  readonly persistenceRestart: boolean;
  readonly provenancePreserved: boolean;
  readonly noFabricatedFactors: boolean;
  readonly riskEngineAuthoritative: boolean;
};

export type MultiAssetM18QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M18_PORTFOLIO_EXPOSURE_GRAPH_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M18_PORTFOLIO_EXPOSURE_GRAPH_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMultiAssetM18Qualification(
  checks: MultiAssetM18QualificationChecks,
): MultiAssetM18QualificationResult {
  const blockers: string[] = [];
  const entries: Array<[keyof MultiAssetM18QualificationChecks, string]> = [
    ['singlePositionExposure', 'single position exposure not computed'],
    ['correlatedEquitiesCluster', 'correlated equities cluster not detected'],
    ['mixedEquityCrypto', 'mixed equity/crypto exposure not aggregated'],
    ['goldHedgeLikePosition', 'gold hedge-like position not classified'],
    ['longShortPair', 'long/short pair net exposure incorrect'],
    ['fxExposure', 'FX exposure not computed'],
    ['venueConcentration', 'venue concentration not computed'],
    ['strategyConcentration', 'strategy concentration not computed'],
    ['preTradeSimulation', 'pre-trade simulation missing before/after/warnings'],
    ['closedPositionRemoval', 'closed positions still contribute exposure'],
    ['partialFillUpdates', 'partial fill updates do not rebuild exposure'],
    ['persistenceRestart', 'exposure graph persistence restart failed'],
    ['provenancePreserved', 'exposure provenance not preserved'],
    ['noFabricatedFactors', 'unavailable factors were fabricated'],
    ['riskEngineAuthoritative', 'M18 attempted to override risk engine authority'],
  ];
  for (const [key, message] of entries) {
    if (!checks[key]) {
      blockers.push(message);
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M18_PORTFOLIO_EXPOSURE_GRAPH_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M18_PORTFOLIO_EXPOSURE_GRAPH_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
