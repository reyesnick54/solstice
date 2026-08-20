/**
 * Rehearsal fixtures for production-candidate conversion.
 * Labeled REHEARSAL_FIXTURE / NO_PRODUCTION_ECONOMIC_MEANING.
 */

import { createHash } from 'node:crypto';

import { configuredNumeric, createConversionPolicyCandidate } from './conversion.ts';
import type { ConversionCandidateInput, PolicyVersionBinding, SunReyProductionSettlementConversionPolicyCandidate } from './types.ts';
import { NO_PRODUCTION_ECONOMIC_MEANING, REHEARSAL_FIXTURE } from './types.ts';

export const FIXTURE_CONVERSION_NUMERATOR = 3n;
export const FIXTURE_CONVERSION_DENOMINATOR = 7n;
export const FIXTURE_PER_CONTRIBUTION_CEILING = 40n;
export const FIXTURE_PER_CLASS_CEILING = 80n;
export const FIXTURE_EPOCH_CEILING = 200n;
export const FIXTURE_GLOBAL_CEILING = 400n;

export const FIXTURE_LABEL = Object.freeze({
  kind: REHEARSAL_FIXTURE,
  economicMeaning: NO_PRODUCTION_ECONOMIC_MEANING,
});

function bind(key: string, versionId: string): PolicyVersionBinding {
  return Object.freeze({
    key,
    versionId,
    contentHash: createHash('sha256').update(`SUNREY_CONVERSION_CANDIDATE_BINDING_V1:${key}:${versionId}`).digest('hex'),
  });
}

export function unconfiguredConversionPolicyCandidate(
  inputReferenceDenomination = 'HUMAN_CONTRIBUTION_REFERENCE_UNIT',
): SunReyProductionSettlementConversionPolicyCandidate {
  return createConversionPolicyCandidate({
    inputReferenceDenomination,
    jurisdictionPolicyRef: bind('jurisdictionPolicy', 'policy.sim.jurisdiction.unconfigured'),
    valuationPolicyRef: bind('valuationPolicy', 'UNCONFIGURED'),
    verificationPolicyRef: bind('verificationPolicy', 'sunrey-human-contribution-verification-engineering-v1'),
    governanceReference: 'sunrey.protocol.rehearsal.human-settlement-conversion.candidate.v1',
    sourceClass: 'UNCONFIGURED',
    fixture: false,
  });
}

export function rehearsalConversionPolicyCandidate(
  inputReferenceDenomination = 'HUMAN_CONTRIBUTION_REFERENCE_UNIT',
): SunReyProductionSettlementConversionPolicyCandidate {
  return createConversionPolicyCandidate({
    policyId: 'sunrey.human-settlement.conversion.production-candidate.rehearsal.v1',
    version: 'rehearsal-1',
    inputReferenceDenomination,
    conversionNumerator: configuredNumeric(FIXTURE_CONVERSION_NUMERATOR),
    conversionDenominator: configuredNumeric(FIXTURE_CONVERSION_DENOMINATOR),
    roundingRule: 'FLOOR',
    perContributionCeiling: configuredNumeric(FIXTURE_PER_CONTRIBUTION_CEILING),
    perContributionClassCeiling: configuredNumeric(FIXTURE_PER_CLASS_CEILING),
    perEpochCeiling: configuredNumeric(FIXTURE_EPOCH_CEILING),
    globalEpochCeiling: configuredNumeric(FIXTURE_GLOBAL_CEILING),
    jurisdictionPolicyRef: bind('jurisdictionPolicy', 'policy.sim.jurisdiction.unconfigured'),
    valuationPolicyRef: bind('valuationPolicy', 'sunrey.human-contribution.valuation.production-candidate.rehearsal.v1'),
    verificationPolicyRef: bind('verificationPolicy', 'sunrey-human-contribution-verification-engineering-v1'),
    governanceReference: 'sunrey.protocol.rehearsal.human-settlement-conversion.candidate.v1',
    sourceClass: 'FIXTURE',
    fixture: true,
  });
}

export function fixtureConversionInput(
  overlay: Partial<ConversionCandidateInput> = {},
): ConversionCandidateInput {
  return {
    contributionId: overlay.contributionId ?? 'hec.candidate.1',
    fingerprint: overlay.fingerprint ?? 'a'.repeat(64),
    contributionClass: overlay.contributionClass ?? 'COMMUNITY_CONTRIBUTION',
    valuationId: overlay.valuationId ?? 'hcv.candidate.hec.candidate.1.rehearsal-1',
    valuationPolicyId: overlay.valuationPolicyId ?? 'sunrey.human-contribution.valuation.production-candidate.rehearsal.v1',
    valuationPolicyVersion: overlay.valuationPolicyVersion ?? 'rehearsal-1',
    valuationDigest: overlay.valuationDigest ?? 'b'.repeat(64),
    referenceValue: overlay.referenceValue ?? 68n,
    referenceDenomination: overlay.referenceDenomination ?? 'HUMAN_CONTRIBUTION_REFERENCE_UNIT',
    verificationState: overlay.verificationState ?? 'VERIFIED',
    rightsEvidencePresent: overlay.rightsEvidencePresent ?? true,
    consentOnly: overlay.consentOnly ?? false,
    usageReceiptOnly: overlay.usageReceiptOnly ?? false,
    cleanRoomOnly: overlay.cleanRoomOnly ?? false,
    informationAssetOnly: overlay.informationAssetOnly ?? false,
    economicAssetVerificationState: overlay.economicAssetVerificationState ?? 'NOT_APPLICABLE',
    peveScoreUsedAsValue: false,
    humanWorthScore: false,
  };
}
