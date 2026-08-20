/**
 * Provider-runtime binding to the Chunk 149 credential plane.
 * A secret reference alone does not open a privileged session.
 */

import {
  authorizeCredentialBinding,
  configurationFingerprint,
  type CredentialOperation,
  type ProviderCredentialDescriptor,
} from '../../../security/src/regulated/credentials/index.ts';
import type { ProviderDomain } from '../providers/types.ts';
import { openProviderSession } from './core.ts';
import {
  runtimeErr,
  runtimeOk,
  type ProviderRuntimeMode,
  type ProviderRuntimeResult,
  type ProviderSession,
  type WorkloadIdentity,
} from './types.ts';

export function openBoundProviderSession(input: {
  readonly sessionId: string;
  readonly credential: ProviderCredentialDescriptor;
  readonly workload: WorkloadIdentity;
  readonly domain: ProviderDomain;
  readonly operation: CredentialOperation;
  readonly environment: ProviderRuntimeMode;
  readonly configuration: unknown;
  readonly now: string;
  readonly endpointProfileRef?: string;
}): ProviderRuntimeResult<ProviderSession> {
  const authorized = authorizeCredentialBinding({
    credential: input.credential,
    workload: input.workload,
    providerDomain: input.domain,
    operation: input.operation,
    now: input.now,
    providerId: input.credential.providerId,
    ...(input.endpointProfileRef === undefined ? {} : { endpointProfileRef: input.endpointProfileRef }),
  });
  if (!authorized.ok) {
    return runtimeErr(authorized.error.code, authorized.error.reason);
  }
  const configurationHash = configurationFingerprint({
    providerId: input.credential.providerId,
    domain: input.credential.providerDomain,
    workloadIdentity: input.credential.workloadIdentity,
    credentialVersion: input.credential.version,
    operations: input.credential.allowedOperations,
    endpointProfileRef: input.credential.endpointProfileRef,
    networkZone: input.credential.networkZone,
    configurationVersion: 'provider-runtime/1',
  });
  return openProviderSession({
    sessionId: input.sessionId,
    providerId: input.credential.providerId,
    domain: input.domain,
    environment: input.environment,
    credentialRef: input.credential.credentialRef,
    workloadIdentity: input.workload,
    capabilities: [input.operation],
    configuration: { ...(input.configuration as object), configurationHash },
  });
}

export function secretReferenceAloneIsInsufficient(): false {
  return false;
}
