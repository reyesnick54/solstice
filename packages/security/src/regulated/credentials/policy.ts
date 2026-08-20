import { sha256Hex } from '../../hash.ts';
import type { HsmKeyHandle } from '../../hsm-kms.ts';
import type { SecretReference } from '../../secrets.ts';
import type {
  CredentialOperation,
  CredentialPlaneResult,
  CredentialProviderDomain,
  CredentialWorkload,
  ProviderCredentialDescriptor,
} from './types.ts';
import {
  CREDENTIAL_CANNOT_MINT,
  CREDENTIAL_CANNOT_POST_LEDGER,
  CREDENTIAL_EQUALS_PROVIDER_APPROVAL,
  CREDENTIAL_IS_NOT_EXECUTION_AUTHORITY,
} from './types.ts';
import { credentialErr, credentialOk } from './redaction.ts';

export type ProductionProviderModeInput = {
  readonly environment: string;
  readonly simulationMode: boolean;
  readonly liveFlags: Readonly<Record<string, boolean>>;
  readonly externalEvidenceComplete: boolean;
  readonly humanAuthorizationComplete: boolean;
  readonly requested?: 'PRODUCTION_AUTHORIZED' | string;
};

export function evaluateProductionProviderMode(
  input: ProductionProviderModeInput,
): CredentialPlaneResult<{ readonly mode: 'UNAVAILABLE'; readonly productionAuthorized: false }> {
  const liveEnabled = Object.values(input.liveFlags).some((flag) => flag === true);
  if (input.environment === 'simulation' || input.simulationMode === true || !liveEnabled) {
    return credentialErr(
      'PRODUCTION_PROVIDER_MODE_UNAVAILABLE',
      'PRODUCTION_AUTHORIZED is unavailable while ENVIRONMENT=simulation and LIVE_* remain disabled',
    );
  }
  if (!input.externalEvidenceComplete || !input.humanAuthorizationComplete) {
    return credentialErr(
      'PRODUCTION_PROVIDER_MODE_UNAVAILABLE',
      'PRODUCTION_AUTHORIZED is unavailable: external evidence and human authorization are incomplete',
    );
  }
  return credentialErr(
    'PRODUCTION_PROVIDER_MODE_UNAVAILABLE',
    'PRODUCTION_AUTHORIZED remains unavailable in the current repository',
  );
}

export function credentialCannotIssueExecutionAuthority(
  descriptor: ProviderCredentialDescriptor,
): true {
  void descriptor;
  return CREDENTIAL_IS_NOT_EXECUTION_AUTHORITY;
}

export function credentialCannotMint(descriptor: ProviderCredentialDescriptor): true {
  void descriptor;
  return CREDENTIAL_CANNOT_MINT;
}

export function credentialCannotPostLedger(descriptor: ProviderCredentialDescriptor): true {
  void descriptor;
  return CREDENTIAL_CANNOT_POST_LEDGER;
}

export function authenticationIsNotAcceptance(authenticated: boolean): {
  readonly authenticated: boolean;
  readonly providerApproved: false;
} {
  return Object.freeze({
    authenticated,
    providerApproved: CREDENTIAL_EQUALS_PROVIDER_APPROVAL,
  });
}

export function configurationFingerprint(input: {
  readonly providerId: string;
  readonly domain: CredentialProviderDomain;
  readonly workloadIdentity: CredentialWorkload;
  readonly credentialVersion: number;
  readonly operations: readonly CredentialOperation[];
  readonly endpointProfileRef: string;
  readonly networkZone: string;
  readonly configurationVersion: string;
  readonly secretValue?: string;
}): string {
  const canonical = JSON.stringify({
    providerId: input.providerId,
    domain: input.domain,
    workloadIdentity: input.workloadIdentity,
    credentialVersion: input.credentialVersion,
    operations: [...input.operations].sort(),
    endpointProfileRef: input.endpointProfileRef,
    networkZone: input.networkZone,
    configurationVersion: input.configurationVersion,
  });
  const digest = sha256Hex(canonical);
  if (input.secretValue && digest.includes(input.secretValue)) {
    throw new Error('configuration fingerprint must not contain secret material');
  }
  return digest;
}

export function replaceProviderCredential(input: {
  readonly from: ProviderCredentialDescriptor;
  readonly toProviderId: string;
  readonly toDomain: CredentialProviderDomain;
  readonly toHref?: string;
  readonly toHandle?: HsmKeyHandle;
}): CredentialPlaneResult<{
  readonly newProviderId: string;
  readonly reusedBinding: false;
  readonly requiresNewEvidence: true;
}> {
  if (input.from.providerId === input.toProviderId && input.from.providerDomain === input.toDomain) {
    return credentialErr('CREDENTIAL_DOMAIN_MISMATCH', 'replacement requires a different provider profile');
  }
  if (input.toHref && input.from.credentialRef?.href === input.toHref) {
    return credentialErr('CREDENTIAL_SCOPE_MISMATCH', 'provider B cannot reuse provider A credential binding');
  }
  return credentialOk(
    Object.freeze({
      newProviderId: input.toProviderId,
      reusedBinding: false as const,
      requiresNewEvidence: true as const,
    }),
  );
}

export function hsmHandleIsNotSecretReference(handle: HsmKeyHandle): {
  readonly exportable: false;
  readonly isSecretReference: false;
} {
  return Object.freeze({
    exportable: handle.exportable,
    isSecretReference: false as const,
  });
}

export function secretReferenceIsNotHsmHandle(reference: SecretReference): {
  readonly isHsmHandle: false;
  readonly scheme: 'secret';
} {
  return Object.freeze({
    isHsmHandle: false as const,
    scheme: reference.scheme,
  });
}
