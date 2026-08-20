import { secretRef, type SecretReference } from '../../../security/src/secrets.ts';
import { bindProviderAuthentication, type ProviderAuthenticationBinding } from '../../../security/src/regulated/auth.ts';
import { REGULATED_IDENTITY_WORKLOAD, type IdentityCredentialBinding } from './types.ts';
import { FIXTURE_IDENTITY_PROVIDER_ID } from './profile.ts';

const BOUND_REFS = new Map<string, string>();

export function bindIdentityProviderCredential(input: {
  readonly providerId?: string;
  readonly credentialRef?: SecretReference;
  readonly workloadIdentity: string;
}): IdentityCredentialBinding | { readonly ok: false; readonly reasonCode: 'CROSS_WORKLOAD_REUSE_REJECTED' | 'WORKLOAD_NOT_PERMITTED' } {
  if (input.workloadIdentity !== REGULATED_IDENTITY_WORKLOAD) {
    return { ok: false, reasonCode: 'WORKLOAD_NOT_PERMITTED' };
  }
  const credentialRef = input.credentialRef ?? secretRef('simulation', 'kyc-worker-credential');
  const existing = BOUND_REFS.get(credentialRef.href);
  if (existing && existing !== input.workloadIdentity) {
    return { ok: false, reasonCode: 'CROSS_WORKLOAD_REUSE_REJECTED' };
  }
  BOUND_REFS.set(credentialRef.href, input.workloadIdentity);
  return Object.freeze({
    providerId: input.providerId ?? FIXTURE_IDENTITY_PROVIDER_ID,
    credentialRef,
    credentialDescriptorRef: `cred-desc:${input.providerId ?? FIXTURE_IDENTITY_PROVIDER_ID}:${input.workloadIdentity}`,
    workloadIdentity: REGULATED_IDENTITY_WORKLOAD,
    crossWorkloadReuseRejected: true,
    plaintextCredentialPresent: false,
  });
}

export function identityAuthenticationBinding(
  binding: IdentityCredentialBinding,
): ProviderAuthenticationBinding {
  return bindProviderAuthentication({
    providerId: binding.providerId,
    method: 'API_CREDENTIAL_REFERENCE',
    credentialRef: binding.credentialRef,
    workloadIdentityRef: binding.workloadIdentity,
  });
}

export function resetIdentityCredentialBindings(): void {
  BOUND_REFS.clear();
}

export function rejectCrossWorkloadReuse(
  credentialRef: SecretReference,
  otherWorkload: string,
): { readonly ok: false; readonly reasonCode: 'CROSS_WORKLOAD_REUSE_REJECTED' } {
  BOUND_REFS.set(credentialRef.href, REGULATED_IDENTITY_WORKLOAD);
  if (otherWorkload !== REGULATED_IDENTITY_WORKLOAD) {
    return { ok: false, reasonCode: 'CROSS_WORKLOAD_REUSE_REJECTED' };
  }
  return { ok: false, reasonCode: 'CROSS_WORKLOAD_REUSE_REJECTED' };
}
