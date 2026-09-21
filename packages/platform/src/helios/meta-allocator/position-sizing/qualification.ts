/**
 * HELIOS Multi-Asset M19 — dynamic position sizing qualification gate.
 */

export const HELIOS_MULTI_ASSET_M19_DYNAMIC_POSITION_SIZING_QUALIFIED =
  'HELIOS_MULTI_ASSET_M19_DYNAMIC_POSITION_SIZING_QUALIFIED' as const;

export const HELIOS_MULTI_ASSET_M19_DYNAMIC_POSITION_SIZING_BLOCKED =
  'HELIOS_MULTI_ASSET_M19_DYNAMIC_POSITION_SIZING_BLOCKED' as const;

export type M19QualificationChecks = {
  readonly pipelineDeterministic: boolean;
  readonly lowVolatilityEquitySized: boolean;
  readonly highVolatilityCryptoSized: boolean;
  readonly goldSized: boolean;
  readonly oilSized: boolean;
  readonly insufficientLiquidityZeroOrReduced: boolean;
  readonly highCorrelationReduced: boolean;
  readonly concentratedPortfolioReduced: boolean;
  readonly tinyAccountHandled: boolean;
  readonly zeroCapitalResultValid: boolean;
  readonly stopDistanceChangeAffectsSize: boolean;
  readonly volatilitySpikeReducesSize: boolean;
  readonly staleVolatilityConservative: boolean;
  readonly maximumAllocationRespected: boolean;
  readonly transactionCostsConsidered: boolean;
  readonly restartConfigVersionStable: boolean;
  readonly metaAllocatorIntegration: boolean;
  readonly noAiSizingAuthority: boolean;
  readonly kellyDisabledByDefault: boolean;
  readonly noUniversalStopAssumption: boolean;
};

export type M19QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M19_DYNAMIC_POSITION_SIZING_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M19_DYNAMIC_POSITION_SIZING_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly status: 'ENGINEERING_EVALUATION_COMPLETE' | 'ENGINEERING_EVALUATION_BLOCKED';
};

export function evaluateM19Qualification(checks: M19QualificationChecks): M19QualificationResult {
  const blockers: string[] = [];
  const entries = Object.entries(checks) as [keyof M19QualificationChecks, boolean][];
  for (const [key, passed] of entries) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M19_DYNAMIC_POSITION_SIZING_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
      status: 'ENGINEERING_EVALUATION_BLOCKED',
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M19_DYNAMIC_POSITION_SIZING_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
    status: 'ENGINEERING_EVALUATION_COMPLETE',
  });
}
