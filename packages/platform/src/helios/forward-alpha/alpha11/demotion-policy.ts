import type { AlphaDecayAttributionClass, AlphaDemotionAction, AlphaHealthState } from './taxonomy.ts';
import type { AlphaDecayDemotionRecommendation, PerformanceDrift } from './types.ts';


/**
 * Demotion / pause / shadow return — never increases risk to recover losses.
 */
export function recommendAlphaDemotion(input: {
  readonly health: AlphaHealthState;
  readonly attribution: AlphaDecayAttributionClass;
  readonly drifts: readonly PerformanceDrift[];
}): AlphaDecayDemotionRecommendation {
  const none: AlphaDecayDemotionRecommendation = Object.freeze({
    action: 'NONE',
    reason: 'health within policy',
    permitsRiskIncrease: false,
    demotionTriggerHint: null,
  });
  if (input.health === 'HEALTHY' || input.health === 'INSUFFICIENT_DATA') {
    return none;
  }
  if (input.health === 'WATCH') {
    return Object.freeze({
      action: 'WATCH_ONLY',
      reason: 'detectors raised watch — no automatic exposure change',
      permitsRiskIncrease: false,
      demotionTriggerHint: null,
    });
  }

  const signalBroken = input.drifts.some(
    (d) =>
      (d.metric === 'ACTIVE_RETURN_BPS' || d.metric === 'HIT_RATE_BPS') && d.materiallyWorse,
  );

  if (input.health === 'BROKEN') {
    return Object.freeze({
      action: input.attribution === 'EXECUTION_DETERIORATION' ? 'PAUSE' : 'RETURN_TO_SHADOW',
      reason: 'break detected — halt promotion track and preserve prior evidence',
      permitsRiskIncrease: false,
      demotionTriggerHint:
        input.attribution === 'EXECUTION_DETERIORATION'
          ? 'CHAMPION_COST_DETERIORATION'
          : signalBroken
            ? 'CHAMPION_PERFORMANCE_DECAY'
            : 'DATA_QUALITY_PROBLEM',
    });
  }

  const action: AlphaDemotionAction =
    input.attribution === 'MARKET_REGIME_SHIFT'
      ? 'RETURN_TO_SHADOW'
      : input.attribution === 'DATA_PROVIDER_DEGRADATION'
        ? 'PAUSE'
        : 'DEMOTE';

  const hint =
    input.attribution === 'EXECUTION_DETERIORATION'
      ? ('CHAMPION_COST_DETERIORATION' as const)
      : input.attribution === 'MARKET_REGIME_SHIFT'
        ? ('REGIME_DRIFT_DETECTED' as const)
        : input.attribution === 'DATA_PROVIDER_DEGRADATION'
          ? ('DATA_QUALITY_PROBLEM' as const)
          : input.attribution === 'SIGNAL_DECAY'
            ? signalBroken
              ? ('CHAMPION_PERFORMANCE_DECAY' as const)
              : ('CHAMPION_FEATURE_DECAY' as const)
            : null;

  return Object.freeze({
    action,
    reason: `degraded (${input.attribution}) — automatic demotion path without risk increase`,
    permitsRiskIncrease: false,
    demotionTriggerHint: hint,
  });
}
