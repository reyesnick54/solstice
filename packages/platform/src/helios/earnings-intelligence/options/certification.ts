/**
 * Point-in-time guards and AAF certification requirements for option chains.
 */

import type { UtcInstant } from '@solstice/domain';
import type { OptionChainSnapshot } from './types.ts';

export type PitValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export function assertAafCertifiedChain(snapshot: OptionChainSnapshot): PitValidationResult {
  if (!snapshot.aafCertification?.certified) {
    return { ok: false, reason: 'chain_not_aaf_certified' };
  }
  if (!snapshot.chainTimestamp || !snapshot.knowableAt) {
    return { ok: false, reason: 'chain_missing_timestamps' };
  }
  if (snapshot.knowableAt < snapshot.chainTimestamp) {
    return { ok: false, reason: 'knowable_before_chain_time' };
  }
  return { ok: true };
}

/** Pre-event signals must not use snapshots observed after the scheduled event. */
export function assertPreEventEvaluation(
  snapshot: OptionChainSnapshot,
  evaluationTime: UtcInstant,
): PitValidationResult {
  const cert = assertAafCertifiedChain(snapshot);
  if (!cert.ok) {
    return cert;
  }
  if (evaluationTime > snapshot.eventScheduledAt) {
    return { ok: false, reason: 'evaluation_after_scheduled_event' };
  }
  if (snapshot.knowableAt > snapshot.eventScheduledAt) {
    return { ok: false, reason: 'chain_knowable_after_scheduled_event' };
  }
  if (snapshot.chainTimestamp > snapshot.eventScheduledAt) {
    return { ok: false, reason: 'chain_timestamp_after_scheduled_event' };
  }
  return { ok: true };
}

export function assertRealizedComparisonTiming(input: {
  readonly preEventEvaluationTime: UtcInstant;
  readonly eventScheduledAt: UtcInstant;
  readonly realizedAt: UtcInstant;
}): PitValidationResult {
  if (input.preEventEvaluationTime > input.eventScheduledAt) {
    return { ok: false, reason: 'pre_event_evaluation_not_before_event' };
  }
  if (input.realizedAt <= input.eventScheduledAt) {
    return { ok: false, reason: 'realized_before_event_end' };
  }
  return { ok: true };
}
