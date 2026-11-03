import type { UtcInstant } from '@solstice/domain';
import { getHeliosVenueAdapter } from '@solstice/external-data';
import { capabilityAvailability } from '@solstice/provider-sdk';
import type { ExecutionRoutingProviderAdapterPort } from './port.ts';

/**
 * Routes through HeliosVenueAdapter manifest health only — no direct exchange access.
 */
export function createVenueRoutingAdapter(venueId: string): ExecutionRoutingProviderAdapterPort {
  const adapter = getHeliosVenueAdapter(venueId);
  if (!adapter) {
    return Object.freeze({
      providerId: venueId,
      routeId: `route_venue_${venueId}_unknown`,
      liveProviderConnected: false,
      productionAuthorized: false,
      describeCapability() {
        return Object.freeze({
          healthState: 'UNAVAILABLE',
          credentialConfigured: false,
          sandboxQualified: false,
          externallyRequired: false,
        });
      },
      ping(_now: UtcInstant) {
        return Object.freeze({ ok: false, evidenceRef: `ev_${venueId}_missing_adapter` });
      },
    });
  }

  const manifest = adapter.manifest();
  const restAvailable = capabilityAvailability(manifest.marketData.restAvailable) === 'AVAILABLE';
  const healthy = restAvailable && manifest.healthState !== 'UNAVAILABLE';

  return Object.freeze({
    providerId: venueId,
    routeId: `route_venue_${venueId}_market_data`,
    liveProviderConnected: false,
    productionAuthorized: false,
    describeCapability() {
      return Object.freeze({
        healthState: healthy ? 'HEALTHY' : 'UNAVAILABLE',
        credentialConfigured: false,
        sandboxQualified: true,
        externallyRequired: false,
      });
    },
    ping(_now: UtcInstant) {
      return Object.freeze({
        ok: healthy,
        evidenceRef: `ev_${venueId}_native05_fixture_conformance`,
      });
    },
  });
}
