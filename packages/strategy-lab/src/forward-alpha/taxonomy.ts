/**
 * HELIOS FORWARD ALPHA — ALPHA01 canonical forward evidence domain.
 */

export const HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_SCHEMA =
  'sunrey.helios.alpha01.forward-evidence.v1' as const;

export const HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_AUTHORITY =
  'packages/strategy-lab/src/forward-alpha' as const;

export const HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_QUALIFIED =
  'HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_QUALIFIED' as const;

export const HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_BLOCKED =
  'HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_BLOCKED' as const;

/**
 * Strict evidence lanes — never merge across classes.
 * A backtest or historical tick replay is not forward evidence.
 */
export const FORWARD_ALPHA_EVIDENCE_LANES = Object.freeze([
  'HISTORICAL_BACKTEST',
  'SEALED_HOLDOUT',
  'WALK_FORWARD',
  'FORWARD_SHADOW',
  'FORWARD_PAPER',
  'LIVE_CAPITAL',
] as const);

export type ForwardAlphaEvidenceLane = (typeof FORWARD_ALPHA_EVIDENCE_LANES)[number];

/** Lanes that may contain ex-post outcomes attached after immutable decision seals. */
export const FORWARD_ALPHA_FORWARD_ONLY_LANES = Object.freeze([
  'FORWARD_SHADOW',
  'FORWARD_PAPER',
  'LIVE_CAPITAL',
] as const);

export type ForwardAlphaForwardOnlyLane = (typeof FORWARD_ALPHA_FORWARD_ONLY_LANES)[number];

export const FORWARD_ALPHA_STATUSES = Object.freeze([
  'ARCHITECTURE_QUALIFIED',
  'FORWARD_CAMPAIGN_READY',
  'FORWARD_EVIDENCE_ACCUMULATING',
  'FORWARD_EDGE_CANDIDATE',
  'FORWARD_ALPHA_SUPPORTED',
  'FORWARD_ROBUSTNESS_SUPPORTED',
  'PAPER_IMPLEMENTATION_SUPPORTED',
  'LIVE_ALPHA_SUPPORTED',
] as const);

export type ForwardAlphaStatus = (typeof FORWARD_ALPHA_STATUSES)[number];

/** Statuses architecture / unit tests may assert without live or forward paper campaigns. */
export const FORWARD_ALPHA_ARCHITECTURE_TEST_CAPABLE_STATUSES = Object.freeze([
  'ARCHITECTURE_QUALIFIED',
  'FORWARD_CAMPAIGN_READY',
] as const);

export type ForwardAlphaArchitectureTestCapableStatus =
  (typeof FORWARD_ALPHA_ARCHITECTURE_TEST_CAPABLE_STATUSES)[number];

/** Synthetic fixtures must never mint these statuses. */
export const FORWARD_ALPHA_SYNTHETIC_FIXTURE_FORBIDDEN_STATUSES = Object.freeze([
  'FORWARD_ALPHA_SUPPORTED',
  'LIVE_ALPHA_SUPPORTED',
] as const);

export const FORWARD_ALPHA_DECISION_FAILURE_CODES = Object.freeze([
  'OUTCOME_KNOWABLE_BEFORE_DECISION',
  'DECISION_NOT_SEALED',
  'STRATEGY_VERSION_NOT_FROZEN',
  'FEATURE_VERSIONS_UNKNOWN',
  'MARKET_DATA_NOT_CHRONOLOGICAL',
  'OUTCOME_ATTACHED_BEFORE_SEAL',
  'LANE_RELABEL_FORBIDDEN',
  'EVIDENCE_LANE_MERGE_FORBIDDEN',
] as const);

export type ForwardAlphaDecisionFailureCode = (typeof FORWARD_ALPHA_DECISION_FAILURE_CODES)[number];
