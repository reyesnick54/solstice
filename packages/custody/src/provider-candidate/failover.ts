import { candidateErr, candidateOk, type CustodyCandidateResult, type CustodyProviderCandidateProfile } from './types.ts';

export type CustodyProviderFailoverPlan = {
  readonly fromProviderId: string;
  readonly toProviderId: string;
  readonly newProviderAcceptance: true;
  readonly newCredential: true;
  readonly newSigningPolicyOrMigrationEvidence: true;
  readonly addressMappingPolicy: true;
  readonly reconciliationRequired: true;
  readonly silentMoveForbidden: true;
};

export function planCustodyProviderFailover(
  from: CustodyProviderCandidateProfile,
  to: CustodyProviderCandidateProfile,
): CustodyCandidateResult<CustodyProviderFailoverPlan> {
  if (from.providerId === to.providerId) {
    return candidateErr('SAME_PROVIDER', 'failover requires a distinct accepted provider');
  }
  if (to.productionAuthorized !== false) {
    return candidateErr('PRODUCTION_FORBIDDEN', 'failover cannot activate production');
  }
  return candidateOk(
    Object.freeze({
      fromProviderId: from.providerId,
      toProviderId: to.providerId,
      newProviderAcceptance: true,
      newCredential: true,
      newSigningPolicyOrMigrationEvidence: true,
      addressMappingPolicy: true,
      reconciliationRequired: true,
      silentMoveForbidden: true,
    }),
  );
}

export function silentlyMoveProviderControl(): CustodyCandidateResult<never> {
  return candidateErr('SILENT_FAILOVER_FORBIDDEN', 'control must not move silently from one provider to another');
}
