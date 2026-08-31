/**
 * Ticketmaster Discovery — informational only.
 *
 * DISCOVERY_ONLY — not a commercial booking provider. Separate from Partner API.
 */

export const TICKETMASTER_DISCOVERY_PROVIDER_CONTRACT = Object.freeze({
  providerId: 'ticketmaster_discovery',
  activationState: 'DISCOVERY_ONLY',
  supportedDomains: Object.freeze(['events_discovery']),
  liveConnectivity: false,
  commercialBooking: false,
  notes: 'Informational discovery only; not Ticketmaster Partner commerce.',
});

import type { AccessProviderSearchRequest, CommercialProviderOutcome } from '../../types.ts';
import { CommercialAdapterShell, type CommercialAdapterShellDeps } from '../adapter-shell.ts';
import { fixtureSearchItems } from '../../fixtures.ts';
import { commercialFail, commercialOk } from '../../shared.ts';

export class TicketmasterDiscoveryCommercialAdapter extends CommercialAdapterShell {
  constructor(deps: CommercialAdapterShellDeps = {}) {
    super('ticketmaster_discovery', deps);
  }

  search(request: AccessProviderSearchRequest): CommercialProviderOutcome<import('../../types.ts').AccessProviderSearchResult> {
    return this.gate('SEARCH', () =>
      commercialOk(
        Object.freeze({
          requestId: request.requestId,
          providerId: this.providerId,
          items: fixtureSearchItems(this.providerId),
          provenance: Object.freeze({
            source: 'FIXTURE' as const,
            retrievedAt: this.now(),
            cacheHit: false,
            providerRequestId: null,
          }),
        }),
      ),
    );
  }

  quote() {
    return commercialFail('DISCOVERY_ONLY', 'Ticketmaster Discovery does not support commercial quotes');
  }

  book() {
    return commercialFail('DISCOVERY_ONLY', 'Ticketmaster Discovery does not support commercial booking');
  }
}

export function createTicketmasterDiscoveryCommercialAdapter(
  deps?: CommercialAdapterShellDeps,
): TicketmasterDiscoveryCommercialAdapter {
  return new TicketmasterDiscoveryCommercialAdapter(deps);
}
