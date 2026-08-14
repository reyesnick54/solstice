import type { WeightRecommendation, LifecycleApproval, StrategyLifecycleStage } from '../../contracts/src/strategy-types.ts';
import type { UtcInstant } from '../../contracts/src/time.ts';
import type { RiskEngine } from '../../risk-engine/src/engine.ts';
import type { RiskRequest } from '../../contracts/src/risk-types.ts';

/**
 * Meta-allocator may RECOMMEND weights. Recommendations are not binding.
 * Risk limits remain authoritative. The allocator cannot exceed them.
 */
export function recommendWeights(
  strategyIds: readonly string[],
): readonly WeightRecommendation[] {
  const n = BigInt(strategyIds.length === 0 ? 1 : strategyIds.length);
  return strategyIds.map((strategyId) =>
    Object.freeze({
      strategyId,
      weightNumerator: 1n,
      weightDenominator: n,
      binding: false as const,
      note: 'RECOMMENDATION_ONLY_RISK_LIMITS_REMAIN_AUTHORITATIVE' as const,
    }),
  );
}

export function applyRecommendationUnderRisk(
  recommendation: WeightRecommendation,
  request: RiskRequest,
  risk: RiskEngine,
): { readonly accepted: boolean; readonly reason: string } {
  const verdict = risk.evaluate(request);
  if (verdict.kind === 'REFUSE') {
    return {
      accepted: false,
      reason: `allocator cannot exceed Risk Engine: ${verdict.reason}`,
    };
  }
  void recommendation;
  return { accepted: true, reason: 'recommendation within risk limits' };
}

const ORDER: readonly StrategyLifecycleStage[] = [
  'RESEARCH',
  'BACKTEST',
  'OUT_OF_SAMPLE',
  'ADVERSARIAL',
  'SHADOW',
  'PAPER',
];

/**
 * Promotion requires an explicit recorded approval. Never an automatic
 * metric threshold.
 */
export function promoteWithApproval(input: {
  readonly strategyId: string;
  readonly from: StrategyLifecycleStage;
  readonly to: StrategyLifecycleStage;
  readonly approvedBy: string;
  readonly approvedAt: UtcInstant;
  readonly reason: string;
}): LifecycleApproval | { readonly ok: false; readonly code: 'APPROVAL_REQUIRED' | 'INVALID_STAGE' } {
  if (!input.approvedBy || input.approvedBy.length === 0) {
    return { ok: false, code: 'APPROVAL_REQUIRED' };
  }
  const fromIdx = ORDER.indexOf(input.from);
  const toIdx = ORDER.indexOf(input.to);
  if (fromIdx < 0 || toIdx !== fromIdx + 1) {
    return { ok: false, code: 'INVALID_STAGE' };
  }
  return Object.freeze({
    strategyId: input.strategyId,
    from: input.from,
    to: input.to,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    reason: input.reason,
  });
}

export function autoPromoteOnMetric(_metric: bigint): never {
  throw new Error('strategy promotion is never automatic on a metric threshold');
}
