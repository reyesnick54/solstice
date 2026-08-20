import { secretRef, type SecretReference } from '../../../security/src/secrets.ts';
import {
  authorizeCredentialBinding,
  fixtureCustodyCredential,
  FIXTURE_NOW,
  type CredentialOperation,
  type CredentialProviderDomain,
  type ProviderCredentialDescriptor,
} from '../../../security/src/regulated/credentials/index.ts';
import {
  candidateErr,
  candidateOk,
  type CustodyCandidateResult,
  type CustodyCandidateWorkload,
} from './types.ts';

export type CustodyCredentialBinding = {
  readonly bindingId: string;
  readonly credentialDescriptorRef: string;
  readonly workload: CustodyCandidateWorkload;
  readonly secretRef: SecretReference;
  readonly credentialId: string | null;
  readonly providerDomain: CredentialProviderDomain | null;
  readonly rawCredentialPresent: false;
  readonly grantsExecutionAuthority: false;
  readonly grantsCustodyHumanApproval: false;
};

const WORKLOAD_KEY_DOMAIN: Readonly<Record<CustodyCandidateWorkload, readonly string[]>> = Object.freeze({
  custody_worker: Object.freeze(['CUSTODY_PROVIDER', 'HSM', 'KMS', 'CUSTODY_HSM', 'CUSTODY_KMS']),
  hsm_worker: Object.freeze(['HSM', 'CUSTODY_HSM', 'VALIDATOR_HSM']),
  kms_worker: Object.freeze(['KMS', 'CUSTODY_KMS']),
  validator_signer: Object.freeze(['HSM', 'VALIDATOR_HSM']),
  governance_kms: Object.freeze(['KMS', 'GOVERNANCE_KMS']),
  oracle_collector: Object.freeze(['ORACLE_DATA_SOURCE', 'ORACLE_SOURCE']),
});

export function bindCustodyCredential(input: {
  readonly bindingId: string;
  readonly credentialDescriptorRef: string;
  readonly workload: CustodyCandidateWorkload;
  readonly secretRef: SecretReference;
  readonly credential?: ProviderCredentialDescriptor;
  readonly providerDomain?: CredentialProviderDomain;
  readonly operation?: CredentialOperation;
  readonly now?: string;
}): CustodyCandidateResult<CustodyCredentialBinding> {
  if (!input.secretRef.href.startsWith('secret://') || input.credentialDescriptorRef.includes('plaintext')) {
    return candidateErr('RAW_CREDENTIAL', 'raw credential material is forbidden');
  }
  let credentialId: string | null = null;
  let providerDomain: CredentialProviderDomain | null = input.providerDomain ?? null;
  if (input.credential) {
    const authorized = authorizeCredentialBinding({
      credential: input.credential,
      workload: input.workload,
      providerDomain: input.providerDomain ?? input.credential.providerDomain,
      operation: input.operation ?? 'READ_CUSTODY_POSITION',
      now: input.now ?? FIXTURE_NOW,
    });
    if (!authorized.ok) {
      return candidateErr(authorized.error.code, authorized.error.reason);
    }
    credentialId = authorized.value.credentialId;
    providerDomain = authorized.value.providerDomain;
    if (authorized.value.rawCredentialPresent !== false || authorized.value.grantsCustodyHumanApproval !== false) {
      return candidateErr('RAW_CREDENTIAL', 'credential plane rejected raw or approval-granting material');
    }
  }
  return candidateOk(
    Object.freeze({
      bindingId: input.bindingId,
      credentialDescriptorRef: input.credentialDescriptorRef,
      workload: input.workload,
      secretRef: input.secretRef,
      credentialId,
      providerDomain,
      rawCredentialPresent: false,
      grantsExecutionAuthority: false,
      grantsCustodyHumanApproval: false,
    }),
  );
}

export function bindFixtureCustodyCredential(input: {
  readonly bindingId: string;
  readonly workload?: CustodyCandidateWorkload;
  readonly providerDomain?: CredentialProviderDomain;
  readonly operation?: CredentialOperation;
}): CustodyCandidateResult<CustodyCredentialBinding> {
  const credential = fixtureCustodyCredential();
  return bindCustodyCredential({
    bindingId: input.bindingId,
    credentialDescriptorRef: credential.credentialId,
    workload: input.workload ?? 'custody_worker',
    secretRef: credential.credentialRef ?? secretRef('simulation', 'custody/mtls-key'),
    credential,
    providerDomain: input.providerDomain ?? 'CUSTODY_PROVIDER',
    operation: input.operation ?? 'READ_CUSTODY_POSITION',
  });
}

export function assertWorkloadMayUseKey(
  workload: CustodyCandidateWorkload,
  keyDomain: string,
): CustodyCandidateResult<true> {
  const allowed = WORKLOAD_KEY_DOMAIN[workload];
  if (!allowed.includes(keyDomain)) {
    return candidateErr(
      'WORKLOAD_KEY_DENIED',
      `${workload} cannot use ${keyDomain}`,
    );
  }
  return candidateOk(true);
}

export function revokeCredentialBinding(binding: CustodyCredentialBinding): {
  readonly bindingId: string;
  readonly revoked: true;
  readonly rawCredentialPresent: false;
} {
  return Object.freeze({
    bindingId: binding.bindingId,
    revoked: true,
    rawCredentialPresent: false,
  });
}
