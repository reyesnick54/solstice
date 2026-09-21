/**
 * Strategy Lab M13 — market regime gating for Strategy Capsules.
 *
 * Consumes M13 regime artifacts; does not classify regimes.
 */

import type { MarketRegimePreferences } from './capsule/types.ts';

export const STRATEGY_REGIME_GATING_STRENGTH_BPS = 5000 as const;

export type StrategyRegimeSignal = {
  readonly dimension: string;
  readonly strengthBps: number;
};

export type StrategyRegimeGatingResult = {
  readonly permitted: boolean;
  readonly preferredMatch: boolean;
  readonly blockReason: string | null;
  readonly matchedPreferred: readonly string[];
  readonly triggeredProhibited: readonly string[];
};

export function evaluateStrategyRegimeGating(input: {
  readonly preferences: MarketRegimePreferences;
  readonly detectedRegimes: readonly StrategyRegimeSignal[];
  readonly strengthThresholdBps?: number;
}): StrategyRegimeGatingResult {
  const threshold = input.strengthThresholdBps ?? STRATEGY_REGIME_GATING_STRENGTH_BPS;
  const active = input.detectedRegimes.filter((row) => row.strengthBps >= threshold);
  const activeDimensions = new Set(active.map((row) => row.dimension));

  const triggeredProhibited = input.preferences.prohibitedRegimes.filter((dimension) =>
    activeDimensions.has(dimension),
  );
  if (triggeredProhibited.length > 0) {
    return freezeResult({
      permitted: false,
      preferredMatch: false,
      blockReason: `PROHIBITED_REGIME:${triggeredProhibited.join(',')}`,
      matchedPreferred: Object.freeze([]),
      triggeredProhibited: Object.freeze(triggeredProhibited),
    });
  }

  if (input.preferences.permittedRegimes.length > 0) {
    const hasPermitted = input.preferences.permittedRegimes.some((dimension) => activeDimensions.has(dimension));
    if (!hasPermitted) {
      return freezeResult({
        permitted: false,
        preferredMatch: false,
        blockReason: 'NO_PERMITTED_REGIME_MATCH',
        matchedPreferred: Object.freeze([]),
        triggeredProhibited: Object.freeze([]),
      });
    }
  }

  const matchedPreferred = input.preferences.preferredRegimes.filter((dimension) =>
    activeDimensions.has(dimension),
  );

  return freezeResult({
    permitted: true,
    preferredMatch: matchedPreferred.length > 0,
    blockReason: null,
    matchedPreferred: Object.freeze(matchedPreferred),
    triggeredProhibited: Object.freeze([]),
  });
}

function freezeResult(result: StrategyRegimeGatingResult): StrategyRegimeGatingResult {
  return Object.freeze(result);
}
