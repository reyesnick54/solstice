/**
 * Commercial Access Provider Gateway.
 *
 * Orchestrates commercial provider adapters. Vendor-native payloads stop at
 * adapter boundaries. No settlement, funding, or fiat payment occurs here.
 */

import { createAmadeusCommercialAdapter } from './adapters/amadeus/adapter.ts';
import { createBookingComCommercialAdapter } from './adapters/booking-com/adapter.ts';
import { createViatorCommercialAdapter } from './adapters/viator/adapter.ts';
import { createTicketmasterPartnerCommercialAdapter } from './adapters/ticketmaster-partner/adapter.ts';
import { createTicketmasterDiscoveryCommercialAdapter } from './adapters/ticketmaster-discovery/adapter.ts';
import { evaluateCommercialActivation } from './activation.ts';
import {
  CommercialProviderCapabilityRegistry,
  createCommercialProviderCapabilityRegistry,
} from './capabilities.ts';
import {
  AccessProviderProductMappingRegistry,
  createAccessProviderProductMappingRegistry,
} from './product-mapping.ts';
import { FIXTURE_PRODUCT_MAPPINGS } from './fixtures.ts';
import type {
  AccessProviderAvailabilityRequest,
  AccessProviderBookingRequest,
  AccessProviderCancellationRequest,
  AccessProviderQuoteRequest,
  AccessProviderReconcileRequest,
  AccessProviderRefundRequest,
  AccessProviderReservationRequest,
  AccessProviderSearchRequest,
  CommercialAccessCapabilityId,
  CommercialAccessProvider,
  CommercialProviderId,
  CommercialProviderOutcome,
} from './types.ts';
import { commercialFail } from './shared.ts';

export type CommercialAccessProviderGatewayInput = {
  readonly providers?: Partial<Record<CommercialProviderId, CommercialAccessProvider>>;
  readonly fixtureMode?: boolean;
  readonly productMappings?: AccessProviderProductMappingRegistry;
};

export class CommercialAccessProviderGateway {
  readonly registry: CommercialProviderCapabilityRegistry;
  readonly productMappings: AccessProviderProductMappingRegistry;
  private readonly providers: Readonly<Record<CommercialProviderId, CommercialAccessProvider>>;
  private readonly fixtureMode: boolean;

  constructor(input: CommercialAccessProviderGatewayInput = {}) {
    this.fixtureMode = input.fixtureMode ?? false;
    this.registry = createCommercialProviderCapabilityRegistry();
    this.productMappings =
      input.productMappings ?? createAccessProviderProductMappingRegistry(FIXTURE_PRODUCT_MAPPINGS);
    this.providers = Object.freeze({
      amadeus: input.providers?.amadeus ?? createAmadeusCommercialAdapter({ fixtureMode: this.fixtureMode }),
      booking_com: input.providers?.booking_com ?? createBookingComCommercialAdapter({ fixtureMode: this.fixtureMode }),
      viator: input.providers?.viator ?? createViatorCommercialAdapter({ fixtureMode: this.fixtureMode }),
      ticketmaster_partner:
        input.providers?.ticketmaster_partner ??
        createTicketmasterPartnerCommercialAdapter({ fixtureMode: this.fixtureMode }),
      ticketmaster_discovery:
        input.providers?.ticketmaster_discovery ??
        createTicketmasterDiscoveryCommercialAdapter({ fixtureMode: this.fixtureMode }),
    });
  }

  listProviders() {
    return this.registry.list();
  }

  getProvider(providerId: CommercialProviderId): CommercialAccessProvider {
    return this.providers[providerId];
  }

  private ensureCapability<T>(
    providerId: CommercialProviderId,
    capabilityId: CommercialAccessCapabilityId,
    execute: (provider: CommercialAccessProvider) => CommercialProviderOutcome<T>,
  ): CommercialProviderOutcome<T> {
    const provider = this.providers[providerId];
    const registration = this.registry.get(providerId);
    if (!registration) {
      return commercialFail('PROVIDER_NOT_FOUND', `unknown commercial provider ${providerId}`);
    }

    if (!this.fixtureMode) {
      const gate = evaluateCommercialActivation({
        providerId,
        activationState: registration.activationState,
        capabilityId,
        credentialStatus: registration.credentialStatus,
        contractStatus: registration.contractStatus,
      });
      if (!gate.allowed) {
        return commercialFail('ACTIVATION_BLOCKED', gate.reasons.join('; '));
      }
    } else if (!this.registry.canPerform(providerId, capabilityId)) {
      return commercialFail('CAPABILITY_UNAVAILABLE', `${providerId} does not support ${capabilityId}`);
    }

    return execute(provider);
  }

  search(
    request: AccessProviderSearchRequest,
  ): CommercialProviderOutcome<import('./types.ts').AccessProviderSearchResult> {
    const provider = this.providers[request.providerId];
    if (!provider.search) {
      return commercialFail('CAPABILITY_UNAVAILABLE', 'search not implemented');
    }
    return this.ensureCapability(request.providerId, 'SEARCH', () => provider.search!(request));
  }

  getAvailability(
    request: AccessProviderAvailabilityRequest,
  ): CommercialProviderOutcome<import('./types.ts').AccessProviderAvailability> {
    const provider = this.providers[request.providerId];
    if (!provider.getAvailability) {
      return commercialFail('CAPABILITY_UNAVAILABLE', 'availability not implemented');
    }
    return this.ensureCapability(request.providerId, 'AVAILABILITY', () => provider.getAvailability!(request));
  }

  quote(request: AccessProviderQuoteRequest): CommercialProviderOutcome<import('./types.ts').AccessProviderQuote> {
    const provider = this.providers[request.providerId];
    if (!provider.quote) {
      return commercialFail('CAPABILITY_UNAVAILABLE', 'quote not implemented');
    }
    return this.ensureCapability(request.providerId, 'QUOTE', () => provider.quote!(request));
  }

  reserve(
    request: AccessProviderReservationRequest,
  ): CommercialProviderOutcome<import('./types.ts').AccessProviderReservation> {
    const provider = this.providers[request.providerId];
    if (!provider.reserve) {
      return commercialFail('CAPABILITY_UNAVAILABLE', 'reserve not implemented');
    }
    return this.ensureCapability(request.providerId, 'RESERVE', () => provider.reserve!(request));
  }

  book(request: AccessProviderBookingRequest): CommercialProviderOutcome<import('./types.ts').AccessProviderBooking> {
    const provider = this.providers[request.providerId];
    if (!provider.book) {
      return commercialFail('CAPABILITY_UNAVAILABLE', 'book not implemented');
    }
    return this.ensureCapability(request.providerId, 'BOOK', () => provider.book!(request));
  }

  cancelBooking(
    request: AccessProviderCancellationRequest,
  ): CommercialProviderOutcome<import('./types.ts').AccessProviderCancellation> {
    const provider = this.providers[request.providerId];
    if (!provider.cancelBooking) {
      return commercialFail('CAPABILITY_UNAVAILABLE', 'cancel not implemented');
    }
    return this.ensureCapability(request.providerId, 'CANCEL', () => provider.cancelBooking!(request));
  }

  refund(request: AccessProviderRefundRequest): CommercialProviderOutcome<import('./types.ts').AccessProviderRefund> {
    const provider = this.providers[request.providerId];
    if (!provider.refund) {
      return commercialFail('CAPABILITY_UNAVAILABLE', 'refund not implemented');
    }
    return this.ensureCapability(request.providerId, 'REFUND', () => provider.refund!(request));
  }

  reconcile(
    request: AccessProviderReconcileRequest,
  ): CommercialProviderOutcome<import('./types.ts').AccessProviderReconcileResult> {
    const provider = this.providers[request.providerId];
    if (!provider.reconcile && !provider.getBookingStatus) {
      return commercialFail('CAPABILITY_UNAVAILABLE', 'reconcile not implemented');
    }
    return this.ensureCapability(request.providerId, 'RECONCILE', () => {
      if (provider.reconcile) {
        return provider.reconcile(request);
      }
      const status = provider.getBookingStatus!({ providerBookingId: request.providerBookingId });
      if (!status.ok) {
        return status;
      }
      return Object.freeze({
        ok: true as const,
        value: Object.freeze({
          providerBookingId: request.providerBookingId,
          status: status.value.status,
          reconciliationState: status.value.reconciliationState,
          providerReference: status.value.confirmationCode,
          provenance: status.value.provenance,
        }),
      });
    });
  }
}

export function createCommercialAccessProviderGateway(
  input?: CommercialAccessProviderGatewayInput,
): CommercialAccessProviderGateway {
  return new CommercialAccessProviderGateway(input);
}
