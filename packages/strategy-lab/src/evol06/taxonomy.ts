/**
 * HELIOS EVOL06 — Population-based research scheduler (PBT-style evolution for research genomes only).
 * Allocates research compute, not customer capital.
 */

export const STRATEGY_ISLAND_IDS = [
  'TREND',
  'MEAN_REVERSION',
  'FUNDAMENTAL',
  'VALUATION',
  'EARNINGS',
  'MACRO',
  'CROSS_ASSET',
  'RELATIVE_VALUE',
  'PREDICTION_MARKET',
  'HYBRID',
] as const;

export type StrategyIslandId = (typeof STRATEGY_ISLAND_IDS)[number];
