import type { UtcInstant } from '@solstice/domain';
import { KRAKEN_VENUE_ADAPTER } from '../../../../../external-data/src/venue-adapters/kraken/adapter.ts';
import type { ExecutionRoutingProviderAdapterPort } from './port.ts';

/**
 * Kraken venue adapter port for M23/OS04 routing qualification.
 * Surfaces manifest health only — no order execution.
 */
export function createKrakenVenueRoutingAdapter(): ExecutionRoutingProviderAdapterPort {
  const manifest = KRAKEN_VENUE_ADAPTER.manifest();
  return Object.freeze({
    providerId: 'kraken',
    routeId: 'route_venue_kraken_market_data',
    liveProviderConnected: false,
    productionAuthorized: false,
    describeCapability() {
      return Object.freeze({
        healthState: manifest.healthState === 'HEALTHY' ? 'HEALTHY' : 'UNAVAILABLE',
        credentialConfigured: false,
        sandboxQualified: false,
        externallyRequired: false,
      });
    },
    ping(_now: UtcInstant) {
      return Object.freeze({
        ok: manifest.healthState === 'HEALTHY',
        evidenceRef: 'ev_kraken_os04_fixture_conformance',
      });
    },
  });
}
