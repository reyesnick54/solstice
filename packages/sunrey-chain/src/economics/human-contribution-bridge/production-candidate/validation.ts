/**
 * Structural validation for production-candidate conversion policies.
 */

import {
  conversionFailure,
  type ConversionPolicyCandidateValidationResult,
  type SunReyProductionSettlementConversionPolicyCandidate,
} from './types.ts';

export function validateConversionPolicyCandidate(
  policy: SunReyProductionSettlementConversionPolicyCandidate,
): ConversionPolicyCandidateValidationResult {
  if (policy.productionActivated !== false) {
    return conversionFailure('PRODUCTION_CONVERSION_UNAVAILABLE', 'production conversion cannot be activated');
  }
  if (policy.outputAsset !== 'SUNREY_COIN') {
    return conversionFailure('CONVERSION_POLICY_INVALID', 'outputAsset must be SUNREY_COIN');
  }
  if (policy.referenceValueEqualsSunReyByDefinition !== false) {
    return conversionFailure('CONVERSION_POLICY_INVALID', 'REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION must be false');
  }
  if (policy.inputReferenceDenomination.trim().length === 0) {
    return conversionFailure('CONVERSION_POLICY_INVALID', 'inputReferenceDenomination is required');
  }
  if (
    policy.conversionDenominator.status === 'CONFIGURED' &&
    policy.conversionDenominator.value === 0n
  ) {
    return conversionFailure('DENOMINATOR_ZERO', 'conversion denominator cannot be zero');
  }
  if (
    (policy.conversionNumerator.status === 'CONFIGURED' && typeof policy.conversionNumerator.value !== 'bigint') ||
    (policy.conversionDenominator.status === 'CONFIGURED' && typeof policy.conversionDenominator.value !== 'bigint')
  ) {
    return conversionFailure('FLOAT_MONETARY_MATH_FORBIDDEN', 'conversion rationals must be bigint');
  }
  for (const binding of [policy.jurisdictionPolicyRef, policy.valuationPolicyRef, policy.verificationPolicyRef]) {
    if (binding.versionId.trim().toLowerCase() === 'latest') {
      return conversionFailure('CONVERSION_POLICY_INVALID', `binding '${binding.key}' cannot use latest`);
    }
  }
  if (policy.fixture && policy.sourceClass !== 'FIXTURE' && policy.sourceClass !== 'REHEARSAL') {
    return conversionFailure(
      'FIXTURE_CANNOT_AUTHORIZE_PRODUCTION',
      'a fixture conversion policy cannot claim governed production',
    );
  }
  return { ok: true, value: policy };
}

export function conversionValuesConfigured(
  policy: SunReyProductionSettlementConversionPolicyCandidate,
): boolean {
  return (
    policy.conversionNumerator.status === 'CONFIGURED' &&
    policy.conversionDenominator.status === 'CONFIGURED' &&
    policy.perContributionCeiling.status === 'CONFIGURED' &&
    policy.perContributionClassCeiling.status === 'CONFIGURED' &&
    policy.perEpochCeiling.status === 'CONFIGURED' &&
    policy.globalEpochCeiling.status === 'CONFIGURED'
  );
}
