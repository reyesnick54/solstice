/**
 * Serializable research DTOs for Strategy Lab (platform side — Strategy Lab must not import platform).
 */

import type { UtcInstant } from '@solstice/domain';
import type { PredictionMarketFeatureSnapshot } from './types.ts';

export const HELIOS_OS14_STRATEGY_LAB_BRIDGE_SCHEMA = 'sunrey.helios.os14.strategy-lab-bridge.v1' as const;

export type StrategyLabOs14MicrostructureInput = {
  readonly schema: typeof HELIOS_OS14_STRATEGY_LAB_BRIDGE_SCHEMA;
  readonly instrumentId: string;
  readonly knowableAt: UtcInstant;
  readonly impliedMarketMidPpm: string;
  readonly yesSpreadPpm: string;
  readonly bookImbalancePpm: string;
  readonly totalVisibleLiquidityUsdcMinor: string;
  readonly crossOutcomeConsistency: string;
  readonly feeAdjustedEdgePpm: string | null;
  readonly researchOnly: true;
};

export function toStrategyLabOs14MicrostructureInput(
  features: PredictionMarketFeatureSnapshot,
): StrategyLabOs14MicrostructureInput | null {
  if (
    features.impliedMarketMidPpm === null ||
    features.yesSpreadPpm === null ||
    features.bookImbalancePpm === null ||
    features.totalVisibleLiquidityUsdcMinor === null ||
    features.crossOutcomeConsistency === null
  ) {
    return null;
  }
  return Object.freeze({
    schema: HELIOS_OS14_STRATEGY_LAB_BRIDGE_SCHEMA,
    instrumentId: features.instrumentId,
    knowableAt: features.knowableAt,
    impliedMarketMidPpm: features.impliedMarketMidPpm.toString(),
    yesSpreadPpm: features.yesSpreadPpm.toString(),
    bookImbalancePpm: features.bookImbalancePpm.toString(),
    totalVisibleLiquidityUsdcMinor: features.totalVisibleLiquidityUsdcMinor.toString(),
    crossOutcomeConsistency: features.crossOutcomeConsistency,
    feeAdjustedEdgePpm: features.feeAdjustedEdgePpm?.toString() ?? null,
    researchOnly: true,
  });
}
