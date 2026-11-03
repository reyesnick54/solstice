export const HELIOS_NATIVE13_PROBABILITY_EDGE_RULE_ID = 'helios.native13.probability_edge.v1' as const;
export const HELIOS_NATIVE13_LIQUIDITY_RULE_ID = 'helios.native13.liquidity.v1' as const;
export const HELIOS_NATIVE13_CROSS_MARKET_RULE_ID = 'helios.native13.cross_market_consistency.v1' as const;

export const DEFAULT_MIN_PROBABILITY_EDGE_MINOR = 150n;
export const DEFAULT_MAX_SPREAD_BPS = 400;
export const DEFAULT_MIN_BID_DEPTH = 10_000n;
export const DEFAULT_MAX_COMPLEMENT_GAP_MINOR = 300n;

/** Matches HELIOS PREDICTION_PROBABILITY_SCALE (10_000 = 100%). */
export const PREDICTION_PROBABILITY_SCALE_MINOR = 10_000n;
