/**
 * Privacy-safe candidate and HumanEconomicEvidence construction.
 *
 * A candidate without settlement authorization is informational only.
 * It cannot mint.
 */

import { evidenceHash, privacySafeHumanEvidence } from '../issuance.ts';
import type { HumanEconomicEvidence } from '../types.ts';
import { firewallRejection, isSha256Hex } from './firewall.ts';
import { isEngineValuationAuthorization } from './authorization.ts';
import { isMonetaryContributionClass, mapContributionClassToPurposeClass } from './mapping.ts';
import type {
  BridgeRejection,
  HumanContributionMonetaryEvidenceCandidate,
  HumanContributionSettlementAuthorization,
  VerifiedHumanEconomicContribution,
} from './types.ts';

function isEngineAuthorization(
  authorization?: HumanContributionSettlementAuthorization,
): authorization is Extract<HumanContributionSettlementAuthorization, { valuationPath: 'ENGINE_VALUATION_SIMULATION' }> {
  return authorization !== undefined && isEngineValuationAuthorization(authorization);
}

export function validateVerifiedContribution(
  contribution: VerifiedHumanEconomicContribution,
): BridgeRejection | null {
  const poisoned = firewallRejection(contribution);
  if (poisoned) {
    return poisoned;
  }
  if (!isMonetaryContributionClass(contribution.contributionClass)) {
    return 'INELIGIBLE_CONTRIBUTION_CLASS';
  }
  if (!contribution.contributionId || !contribution.fingerprint) {
    return 'INVALID_CONTRIBUTION';
  }
  if (!contribution.verificationPolicyVersion || !isSha256Hex(contribution.verificationEvidenceDigest)) {
    return 'INVALID_CONTRIBUTION';
  }
  if (contribution.verificationState !== 'VERIFIED' && contribution.verificationState !== 'SUPERSEDED') {
    return 'INVALID_CONTRIBUTION';
  }
  if (contribution.containsRawPersonalData || contribution.pdvSourceExposed || contribution.cleanRoomSourceExposed) {
    return 'RAW_PERSONAL_DATA_REJECTED';
  }
  if (contribution.humanWorthScore) {
    return 'HUMAN_WORTH_SCORE_REJECTED';
  }
  if (contribution.peveScoreUsedAsQuantity) {
    return 'PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY';
  }
  return null;
}

export function toMonetaryEvidenceCandidate(
  contribution: VerifiedHumanEconomicContribution,
  authorization?: HumanContributionSettlementAuthorization,
):
  | { readonly ok: true; readonly candidate: HumanContributionMonetaryEvidenceCandidate }
  | { readonly ok: false; readonly code: BridgeRejection } {
  const invalid = validateVerifiedContribution(contribution);
  if (invalid) {
    return { ok: false, code: invalid };
  }
  const purposeClass = mapContributionClassToPurposeClass(contribution.contributionClass);
  const evidenceHashInput = [
    contribution.contributionId,
    contribution.fingerprint,
    contribution.contributionClass,
    contribution.verificationPolicyVersion,
    contribution.verificationEvidenceDigest,
    contribution.measurementBasis,
    contribution.measurementUnit,
    contribution.measurementPeriod,
    purposeClass,
    contribution.jurisdictionPolicyRef,
    authorization?.authorizationId ?? '',
    authorization?.valuationPolicyRef ?? '',
    authorization?.valuationVersion ?? '',
    authorization?.authorizedSunReyQuantity.toString() ?? '',
    isEngineAuthorization(authorization) ? authorization.valuationId : '',
    isEngineAuthorization(authorization) ? authorization.valuationDigest : '',
    isEngineAuthorization(authorization) ? authorization.conversionPolicyVersion : '',
    isEngineAuthorization(authorization) ? authorization.referenceValue.toString() : '',
  ].join(':');
  return {
    ok: true,
    candidate: Object.freeze({
      contributionId: contribution.contributionId,
      fingerprint: contribution.fingerprint,
      contributionClass: contribution.contributionClass,
      verificationPolicyVersion: contribution.verificationPolicyVersion,
      verificationEvidenceDigest: contribution.verificationEvidenceDigest,
      measurementBasis: contribution.measurementBasis,
      measurementUnit: contribution.measurementUnit,
      measurementPeriod: contribution.measurementPeriod,
      purposeClass,
      jurisdictionPolicyRef: contribution.jurisdictionPolicyRef,
      settlementAuthorizationRef: authorization?.authorizationId ?? null,
      valuationPolicyRef: authorization?.valuationPolicyRef ?? null,
      valuationVersion: authorization?.valuationVersion ?? null,
      quantityBasis: authorization?.authorizedQuantityBasis ?? null,
      evidenceHash: evidenceHash(evidenceHashInput),
      mappingIsIssuanceAuthorization: false,
      containsRawPersonalData: false,
      pdvSourceExposed: false,
      cleanRoomSourceExposed: false,
    }),
  };
}

export function toHumanEconomicEvidence(
  contribution: VerifiedHumanEconomicContribution,
  authorization: HumanContributionSettlementAuthorization,
): { readonly ok: true; readonly evidence: HumanEconomicEvidence } | { readonly ok: false; readonly code: BridgeRejection } {
  const candidate = toMonetaryEvidenceCandidate(contribution, authorization);
  if (!candidate.ok) {
    return candidate;
  }
  try {
    const evidence = privacySafeHumanEvidence({
      evidenceId: `hev.${contribution.contributionId}.${authorization.authorizationId}`,
      policyVersion: contribution.verificationPolicyVersion,
      authorizationId: authorization.authorizationId,
      contentHash: candidate.candidate.evidenceHash,
      quantityBasis: authorization.authorizedQuantityBasis,
      purposeClass: candidate.candidate.purposeClass,
      contributionId: contribution.contributionId,
      fingerprint: contribution.fingerprint,
      verificationPolicyVersion: contribution.verificationPolicyVersion,
      settlementAuthorizationRef: authorization.authorizationId,
      valuationPolicyRef: authorization.valuationPolicyRef,
      valuationVersion: authorization.valuationVersion,
      ...(isEngineAuthorization(authorization)
        ? {
            valuationId: authorization.valuationId,
            valuationDigest: authorization.valuationDigest,
            conversionPolicyRef: authorization.conversionPolicyRef,
            conversionPolicyVersion: authorization.conversionPolicyVersion,
            referenceValue: authorization.referenceValue,
            referenceDenomination: authorization.referenceDenomination,
          }
        : {}),
    });
    return { ok: true, evidence };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('personal') || message.includes('protected')) {
      return { ok: false, code: 'RAW_PERSONAL_DATA_REJECTED' };
    }
    return { ok: false, code: 'INVALID_CONTRIBUTION' };
  }
}
