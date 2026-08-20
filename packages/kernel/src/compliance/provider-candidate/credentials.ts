import { secretRef, type SecretReference } from '../../../../security/src/secrets.ts';
import { bindProviderAuthentication, type ProviderAuthenticationBinding } from '../../../../security/src/regulated/auth.ts';
import { REGULATED_CASE_WORKLOAD, REGULATED_SCREENING_WORKLOAD, type ComplianceCredentialBinding } from './types.ts';

const BOUND_REFS = new Map<string, string>();

const PERMITTED = new Set<string>([REGULATED_SCREENING_WORKLOAD, REGULATED_CASE_WORKLOAD]);

export function bindComplianceProviderCredential(input: {
  readonly providerId: string;
  readonly credentialRef?: SecretReference;
  readonly workloadIdentity: string;
}):
  | ComplianceCredentialBinding
  | { readonly ok: false; readonly reasonCode: 'CROSS_WORKLOAD_REUSE_REJECTED' | 'WORKLOAD_NOT_PERMITTED' } {
  if (!PERMITTED.has(input.workloadIdentity)) {
    return { ok: false, reasonCode: 'WORKLOAD_NOT_PERMITTED' };
  }
  const credentialRef = input.credentialRef ?? secretRef('simulation', `${input.workloadIdentity}-credential`);
  const existing = BOUND_REFS.get(credentialRef.href);
  if (existing && existing !== input.workloadIdentity) {
    return { ok: false, reasonCode: 'CROSS_WORKLOAD_REUSE_REJECTED' };
  }
  BOUND_REFS.set(credentialRef.href, input.workloadIdentity);
  return Object.freeze({
    providerId: input.providerId,
    credentialRef,
    credentialDescriptorRef: `cred-desc:${input.providerId}:${input.workloadIdentity}`,
    workloadIdentity: input.workloadIdentity as ComplianceCredentialBinding['workloadIdentity'],
    crossWorkloadReuseRejected: true,
    plaintextCredentialPresent: false,
  });
}

export function complianceAuthenticationBinding(
  binding: ComplianceCredentialBinding,
): ProviderAuthenticationBinding {
  return bindProviderAuthentication({
    providerId: binding.providerId,
    method: 'API_CREDENTIAL_REFERENCE',
    credentialRef: binding.credentialRef,
    workloadIdentityRef: binding.workloadIdentity,
  });
}

export function resetComplianceCredentialBindings(): void {
  BOUND_REFS.clear();
}
