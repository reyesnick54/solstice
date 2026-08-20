/**
 * Transfer-interval validation.
 *
 * An interval is not inferred from collection time. End must be after
 * start. Duplicate intervals of the same service/aggregate are refused
 * as a second productive quantity. Stale and impossible windows fail
 * closed.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { bandwidthRefusal, type BandwidthRefusal, type BandwidthSourceObservation } from './types.ts';

export const BANDWIDTH_DEFAULT_MAX_AGE_SECONDS = 3_600n;
export const BANDWIDTH_FUTURE_TOLERANCE_SECONDS = 60n;

export type BandwidthInterval = {
  readonly startUnix: bigint;
  readonly endUnix: bigint;
  readonly durationSeconds: bigint;
};

export function parseBandwidthInterval(
  observation: BandwidthSourceObservation,
  nowUnix: bigint,
  maxAgeSeconds = BANDWIDTH_DEFAULT_MAX_AGE_SECONDS,
): Result<BandwidthInterval, BandwidthRefusal> {
  if (observation.measurementEnd <= observation.measurementStart) {
    return err(
      bandwidthRefusal('IMPOSSIBLE_TIMESTAMP_WINDOW', 'measurement end must be after measurement start'),
    );
  }
  const derived = observation.measurementEnd - observation.measurementStart;
  if (observation.durationSeconds !== null && observation.durationSeconds !== derived) {
    return err(
      bandwidthRefusal(
        'IMPOSSIBLE_TIMESTAMP_WINDOW',
        'durationSeconds conflicts with measurementStart/measurementEnd',
      ),
    );
  }
  const sourceUnix = BigInt(observation.sourceTimestampUnix);
  if (nowUnix + BANDWIDTH_FUTURE_TOLERANCE_SECONDS < sourceUnix) {
    return err(bandwidthRefusal('IMPOSSIBLE_TIMESTAMP_WINDOW', 'source timestamp is in the future'));
  }
  if (nowUnix > sourceUnix && nowUnix - sourceUnix > maxAgeSeconds) {
    return err(bandwidthRefusal('STALE_TRAFFIC', 'bandwidth observation exceeds freshness bound'));
  }
  return ok(
    Object.freeze({
      startUnix: observation.measurementStart,
      endUnix: observation.measurementEnd,
      durationSeconds: derived,
    }),
  );
}

export function duplicateInterval(
  left: BandwidthSourceObservation,
  right: BandwidthSourceObservation,
): boolean {
  return (
    left.networkServiceId === right.networkServiceId &&
    left.trafficAggregateId === right.trafficAggregateId &&
    left.networkStage === right.networkStage &&
    left.measurementStart === right.measurementStart &&
    left.measurementEnd === right.measurementEnd &&
    left.transferSemantics === right.transferSemantics &&
    left.identifier !== right.identifier
  );
}

export function refuseDuplicateInterval(
  left: BandwidthSourceObservation,
  right: BandwidthSourceObservation,
): Result<true, BandwidthRefusal> {
  if (duplicateInterval(left, right) && left.sourceClass === right.sourceClass) {
    return err(
      bandwidthRefusal(
        'DUPLICATE_INTERVAL',
        'the same source cannot post the same transfer interval twice as new productive output',
      ),
    );
  }
  return ok(true);
}
