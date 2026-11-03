/**
 * HELIOS OS07 — Research Monitor DSL taxonomy.
 * Detects conditions and requests research; not a trading strategy language.
 */

export const RESEARCH_MONITOR_SCHEMA_VERSION = 'helios-research-monitor-v1' as const;

export const RESEARCH_MONITOR_TRIGGER_ACTIONS = Object.freeze(['REQUEST_RESEARCH'] as const);
export type ResearchMonitorTriggerAction = (typeof RESEARCH_MONITOR_TRIGGER_ACTIONS)[number];

export const HELIOS_CANONICAL_FEATURE_KINDS = Object.freeze([
  'price',
  'returns',
  'realized_volatility',
  'volume',
  'spread',
  'macro_feature',
  'earnings_event_state',
  'cross_asset_feature',
  'regime_state',
  'breadth',
  'relative_volume',
] as const);
export type HeliosCanonicalFeatureKind = (typeof HELIOS_CANONICAL_FEATURE_KINDS)[number];

export const RESEARCH_MONITOR_PRIORITIES = Object.freeze([
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
] as const);
export type ResearchMonitorPriority = (typeof RESEARCH_MONITOR_PRIORITIES)[number];

export const STALE_FEATURE_POLICIES = Object.freeze([
  'FAIL_CLOSED',
  'TREAT_CONDITION_FALSE',
  'IGNORE_MONITOR',
] as const);
export type StaleFeaturePolicy = (typeof STALE_FEATURE_POLICIES)[number];

export const RESEARCH_MONITOR_RUNTIME_STATUSES = Object.freeze([
  'ACTIVE',
  'NOT_STARTED',
  'EXPIRED',
  'EXHAUSTED',
  'COOLDOWN',
  'PAUSED',
] as const);
export type ResearchMonitorRuntimeStatus = (typeof RESEARCH_MONITOR_RUNTIME_STATUSES)[number];

export const RESEARCH_MONITOR_EVAL_OUTCOMES = Object.freeze([
  'NOOP',
  'CONDITION_FALSE',
  'TRIGGERED',
  'BLOCKED',
] as const);
export type ResearchMonitorEvalOutcome = (typeof RESEARCH_MONITOR_EVAL_OUTCOMES)[number];

export const RESEARCH_MONITOR_BLOCK_REASONS = Object.freeze([
  'NOT_STARTED',
  'EXPIRED',
  'STALE_FEATURE',
  'FUTURE_FEATURE',
  'MISSING_FEATURE',
  'COOLDOWN',
  'DUPLICATE_TRIGGER',
  'MAX_TRIGGERS',
  'RESEARCH_BUDGET_EXHAUSTED',
  'IGNORED_STALE_POLICY',
  'INVALID_DEFINITION',
] as const);
export type ResearchMonitorBlockReason = (typeof RESEARCH_MONITOR_BLOCK_REASONS)[number];

export const RESEARCH_MONITOR_BINARY_OPS = Object.freeze([
  'and',
  'or',
  'gt',
  'gte',
  'lt',
  'lte',
  'eq',
  'neq',
  'add',
  'sub',
  'mul',
  'div',
] as const);
export type ResearchMonitorBinaryOp = (typeof RESEARCH_MONITOR_BINARY_OPS)[number];

export const HELIOS_OS07_RESEARCH_MONITOR_DSL = 'HELIOS_OS07_RESEARCH_MONITOR_DSL' as const;

export const HELIOS_OS07_RESEARCH_MONITOR_DSL_QUALIFIED =
  'HELIOS_OS07_RESEARCH_MONITOR_DSL_QUALIFIED' as const;
export const HELIOS_OS07_RESEARCH_MONITOR_DSL_BLOCKED =
  'HELIOS_OS07_RESEARCH_MONITOR_DSL_BLOCKED' as const;

/** Maximum expression tree depth — deterministic compile-time bound. */
export const RESEARCH_MONITOR_MAX_EXPRESSION_DEPTH = 32 as const;
export const RESEARCH_MONITOR_MAX_EXPRESSION_NODES = 128 as const;
