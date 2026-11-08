import type { StrategyPromotionState } from '@solstice/strategy-lab';

import type { AlphaDecayState } from '../alpha11/types.ts';

import { forwardResearchPostureFromPromotion } from './strategy-lab-bridge.ts';
import type { ForwardStrategyHealthInput } from './types.ts';
import type { UtcInstant } from '@solstice/domain';

/**
 * EXTEND ALPHA11 — fold decay monitor output into ALPHA23 health evaluation.
 */
export function buildAlpha23HealthInputFromAlpha11(input: {
  readonly strategyId: string;
  readonly evaluatedAt: UtcInstant;
  readonly promotionState: StrategyPromotionState;
  readonly alpha11State: AlphaDecayState;
  readonly drawdownBps?: number | null;
}): ForwardStrategyHealthInput {
  return Object.freeze({
    strategyId: input.strategyId,
    evaluatedAt: input.evaluatedAt,
    posture: forwardResearchPostureFromPromotion(input.promotionState),
    drawdownBps: input.drawdownBps ?? null,
    alpha11State: input.alpha11State,
    operationalAnomaly:
      input.alpha11State.health === 'BROKEN' &&
      input.alpha11State.attribution === 'DATA_PROVIDER_DEGRADATION',
    featureHealthBps:
      input.alpha11State.attribution === 'SIGNAL_DECAY' ? 2_000 : null,
    executionCostBps:
      input.alpha11State.attribution === 'EXECUTION_DETERIORATION' ? 120 : null,
    regimeCompatibilityBps:
      input.alpha11State.attribution === 'MARKET_REGIME_SHIFT' ? 2_500 : null,
    marketDataQualityBps:
      input.alpha11State.attribution === 'DATA_PROVIDER_DEGRADATION' ? 4_000 : null,
  });
}
