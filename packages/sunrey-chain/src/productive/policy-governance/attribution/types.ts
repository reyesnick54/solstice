/**
 * Chunk 121 — attribution policy, share, and decision types.
 *
 * Evolves Chunk 74 CrossCategoryAllocationRule and
 * CapacityOutputAllocationRule into a versioned attribution policy.
 * Those rule types remain the compatibility surface for eligibility.
 */

import type { EconomicEventClass } from '../../source-taxonomy/types.ts';
import type { ClaimType, ProductiveCategory } from '../../types.ts';
import {
  ATTRIBUTION_CONSTITUTION_VERSION,
  ATTRIBUTION_PARAMETER_CLASS,
  ATTRIBUTION_SHARE_SCALE,
} from './constitution.ts';

export const ATTRIBUTION_POLICY_STATUSES = [
  'DRAFT',
  'SIMULATION_ACTIVE',
  'SUPERSEDED',
  'PRODUCTION_CANDIDATE',
] as const;
export type AttributionPolicyStatus = (typeof ATTRIBUTION_POLICY_STATUSES)[number];

export const ATTRIBUTION_DECISIONS = [
  'FULL_ATTRIBUTION',
  'PARTIAL_ATTRIBUTION',
  'ZERO_DUPLICATE_ATTRIBUTION',
  'SEPARATE_VALUE_EVENT',
  'REVIEW_REQUIRED',
  'REJECTED',
] as const;
export type AttributionDecisionKind = (typeof ATTRIBUTION_DECISIONS)[number];

export const EVENT_RELATIONSHIP_KINDS = [
  'SAME_UNDERLYING_EVENT',
  'DISTINCT_REALIZED_SERVICE',
  'DEPENDENT_INPUT',
  'GOODS_IDENTITY',
  'CAPACITY_OF_OUTPUT',
  'OUTPUT_OF_DELIVERY',
  'LINEAGE_ONLY',
  'CONTROLLER_RELABEL',
  'AMBIGUOUS',
] as const;
export type EventRelationshipKind = (typeof EVENT_RELATIONSHIP_KINDS)[number];

export const DEFAULT_DUPLICATE_BEHAVIORS = [
  'ZERO_DUPLICATE_ATTRIBUTION',
  'GOVERNED_SPLIT',
  'REVIEW_REQUIRED',
] as const;
export type DefaultDuplicateBehavior = (typeof DEFAULT_DUPLICATE_BEHAVIORS)[number];

export const CATEGORY_RELATIONSHIP_BEHAVIORS = [
  'PRIMARY_AND_LINEAGE',
  'GOVERNED_SPLIT',
  'SEPARATE_IF_INDEPENDENT',
  'LINEAGE_ONLY',
  'REVIEW',
] as const;
export type CategoryRelationshipBehavior = (typeof CATEGORY_RELATIONSHIP_BEHAVIORS)[number];

export const ATTRIBUTION_REASON_CODES = [
  'SAME_EVENT_DUPLICATE',
  'GOODS_IDENTITY_NOT_NEW_OUTPUT',
  'CAPACITY_IS_NOT_OUTPUT',
  'OUTPUT_IS_NOT_DELIVERY',
  'DELIVERY_NOT_AUTOMATIC_PRODUCTION',
  'MACHINE_ACTIVITY_NOT_NEW_OUTPUT',
  'ENERGY_CONSUMPTION_IS_LINEAGE',
  'INDEPENDENT_LOGISTICS_SERVICE',
  'INDEPENDENT_STORAGE_SERVICE',
  'COMPUTE_AI_SAME_EXECUTION',
  'VERTICAL_RELABEL_SAME_EVENT',
  'VERTICAL_DISTINCT_STAGES',
  'CONTROLLER_CONFLICT_SAME_OUTPUT',
  'AMBIGUOUS_RELATIONSHIP',
  'AMBIGUOUS_LINEAGE',
  'AMBIGUOUS_BATCH_IDENTITY',
  'MEASUREMENT_SEMANTICS_OVERLAP',
  'INDEPENDENT_SERVICE_EVIDENCE_INSUFFICIENT',
  'CATEGORY_HOP_SUSPECTED',
  'SHARE_EXCEEDS_BOUND',
  'NEGATIVE_SHARE',
  'AGGREGATE_SHARE_EXCEEDS_BOUND',
  'MANUFACTURING_QUANTITY_NOT_LOGISTICS_OUTPUT',
  'POLICY_VERSION_RETAINED',
  'HISTORICAL_POLICY_PRESERVED',
  'ATTRIBUTION_DOES_NOT_MINT',
  'ATTRIBUTION_DOES_NOT_VALUE',
  'PRIMARY_CATEGORY_ATTRIBUTION',
  'SEPARATE_REALIZED_SERVICE',
  'DEPENDENT_INPUT_NOT_OWNERSHIP',
] as const;
export type AttributionReasonCode = (typeof ATTRIBUTION_REASON_CODES)[number];

export const SHARE_REJECTION_CODES = [
  'NEGATIVE_SHARE',
  'SHARE_EXCEEDS_BOUND',
  'AGGREGATE_SHARE_EXCEEDS_BOUND',
] as const;
export type ShareRejectionCode = (typeof SHARE_REJECTION_CODES)[number];

/**
 * Consumption view of a Chunk 120 productive economic event plus the
 * claim attached to it. Chunk 121 does not re-identify events.
 */
export type AttributionSubject = {
  readonly claimId: string;
  readonly contributionId: string;
  readonly economicEventId: string;
  readonly category: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly eventClass: EconomicEventClass;
  readonly controllerId: string;
  readonly quantity: bigint;
  readonly unitId: string;
  readonly measurementSemantics: string;
  readonly evidenceRefs: readonly string[];
  readonly lineageEventIds: readonly string[];
  readonly lineageComplete: boolean;
  readonly batchIdentity?: string;
  readonly relatedEventIds: readonly string[];
  readonly relatedClaimIds: readonly string[];
};

export type EventRelationship = {
  readonly leftEventId: string;
  readonly rightEventId: string;
  readonly kind: EventRelationshipKind;
  readonly confidence: 'DECLARED' | 'INFERRED' | 'AMBIGUOUS';
};

export type EventClassRule = {
  readonly ruleId: string;
  readonly eventClass: EconomicEventClass;
  readonly mayReceiveFullAttribution: boolean;
  readonly isAutomaticProduction: false;
  readonly notes: string;
};

export type CategoryRelationshipRule = {
  readonly ruleId: string;
  readonly leftCategory: ProductiveCategory;
  readonly rightCategory: ProductiveCategory;
  readonly relationship: EventRelationshipKind;
  readonly behavior: CategoryRelationshipBehavior;
  readonly primaryCategory?: ProductiveCategory;
  readonly split?: Readonly<Partial<Record<ProductiveCategory, bigint>>>;
  readonly requiredEvidence: readonly string[];
};

export type ClaimRelationshipRule = {
  readonly ruleId: string;
  readonly leftClaimType: ClaimType;
  readonly rightClaimType: ClaimType;
  readonly relationship: EventRelationshipKind;
  readonly behavior: CategoryRelationshipBehavior;
  readonly primaryClaimType?: ClaimType;
  readonly split?: Readonly<Partial<Record<ClaimType, bigint>>>;
};

export type ProductiveAttributionPolicy = {
  readonly policyId: string;
  readonly version: number;
  readonly status: AttributionPolicyStatus;
  readonly effectiveHeight: number;
  readonly schemaVersion: typeof ATTRIBUTION_CONSTITUTION_VERSION;
  readonly eventClassRules: readonly EventClassRule[];
  readonly categoryRelationshipRules: readonly CategoryRelationshipRule[];
  readonly claimRelationshipRules: readonly ClaimRelationshipRule[];
  readonly maximumAggregateShare: bigint;
  readonly shareScale: typeof ATTRIBUTION_SHARE_SCALE;
  readonly defaultDuplicateBehavior: DefaultDuplicateBehavior;
  readonly reviewThreshold: number;
  readonly requiredEvidenceForSeparateValue: readonly string[];
  readonly requiredEvidenceForSharedValue: readonly string[];
  readonly governanceReference: 'moonrey-policy-governance';
  readonly parameterClass: typeof ATTRIBUTION_PARAMETER_CLASS;
  readonly productionActivated: false;
  readonly authorizesIssuance: false;
  readonly performsFinalValuation: false;
  readonly contentHash: string;
};

export type ProductiveAttributionDecision = {
  readonly decisionId: string;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly economicEventId: string;
  readonly claimId: string;
  readonly contributionId: string;
  readonly category: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly attributionShare: bigint;
  readonly shareScale: typeof ATTRIBUTION_SHARE_SCALE;
  readonly decision: AttributionDecisionKind;
  readonly relatedEventIds: readonly string[];
  readonly relatedClaimIds: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly reasonCodes: readonly AttributionReasonCode[];
  readonly decisionDigest: string;
  readonly authorizesIssuance: false;
  readonly performsFinalValuation: false;
};

export type AttributionShareValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: ShareRejectionCode };

export type AttributionEvaluationInput = {
  readonly height: number;
  readonly policy: ProductiveAttributionPolicy;
  readonly subjects: readonly AttributionSubject[];
  readonly relationships?: readonly EventRelationship[];
  readonly requestedShares?: Readonly<Record<string, bigint>>;
};

export type AttributionEvaluation = {
  readonly policyId: string;
  readonly policyVersion: number;
  readonly decisions: readonly ProductiveAttributionDecision[];
  readonly rejected: boolean;
  readonly reviewRequired: boolean;
  readonly authorizesIssuance: false;
  readonly performsFinalValuation: false;
  readonly productionActivated: false;
};
