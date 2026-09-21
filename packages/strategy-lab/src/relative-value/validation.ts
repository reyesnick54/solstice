/**
 * HELIOS M12 — pair validation / strategy qualification gate.
 * Validates statistical relationship suitability. Does not allocate capital or execute.
 */

import type { UtcInstant } from '@solstice/domain';
import { resolveM12PairDefinition, type M12PairId } from './ids.ts';
import {
  discoverRelationship,
  barsForInstrument,
  indexAtOrBefore,
  timestampsSynchronized,
} from './relationship.ts';
import type { M12StrategyParameters } from './parameters.ts';
import type { M12BarObservation, M12PairValidationOutcome, M12PairValidationResult } from './types.ts';

function outcome(
  pairId: M12PairId,
  result: M12PairValidationOutcome,
  blockers: readonly string[],
  relationship: ReturnType<typeof discoverRelationship>,
  validatedAt: UtcInstant,
): M12PairValidationResult {
  return Object.freeze({
    pairId,
    outcome: result,
    qualified: result === 'QUALIFIED',
    blockers: Object.freeze(blockers),
    relationship,
    validatedAt,
  });
}

export function validatePair(input: {
  readonly pairId: M12PairId;
  readonly allBars: readonly M12BarObservation[];
  readonly now: UtcInstant;
  readonly params: M12StrategyParameters;
  readonly marketRegime?: 'MEAN_REVERTING' | 'TRENDING' | 'HIGH_VOL' | 'UNKNOWN';
}): M12PairValidationResult {
  const pair = resolveM12PairDefinition(input.pairId);
  const blockers: string[] = [];
  const legA = barsForInstrument(input.allBars, pair.legAInstrumentId);
  const legB = barsForInstrument(input.allBars, pair.legBInstrumentId);
  const endIndex = indexAtOrBefore(legA, input.now);
  const barA = endIndex >= 0 ? legA[endIndex] : null;
  const barB = endIndex >= 0 ? legB[endIndex] : null;

  if (endIndex < 0 || endIndex + 1 < input.params.minHistoryBars) {
    return outcome(input.pairId, 'INSUFFICIENT_HISTORY', ['insufficient_aligned_history'], null, input.now);
  }

  if (!barA || !barB || barB.sourceEventTime !== barA.sourceEventTime) {
    return outcome(input.pairId, 'TIMESTAMP_MISMATCH', ['leg_timestamp_unaligned'], null, input.now);
  }

  if (
    !timestampsSynchronized(barA, barB, input.params.maxTimestampSkewMs)
  ) {
    return outcome(input.pairId, 'TIMESTAMP_MISMATCH', ['timestamp_skew_exceeds_limit'], null, input.now);
  }

  if (barA.providerHealth === 'degraded' || barA.providerHealth === 'unavailable') {
    return outcome(input.pairId, 'PROVIDER_DEGRADED', ['leg_a_provider_degraded'], null, input.now);
  }
  if (barB.providerHealth === 'degraded' || barB.providerHealth === 'unavailable') {
    return outcome(input.pairId, 'PROVIDER_DEGRADED', ['leg_b_provider_degraded'], null, input.now);
  }

  const relationship = discoverRelationship({
    pairId: input.pairId,
    allBars: input.allBars,
    now: input.now,
    relationshipWindowBars: input.params.relationshipWindowBars,
    correlationWindowBars: input.params.correlationWindowBars,
    maxTimestampSkewMs: input.params.maxTimestampSkewMs,
  });

  if (!relationship) {
    return outcome(input.pairId, 'INSUFFICIENT_HISTORY', ['insufficient_aligned_history'], null, input.now);
  }

  if (relationship.historyBars < input.params.minHistoryBars) {
    blockers.push('insufficient_history');
  }

  if (pair.assetClassA !== pair.assetClassB && !pair.identityMismatchAcknowledged) {
    return outcome(input.pairId, 'ASSET_CLASS_MISMATCH', ['asset_class_mismatch_unacknowledged'], relationship, input.now);
  }

  const spreadA = barA?.spreadBps ?? 0n;
  const spreadB = barB?.spreadBps ?? 0n;
  if (spreadA > input.params.maxLegSpreadBps || spreadB > input.params.maxLegSpreadBps) {
    blockers.push('leg_spread_too_wide');
  }

  const combinedSpread = spreadA + spreadB;
  if (combinedSpread > input.params.maxSpreadBps) {
    return outcome(input.pairId, 'SPREAD_TOO_WIDE', ['combined_spread_too_wide'], relationship, input.now);
  }

  if (relationship.rollingCorrelationScaled < input.params.minRollingCorrelationScaled) {
    return outcome(input.pairId, 'CORRELATION_COLLAPSE', ['rolling_correlation_below_floor'], relationship, input.now);
  }

  if (relationship.rollingCorrelationScaled > 9_500n && input.marketRegime === 'TRENDING') {
    blockers.push('high_correlation_in_trending_regime_not_arbitrage');
  }

  if (input.params.requireCointegrationSupported && relationship.cointegrationOutcome === 'REJECTED') {
    return outcome(input.pairId, 'COINTEGRATION_REJECTED', ['cointegration_rejected'], relationship, input.now);
  }

  if (
    relationship.rollingCorrelationScaled < 0n &&
    input.marketRegime !== 'MEAN_REVERTING'
  ) {
    return outcome(input.pairId, 'STRUCTURAL_BREAK', ['correlation_shift_detected'], relationship, input.now);
  }

  if (input.marketRegime === 'HIGH_VOL') {
    blockers.push('high_vol_regime');
  }

  if (blockers.includes('high_correlation_in_trending_regime_not_arbitrage')) {
    return outcome(
      input.pairId,
      'CORRELATION_NOT_ARBITRAGE',
      blockers,
      relationship,
      input.now,
    );
  }

  if (blockers.length > 0) {
    const primary = blockers.includes('insufficient_history')
      ? 'INSUFFICIENT_HISTORY'
      : blockers.includes('leg_spread_too_wide')
        ? 'LIQUIDITY_INSUFFICIENT'
        : blockers.includes('high_vol_regime')
          ? 'REGIME_MISMATCH'
          : 'UNSTABLE_RELATIONSHIP';
    return outcome(input.pairId, primary, blockers, relationship, input.now);
  }

  return outcome(input.pairId, 'QUALIFIED', [], relationship, input.now);
}

function absBigint(value: bigint): bigint {
  return value < 0n ? -value : value;
}
