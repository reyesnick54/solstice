/**
 * Source classification — reference aggregates are not venue tapes.
 */

import type { CryptoSourceClass } from './types.ts';
import { COINGECKO_REFERENCE_PROVIDER_ID, KRAKEN_PROVIDER_ID } from '../aaf07/profiles.ts';

export function sourceClassForProvider(providerId: string): CryptoSourceClass {
  if (providerId === KRAKEN_PROVIDER_ID) {
    return 'VENUE_MARKET_DATA';
  }
  if (providerId === COINGECKO_REFERENCE_PROVIDER_ID) {
    return 'REFERENCE_AGGREGATE';
  }
  return 'VENUE_REPUBLISH_AGGREGATE';
}

export function sourceFamilyFor(input: {
  readonly providerId: string;
  readonly sourceClass: CryptoSourceClass;
  readonly venueId: string | null;
}): string {
  if (input.sourceClass === 'VENUE_MARKET_DATA' && input.venueId) {
    return `venue:${input.venueId}`;
  }
  if (input.sourceClass === 'REFERENCE_AGGREGATE') {
    return `reference_aggregate:${input.providerId}`;
  }
  return `republish_aggregate:${input.providerId}`;
}

export function venueIdForKraken(): string {
  return 'KRAKEN';
}

export function isVenueSource(sourceClass: CryptoSourceClass): boolean {
  return sourceClass === 'VENUE_MARKET_DATA';
}

export function isReferenceAggregate(sourceClass: CryptoSourceClass): boolean {
  return sourceClass === 'REFERENCE_AGGREGATE';
}
