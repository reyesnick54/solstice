/**
 * ACCESS-15 governed policy fixtures.
 * All coefficient values are ENGINEERING_SIMULATION_PARAMETERS only.
 */

import { COEFF_BPS_SCALE, PARTICIPATION_SCALE } from './fixed-point.ts';
import {
  ACCESS_15_POLICY_VERSION,
  ENGINEERING_SIMULATION_PARAMETERS,
  type AccessAllocationCategory,
  type AccessCommitmentPolicy,
  type CategoryParticipationCoefficients,
  type DualParticipationPolicy,
  type ParticipationTransformPolicy,
} from './types.ts';

export const DEFAULT_SQRT_TRANSFORM: ParticipationTransformPolicy = Object.freeze({
  transformId: 'access-15-sqrt-v1',
  version: '1',
  type: 'SQRT_CONCAVE',
  scale: PARTICIPATION_SCALE,
  roundingMode: 'TRUNCATE',
  maximumEffectiveParticipation: null,
  status: 'SIMULATION',
});

function coeff(
  category: AccessAllocationCategory,
  alphaBps: bigint,
  betaBps: bigint,
  gammaBps: bigint,
): CategoryParticipationCoefficients {
  return Object.freeze({
    category,
    alphaBps,
    betaBps,
    gammaBps,
    label: ENGINEERING_SIMULATION_PARAMETERS,
  });
}

/** Simulation-only category weights — not production truth. */
export const SIMULATION_CATEGORY_COEFFICIENTS: readonly CategoryParticipationCoefficients[] = Object.freeze([
  coeff('MOBILITY', 4_000n, 4_000n, 2_000n),
  coeff('TRAVEL', 3_500n, 4_000n, 2_500n),
  coeff('STAY', 3_500n, 4_000n, 2_500n),
  coeff('FOOD', 4_500n, 3_500n, 2_000n),
  coeff('SHOP', 4_000n, 4_000n, 2_000n),
  coeff('EXPERIENCES', 6_000n, 2_500n, 1_500n),
  coeff('AI_COMPUTE', 2_000n, 6_500n, 1_500n),
  coeff('ROBOTICS', 2_500n, 6_000n, 1_500n),
  coeff('ENERGY', 1_500n, 7_000n, 1_500n),
]);

export const SIMULATION_DUAL_PARTICIPATION_POLICY: DualParticipationPolicy = Object.freeze({
  policyId: 'access-15-dual-participation-sim-v1',
  version: '1',
  coefficients: SIMULATION_CATEGORY_COEFFICIENTS,
  coeffScale: COEFF_BPS_SCALE,
  status: 'SIMULATION',
});

export const SIMULATION_COMMITMENT_POLICIES: readonly AccessCommitmentPolicy[] = Object.freeze([
  Object.freeze({
    commitmentId: 'access-15-commitment-liquid',
    version: '1',
    kind: 'LIQUID',
    participationMultiplierScaled: PARTICIPATION_SCALE,
    maximumMultiplierScaled: PARTICIPATION_SCALE,
    status: 'SIMULATION',
    label: ENGINEERING_SIMULATION_PARAMETERS,
  }),
  Object.freeze({
    commitmentId: 'access-15-commitment-90d',
    version: '1',
    kind: '90_DAY_COMMITMENT',
    participationMultiplierScaled: PARTICIPATION_SCALE + PARTICIPATION_SCALE / 10n,
    maximumMultiplierScaled: PARTICIPATION_SCALE * 2n,
    status: 'SIMULATION',
    label: ENGINEERING_SIMULATION_PARAMETERS,
  }),
  Object.freeze({
    commitmentId: 'access-15-commitment-180d',
    version: '1',
    kind: '180_DAY_COMMITMENT',
    participationMultiplierScaled: PARTICIPATION_SCALE + PARTICIPATION_SCALE / 5n,
    maximumMultiplierScaled: PARTICIPATION_SCALE * 2n,
    status: 'SIMULATION',
    label: ENGINEERING_SIMULATION_PARAMETERS,
  }),
  Object.freeze({
    commitmentId: 'access-15-commitment-365d',
    version: '1',
    kind: '365_DAY_COMMITMENT',
    participationMultiplierScaled: PARTICIPATION_SCALE + PARTICIPATION_SCALE / 4n,
    maximumMultiplierScaled: PARTICIPATION_SCALE * 2n,
    status: 'SIMULATION',
    label: ENGINEERING_SIMULATION_PARAMETERS,
  }),
]);

export function assertCoefficientConstraints(policy: DualParticipationPolicy): void {
  for (const row of policy.coefficients) {
    const sum = row.alphaBps + row.betaBps + row.gammaBps;
    if (sum > policy.coeffScale) {
      throw new RangeError(
        `category ${row.category} coefficients exceed scale: ${sum} > ${policy.coeffScale}`,
      );
    }
  }
}

export function coefficientsForCategory(
  policy: DualParticipationPolicy,
  category: AccessAllocationCategory,
): CategoryParticipationCoefficients {
  const row = policy.coefficients.find((candidate) => candidate.category === category);
  if (!row) {
    throw new RangeError(`no coefficients for category ${category}`);
  }
  return row;
}

export const ACCESS_15_ACTIVE_POLICY_VERSION = ACCESS_15_POLICY_VERSION;
