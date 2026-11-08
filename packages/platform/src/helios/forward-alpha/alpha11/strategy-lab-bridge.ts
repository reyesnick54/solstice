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
    'CHAMPION_CAPACITY_DETERIORATION',
    'DATA_QUALITY_PROBLEM',
    'PERFORMANCE_LIMIT_BREACHED',
  ]);
  return allowed.has(trigger) && (state.health === 'DEGRADED' || state.health === 'BROKEN');
}

/** When true, ALPHA23 should run fail-safe demotion instead of champion-only EVOL11 degradation. */
export function alpha11PreferAlpha23FailSafeKill(state: AlphaDecayState): boolean {
  return (
    state.health === 'BROKEN' ||
    state.attribution === 'DATA_PROVIDER_DEGRADATION' ||
    state.demotion.action === 'PAUSE' ||
    state.demotion.action === 'RETURN_TO_SHADOW'
  );
}
