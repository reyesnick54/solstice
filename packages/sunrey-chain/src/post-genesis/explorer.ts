/**
 * Safe public network-status projection.
 *
 * Distinguishes engineering health, production capability status, and
 * regulated service status. Internal security details stay off the
 * public surface.
 */

import type {
  HealthComponentState,
  IndependentCapability,
  PostGenesisHealthReport,
  PostGenesisPhase,
  PublicCapabilityStatus,
  PublicNetworkStatus,
} from './types.ts';
import { INDEPENDENT_CAPABILITIES } from './types.ts';
import { isRegulatedCapability } from './capabilities.ts';
import { REHEARSAL_NETWORK_CLASS, REHEARSAL_PROTOCOL } from './identity.ts';

export function publicCapabilityStatus(
  capability: IndependentCapability | 'SUNREY_CHAIN',
  input: {
    readonly chainHealthy: boolean;
    readonly runtimeEnabled: boolean;
    readonly restricted: boolean;
  },
): PublicCapabilityStatus {
  const engineeringHealth: HealthComponentState = input.chainHealthy ? 'HEALTHY' : 'DEGRADED';
  if (capability === 'SUNREY_CHAIN') {
    return Object.freeze({
      capability,
      engineeringHealth,
      productionCapabilityStatus: input.chainHealthy ? 'ELIGIBLE' : 'UNAVAILABLE',
      regulatedServiceStatus: 'NOT_APPLICABLE',
    });
  }
  const regulated = isRegulatedCapability(capability);
  return Object.freeze({
    capability,
    engineeringHealth,
    productionCapabilityStatus: input.runtimeEnabled
      ? input.restricted
        ? 'RESTRICTED'
        : 'ENABLED'
      : 'UNAVAILABLE',
    regulatedServiceStatus: regulated
      ? input.runtimeEnabled
        ? input.restricted
          ? 'RESTRICTED'
          : 'ELIGIBLE'
        : 'UNAVAILABLE'
      : 'NOT_APPLICABLE',
  });
}

export function publicNetworkStatus(input: {
  readonly phase: PostGenesisPhase;
  readonly health: PostGenesisHealthReport | null;
  readonly enabled: ReadonlySet<IndependentCapability>;
  readonly restricted: ReadonlySet<IndependentCapability>;
}): PublicNetworkStatus {
  const chainHealthy = input.health?.engineeringHealthy !== false && input.health?.conflictingFinality !== true;
  const capabilities = [
    publicCapabilityStatus('SUNREY_CHAIN', { chainHealthy, runtimeEnabled: chainHealthy, restricted: false }),
    ...INDEPENDENT_CAPABILITIES.map((capability) =>
      publicCapabilityStatus(capability, {
        chainHealthy,
        runtimeEnabled: input.enabled.has(capability),
        restricted: input.restricted.has(capability),
      }),
    ),
  ];
  const anyEnabled = capabilities.some((row) => row.capability !== 'SUNREY_CHAIN' && row.productionCapabilityStatus === 'ENABLED');
  return Object.freeze({
    environment: 'simulation',
    networkClass: REHEARSAL_NETWORK_CLASS,
    phase: input.phase,
    protocolVersion: REHEARSAL_PROTOCOL,
    planes: Object.freeze({
      ENGINEERING_HEALTH: chainHealthy ? 'HEALTHY' : 'UNHEALTHY',
      PRODUCTION_CAPABILITY_STATUS: anyEnabled ? 'PARTIAL' : 'UNAVAILABLE',
      REGULATED_SERVICE_STATUS: 'UNAVAILABLE',
    }),
    capabilities: Object.freeze(capabilities),
    realProductionCapabilitiesActivated: false,
    securityInternalsExposed: false,
  });
}

export function stripSecurityInternals(status: PublicNetworkStatus): PublicNetworkStatus {
  return Object.freeze({
    environment: status.environment,
    networkClass: status.networkClass,
    phase: status.phase,
    protocolVersion: status.protocolVersion,
    planes: status.planes,
    capabilities: status.capabilities,
    realProductionCapabilitiesActivated: false,
    securityInternalsExposed: false,
  });
}
