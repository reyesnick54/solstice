/**
 * Reusable data quality checks — explicit degraded states over silent drops.
 */

import type { ExternalObservation } from '../../../../provider-sdk/src/types.ts';
import { detectTimestampReversal } from './information-time.ts';
import type { InformationTime } from './types.ts';
import type {
  GapState,
  HeliosFreshnessAssessment,
  ObservationEntitlement,
  OutlierState,
  QualityFlag,
  QualityState,
  SourceIndependence,
} from './types.ts';
import { isEntitlementUnknown, isEntitlementUsable } from './entitlement.ts';
import { isFreshnessDegraded } from './freshness-policies.ts';
import { sharedUpstreamNotIndependent } from './lineage.ts';

export type QualityCheckContext = {
  readonly observation: ExternalObservation<unknown>;
  readonly informationTime: InformationTime;
  readonly entitlement: ObservationEntitlement;
  readonly freshness: HeliosFreshnessAssessment;
  readonly canonicalInstrumentId: string;
  readonly sequence: number | null;
  readonly priorSourceEventTime: string | null;
  readonly priorSequence: number | null;
  readonly isDuplicate: boolean;
  readonly gapDetected: boolean;
  readonly outlierState: OutlierState;
  readonly contradictory: boolean;
  readonly providerUnavailable: boolean;
  readonly sourceIndependence: SourceIndependence;
};

export function runQualityChecks(context: QualityCheckContext): {
  readonly qualityState: QualityState;
  readonly gapState: GapState;
  readonly qualityFlags: readonly QualityFlag[];
} {
  const flags: QualityFlag[] = [];

  if (context.providerUnavailable) {
    flags.push({ code: 'PROVIDER_UNAVAILABLE', message: 'Provider feed unavailable' });
    return finalize('UNAVAILABLE', 'UNKNOWN', flags);
  }

  if (context.observation.quality.validationStatus === 'timestamp_invalid') {
    flags.push({ code: 'MALFORMED_PAYLOAD', message: 'Malformed timestamp in provider payload' });
    return finalize('DEGRADED_MALFORMED', 'UNKNOWN', flags);
  }
  if (
    context.observation.quality.validationStatus === 'schema_invalid' ||
    context.observation.quality.validationStatus === 'bounds_invalid'
  ) {
    flags.push({ code: 'MALFORMED_PAYLOAD', message: 'Malformed provider payload' });
    return finalize('DEGRADED_MALFORMED', 'UNKNOWN', flags);
  }

  if (!context.canonicalInstrumentId || context.canonicalInstrumentId.trim().length === 0) {
    flags.push({ code: 'INVALID_INSTRUMENT', message: 'Invalid or missing canonical instrument identity' });
    return finalize('DEGRADED_MALFORMED', 'UNKNOWN', flags);
  }

  if (!isEntitlementUsable(context.entitlement)) {
    flags.push({ code: 'ENTITLEMENT_UNAVAILABLE', message: 'Observation entitlement unavailable' });
    return finalize('DEGRADED_ENTITLEMENT', 'UNKNOWN', flags);
  }

  if (isEntitlementUnknown(context.entitlement)) {
    flags.push({ code: 'ENTITLEMENT_UNKNOWN', message: 'Observation entitlement unknown — not unrestricted' });
  }

  if (context.isDuplicate) {
    flags.push({ code: 'DUPLICATE_OBSERVATION', message: 'Duplicate upstream event detected' });
    return finalize('DEGRADED_DUPLICATE', 'NONE', flags);
  }

  if (detectTimestampReversal(context.informationTime, context.priorSourceEventTime)) {
    flags.push({ code: 'TIMESTAMP_REVERSAL', message: 'Source event time reversed relative to prior observation' });
    return finalize('DEGRADED_SEQUENCE', 'UNKNOWN', flags);
  }

  if (context.sequence === null && context.priorSequence !== null) {
    flags.push({ code: 'MISSING_SEQUENCE', message: 'Expected sequence number missing' });
    return finalize('DEGRADED_SEQUENCE', 'UNKNOWN', flags);
  }

  if (isFreshnessDegraded(context.freshness.status)) {
    flags.push({ code: 'STALENESS', message: `Observation freshness is ${context.freshness.status}` });
    return finalize('DEGRADED_STALE', gapStateFrom(context.gapDetected), flags);
  }

  if (context.gapDetected) {
    flags.push({ code: 'GAP_DETECTED', message: 'Sequence gap detected in observation stream' });
    return finalize('DEGRADED_GAP', 'DETECTED', flags);
  }

  if (context.outlierState === 'OUTLIER' || context.outlierState === 'SUSPECTED') {
    flags.push({
      code: 'EXTREME_OUTLIER',
      message: `Outlier state: ${context.outlierState}`,
    });
    return finalize('DEGRADED_OUTLIER', 'NONE', flags);
  }

  if (context.contradictory) {
    flags.push({ code: 'CONTRADICTORY_STATE', message: 'Contradictory market state detected' });
    return finalize('DEGRADED_CONTRADICTORY', 'NONE', flags);
  }

  if (sharedUpstreamNotIndependent(context.sourceIndependence)) {
    flags.push({
      code: 'SHARED_UPSTREAM_SOURCE',
      message: `Source independence: ${context.sourceIndependence}`,
    });
  }

  if (flags.length > 0) {
    return finalize('VALID', gapStateFrom(context.gapDetected), flags);
  }

  return finalize('VALID', gapStateFrom(context.gapDetected), flags);
}

function gapStateFrom(gapDetected: boolean): GapState {
  return gapDetected ? 'DETECTED' : 'NONE';
}

function finalize(
  qualityState: QualityState,
  gapState: GapState,
  flags: QualityFlag[],
): { readonly qualityState: QualityState; readonly gapState: GapState; readonly qualityFlags: readonly QualityFlag[] } {
  return Object.freeze({
    qualityState,
    gapState,
    qualityFlags: Object.freeze(flags),
  });
}

export function detectSequenceGap(
  sequence: number | null,
  priorSequence: number | null,
): boolean {
  if (sequence === null || priorSequence === null) return false;
  return sequence > priorSequence + 1;
}
