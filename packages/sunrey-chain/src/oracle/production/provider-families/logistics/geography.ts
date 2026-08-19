/**
 * Engineering movement-consistency checks. These flag review.
 * They are not a security-grade anti-GPS-spoofing solution.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  GPS_ANTI_SPOOFING_SECURITY_GRADE,
  type LogisticsRefusal,
  type MovementReviewFlag,
  type RestrictedTelematics,
  type RestrictedTelematicsSample,
} from './types.ts';

export const DEFAULT_MAX_ROAD_MILLIMETERS_PER_SECOND = 90_000_000n; // 90 m/s engineering bound
export const DEFAULT_TELEPORT_MILLIMETERS = 5_000_000_000n; // 5_000 km in milli-arcsec-scaled space is not used; see below

const EARTH_MM_PER_MILLI_ARCSEC_APPROX = 31n; // engineering approximation only

export type MovementReview = {
  readonly flags: readonly MovementReviewFlag[];
  readonly reviewRequired: boolean;
  readonly securityGradeAntiSpoofing: false;
};

function millimetersBetween(left: RestrictedTelematicsSample, right: RestrictedTelematicsSample): bigint | null {
  if (
    left.latitudeMilliArcsec === undefined ||
    left.longitudeMilliArcsec === undefined ||
    right.latitudeMilliArcsec === undefined ||
    right.longitudeMilliArcsec === undefined
  ) {
    return null;
  }
  const dLat = left.latitudeMilliArcsec > right.latitudeMilliArcsec
    ? left.latitudeMilliArcsec - right.latitudeMilliArcsec
    : right.latitudeMilliArcsec - left.latitudeMilliArcsec;
  const dLon = left.longitudeMilliArcsec > right.longitudeMilliArcsec
    ? left.longitudeMilliArcsec - right.longitudeMilliArcsec
    : right.longitudeMilliArcsec - left.longitudeMilliArcsec;
  return (dLat + dLon) * EARTH_MM_PER_MILLI_ARCSEC_APPROX;
}

export function reviewRestrictedMovement(telematics: RestrictedTelematics | undefined): MovementReview {
  if (!telematics || telematics.samples.length === 0) {
    return Object.freeze({
      flags: Object.freeze([]),
      reviewRequired: false,
      securityGradeAntiSpoofing: GPS_ANTI_SPOOFING_SECURITY_GRADE,
    });
  }
  const flags = new Set<MovementReviewFlag>();
  const ordered = [...telematics.samples].sort((a, b) => (a.observedAtUnix < b.observedAtUnix ? -1 : 1));
  const seen = new Map<string, RestrictedTelematicsSample>();
  let pathMillimeters = 0n;

  for (let index = 0; index < ordered.length; index += 1) {
    const sample = ordered[index]!;
    const key = `${sample.vehicleRef}:${sample.observedAtUnix.toString()}`;
    const priorSame = seen.get(key);
    if (priorSame) {
      const moved = millimetersBetween(priorSame, sample);
      if (moved !== null && moved > 0n) {
        flags.add('DUPLICATE_VEHICLE_TELEMETRY');
      }
    } else {
      seen.set(key, sample);
    }
    if (index === 0) {
      continue;
    }
    const previous = ordered[index - 1]!;
    if (sample.observedAtUnix < previous.observedAtUnix) {
      flags.add('TIMESTAMP_REVERSAL');
    }
    const dt = sample.observedAtUnix - previous.observedAtUnix;
    const distance = millimetersBetween(previous, sample);
    if (distance !== null) {
      pathMillimeters += distance;
      if (dt <= 0n && distance > 0n) {
        flags.add('TELEPORTING_LOCATION');
      }
      if (dt > 0n) {
        const speed = distance / dt;
        if (speed > DEFAULT_MAX_ROAD_MILLIMETERS_PER_SECOND) {
          flags.add('IMPOSSIBLE_SPEED');
          flags.add('TELEPORTING_LOCATION');
        }
      }
    }
  }

  if (telematics.reportedDistanceMeters !== undefined && pathMillimeters > 0n) {
    const computedMeters = pathMillimeters / 1_000n;
    const reported = telematics.reportedDistanceMeters;
    const delta = computedMeters > reported ? computedMeters - reported : reported - computedMeters;
    if (delta * 2n > reported + 1n && reported > 0n) {
      flags.add('DISTANCE_INCONSISTENCY');
    }
  }

  const list = Object.freeze([...flags]);
  return Object.freeze({
    flags: list,
    reviewRequired: list.length > 0,
    securityGradeAntiSpoofing: GPS_ANTI_SPOOFING_SECURITY_GRADE,
  });
}

export function refuseIfPublicGpsPresent(hasPublicGps: boolean): Result<true, LogisticsRefusal> {
  if (hasPublicGps) {
    return err({
      code: 'RAW_GPS_PUBLIC_FORBIDDEN',
      detail: 'raw precise GPS traces are not public oracle payloads',
      reviewRequired: false,
    });
  }
  return ok(true);
}
