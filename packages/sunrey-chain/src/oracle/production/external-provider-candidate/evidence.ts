import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import type { EvidenceConfirmationState } from '../types.ts';
import {
  candidateRejection,
  type ExternalEvidencePlaceholder,
  type ExternalEconomicOracleProviderCandidateProfile,
  type ProviderCandidateRejection,
} from './types.ts';

export function evidenceFromReference(
  kind: ExternalEvidencePlaceholder['kind'],
  reference: string | null,
): ExternalEvidencePlaceholder {
  return Object.freeze({
    kind,
    reference,
    confirmationState: reference && reference.length > 0 ? 'REFERENCE_RECORDED' : 'NOT_PROVIDED',
  });
}

export function populatedStringIsNotProof(reference: string | null): EvidenceConfirmationState {
  return evidenceFromReference('contract', reference).confirmationState;
}

export function assertPlaceholderIsNotConfirmed(
  placeholder: ExternalEvidencePlaceholder,
): Result<true, ProviderCandidateRejection> {
  if (placeholder.confirmationState === 'CONFIRMED') {
    return err(
      candidateRejection(
        'CONTRACT_PLACEHOLDER_IS_NOT_PROOF',
        `${placeholder.kind} reference ${placeholder.reference ?? ''} is not proof`,
      ),
    );
  }
  if (placeholder.reference && placeholder.confirmationState === 'REFERENCE_RECORDED') {
    return ok(true);
  }
  return ok(true);
}

export function profileExternalEvidence(
  profile: ExternalEconomicOracleProviderCandidateProfile,
): readonly ExternalEvidencePlaceholder[] {
  return Object.freeze([
    evidenceFromReference('contract', profile.commercialAgreementEvidenceRef),
    evidenceFromReference('data_license', profile.dataLicenseEvidenceRef),
    evidenceFromReference('usage_rights', profile.usageRightsEvidenceRef),
    evidenceFromReference('security_review', profile.securityReviewEvidenceRef),
    evidenceFromReference('jurisdiction_review', profile.jurisdictionReviewEvidenceRef),
    evidenceFromReference('service_level_agreement', null),
  ]);
}

export function externalEvidencePresent(profile: ExternalEconomicOracleProviderCandidateProfile): boolean {
  return profileExternalEvidence(profile).some((row) => row.confirmationState === 'CONFIRMED');
}
