import type { StressChallengerKind } from './taxonomy.ts';

/** Default marginal edge loss per severity point (1–10) for each challenger, in integer bps. */
export const DEFAULT_STRESS_SENSITIVITY_BPS: Readonly<Record<StressChallengerKind, number>> =
  Object.freeze({
    TRANSACTION_COST_INCREASE: 45,
    SPREAD_WIDENING: 50,
    LATENCY: 40,
    PARTIAL_FILLS: 55,
    MISSING_DATA: 70,
    PROVIDER_OUTAGE: 80,
    MARKET_GAPS: 65,
    REGIME_CHANGE: 60,
    VOLATILITY_SHOCK: 58,
    LIQUIDITY_SHOCK: 62,
    CORRELATION_BREAK: 52,
    CROWDING_PROXY: 48,
    HIGHER_FUNDING_COSTS: 44,
    SLIPPAGE: 56,
    DELAYED_SIGNAL: 68,
    FEATURE_REVISION: 72,
    PARAMETER_PERTURBATION: 75,
  });
