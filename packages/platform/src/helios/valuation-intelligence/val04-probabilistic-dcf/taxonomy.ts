/** VAL04 — probabilistic FCFF / FCFE DCF engine taxonomy. */

export const VAL04_PROBABILISTIC_DCF_SCHEMA = 'sunrey.helios.valuation-intelligence.val04-probabilistic-dcf.v1' as const;

export const VAL04_PROBABILISTIC_DCF_MODULE =
  'packages/platform/src/helios/valuation-intelligence/val04-probabilistic-dcf/index.ts' as const;

export const HELIOS_VAL04_PROBABILISTIC_DCF_QUALIFIED =
  'HELIOS_VAL04_PROBABILISTIC_DCF_QUALIFIED' as const;

export const HELIOS_VAL04_PROBABILISTIC_DCF_BLOCKED = 'HELIOS_VAL04_PROBABILISTIC_DCF_BLOCKED' as const;

export const TERMINAL_VALUE_METHODS = Object.freeze([
  'TERMINAL_GROWTH',
  'EXIT_MULTIPLE',
  'FADE_TO_MATURITY',
] as const);

export type TerminalValueMethod = (typeof TERMINAL_VALUE_METHODS)[number];

export const DEFAULT_VAL04_MONTE_CARLO_PATHS = 512 as const;

export const DEFAULT_VAL04_SEED = 0x56414c04 as const;

/** Plausible long-run nominal GDP-style cap unless explicitly overridden. */
export const DEFAULT_NOMINAL_ECONOMIC_GROWTH_CAP = 0.06 as const;

export const DCF_ASSUMPTION_KEYS = Object.freeze([
  'revenueGrowth',
  'margin',
  'reinvestmentRate',
  'wacc',
  'terminalGrowth',
  'terminalMultiple',
] as const);

export type DcfAssumptionKey = (typeof DCF_ASSUMPTION_KEYS)[number];
