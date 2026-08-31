/**
 * Shared commercial adapter utilities.
 */

import type {
  CommercialMoneyBreakdown,
  CommercialProviderOutcome,
  CommercialProviderProvenance,
} from './types.ts';

export const COMMERCIAL_FIXTURE_NOW = '2026-08-23T12:00:00.000Z';
export const COMMERCIAL_FIXTURE_EXPIRES = '2026-08-24T12:00:00.000Z';

export function commercialOk<T>(value: T): CommercialProviderOutcome<T> {
  return Object.freeze({ ok: true, value });
}

export function commercialFail(code: string, message: string): CommercialProviderOutcome<never> {
  return Object.freeze({ ok: false, code, message });
}

export function money(currency: string, minorUnits: bigint): CommercialMoneyBreakdown {
  return Object.freeze({ currency, minorUnits });
}

export function fixtureProvenance(
  source: CommercialProviderProvenance['source'] = 'FIXTURE',
): CommercialProviderProvenance {
  return Object.freeze({
    source,
    retrievedAt: COMMERCIAL_FIXTURE_NOW,
    cacheHit: false,
    providerRequestId: null,
  });
}

export function deterministicId(prefix: string, material: string): string {
  let hash = 0;
  for (let index = 0; index < material.length; index += 1) {
    hash = (hash * 31 + material.charCodeAt(index)) >>> 0;
  }
  return `${prefix}_${hash.toString(16).padStart(8, '0')}`;
}

export function sumMinorUnits(lines: readonly { readonly amount: CommercialMoneyBreakdown }[]): bigint {
  let total = 0n;
  for (const line of lines) {
    total += line.amount.minorUnits;
  }
  return total;
}
