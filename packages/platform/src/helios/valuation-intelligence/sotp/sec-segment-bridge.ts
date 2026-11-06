/**
 * Extend SEC segment observations for VAL09 consumption.
 */

import type { SegmentObservation } from '@solstice/external-data';
import type { UtcInstant } from '@solstice/domain';
import { filterKnowableSegmentObservations } from './segment-identity.ts';
import type { SecSegmentObservationSource } from './types.ts';

export const VAL09_SEC_SEGMENT_BRIDGE_VERSION = 'helios-val09-sec-segment-bridge-v1' as const;

export function bindSecSegmentObservationSource(input: {
  readonly evaluationTimeUtc: UtcInstant;
  readonly observations: readonly SegmentObservation[];
}): SecSegmentObservationSource {
  const knowable = filterKnowableSegmentObservations(input.observations, input.evaluationTimeUtc);
  return Object.freeze({
    evaluationTimeUtc: input.evaluationTimeUtc,
    observations: knowable,
  });
}

export function countDistinctReportingSegmentsAtEvaluation(
  observations: readonly SegmentObservation[],
  evaluationTimeUtc: UtcInstant,
): number {
  const knowable = filterKnowableSegmentObservations(observations, evaluationTimeUtc);
  const keys = new Set<string>();
  for (const obs of knowable) {
    keys.add(`${obs.segmentId}|${obs.segmentLabel}`);
  }
  return keys.size;
}
