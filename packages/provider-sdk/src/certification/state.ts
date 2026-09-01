/**
 * Derive canonical provider lifecycle state from probe evidence.
 */

import type { ProviderLifecycleState } from './types.ts';
import type { ProviderCertificationProbeResult } from './types.ts';

const STATE_RANK: Readonly<Record<ProviderLifecycleState, number>> = Object.freeze({
  DISABLED: -2,
  DEGRADED: -1,
  CATALOGED: 0,
  SIMULATED: 1,
  CONFIGURED: 2,
  CREDENTIALS_PRESENT: 3,
  REACHABLE: 4,
  AUTHENTICATED: 5,
  RESPONSE_VALIDATED: 6,
  LIVE_VALIDATED: 7,
  PRODUCTION_QUALIFIED: 8,
});

export function deriveLifecycleState(
  probe: ProviderCertificationProbeResult,
  options: { readonly explicitlyDisabled?: boolean; readonly degraded?: boolean } = {},
): ProviderLifecycleState {
  if (options.explicitlyDisabled) {
    return 'DISABLED';
  }
  if (probe.simulated) {
    return 'SIMULATED';
  }
  if (options.degraded && probe.networkReachable) {
    return 'DEGRADED';
  }
  if (probe.productionEndpointUsed && probe.liveNetworkCallObserved && probe.responseValidated) {
    return 'PRODUCTION_QUALIFIED';
  }
  if (probe.liveNetworkCallObserved && probe.responseValidated) {
    return 'LIVE_VALIDATED';
  }
  if (probe.responseValidated) {
    return 'RESPONSE_VALIDATED';
  }
  if (probe.authenticated) {
    return 'AUTHENTICATED';
  }
  if (probe.networkReachable) {
    return 'REACHABLE';
  }
  if (probe.credentialsPresent) {
    return 'CREDENTIALS_PRESENT';
  }
  if (probe.configured) {
    return 'CONFIGURED';
  }
  return 'CATALOGED';
}

export function isAtLeastState(
  current: ProviderLifecycleState,
  required: ProviderLifecycleState,
): boolean {
  return STATE_RANK[current] >= STATE_RANK[required];
}

export function isLiveValidatedState(state: ProviderLifecycleState): boolean {
  return isAtLeastState(state, 'LIVE_VALIDATED');
}

export function catalogEntryImpliesLive(_integrationState: string | undefined): false {
  return false;
}
