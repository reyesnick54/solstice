/**
 * ACCESS-14 — Provider Capability Registry.
 *
 * Each provider declares capabilities; SunRey never assumes live support
 * from public documentation alone.
 */

import type {
  AccessProviderId,
  ProviderCapability,
  ProviderCapabilityId,
  ProviderIntegrationState,
} from './types.ts';
import { PROVIDER_CAPABILITY_IDS } from './types.ts';

export type ProviderRegistration = {
  readonly providerId: AccessProviderId;
  readonly displayName: string;
  readonly integrationState: ProviderIntegrationState;
  readonly capabilities: readonly ProviderCapability[];
  readonly categories: readonly string[];
};

function capability(
  capabilityId: ProviderCapabilityId,
  supported: boolean,
  integrationState: ProviderIntegrationState,
  notes: string | null = null,
): ProviderCapability {
  return Object.freeze({ capabilityId, supported, integrationState, notes });
}

function sandboxCapabilities(): readonly ProviderCapability[] {
  return Object.freeze(
    PROVIDER_CAPABILITY_IDS.map((capabilityId) =>
      capability(capabilityId, true, 'SANDBOX_AVAILABLE', 'Expedia Rapid sandbox via injected transport'),
    ),
  );
}

function simulatedCapabilities(): readonly ProviderCapability[] {
  return Object.freeze(
    PROVIDER_CAPABILITY_IDS.map((capabilityId) =>
      capability(capabilityId, true, 'SIMULATED', 'simulation adapter only'),
    ),
  );
}

function partnerGatedCapabilities(
  supported: readonly ProviderCapabilityId[],
  notes: string,
): readonly ProviderCapability[] {
  return Object.freeze(
    PROVIDER_CAPABILITY_IDS.map((capabilityId) =>
      capability(
        capabilityId,
        supported.includes(capabilityId),
        supported.includes(capabilityId) ? 'PARTNER_APPROVAL_REQUIRED' : 'DOCUMENTED_NOT_CONNECTED',
        supported.includes(capabilityId) ? notes : 'not declared for production',
      ),
    ),
  );
}

export const PROVIDER_CAPABILITY_REGISTRY: Readonly<Record<AccessProviderId, ProviderRegistration>> = Object.freeze({
  expedia: Object.freeze({
    providerId: 'expedia',
    displayName: 'Expedia Rapid (lodging sandbox)',
    integrationState: 'SANDBOX_AVAILABLE',
    capabilities: sandboxCapabilities(),
    categories: ['HOUSING_ROOM_NIGHTS', 'TRAVEL', 'VEHICLE_HOURS'],
  }),
  turo: Object.freeze({
    providerId: 'turo',
    displayName: 'Turo (mobility candidate)',
    integrationState: 'PARTNER_APPROVAL_REQUIRED',
    capabilities: partnerGatedCapabilities(
      ['CATALOG_SEARCH', 'AVAILABILITY', 'QUOTE', 'RESERVE', 'BOOK', 'CANCEL', 'FULFILLMENT_STATUS', 'WEBHOOKS'],
      'production booking requires partner approval',
    ),
    categories: ['VEHICLE_HOURS'],
  }),
  doordash: Object.freeze({
    providerId: 'doordash',
    displayName: 'DoorDash (food candidate)',
    integrationState: 'PARTNER_APPROVAL_REQUIRED',
    capabilities: partnerGatedCapabilities(
      ['CATALOG_SEARCH', 'AVAILABILITY', 'QUOTE', 'FULFILLMENT_STATUS', 'WEBHOOKS'],
      'marketplace ordering scope not assumed; delivery fulfillment candidate only',
    ),
    categories: ['FOOD'],
  }),
  amazon: Object.freeze({
    providerId: 'amazon',
    displayName: 'Amazon (commerce candidate)',
    integrationState: 'PARTNER_APPROVAL_REQUIRED',
    capabilities: partnerGatedCapabilities(
      ['CATALOG_SEARCH', 'AVAILABILITY', 'QUOTE', 'BOOK', 'FULFILLMENT_STATUS', 'WEBHOOKS'],
      'commerce integration requires scoped partner contract',
    ),
    categories: ['GOODS', 'FOOD'],
  }),
  airbnb: Object.freeze({
    providerId: 'airbnb',
    displayName: 'Airbnb (stay candidate)',
    integrationState: 'PARTNER_APPROVAL_REQUIRED',
    capabilities: partnerGatedCapabilities(
      ['CATALOG_SEARCH', 'AVAILABILITY', 'QUOTE', 'RESERVE', 'BOOK', 'CANCEL', 'WEBHOOKS'],
      'production connectivity requires partner-scoped access',
    ),
    categories: ['HOUSING_ROOM_NIGHTS', 'EXPERIENCES'],
  }),
});

export class ProviderCapabilityRegistry {
  get(providerId: AccessProviderId): ProviderRegistration | null {
    return PROVIDER_CAPABILITY_REGISTRY[providerId] ?? null;
  }

  list(): readonly ProviderRegistration[] {
    return Object.freeze(Object.values(PROVIDER_CAPABILITY_REGISTRY));
  }

  canPerform(providerId: AccessProviderId, capabilityId: ProviderCapabilityId): boolean {
    const registration = this.get(providerId);
    if (!registration) {
      return false;
    }
    const row = registration.capabilities.find((candidate) => candidate.capabilityId === capabilityId);
    if (!row?.supported) {
      return false;
    }
    return row.integrationState === 'SIMULATED' || row.integrationState === 'SANDBOX_AVAILABLE';
  }

  isLiveEnabled(providerId: AccessProviderId): boolean {
    const registration = this.get(providerId);
    return registration?.integrationState === 'LIVE_ENABLED';
  }
}

export function createProviderCapabilityRegistry(): ProviderCapabilityRegistry {
  return new ProviderCapabilityRegistry();
}
