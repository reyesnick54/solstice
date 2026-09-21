/**
 * HELIOS Multi-Asset M13 — deterministic cross-asset regime engine.
 *
 * Consumes canonical MarketState only. No LLM or provider adapter access.
 */

import type { RegimeAssessment, RegimeCompatibilityResult, RegimeEngineInput } from './types.ts';
import {
  HELIOS_M13_REGIME_ENGINE_VERSION,
  REGIME_COMPATIBILITY,
  type MarketRegime,
  type RegimeConfidenceBand,
  type StrategyFamilyId,
} from './taxonomy.ts';

function confidenceFromMarketState(input: RegimeEngineInput): RegimeConfidenceBand {
  const { marketState } = input;
  if (marketState.confidence === 'HIGH' && marketState.dataQuality.state === 'HEALTHY') {
    return 'HIGH';
  }
  if (marketState.confidence === 'MEDIUM' || marketState.dataQuality.state === 'DEGRADED') {
    return 'MEDIUM';
  }
  if (marketState.dataQuality.state === 'UNUSABLE') {
    return 'UNKNOWN';
  }
  return 'LOW';
}

function inferRegime(input: RegimeEngineInput): MarketRegime {
  const { marketState } = input;
  if (marketState.dataQuality.state === 'UNUSABLE' || marketState.freshness === 'STALE') {
    return 'UNKNOWN';
  }
  if (marketState.volatilityState === 'EXTREME' || marketState.volatilityState === 'ELEVATED') {
    return 'HIGH_VOL';
  }
  if (marketState.volatilityState === 'LOW') {
    return 'LOW_VOL';
  }
  if (marketState.liquidityState === 'THIN' && marketState.volatilityState === 'NORMAL') {
    return 'RANGE_BOUND';
  }
  if (marketState.volatilityState === 'NORMAL' && marketState.liquidityState === 'ILLIQUID') {
    return 'MEAN_REVERTING';
  }
  if (marketState.volatilityState === 'NORMAL' && marketState.liquidityState === 'ADEQUATE') {
    return 'TRENDING_UP';
  }
  return 'UNKNOWN';
}

export function evaluateRegime(input: RegimeEngineInput): RegimeAssessment {
  const regime = inferRegime(input);
  const confidence = confidenceFromMarketState(input);
  const evidenceRefs = input.marketState.evidenceRefs.map((ref) =>
    Object.freeze({
      refType: ref.refType === 'bar' ? ('volatility' as const) : ('market_state' as const),
      refId: ref.refId,
    }),
  );
  return Object.freeze({
    instrumentId: input.marketState.instrumentId,
    assetClass: input.marketState.assetClass,
    regime,
    confidence,
    volatilityState: input.marketState.volatilityState,
    liquidityState: input.marketState.liquidityState,
    sessionState: input.marketState.sessionState,
    evidenceRefs: Object.freeze(evidenceRefs),
    evaluatedAt: input.now,
    engineVersion: HELIOS_M13_REGIME_ENGINE_VERSION,
  });
}

export function assessRegimeCompatibility(
  strategyFamily: StrategyFamilyId,
  regime: MarketRegime,
): RegimeCompatibilityResult {
  const allowed = REGIME_COMPATIBILITY[strategyFamily];
  const compatible = (allowed as readonly MarketRegime[]).includes(regime);
  const score = compatible ? 100 : regime === 'UNKNOWN' ? 40 : 15;
  const reason = compatible
    ? `regime ${regime} compatible with ${strategyFamily}`
    : `regime ${regime} not in allowed set for ${strategyFamily}`;
  return Object.freeze({
    strategyFamily,
    regime,
    compatible,
    score,
    reason,
  });
}
