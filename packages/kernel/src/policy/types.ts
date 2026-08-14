import type { UtcInstant } from '../../../domain/src/time.ts';
import type { DecisionStatus } from '../../../permissions/src/decision.ts';

/**
 * Engineering lifecycle of a policy version. Separate from legal review.
 * ACTIVE_SIMULATION may be evaluated in ENVIRONMENT=simulation only.
 */
export const POLICY_LIFECYCLES = ['DRAFT', 'ACTIVE_SIMULATION', 'RETIRED'] as const;
export type PolicyLifecycle = (typeof POLICY_LIFECYCLES)[number];

/**
 * Legal-confidence vocabulary. No value in this tree is CONFIRMED_BY_COUNSEL.
 * A source citation is not a legal conclusion.
 */
export const LEGAL_REVIEW_STATUSES = [
  'DRAFT',
  'RESEARCH_REQUIRED',
  'COUNSEL_REVIEWED',
  'CONFIRMED_BY_COUNSEL',
] as const;
export type LegalReviewStatus = (typeof LEGAL_REVIEW_STATUSES)[number];

export const POLICY_PACK_IDS = ['US', 'GB', 'EU', 'SA', 'AE'] as const;
export type PolicyPackId = (typeof POLICY_PACK_IDS)[number];

export const RULE_EFFECTS = [
  'ALLOW',
  'REQUIRE_MANUAL_REVIEW',
  'DEFER',
  'BLOCK',
] as const;
export type RuleEffect = (typeof RULE_EFFECTS)[number];

export const OVERRIDE_CLASSES = ['HARD_BLOCK', 'REVIEWABLE'] as const;
export type OverrideClass = (typeof OVERRIDE_CLASSES)[number];

export const SOURCE_KINDS = [
  'INTERNAL_RESEARCH_MEMO',
  'LEGAL_MEMO',
  'REGULATOR_PUBLICATION',
  'LEGISLATION',
  'COUNSEL_DECISION',
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const REVIEW_CASE_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'APPROVED',
  'DECLINED',
  'EXPIRED',
] as const;
export type ReviewCaseStatus = (typeof REVIEW_CASE_STATUSES)[number];

export const REVIEW_ACTOR_KINDS = ['HUMAN_OPERATOR', 'AGENT', 'AI'] as const;
export type ReviewActorKind = (typeof REVIEW_ACTOR_KINDS)[number];

export const CAPABILITY_ENVIRONMENTS = ['simulation', 'live'] as const;
export type CapabilityEnvironment = (typeof CAPABILITY_ENVIRONMENTS)[number];

export const PRODUCT_OFFERING_MODES = ['SIMULATION', 'LIVE_DISABLED'] as const;
export type ProductOfferingMode = (typeof PRODUCT_OFFERING_MODES)[number];

export type PolicyReasonCode =
  | 'POLICY_PACK_MISSING'
  | 'POLICY_VERSION_MISSING'
  | 'POLICY_VERSION_NOT_EFFECTIVE'
  | 'POLICY_VERSION_RETIRED'
  | 'POLICY_PACK_INVALID'
  | 'REQUIRED_FACT_MISSING'
  | 'PRODUCT_UNSUPPORTED'
  | 'PRODUCT_CAPABILITY_MISSING'
  | 'LEGAL_ENTITY_CAPABILITY_DISABLED'
  | 'LIVE_CAPABILITY_DISABLED'
  | 'JURISDICTION_UNRESOLVED'
  | 'JURISDICTION_AMBIGUOUS'
  | 'RULE_EVALUATION_FAILED'
  | 'CUSTOMER_STATUS_FORBIDDEN'
  | 'KYC_STATE_FORBIDDEN'
  | 'KYC_FACT_INCOMPLETE'
  | 'SIMULATION_STRUCTURAL_PERMIT'
  | 'RESEARCH_REQUIRED_GRANT_IGNORED'
  | 'HARD_BLOCK_NOT_OVERRIDABLE'
  | 'REVIEW_REQUIRES_HUMAN_OPERATOR'
  | 'POLICY_RULE_MATCHED';

export type SourceReference = {
  readonly sourceId: string;
  readonly kind: SourceKind;
  readonly citation: string;
  readonly uri?: string;
  readonly notes?: string;
};

export type PolicyRule = {
  readonly ruleId: string;
  readonly version: string;
  readonly jurisdiction: PolicyPackId;
  readonly scope: string;
  readonly actionTypes: readonly string[];
  readonly productTypes: readonly string[];
  readonly customerTypes: readonly string[];
  readonly legalEntity?: string;
  readonly predicate: import('./predicates.ts').PolicyPredicate;
  readonly effect: RuleEffect;
  readonly reasonCode: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil?: UtcInstant;
  readonly sourceReference?: string;
  readonly legalReviewStatus: LegalReviewStatus;
  readonly overrideClass: OverrideClass;
};

export type PolicyVersionRecord = {
  readonly versionId: string;
  readonly packId: PolicyPackId;
  readonly version: string;
  readonly lifecycle: PolicyLifecycle;
  readonly legalReviewStatus: LegalReviewStatus;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil?: UtcInstant;
  readonly contentHash: string;
  readonly rules: readonly PolicyRule[];
};

export type PolicyPack = {
  readonly packId: PolicyPackId;
  readonly name: string;
  readonly description: string;
  readonly versions: readonly PolicyVersionRecord[];
};

export type LegalEntityCapability = {
  readonly capabilityId: string;
  readonly legalEntityId: string;
  readonly actionTypes: readonly string[];
  readonly productIds: readonly string[];
  readonly productTypes: readonly string[];
  readonly environment: CapabilityEnvironment;
  readonly enabled: boolean;
  readonly legalReviewStatus: LegalReviewStatus;
  readonly sourceReference?: string;
};

export type PolicyProductBinding = {
  readonly productId: string;
  readonly servingLegalEntityId: string;
  readonly supportedJurisdictions: readonly string[];
  readonly currency: string;
  readonly accountClass: string;
  readonly requiredCapabilityId: string;
  readonly offeringMode: ProductOfferingMode;
  readonly disclosureRefs: readonly string[];
};

export type EvaluatedRule = {
  readonly ruleId: string;
  readonly version: string;
  readonly effect: RuleEffect;
  readonly reasonCode: string;
  readonly legalReviewStatus: LegalReviewStatus;
  readonly matched: boolean;
};

export type PolicySnapshot = {
  readonly snapshotId: string;
  readonly packId: PolicyPackId | null;
  readonly packVersion: string | null;
  readonly versionId: string | null;
  readonly packHash: string | null;
  readonly factsHash: string;
  readonly evaluatedRuleIds: readonly string[];
  readonly evaluatedRules: readonly EvaluatedRule[];
  readonly decision: DecisionStatus;
  readonly reasonCodes: readonly string[];
  readonly jurisdiction: string | null;
  readonly packJurisdiction: PolicyPackId | null;
  readonly decidedAt: UtcInstant;
  readonly legalConfidence: LegalReviewStatus;
  readonly overrideClass: OverrideClass;
  readonly reviewId: string | null;
};

export type PolicyEvaluationResult = {
  readonly decision: DecisionStatus;
  readonly reasonCodes: readonly string[];
  readonly evaluatedRules: readonly EvaluatedRule[];
  readonly snapshot: PolicySnapshot;
  readonly reviewRequired: boolean;
};

export function isLegalReviewStatus(value: unknown): value is LegalReviewStatus {
  return typeof value === 'string' && (LEGAL_REVIEW_STATUSES as readonly string[]).includes(value);
}

export function isPolicyPackId(value: unknown): value is PolicyPackId {
  return typeof value === 'string' && (POLICY_PACK_IDS as readonly string[]).includes(value);
}

export function isPolicyLifecycle(value: unknown): value is PolicyLifecycle {
  return typeof value === 'string' && (POLICY_LIFECYCLES as readonly string[]).includes(value);
}
