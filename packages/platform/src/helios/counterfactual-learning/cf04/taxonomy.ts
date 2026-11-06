/**
 * HELIOS counterfactual learning — CF04 outcome model taxonomy.
 */

export const HELIOS_CF04_OUTCOME_MODEL_SCHEMA = 'helios.counterfactual-learning.cf04-outcome.v1' as const;

export const HELIOS_CF04_OUTCOME_MODEL_AUTHORITY = 'HELIOS_COUNTERFACTUAL_LEARNING_CF04' as const;

export const HELIOS_CF04_OUTCOME_MODEL_QUALIFIED = 'HELIOS_CF04_OUTCOME_MODEL_QUALIFIED' as const;

export const HELIOS_CF04_OUTCOME_MODEL_BLOCKED = 'HELIOS_CF04_OUTCOME_MODEL_BLOCKED' as const;

/** Calibration must be stamped by an external evaluator — models never self-certify. */
export const HELIOS_CF04_CALIBRATION_CERTIFIER_ROLE = 'EXTERNAL_MODEL_VALIDATION' as const;

export const OUTCOME_DIMENSION_KEYS = [
  'netReturn',
  'excessReturn',
  'drawdown',
  'realizedVolatility',
  'turnover',
  'transactionCost',
  'slippage',
  'capitalUsage',
  'tailLoss',
  'holdingPeriod',
  'capacityUsage',
] as const;

export type OutcomeDimensionKey = (typeof OUTCOME_DIMENSION_KEYS)[number];

export const CF04_BASELINE_MODEL_KINDS = [
  'LINEAR_RIDGE',
  'ROBUST_HUBER',
  'TREE_ENSEMBLE_STUMP',
  'QUANTILE_LINEAR',
] as const;

export type Cf04BaselineModelKind = (typeof CF04_BASELINE_MODEL_KINDS)[number];

export const CF04_QUANTILE_LEVELS = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95] as const;

export type Cf04QuantileLevel = (typeof CF04_QUANTILE_LEVELS)[number];

export const REGIME_LABELS = ['RISK_OFF', 'NEUTRAL', 'RISK_ON', 'STRESS'] as const;

export type Cf04RegimeLabel = (typeof REGIME_LABELS)[number];

export const CF04_LIQUIDITY_BUCKETS = ['DEEP', 'NORMAL', 'THIN', 'ILLIQUID'] as const;

export type Cf04LiquidityBucket = (typeof CF04_LIQUIDITY_BUCKETS)[number];
