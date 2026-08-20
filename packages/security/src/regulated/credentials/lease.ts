import { inspect } from 'node:util';

import type { SecretProvider } from '../../secrets.ts';
import { SecretValue } from '../../redaction.ts';
import { newSecurityToken } from '../../random.ts';
import type {
  CredentialOperation,
  CredentialPlaneResult,
  CredentialProviderDomain,
  CredentialWorkload,
  ProtectedSecretHandle,
  ProviderCredentialDescriptor,
} from './types.ts';
import { authorizeCredentialBinding } from './binding.ts';
import { credentialErr, credentialOk, REDACTED } from './redaction.ts';

const LEASE_MS = 30_000;
const leases = new WeakMap<ProtectedSecretHandle, SecretValue>();

export class RegulatedSecretResolver {
  readonly #secrets: SecretProvider;

  constructor(secrets: SecretProvider) {
    this.#secrets = secrets;
  }

  resolveForWorkload(input: {
    readonly credential: ProviderCredentialDescriptor;
    readonly workload: CredentialWorkload;
    readonly providerDomain: CredentialProviderDomain;
    readonly operation: CredentialOperation;
    readonly now: string;
    readonly networkZone?: ProviderCredentialDescriptor['networkZone'];
    readonly providerId?: string;
    readonly endpointProfileRef?: string;
  }): CredentialPlaneResult<ProtectedSecretHandle> {
    const authorized = authorizeCredentialBinding({
      credential: input.credential,
      workload: input.workload,
      providerDomain: input.providerDomain,
      operation: input.operation,
      now: input.now,
      ...(input.networkZone === undefined ? {} : { networkZone: input.networkZone }),
      ...(input.providerId === undefined ? {} : { providerId: input.providerId }),
      ...(input.endpointProfileRef === undefined ? {} : { endpointProfileRef: input.endpointProfileRef }),
    });
    if (!authorized.ok) {
      return authorized;
    }
    if (input.credential.handleKind !== 'SECRET_REFERENCE' || !input.credential.credentialRef) {
      return credentialErr('SECRET_UNRESOLVED', 'HSM/KMS handles are not resolved as secret strings', {
        credentialId: input.credential.credentialId,
      });
    }
    const resolved = this.#secrets.resolve(input.credential.credentialRef);
    if (!resolved.ok) {
      return credentialErr('SECRET_UNRESOLVED', 'assigned secret is not configured', {
        providerId: input.credential.providerId,
        credentialId: input.credential.credentialId,
      });
    }
    const handle: ProtectedSecretHandle = Object.freeze({
      handleId: newSecurityToken(),
      credentialId: input.credential.credentialId,
      version: input.credential.version,
      kind: input.credential.credentialKind,
      workloadIdentity: input.credential.workloadIdentity,
      operation: input.operation,
      expiresAt: new Date(Date.parse(input.now) + LEASE_MS).toISOString(),
      rawCredentialPresent: false as const,
      toString: () => REDACTED,
      toJSON: () => REDACTED,
    });
    Object.defineProperty(handle, inspect.custom, {
      value: () => REDACTED,
      enumerable: false,
    });
    leases.set(handle, resolved.value);
    return credentialOk(handle);
  }
}

export function revealProtectedHandle(handle: ProtectedSecretHandle): SecretValue | null {
  return leases.get(handle) ?? null;
}

export function handleLooksLikeString(handle: ProtectedSecretHandle): boolean {
  return typeof handle === 'string';
}
