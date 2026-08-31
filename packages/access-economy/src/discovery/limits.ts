/**
 * ACCESS Wave 2 Prompt 31 — bounded discovery query limits.
 */

import type { AccessSearchRequest } from './types.ts';

export const ACCESS_DISCOVERY_QUERY_LIMITS = Object.freeze({
  maxPageSize: 50,
  defaultPageSize: 20,
  maxPage: 100,
  maxRadiusKm: 50,
  defaultRadiusKm: 10,
  maxDateRangeDays: 90,
  maxQueryLength: 256,
  maxFilterKeys: 10,
  maxConcurrentProviders: 6,
  defaultTimeoutMs: 5_000,
});

export type QueryLimitRejection = {
  readonly code: 'QUERY_LIMIT_EXCEEDED' | 'INVALID_PARAMETER';
  readonly message: string;
};

export function clampPageSize(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested) || requested < 1) {
    return ACCESS_DISCOVERY_QUERY_LIMITS.defaultPageSize;
  }
  return Math.min(Math.floor(requested), ACCESS_DISCOVERY_QUERY_LIMITS.maxPageSize);
}

export function clampRadiusKm(requested: number | null | undefined): number {
  if (requested === null || requested === undefined || !Number.isFinite(requested) || requested < 0) {
    return ACCESS_DISCOVERY_QUERY_LIMITS.defaultRadiusKm;
  }
  return Math.min(requested, ACCESS_DISCOVERY_QUERY_LIMITS.maxRadiusKm);
}

export function validateGeography(input: {
  readonly latitude: number;
  readonly longitude: number;
  readonly radiusKm?: number | null;
}): QueryLimitRejection | null {
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    return { code: 'INVALID_PARAMETER', message: 'latitude must be between -90 and 90' };
  }
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    return { code: 'INVALID_PARAMETER', message: 'longitude must be between -180 and 180' };
  }
  if (
    input.radiusKm !== undefined &&
    input.radiusKm !== null &&
    (input.radiusKm < 0 || input.radiusKm > ACCESS_DISCOVERY_QUERY_LIMITS.maxRadiusKm)
  ) {
    return {
      code: 'QUERY_LIMIT_EXCEEDED',
      message: `radiusKm exceeds max ${ACCESS_DISCOVERY_QUERY_LIMITS.maxRadiusKm} km`,
    };
  }
  return null;
}

export function validateDateRange(startDate: string | null, endDate: string | null): QueryLimitRejection | null {
  if (!startDate && !endDate) {
    return null;
  }
  const start = startDate ? Date.parse(startDate) : Date.parse(endDate!);
  const end = endDate ? Date.parse(endDate) : start;
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { code: 'INVALID_PARAMETER', message: 'startDate/endDate must be valid ISO timestamps' };
  }
  if (end < start) {
    return { code: 'INVALID_PARAMETER', message: 'endDate must be on or after startDate' };
  }
  const rangeDays = (end - start) / 86_400_000;
  if (rangeDays > ACCESS_DISCOVERY_QUERY_LIMITS.maxDateRangeDays) {
    return {
      code: 'QUERY_LIMIT_EXCEEDED',
      message: `date range exceeds max ${ACCESS_DISCOVERY_QUERY_LIMITS.maxDateRangeDays} days`,
    };
  }
  return null;
}

export function validateAccessSearchRequest(request: AccessSearchRequest): QueryLimitRejection | null {
  if (request.page < 1 || request.page > ACCESS_DISCOVERY_QUERY_LIMITS.maxPage) {
    return { code: 'QUERY_LIMIT_EXCEEDED', message: 'page out of bounds' };
  }
  if (request.pageSize < 1 || request.pageSize > ACCESS_DISCOVERY_QUERY_LIMITS.maxPageSize) {
    return { code: 'QUERY_LIMIT_EXCEEDED', message: 'pageSize out of bounds' };
  }
  if (request.query !== null && request.query.length > ACCESS_DISCOVERY_QUERY_LIMITS.maxQueryLength) {
    return { code: 'QUERY_LIMIT_EXCEEDED', message: 'query too long' };
  }
  if (Object.keys(request.filters).length > ACCESS_DISCOVERY_QUERY_LIMITS.maxFilterKeys) {
    return { code: 'QUERY_LIMIT_EXCEEDED', message: 'too many filters' };
  }
  if (request.location) {
    const geoError = validateGeography(request.location);
    if (geoError) return geoError;
  }
  return validateDateRange(request.startDate, request.endDate);
}
