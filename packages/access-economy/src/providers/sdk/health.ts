/**
 * ACCESS Wave 2 — Extended provider health model.
 */

import type { AccessProviderId } from '../types.ts';
import type {
  AccessProviderActivationState,
  AccessProviderContractStatus,
  AccessProviderCredentialStatus,
} from './descriptor.ts';

export type AccessProviderHealthState = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

export type AccessProviderHealthSnapshot = {
  readonly providerId: AccessProviderId;
  readonly capabilities: readonly string[];
  readonly health: AccessProviderHealthState;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  readonly latencyMs: number | null;
  readonly activationState: AccessProviderActivationState;
  readonly credentialStatus: AccessProviderCredentialStatus;
  readonly contractStatus: AccessProviderContractStatus;
  readonly message: string;
  readonly checkedAt: string;
};

export function createHealthSnapshot(input: {
  readonly providerId: AccessProviderId;
  readonly capabilities: readonly string[];
  readonly health: AccessProviderHealthState;
  readonly lastSuccessAt?: string | null;
  readonly lastFailureAt?: string | null;
  readonly latencyMs?: number | null;
  readonly activationState: AccessProviderActivationState;
  readonly credentialStatus: AccessProviderCredentialStatus;
  readonly contractStatus: AccessProviderContractStatus;
  readonly message: string;
  readonly checkedAt: string;
}): AccessProviderHealthSnapshot {
  return Object.freeze({
    providerId: input.providerId,
    capabilities: Object.freeze([...input.capabilities]),
    health: input.health,
    lastSuccessAt: input.lastSuccessAt ?? null,
    lastFailureAt: input.lastFailureAt ?? null,
    latencyMs: input.latencyMs ?? null,
    activationState: input.activationState,
    credentialStatus: input.credentialStatus,
    contractStatus: input.contractStatus,
    message: input.message,
    checkedAt: input.checkedAt,
  });
}
