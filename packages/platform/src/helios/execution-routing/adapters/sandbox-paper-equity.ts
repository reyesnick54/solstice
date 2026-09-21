import type { UtcInstant } from '@solstice/domain';
import type { ExecutionRoutingProviderAdapterPort } from './port.ts';

/**
 * Sandbox paper equity adapter extending H09 sunrey-investments-paper / H23 sandbox posture.
 * Injected/fake transport only.
 */
export function createSandboxPaperEquityAdapter(): ExecutionRoutingProviderAdapterPort {
  return Object.freeze({
    providerId: 'sunrey-investments-paper',
    routeId: 'route_equity_paper_sandbox',
    liveProviderConnected: false,
    productionAuthorized: false,
    describeCapability() {
      return Object.freeze({
        healthState: 'HEALTHY' as const,
        credentialConfigured: true,
        sandboxQualified: true,
        externallyRequired: false,
      });
    },
    ping(now: UtcInstant) {
      return Object.freeze({
        ok: true,
        evidenceRef: `ev_sbx_paper_ping_${now.slice(0, 19)}`,
      });
    },
  });
}
