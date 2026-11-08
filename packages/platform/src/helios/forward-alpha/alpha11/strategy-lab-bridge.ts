import type { DemotionTrigger } from '@solstice/strategy-lab';
import type { AlphaDecayState } from './types.ts';

/**
 * Maps ALPHA11 demotion hints to Strategy Lab automatic degradation triggers (research track).
 */
export function alpha11ToStrategyLabDemotionTrigger(
  state: AlphaDecayState,
): DemotionTrigger | null {
  const hint = state.demotion.demotionTriggerHint;
  if (!hint) {
    return null;
  }
  if (hint === 'DATA_QUALITY_PROBLEM') {
    return hint;
  }
  return hint;
}

export function alpha11AutomaticDegradationEligible(state: AlphaDecayState): boolean {
  const trigger = alpha11ToStrategyLabDemotionTrigger(state);
  if (!trigger) return false;
  const allowed = new Set<DemotionTrigger>([
    'CHAMPION_PERFORMANCE_DECAY',
    'CHAMPION_FEATURE_DECAY',
    'REGIME_DRIFT_DETECTED',
    'CHAMPION_COST_DETERIORATION',
  ]);
  return allowed.has(trigger) && (state.health === 'DEGRADED' || state.health === 'BROKEN');
}
