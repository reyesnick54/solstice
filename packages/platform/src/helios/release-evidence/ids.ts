/**
 * HELIOS H36 — release evidence and live-pilot gate identifiers.
 */

export type HeliosReleaseId = string & { readonly __brand: 'HeliosReleaseId' };
export type LivePilotScopeId = string & { readonly __brand: 'LivePilotScopeId' };
export type LivePilotAuthorizationId = string & { readonly __brand: 'LivePilotAuthorizationId' };
export type ExternalGateItemId = string & { readonly __brand: 'ExternalGateItemId' };

export function asHeliosReleaseId(value: string): HeliosReleaseId {
  if (!value.startsWith('helios-release:')) {
    throw new TypeError('HeliosReleaseId must start with helios-release:');
  }
  return value as HeliosReleaseId;
}

export function asLivePilotScopeId(value: string): LivePilotScopeId {
  if (!value.startsWith('live-pilot-scope:')) {
    throw new TypeError('LivePilotScopeId must start with live-pilot-scope:');
  }
  return value as LivePilotScopeId;
}

export function asLivePilotAuthorizationId(value: string): LivePilotAuthorizationId {
  if (!value.startsWith('live-pilot-auth:')) {
    throw new TypeError('LivePilotAuthorizationId must start with live-pilot-auth:');
  }
  return value as LivePilotAuthorizationId;
}

export function asExternalGateItemId(value: string): ExternalGateItemId {
  if (!value.startsWith('gate-item:')) {
    throw new TypeError('ExternalGateItemId must start with gate-item:');
  }
  return value as ExternalGateItemId;
}

export function heliosReleaseIdFor(seed: string): HeliosReleaseId {
  return asHeliosReleaseId(`helios-release:${seed}`);
}

export function livePilotScopeIdFor(seed: string): LivePilotScopeId {
  return asLivePilotScopeId(`live-pilot-scope:${seed}`);
}

export function livePilotAuthorizationIdFor(seed: string): LivePilotAuthorizationId {
  return asLivePilotAuthorizationId(`live-pilot-auth:${seed}`);
}

export function externalGateItemIdFor(gateClass: string, itemKey: string): ExternalGateItemId {
  return asExternalGateItemId(`gate-item:${gateClass}:${itemKey}`);
}
