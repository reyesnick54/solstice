import {
  HELIOS_VAL09_SOTP_BLOCKED,
  HELIOS_VAL09_SOTP_QUALIFIED,
  SEGMENT_VALUATION_METHODS,
} from './taxonomy.ts';

export { HELIOS_VAL09_SOTP_QUALIFIED, HELIOS_VAL09_SOTP_BLOCKED };

export type Val09SotpQualificationChecks = {
  readonly multiSegmentIdentityBinding: boolean;
  readonly temporalSegmentHistoryPreserved: boolean;
  readonly perSegmentMethodSelection: boolean;
  readonly segmentDriverTreesSupported: boolean;
  readonly intersegmentEliminationHandling: boolean;
  readonly corporateBridgePresent: boolean;
  readonly conglomerateDiscountNotAutoApplied: boolean;
  readonly scenarioWeightedUncertainSegments: boolean;
  readonly intrinsicDistributionOutputs: boolean;
  readonly noExecutionAuthority: boolean;
  readonly researchOnly: boolean;
};

export type Val09SotpQualificationResult = {
  readonly marker: typeof HELIOS_VAL09_SOTP_QUALIFIED | typeof HELIOS_VAL09_SOTP_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly segmentMethodsSupported: readonly (typeof SEGMENT_VALUATION_METHODS)[number][];
};

export function evaluateVal09SotpQualification(
  checks: Val09SotpQualificationChecks,
): Val09SotpQualificationResult {
  const entries: [keyof Val09SotpQualificationChecks, string][] = [
    ['multiSegmentIdentityBinding', 'multi_segment_identity'],
    ['temporalSegmentHistoryPreserved', 'temporal_history'],
    ['perSegmentMethodSelection', 'per_segment_methods'],
    ['segmentDriverTreesSupported', 'segment_driver_trees'],
    ['intersegmentEliminationHandling', 'intersegment_eliminations'],
    ['corporateBridgePresent', 'corporate_bridge'],
    ['conglomerateDiscountNotAutoApplied', 'conglomerate_discount_observed_only'],
    ['scenarioWeightedUncertainSegments', 'scenario_weighted_segments'],
    ['intrinsicDistributionOutputs', 'intrinsic_distribution_outputs'],
    ['noExecutionAuthority', 'no_execution_authority'],
    ['researchOnly', 'research_only'],
  ];
  const blockers = entries.filter(([key]) => !checks[key]).map(([, label]) => label);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_VAL09_SOTP_QUALIFIED : HELIOS_VAL09_SOTP_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
    segmentMethodsSupported: SEGMENT_VALUATION_METHODS,
  });
}
