/**
 * Versioned GPUV → MoonRey Coin conversion.
 *
 * 1 GPUV is not 1 MoonRey. Arithmetic is exact bigint / rational.
 * Production conversion remains UNCONFIGURED.
 */

import {
  GPUV_EQUALS_MOONREY_BY_DEFINITION,
  GPUV_UNIT,
  MOONREY_OUTPUT_ASSET,
  PRODUCTION_CONVERSION_POLICY,
  SETTLEMENT_PARAMETER_CLASS,
  type ConversionRoundingRule,
  type MoonReyProductiveSettlementConversionPolicy,
  type SettlementRejection,
} from './types.ts';

export const SIMULATION_CONVERSION_POLICY_ID = 'moonrey.productive-settlement.conversion.simulation.v1' as const;
export const SIMULATION_CONVERSION_POLICY_VERSION = '1' as const;

export function simulationConversionPolicy(input?: {
  readonly policyId?: string;
  readonly policyVersion?: string;
  readonly environment?: 'DEVELOPMENT' | 'SIMULATION';
  readonly conversionNumerator?: bigint;
  readonly conversionDenominator?: bigint;
  readonly roundingRule?: ConversionRoundingRule;
  readonly perContributionCeiling?: bigint;
  readonly perEventCeiling?: bigint;
  readonly perObjectCeiling?: bigint;
  readonly perControllerCeiling?: bigint;
  readonly perCategoryEpochCeiling?: bigint;
  readonly globalEpochCeiling?: bigint;
  readonly effectiveHeight?: number;
  readonly supersededHeight?: number | null;
}): MoonReyProductiveSettlementConversionPolicy {
  const conversionDenominator = input?.conversionDenominator ?? 5n;
  if (conversionDenominator <= 0n) {
    throw new TypeError('conversion denominator must be positive');
  }
  const conversionNumerator = input?.conversionNumerator ?? 2n;
  if (conversionNumerator === conversionDenominator) {
    throw new TypeError('simulation conversion must not define 1 GPUV = 1 MoonRey');
  }
  return Object.freeze({
    policyId: input?.policyId ?? SIMULATION_CONVERSION_POLICY_ID,
    policyVersion: input?.policyVersion ?? SIMULATION_CONVERSION_POLICY_VERSION,
    inputValueUnit: GPUV_UNIT,
    outputAsset: MOONREY_OUTPUT_ASSET,
    conversionNumerator,
    conversionDenominator,
    roundingRule: input?.roundingRule ?? 'FLOOR',
    perContributionCeiling: input?.perContributionCeiling ?? 10_000n,
    perEventCeiling: input?.perEventCeiling ?? 25_000n,
    perObjectCeiling: input?.perObjectCeiling ?? 50_000n,
    perControllerCeiling: input?.perControllerCeiling ?? 75_000n,
    perCategoryEpochCeiling: input?.perCategoryEpochCeiling ?? 100_000n,
    globalEpochCeiling: input?.globalEpochCeiling ?? 250_000n,
    effectiveHeight: input?.effectiveHeight ?? 1,
    supersededHeight: input?.supersededHeight ?? null,
    governanceReference: 'sunrey.protocol.simulation.productive-settlement-conversion.v1',
    environment: input?.environment ?? 'SIMULATION',
    parameterClass: SETTLEMENT_PARAMETER_CLASS,
    productionActivated: false,
    gpuvEqualsMoonReyByDefinition: false,
  });
}

export function productionConversionPolicyUnconfigured(): typeof PRODUCTION_CONVERSION_POLICY {
  return PRODUCTION_CONVERSION_POLICY;
}

export function validateConversionPolicy(
  policy: MoonReyProductiveSettlementConversionPolicy,
  height = 1,
): SettlementRejection | null {
  if (policy.productionActivated || policy.environment === 'PRODUCTION_CANDIDATE') {
    return 'CONVERSION_POLICY_PRODUCTION_UNCONFIGURED';
  }
  if (policy.parameterClass !== SETTLEMENT_PARAMETER_CLASS) {
    return 'CONVERSION_POLICY_INVALID';
  }
  if (policy.inputValueUnit !== GPUV_UNIT || policy.outputAsset !== MOONREY_OUTPUT_ASSET) {
    return 'CONVERSION_POLICY_INVALID';
  }
  if (policy.gpuvEqualsMoonReyByDefinition || GPUV_EQUALS_MOONREY_BY_DEFINITION) {
    return 'GPUV_EQUALS_MOONREY_FORBIDDEN';
  }
  if (policy.conversionNumerator <= 0n || policy.conversionDenominator <= 0n) {
    return 'CONVERSION_POLICY_INVALID';
  }
  if (policy.conversionNumerator === policy.conversionDenominator) {
    return 'GPUV_EQUALS_MOONREY_FORBIDDEN';
  }
  if (
    policy.perContributionCeiling <= 0n ||
    policy.perEventCeiling <= 0n ||
    policy.perObjectCeiling <= 0n ||
    policy.perControllerCeiling <= 0n ||
    policy.perCategoryEpochCeiling <= 0n ||
    policy.globalEpochCeiling <= 0n
  ) {
    return 'CONVERSION_POLICY_INVALID';
  }
  if (policy.environment !== 'DEVELOPMENT' && policy.environment !== 'SIMULATION') {
    return 'CONVERSION_POLICY_PRODUCTION_UNCONFIGURED';
  }
  if (height < policy.effectiveHeight) {
    return 'CONVERSION_POLICY_INACTIVE';
  }
  if (policy.supersededHeight !== null && height >= policy.supersededHeight) {
    return 'CONVERSION_POLICY_INACTIVE';
  }
  return null;
}

export function convertGpuvToMoonRey(
  gpuvQuantity: bigint,
  policy: MoonReyProductiveSettlementConversionPolicy,
): bigint {
  if (gpuvQuantity < 0n) {
    throw new TypeError('GPUV quantity must be non-negative');
  }
  const numerator = gpuvQuantity * policy.conversionNumerator;
  const denominator = policy.conversionDenominator;
  if (policy.roundingRule === 'CEILING') {
    return numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;
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

export function remainingCap(ceiling: bigint, used: bigint): bigint {
  return used >= ceiling ? 0n : ceiling - used;
}
