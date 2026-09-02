import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  CanonicalEntityId,
  CanonicalEventId,
  EconomicObservationId,
  LineageRecord,
} from './types.ts';

export type ProductiveEventKey = string & { readonly __brand: 'ProductiveEventKey' };

export const WAVE5_RECONCILIATION_SCHEMA_VERSION = 'sunrey.productive-event-reconciliation.v1' as const;

export type ProductiveDomain =
  | 'ENERGY'
  | 'COMPUTE'
  | 'MANUFACTURING'
  | 'AGRICULTURE'
  | 'LOGISTICS'
  | 'RESOURCES'
  | 'WATER';

export type EventBoundaryStrategy =
  | 'FIXED_INTERVAL'
  | 'BATCH_IDENTIFIER'
  | 'SOURCE_EVENT_ID'
  | 'AGGREGATE_ROLLUP';

export type AggregationLevel = 'LEAF' | 'COMPONENT' | 'AGGREGATE';

/**
 * Wave 5 overlap classification between productive event candidates.
 * Unresolved overlaps must not be treated as distinct monetizable production.
 */
export type OverlapClass =
  | 'EXACT_DUPLICATE'
  | 'SAME_EVENT_CORROBORATION'
  | 'PARTIAL_OVERLAP'
  | 'AGGREGATE_OF'
  | 'COMPONENT_OF'
  | 'DISTINCT_EVENT'
  | 'UNRESOLVED';

export type ReconciliationResolutionStatus =
  | 'RESOLVED'
  | 'UNRESOLVED'
  | 'BLOCKED_AGGREGATION_CONFLICT'
  | 'BLOCKED_QUANTITY_DIVERGENCE';

export type OverlapAssessment = {
  readonly leftEventKey: ProductiveEventKey;
  readonly rightEventKey: ProductiveEventKey;
  readonly overlapClass: OverlapClass;
  readonly confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly rationale: string;
  readonly temporalOverlap: boolean;
  readonly quantityToleranceBps: number | null;
};

export type CandidateProductiveEvent = {
  readonly eventKey: ProductiveEventKey;
  readonly canonicalEntityId: CanonicalEntityId;
  readonly canonicalEventId: CanonicalEventId;
  readonly economicAction: string;
  readonly metric: string;
  readonly quantity: bigint;
  readonly unit: string;
  readonly validFromUtc: UtcInstant;
  readonly validUntilUtc: UtcInstant | null;
  readonly domain: ProductiveDomain;
  readonly aggregationLevel: AggregationLevel;
  readonly observationIds: readonly EconomicObservationId[];
  readonly sourceClasses: readonly string[];
  readonly geographyCommitment?: string;
  readonly batchRunJobId?: string;
  readonly parentEntityCommitment?: string;
};

export type QuantityReconciliation = {
  readonly methodology: string;
  readonly reconciledQuantity: bigint;
  readonly observedQuantities: readonly { readonly observationId: EconomicObservationId; readonly quantity: bigint }[];
  readonly inflationPrevented: boolean;
  readonly summedQuantity: bigint;
};

export type ProductiveEventReconciliationResult = {
  readonly schemaVersion: typeof WAVE5_RECONCILIATION_SCHEMA_VERSION;
  readonly reconciliationId: string;
  readonly methodologyVersion: string;
  readonly candidateEvents: readonly CandidateProductiveEvent[];
  readonly overlapAssessments: readonly OverlapAssessment[];
  readonly canonicalEventKey: ProductiveEventKey | null;
  readonly canonicalEventId: CanonicalEventId | null;
  readonly quantityReconciliation: QuantityReconciliation | null;
  readonly resolutionStatus: ReconciliationResolutionStatus;
  readonly confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly requiresManualReview: boolean;
  readonly evidenceRefs: readonly string[];
  readonly lineage: LineageRecord;
  readonly resolvedAtUtc: UtcInstant;
};

export type ReconciliationFailureCode =
  | 'NO_CANDIDATES'
  | 'UNRESOLVED_OVERLAP'
  | 'AGGREGATION_DOUBLE_COUNT'
  | 'QUANTITY_INFLATION_RISK'
  | 'CLAIM_ALREADY_EXISTS'
  | 'CLUSTER_ALREADY_MONETIZED'
  | 'OBSERVATION_NOT_FOUND';

export type ReconciliationFailure = {
  readonly code: ReconciliationFailureCode;
  readonly message: string;
};
