/**
 * HELIOS Forward Alpha — ALPHA21 continuous shadow portfolio and paper execution runtime.
 */

export const ALPHA21_CONTINUOUS_SHADOW_RUNTIME_SCHEMA =
  'sunrey.helios.forward-alpha.alpha21.continuous-shadow-runtime.v1' as const;

export const HELIOS_ALPHA21_CONTINUOUS_SHADOW_RUNTIME_QUALIFIED =
  'HELIOS_ALPHA21_CONTINUOUS_SHADOW_RUNTIME_QUALIFIED' as const;

export const HELIOS_ALPHA21_CONTINUOUS_SHADOW_RUNTIME_BLOCKED =
  'HELIOS_ALPHA21_CONTINUOUS_SHADOW_RUNTIME_BLOCKED' as const;

export const PORTFOLIO_RUNTIME_MODES = Object.freeze(['SHADOW', 'PAPER'] as const);

export type PortfolioRuntimeMode = (typeof PORTFOLIO_RUNTIME_MODES)[number];

export const STRATEGY_TICK_STAGES = Object.freeze([
  'CERTIFIED_MARKET_STATE',
  'STRATEGY_DECISION',
  'RISK',
  'CAPITAL_ALLOCATION',
  'EXECUTION_PLAN',
  'PAPER_ROUTE',
  'FILL_RECORD',
  'POSITION_UPDATE',
  'OUTCOME_SCHEDULE',
] as const);

export type StrategyTickStage = (typeof STRATEGY_TICK_STAGES)[number];

export const DAILY_SNAPSHOT_SCHEMA = 'sunrey.helios.forward-alpha.alpha21.daily-snapshot.v1' as const;
