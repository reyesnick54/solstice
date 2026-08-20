import { revokeCredentialBinding, type CustodyCredentialBinding } from './auth.ts';
import { markKmsCompromised } from './kms.ts';
import { candidateOk, type CustodyCandidateResult } from './types.ts';

export type CustodyCompromiseOutcome = {
  readonly signingDisabled: true;
  readonly historyRewritten: false;
  readonly credentialRevoked: true;
  readonly keyHandleDisabled: true;
  readonly providerSigningRouteSuspended: true;
  readonly investigationState: 'RECOVERY_REQUIRED';
  readonly autoTransferredCustomerFunds: false;
};

export function applyProviderCompromise(input: {
  readonly keyId: string;
  readonly binding: CustodyCredentialBinding;
}): CustodyCandidateResult<CustodyCompromiseOutcome> {
  markKmsCompromised(input.keyId);
  revokeCredentialBinding(input.binding);
  return candidateOk(
    Object.freeze({
      signingDisabled: true,
      historyRewritten: false,
      credentialRevoked: true,
      keyHandleDisabled: true,
      providerSigningRouteSuspended: true,
      investigationState: 'RECOVERY_REQUIRED',
      autoTransferredCustomerFunds: false,
    }),
  );
}
