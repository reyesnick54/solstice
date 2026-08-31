/**
 * Wave 5 bounded aviation and travel query limits.
 */

export const TRAVEL_QUERY_LIMITS = Object.freeze({
  maxAircraftResults: 100,
  maxAircraftPageSize: 50,
  maxBoundingBoxDegrees: 10,
  maxTransitResults: 50,
  maxChargingResults: 100,
  maxAirportResults: 50,
  maxResponseBytes: 512_000,
  maxConcurrentLookups: 8,
  defaultTimeoutMs: 5_000,
  maxHistoryWindowHours: 24,
  rateLimitPerMinute: 60,
  maxStringLength: 256,
});

export type QueryLimitRejection = {
  readonly code: 'QUERY_LIMIT_EXCEEDED' | 'INVALID_PARAMETER' | 'BOUNDING_BOX_TOO_LARGE';
  readonly message: string;
};

export type BoundingBox = {
  readonly minLat: number;
  readonly maxLat: number;
  readonly minLon: number;
  readonly maxLon: number;
};

export function validateBoundingBox(box: BoundingBox): QueryLimitRejection | null {
  if (
    !Number.isFinite(box.minLat) ||
    !Number.isFinite(box.maxLat) ||
    !Number.isFinite(box.minLon) ||
    !Number.isFinite(box.maxLon)
  ) {
    return { code: 'INVALID_PARAMETER', message: 'bounding box coordinates must be finite numbers' };
  }
  if (box.minLat > box.maxLat || box.minLon > box.maxLon) {
    return { code: 'INVALID_PARAMETER', message: 'invalid bounding box min/max' };
  }
  const latSpan = box.maxLat - box.minLat;
  const lonSpan = box.maxLon - box.minLon;
  if (
    latSpan > TRAVEL_QUERY_LIMITS.maxBoundingBoxDegrees ||
    lonSpan > TRAVEL_QUERY_LIMITS.maxBoundingBoxDegrees
  ) {
    return {
      code: 'BOUNDING_BOX_TOO_LARGE',
      message: `bounding box exceeds max ${TRAVEL_QUERY_LIMITS.maxBoundingBoxDegrees} degrees`,
    };
  }
  return null;
}

export function clampResultLimit(requested: number | undefined, max: number): number {
  if (requested === undefined || !Number.isFinite(requested) || requested < 1) {
    return Math.min(20, max);
  }
  return Math.min(Math.floor(requested), max);
}

export function validateIcao24(value: string): QueryLimitRejection | null {
  if (value.length > 6 || !/^[0-9a-fA-F]{6}$/.test(value)) {
    return { code: 'INVALID_PARAMETER', message: 'icao24 must be 6 hex characters' };
  }
  return null;
}

export function validateCountryCode(value: string): QueryLimitRejection | null {
  if (value.length > TRAVEL_QUERY_LIMITS.maxStringLength || !/^[A-Za-z]{2,3}$/.test(value)) {
    return { code: 'INVALID_PARAMETER', message: 'invalid country code' };
  }
  return null;
}

/** Privacy-safe log fields — never log full itineraries or sensitive user data. */
export function privacySafeLogFields(input: {
  readonly destination?: string;
  readonly nationality?: string;
  readonly providerId: string;
  readonly capability: string;
}): Record<string, string> {
  return Object.freeze({
    providerId: input.providerId,
    capability: input.capability,
    destinationRegion: input.destination ? input.destination.slice(0, 2).toUpperCase() : 'unknown',
    hasNationality: input.nationality ? 'yes' : 'no',
  });
}
