/**
 * Commercial provider credential references.
 *
 * Credentials remain server-side via ProviderCredentialPort. No secrets in source.
 */

import type { CommercialProviderId } from './types.ts';

export type CommercialProviderCredentialRef = {
  readonly secretRef: string;
  readonly providerId: CommercialProviderId;
  readonly kind: 'API_KEY' | 'OAUTH_CLIENT' | 'PARTNER_TOKEN' | 'AFFILIATE_ID';
};

export const COMMERCIAL_PROVIDER_CREDENTIAL_REFS: Readonly<Record<CommercialProviderId, readonly CommercialProviderCredentialRef[]>> =
  Object.freeze({
    amadeus: Object.freeze([
      Object.freeze({
        secretRef: 'regulated/amadeus/api-key',
        providerId: 'amadeus',
        kind: 'API_KEY',
      }),
      Object.freeze({
        secretRef: 'regulated/amadeus/api-secret',
        providerId: 'amadeus',
        kind: 'OAUTH_CLIENT',
      }),
    ]),
    booking_com: Object.freeze([
      Object.freeze({
        secretRef: 'regulated/booking-com/demand-api-key',
        providerId: 'booking_com',
        kind: 'API_KEY',
      }),
    ]),
    viator: Object.freeze([
      Object.freeze({
        secretRef: 'regulated/viator/partner-api-key',
        providerId: 'viator',
        kind: 'PARTNER_TOKEN',
      }),
    ]),
    ticketmaster_partner: Object.freeze([
      Object.freeze({
        secretRef: 'regulated/ticketmaster/partner-api-key',
        providerId: 'ticketmaster_partner',
        kind: 'PARTNER_TOKEN',
      }),
    ]),
    ticketmaster_discovery: Object.freeze([]),
  });

export function commercialCredentialRefs(providerId: CommercialProviderId): readonly CommercialProviderCredentialRef[] {
  return COMMERCIAL_PROVIDER_CREDENTIAL_REFS[providerId] ?? Object.freeze([]);
}
