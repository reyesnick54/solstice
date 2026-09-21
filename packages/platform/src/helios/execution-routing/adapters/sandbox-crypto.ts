import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { ExecutionRoutingProviderAdapterPort } from './port.ts';

/**
 * Sandbox crypto execution adapter extending H23 SandboxHeliosProviderPort.
 * Deterministic sandbox only — not live crypto execution.
 */
export function createSandboxCryptoExecutionAdapter(): ExecutionRoutingProviderAdapterPort {
  return Object.freeze({
    providerId: 'sandbox_helios_investment_v1',
    routeId: 'route_crypto_sandbox_execution',
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
        evidenceRef: `ev_sbx_crypto_ping_${now.slice(0, 19)}`,
      });
    },
  });
}
