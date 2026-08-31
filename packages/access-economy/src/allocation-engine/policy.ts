/**
 * ACCESS Wave 1 / Prompt 29 — governed allocation policy fixtures.
 *
 * SR_REFERENCE_BALANCE and MR_REFERENCE_BALANCE are allocation reference
 * quantities. They are NOT fiat prices, redemption values, or token pegs.
 */

import { asUtcInstant } from '../../../domain/src/time.ts';
import type { AccessAllocationCategory } from '../dual-token-allocation/types.ts';
import {
  ACCESS_ALLOCATION_ENGINE_VERSION,
  ENGINEERING_SIMULATION_PARAMETERS,
  type AccessAllocationPolicy,
} from './types.ts';

export const DEFAULT_TWAB_WINDOW_DAYS = 30 as const;
export const DEFAULT_SR_REFERENCE_BALANCE = 1_000n;
export const DEFAULT_MR_REFERENCE_BALANCE = 1_000n;
export const DEFAULT_SR_COEFFICIENT = 0.4;
export const DEFAULT_MR_COEFFICIENT = 0.4;
export const DEFAULT_DUAL_COEFFICIENT = 0.2;
export const COEFFICIENT_TOLERANCE = 0.0001;

function basePolicy(overrides: Partial<AccessAllocationPolicy> = {}): AccessAllocationPolicy {
  return Object.freeze({
    policyId: 'access-allocation-base-v1',
    version: '1',
    category: null,
    twabWindowDays: DEFAULT_TWAB_WINDOW_DAYS,
    srReferenceBalance: DEFAULT_SR_REFERENCE_BALANCE,
    mrReferenceBalance: DEFAULT_MR_REFERENCE_BALANCE,
    srCoefficient: DEFAULT_SR_COEFFICIENT,
    mrCoefficient: DEFAULT_MR_COEFFICIENT,
    dualCoefficient: DEFAULT_DUAL_COEFFICIENT,
    diminishingReturnFunction: 'SQRT',
    minimumEligibility: Object.freeze({
      minimumSunReyTwab: 0n,
      minimumMoonReyTwab: 0n,
      minimumParticipantWeightScaled: 0n,
    }),
    maximumAllocationShareBps: null,
    expirationDays: 30,
    rolloverPolicy: 'NO_ROLLOVER',
    unitRoundingMode: 'WHOLE',
    enabled: true,
    effectiveFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
    label: ENGINEERING_SIMULATION_PARAMETERS,
    ...overrides,
  });
}

/** Base 40/40/20 dual-economy participation policy. */
export const DEFAULT_ACCESS_ALLOCATION_POLICY: AccessAllocationPolicy = basePolicy();

/** Category-specific overrides — future-ready profiles. */
export const CATEGORY_ALLOCATION_POLICIES: readonly AccessAllocationPolicy[] = Object.freeze([
  basePolicy({
    policyId: 'access-allocation-ai-compute-v1',
    version: '1',
    category: 'AI_COMPUTE',
    srCoefficient: 0.2,
    mrCoefficient: 0.65,
    dualCoefficient: 0.15,
    unitRoundingMode: 'FRACTIONAL_MILLI',
  }),
  basePolicy({
    policyId: 'access-allocation-experiences-v1',
    version: '1',
    category: 'EXPERIENCES',
    srCoefficient: 0.6,
    mrCoefficient: 0.25,
    dualCoefficient: 0.15,
  }),
]);

export function validatePolicyCoefficients(policy: AccessAllocationPolicy): void {
  const sum = policy.srCoefficient + policy.mrCoefficient + policy.dualCoefficient;
  if (Math.abs(sum - 1.0) > COEFFICIENT_TOLERANCE) {
    throw new RangeError(
      `policy coefficients must sum to 1.00: got ${sum} for policy ${policy.policyId}`,
    );
  }
  if (policy.srCoefficient < 0 || policy.mrCoefficient < 0 || policy.dualCoefficient < 0) {
    throw new RangeError('policy coefficients must be non-negative');
  }
}

export function resolvePolicyForCategory(
  category: AccessAllocationCategory,
  base: AccessAllocationPolicy = DEFAULT_ACCESS_ALLOCATION_POLICY,
  overrides: readonly AccessAllocationPolicy[] = CATEGORY_ALLOCATION_POLICIES,
): AccessAllocationPolicy {
  const categoryPolicy = overrides.find((row) => row.category === category);
  return categoryPolicy ?? base;
}

export function policyToCoefficientsBps(policy: AccessAllocationPolicy): {
  readonly alphaBps: bigint;
  readonly betaBps: bigint;
  readonly gammaBps: bigint;
} {
  return Object.freeze({
    alphaBps: BigInt(Math.round(policy.srCoefficient * 10_000)),
    betaBps: BigInt(Math.round(policy.mrCoefficient * 10_000)),
    gammaBps: BigInt(Math.round(policy.dualCoefficient * 10_000)),
  });
}

export const ACCESS_ALLOCATION_ACTIVE_POLICY_VERSION = ACCESS_ALLOCATION_ENGINE_VERSION;
