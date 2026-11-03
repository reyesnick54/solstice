/**
 * Upstream open-source attribution (research port only — no runtime dependency).
 *
 * @see docs/helios/OS14_PREDICTION_MARKET_UPSTREAM.md
 */

export const OS14_UPSTREAM_REPOSITORY = 'semrincaballero/Polymarket-Prediction-Bot' as const;
export const OS14_UPSTREAM_REFERENCE_SHA = '1f7c9761ddd26863242e3ed4f83c230ee38aebeb' as const;
export const OS14_UPSTREAM_LICENSE = 'MIT' as const;

/** Ported concepts (models.ClobBook imbalance, strategy prob-edge/imbalance/liquidity) — not a code fork. */
export const OS14_UPSTREAM_PORTED_MODULES = Object.freeze([
  'polymarket_bot.core.models (CLOB book sides, paired YES/NO structure, imbalance)',
  'polymarket_bot.core.strategy (research signal thresholds — simulation only)',
  'polymarket_bot.core.mock_data (deterministic fixture shapes)',
] as const);
