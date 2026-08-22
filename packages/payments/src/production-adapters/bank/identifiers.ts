/**
 * Secure typed bank-account identifiers.
 *
 * Raw IBAN, routing, account number, and sort-code values are sealed into
 * a fingerprint plus a display mask. The returned structure never carries
 * the raw value. Consumer APIs see only the mask / last4.
 */

import { createHash } from 'node:crypto';

export const ACCOUNT_IDENTIFIER_KINDS = [
  'IBAN',
  'US_ROUTING_ACCOUNT',
  'UK_SORT_ACCOUNT',
  'LOCAL',
] as const;
export type AccountIdentifierKind = (typeof ACCOUNT_IDENTIFIER_KINDS)[number];

export type BankAccountCoordinate = {
  readonly kind: AccountIdentifierKind;
  readonly countryCode: string | null;
  readonly displayMask: string;
  readonly last4: string;
  readonly coordinateFingerprint: string;
  readonly rawValuePresent: false;
};

export type SealIdentifierInput = {
  readonly kind: AccountIdentifierKind;
  readonly countryCode?: string;
  readonly iban?: string;
  readonly routingNumber?: string;
  readonly accountNumber?: string;
  readonly sortCode?: string;
  readonly localIdentifier?: string;
};

export function sealAccountIdentifier(input: SealIdentifierInput): BankAccountCoordinate {
  const canonical = canonicalForm(input);
  if (!canonical) {
    throw new TypeError('account identifier is incomplete for its kind');
  }
  const last4 = lastFour(canonical.sensitive);
  return Object.freeze({
    kind: input.kind,
    countryCode: input.countryCode ?? inferCountry(input) ?? null,
    displayMask: maskFor(input.kind, last4, input.countryCode ?? inferCountry(input)),
    last4,
    coordinateFingerprint: createHash('sha256').update(canonical.sensitive).digest('hex'),
    rawValuePresent: false,
  });
}

export function coordinatesEqual(left: BankAccountCoordinate, right: BankAccountCoordinate): boolean {
  return left.kind === right.kind && left.coordinateFingerprint === right.coordinateFingerprint;
}

function canonicalForm(input: SealIdentifierInput): { readonly sensitive: string } | null {
  switch (input.kind) {
    case 'IBAN':
      if (!input.iban) {
        return null;
      }
      return { sensitive: `IBAN:${normalize(input.iban)}` };
    case 'US_ROUTING_ACCOUNT':
      if (!input.routingNumber || !input.accountNumber) {
        return null;
      }
      return { sensitive: `US:${normalize(input.routingNumber)}:${normalize(input.accountNumber)}` };
    case 'UK_SORT_ACCOUNT':
      if (!input.sortCode || !input.accountNumber) {
        return null;
      }
      return { sensitive: `UK:${normalize(input.sortCode)}:${normalize(input.accountNumber)}` };
    case 'LOCAL':
      if (!input.localIdentifier) {
        return null;
      }
      return { sensitive: `LOCAL:${input.countryCode ?? 'XX'}:${normalize(input.localIdentifier)}` };
  }
}

function inferCountry(input: SealIdentifierInput): string | null {
  if (input.countryCode) {
    return input.countryCode;
  }
  if (input.kind === 'IBAN' && input.iban && input.iban.length >= 2) {
    return input.iban.slice(0, 2).toUpperCase();
  }
  if (input.kind === 'US_ROUTING_ACCOUNT') {
    return 'US';
  }
  if (input.kind === 'UK_SORT_ACCOUNT') {
    return 'GB';
  }
  return null;
}

function normalize(value: string): string {
  return value.replace(/[\s-]+/g, '').toUpperCase();
}

function lastFour(canonical: string): string {
  const digits = canonical.replace(/[^0-9A-Z]/g, '');
  return digits.slice(-4).padStart(4, '0');
}

function maskFor(kind: AccountIdentifierKind, last4: string, country: string | null): string {
  switch (kind) {
    case 'IBAN':
      return `${country ?? 'XX'}••••••••${last4}`;
    case 'US_ROUTING_ACCOUNT':
      return `••••${last4}`;
    case 'UK_SORT_ACCOUNT':
      return `••-••-•• ••••${last4}`;
    case 'LOCAL':
      return `${country ?? 'XX'}••••${last4}`;
  }
}
