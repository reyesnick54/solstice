/**
 * Chunk 145 — production-candidate human contribution valuation policy.
 *
 * Candidate policies only. This module does not activate the production
 * valuation engine, choose production numeric values, or mint SunRey.
 *
 * Canonical owner remains packages/human-economic-contribution/src/valuation.
 */

import type { ContributionClass, MeasurementUnit } from '../../taxonomy.ts';

export const PRODUCTION_CANDIDATE_VALUATION_SCHEMA_VERSION = 1 as const;
export const PRODUCTION_CANDIDATE_VALUATION_ID =
  'sunrey.human-contribution.valuation.production-candidate.v1' as const;
export const PRODUCTION_CANDIDATE_VALUATION_POLICY_VERSION = '1' as const;

export const PRODUCTION_VALUATION_ENGINE_ACTIVATED = false as const;
export const REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION = false as const;
export const VALUATION_IS_HUMAN_WORTH = false as const;
export const PEVE_USED_AS_TOKEN_FORMULA = false as const;
export const PRODUCTION_VALUES_GOVERNED = false as const;
export const FIXTURE_AUTHORIZES_PRODUCTION = false as const;

export const REHEARSAL_FIXTURE = 'REHEARSAL_FIXTURE' as const;
export const NO_PRODUCTION_ECONOMIC_MEANING = 'NO_PRODUCTION_ECONOMIC_MEANING' as const;

export const POLICY_COMPLETENESS = ['STRUCTURALLY_COMPLETE', 'VALUES_UNCONFIGURED'] as const;
export type PolicyCompleteness = (typeof POLICY_COMPLETENESS)[number];

export const POLICY_SOURCE_CLASSES = [
  'UNCONFIGURED',
  'FIXTURE',
  'REHEARSAL',
  'GOVERNED_PRODUCTION_PARAMETER',
] as const;
export type PolicySourceClass = (typeof POLICY_SOURCE_CLASSES)[number];

export const MEASUREMENT_BASES = [
  'VERIFIED_MEASUREMENT_QUANTITY',
  'CONSENT_SCOPED_INFORMATION_USE',
  'VERIFIED_SERVICE_DELIVERY',
  'VERIFIED_RESEARCH_SESSION',
  'APPROVED_CREATIVE_ASSET',
  'VERIFIED_PROFESSIONAL_HOUR',
  'CONTRACTUAL_COMPENSATION_UNIT',
  'ROYALTY_EVENT_UNIT',
  'COMMUNITY_CONTRIBUTION_UNIT',
  'MODEL_TRAINING_PARTICIPATION_UNIT',
  'EDUCATION_SKILL_ATTESTATION_UNIT',
  'ENTREPRENEURIAL_ACTIVITY_UNIT',
  'ECONOMIC_PARTICIPATION_UNIT',
  'VERIFIED_KNOWLEDGE_UNIT',
] as const;
export type MeasurementBasis = (typeof MEASUREMENT_BASES)[number];

export const PURPOSE_CLASSES = [
  'CONSENT_SCOPED_INFORMATION_RIGHT_SETTLEMENT',
  'VERIFIED_HUMAN_ECONOMIC_CONTRIBUTION',
  'VERIFIED_COMMUNITY_CONTRIBUTION',
  'AUTHORIZED_ECONOMIC_PARTICIPATION_EVENT',
] as const;
export type PurposeClass = (typeof PURPOSE_CLASSES)[number];

export const VERIFIED_EVENT_TYPES = [
  'VERIFIED_CONTRIBUTION_EVENT',
  'INFORMATION_RIGHT_USAGE_EVENT',
  'RESEARCH_PARTICIPATION_EVENT',
  'PROFESSIONAL_SERVICE_EVENT',
  'CREATIVE_ROYALTY_EVENT',
  'COMMUNITY_CONTRIBUTION_EVENT',
] as const;
export type VerifiedEventType = (typeof VERIFIED_EVENT_TYPES)[number];

export const FORBIDDEN_SCHEDULE_DIMENSIONS = [
  'race',
  'religion',
  'ethnicity',
  'sex',
  'sexualOrientation',
  'sexual_orientation',
  'healthCondition',
  'health_condition',
  'medicalCondition',
  'politicalAffiliation',
  'political_affiliation',
  'creditScore',
  'wealthRank',
  'socialRank',
  'humanQuality',
  'desirability',
  'protectedTraitProxy',
] as const;

export const FORBIDDEN_PERSON_LEVEL_MULTIPLIERS = [
  'CELEBRITY_MULTIPLIER',
  'INCOME_MULTIPLIER',
  'NET_WORTH_MULTIPLIER',
  'FOLLOWER_COUNT_SOCIAL_RANK',
  'CITIZENSHIP_DESIRABILITY_MULTIPLIER',
  'CREDITWORTHINESS_MULTIPLIER',
  'PERSONAL_PRESTIGE_MULTIPLIER',
] as const;
export type ForbiddenPersonLevelMultiplier = (typeof FORBIDDEN_PERSON_LEVEL_MULTIPLIERS)[number];

export const AI_VALUATION_BOUNDARY = Object.freeze({
  mayExplainCandidatePolicy: true,
  maySimulateOutcomes: true,
  mayIdentifyMissingData: true,
  mayCompareVersions: true,
  mayChooseFinalProductionValues: false,
  mayActivateValuationPolicy: false,
  mayAuthorizeSettlement: false,
  mayAuthorizeIssuance: false,
});

export type UnconfiguredNumeric = {
  readonly status: 'UNCONFIGURED';
  readonly value: null;
};

export type ConfiguredNumeric = {
  readonly status: 'CONFIGURED';
  readonly value: bigint;
};

export type NumericPolicyValue = UnconfiguredNumeric | ConfiguredNumeric;

export type PolicyVersionBinding = {
  readonly key: string;
  readonly versionId: string;
  readonly contentHash: string;
};

export type FloorCeilingPolicy = {
  readonly amount: NumericPolicyValue;
  readonly denomination: string | null;
};

/** Structural schedule row. Numeric `baseValue` may be UNCONFIGURED. */
export type BaseValueScheduleEntryRef = {
  readonly contributionClass: ContributionClass;
  readonly measurementBasis: MeasurementBasis;
  readonly measurementUnit: MeasurementUnit;
  readonly purposeClass: PurposeClass;
  readonly verifiedEventType: VerifiedEventType;
  readonly jurisdictionPolicyClass: string | null;
  readonly baseValue: NumericPolicyValue;
};

export type ProductionCandidateFactorRuleRef = {
  readonly factor: string;
  readonly multiplier:
    | { readonly kind: 'BASIS_POINTS'; readonly points: NumericPolicyValue }
    | {
        readonly kind: 'RATIONAL';
        readonly numerator: NumericPolicyValue;
        readonly denominator: NumericPolicyValue;
      };
  readonly roundingRule: 'FLOOR' | 'CEILING' | 'NEAREST_EVEN';
};

export type HumanContributionProductionValuationPolicyCandidate = {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly schemaVersion: typeof PRODUCTION_CANDIDATE_VALUATION_SCHEMA_VERSION;
  readonly eligibleContributionClasses: readonly ContributionClass[];
  readonly eligibleMeasurementBases: readonly MeasurementBasis[];
  readonly eligibleMeasurementUnits: readonly MeasurementUnit[];
  readonly referenceDenomination: string;
  readonly baseValueSchedule: readonly BaseValueScheduleEntryRef[];
  readonly factorPolicy: readonly ProductionCandidateFactorRuleRef[];
  readonly floorPolicy: FloorCeilingPolicy;
  readonly ceilingPolicy: FloorCeilingPolicy;
  readonly rightsPolicyReference: PolicyVersionBinding;
  readonly verificationPolicyReference: PolicyVersionBinding;
  readonly economicAssetVerificationReference: PolicyVersionBinding;
  readonly HINPolicyReference: PolicyVersionBinding;
  readonly chainAnchorPolicyReference: PolicyVersionBinding;
  readonly jurisdictionPolicyReference: PolicyVersionBinding;
  readonly governanceReference: string;
  readonly effectiveHeightCandidate: bigint | null;
  readonly sourceClass: PolicySourceClass;
  readonly fixture: boolean;
  readonly rehearsalOnly: true;
  readonly policyHash: string;
  readonly productionActivated: false;
  readonly completeness: PolicyCompleteness;
  readonly referenceValueEqualsSunReyByDefinition: false;
  readonly valuationIsHumanWorth: false;
  readonly peveUsedAsTokenFormula: false;
  readonly productionValuesGoverned: false;
  readonly fixtureAuthorizesProduction: false;
  readonly rehearsalFixtureLabel: typeof REHEARSAL_FIXTURE | null;
  readonly economicMeaning: typeof NO_PRODUCTION_ECONOMIC_MEANING | 'UNCONFIGURED';
};

export type ProductionCandidateValuationInput = {
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly contributionClass: ContributionClass;
  readonly measurementBasis: MeasurementBasis;
  readonly measurementUnit: MeasurementUnit;
  readonly measurementQuantity: bigint;
  readonly purposeClass: PurposeClass;
  readonly verifiedEventType: VerifiedEventType;
  readonly jurisdictionPolicyClass: string | null;
  readonly verificationState: 'VERIFIED' | 'UNVERIFIED' | 'REJECTED' | 'SUPERSEDED';
  readonly verificationPolicyVersion: string;
  readonly rightsEvidencePresent: boolean;
  readonly consentEvidencePresent: boolean;
  readonly provenanceEvidencePresent: boolean;
  readonly economicAssetVerificationState: 'VERIFIED' | 'UNVERIFIED' | 'NOT_APPLICABLE' | 'CHAIN_ANCHORED_ONLY';
  readonly chainAnchored: boolean;
  readonly containsRawPersonalData: false;
  readonly peveScoreUsedAsValue: false;
  readonly humanWorthScore: false;
};

export type ProductionCandidateValuationReceipt = {
  readonly schemaVersion: typeof PRODUCTION_CANDIDATE_VALUATION_SCHEMA_VERSION;
  readonly valuationId: string;
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly referenceValue: bigint;
  readonly referenceDenomination: string;
  readonly factorsApplied: readonly string[];
  readonly completeness: PolicyCompleteness;
  readonly sourceClass: PolicySourceClass;
  readonly fixture: boolean;
  readonly rehearsalOnly: true;
  readonly productionActivated: false;
  readonly referenceValueEqualsSunReyByDefinition: false;
  readonly valuationIsHumanWorth: false;
  readonly peveUsedAsTokenFormula: false;
  readonly sunReyQuantity: null;
  readonly rehearsalFixtureLabel: typeof REHEARSAL_FIXTURE | null;
  readonly economicMeaning: typeof NO_PRODUCTION_ECONOMIC_MEANING;
};

export type ProductionCandidateValuationFailureCode =
  | 'POLICY_SCHEMA_INVALID'
  | 'VALUES_UNCONFIGURED'
  | 'PEVE_FORBIDDEN'
  | 'HUMAN_WORTH_FORBIDDEN'
  | 'PROTECTED_TRAIT_FORBIDDEN'
  | 'PERSON_LEVEL_MULTIPLIER_FORBIDDEN'
  | 'FORBIDDEN_SCHEDULE_DIMENSION'
  | 'CONTRIBUTION_NOT_VERIFIED'
  | 'CONTRIBUTION_CLASS_INELIGIBLE'
  | 'MEASUREMENT_BASIS_INELIGIBLE'
  | 'MEASUREMENT_UNIT_INELIGIBLE'
  | 'DENOMINATION_IS_SUNREY'
  | 'DENOMINATION_HARDCODED_FIAT'
  | 'BINDING_LATEST_REJECTED'
  | 'AI_CANNOT_AUTHORIZE_VALUATION'
  | 'S3M_CANNOT_AUTHORIZE_VALUATION'
  | 'GROK_CANNOT_AUTHORIZE_VALUATION'
  | 'FLOAT_MONETARY_MATH_FORBIDDEN'
  | 'ZERO_DENOMINATOR'
  | 'PRODUCTION_VALUATION_UNAVAILABLE'
  | 'FIXTURE_CANNOT_AUTHORIZE_PRODUCTION'
  | 'ECONOMIC_ASSET_NOT_VERIFIED'
  | 'CHAIN_ANCHOR_IS_NOT_ECONOMIC_VERIFICATION';

export type ProductionCandidateValuationFailure = {
  readonly ok: false;
  readonly code: ProductionCandidateValuationFailureCode;
  readonly message: string;
};

export type ProductionCandidateValuationSuccess = {
  readonly ok: true;
  readonly receipt: ProductionCandidateValuationReceipt;
};

export type ProductionCandidateValuationResult =
  | ProductionCandidateValuationSuccess
  | ProductionCandidateValuationFailure;

export type ValuationPolicyCandidateValidationSuccess = {
  readonly ok: true;
  readonly value: HumanContributionProductionValuationPolicyCandidate;
};

export type ValuationPolicyCandidateValidationResult =
  | ValuationPolicyCandidateValidationSuccess
  | ProductionCandidateValuationFailure;

export function valuationCandidateFailure(
  code: ProductionCandidateValuationFailureCode,
  message: string,
): ProductionCandidateValuationFailure {
  return Object.freeze({ ok: false, code, message });
}
