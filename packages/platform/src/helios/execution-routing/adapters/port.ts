import type { UtcInstant } from '@solstice/domain';
import type { ProviderHealthState } from '../taxonomy.ts';

/**
 * Provider adapter port for M23 routing qualification.
 * Adapters surface health/capability posture without executing orders.
 * Does not issue Execution Authority.
 */
export type ExecutionRoutingProviderAdapterPort = {
  readonly providerId: string;
  readonly routeId: string;
  readonly liveProviderConnected: false;
  readonly productionAuthorized: false;
  describeCapability(): {
    readonly healthState: ProviderHealthState;
    readonly credentialConfigured: boolean;
    readonly sandboxQualified: boolean;
    readonly externallyRequired: boolean;
  };
  ping(now: UtcInstant): { readonly ok: boolean; readonly evidenceRef: string };
};
