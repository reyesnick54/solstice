/**
 * Commercial Access provider capability registry.
 */

import type {
  AccessProviderCapability,
  CommercialAccessCapabilityId,
  CommercialProviderActivationState,
  CommercialProviderId,
  CommercialProviderRegistration,
} from './types.ts';
import { COMMERCIAL_ACCESS_CAPABILITY_IDS } from './types.ts';

function capability(
  capabilityId: CommercialAccessCapabilityId,
  supported: boolean,
  notes: string | null = null,
): AccessProviderCapability {
  return Object.freeze({ capabilityId, supported, notes });
}

function declareCapabilities(
  supported: readonly CommercialAccessCapabilityId[],
  notes: string,
): readonly AccessProviderCapability[] {
  return Object.freeze(
    COMMERCIAL_ACCESS_CAPABILITY_IDS.map((capabilityId) =>
      capability(
        capabilityId,
        supported.includes(capabilityId),
        supported.includes(capabilityId) ? notes : 'not declared for this provider',
      ),
    ),
  );
}

export const COMMERCIAL_PROVIDER_REGISTRY: Readonly<Record<CommercialProviderId, CommercialProviderRegistration>> =
  Object.freeze({
    amadeus: Object.freeze({
      providerId: 'amadeus',
      displayName: 'Amadeus (travel commerce candidate)',
      activationState: 'BLOCKED_PENDING_CREDENTIALS',
      capabilities: declareCapabilities(
        ['SEARCH', 'AVAILABILITY', 'QUOTE', 'RESERVE', 'BOOK', 'CANCEL', 'STATUS', 'RECONCILE'],
        'fixture adapter; live Amadeus credentials not configured',
      ),
      categories: Object.freeze(['TRAVEL', 'HOUSING_ROOM_NIGHTS', 'VEHICLE_HOURS', 'EXPERIENCES']),
      contractStatus: 'NONE',
      credentialStatus: 'MISSING',
    }),
    booking_com: Object.freeze({
      providerId: 'booking_com',
      displayName: 'Booking.com Demand (accommodation candidate)',
      activationState: 'BLOCKED_PENDING_CONTRACT',
      capabilities: declareCapabilities(
        ['SEARCH', 'AVAILABILITY', 'QUOTE', 'BOOK', 'CANCEL', 'STATUS', 'RECONCILE'],
        'fixture adapter; commercial agreement not signed',
      ),
      categories: Object.freeze(['HOUSING_ROOM_NIGHTS', 'VEHICLE_HOURS']),
      contractStatus: 'PENDING',
      credentialStatus: 'MISSING',
    }),
    viator: Object.freeze({
      providerId: 'viator',
      displayName: 'Viator (experiences candidate)',
      activationState: 'BLOCKED_PENDING_CREDENTIALS',
      capabilities: declareCapabilities(
        ['SEARCH', 'AVAILABILITY', 'QUOTE', 'BOOK', 'CANCEL', 'STATUS'],
        'fixture adapter; partner access not configured',
      ),
      categories: Object.freeze(['EXPERIENCES']),
      contractStatus: 'NONE',
      credentialStatus: 'MISSING',
    }),
    ticketmaster_partner: Object.freeze({
      providerId: 'ticketmaster_partner',
      displayName: 'Ticketmaster Partner (events commerce candidate)',
      activationState: 'BLOCKED_PENDING_CONTRACT',
      capabilities: declareCapabilities(
        ['SEARCH', 'AVAILABILITY', 'QUOTE', 'BOOK', 'CANCEL', 'REFUND', 'STATUS', 'RECONCILE'],
        'fixture adapter; partner contract not signed',
      ),
      categories: Object.freeze(['EXPERIENCES']),
      contractStatus: 'PENDING',
      credentialStatus: 'MISSING',
    }),
    ticketmaster_discovery: Object.freeze({
      providerId: 'ticketmaster_discovery',
      displayName: 'Ticketmaster Discovery (informational only)',
      activationState: 'DISCOVERY_ONLY',
      capabilities: declareCapabilities(['SEARCH'], 'discovery/informational only; not commercial booking'),
      categories: Object.freeze(['EXPERIENCES']),
      contractStatus: 'NONE',
      credentialStatus: 'NONE',
    }),
  });

export class CommercialProviderCapabilityRegistry {
  get(providerId: CommercialProviderId): CommercialProviderRegistration | null {
    return COMMERCIAL_PROVIDER_REGISTRY[providerId] ?? null;
  }

  list(): readonly CommercialProviderRegistration[] {
    return Object.freeze(Object.values(COMMERCIAL_PROVIDER_REGISTRY));
  }

  canPerform(providerId: CommercialProviderId, capabilityId: CommercialAccessCapabilityId): boolean {
    const registration = this.get(providerId);
    if (!registration) {
      return false;
    }
    const row = registration.capabilities.find((candidate) => candidate.capabilityId === capabilityId);
    return row?.supported === true;
  }

  activationState(providerId: CommercialProviderId): CommercialProviderActivationState | null {
    return this.get(providerId)?.activationState ?? null;
  }

  isProductionEnabled(providerId: CommercialProviderId): boolean {
    return this.get(providerId)?.activationState === 'PRODUCTION';
  }
}

export function createCommercialProviderCapabilityRegistry(): CommercialProviderCapabilityRegistry {
  return new CommercialProviderCapabilityRegistry();
}
