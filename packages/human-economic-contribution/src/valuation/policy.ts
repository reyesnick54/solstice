import { ENGINEERING_SIMULATION_PARAMETERS, PRODUCTION_HUMAN_VALUATION_POLICY, type HumanContributionValuationPolicy } from './types.ts';

export const SIMULATION_VALUATION_POLICY_ID = 'sunrey.human-contribution.valuation.simulation.v1' as const;
export const SIMULATION_VALUATION_POLICY_VERSION = '1' as const;
export const SIMULATION_REFERENCE_DENOMINATION = 'HUMAN_CONTRIBUTION_REFERENCE_UNIT' as const;

/**
 * Engineering-simulation valuation policy. These scalars are labeled
 * ENGINEERING_SIMULATION_PARAMETERS and are not production tokenomics.
 */
export function simulationValuationPolicy(input?: {
  readonly policyId?: string;
  readonly version?: string;
  readonly environment?: 'DEVELOPMENT' | 'SIMULATION';
  readonly unitScaleNumerator?: bigint;
  readonly unitScaleDenominator?: bigint;
  readonly perContributionReferenceCeiling?: bigint;
  readonly jurisdictionPolicyRef?: string;
}): HumanContributionValuationPolicy {
  const unitScaleDenominator = input?.unitScaleDenominator ?? 1n;
  if (unitScaleDenominator <= 0n) {
    throw new TypeError('valuation policy denominator must be positive');
  }
  return Object.freeze({
    policyId: input?.policyId ?? SIMULATION_VALUATION_POLICY_ID,
    version: input?.version ?? SIMULATION_VALUATION_POLICY_VERSION,
    environment: input?.environment ?? 'SIMULATION',
    referenceDenomination: SIMULATION_REFERENCE_DENOMINATION,
    method: 'ENGINEERING_SIMULATION_MEASUREMENT_SCALE',
    unitScaleNumerator: input?.unitScaleNumerator ?? 100n,
    unitScaleDenominator,
    perContributionReferenceCeiling: input?.perContributionReferenceCeiling ?? 10_000n,
    jurisdictionPolicyRef: input?.jurisdictionPolicyRef ?? 'policy.sim.jurisdiction.unconfigured',
    governanceReference: 'sunrey.protocol.simulation.human-contribution-valuation.v1',
    effectiveFrom: '2026-08-19T00:00:00.000Z',
    effectiveUntil: null,
    simulationOnly: true,
    productionActivated: false,
    parameterClass: ENGINEERING_SIMULATION_PARAMETERS,
    peveUsedAsTokenFormula: false,
    humanWorthUsedAsValue: false,
  });
}

export function productionValuationPolicyUnavailable(): typeof PRODUCTION_HUMAN_VALUATION_POLICY {
  return PRODUCTION_HUMAN_VALUATION_POLICY;
}

export function validateValuationPolicy(policy: HumanContributionValuationPolicy): 'VALUATION_POLICY_INVALID' | 'PRODUCTION_VALUATION_UNAVAILABLE' | null {
  if (policy.productionActivated) {
    return 'PRODUCTION_VALUATION_UNAVAILABLE';
  }
  if (!policy.simulationOnly) {
    return 'PRODUCTION_VALUATION_UNAVAILABLE';
  }
  if (policy.parameterClass !== ENGINEERING_SIMULATION_PARAMETERS) {
    return 'VALUATION_POLICY_INVALID';
  }
  if (policy.unitScaleNumerator <= 0n || policy.unitScaleDenominator <= 0n) {
    return 'VALUATION_POLICY_INVALID';
  }
  if (policy.perContributionReferenceCeiling <= 0n) {
    return 'VALUATION_POLICY_INVALID';
  }
  if (policy.peveUsedAsTokenFormula || policy.humanWorthUsedAsValue) {
    return 'VALUATION_POLICY_INVALID';
  }
  if (policy.environment === undefined) {
    return 'VALUATION_POLICY_INVALID';
  }
  return null;
}
