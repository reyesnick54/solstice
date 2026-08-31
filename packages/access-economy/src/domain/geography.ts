/**
 * Canonical geography scopes for Access capacity and products.
 *
 * Reuses governed reference strings — no parallel location system and no raw
 * coordinates in domain records. Coordinate-bounded areas use opaque refs.
 */

import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { LocationRef } from '../ids.ts';

export const ACCESS_GEOGRAPHY_SCOPES = [
  'GLOBAL',
  'COUNTRY',
  'REGION',
  'CITY',
  'FACILITY',
  'COORDINATE_BOUNDED',
] as const;
export type AccessGeographyScope = (typeof ACCESS_GEOGRAPHY_SCOPES)[number];

export type AccessGeography = {
  readonly scope: AccessGeographyScope;
  /** ISO 3166-1 alpha-2 when scope is COUNTRY or narrower. */
  readonly countryCode: Jurisdiction | null;
  /** Opaque region reference when scope is REGION or narrower. */
  readonly regionRef: string | null;
  /** Opaque city reference when scope is CITY or narrower. */
  readonly cityRef: string | null;
  /** Opaque facility reference when scope is FACILITY or COORDINATE_BOUNDED. */
  readonly facilityRef: string | null;
  /**
   * Privacy-safe location commitment when scope is COORDINATE_BOUNDED.
   * Never raw latitude/longitude.
   */
  readonly locationRef: LocationRef | null;
};

export function isAccessGeographyScope(value: string): value is AccessGeographyScope {
  return (ACCESS_GEOGRAPHY_SCOPES as readonly string[]).includes(value);
}

export function freezeAccessGeography(geography: AccessGeography): AccessGeography {
  return Object.freeze({ ...geography });
}
