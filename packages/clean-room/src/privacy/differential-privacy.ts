export type CapabilityClassification = 'IMPLEMENTED' | 'PARTIAL' | 'INTERFACE_ONLY' | 'FUTURE';

export const DIFFERENTIAL_PRIVACY_CAPABILITY: CapabilityClassification = 'INTERFACE_ONLY';

/**
 * OpenDP and equivalent tooling evaluation. Aggregate analytics on sensitive
 * Human Economy data may use DP when configured. Exact monetary state and
 * individual economic claims remain exact — DP is not applied there.
 */
export const DIFFERENTIAL_PRIVACY_EVALUATION = Object.freeze({
  library: 'OpenDP',
  status: DIFFERENTIAL_PRIVACY_CAPABILITY,
  appropriateFor: Object.freeze([
    'population_statistics',
    'aggregate_economic_patterns',
    'research_analytics',
  ]),
  notAppropriateFor: Object.freeze([
    'blockchain_balances',
    'canonical_monetary_state',
    'individual_economic_claims',
  ]),
  productionEpsilonConfigured: false,
  reason:
    'Differential privacy requires governed epsilon budgets and validated mechanisms; simulation records DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED',
});

export type DifferentialPrivacyDecision = {
  readonly queryClass: string;
  readonly datasetId: string;
  readonly purposeId: string;
  readonly dpApplicable: boolean;
  readonly reason: string;
};

export function evaluateDifferentialPrivacyApplicability(input: {
  readonly queryClass: string;
  readonly datasetId: string;
  readonly purposeId: string;
}): DifferentialPrivacyDecision {
  const blocked = DIFFERENTIAL_PRIVACY_EVALUATION.notAppropriateFor.some((pattern) =>
    input.queryClass.includes(pattern) || input.datasetId.includes(pattern),
  );
  if (blocked) {
    return Object.freeze({
      queryClass: input.queryClass,
      datasetId: input.datasetId,
      purposeId: input.purposeId,
      dpApplicable: false,
      reason: 'exactness required for monetary or individual claim surfaces',
    });
  }
  const allowed = DIFFERENTIAL_PRIVACY_EVALUATION.appropriateFor.some((pattern) =>
    input.queryClass.includes(pattern),
  );
  return Object.freeze({
    queryClass: input.queryClass,
    datasetId: input.datasetId,
    purposeId: input.purposeId,
    dpApplicable: allowed,
    reason: allowed
      ? 'aggregate analytics may consume a privacy budget when a DP mechanism is configured'
      : 'query class is not in the DP-appropriate allow list',
  });
}
