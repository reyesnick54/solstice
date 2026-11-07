import { createHash } from 'node:crypto';

import type { InstrumentIdentifier } from './types.ts';

const IDENTITY_PREFIX = 'imd_id_';
const LISTING_PREFIX = 'imd_lst_';
const VENUE_INSTRUMENT_PREFIX = 'imd_vi_';
const SESSION_PREFIX = 'imd_ses_';
const ACTION_PREFIX = 'imd_ca_';
const CONTRACT_PREFIX = 'imd_ctr_';

function digest(material: string): string {
  return createHash('sha256').update(material).digest('hex').slice(0, 24);
}

export function instrumentIdentityIdFor(material: string): string {
  return `${IDENTITY_PREFIX}${digest(material)}`;
}

export function instrumentIdentityIdFromIdentifiers(identifiers: readonly InstrumentIdentifier[]): string {
  const permanent = identifiers
    .filter((row) => row.system !== 'ticker' && row.system !== 'provider_native_id')
    .sort((a, b) => `${a.system}:${a.value}`.localeCompare(`${b.system}:${b.value}`));
  const material =
    permanent.length > 0
      ? permanent.map((row) => `${row.system}:${row.value}`).join('|')
      : identifiers.map((row) => `${row.system}:${row.value}`).join('|');
  return instrumentIdentityIdFor(material);
}

export function listingIdFor(material: string): string {
  return `${LISTING_PREFIX}${digest(material)}`;
}

export function venueInstrumentIdFor(material: string): string {
  return `${VENUE_INSTRUMENT_PREFIX}${digest(material)}`;
}

export function tradingSessionIdFor(material: string): string {
  return `${SESSION_PREFIX}${digest(material)}`;
}

export function corporateActionIdFor(material: string): string {
  return `${ACTION_PREFIX}${digest(material)}`;
}

export function contractLifecycleIdFor(material: string): string {
  return `${CONTRACT_PREFIX}${digest(material)}`;
}

export function assertTickerIsNotPermanentIdentity(
  instrumentIdentityId: string,
  ticker: string,
): boolean {
  const normalized = ticker.trim().toUpperCase();
  return (
    instrumentIdentityId !== normalized &&
    instrumentIdentityId !== ticker &&
    !instrumentIdentityId.endsWith(`:${normalized}`)
  );
}

export function identifiersSufficientForPermanentIdentity(
  identifiers: readonly { readonly system: string }[],
): boolean {
  return identifiers.some((row) => row.system !== 'ticker' && row.system !== 'provider_native_id');
}
