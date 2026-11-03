/**
 * AAF09 observation validation — stale feeds, sequence gaps, crossed markets.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { NormalizedCryptoMarketObservation, SourceHealthState } from './types.ts';

export type ValidationIssue = {
  readonly code: string;
  readonly message: string;
  readonly health: SourceHealthState;
};

export function detectCrossedMarket(observation: NormalizedCryptoMarketObservation): ValidationIssue | null {
  const bid = observation.bidMinorUnits;
  const ask = observation.askMinorUnits;
  if (bid === null || ask === null) return null;
  if (bid >= ask) {
    return Object.freeze({
      code: 'CROSSED_MARKET',
      message: 'bid is not strictly below ask',
      health: 'DEGRADED_CROSSED_MARKET',
    });
  }
  return null;
}

export function detectSequenceGap(
  sequenceId: string | null,
  priorSequenceId: string | null,
): ValidationIssue | null {
  if (!sequenceId || !priorSequenceId) return null;
  const current = Number(sequenceId);
  const prior = Number(priorSequenceId);
  if (!Number.isFinite(current) || !Number.isFinite(prior)) return null;
  if (current <= prior) {
    return Object.freeze({
      code: 'SEQUENCE_REGRESSION',
      message: 'sequence did not advance',
      health: 'DEGRADED_SEQUENCE_GAP',
    });
  }
  if (current - prior > 1) {
    return Object.freeze({
      code: 'SEQUENCE_GAP',
      message: `sequence gap between ${priorSequenceId} and ${sequenceId}`,
      health: 'DEGRADED_SEQUENCE_GAP',
    });
  }
  return null;
}

export function detectStaleFeed(input: {
  readonly providerEventTime: UtcInstant;
  readonly nowUtc: UtcInstant;
  readonly maxAgeMs: number;
}): ValidationIssue | null {
  const age = Date.parse(input.nowUtc) - Date.parse(input.providerEventTime);
  if (!Number.isFinite(age)) return null;
  if (age > input.maxAgeMs) {
    return Object.freeze({
      code: 'STALE_VENUE_FEED',
      message: `provider event older than ${input.maxAgeMs}ms`,
      health: 'DEGRADED_STALE',
    });
  }
  return null;
}

export function applyValidationHealth(
  observation: NormalizedCryptoMarketObservation,
  issues: readonly ValidationIssue[],
): NormalizedCryptoMarketObservation {
  if (issues.length === 0) return observation;
  const worst = issues[0]!.health;
  return Object.freeze({ ...observation, sourceHealth: worst });
}
