/**
 * HELIOS Forward Alpha — ALPHA23 automatic strategy demotion and fail-safe research control.
 * Simulation / research only — never increases risk to rationalize a failing strategy.
 */

export const ALPHA23_SCHEMA = 'helios.forward-alpha.alpha23.automatic-demotion.v1' as const;

export const HELIOS_ALPHA23_AUTOMATIC_DEMOTION_QUALIFIED =
  'HELIOS_ALPHA23_AUTOMATIC_DEMOTION_QUALIFIED' as const;
export const HELIOS_ALPHA23_AUTOMATIC_DEMOTION_BLOCKED =
  'HELIOS_ALPHA23_AUTOMATIC_DEMOTION_BLOCKED' as const;

/** Coarse forward-research posture (maps to Strategy Lab promotion states via bridge). */
export const FORWARD_RESEARCH_POSTURES = Object.freeze([
  'RESEARCH',
  'SHADOW',
  'PAPER',
  'CHAMPION',
  'PAUSED',
  'FAILED_SAFE',
] as const);

export type ForwardResearchPosture = (typeof FORWARD_RESEARCH_POSTURES)[number];

export const FORWARD_DEMOTION_TRANSITIONS = Object.freeze([
  'PAPER_TO_SHADOW',
  'SHADOW_TO_PAUSED',
  'ANY_TO_FAILED_SAFE',
  'NONE',
] as const);

export type ForwardDemotionTransition = (typeof FORWARD_DEMOTION_TRANSITIONS)[number];

export const FORWARD_DEMOTION_TRIGGERS = Object.freeze([
  'DRAWDOWN_LIMIT_BREACHED',
  'ALPHA_CONFIDENCE_DETERIORATION',
  'BENCHMARK_UNDERPERFORMANCE',
  'EXECUTION_COST_EXPLOSION',
  'MARKET_DATA_DEGRADATION',
  'STRATEGY_FEATURE_FAILURE',
  'DECISION_RATE_ANOMALY',
  'REGIME_INCOMPATIBILITY',
  'CAPACITY_DETERIORATION',
  'STATISTICAL_EVIDENCE_COLLAPSE',
  'OPERATIONAL_ANOMALY',
  /** Wired from ALPHA11 decay monitor (EVOL11-aligned hints). */
  'ALPHA11_DECAY_SIGNAL',
] as const);

export type ForwardDemotionTrigger = (typeof FORWARD_DEMOTION_TRIGGERS)[number];

/** Actions the automatic system must never take to salvage a failing strategy. */
export const FORBIDDEN_AUTOMATIC_RESEARCH_ACTIONS = Object.freeze([
  'INCREASE_RISK_LIMITS',
  'INCREASE_LEVERAGE',
  'DOUBLE_POSITION_SIZE',
  'AVERAGE_DOWN',
  'CHANGE_MANDATE',
  'REWRITE_BENCHMARK',
  'EXTEND_CAMPAIGN_FOR_FAVORABLE_RESULT',
] as const);

export type ForbiddenAutomaticResearchAction = (typeof FORBIDDEN_AUTOMATIC_RESEARCH_ACTIONS)[number];

export const RESEARCH_REACTIVATION_GATES = Object.freeze([
  'NEW_EVIDENCE',
  'EXPLICIT_GOVERNANCE_POLICY',
  'NEW_VERSION_OR_CAMPAIGN',
] as const);

export type ResearchReactivationGate = (typeof RESEARCH_REACTIVATION_GATES)[number];

export const FORWARD_STRATEGY_HEALTH_BANDS = Object.freeze([
  'HEALTHY',
  'WATCH',
  'DEMOTION_RECOMMENDED',
  'FAIL_SAFE_REQUIRED',
] as const);

export type ForwardStrategyHealthBand = (typeof FORWARD_STRATEGY_HEALTH_BANDS)[number];
