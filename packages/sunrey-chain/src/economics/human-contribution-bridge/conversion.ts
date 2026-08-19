/**
 * Simulation conversion from contribution reference settlement value
 * to authorized SunRey quantity. 1 reference unit is not 1 SunRey.
 * Production conversion remains UNCONFIGURED.
 */

import {
  ENGINEERING_SIMULATION_PARAMETERS,
  PRODUCTION_CONVERSION_POLICY,
  type ConversionRoundingRule,
  type SunReyHumanSettlementConversionPolicy,
} from './types.ts';

export const SIMULATION_CONVERSION_POLICY_ID = 'sunrey.human-settlement.conversion.simulation.v1' as const;
export const SIMULATION_CONVERSION_POLICY_VERSION = '1' as const;

export function simulationConversionPolicy(input?: {
  readonly policyId?: string;
  readonly version?: string;
  readonly environment?: 'DEVELOPMENT' | 'SIMULATION';
  readonly inputDenomination?: string;
  readonly conversionNumerator?: bigint;
  readonly conversionDenominator?: bigint;
  readonly roundingRule?: ConversionRoundingRule;
  readonly perContributionCeiling?: bigint;
  readonly perEpochCeiling?: bigint;
  readonly jurisdictionPolicyRef?: string;
}): SunReyHumanSettlementConversionPolicy {
  const conversionDenominator = input?.conversionDenominator ?? 5n;
  if (conversionDenominator <= 0n) {
    throw new TypeError('conversion denominator must be positive');
  }
  return Object.freeze({
    policyId: input?.policyId ?? SIMULATION_CONVERSION_POLICY_ID,
    version: input?.version ?? SIMULATION_CONVERSION_POLICY_VERSION,
    environment: input?.environment ?? 'SIMULATION',
    inputDenomination: input?.inputDenomination ?? 'HUMAN_CONTRIBUTION_REFERENCE_UNIT',
    conversionNumerator: input?.conversionNumerator ?? 2n,
    conversionDenominator,
    roundingRule: input?.roundingRule ?? 'FLOOR',
    perContributionCeiling: input?.perContributionCeiling ?? 10_000n,
    perEpochCeiling: input?.perEpochCeiling ?? 100_000n,
    jurisdictionPolicyRef: input?.jurisdictionPolicyRef ?? 'policy.sim.jurisdiction.unconfigured',
    governanceReference: 'sunrey.protocol.simulation.human-settlement-conversion.v1',
    effectiveFrom: '2026-08-19T00:00:00.000Z',
    effectiveUntil: null,
    simulationOnly: true,
    productionActivated: false,
    parameterClass: ENGINEERING_SIMULATION_PARAMETERS,
  });
}

export function productionConversionPolicyUnconfigured(): typeof PRODUCTION_CONVERSION_POLICY {
  return PRODUCTION_CONVERSION_POLICY;
}

export function validateConversionPolicy(
  policy: SunReyHumanSettlementConversionPolicy,
): 'CONVERSION_POLICY_INVALID' | 'CONVERSION_POLICY_PRODUCTION_UNCONFIGURED' | null {
  if (policy.productionActivated || !policy.simulationOnly) {
    return 'CONVERSION_POLICY_PRODUCTION_UNCONFIGURED';
  }
  if (policy.parameterClass !== ENGINEERING_SIMULATION_PARAMETERS) {
    return 'CONVERSION_POLICY_INVALID';
  }
  if (policy.conversionNumerator <= 0n || policy.conversionDenominator <= 0n) {
    return 'CONVERSION_POLICY_INVALID';
  }
  if (policy.perContributionCeiling <= 0n || policy.perEpochCeiling <= 0n) {
    return 'CONVERSION_POLICY_INVALID';
  }
  if (policy.environment !== 'DEVELOPMENT' && policy.environment !== 'SIMULATION') {
    return 'CONVERSION_POLICY_PRODUCTION_UNCONFIGURED';
  }
  return null;
}

export function convertReferenceToSunRey(
  referenceValue: bigint,
  policy: SunReyHumanSettlementConversionPolicy,
): bigint {
  const numerator = referenceValue * policy.conversionNumerator;
  const denominator = policy.conversionDenominator;
  if (policy.roundingRule === 'CEILING') {
    return (numerator + denominator - 1n) / denominator;
  }
  if (policy.roundingRule === 'NEAREST_EVEN') {
    const floor = numerator / denominator;
    const remainder = numerator % denominator;
    if (remainder * 2n < denominator) {
      return floor;
    }
    if (remainder * 2n > denominator) {
      return floor + 1n;
    }
    return floor % 2n === 0n ? floor : floor + 1n;
  }
  return numerator / denominator;
}

export function mostRestrictiveCap(caps: readonly bigint[]): bigint {
  if (caps.length === 0) {
    return 0n;
  }
  return caps.reduce((lowest, cap) => (cap < lowest ? cap : lowest));
}
