import { parseSecretReference, type SecretReference } from '../../secrets.ts';
import { sha256Hex } from '../../hash.ts';
import type { HsmKeyHandle } from '../../hsm-kms.ts';
import {
  CREDENTIAL_KINDS,
  CREDENTIAL_OPERATIONS,
  CREDENTIAL_PROVIDER_DOMAINS,
  CREDENTIAL_WORKLOADS,
  type CredentialHandleKind,
  type CredentialKind,
  type CredentialNetworkZone,
  type CredentialOperation,
  type CredentialPlaneResult,
  type CredentialProviderDomain,
  type CredentialStatus,
  type CredentialWorkload,
  type ProviderCredentialDescriptor,
  type SecretVersionMetadata,
} from './types.ts';
import { credentialErr, credentialOk, hideSecretPath } from './redaction.ts';

const PLAINTEXT_MARKERS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /bearer\s+[a-z0-9._-]{8,}/i,
  /client_secret\s*[:=]/i,
  /api[_-]?key\s*[:=]\s*['"]?[a-z0-9]{12,}/i,
];

export function looksLikePlaintextCredential(value: string): boolean {
  return PLAINTEXT_MARKERS.some((pattern) => pattern.test(value));
}

export function isHandleKind(kind: CredentialKind): CredentialHandleKind {
  if (kind === 'HSM_KEY_HANDLE_REFERENCE' || kind === 'REQUEST_SIGNING_KEY_HANDLE') {
    return 'HSM_KEY_HANDLE';
  }
  if (kind === 'KMS_KEY_HANDLE_REFERENCE') {
    return 'KMS_KEY_HANDLE';
  }
  return 'SECRET_REFERENCE';
}

export function referenceHash(reference: SecretReference): string {
  return sha256Hex(`ref:${reference.provider}:${reference.path}`);
}

export function createProviderCredentialDescriptor(input: {
  readonly credentialId: string;
  readonly providerId: string;
  readonly providerDomain: CredentialProviderDomain;
  readonly credentialKind: CredentialKind;
  readonly credentialHref?: string;
  readonly keyHandle?: HsmKeyHandle;
  readonly workloadIdentity: CredentialWorkload;
  readonly allowedProviderDomains?: readonly CredentialProviderDomain[];
  readonly allowedOperations: readonly CredentialOperation[];
  readonly networkZone: CredentialNetworkZone;
  readonly endpointProfileRef: string;
  readonly version?: number;
  readonly rotationGeneration?: number;
  readonly issuedAt: string;
  readonly notBefore: string;
  readonly expiresAt: string;
  readonly status?: CredentialStatus;
}): CredentialPlaneResult<ProviderCredentialDescriptor> {
  if (!(CREDENTIAL_KINDS as readonly string[]).includes(input.credentialKind)) {
    return credentialErr('INVALID_SECRET_REFERENCE', 'unknown credential kind', {
      credentialId: input.credentialId,
    });
  }
  if (!(CREDENTIAL_WORKLOADS as readonly string[]).includes(input.workloadIdentity)) {
    return credentialErr('CREDENTIAL_WORKLOAD_MISMATCH', 'unknown workload identity', {
      credentialId: input.credentialId,
    });
  }
  if (!(CREDENTIAL_PROVIDER_DOMAINS as readonly string[]).includes(input.providerDomain)) {
    return credentialErr('CREDENTIAL_DOMAIN_MISMATCH', 'unknown provider domain', {
      credentialId: input.credentialId,
    });
  }
  if (input.allowedOperations.length === 0) {
    return credentialErr('CREDENTIAL_SCOPE_MISMATCH', 'wildcard authority is not granted by default', {
      credentialId: input.credentialId,
    });
  }
  if (input.allowedOperations.some((operation) => !(CREDENTIAL_OPERATIONS as readonly string[]).includes(operation))) {
    return credentialErr('CREDENTIAL_SCOPE_MISMATCH', 'unknown credential operation', {
      credentialId: input.credentialId,
    });
  }
  if (input.allowedOperations.includes('*' as CredentialOperation)) {
    return credentialErr('CREDENTIAL_SCOPE_MISMATCH', 'wildcard operations are forbidden', {
      credentialId: input.credentialId,
    });
  }
  if (!input.endpointProfileRef || input.endpointProfileRef.startsWith('http://') || input.endpointProfileRef.startsWith('https://')) {
    return credentialErr('CREDENTIAL_ENDPOINT_MISMATCH', 'endpoint must be a profile reference, not a raw URL', {
      credentialId: input.credentialId,
    });
  }

  const handleKind = isHandleKind(input.credentialKind);
  let credentialRef: SecretReference | null = null;
  let keyHandle: HsmKeyHandle | null = null;

  if (handleKind === 'SECRET_REFERENCE') {
    if (!input.credentialHref) {
      return credentialErr('INVALID_SECRET_REFERENCE', 'secret reference is required', {
        credentialId: input.credentialId,
      });
    }
    if (looksLikePlaintextCredential(input.credentialHref)) {
      return credentialErr('CREDENTIAL_PLAINTEXT_REJECTED', 'plaintext credential rejected', {
        credentialId: input.credentialId,
      });
    }
    const parsed = parseSecretReference(input.credentialHref);
    if (!parsed.ok) {
      return credentialErr('INVALID_SECRET_REFERENCE', parsed.error.message, {
        credentialId: input.credentialId,
      });
    }
    if (parsed.value.provider !== 'simulation' && parsed.value.provider !== 'fixture') {
      return credentialErr(
        'INVALID_SECRET_REFERENCE',
        'only secret://simulation and secret://fixture references are admitted in this plane',
        { credentialId: input.credentialId },
      );
    }
    credentialRef = parsed.value;
  } else {
    if (!input.keyHandle) {
      return credentialErr('INVALID_SECRET_REFERENCE', 'HSM/KMS handle is required', {
        credentialId: input.credentialId,
      });
    }
    if (input.keyHandle.exportable !== false) {
      return credentialErr('CREDENTIAL_PLAINTEXT_REJECTED', 'exportable key handle rejected', {
        credentialId: input.credentialId,
      });
    }
    keyHandle = input.keyHandle;
  }

  const allowedProviderDomains = Object.freeze(
    input.allowedProviderDomains ? [...input.allowedProviderDomains] : [input.providerDomain],
  );
  if (!allowedProviderDomains.includes(input.providerDomain)) {
    return credentialErr('CREDENTIAL_DOMAIN_MISMATCH', 'home domain must be independently bound', {
      credentialId: input.credentialId,
    });
  }

  return credentialOk(
    Object.freeze({
      credentialId: input.credentialId,
      providerId: input.providerId,
      providerDomain: input.providerDomain,
      credentialKind: input.credentialKind,
      credentialRef,
      keyHandle,
      handleKind,
      workloadIdentity: input.workloadIdentity,
      allowedProviderDomains,
      allowedOperations: Object.freeze([...input.allowedOperations]),
      networkZone: input.networkZone,
      endpointProfileRef: input.endpointProfileRef,
      version: input.version ?? 1,
      rotationGeneration: input.rotationGeneration ?? 1,
      issuedAt: input.issuedAt,
      notBefore: input.notBefore,
      expiresAt: input.expiresAt,
      status: input.status ?? 'ACTIVE',
      leastPrivilege: true as const,
      rawCredentialPresent: false as const,
      privateKeyPresent: false as const,
      grantsExecutionAuthority: false as const,
      grantsLedgerPosting: false as const,
      grantsMintAuthority: false as const,
      grantsGovernanceAuthority: false as const,
      grantsCustodyHumanApproval: false as const,
      equalsProviderApproval: false as const,
    }),
  );
}

export function secretVersionMetadata(descriptor: ProviderCredentialDescriptor): SecretVersionMetadata {
  const referenceHashValue = descriptor.credentialRef
    ? referenceHash(descriptor.credentialRef)
    : `handle:${descriptor.keyHandle?.handleId ?? 'none'}`;
  return Object.freeze({
    referenceHash: sha256Hex(referenceHashValue),
    provider: descriptor.credentialRef?.provider ?? descriptor.keyHandle?.providerId ?? descriptor.providerId,
    credentialId: descriptor.credentialId,
    version: descriptor.version,
    createdAt: descriptor.issuedAt,
    notBefore: descriptor.notBefore,
    expiresAt: descriptor.expiresAt,
    rotationGeneration: descriptor.rotationGeneration,
    status: descriptor.status,
    pathHidden: true as const,
    valuePresent: false as const,
  });
}

export function descriptorExposesPath(metadata: SecretVersionMetadata): boolean {
  return JSON.stringify(metadata).includes('secret://') || metadata.pathHidden !== true;
}

export function hiddenReference(descriptor: ProviderCredentialDescriptor): string {
  if (!descriptor.credentialRef) {
    return `handle://${descriptor.handleKind}/[REDACTED]`;
  }
  return hideSecretPath(descriptor.credentialRef.href);
}
