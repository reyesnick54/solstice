import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { ExecutionRoutingProviderAdapterPort } from './port.ts';

/**
 * Futures route placeholder — no licensed broker integrated.
 * Preserves adapter port with EXTERNAL_PROVIDER_REQUIRED posture.
 */
export function createExternalFuturesAdapter(): ExecutionRoutingProviderAdapterPort {
  return Object.freeze({
    providerId: 'cme_futures_external',
    routeId: 'route_futures_cme_external',
    liveProviderConnected: false,
    productionAuthorized: false,
    describeCapability() {
      return Object.freeze({
        healthState: 'UNAVAILABLE' as const,
        credentialConfigured: false,
        sandboxQualified: false,
        externallyRequired: true,
      });
    },
    ping(_now: UtcInstant) {
      return Object.freeze({
        ok: false,
        evidenceRef: 'ev_futures_external_required',
      });
    },
  });
}
