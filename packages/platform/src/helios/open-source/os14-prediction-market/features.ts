/**
 * Feature Fabric — microstructure feature snapshots for Strategy Lab / research mesh.
 */

import type { UtcInstant } from '@solstice/domain';
import type { PredictionMarketFeatureSnapshot, PredictionMicrostructureMetrics } from './types.ts';
import {
  HELIOS_OS14_FEATURE_FABRIC_SCHEMA,
  HELIOS_OS14_PREDICTION_MARKET_AUTHORITY,
} from './taxonomy.ts';

export function buildPredictionMarketFeatureSnapshot(input: {
  readonly instrumentId: string;
  readonly knowableAt: UtcInstant;
  readonly micro: PredictionMicrostructureMetrics | null;
  readonly feeAdjustedEdgePpm?: bigint | null;
}): PredictionMarketFeatureSnapshot {
  return Object.freeze({
    schema: HELIOS_OS14_FEATURE_FABRIC_SCHEMA,
    authority: HELIOS_OS14_PREDICTION_MARKET_AUTHORITY,
    instrumentId: input.instrumentId,
    knowableAt: input.knowableAt,
    impliedMarketMidPpm: input.micro?.impliedMarketMidPpm ?? null,
    yesSpreadPpm: input.micro?.yesSpreadPpm ?? null,
    bookImbalancePpm: input.micro?.bookImbalancePpm ?? null,
    totalVisibleLiquidityUsdcMinor: input.micro?.totalVisibleLiquidityUsdcMinor ?? null,
    crossOutcomeConsistency: input.micro?.crossOutcomeConsistency ?? null,
    feeAdjustedEdgePpm: input.feeAdjustedEdgePpm ?? null,
  });
}
