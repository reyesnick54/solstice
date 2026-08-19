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
}
