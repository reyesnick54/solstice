/**
 * HELIOS Multi-Asset M09 — engineering/strategy evaluation qualification gate.
 * Does not claim profitability.
 */

export const HELIOS_MULTI_ASSET_M09_INDEX_MEAN_REVERSION_QUALIFIED =
  'HELIOS_MULTI_ASSET_M09_INDEX_MEAN_REVERSION_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M09_INDEX_MEAN_REVERSION_BLOCKED =
  'HELIOS_MULTI_ASSET_M09_INDEX_MEAN_REVERSION_BLOCKED' as const;

export type M09QualificationChecks = {
  readonly capsuleRegistered: boolean;
  readonly fingerprintStable: boolean;
  readonly parameterVersionTracked: boolean;
  readonly validEntryPath: boolean;
  readonly noEntryWhenBlocked: boolean;
  readonly staleDataRejected: boolean;
  readonly marketClosedRejected: boolean;
  readonly extremeVolatilityRejected: boolean;
  readonly insufficientHistoryRejected: boolean;
  readonly exitTargetWorks: boolean;
  readonly timeStopWorks: boolean;
  readonly riskStopWorks: boolean;
  readonly chronologicalReplayDeterministic: boolean;
  readonly costModelApplied: boolean;
  readonly benchmarkComparisonPresent: boolean;
  readonly walkForwardSupported: boolean;
  readonly shadowModeSupported: boolean;
  readonly paperModeSupported: boolean;
  readonly demotionWorks: boolean;
  readonly restartWorks: boolean;
  readonly customerIsolationHolds: boolean;
  readonly noLookAheadBias: boolean;
  readonly positionSizingExternal: boolean;
};

export type M09QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M09_INDEX_MEAN_REVERSION_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M09_INDEX_MEAN_REVERSION_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly status: 'ENGINEERING_EVALUATION_COMPLETE' | 'ENGINEERING_EVALUATION_BLOCKED';
};

export function evaluateM09Qualification(checks: M09QualificationChecks): M09QualificationResult {
  const blockers: string[] = [];
  const entries = Object.entries(checks) as [keyof M09QualificationChecks, boolean][];
  for (const [key, passed] of entries) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M09_INDEX_MEAN_REVERSION_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
      status: 'ENGINEERING_EVALUATION_BLOCKED',
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M09_INDEX_MEAN_REVERSION_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
    status: 'ENGINEERING_EVALUATION_COMPLETE',
  });
}
