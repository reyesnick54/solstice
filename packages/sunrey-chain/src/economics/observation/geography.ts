/**
 * Wave 4 — controlled geographic reference model.
 *
 * Supports country, region, city, coordinates, bounds, and facility
 * references. Human Economy records do not require precise personal
 * location unless domain policy and rights permit it.
 */

import type { EconomicDomain } from './types.ts';
import type { NormalizationRejectionCode } from './types.ts';

export const GEOGRAPHY_NORMALIZATION_VERSION = 'sunrey.economic-observation.geography.v1' as const;

export const LOCATION_PRECISION = [
  'COUNTRY',
  'REGION',
  'CITY',
  'FACILITY',
  'COORDINATES',
  'BOUNDS',
  'JURISDICTION_ONLY',
  'REDACTED',
  'NOT_DISCLOSED',
] as const;
export type LocationPrecision = (typeof LOCATION_PRECISION)[number];

export type Coordinates = {
  readonly lat: number;
  readonly lon: number;
};

export type GeospatialBounds = {
  readonly north: number;
  readonly south: number;
  readonly east: number;
  readonly west: number;
};

export type GeographicReference = {
  readonly precision: LocationPrecision;
  readonly country: string | null;
  readonly region: string | null;
  readonly city: string | null;
  readonly jurisdiction: string;
  readonly coordinates: Coordinates | null;
  readonly bounds: GeospatialBounds | null;
  readonly facilityRef: string | null;
  readonly resourceRef: string | null;
  readonly gridZone: string | null;
  readonly publicDisclosureAllowed: boolean;
};

export type RawGeographyInput = {
  readonly country?: string | null;
  readonly region?: string | null;
  readonly city?: string | null;
  readonly jurisdiction?: string | null;
  readonly coordinates?: Coordinates | null;
  readonly bounds?: GeospatialBounds | null;
  readonly facilityRef?: string | null;
  readonly resourceRef?: string | null;
  readonly gridZone?: string | null;
  readonly precision?: LocationPrecision | null;
  readonly publicDisclosureAllowed?: boolean | null;
};

const COUNTRY_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  GB: 'GB',
  UK: 'GB',
  'UNITED KINGDOM': 'GB',
  US: 'US',
  USA: 'US',
  'UNITED STATES': 'US',
  DK: 'DK',
  DENMARK: 'DK',
  IN: 'IN',
  INDIA: 'IN',
  DE: 'DE',
  GERMANY: 'DE',
  FR: 'FR',
  FRANCE: 'FR',
  CN: 'CN',
  CHINA: 'CN',
});

export function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw || raw.trim().length === 0) return null;
  const upper = raw.trim().toUpperCase();
  return COUNTRY_ALIASES[upper] ?? (upper.length === 2 || upper.length === 3 ? upper : upper.slice(0, 2));
}

export type GeographyNormalizationResult =
  | { readonly ok: true; readonly value: GeographicReference }
  | { readonly ok: false; readonly code: NormalizationRejectionCode; readonly message: string };

export function normalizeGeography(
  input: RawGeographyInput,
  context: { readonly economicDomain: EconomicDomain },
): GeographyNormalizationResult {
  const country = normalizeCountryCode(input.country);
  const jurisdiction = input.jurisdiction?.trim() || country || 'UNKNOWN';

  if (context.economicDomain === 'HUMAN_ECONOMY') {
    const hasPrecise =
      input.coordinates !== null &&
      input.coordinates !== undefined &&
      input.publicDisclosureAllowed !== false;
    if (hasPrecise && input.publicDisclosureAllowed !== true) {
      return {
        ok: false,
        code: 'GEOGRAPHY_POLICY_VIOLATION',
        message: 'precise personal location requires explicit rights and publicDisclosureAllowed',
      };
    }
  }

  let precision: LocationPrecision = input.precision ?? 'JURISDICTION_ONLY';
  if (!input.precision) {
    if (input.coordinates) precision = 'COORDINATES';
    else if (input.bounds) precision = 'BOUNDS';
    else if (input.facilityRef) precision = 'FACILITY';
    else if (input.city) precision = 'CITY';
    else if (input.region) precision = 'REGION';
    else if (country) precision = 'COUNTRY';
    else precision = 'JURISDICTION_ONLY';
  }

  if (precision === 'REDACTED' || precision === 'NOT_DISCLOSED') {
    return {
      ok: true,
      value: Object.freeze({
        precision,
        country: null,
        region: null,
        city: null,
        jurisdiction,
        coordinates: null,
        bounds: null,
        facilityRef: null,
        resourceRef: input.resourceRef ?? null,
        gridZone: null,
        publicDisclosureAllowed: false,
      }),
    };
  }

  return {
    ok: true,
    value: Object.freeze({
      precision,
      country,
      region: input.region?.trim() || null,
      city: input.city?.trim() || null,
      jurisdiction,
      coordinates: input.coordinates ?? null,
      bounds: input.bounds ?? null,
      facilityRef: input.facilityRef ?? null,
      resourceRef: input.resourceRef ?? null,
      gridZone: input.gridZone ?? null,
      publicDisclosureAllowed: input.publicDisclosureAllowed ?? precision !== 'COORDINATES',
    }),
  };
}

export function geographyKey(geo: GeographicReference): string {
  return [
    geo.precision,
    geo.jurisdiction,
    geo.country ?? '',
    geo.region ?? '',
    geo.city ?? '',
    geo.facilityRef ?? '',
    geo.gridZone ?? '',
  ].join('|');
}
