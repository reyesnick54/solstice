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

/**
 * HELIOS CF14 — final counterfactual learning qualification (CF01–CF13 program marker).
 * Research and simulation only; no execution authority.
 */
export const HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA = 'helios.counterfactual-learning.v1' as const;

export const HELIOS_COUNTERFACTUAL_LEARNING_AUTHORITY =
  'packages/platform/src/helios/counterfactual-learning' as const;

export const HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED =
  'HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED' as const;

export const HELIOS_COUNTERFACTUAL_LEARNING_V1_BLOCKED =
  'HELIOS_COUNTERFACTUAL_LEARNING_V1_BLOCKED' as const;

export const CF_WORK_PACKAGES = Object.freeze([
  'CF01',
  'CF02',
  'CF03',
  'CF04',
  'CF05',
  'CF06',
  'CF07',
  'CF08',
  'CF09',
  'CF10',
  'CF11',
  'CF12',
  'CF13',
] as const);

export type CfWorkPackageId = (typeof CF_WORK_PACKAGES)[number];
