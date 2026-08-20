/**
 * Chunk 122 — MoonRey productive attribution accounting.
 *
 * This is a non-monetary record of which portion of a verified productive
 * event has already been assigned to which contribution. It is not
 * AssetSupplyBook, a customer ledger, a wallet balance, MoonRey supply,
 * or an Exchange balance.
 *
 * Canonical owner remains packages/sunrey-chain/src/productive/policy-governance.
 * Event identity (Chunk 120) and attribution policy (Chunk 121) are consumed
 * as inputs. This layer does not mint, value, or settle MoonRey.
 */

import type { ClaimType, ProductiveCategory } from '../../types.ts';

export const ATTRIBUTION_ACCOUNTING_SCHEMA_VERSION = 1 as const;
export const ATTRIBUTION_ACCOUNTING_DOMAIN = 'SUNREY_MOONREY_ATTRIBUTION_BOOK_V1' as const;
export const ATTRIBUTION_SHARE_SCALE = 1_000_000n;
export const DEFAULT_MAXIMUM_AGGREGATE_SHARE = ATTRIBUTION_SHARE_SCALE;
export const TIME_WINDOW_QUANTUM_SECONDS = 60n;
export const ATTRIBUTION_BOOK_IS_MONETARY_LEDGER = false;
export const ATTRIBUTION_BOOK_STORES_MOONREY_BALANCE = false;
export const ATTRIBUTION_PRODUCTION_ACTIVE = false;

export const ATTRIBUTION_ENTRY_STATUSES = [
  'RESERVED',
  'FINALIZED',
  'RELEASED_BY_CORRECTION',
  'SUPERSEDED',
] as const;
export type AttributionEntryStatus = (typeof ATTRIBUTION_ENTRY_STATUSES)[number];

export const ATTRIBUTION_ISSUANCE_STATUSES = [
  'NOT_VALUED',
  'VALUED',
  'AUTHORIZED',
  'SETTLED',
] as const;
export type AttributionIssuanceStatus = (typeof ATTRIBUTION_ISSUANCE_STATUSES)[number];

export const ATTRIBUTION_REJECTION_CODES = [
  'ATTRIBUTION_DECISION_REQUIRED',
  'ATTRIBUTION_SHARE_EXHAUSTED',
  'EVENT_OVERALLOCATED',
  'EVENT_REPLAY',
  'CLAIM_REPLAY',
  'CONTRIBUTION_REPLAY',
  'OVERLAPPING_WINDOW_DUPLICATE',
  'BATCH_SPLIT_OVERALLOCATION',
  'BATCH_MERGE_DUPLICATE',
  'CATEGORY_RELABEL_DUPLICATE',
  'OBJECT_RELABEL_DUPLICATE',
  'CONTROLLER_RELABEL_DUPLICATE',
  'CORRECTION_REQUIRED',
  'MONETARY_ADJUSTMENT_REVIEW_REQUIRED',
  'ATTRIBUTION_POLICY_VERSION_MISMATCH',
] as const;
export type AttributionRejectionCode = (typeof ATTRIBUTION_REJECTION_CODES)[number];

export const ATTRIBUTION_SENSITIVE_CATEGORIES = [
  'MANUFACTURING',
  'GOODS',
  'AUTOMATED_MACHINE_OUTPUT',
  'COMPUTE',
  'AI_COMPUTE',
] as const satisfies readonly ProductiveCategory[];

export const INDEPENDENT_SERVICE_CATEGORIES = [
  'LOGISTICS_TRANSPORTATION',
  'STORAGE',
  'SERVICES',
] as const satisfies readonly ProductiveCategory[];

export const BATCH_LINEAGE_KINDS = ['SPLIT', 'MERGE', 'LOT_AGGREGATION'] as const;
export type BatchLineageKind = (typeof BATCH_LINEAGE_KINDS)[number];

export type AttributionBatchLineage = {
  readonly kind: BatchLineageKind;
  readonly parentEventIds: readonly string[];
  readonly childEventIds: readonly string[];
};

/**
 * Policy decision consumed by the book. Chunk 121 owns policy; this record
 * is the accounting input, not a second policy engine.
 */
export type ProductiveAttributionDecision = {
  readonly schemaVersion: typeof ATTRIBUTION_ACCOUNTING_SCHEMA_VERSION;
  readonly attributionDecisionId: string;
  readonly attributionPolicyVersion: number;
  readonly economicEventId: string;
  readonly eventFingerprint: string;
  readonly claimId: string;
  readonly contributionId: string;
  readonly category: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly allocatedShare: bigint;
  readonly maximumAggregateShare: bigint;
  readonly relatedEventIds: readonly string[];
  readonly relatedContributionIds: readonly string[];
  readonly independentlyEvidenced: boolean;
  readonly attributionSensitive: boolean;
  readonly policyAccepts: true;
};

export type AttributionEventObservation = {
  readonly economicEventId: string;
  readonly claimId: string;
  readonly contributionId: string;
  readonly category: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly objectId: string;
  readonly controllerId: string;
  readonly providerId: string;
  readonly geographyId: string;
  readonly sourceUnitId: string;
  readonly sourceQuantity: bigint;
  readonly validFromUnixSeconds: bigint;
  readonly validUntilUnixSeconds: bigint;
  readonly oracleFactIds: readonly string[];
  readonly batchId?: string | undefined;
  readonly lotId?: string | undefined;
  readonly lineage?: AttributionBatchLineage | undefined;
  readonly independentlyEvidenced?: boolean | undefined;
};

export type AttributionReservationRequest = {
  readonly observation: AttributionEventObservation;
  readonly decision: ProductiveAttributionDecision;
  readonly expectedPolicyVersion: number;
};

export type ProductiveAttributionEntry = {
  readonly schemaVersion: typeof ATTRIBUTION_ACCOUNTING_SCHEMA_VERSION;
  readonly entryId: string;
  readonly economicEventId: string;
  readonly eventFingerprint: string;
  readonly claimId: string;
  readonly contributionId: string;
  readonly category: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly attributionPolicyVersion: number;
  readonly attributionDecisionId: string;
  readonly allocatedShare: bigint;
  readonly remainingShareAtCommit: bigint;
  readonly relatedEventIds: readonly string[];
  readonly relatedContributionIds: readonly string[];
  readonly status: AttributionEntryStatus;
  readonly issuanceStatus: AttributionIssuanceStatus;
  readonly independentlyEvidenced: boolean;
  readonly observation: AttributionEventObservation;
  readonly replayKeys: AttributionReplayKeys;
  readonly createdAtSeq: number;
  readonly supersededByEntryId: string | null;
  readonly releasedByCorrectionId: string | null;
  readonly monetaryAdjustmentReviewRequired: boolean;
  readonly isMonetaryLedger: false;
  readonly storesMoonReyBalance: false;
};

export type AttributionReplayKeys = {
  readonly idempotencyKey: string;
  readonly eventFingerprint: string;
  readonly observationFingerprint: string;
  readonly evidenceFingerprint: string;
  readonly categoryStrippedFingerprint: string;
  readonly objectStrippedFingerprint: string;
  readonly controllerStrippedFingerprint: string;
  readonly claimReplayKey: string;
  readonly contributionReplayKey: string;
  readonly quantizedWindowKey: string;
};

export type AttributionCorrectionRecord = {
  readonly schemaVersion: typeof ATTRIBUTION_ACCOUNTING_SCHEMA_VERSION;
  readonly correctionId: string;
  readonly targetEntryId: string;
  readonly reason: string;
  readonly evidenceIds: readonly string[];
  readonly replacementDecisionId: string | null;
  readonly replacementEntryId: string | null;
  readonly releasedShare: bigint;
  readonly rewritesHistory: false;
  readonly silentlyErasesFinalizedEvidence: false;
  readonly clawbackExecuted: false;
  readonly monetaryAdjustmentReviewRequired: boolean;
  readonly createdAtSeq: number;
};

export type AttributionInvariantViolation = {
  readonly code: AttributionRejectionCode | 'AGGREGATE_SHARE_EXCEEDED';
  readonly economicEventId: string;
  readonly detail: string;
};

export type ProductiveAttributionReconciliationReport = {
  readonly schemaVersion: typeof ATTRIBUTION_ACCOUNTING_SCHEMA_VERSION;
  readonly eventsAnalyzed: number;
  readonly claimsAnalyzed: number;
  readonly contributionsAnalyzed: number;
  readonly fullyAttributedEvents: number;
  readonly partiallyAttributedEvents: number;
  readonly overAllocatedEvents: number;
  readonly unattributedEvents: number;
  readonly ambiguousEvents: number;
  readonly duplicateAttempts: number;
  readonly replayAttempts: number;
  readonly overlappingWindowAttempts: number;
  readonly batchSplitEvents: number;
  readonly corrections: number;
  readonly settledCorrectionsRequiringReview: number;
  readonly invariantViolations: readonly AttributionInvariantViolation[];
  readonly isMonetaryLedger: false;
};

export type AttributionOk<T> = {
  readonly ok: true;
  readonly value: T;
  readonly idempotentReplay: boolean;
};

export type AttributionFailure = {
  readonly ok: false;
  readonly code: AttributionRejectionCode;
  readonly detail: string;
};

export type AttributionResult<T> = AttributionOk<T> | AttributionFailure;

export function attributionFailure(code: AttributionRejectionCode, detail: string): AttributionFailure {
  return Object.freeze({ ok: false, code, detail });
}

export function isAttributionSensitiveCategory(category: ProductiveCategory): boolean {
  return (ATTRIBUTION_SENSITIVE_CATEGORIES as readonly string[]).includes(category);
}

export function isIndependentServiceCategory(category: ProductiveCategory): boolean {
  return (INDEPENDENT_SERVICE_CATEGORIES as readonly string[]).includes(category);
}
