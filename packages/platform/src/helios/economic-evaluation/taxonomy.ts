export const EXPERIMENT_STATES = [
  'DRAFT',
  'FROZEN',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'ABORTED',
] as const;
export type ExperimentState = (typeof EXPERIMENT_STATES)[number];

export const EVALUATION_MODES = ['FORWARD_SHADOW', 'PAPER', 'PROVIDER_SANDBOX', 'HISTORICAL_SUPPORT'] as const;
export type EvaluationMode = (typeof EVALUATION_MODES)[number];

export const INTELLIGENCE_BASELINES = [
  'DETERMINISTIC',
  'SINGLE_AGENT',
  'SPECIALIST_MESH',
  'SPECIALIST_CRITIC',
  'FULL_HELIOS',
] as const;
export type IntelligenceBaseline = (typeof INTELLIGENCE_BASELINES)[number];

export const CHALLENGE_TRACKS = ['TRACK_A_INVESTMENT', 'TRACK_B_ECONOMIC_ENTERPRISE'] as const;
export type ChallengeTrack = (typeof CHALLENGE_TRACKS)[number];

export const RUN_OUTCOMES = [
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'STOPPED',
  'LIQUIDATED',
  'ABORTED',
] as const;
export type RunOutcome = (typeof RUN_OUTCOMES)[number];

export const COST_LABELS = ['OPERATING_COST', 'ECONOMICALLY_ALLOCATED_COST'] as const;
export type CostLabel = (typeof COST_LABELS)[number];

export const RESEARCH_COST_SOURCES = ['GROK', 'S3M', 'DATA', 'COMPUTE', 'TOOL', 'OTHER'] as const;
export type ResearchCostSource = (typeof RESEARCH_COST_SOURCES)[number];

export const BENCHMARK_KINDS = [
  'CASH_NO_ACTION',
  'BUY_AND_HOLD',
  'DETERMINISTIC_STRATEGY',
  'SINGLE_AGENT',
] as const;
export type BenchmarkKind = (typeof BENCHMARK_KINDS)[number];

export const MICROCAPITAL_DEFAULTS = Object.freeze({
  startingCapitalMinor: '5000',
  targetCapitalMinor: '500000',
  currency: 'USD',
  horizonDays: 365,
  challengeLabel: '$50 → $5,000 experiment target (not guaranteed)',
});

export const EVALUATION_RULE_FLAGS = Object.freeze({
  PERFORMANCE_CLAIM_ALLOWED: false,
  DEPOSITS_ARE_NOT_PERFORMANCE: true,
  PRINCIPAL_NOT_COUNTED_AS_GROWTH: true,
  NO_ACTION_NOT_REALIZED_PROFIT: true,
  TRACK_A_B_SEPARATED: true,
  RISK_LIMITS_IMMUTABLE: true,
  FAILED_RUNS_PERSIST: true,
  HIDDEN_CAPITAL_FORBIDDEN: true,
  CUSTOMER_ISOLATION_REQUIRED: true,
});
