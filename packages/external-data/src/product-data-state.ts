// @ts-nocheck
/**
 * Canonical BFF-level product data state and sanitized source metadata.
 *
 * Vendor-neutral. No API keys, internal provider risk scores, or raw payloads.
 */

import { DATA_MODE, type DataMode } from '../../config/src/data-mode.ts';
import type { ExternalObservation } from '../../provider-sdk/src/types.ts';

export const PRODUCT_DATA_STATES = [
  'LIVE',
  'STALE',
  'PARTIAL',
  'SIMULATED',
  'UNAVAILABLE',
  'DEGRADED',
  'ESTIMATED',
] as const;
export type ProductDataState = (typeof PRODUCT_DATA_STATES)[number];

export const AUTHORITY_CLASSES = [
  'official_statistics',
  'reference_data',
  'market_data',
  'derived_estimate',
  'simulation_fixture',
] as const;
export type AuthorityClass = (typeof AUTHORITY_CLASSES)[number];

export type SanitizedSourceMetadata = {
  readonly displayName: string;
  readonly authorityClass: AuthorityClass;
};

export type ProductDataTimestamps = {
  readonly dataTimestamp: string | null;
  readonly retrievedAt: string;
  readonly freshness: string;
};

export type ProductSectionEnvelope<T> = {
  readonly status: ProductDataState;
  readonly updatedAt: string;
  readonly freshness: string;
  readonly source: SanitizedSourceMetadata | null;
  readonly data: T | null;
  readonly reason: string | null;
};

export function providerDisplayName(providerId: string): string {
  return providerId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function sanitizeSourceFromObservation(
  observation: ExternalObservation<unknown>,
): SanitizedSourceMetadata {
  return Object.freeze({
    displayName: observation.source.displayName || providerDisplayName(observation.providerId),
    authorityClass: mapAuthorityClass(observation.authority.authorityClass),
  });
}

function mapAuthorityClass(value: string): AuthorityClass {
  if ((AUTHORITY_CLASSES as readonly string[]).includes(value)) {
    return value as AuthorityClass;
  }
  if (value === 'official' || value === 'government') {
    return 'official_statistics';
  }
  return 'reference_data';
}

export function freshnessToDataState(
  freshnessStatus: string,
  dataMode: DataMode = DATA_MODE,
): ProductDataState {
  if (dataMode === 'simulation' || dataMode === 'preview') {
    return 'SIMULATED';
  }
  switch (freshnessStatus) {
    case 'fresh':
      return 'LIVE';
    case 'stale':
      return 'STALE';
    case 'expired':
      return 'STALE';
    case 'estimated':
      return 'ESTIMATED';
    case 'unavailable':
      return 'UNAVAILABLE';
    default:
      return 'DEGRADED';
  }
}

export function defaultDataStateForMode(
  hasData: boolean,
  dataMode: DataMode = DATA_MODE,
): ProductDataState {
  if (!hasData) {
    return 'UNAVAILABLE';
  }
  if (dataMode === 'simulation' || dataMode === 'preview') {
    return 'SIMULATED';
  }
  return 'LIVE';
}

export function buildSectionEnvelope<T>(input: {
  readonly status: ProductDataState;
  readonly updatedAt: string;
  readonly freshness: string;
  readonly source: SanitizedSourceMetadata | null;
  readonly data: T | null;
  readonly reason?: string | null;
}): ProductSectionEnvelope<T> {
  return Object.freeze({
    status: input.status,
    updatedAt: input.updatedAt,
    freshness: input.freshness,
    source: input.source,
    data: input.data,
    reason: input.reason ?? null,
  });
}

export function aggregateOverallState(states: readonly ProductDataState[]): ProductDataState {
  if (states.length === 0) {
    return 'UNAVAILABLE';
  }
  const live = states.filter((s) => s === 'LIVE' || s === 'SIMULATED' || s === 'STALE' || s === 'ESTIMATED');
  if (live.length === 0) {
    return 'UNAVAILABLE';
  }
  if (live.length < states.length) {
    return 'PARTIAL';
  }
  if (states.some((s) => s === 'DEGRADED')) {
    return 'DEGRADED';
  }
  if (states.every((s) => s === 'SIMULATED')) {
    return 'SIMULATED';
  }
  if (states.some((s) => s === 'STALE')) {
    return 'STALE';
  }
  return states[0] ?? 'PARTIAL';
}
