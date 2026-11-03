export const HELIOS_OS14_PREDICTION_MARKET_RESEARCH_SCHEMA =
  'sunrey.helios.os14.prediction-market.v1' as const;

export const HELIOS_OS14_STRATEGY_LAB_BRIDGE_SCHEMA =
  'sunrey.helios.os14.strategy-lab-bridge.v1' as const;

/** Strategy Lab consumes research features only — no live prediction-market execution. */
export const OS14_STRATEGY_LAB_RESEARCH_ONLY = true as const;
