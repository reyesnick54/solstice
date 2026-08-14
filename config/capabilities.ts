/**
 * Deployment posture flags. These values are scanned by CI.
 * Real money and live markets stay off. Simulation stays on.
 * Do not flip these without human review of config/ (see CODEOWNERS).
 */
export const ENVIRONMENT = "simulation" as const;
export const SIMULATION_MODE = true as const;
export const REAL_MONEY_ENABLED = false as const;
export const LIVE_TRADING_ENABLED = false as const;
export const LIVE_CRYPTO_ENABLED = false as const;
export const LIVE_EXCHANGE_ENABLED = false as const;
export const LIVE_DATA_MARKET_ENABLED = false as const;
