import type { DemotionTrigger, StrategyPromotionState } from '@solstice/strategy-lab';

import type { AlphaDecayState } from '../alpha11/types.ts';
import { alpha11ToStrategyLabDemotionTrigger } from '../alpha11/strategy-lab-bridge.ts';

import type { ForwardResearchPosture } from './taxonomy.ts';
import type { ResearchKillDecision } from './types.ts';

const PAPER_STATES: ReadonlySet<StrategyPromotionState> = new Set([
  'PAPER_ELIGIBLE',
  'PAPER_ACTIVE',
  'PAPER_CHALLENGER',
]);

const SHADOW_STATES: ReadonlySet<StrategyPromotionState> = new Set([
  'SHADOW_ELIGIBLE',
  'SHADOW_ACTIVE',
  'SHADOW_CHALLENGER',
]);

const CHAMPION_STATES: ReadonlySet<StrategyPromotionState> = new Set([
  'NICHE_CHAMPION',
  'GLOBAL_RESEARCH_CHAMPION',
]);

export function forwardResearchPostureFromPromotion(state: StrategyPromotionState): ForwardResearchPosture {
  if (PAPER_STATES.has(state)) return 'PAPER';
  if (SHADOW_STATES.has(state)) return 'SHADOW';
  if (CHAMPION_STATES.has(state)) return 'CHAMPION';
  if (state === 'PAUSED') return 'PAUSED';
  if (state === 'DEGRADED' || state === 'DEMOTED' || state === 'REVIEW_REQUIRED') return 'FAILED_SAFE';
  return 'RESEARCH';
}

export function promotionTargetForResearchKill(
  current: StrategyPromotionState,
  decision: ResearchKillDecision,
): StrategyPromotionState | null {
  if (!decision.killRequired) return null;

  if (decision.transition === 'PAPER_TO_SHADOW') {
    if (current === 'PAPER_CHALLENGER') return 'SHADOW_CHALLENGER';
    if (current === 'PAPER_ACTIVE') return 'SHADOW_ACTIVE';
    if (current === 'PAPER_ELIGIBLE') return 'SHADOW_ELIGIBLE';
    return 'SHADOW_ELIGIBLE';
  }

  if (decision.transition === 'SHADOW_TO_PAUSED') {
    return 'PAUSED';
  }

  if (decision.transition === 'ANY_TO_FAILED_SAFE') {
    if (CHAMPION_STATES.has(current)) return 'DEGRADED';
    if (PAPER_STATES.has(current) || SHADOW_STATES.has(current)) return 'PAUSED';
    return 'REVIEW_REQUIRED';
  }

  return null;
}

const TRIGGER_MAP: Partial<Record<ResearchKillDecision['triggers'][number], DemotionTrigger>> = {
  DRAWDOWN_LIMIT_BREACHED: 'PERFORMANCE_LIMIT_BREACHED',
  ALPHA_CONFIDENCE_DETERIORATION: 'CHAMPION_PERFORMANCE_DECAY',
  BENCHMARK_UNDERPERFORMANCE: 'CHAMPION_PERFORMANCE_DECAY',
  EXECUTION_COST_EXPLOSION: 'CHAMPION_COST_DETERIORATION',
  MARKET_DATA_DEGRADATION: 'DATA_QUALITY_PROBLEM',
  STRATEGY_FEATURE_FAILURE: 'CHAMPION_FEATURE_DECAY',
  DECISION_RATE_ANOMALY: 'EVALUATION_DEFECT_DISCOVERED',
  REGIME_INCOMPATIBILITY: 'REGIME_DRIFT_DETECTED',
  CAPACITY_DETERIORATION: 'CHAMPION_CAPACITY_DETERIORATION',
  STATISTICAL_EVIDENCE_COLLAPSE: 'EVALUATION_ASSUMPTIONS_INVALIDATED',
  OPERATIONAL_ANOMALY: 'EVALUATION_DEFECT_DISCOVERED',
  ALPHA11_DECAY_SIGNAL: 'CHAMPION_PERFORMANCE_DECAY',
};

export function alpha23PrimaryDemotionTrigger(decision: ResearchKillDecision): DemotionTrigger {
  for (const trigger of decision.triggers) {
    const mapped = TRIGGER_MAP[trigger];
    if (mapped) return mapped;
  }
  return 'PERFORMANCE_LIMIT_BREACHED';
}

export function alpha23DemotionTriggerFromAlpha11(state: AlphaDecayState): DemotionTrigger | null {
  return alpha11ToStrategyLabDemotionTrigger(state);
}

export function alpha23AutomaticKillEligible(decision: ResearchKillDecision): boolean {
  return decision.killRequired && !decision.permitsRiskIncrease;
}
