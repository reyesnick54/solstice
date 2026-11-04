/**
 * HELIOS EARN03 surprise tensor qualification gate.
 */

export const HELIOS_EARN03_SURPRISE_TENSOR_QUALIFIED = 'HELIOS_EARN03_SURPRISE_TENSOR_QUALIFIED' as const;
export const HELIOS_EARN03_SURPRISE_TENSOR_BLOCKED = 'HELIOS_EARN03_SURPRISE_TENSOR_BLOCKED' as const;

export type Earn03QualificationChecks = {
  readonly multiDimensionSurpriseComputed: boolean;
  readonly explicitExpectationSources: boolean;
  readonly noSilentSourceMixing: boolean;
  readonly preReleaseExpectationBound: boolean;
  readonly beatQualityDistinguishesOperatingVsFinancial: boolean;
  readonly vectorHasNoUniversalScalar: boolean;
  readonly peerNormalizationSupported: boolean;
  readonly futureExpectationRejected: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Earn03QualificationResult = {
  readonly marker:
    | typeof HELIOS_EARN03_SURPRISE_TENSOR_QUALIFIED
    | typeof HELIOS_EARN03_SURPRISE_TENSOR_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateEarn03Qualification(checks: Earn03QualificationChecks): Earn03QualificationResult {
  const blockers: string[] = [];
  if (!checks.multiDimensionSurpriseComputed) blockers.push('multi_dimension');
  if (!checks.explicitExpectationSources) blockers.push('expectation_sources');
  if (!checks.noSilentSourceMixing) blockers.push('source_mixing');
  if (!checks.preReleaseExpectationBound) blockers.push('pre_release_expectation');
  if (!checks.beatQualityDistinguishesOperatingVsFinancial) blockers.push('beat_quality');
  if (!checks.vectorHasNoUniversalScalar) blockers.push('vector_scalar');
  if (!checks.peerNormalizationSupported) blockers.push('peer_normalization');
  if (!checks.futureExpectationRejected) blockers.push('future_expectation');
  if (!checks.noExecutionAuthority) blockers.push('no_execution_authority');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_EARN03_SURPRISE_TENSOR_QUALIFIED : HELIOS_EARN03_SURPRISE_TENSOR_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
