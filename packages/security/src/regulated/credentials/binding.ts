import type {
  CredentialNetworkZone,
  CredentialOperation,
  CredentialPlaneResult,
  CredentialProviderDomain,
  CredentialWorkload,
  ProviderCredentialDescriptor,
} from './types.ts';
import { CROSS_DOMAIN_REUSE_ALLOWED, CROSS_WORKLOAD_REUSE_ALLOWED } from './types.ts';
import { credentialErr, credentialOk } from './redaction.ts';
import { evaluateCredentialValidity } from './validation.ts';

export function authorizeCredentialBinding(input: {
  readonly credential: ProviderCredentialDescriptor;
  readonly workload: CredentialWorkload;
  readonly providerDomain: CredentialProviderDomain;
  readonly operation: CredentialOperation;
  readonly networkZone?: CredentialNetworkZone;
  readonly providerId?: string;
  readonly endpointProfileRef?: string;
  readonly now: string;
}): CredentialPlaneResult<ProviderCredentialDescriptor> {
  const validity = evaluateCredentialValidity(input.credential, input.now);
  if (!validity.ok) {
    return validity;
  }
  if (input.credential.workloadIdentity !== input.workload) {
    return credentialErr(
      'CREDENTIAL_WORKLOAD_MISMATCH',
      `${input.credential.workloadIdentity} credential cannot be used by ${input.workload}`,
      { providerId: input.credential.providerId, credentialId: input.credential.credentialId },
    );
  }
  if (CROSS_WORKLOAD_REUSE_ALLOWED) {
    return credentialErr('CREDENTIAL_WORKLOAD_MISMATCH', 'cross-workload reuse is forbidden');
  }
  if (
    input.credential.providerDomain !== input.providerDomain ||
    !input.credential.allowedProviderDomains.includes(input.providerDomain)
  ) {
    return credentialErr(
      'CREDENTIAL_DOMAIN_MISMATCH',
      `${input.credential.providerDomain} credential cannot be reused for ${input.providerDomain}`,
      { providerId: input.credential.providerId, credentialId: input.credential.credentialId },
    );
  }
  if (CROSS_DOMAIN_REUSE_ALLOWED) {
    return credentialErr('CREDENTIAL_DOMAIN_MISMATCH', 'automatic cross-domain reuse is forbidden');
  }
  if (!input.credential.allowedOperations.includes(input.operation)) {
    return credentialErr(
      'CREDENTIAL_SCOPE_MISMATCH',
      `operation ${input.operation} is not permitted`,
      { providerId: input.credential.providerId, credentialId: input.credential.credentialId },
    );
  }
  if (input.networkZone && input.credential.networkZone !== input.networkZone) {
    return credentialErr(
      'CREDENTIAL_ENDPOINT_MISMATCH',
      'credential network zone does not match the requested zone',
      { providerId: input.credential.providerId, credentialId: input.credential.credentialId },
    );
  }
  if (input.providerId && input.credential.providerId !== input.providerId) {
    return credentialErr(
      'CREDENTIAL_DOMAIN_MISMATCH',
      'credential is bound to a different provider',
      { providerId: input.credential.providerId, credentialId: input.credential.credentialId },
    );
  }
  if (input.endpointProfileRef && input.credential.endpointProfileRef !== input.endpointProfileRef) {
    return credentialErr(
      'CREDENTIAL_ENDPOINT_MISMATCH',
      'credential cannot be used at an unbound endpoint profile',
      { providerId: input.credential.providerId, credentialId: input.credential.credentialId },
    );
  }
  return credentialOk(input.credential);
}
