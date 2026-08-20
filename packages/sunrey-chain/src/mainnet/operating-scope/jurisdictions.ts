/**
 * Known vs unknown jurisdictions. Unknown is RESEARCH_REQUIRED and
 * unavailable. Catalog entries are fixture / research markers, not
 * legal conclusions.
 */

import type { JurisdictionRecord } from './types.ts';

/** ISO 3166-1 user-assigned codes reserved for tests / private use. */
export const FIXTURE_JURISDICTION_XA = 'XA' as const;
export const FIXTURE_JURISDICTION_XB = 'XB' as const;

const CATALOG: readonly JurisdictionRecord[] = Object.freeze([
  Object.freeze({
    code: FIXTURE_JURISDICTION_XA,
    displayName: 'Fixture Alpha (TEST / not a real jurisdiction claim)',
    catalogState: 'KNOWN_FIXTURE',
    fixture: true,
    researchRequired: true,
    legalConclusionInvented: false,
  }),
  Object.freeze({
    code: FIXTURE_JURISDICTION_XB,
    displayName: 'Fixture Beta (TEST / not a real jurisdiction claim)',
    catalogState: 'KNOWN_FIXTURE',
    fixture: true,
    researchRequired: true,
    legalConclusionInvented: false,
  }),
]);

export function listJurisdictions(): readonly JurisdictionRecord[] {
  return CATALOG;
}

export function findJurisdiction(code: string): JurisdictionRecord | undefined {
  return CATALOG.find((row) => row.code === code);
}

export function isKnownJurisdiction(code: string): boolean {
  return findJurisdiction(code) !== undefined;
}

export function unknownJurisdictionRecord(code: string): JurisdictionRecord {
  return Object.freeze({
    code,
    displayName: `Unknown jurisdiction ${code}`,
    catalogState: 'UNKNOWN',
    fixture: true,
    researchRequired: true,
    legalConclusionInvented: false,
  });
}
