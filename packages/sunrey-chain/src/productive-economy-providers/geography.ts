/**
 * Geographic normalization — reuses canonical country codes, no independent geo DB.
 */

import type { GeographicIdentity } from './types.ts';

const COUNTRY_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'united kingdom': 'GB',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  denmark: 'DK',
  india: 'IN',
  'united states': 'US',
  usa: 'US',
});

export function normalizeCountryCode(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 2 && trimmed === trimmed.toUpperCase()) {
    return trimmed;
  }
  return COUNTRY_ALIASES[trimmed.toLowerCase()] ?? trimmed.toUpperCase().slice(0, 2);
}

export function geographicIdentity(input: {
  readonly country: string;
  readonly region?: string | null;
  readonly gridZone?: string | null;
  readonly balancingAuthority?: string | null;
  readonly marketArea?: string | null;
  readonly facility?: string | null;
  readonly coordinates?: { readonly lat: number; readonly lon: number } | null;
}): GeographicIdentity {
  return Object.freeze({
    country: normalizeCountryCode(input.country),
    region: input.region ?? null,
    gridZone: input.gridZone ?? null,
    balancingAuthority: input.balancingAuthority ?? null,
    marketArea: input.marketArea ?? null,
    facility: input.facility ?? null,
    coordinates: input.coordinates ?? null,
  });
}

export function gridZoneForCountry(country: string): string {
  const code = normalizeCountryCode(country);
  switch (code) {
    case 'GB':
      return 'GB-NATIONAL';
    case 'DK':
      return 'DK-NATIONAL';
    case 'IN':
      return 'IN-NATIONAL';
    case 'US':
      return 'US-NATIONAL';
    default:
      return `${code}-NATIONAL`;
  }
}
