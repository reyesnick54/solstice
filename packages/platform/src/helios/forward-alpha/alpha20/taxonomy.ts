/**
 * HELIOS Forward Alpha ALPHA20 — forward strategy cohort and control experiment taxonomy.
 */

export const HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA =
  'sunrey.helios.forward-alpha.alpha20-forward-experiments.v1' as const;

export const COHORT_MEMBER_ROLES = Object.freeze([
  'INCUMBENT_CHAMPION',
  'CHALLENGER',
  'NAIVE_BASELINE',
  'CASH',
  'MARKET_BENCHMARK',
  'SIMPLE_FACTOR',
] as const);

export type CohortMemberRole = (typeof COHORT_MEMBER_ROLES)[number];

export const COHORT_STRATEGY_LANES = Object.freeze(['CONTROL', 'TREATMENT'] as const);
export type CohortStrategyLane = (typeof COHORT_STRATEGY_LANES)[number];

export const OPPORTUNITY_ASSIGNMENT_MODES = Object.freeze([
  'CHRONOLOGICAL_IDENTICAL',
  'DETERMINISTIC_SEEDED_RANDOM',
  'FIXED_PREASSIGNED',
] as const);

export type OpportunityAssignmentMode = (typeof OPPORTUNITY_ASSIGNMENT_MODES)[number];

export const STOPPING_POLICY_KINDS = Object.freeze([
  'FIXED_HORIZON',
  'SEQUENTIAL_ALPHA07_BOUND',
  'MANUAL_COMMITTEE_ONLY',
] as const);

export type StoppingPolicyKind = (typeof STOPPING_POLICY_KINDS)[number];

export const EVOL_NOMINATION_PHASES = Object.freeze(['PRE_START', 'POST_START_FORBIDDEN'] as const);
export type EvolNominationPhase = (typeof EVOL_NOMINATION_PHASES)[number];

export const HELIOS_ALPHA20_FORWARD_EXPERIMENTS_QUALIFIED =
  'HELIOS_ALPHA20_FORWARD_EXPERIMENTS_QUALIFIED' as const;

export const HELIOS_ALPHA20_FORWARD_EXPERIMENTS_BLOCKED =
  'HELIOS_ALPHA20_FORWARD_EXPERIMENTS_BLOCKED' as const;
