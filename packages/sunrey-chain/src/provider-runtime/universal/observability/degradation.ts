/**
 * Safe degradation contract for domain-level dependency decisions.
 */

import type { CanonicalProviderHealth, DomainDegradationLevel, ProviderCacheFreshness } from './types.ts';

export type ProviderDegradationInput = {
  readonly health: CanonicalProviderHealth;
  readonly cacheFreshness: ProviderCacheFreshness;
  readonly required: boolean;
};

export function computeProviderDegradation(input: ProviderDegradationInput): DomainDegradationLevel {
  if (input.health === 'blocked' || input.health === 'disabled') {
    return input.required ? 'UNAVAILABLE' : 'DEGRADED';
  }
  if (input.health === 'unhealthy') {
    if (input.cacheFreshness.cacheState === 'stale_served' || input.cacheFreshness.isStale) {
      return 'UNAVAILABLE';
    }
    return input.required ? 'UNAVAILABLE' : 'DEGRADED';
  }
  if (input.health === 'degraded') {
    if (input.cacheFreshness.isStale) {
      return 'STALE_DATA';
    }
    return 'DEGRADED';
  }
  if (input.cacheFreshness.isStale && input.cacheFreshness.lastRefreshedAt !== null) {
    return 'STALE_DATA';
  }
  return 'NORMAL';
}

export function combineDomainDegradation(levels: readonly DomainDegradationLevel[]): DomainDegradationLevel {
  if (levels.length === 0) {
    return 'NORMAL';
  }
  if (levels.every((level) => level === 'UNAVAILABLE')) {
    return 'UNAVAILABLE';
  }
  if (levels.some((level) => level === 'UNAVAILABLE')) {
    return 'DEGRADED';
  }
  if (levels.some((level) => level === 'STALE_DATA')) {
    return 'STALE_DATA';
  }
  if (levels.some((level) => level === 'DEGRADED')) {
    return 'DEGRADED';
  }
  return 'NORMAL';
}

export function degradationAllowsResponse(level: DomainDegradationLevel): boolean {
  return level !== 'UNAVAILABLE';
}

export function degradationHttpStatus(level: DomainDegradationLevel): number {
  switch (level) {
    case 'NORMAL':
      return 200;
    case 'DEGRADED':
    case 'STALE_DATA':
      return 200;
    case 'UNAVAILABLE':
      return 503;
    default:
      return 503;
  }
}
