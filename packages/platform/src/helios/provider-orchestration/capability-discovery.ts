import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ProviderRuntimeDiscoveryPort } from './adapter-port.ts';
import type { ProviderCapabilityDiscovery } from './types.ts';
import type {
  ProviderOrchestrationCapabilityState,
  ProviderOrchestrationEnvironment,
} from './taxonomy.ts';

const CAPABILITY_MAP: Readonly<Record<string, readonly string[]>> = Object.freeze({
  APPLICATION_SUPPORTED: Object.freeze(['INVESTMENT.PAPER_ORDER', 'BANK.ACCOUNTS']),
  FUNDING_SUPPORTED: Object.freeze(['INVESTMENT.FUND', 'PAYMENT.ACH', 'PAYMENT.WIRE']),
  CUSTODY_SUPPORTED: Object.freeze(['CUSTODY.WALLET', 'CUSTODY.DEPOSIT']),
  TRADING_SUPPORTED: Object.freeze(['INVESTMENT.PAPER_ORDER']),
  WITHDRAWAL_SUPPORTED: Object.freeze(['CUSTODY.WITHDRAWAL', 'INVESTMENT.SETTLE']),
});

function mapLifecycleToCapability(
  lifecycleState: string,
  healthState: string,
  credentialConfigured: boolean,
  runtimeCaps: readonly string[],
  orchestrationCap: keyof typeof CAPABILITY_MAP,
): ProviderOrchestrationCapabilityState {
  if (healthState === 'UNAVAILABLE' || healthState === 'MAINTENANCE') {
    return 'UNAVAILABLE';
  }
  if (healthState === 'DEGRADED' || healthState === 'RATE_LIMITED') {
    return 'DEGRADED';
  }
  if (!credentialConfigured) {
    return 'NOT_CONFIGURED';
  }
  const required = CAPABILITY_MAP[orchestrationCap] ?? [];
  const supported = required.some((cap) => runtimeCaps.includes(cap));
  if (!supported) {
    return 'NOT_CONFIGURED';
  }
  switch (lifecycleState) {
    case 'DISABLED':
      return 'NOT_CONFIGURED';
    case 'SIMULATED':
      return orchestrationCap === 'APPLICATION_SUPPORTED' ? 'SANDBOX_AVAILABLE' : 'CONFIGURED';
    case 'SANDBOX':
      return 'SANDBOX_AVAILABLE';
    case 'CERTIFICATION':
      return 'CERTIFICATION_AVAILABLE';
    case 'PREPRODUCTION':
    case 'LIMITED_LIVE':
      return 'LIVE_AUTHORIZATION_PENDING';
    case 'PRODUCTION':
      return 'LIVE_AUTHORIZED';
    case 'SUSPENDED':
      return 'UNAVAILABLE';
    default:
      return 'CONFIGURED';
  }
}

export function discoverProviderCapabilities(
  runtime: ProviderRuntimeDiscoveryPort,
  providerId: string,
  environment: ProviderOrchestrationEnvironment,
  now: UtcInstant,
): ProviderCapabilityDiscovery | null {
  const registration = runtime.get(providerId);
  if (!registration) {
    return null;
  }
  if (registration.environment === 'PRODUCTION' && environment === 'simulation') {
    return Object.freeze({
      providerId,
      environment,
      capabilities: Object.freeze({
        APPLICATION_SUPPORTED: 'UNAVAILABLE',
        FUNDING_SUPPORTED: 'UNAVAILABLE',
        CUSTODY_SUPPORTED: 'UNAVAILABLE',
        TRADING_SUPPORTED: 'UNAVAILABLE',
        WITHDRAWAL_SUPPORTED: 'UNAVAILABLE',
      }),
      overallAvailable: false,
      discoveredAt: now,
    });
  }
  const capabilities = Object.freeze({
    APPLICATION_SUPPORTED: mapLifecycleToCapability(
      registration.lifecycleState,
      registration.healthState,
      registration.credentialConfigured,
      registration.capabilities,
      'APPLICATION_SUPPORTED',
    ),
    FUNDING_SUPPORTED: mapLifecycleToCapability(
      registration.lifecycleState,
      registration.healthState,
      registration.credentialConfigured,
      registration.capabilities,
      'FUNDING_SUPPORTED',
    ),
    CUSTODY_SUPPORTED: mapLifecycleToCapability(
      registration.lifecycleState,
      registration.healthState,
      registration.credentialConfigured,
      registration.capabilities,
      'CUSTODY_SUPPORTED',
    ),
    TRADING_SUPPORTED: mapLifecycleToCapability(
      registration.lifecycleState,
      registration.healthState,
      registration.credentialConfigured,
      registration.capabilities,
      'TRADING_SUPPORTED',
    ),
    WITHDRAWAL_SUPPORTED: mapLifecycleToCapability(
      registration.lifecycleState,
      registration.healthState,
      registration.credentialConfigured,
      registration.capabilities,
      'WITHDRAWAL_SUPPORTED',
    ),
  });
  const overallAvailable = Object.values(capabilities).some(
    (state) =>
      state === 'SANDBOX_AVAILABLE' ||
      state === 'CERTIFICATION_AVAILABLE' ||
      state === 'APPLICATION_SUPPORTED' ||
      state === 'FUNDING_SUPPORTED' ||
      state === 'CUSTODY_SUPPORTED' ||
      state === 'CONFIGURED',
  );
  return Object.freeze({
    providerId,
    environment,
    capabilities,
    overallAvailable,
    discoveredAt: now,
  });
}

export function capabilityPermitsApplication(
  discovery: ProviderCapabilityDiscovery | null,
): boolean {
  if (!discovery) {
    return false;
  }
  const state = discovery.capabilities.APPLICATION_SUPPORTED;
  return (
    state === 'SANDBOX_AVAILABLE' ||
    state === 'CERTIFICATION_AVAILABLE' ||
    state === 'APPLICATION_SUPPORTED' ||
    state === 'CONFIGURED'
  );
}

export function capabilityPermitsFunding(discovery: ProviderCapabilityDiscovery | null): boolean {
  if (!discovery) {
    return false;
  }
  const state = discovery.capabilities.FUNDING_SUPPORTED;
  return (
    state === 'SANDBOX_AVAILABLE' ||
    state === 'CERTIFICATION_AVAILABLE' ||
    state === 'FUNDING_SUPPORTED' ||
    state === 'CONFIGURED'
  );
}

export function capabilityPermitsCustody(discovery: ProviderCapabilityDiscovery | null): boolean {
  if (!discovery) {
    return false;
  }
  const state = discovery.capabilities.CUSTODY_SUPPORTED;
  return (
    state === 'SANDBOX_AVAILABLE' ||
    state === 'CERTIFICATION_AVAILABLE' ||
    state === 'CUSTODY_SUPPORTED' ||
    state === 'CONFIGURED'
  );
}
