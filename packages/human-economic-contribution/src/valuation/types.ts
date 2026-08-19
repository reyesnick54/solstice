/**
 * Chunk 111 / 112 — engineering-implemented human contribution
 * reference valuation. This is not PEVE, not a human-worth score,
 * and not a SunRey quantity. Production remains unactivated.
 */

export const HUMAN_CONTRIBUTION_VALUATION_SCHEMA_VERSION = 1 as const;
export const HUMAN_CONTRIBUTION_VALUATION_ID = 'sunrey.human-contribution.valuation.v1' as const;
export const ENGINEERING_SIMULATION_PARAMETERS = 'ENGINEERING_SIMULATION_PARAMETERS' as const;
export const PRODUCTION_VALUATION_POLICY_STATUS = 'UNCONFIGURED' as const;
export const PRODUCTION_VALUATION_ACTIVATION = 'NOT_ACTIVATED' as const;
export const REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION = false as const;

export const VALUATION_ENVIRONMENTS = ['DEVELOPMENT', 'SIMULATION', 'PRODUCTION'] as const;
export type ValuationEnvironment = (typeof VALUATION_ENVIRONMENTS)[number];

export const VALUATION_RESULT_STATES = ['ACTIVE', 'SUPERSEDED', 'INVALID'] as const;
export type ValuationResultState = (typeof VALUATION_RESULT_STATES)[number];

export const VALUATION_METHODS = ['ENGINEERING_SIMULATION_MEASUREMENT_SCALE'] as const;
export type ValuationMethod = (typeof VALUATION_METHODS)[number];

export const VALUATION_ACTORS = [
  'HUMAN',
  'PROTOCOL',
  'DEVELOPMENT_FIXTURE',
  'GOVERNED_PROTOCOL_SIMULATION',
] as const;
export type ValuationActor = (typeof VALUATION_ACTORS)[number];

export const FORBIDDEN_VALUATION_ACTORS = [
  'AI',
  'FINANCIAL_AGENT',
  'AGENT',
  'S3M',
  'GROK',
  'MODEL',
  'MODEL_OUTPUT',
] as const;
export type ForbiddenValuationActor = (typeof FORBIDDEN_VALUATION_ACTORS)[number];

export type HumanContributionValuationPolicy = {
  readonly policyId: string;
  readonly version: string;
  readonly environment: 'DEVELOPMENT' | 'SIMULATION';
  readonly referenceDenomination: string;
  readonly method: ValuationMethod;
  readonly unitScaleNumerator: bigint;
  readonly unitScaleDenominator: bigint;
  readonly perContributionReferenceCeiling: bigint;
  readonly jurisdictionPolicyRef: string;
  readonly governanceReference: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly simulationOnly: true;
  readonly productionActivated: false;
  readonly parameterClass: typeof ENGINEERING_SIMULATION_PARAMETERS;
  readonly peveUsedAsTokenFormula: false;
  readonly humanWorthUsedAsValue: false;
};

export const PRODUCTION_HUMAN_VALUATION_POLICY = Object.freeze({
  status: PRODUCTION_VALUATION_POLICY_STATUS,
  activation: PRODUCTION_VALUATION_ACTIVATION,
  productionActivated: false,
});

/**
 * Privacy-safe verified contribution input for reference valuation.
 * The valuation module does not import the registry implementation.
 */
export type VerifiedContributionValuationInput = {
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly status: 'VERIFIED';
  readonly verificationPolicyVersion: string;
  readonly measurementQuantity: bigint;
  readonly measurementUnit: string;
  readonly jurisdictionPolicyRef: string;
  readonly containsRawPersonalData: false;
  readonly peveScoreUsedAsValue: false;
  readonly humanWorthScore: false;
};

export type HumanContributionValuationResult = {
  readonly schemaVersion: typeof HUMAN_CONTRIBUTION_VALUATION_SCHEMA_VERSION;
  readonly valuationId: string;
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly valuationPolicyId: string;
  readonly valuationPolicyVersion: string;
  readonly valuationMethod: ValuationMethod;
  readonly valuationDigest: string;
  readonly finalReferenceValue: bigint;
  readonly referenceDenomination: string;
  readonly jurisdictionPolicyRef: string;
  readonly status: ValuationResultState;
  readonly environment: 'DEVELOPMENT' | 'SIMULATION';
  readonly simulationOnly: true;
  readonly productionActivated: false;
  readonly parameterClass: typeof ENGINEERING_SIMULATION_PARAMETERS;
  readonly peveUsedAsTokenFormula: false;
  readonly humanWorthUsedAsValue: false;
  readonly aiAuthorized: false;
  readonly referenceValueEqualsSunReyByDefinition: false;
  readonly sunReyQuantity: null;
};

export type ValuationFailureCode =
  | 'CONTRIBUTION_NOT_VERIFIED'
  | 'VALUATION_ACTOR_FORBIDDEN'
  | 'AI_CANNOT_AUTHORIZE_VALUATION'
  | 'FINANCIAL_AGENT_CANNOT_AUTHORIZE_VALUATION'
  | 'S3M_CANNOT_AUTHORIZE_VALUATION'
  | 'GROK_CANNOT_AUTHORIZE_VALUATION'
  | 'MODEL_OUTPUT_CANNOT_AUTHORIZE_VALUATION'
  | 'PEVE_CANNOT_BECOME_REFERENCE_VALUE'
  | 'HUMAN_WORTH_SCORE_REJECTED'
  | 'RAW_PERSONAL_DATA_REJECTED'
  | 'PRODUCTION_VALUATION_UNAVAILABLE'
  | 'VALUATION_POLICY_INVALID'
  | 'VALUATION_CAP_EXCEEDED'
  | 'INVALID_MEASUREMENT'
  | 'JURISDICTION_POLICY_MISMATCH';

export type ValuationFailure = {
  readonly ok: false;
  readonly code: ValuationFailureCode;
};

export type ValuationSuccess = {
  readonly ok: true;
  readonly result: HumanContributionValuationResult;
};

export type ValuationComputeResult = ValuationSuccess | ValuationFailure;
import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  ContributionFingerprint,
  ContributionId,
  EvidenceRef,
  SubjectRef,
} from '../ids.ts';
import type {
  ContributionClass,
  ContributionLifecycleState,
  DataQualityState,
  MeasurementUnit,
  SourceClass,
} from '../taxonomy.ts';
import type { ContributionMeasurement } from '../types.ts';
import type { RoundingRule } from './arithmetic.ts';
import type {
  JurisdictionPolicyRef,
  PolicyRuleRef,
  ValuationDigest,
  ValuationId,
  ValuationPolicyId,
  ValuationPolicyVersion,
  ValuationReferenceId,
} from './ids.ts';

export const VALUATION_METHODS = [
  'CONTRACTUAL_COMPENSATION',
  'GOVERNED_FIXED_SCHEDULE',
  'INFORMATION_USAGE_RIGHT_SCHEDULE',
  'PROFESSIONAL_SERVICE_SCHEDULE',
  'CREATOR_ROYALTY_SCHEDULE',
  'RESEARCH_PARTICIPATION_SCHEDULE',
  'COMMUNITY_CONTRIBUTION_SCHEDULE',
  'MARKET_REFERENCE',
  'VERIFIED_OUTCOME_ATTRIBUTION',
] as const;
export type ValuationMethod = (typeof VALUATION_METHODS)[number];

export const VALUATION_STATES = ['VALUED_SIMULATION', 'VALUATION_REVIEW_REQUIRED', 'VALUATION_REJECTED'] as const;
export type ValuationState = (typeof VALUATION_STATES)[number];

export const VALUATION_FACTOR_TYPES = [
  'QUALITY',
  'REALIZATION',
  'RIGHTS_SCOPE',
  'USAGE',
  'OUTCOME_ATTRIBUTION',
  'FRESHNESS',
  'JURISDICTION_POLICY',
] as const;
export type ValuationFactorType = (typeof VALUATION_FACTOR_TYPES)[number];

export const FORBIDDEN_VALUATION_FACTOR_TYPES = [
  'PERSON_LEVEL',
  'HUMAN_WORTH',
  'PEVE_SCORE',
  'AI_SUBJECTIVE',
  'CREDIT_SCORE',
  'PROTECTED_TRAIT',
] as const;
export type ForbiddenValuationFactorType = (typeof FORBIDDEN_VALUATION_FACTOR_TYPES)[number];

export const VALUATION_REFERENCE_SOURCE_CLASSES = [
  'CONTRACTUAL_TERM',
  'ROYALTY_SCHEDULE',
  'APPROVED_MARKET_REFERENCE',
  'APPROVED_PROFESSIONAL_RATE_SCHEDULE',
  'APPROVED_RESEARCH_COMPENSATION_SCHEDULE',
  'INFORMATION_RIGHT_USAGE_SCHEDULE',
  'COMMUNITY_CONTRIBUTION_SCHEDULE',
  'GOVERNED_FIXED_SCHEDULE',
  'OUTCOME_ATTRIBUTION_SCHEDULE',
] as const;
export type ValuationReferenceSourceClass = (typeof VALUATION_REFERENCE_SOURCE_CLASSES)[number];

export const CONFIDENCE_CLASSES = ['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT'] as const;
export type ConfidenceClass = (typeof CONFIDENCE_CLASSES)[number];

export const REFERENCE_DENOMINATION = 'SIMULATION_REFERENCE_MINOR_UNIT' as const;
export type ReferenceDenomination = typeof REFERENCE_DENOMINATION;

export const REVALUATION_REASONS = [
  'POLICY_VERSION_CHANGE',
  'REFERENCE_CORRECTION',
  'CONTRIBUTION_CORRECTION',
  'EXPLICIT_REVIEWER_REQUEST',
] as const;
export type RevaluationReason = (typeof REVALUATION_REASONS)[number];

export const VALUATION_REASON_CODES = [
  'METHOD_SELECTED',
  'UNSUPPORTED_METHOD',
  'INCOMPATIBLE_METHODS',
  'UNVERIFIED_CONTRIBUTION',
  'SUPERSEDED_CONTRIBUTION',
  'REJECTED_CONTRIBUTION',
  'INCOMPLETE_CONTRIBUTION',
  'CONFLICTED_CONTRIBUTION',
  'PEVE_INPUT_FORBIDDEN',
  'PROTECTED_TRAIT_FORBIDDEN',
  'PERSON_LEVEL_MULTIPLIER_FORBIDDEN',
  'AI_SUBJECTIVE_SCORE_FORBIDDEN',
  'REQUIRED_EVIDENCE_MISSING',
  'OUTCOME_EVIDENCE_MISSING',
  'OUTCOME_ATTRIBUTION_AMBIGUOUS',
  'RIGHTS_SCOPE_AMBIGUOUS',
  'REFERENCE_MISSING',
  'REFERENCE_STALE',
  'REFERENCE_CONFLICT',
  'REFERENCE_DUPLICATE',
  'SELF_REFERENTIAL_MARKET_REFERENCE',
  'REPLAYED_CONTRIBUTION',
  'FORBIDDEN_FACTOR',
  'EXCESSIVE_FACTOR_PRODUCT',
  'CAP_APPLIED',
  'FLOOR_APPLIED',
  'NEGATIVE_VALUE_FORBIDDEN',
  'ZERO_VALUE',
  'INTEGER_OVERFLOW',
  'JURISDICTION_UNRESOLVED',
  'CONFIDENCE_BELOW_MINIMUM',
  'POLICY_INACTIVE',
  'POLICY_TIME_DOMAIN_MISMATCH',
  'CORRECTION_POLICY_REQUIRED',
  'ROUNDING_APPLIED',
] as const;
export type ValuationReasonCode = (typeof VALUATION_REASON_CODES)[number];

export type VerifiedHumanEconomicContribution = {
  readonly contributionId: ContributionId;
  readonly contributionFingerprint: ContributionFingerprint;
  readonly contributionClass: ContributionClass;
  readonly status: ContributionLifecycleState;
  readonly dataQuality: DataQualityState;
  readonly verifiedMeasurement: ContributionMeasurement | null;
  readonly measurementUnit: MeasurementUnit;
  readonly jurisdiction: string;
  readonly evidenceReferences: readonly EvidenceRef[];
  readonly evidenceDigest: string;
  readonly rightsReferences: readonly string[];
  readonly consentReferences: readonly string[];
  readonly purposeReferences: readonly string[];
  readonly usageReceiptReferences: readonly string[];
  readonly sourceClass: SourceClass;
  readonly verificationPolicyVersion: string | null;
  readonly verificationTimestamp: UtcInstant | null;
  readonly eventReference: string;
  readonly subjectRef: SubjectRef;
  readonly validFrom: UtcInstant;
  readonly validUntil: UtcInstant | null;
  readonly containsRawPersonalData: false;
  readonly peveScoreUsedAsValue: false;
  readonly humanWorthScore: false;
  readonly sunReyQuantity: null;
};

export type ValuationReferenceDatum = {
  readonly referenceId: ValuationReferenceId;
  readonly sourceClass: ValuationReferenceSourceClass;
  readonly observedAt: UtcInstant;
  readonly effectiveAt: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly jurisdiction: string;
  readonly unit: MeasurementUnit | 'ROYALTY_BASIS_MINOR_UNIT' | 'CONTRACT_MINOR_UNIT';
  readonly value: bigint;
  readonly royaltyBasisPoints: bigint | null;
  readonly quality: 'AUTHORITATIVE' | 'APPROVED' | 'ATTESTED' | 'LOW';
  readonly confidenceBps: bigint;
  readonly provenanceDigest: string;
  readonly policyCompatibility: boolean;
  readonly contributionClass: ContributionClass | null;
  readonly valuationMethod: ValuationMethod | null;
  readonly measurementUnit: MeasurementUnit | null;
  readonly relatedContributionId: ContributionId | null;
  readonly selfReferential: false;
};

export type ReferenceQuery = {
  readonly sourceClasses: readonly ValuationReferenceSourceClass[];
  readonly contributionClass: ContributionClass;
  readonly valuationMethod: ValuationMethod;
  readonly measurementUnit: MeasurementUnit;
  readonly jurisdiction: string;
  readonly at: UtcInstant;
};

export type ValuationReferenceDataPort = {
  resolve(query: ReferenceQuery): readonly ValuationReferenceDatum[];
};

export type ValuationFactor = {
  readonly factorType: ValuationFactorType;
  readonly inputRef: string;
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly basisPoints: bigint | null;
  readonly reasonCode: ValuationReasonCode;
  readonly policyRuleRef: PolicyRuleRef;
};

export type MethodEligibilityRule = {
  readonly contributionClass: ContributionClass;
  readonly methods: readonly ValuationMethod[];
  readonly requiredEvidenceMin: number;
  readonly requiredReferenceSource: ValuationReferenceSourceClass;
};

export type HumanContributionValuationPolicy = {
  readonly valuationPolicyId: ValuationPolicyId;
  readonly valuationPolicyVersion: ValuationPolicyVersion;
  readonly status: 'ACTIVE' | 'SUPERSEDED' | 'DRAFT';
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil: UtcInstant | null;
  readonly jurisdictions: readonly string[];
  readonly jurisdictionPolicyRef: JurisdictionPolicyRef;
  readonly roundingRule: RoundingRule;
  readonly allowNegative: false;
  readonly zeroValueRequiresReview: boolean;
  readonly minConfidenceBps: bigint;
  readonly maxReferenceAgeSeconds: bigint;
  readonly maxFactorProductBps: bigint;
  readonly globalCap: bigint | null;
  readonly globalFloor: bigint | null;
  readonly methodCaps: Readonly<Partial<Record<ValuationMethod, bigint>>>;
  readonly eligibility: readonly MethodEligibilityRule[];
  readonly allowedFactors: readonly ValuationFactorType[];
  readonly defaultFactors: readonly ValuationFactor[];
  readonly outcomeAttributionRequiresExplicitEvidence: true;
  readonly correction: {
    readonly allowCorrectedSuccessor: true;
    readonly allowSupersededRecord: false;
    readonly allowUnverifiedCorrection: false;
  };
  readonly productionEligible: false;
  readonly createsMintAuthority: false;
  readonly createsExecutionAuthority: false;
};

export type ValuationAdjustment = {
  readonly factor: ValuationFactor;
  readonly before: bigint;
  readonly after: bigint;
};

export type CapApplication = {
  readonly kind: 'METHOD' | 'GLOBAL';
  readonly limit: bigint;
  readonly applied: boolean;
};

export type ValuationInvariants = {
  readonly isHumanWorthScore: false;
  readonly isPeveScore: false;
  readonly isCreditScore: false;
  readonly isSunReyQuantity: false;
  readonly createsMintAuthority: false;
  readonly createsExecutionAuthority: false;
  readonly productionEligible: false;
  readonly isSettlementAuthorization: false;
};

export const VALUATION_INVARIANTS: ValuationInvariants = Object.freeze({
  isHumanWorthScore: false,
  isPeveScore: false,
  isCreditScore: false,
  isSunReyQuantity: false,
  createsMintAuthority: false,
  createsExecutionAuthority: false,
  productionEligible: false,
  isSettlementAuthorization: false,
});

export type ValuationExplanationReceipt = {
  readonly valuationId: ValuationId;
  readonly methodSelected: ValuationMethod | null;
  readonly methodSelectedReason: string;
  readonly evidenceUsed: readonly EvidenceRef[];
  readonly referenceValuesUsed: readonly {
    readonly referenceId: ValuationReferenceId;
    readonly sourceClass: ValuationReferenceSourceClass;
    readonly value: bigint;
    readonly observedAt: UtcInstant;
  }[];
  readonly factorsApplied: readonly ValuationAdjustment[];
  readonly capApplied: CapApplication | null;
  readonly roundingRule: RoundingRule | null;
  readonly policyVersion: ValuationPolicyVersion;
  readonly reasonCodes: readonly ValuationReasonCode[];
  readonly containsRawPersonalData: false;
};

export type HumanContributionValuationResult = {
  readonly valuationId: ValuationId;
  readonly contributionId: ContributionId;
  readonly contributionFingerprint: ContributionFingerprint;
  readonly contributionClass: ContributionClass;
  readonly valuationPolicyId: ValuationPolicyId;
  readonly valuationPolicyVersion: ValuationPolicyVersion;
  readonly valuationMethod: ValuationMethod | null;
  readonly referenceDataRefs: readonly ValuationReferenceId[];
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly baseReferenceValue: bigint | null;
  readonly adjustments: readonly ValuationAdjustment[];
  readonly finalReferenceValue: bigint | null;
  readonly referenceDenomination: ReferenceDenomination;
  readonly roundingApplied: RoundingRule | null;
  readonly capsApplied: readonly CapApplication[];
  readonly confidenceClass: ConfidenceClass;
  readonly valuationTimestamp: UtcInstant;
  readonly jurisdictionPolicyRef: JurisdictionPolicyRef | null;
  readonly valuationDigest: ValuationDigest;
  readonly state: ValuationState;
  readonly reasonCodes: readonly ValuationReasonCode[];
  readonly explanation: ValuationExplanationReceipt;
  readonly supersedesValuationId: ValuationId | null;
  readonly revaluationReason: RevaluationReason | null;
  readonly priorPolicyVersion: ValuationPolicyVersion | null;
  readonly newPolicyVersion: ValuationPolicyVersion;
  readonly invariants: ValuationInvariants;
};

export type FactorRequest = {
  readonly factorType: string;
  readonly inputRef: string;
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly basisPoints: bigint | null;
  readonly reasonCode: ValuationReasonCode;
  readonly policyRuleRef: PolicyRuleRef;
};

export type ValuationEngineInput = {
  readonly contribution: VerifiedHumanEconomicContribution;
  readonly policy: HumanContributionValuationPolicy;
  readonly valuationTimestamp: UtcInstant;
  readonly requestedFactors?: readonly FactorRequest[];
  readonly supersedesValuationId?: ValuationId;
  readonly revaluationReason?: RevaluationReason;
  readonly outcomeEvidenceRefs?: readonly EvidenceRef[];
  readonly attributionPolicyRef?: string;
};

export type PipelineStepName =
  | 'VERIFIED_CONTRIBUTION'
  | 'METHOD_ELIGIBILITY'
  | 'REQUIRED_EVIDENCE'
  | 'REFERENCE_DATA_RESOLUTION'
  | 'BASE_REFERENCE_VALUE'
  | 'ALLOWED_ADJUSTMENTS'
  | 'CAPS_FLOORS'
  | 'DETERMINISTIC_ROUNDING'
  | 'FINAL_REFERENCE_SETTLEMENT_VALUE'
  | 'VALUATION_RESULT';

export type PipelineStep = {
  readonly name: PipelineStepName;
  readonly reasonCodes: readonly ValuationReasonCode[];
  readonly detail: string;
};

export function isValuationMethod(value: string): value is ValuationMethod {
  return (VALUATION_METHODS as readonly string[]).includes(value);
}

export function isValuationFactorType(value: string): value is ValuationFactorType {
  return (VALUATION_FACTOR_TYPES as readonly string[]).includes(value);
}

export function isForbiddenFactorType(value: string): value is ForbiddenValuationFactorType {
  return (FORBIDDEN_VALUATION_FACTOR_TYPES as readonly string[]).includes(value);
}

export function confidenceClassFromBps(confidenceBps: bigint, minimum: bigint): ConfidenceClass {
  if (confidenceBps < minimum) {
    return 'INSUFFICIENT';
  }
  if (confidenceBps >= 8000n) {
    return 'HIGH';
  }
  if (confidenceBps >= 5000n) {
    return 'MEDIUM';
  }
  return 'LOW';
export type ValuationFailureCode =
  | 'FORBIDDEN_VALUATION_METHOD'
  | 'CLASS_METHOD_NOT_ELIGIBLE'
  | 'FORBIDDEN_VALUATION_INPUT'
  | 'PROTECTED_TRAIT_INPUT_FORBIDDEN'
  | 'PEVE_INPUT_FORBIDDEN'
  | 'HUMAN_WORTH_INPUT_FORBIDDEN'
  | 'PERSON_RANK_INPUT_FORBIDDEN'
  | 'WEALTH_MULTIPLIER_FORBIDDEN'
  | 'AI_SUBJECTIVE_SCORE_FORBIDDEN'
  | 'PERSON_LEVEL_MULTIPLIER_FORBIDDEN'
  | 'FORBIDDEN_VALUATION_FACTOR'
  | 'INPUT_NOT_TRACEABLE'
  | 'FLOAT_MONETARY_MATH_FORBIDDEN'
  | 'SUNREY_QUANTITY_FORBIDDEN'
  | 'MINT_AUTHORIZATION_FORBIDDEN'
  | 'EXECUTION_AUTHORIZATION_FORBIDDEN'
  | 'PRODUCTION_POLICY_UNAVAILABLE'
  | 'PRODUCTION_ACTIVATION_FORBIDDEN'
  | 'DUPLICATE_POLICY_VERSION'
  | 'POLICY_NOT_FOUND'
  | 'HISTORICAL_POLICY_IMMUTABLE'
  | 'INVALID_POLICY'
  | 'VALUATION_REVIEW_REQUIRED'
  | 'NO_ACTIVE_SIMULATION_POLICY'
  | 'AI_AUTHORITY_FORBIDDEN'
  | 'TAXONOMY_DOES_NOT_GRANT_ELIGIBILITY'
  | 'REFERENCE_CONFLICT';

export type ValuationFailure = {
  readonly code: ValuationFailureCode;
  readonly message: string;
};

export function valuationFailure(code: ValuationFailureCode, message: string): ValuationFailure {
  return Object.freeze({ code, message });
}
