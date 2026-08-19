/**
 * Versioned Human Economic Contribution taxonomy.
 *
 * These are economic contribution categories — not measures of a
 * person's worth. Adding a class never makes it settlement eligible,
 * SunRey-issuance eligible, production enabled, or legally approved.
 */

export const HUMAN_CONTRIBUTION_TAXONOMY_ID = 'sunrey-human-economic-contribution-taxonomy' as const;
export const HUMAN_CONTRIBUTION_TAXONOMY_VERSION = '1' as const;
export const HUMAN_CONTRIBUTION_SCHEMA_VERSION = 1 as const;

export const CONTRIBUTION_CLASSES = [
  'INFORMATION_RIGHT_CONTRIBUTION',
  'VERIFIED_KNOWLEDGE_CONTRIBUTION',
  'CREATIVE_PRODUCTION',
  'RESEARCH_PARTICIPATION',
  'PROFESSIONAL_EXPERTISE',
  'ECONOMIC_PARTICIPATION',
  'COMMUNITY_CONTRIBUTION',
  'EDUCATION_SKILL_ATTESTATION',
  'MODEL_TRAINING_PARTICIPATION',
  'HUMAN_SERVICE_DELIVERY',
  'ENTREPRENEURIAL_ACTIVITY',
  'CREATOR_ROYALTY_EVENT',
  'OTHER_GOVERNED_HUMAN_CONTRIBUTION',
] as const;
export type ContributionClass = (typeof CONTRIBUTION_CLASSES)[number];

export const SOURCE_CLASSES = [
  'HUMAN_INFORMATION_NETWORK',
  'PERSONAL_ECONOMIC_GRAPH_REFERENCE',
  'CANONICAL_LEDGER_EVENT_REFERENCE',
  'PAYMENT_EVENT_REFERENCE',
  'CARD_EVENT_REFERENCE',
  'VERIFIED_INSTITUTIONAL_ATTESTATION',
  'VERIFIED_COMMUNITY_ATTESTATION',
  'VERIFIED_PROFESSIONAL_ATTESTATION',
  'VERIFIED_RESEARCH_ATTESTATION',
  'USER_DECLARED',
  'DERIVED',
  'MODEL_INFERENCE',
  'OTHER_GOVERNED_SOURCE',
] as const;
export type SourceClass = (typeof SOURCE_CLASSES)[number];

export const VERIFICATION_QUALITIES = [
  'AUTHORITATIVE_REFERENCE',
  'VERIFIED',
  'ATTESTED',
  'USER_DECLARED',
  'DERIVED',
  'INFERRED',
] as const;
export type VerificationQuality = (typeof VERIFICATION_QUALITIES)[number];

export const DATA_QUALITY_STATES = [
  'CURRENT',
  'STALE',
  'CONFLICTED',
  'INCOMPLETE',
  'SUPERSEDED',
] as const;
export type DataQualityState = (typeof DATA_QUALITY_STATES)[number];

export const CONTRIBUTION_LIFECYCLE_STATES = [
  'OBSERVED',
  'SUBMITTED',
  'VERIFICATION_REQUIRED',
  'VERIFIED',
  'REJECTED',
  'SUPERSEDED',
] as const;
export type ContributionLifecycleState = (typeof CONTRIBUTION_LIFECYCLE_STATES)[number];

export const SETTLEMENT_ELIGIBILITY_STATES = [
  'NOT_EVALUATED',
  'NOT_SETTLEMENT_ELIGIBLE',
  'SETTLEMENT_REVIEW_REQUIRED',
  'SETTLEMENT_ELIGIBLE_BY_POLICY',
] as const;
export type SettlementEligibilityState = (typeof SETTLEMENT_ELIGIBILITY_STATES)[number];

export const MEASUREMENT_UNITS = [
  'VERIFIED_RESEARCH_SESSION',
  'APPROVED_CREATIVE_ASSET',
  'VERIFIED_PROFESSIONAL_HOUR',
  'CONSENT_SCOPED_INFORMATION_USE',
  'VERIFIED_COMMUNITY_CONTRIBUTION_UNIT',
  'VERIFIED_SERVICE_DELIVERY_UNIT',
  'EDUCATION_SKILL_ATTESTATION_UNIT',
  'MODEL_TRAINING_PARTICIPATION_UNIT',
  'ENTREPRENEURIAL_ACTIVITY_UNIT',
  'CREATOR_ROYALTY_EVENT_UNIT',
  'ECONOMIC_PARTICIPATION_UNIT',
  'VERIFIED_KNOWLEDGE_UNIT',
  'OTHER_GOVERNED_CONTRIBUTION_UNIT',
] as const;
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];

export const INFORMATION_RIGHT_REQUIRED_CLASSES = [
  'INFORMATION_RIGHT_CONTRIBUTION',
  'VERIFIED_KNOWLEDGE_CONTRIBUTION',
  'MODEL_TRAINING_PARTICIPATION',
  'CREATOR_ROYALTY_EVENT',
] as const satisfies readonly ContributionClass[];

export type InformationRightRequiredClass = (typeof INFORMATION_RIGHT_REQUIRED_CLASSES)[number];

export const USAGE_RECEIPT_REQUIRED_CLASSES = ['INFORMATION_RIGHT_CONTRIBUTION'] as const satisfies readonly ContributionClass[];

export const NON_AUTHORITATIVE_SOURCE_CLASSES = ['USER_DECLARED', 'DERIVED', 'MODEL_INFERENCE'] as const satisfies readonly SourceClass[];

export const SOURCE_QUALITY_LOCK: Readonly<Record<(typeof NON_AUTHORITATIVE_SOURCE_CLASSES)[number], VerificationQuality>> =
  Object.freeze({
    USER_DECLARED: 'USER_DECLARED',
    DERIVED: 'DERIVED',
    MODEL_INFERENCE: 'INFERRED',
  });

export type ClassPolicyControls = {
  readonly settlementEligibleByDefault: false;
  readonly issuanceEligibleByDefault: false;
  readonly productionEnabledByDefault: false;
  readonly legallyApprovedByDefault: false;
};

export const DEFAULT_CLASS_POLICY: ClassPolicyControls = Object.freeze({
  settlementEligibleByDefault: false,
  issuanceEligibleByDefault: false,
  productionEnabledByDefault: false,
  legallyApprovedByDefault: false,
});

export type ContributionClassRecord = {
  readonly contributionClass: ContributionClass;
  readonly taxonomyVersion: typeof HUMAN_CONTRIBUTION_TAXONOMY_VERSION;
  readonly policy: ClassPolicyControls;
  readonly informationRightsRequired: boolean;
  readonly usageReceiptRequired: boolean;
  readonly humanWorthMeasure: false;
};

function classRecord(contributionClass: ContributionClass): ContributionClassRecord {
  return Object.freeze({
    contributionClass,
    taxonomyVersion: HUMAN_CONTRIBUTION_TAXONOMY_VERSION,
    policy: DEFAULT_CLASS_POLICY,
    informationRightsRequired: (INFORMATION_RIGHT_REQUIRED_CLASSES as readonly string[]).includes(contributionClass),
    usageReceiptRequired: (USAGE_RECEIPT_REQUIRED_CLASSES as readonly string[]).includes(contributionClass),
    humanWorthMeasure: false,
  });
}

export const CONTRIBUTION_CLASS_RECORDS: Readonly<Record<ContributionClass, ContributionClassRecord>> = Object.freeze(
  Object.fromEntries(CONTRIBUTION_CLASSES.map((contributionClass) => [contributionClass, classRecord(contributionClass)])) as Record<
    ContributionClass,
    ContributionClassRecord
  >,
);

export type HumanContributionTaxonomy = {
  readonly taxonomyId: typeof HUMAN_CONTRIBUTION_TAXONOMY_ID;
  readonly schemaVersion: typeof HUMAN_CONTRIBUTION_SCHEMA_VERSION;
  readonly taxonomyVersion: typeof HUMAN_CONTRIBUTION_TAXONOMY_VERSION;
  readonly classes: readonly ContributionClass[];
  readonly sourceClasses: readonly SourceClass[];
  readonly records: Readonly<Record<ContributionClass, ContributionClassRecord>>;
  readonly addingAClassDoesNotGrantEligibility: true;
  readonly productionActivated: false;
};

export const HUMAN_CONTRIBUTION_TAXONOMY: HumanContributionTaxonomy = Object.freeze({
  taxonomyId: HUMAN_CONTRIBUTION_TAXONOMY_ID,
  schemaVersion: HUMAN_CONTRIBUTION_SCHEMA_VERSION,
  taxonomyVersion: HUMAN_CONTRIBUTION_TAXONOMY_VERSION,
  classes: CONTRIBUTION_CLASSES,
  sourceClasses: SOURCE_CLASSES,
  records: CONTRIBUTION_CLASS_RECORDS,
  addingAClassDoesNotGrantEligibility: true,
  productionActivated: false,
});

export const FORBIDDEN_MONETARY_UNITS = [
  'USD',
  'EUR',
  'GBP',
  'SUNREY',
  'SUNREY_COIN',
  'MOONREY',
  'MOONREY_COIN',
  'MINOR_UNITS',
  'MONEY',
  'TOKEN',
  'COIN',
] as const;

export const FORBIDDEN_SCORE_FIELDS = [
  'humanWorthScore',
  'human_worth_score',
  'socialCreditScore',
  'social_credit_score',
  'creditScore',
  'credit_score',
  'employabilityScore',
  'employability_score',
  'politicalScore',
  'political_score',
  'peveScore',
  'peve_score',
  'rankingScore',
  'ranking_score',
  'sunReyQuantity',
  'sunreyQuantity',
  'sunReyAmount',
  'mintAmount',
  'issuanceQuantity',
  'tokenQuantity',
] as const;

export const FORBIDDEN_IDENTITY_FIELDS = [
  'legalName',
  'legal_name',
  'fullName',
  'full_name',
  'email',
  'phone',
  'telephone',
  'ssn',
  'socialSecurityNumber',
  'social_security_number',
  'passport',
  'passportNumber',
  'dateOfBirth',
  'date_of_birth',
  'dob',
  'kycPayload',
  'rawKyc',
  'raw_kyc',
  'nationalId',
  'national_id',
  'driversLicense',
  'homeAddress',
  'streetAddress',
  'ipAddress',
  'facialImage',
  'biometric',
  'rawPdvContent',
  'rawPdv',
  'rawCleanRoomRows',
  'rawCleanRoomRow',
] as const;

export const PROTECTED_TRAIT_FIELDS = [
  'race',
  'ethnicity',
  'religion',
  'politicalAffiliation',
  'political_affiliation',
  'sexualOrientation',
  'sexual_orientation',
  'genderIdentity',
  'gender_identity',
  'disability',
  'medicalCondition',
  'medical_condition',
  'healthCondition',
  'health_condition',
  'geneticData',
  'genetic_data',
] as const;

export const CONTRIBUTION_NOT_HUMAN_WORTH =
  'A Human Economic Contribution records an attributable economic contribution or participation event. It is not a human-worth score, social-credit score, credit score, employability score, political score, or ranking of people.';

export const MEASUREMENT_NOT_SUNREY =
  'Contribution measurement is a non-monetary unit count. It is not a SunRey Coin quantity and is not token valuation.';

export const PEVE_NOT_CONTRIBUTION_VALUATION =
  'PEVE describes a person\'s economic system. A Human Economic Contribution is a separate ontology. PEVE scores are not contribution value.';

export const CONTRIBUTION_NOT_EXECUTION =
  'A contribution event cannot authorize financial execution, issue Execution Authority, post a ledger journal, or mint SunRey Coin.';

export function isContributionClass(value: string): value is ContributionClass {
  return (CONTRIBUTION_CLASSES as readonly string[]).includes(value);
}

export function isSourceClass(value: string): value is SourceClass {
  return (SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isMeasurementUnit(value: string): value is MeasurementUnit {
  return (MEASUREMENT_UNITS as readonly string[]).includes(value);
}

export function informationRightsRequired(contributionClass: ContributionClass): boolean {
  return CONTRIBUTION_CLASS_RECORDS[contributionClass].informationRightsRequired;
}

export function usageReceiptRequired(contributionClass: ContributionClass): boolean {
  return CONTRIBUTION_CLASS_RECORDS[contributionClass].usageReceiptRequired;
}

export function isNonAuthoritativeSource(sourceClass: SourceClass): sourceClass is (typeof NON_AUTHORITATIVE_SOURCE_CLASSES)[number] {
  return (NON_AUTHORITATIVE_SOURCE_CLASSES as readonly string[]).includes(sourceClass);
}
