/**
 * Strategy Lab application facade. Canonical strategy, dataset, backtest,
 * shadow, and paper-gate state lives in packages/strategy-lab. This service
 * is not a second backtester, broker, or live trading engine.
 */
export {
  StrategyLab,
  StrategyLabStore,
  LIVE_STRATEGY_EXECUTION,
  FORBIDDEN_STRATEGY_STATES,
  STRATEGY_LIFECYCLE_STATES,
} from '../../../packages/strategy-lab/src/index.ts';
