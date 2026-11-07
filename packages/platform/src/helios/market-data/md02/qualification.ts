/**
 * MD02 qualification gate.
 */

import {
  HELIOS_MD02_PRECISION_TIME_BLOCKED,
  HELIOS_MD02_PRECISION_TIME_QUALIFIED,
} from './taxonomy.ts';

export type Md02PrecisionTimeQualificationResult = {
  readonly marker:
    | typeof HELIOS_MD02_PRECISION_TIME_QUALIFIED
    | typeof HELIOS_MD02_PRECISION_TIME_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMd02PrecisionTimeQualification(input: {
  readonly distinctPipelineStages: boolean;
  readonly knowableAtNotEventTimeAlone: boolean;
  readonly negativeLatencySurfaced: boolean;
  readonly clockInconsistencySurfaced: boolean;
  readonly aafJoinUsesKnowableAt: boolean;
  readonly ciDoesNotClaimHardwarePrecision: boolean;
  readonly monotonicInternalLatency: boolean;
}): Md02PrecisionTimeQualificationResult {
  const blockers: string[] = [];
  if (!input.distinctPipelineStages) blockers.push('distinct_pipeline_stages');
  if (!input.knowableAtNotEventTimeAlone) blockers.push('knowable_at_semantics');
  if (!input.negativeLatencySurfaced) blockers.push('negative_latency');
  if (!input.clockInconsistencySurfaced) blockers.push('clock_inconsistency');
  if (!input.aafJoinUsesKnowableAt) blockers.push('aaf_join_knowable');
  if (!input.ciDoesNotClaimHardwarePrecision) blockers.push('ci_clock_honesty');
  if (!input.monotonicInternalLatency) blockers.push('monotonic_latency');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_MD02_PRECISION_TIME_QUALIFIED : HELIOS_MD02_PRECISION_TIME_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
