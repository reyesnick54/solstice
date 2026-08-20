/**
 * Rehearsal fixtures for production-candidate valuation tests.
 *
 * Every numeric value is labeled REHEARSAL_FIXTURE / NO_PRODUCTION_ECONOMIC_MEANING.
 * These numbers have no production economic meaning and are not recommended tokenomics.
 */

import { CURRENT_VALUATION_BINDINGS } from './bindings.ts';
import { configuredNumeric, createValuationPolicyCandidate, structurallyCompleteWithoutValues } from './policy.ts';
import type { HumanContributionProductionValuationPolicyCandidate, ProductionCandidateValuationInput } from './types.ts';
import { NO_PRODUCTION_ECONOMIC_MEANING, REHEARSAL_FIXTURE } from './types.ts';

export const FIXTURE_REFERENCE_DENOMINATION = 'HUMAN_CONTRIBUTION_REFERENCE_UNIT' as const;

/** Fixture base: 17 reference minor units per verified measurement. Not tokenomics. */
export const FIXTURE_BASE_VALUE = 17n;
/** Fixture verification-quality factor 4/5. Not tokenomics. */
export const FIXTURE_QUALITY_NUMERATOR = 4n;
export const FIXTURE_QUALITY_DENOMINATOR = 5n;
export const FIXTURE_FLOOR = 1n;
export const FIXTURE_CEILING = 1_000n;

export const FIXTURE_LABEL = Object.freeze({
  kind: REHEARSAL_FIXTURE,
  economicMeaning: NO_PRODUCTION_ECONOMIC_MEANING,
});

export function unconfiguredValuationPolicyCandidate(): HumanContributionProductionValuationPolicyCandidate {
  return structurallyCompleteWithoutValues({
    referenceDenomination: FIXTURE_REFERENCE_DENOMINATION,
    contributionClass: 'COMMUNITY_CONTRIBUTION',
    measurementBasis: 'COMMUNITY_CONTRIBUTION_UNIT',
    measurementUnit: 'VERIFIED_COMMUNITY_CONTRIBUTION_UNIT',
    purposeClass: 'VERIFIED_COMMUNITY_CONTRIBUTION',
    rightsPolicyReference: CURRENT_VALUATION_BINDINGS.ontology,
    verificationPolicyReference: CURRENT_VALUATION_BINDINGS.verification,
    economicAssetVerificationReference: CURRENT_VALUATION_BINDINGS.economicAsset,
    HINPolicyReference: CURRENT_VALUATION_BINDINGS.hin,
    chainAnchorPolicyReference: CURRENT_VALUATION_BINDINGS.chainAnchor,
    jurisdictionPolicyReference: CURRENT_VALUATION_BINDINGS.jurisdiction,
    governanceReference: 'sunrey.protocol.rehearsal.human-contribution-valuation.candidate.v1',
    sourceClass: 'UNCONFIGURED',
    fixture: false,
  });
}

export function rehearsalValuationPolicyCandidate(): HumanContributionProductionValuationPolicyCandidate {
  return createValuationPolicyCandidate({
    policyId: 'sunrey.human-contribution.valuation.production-candidate.rehearsal.v1',
    policyVersion: 'rehearsal-1',
    eligibleContributionClasses: ['COMMUNITY_CONTRIBUTION', 'INFORMATION_RIGHT_CONTRIBUTION'],
    eligibleMeasurementBases: ['COMMUNITY_CONTRIBUTION_UNIT', 'CONSENT_SCOPED_INFORMATION_USE'],
    eligibleMeasurementUnits: ['VERIFIED_COMMUNITY_CONTRIBUTION_UNIT', 'CONSENT_SCOPED_INFORMATION_USE'],
    referenceDenomination: FIXTURE_REFERENCE_DENOMINATION,
    baseValueSchedule: [
      {
        contributionClass: 'COMMUNITY_CONTRIBUTION',
        measurementBasis: 'COMMUNITY_CONTRIBUTION_UNIT',
        measurementUnit: 'VERIFIED_COMMUNITY_CONTRIBUTION_UNIT',
        purposeClass: 'VERIFIED_COMMUNITY_CONTRIBUTION',
        verifiedEventType: 'COMMUNITY_CONTRIBUTION_EVENT',
        jurisdictionPolicyClass: null,
        baseValue: configuredNumeric(FIXTURE_BASE_VALUE),
      },
      {
        contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
        measurementBasis: 'CONSENT_SCOPED_INFORMATION_USE',
        measurementUnit: 'CONSENT_SCOPED_INFORMATION_USE',
        purposeClass: 'CONSENT_SCOPED_INFORMATION_RIGHT_SETTLEMENT',
        verifiedEventType: 'INFORMATION_RIGHT_USAGE_EVENT',
        jurisdictionPolicyClass: null,
        baseValue: configuredNumeric(FIXTURE_BASE_VALUE),
      },
    ],
    factorPolicy: [
      {
        factor: 'VERIFICATION_QUALITY',
        multiplier: {
          kind: 'RATIONAL',
          numerator: configuredNumeric(FIXTURE_QUALITY_NUMERATOR),
          denominator: configuredNumeric(FIXTURE_QUALITY_DENOMINATOR),
        },
        roundingRule: 'FLOOR',
      },
    ],
    floorPolicy: { amount: configuredNumeric(FIXTURE_FLOOR), denomination: FIXTURE_REFERENCE_DENOMINATION },
    ceilingPolicy: { amount: configuredNumeric(FIXTURE_CEILING), denomination: FIXTURE_REFERENCE_DENOMINATION },
    rightsPolicyReference: CURRENT_VALUATION_BINDINGS.ontology,
    verificationPolicyReference: CURRENT_VALUATION_BINDINGS.verification,
    economicAssetVerificationReference: CURRENT_VALUATION_BINDINGS.economicAsset,
    HINPolicyReference: CURRENT_VALUATION_BINDINGS.hin,
    chainAnchorPolicyReference: CURRENT_VALUATION_BINDINGS.chainAnchor,
    jurisdictionPolicyReference: CURRENT_VALUATION_BINDINGS.jurisdiction,
    governanceReference: 'sunrey.protocol.rehearsal.human-contribution-valuation.candidate.v1',
    sourceClass: 'FIXTURE',
    fixture: true,
  });
}

export function fixtureVerifiedContribution(
  overlay: Partial<ProductionCandidateValuationInput> = {},
): ProductionCandidateValuationInput {
  return {
    contributionId: overlay.contributionId ?? 'hec.candidate.1',
    fingerprint: overlay.fingerprint ?? 'a'.repeat(64),
    contributionClass: overlay.contributionClass ?? 'COMMUNITY_CONTRIBUTION',
    measurementBasis: overlay.measurementBasis ?? 'COMMUNITY_CONTRIBUTION_UNIT',
    measurementUnit: overlay.measurementUnit ?? 'VERIFIED_COMMUNITY_CONTRIBUTION_UNIT',
    measurementQuantity: overlay.measurementQuantity ?? 5n,
    purposeClass: overlay.purposeClass ?? 'VERIFIED_COMMUNITY_CONTRIBUTION',
    verifiedEventType: overlay.verifiedEventType ?? 'COMMUNITY_CONTRIBUTION_EVENT',
    jurisdictionPolicyClass: overlay.jurisdictionPolicyClass ?? null,
    verificationState: overlay.verificationState ?? 'VERIFIED',
    verificationPolicyVersion: overlay.verificationPolicyVersion ?? 'sunrey-human-contribution-verification-engineering-v1',
    rightsEvidencePresent: overlay.rightsEvidencePresent ?? true,
    consentEvidencePresent: overlay.consentEvidencePresent ?? true,
    provenanceEvidencePresent: overlay.provenanceEvidencePresent ?? true,
    economicAssetVerificationState: overlay.economicAssetVerificationState ?? 'NOT_APPLICABLE',
    chainAnchored: overlay.chainAnchored ?? false,
    containsRawPersonalData: false,
    peveScoreUsedAsValue: false,
    humanWorthScore: false,
  };
}

export function fixtureInformationRightContribution(
  overlay: Partial<ProductionCandidateValuationInput> = {},
): ProductionCandidateValuationInput {
  return fixtureVerifiedContribution({
    contributionId: 'hec.candidate.info.1',
    contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    measurementBasis: 'CONSENT_SCOPED_INFORMATION_USE',
    measurementUnit: 'CONSENT_SCOPED_INFORMATION_USE',
    purposeClass: 'CONSENT_SCOPED_INFORMATION_RIGHT_SETTLEMENT',
    verifiedEventType: 'INFORMATION_RIGHT_USAGE_EVENT',
    ...overlay,
  });
}
