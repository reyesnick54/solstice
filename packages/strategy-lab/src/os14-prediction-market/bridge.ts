import type { UtcInstant } from '@solstice/domain';
import {
  HELIOS_OS14_PREDICTION_MARKET_RESEARCH_SCHEMA,
  HELIOS_OS14_STRATEGY_LAB_BRIDGE_SCHEMA,
  OS14_STRATEGY_LAB_RESEARCH_ONLY,
} from './constants.ts';

export type Os14StrategyLabFeatureRow = {
  readonly schema: typeof HELIOS_OS14_STRATEGY_LAB_BRIDGE_SCHEMA;
  readonly instrumentId: string;
  readonly knowableAt: UtcInstant;
  readonly impliedMarketMidPpm: bigint;
  readonly yesSpreadPpm: bigint;
  readonly bookImbalancePpm: bigint;
  readonly feeAdjustedEdgePpm: bigint | null;
  readonly researchOnly: typeof OS14_STRATEGY_LAB_RESEARCH_ONLY;
};

export type Os14StrategyLabResearchContext = {
  readonly marketSchema: typeof HELIOS_OS14_PREDICTION_MARKET_RESEARCH_SCHEMA;
  readonly features: Os14StrategyLabFeatureRow;
  readonly permitsExecution: false;
};

export function buildOs14StrategyLabResearchContext(input: Os14StrategyLabFeatureRow): Os14StrategyLabResearchContext {
  return Object.freeze({
    marketSchema: HELIOS_OS14_PREDICTION_MARKET_RESEARCH_SCHEMA,
    features: input,
    permitsExecution: false,
  });
}

/** Minimum spread (ppm) for research liquidity annotations in Strategy Lab scenarios. */
export function os14ResearchLiquidityStress(features: Os14StrategyLabFeatureRow): boolean {
  return features.yesSpreadPpm >= 40_000n;
}
