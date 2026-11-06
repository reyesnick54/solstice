/**
 * HELIOS CF03 — counterfactual learning: behavior policy and propensity intelligence (taxonomy).
 */

export const HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA_VERSION = 'sunrey.helios.counterfactual-learning.cf03.v1' as const;

/** Research / paper-only; never customer live finance exploration. */
export const STOCHASTIC_POLICY_ENVIRONMENTS = ['RESEARCH_SIMULATION', 'PAPER', 'OTHER_RESEARCH'] as const;
export type StochasticPolicyEnvironment = (typeof STOCHASTIC_POLICY_ENVIRONMENTS)[number];

export const POLICY_SUPPORT_STATES = ['SUPPORTED', 'WEAK_SUPPORT', 'POOR_SUPPORT', 'NO_SUPPORT'] as const;
export type PolicySupportState = (typeof POLICY_SUPPORT_STATES)[number];

export const HELIOS_CF03_POLICY_PROPENSITY_QUALIFIED = 'HELIOS_CF03_POLICY_PROPENSITY_QUALIFIED' as const;
