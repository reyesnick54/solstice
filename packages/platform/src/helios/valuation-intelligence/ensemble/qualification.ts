import {
  HELIOS_VAL11_ADAPTIVE_VALUATION_ENSEMBLE_BLOCKED,
  HELIOS_VAL11_ADAPTIVE_VALUATION_ENSEMBLE_QUALIFIED,
} from './taxonomy.ts';
import type { ValuationEnsembleState } from './types.ts';

export { HELIOS_VAL11_ADAPTIVE_VALUATION_ENSEMBLE_QUALIFIED, HELIOS_VAL11_ADAPTIVE_VALUATION_ENSEMBLE_BLOCKED };

export type Val11EnsembleQualificationChecks = {
  readonly dualLaneSeparation: boolean;
  readonly intrinsicPriceFree: boolean;
  readonly separateDistributions: boolean;
  readonly reconciliationPresent: boolean;
  readonly adaptiveWeighting: boolean;
  readonly modelChallenger: boolean;
  readonly trustLedgerAppendOnly: boolean;
  readonly noOpaqueAiPriceTarget: boolean;
  readonly noExecutionAuthority: boolean;
  readonly researchOnly: boolean;
};

export type Val11EnsembleQualificationResult = {
  readonly marker:
    | typeof HELIOS_VAL11_ADAPTIVE_VALUATION_ENSEMBLE_QUALIFIED
    | typeof HELIOS_VAL11_ADAPTIVE_VALUATION_ENSEMBLE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateVal11AdaptiveEnsembleQualification(
  checks: Val11EnsembleQualificationChecks,
): Val11EnsembleQualificationResult {
  const entries: [keyof Val11EnsembleQualificationChecks, string][] = [
    ['dualLaneSeparation', 'dual_lane_separation'],
    ['intrinsicPriceFree', 'intrinsic_price_free'],
    ['separateDistributions', 'separate_distributions'],
    ['reconciliationPresent', 'reconciliation'],
    ['adaptiveWeighting', 'adaptive_weighting'],
    ['modelChallenger', 'model_challenger'],
    ['trustLedgerAppendOnly', 'trust_ledger'],
    ['noOpaqueAiPriceTarget', 'no_opaque_ai_price_target'],
    ['noExecutionAuthority', 'no_execution_authority'],
    ['researchOnly', 'research_only'],
  ];
  const blockers = entries.filter(([key]) => !checks[key]).map(([, label]) => label);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_VAL11_ADAPTIVE_VALUATION_ENSEMBLE_QUALIFIED
      : HELIOS_VAL11_ADAPTIVE_VALUATION_ENSEMBLE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export function qualificationChecksFromState(
  state: ValuationEnsembleState,
  input: { readonly laneSeparationViolations: readonly unknown[]; readonly trustLedgerAppendOnly: boolean },
): Val11EnsembleQualificationChecks {
  return Object.freeze({
    dualLaneSeparation: input.laneSeparationViolations.length === 0,
    intrinsicPriceFree: state.intrinsicDistribution.noMarketPriceInput === true,
    separateDistributions:
      state.intrinsicDistribution.lane === 'INTRINSIC' &&
      state.marketReferencedDistribution.lane === 'MARKET_REFERENCED' &&
      state.reconciliation.lanesAveraged === false,
    reconciliationPresent: state.reconciliation.reconciliationId.length > 0,
    adaptiveWeighting: state.modelWeights.length > 0,
    modelChallenger: state.challengerCases.length >= 3,
    trustLedgerAppendOnly: input.trustLedgerAppendOnly,
    noOpaqueAiPriceTarget: state.opaqueAiPriceTarget === false,
    noExecutionAuthority: state.grantsExecutionAuthority === false,
    researchOnly: state.researchOnly === true && state.notAFact === true,
  });
}
