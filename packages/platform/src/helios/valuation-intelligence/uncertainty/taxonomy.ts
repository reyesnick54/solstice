/** VAL10 — valuation uncertainty, fragility, and model-risk engine taxonomy. */

export const VAL10_UNCERTAINTY_ENGINE_SCHEMA =
  'sunrey.helios.valuation-intelligence.val10-uncertainty-engine.v1' as const;

export const VAL10_UNCERTAINTY_ENGINE_MODULE =
  'packages/platform/src/helios/valuation-intelligence/uncertainty/index.ts' as const;

export const HELIOS_VAL10_UNCERTAINTY_ENGINE_QUALIFIED =
  'HELIOS_VAL10_UNCERTAINTY_ENGINE_QUALIFIED' as const;

export const HELIOS_VAL10_UNCERTAINTY_ENGINE_BLOCKED =
  'HELIOS_VAL10_UNCERTAINTY_ENGINE_BLOCKED' as const;

export const DEFAULT_VAL10_SEED = 0x5641_4c10 as const;

/** Minimum Monte Carlo paths before optional Sobol-style global sensitivity is attempted. */
export const VAL10_SOBOL_MIN_PATHS = 2048 as const;

export const VALUATION_UNCERTAINTY_SOURCES = Object.freeze([
  'OPERATING_FORECAST',
  'MARGIN',
  'REINVESTMENT',
  'COST_OF_CAPITAL',
  'TERMINAL_GROWTH',
  'TERMINAL_MULTIPLE',
  'ACCOUNTING',
  'PEER_SELECTION',
  'MODEL_SELECTION',
  'SEGMENT',
  'MACRO',
  'DATA_QUALITY',
  'ENTITY_RESOLUTION',
  'UNKNOWN',
] as const);

export type ValuationUncertaintySourceId = (typeof VALUATION_UNCERTAINTY_SOURCES)[number];

export const TERMINAL_VALUE_DEPENDENCE_SEVERITIES = Object.freeze([
  'LOW',
  'MODERATE',
  'HIGH',
  'EXTREME',
] as const);

export type TerminalValueDependenceSeverity = (typeof TERMINAL_VALUE_DEPENDENCE_SEVERITIES)[number];

export const VALUATION_CONFIDENCE_LEVELS = Object.freeze([
  'HIGH',
  'MEDIUM',
  'LOW',
  'VERY_LOW',
  'INSUFFICIENT_DATA',
] as const);

export type ValuationConfidenceLevel = (typeof VALUATION_CONFIDENCE_LEVELS)[number];

export const CROSS_MODEL_METHODS = Object.freeze([
  'DCF',
  'RIV',
  'ECONOMIC_PROFIT',
  'COMPARABLES',
  'SOTP',
  'REVERSE_DCF',
] as const);

export type CrossModelMethod = (typeof CROSS_MODEL_METHODS)[number];

/** Maps VAL04 Gaussian assumption keys to VAL10 uncertainty sources. */
export const DCF_ASSUMPTION_TO_UNCERTAINTY_SOURCE = Object.freeze({
  revenueGrowth: 'OPERATING_FORECAST',
  margin: 'MARGIN',
  reinvestmentRate: 'REINVESTMENT',
  wacc: 'COST_OF_CAPITAL',
  terminalGrowth: 'TERMINAL_GROWTH',
  terminalMultiple: 'TERMINAL_MULTIPLE',
} as const satisfies Record<string, ValuationUncertaintySourceId>);
