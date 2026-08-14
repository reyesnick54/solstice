import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { PolicyFactInput } from './facts.ts';
import { isPolicyPackId, type PolicyPackId } from './types.ts';

/**
 * Engineering mapping from ISO country codes to a jurisdiction pack.
 * This is not a conflict-of-law conclusion and is not CONFIRMED_BY_COUNSEL.
 * EEA membership, passporting, and applicable-law questions remain
 * RESEARCH_REQUIRED.
 */
export const EU_PACK_COUNTRY_CODES = Object.freeze([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
] as const);

export type JurisdictionResolution =
  | {
      readonly status: 'RESOLVED';
      readonly jurisdiction: string;
      readonly packId: PolicyPackId;
    }
  | {
      readonly status: 'AMBIGUOUS';
      readonly candidates: readonly string[];
      readonly reasonCode: 'JURISDICTION_AMBIGUOUS';
    }
  | {
      readonly status: 'UNRESOLVED';
      readonly reasonCode: 'JURISDICTION_UNRESOLVED';
    };

export function packIdForCountry(country: string): PolicyPackId | null {
  if (isPolicyPackId(country) && country !== 'EU') {
    return country;
  }
  if ((EU_PACK_COUNTRY_CODES as readonly string[]).includes(country)) {
    return 'EU';
  }
  return null;
}

/**
 * Deterministic resolution from typed facts. When facts disagree, the
 * engine does not invent a governing law — it defers to review.
 */
export function resolveJurisdiction(input: PolicyFactInput): JurisdictionResolution {
  const signals: Array<{ readonly name: string; readonly value: string }> = [];
  push(signals, 'intent', input.jurisdiction);
  push(signals, 'customer', input.customer?.jurisdiction);
  push(signals, 'residency', input.customer?.residency ?? input.identity?.residency);
  push(signals, 'legalEntity', input.legalEntity?.jurisdiction);
  push(signals, 'product', input.product?.jurisdiction);
  push(signals, 'sourceAccount', input.sourceAccount?.jurisdiction);
  push(signals, 'destinationAccount', input.destinationAccount?.jurisdiction);
  push(signals, 'serviceLocation', input.serviceLocation);
  push(signals, 'transactionOrigin', input.transactionOrigin);
  push(signals, 'transactionDestination', input.transactionDestination);
  if (input.identity?.citizenship) {
    push(signals, 'citizenship', input.identity.citizenship);
  }

  if (signals.length === 0) {
    return { status: 'UNRESOLVED', reasonCode: 'JURISDICTION_UNRESOLVED' };
  }

  const unique = [...new Set(signals.map((row) => row.value))];
  if (unique.length === 1) {
    const jurisdiction = unique[0]!;
    const packId = packIdForCountry(jurisdiction);
    if (!packId) {
      return { status: 'UNRESOLVED', reasonCode: 'JURISDICTION_UNRESOLVED' };
    }
    return { status: 'RESOLVED', jurisdiction, packId };
  }

  const packIds = new Set(
    unique.map((code) => packIdForCountry(code)).filter((id): id is PolicyPackId => id !== null),
  );
  if (packIds.size === 1 && unique.every((code) => packIdForCountry(code) !== null)) {
    const packId = [...packIds][0]!;
    return {
      status: 'AMBIGUOUS',
      candidates: unique,
      reasonCode: 'JURISDICTION_AMBIGUOUS',
    };
  }

  return {
    status: 'AMBIGUOUS',
    candidates: unique,
    reasonCode: 'JURISDICTION_AMBIGUOUS',
  };
}

function push(
  signals: Array<{ readonly name: string; readonly value: string }>,
  name: string,
  value: Jurisdiction | string | undefined,
): void {
  if (typeof value === 'string' && value.length > 0) {
    signals.push({ name, value });
  }
}
