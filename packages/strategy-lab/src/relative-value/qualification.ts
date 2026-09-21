import {
  HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_BLOCKED,
  HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED,
} from './constants.ts';

export { HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED, HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_BLOCKED };

export type M12QualificationChecks = {
  readonly capsuleRegistered: boolean;
  readonly fingerprintStable: boolean;
  readonly stablePairQualified: boolean;
  readonly unstablePairRejected: boolean;
  readonly correlationCollapseRejected: boolean;
  readonly spreadWideningExit: boolean;
  readonly spreadConvergenceEntry: boolean;
  readonly validLongShortPair: boolean;
  readonly insufficientHistoryRejected: boolean;
  readonly staleLegRejected: boolean;
  readonly timestampMismatchRejected: boolean;
  readonly providerDegradedRejected: boolean;
  readonly partialFillSimulationSupported: boolean;
  readonly unwindRequirementSupported: boolean;
  readonly transactionCostsApplied: boolean;
  readonly restartWorks: boolean;
  readonly strategyFingerprintStable: boolean;
  readonly noLookAheadBias: boolean;
  readonly chronologicalReplayDeterministic: boolean;
  readonly walkForwardSupported: boolean;
  readonly shadowModeSupported: boolean;
  readonly paperModeSupported: boolean;
  readonly demotionWorks: boolean;
  readonly positionSizingExternal: boolean;
  readonly multiLegProposalPresent: boolean;
  readonly statisticalModelNoFinancialAuthority: boolean;
};

export type M12QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly status: 'ENGINEERING_EVALUATION_COMPLETE' | 'ENGINEERING_EVALUATION_BLOCKED';
};

export function evaluateM12Qualification(checks: M12QualificationChecks): M12QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof M12QualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
      status: 'ENGINEERING_EVALUATION_BLOCKED',
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
    status: 'ENGINEERING_EVALUATION_COMPLETE',
  });
}
