/**
 * Chunk 145 — production-candidate SunRey settlement conversion policy.
 *
 * Canonical owner remains packages/sunrey-chain/src/economics/human-contribution-bridge.
 * Does not activate production conversion or mint SunRey.
 */

export const PRODUCTION_CANDIDATE_CONVERSION_SCHEMA_VERSION = 1 as const;
export const PRODUCTION_CANDIDATE_CONVERSION_ID =
  'sunrey.human-settlement.conversion.production-candidate.v1' as const;
export const REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION = false as const;
export const PRODUCTION_CONVERSION_ACTIVATED = false as const;
export const REHEARSAL_FIXTURE = 'REHEARSAL_FIXTURE' as const;
export const NO_PRODUCTION_ECONOMIC_MEANING = 'NO_PRODUCTION_ECONOMIC_MEANING' as const;
export const SUNREY_COIN = 'SUNREY_COIN' as const;

export const CONVERSION_ROUNDING_RULES = ['FLOOR', 'CEILING', 'NEAREST_EVEN'] as const;
export type ConversionRoundingRule = (typeof CONVERSION_ROUNDING_RULES)[number];

export const CONVERSION_SOURCE_CLASSES = ['UNCONFIGURED', 'FIXTURE', 'REHEARSAL', 'GOVERNED_PRODUCTION_PARAMETER'] as const;
export type ConversionSourceClass = (typeof CONVERSION_SOURCE_CLASSES)[number];

export const CONVERSION_COMPLETENESS = ['STRUCTURALLY_COMPLETE', 'VALUES_UNCONFIGURED'] as const;
export type ConversionCompleteness = (typeof CONVERSION_COMPLETENESS)[number];

export type NumericPolicyValue =
  | { readonly status: 'UNCONFIGURED'; readonly value: null }
  | { readonly status: 'CONFIGURED'; readonly value: bigint };

export type PolicyVersionBinding = {
  readonly key: string;
  readonly versionId: string;
  readonly contentHash: string;
};

export type SunReyProductionSettlementConversionPolicyCandidate = {
  readonly policyId: string;
  readonly version: string;
  readonly schemaVersion: typeof PRODUCTION_CANDIDATE_CONVERSION_SCHEMA_VERSION;
  readonly inputReferenceDenomination: string;
  readonly outputAsset: typeof SUNREY_COIN;
  readonly conversionNumerator: NumericPolicyValue;
  readonly conversionDenominator: NumericPolicyValue;
  readonly roundingRule: ConversionRoundingRule;
  readonly perContributionCeiling: NumericPolicyValue;
  readonly perContributionClassCeiling: NumericPolicyValue;
  readonly perEpochCeiling: NumericPolicyValue;
  readonly globalEpochCeiling: NumericPolicyValue;
  readonly jurisdictionPolicyRef: PolicyVersionBinding;
  readonly valuationPolicyRef: PolicyVersionBinding;
  readonly verificationPolicyRef: PolicyVersionBinding;
  readonly governanceReference: string;
  readonly effectiveHeightCandidate: bigint | null;
  readonly supersededHeightCandidate: bigint | null;
  readonly sourceClass: ConversionSourceClass;
  readonly fixture: boolean;
  readonly rehearsalOnly: true;
  readonly productionActivated: false;
  readonly completeness: ConversionCompleteness;
  readonly referenceValueEqualsSunReyByDefinition: false;
  readonly fixtureAuthorizesProduction: false;
  readonly rehearsalFixtureLabel: typeof REHEARSAL_FIXTURE | null;
  readonly economicMeaning: typeof NO_PRODUCTION_ECONOMIC_MEANING | 'UNCONFIGURED';
  readonly policyHash: string;
};

export type ConversionCandidateInput = {
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly contributionClass: string;
  readonly valuationId: string;
  readonly valuationPolicyId: string;
  readonly valuationPolicyVersion: string;
  readonly valuationDigest: string;
  readonly referenceValue: bigint;
  readonly referenceDenomination: string;
  readonly verificationState: 'VERIFIED' | 'UNVERIFIED';
  readonly rightsEvidencePresent: boolean;
  readonly consentOnly: boolean;
  readonly usageReceiptOnly: boolean;
  readonly cleanRoomOnly: boolean;
  readonly informationAssetOnly: boolean;
  readonly economicAssetVerificationState: 'VERIFIED' | 'UNVERIFIED' | 'NOT_APPLICABLE' | 'CHAIN_ANCHORED_ONLY';
  readonly peveScoreUsedAsValue: false;
  readonly humanWorthScore: false;
};

export type ConversionCandidateAuthorization = {
  readonly authorizationId: string;
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly valuationId: string;
  readonly conversionPolicyId: string;
  readonly conversionPolicyVersion: string;
  readonly referenceValue: bigint;
  readonly referenceDenomination: string;
  readonly authorizedSunReyQuantity: bigint;
  readonly outputAsset: typeof SUNREY_COIN;
  readonly productionActivated: false;
  readonly referenceValueEqualsSunReyByDefinition: false;
  readonly fixture: boolean;
  readonly rehearsalOnly: true;
  readonly rehearsalFixtureLabel: typeof REHEARSAL_FIXTURE | null;
  readonly economicMeaning: typeof NO_PRODUCTION_ECONOMIC_MEANING;
  readonly mints: false;
  readonly mutatesSupplyBook: false;
};

export type ConversionCandidateFailureCode =
  | 'CONVERSION_POLICY_INVALID'
  | 'VALUES_UNCONFIGURED'
  | 'DENOMINATOR_ZERO'
  | 'DENOMINATION_MISMATCH'
  | 'CONTRIBUTION_MISMATCH'
  | 'VALUATION_MISMATCH'
  | 'VALUATION_POLICY_VERSION_MISMATCH'
  | 'RIGHTS_EVIDENCE_REQUIRED'
  | 'HIN_CONSENT_ALONE_INSUFFICIENT'
  | 'USAGE_RECEIPT_ALONE_INSUFFICIENT'
  | 'CLEAN_ROOM_ALONE_INSUFFICIENT'
  | 'INFORMATION_ASSET_ALONE_INSUFFICIENT'
  | 'CONTRIBUTION_VERIFICATION_REQUIRED'
  | 'CONVERSION_POLICY_REQUIRED'
  | 'PER_CONTRIBUTION_CAP'
  | 'PER_CLASS_CAP'
  | 'EPOCH_CAP'
  | 'GLOBAL_CAP'
  | 'MAX_SUPPLY_GUARD'
  | 'REPLAY_REJECTED'
  | 'REVALUATION_DOES_NOT_REMINT'
  | 'PEVE_CANNOT_BECOME_CONVERSION_INPUT'
  | 'PEVE_CANNOT_BECOME_SUNREY'
  | 'HUMAN_WORTH_FORBIDDEN'
  | 'PROTECTED_TRAIT_FORBIDDEN'
  | 'AI_CANNOT_AUTHORIZE_CONVERSION'
  | 'S3M_CANNOT_AUTHORIZE_CONVERSION'
  | 'GROK_CANNOT_AUTHORIZE_CONVERSION'
  | 'FLOAT_MONETARY_MATH_FORBIDDEN'
  | 'FIXTURE_CANNOT_AUTHORIZE_PRODUCTION'
  | 'CHAIN_ANCHOR_IS_NOT_ECONOMIC_VERIFICATION'
  | 'CANDIDATE_PACKAGE_CANNOT_MINT'
  | 'PRODUCTION_CONVERSION_UNAVAILABLE';

export type ConversionCandidateFailure = {
  readonly ok: false;
  readonly code: ConversionCandidateFailureCode;
  readonly message: string;
};

export type ConversionCandidateSuccess = {
  readonly ok: true;
  readonly value: ConversionCandidateAuthorization;
};

export type ConversionCandidateResult = ConversionCandidateSuccess | ConversionCandidateFailure;

export type ConversionPolicyCandidateValidationSuccess = {
  readonly ok: true;
  readonly value: SunReyProductionSettlementConversionPolicyCandidate;
};

export type ConversionPolicyCandidateValidationResult =
  | ConversionPolicyCandidateValidationSuccess
  | ConversionCandidateFailure;

export function conversionFailure(
  code: ConversionCandidateFailureCode,
  message: string,
): ConversionCandidateFailure {
  return Object.freeze({ ok: false, code, message });
}
