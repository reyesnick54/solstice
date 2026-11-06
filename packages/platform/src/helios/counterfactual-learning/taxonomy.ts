/**
 * HELIOS counterfactual learning — CF01 decision record + CF03 behavior policy / propensity (taxonomy).
 */

/** CF01 — immutable research decision episodes (not a financial ledger). */
export const HELIOS_CF01_DECISION_LEDGER_SCHEMA =
  'sunrey.helios.counterfactual-learning.cf01.v1' as const;

export const HELIOS_CF01_DECISION_LEDGER_QUALIFIED = 'HELIOS_CF01_DECISION_LEDGER_QUALIFIED' as const;

export const HELIOS_CF01_DECISION_LEDGER_BLOCKED = 'HELIOS_CF01_DECISION_LEDGER_BLOCKED' as const;

/** Consequential portfolio / strategy actions considered at decision time */
export const COUNTERFACTUAL_ACTION_CLASSES = [
  'ENTER',
  'EXIT',
  'HOLD',
  'NO_ACTION',
  'WAIT',
  'SIZE_UP',
  'SIZE_DOWN',
  'REBALANCE',
  'ROUTE_ALTERNATIVE',
  'DELAY_ENTRY',
  'EARLY_EXIT',
] as const;

export type CounterfactualActionClass = (typeof COUNTERFACTUAL_ACTION_CLASSES)[number];

/** CF03 — behavior policy and propensity intelligence. */

export const HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA_VERSION =
  'sunrey.helios.counterfactual-learning.cf03.v1' as const;

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
export const HELIOS_COUNTERFACTUAL_LEARNING_PROGRAM_SCHEMA =
  'helios.counterfactual-learning.v1' as const;

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
