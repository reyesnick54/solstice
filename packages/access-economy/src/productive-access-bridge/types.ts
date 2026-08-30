/**
 * ACCESS-19 — MoonRey Productive Capacity to Access Bridge types.
 *
 * Productive contribution evidence, MoonRey issuance, provider settlement,
 * capacity commitment, and Access delivery remain distinct concerns.
 * A capacity commitment does not mint MoonRey.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  ACCESS_19_SCHEMA_VERSION,
  AccessCapacityCommitmentStatus,
  ProductiveAccessBridgeInvariantId,
  ProductiveAccessExampleId,
  ProviderSettlementKind,
} from './ids.ts';

/** Reference to a productive object or provider operator. */
export type ProductiveObjectRef = string;
export type ProviderRef = string;

export type AvailabilityWindow = {
  readonly validFrom: UtcInstant;
  readonly validUntil: UtcInstant;
};

export type GeographyRef = {
  readonly geographyId: string;
  readonly jurisdiction: string;
};

export type ProviderSettlementTerms = {
  readonly kind: ProviderSettlementKind;
  readonly currency: string;
  /** Integer minor units for FIAT/SR legs; MR uses canonical minor units. */
  readonly fiatMinorUnits: bigint;
  readonly sunreyMinorUnits: bigint;
  readonly moonreyMinorUnits: bigint;
  readonly contractRef: string;
};

export type RevocationPolicy = {
  readonly cancellableByProvider: boolean;
  readonly cancellableByPlatform: boolean;
  readonly refundOnRevocation: boolean;
  readonly noticePeriodSeconds: bigint;
};

/**
 * Commitment of existing verified productive capacity to the Access pool.
 * This is not MoonRey issuance and does not convey ownership.
 */
export type AccessCapacityCommitment = {
  readonly schemaVersion: typeof ACCESS_19_SCHEMA_VERSION;
  readonly commitmentId: string;
  readonly providerRef: ProviderRef;
  readonly productiveObjectRef: ProductiveObjectRef;
  readonly category: string;
  readonly capacityType: 'CAPACITY';
  readonly canonicalUnit: string;
  readonly quantity: bigint;
  readonly availabilityWindow: AvailabilityWindow;
  readonly geography: GeographyRef;
  readonly qualityClass: string;
  readonly settlementTerms: ProviderSettlementTerms;
  readonly evidenceRefs: readonly string[];
  readonly oracleRefs: readonly string[];
  readonly expiration: UtcInstant;
  readonly revocationPolicy: RevocationPolicy;
  readonly status: AccessCapacityCommitmentStatus;
  readonly verifiedContributionRef: string | null;
  readonly createdAt: UtcInstant;
};

/** Verified productive capacity available for commitment (read from canonical owners). */
export type VerifiedAvailableCapacity = {
  readonly capacityId: string;
  readonly providerRef: ProviderRef;
  readonly productiveObjectRef: ProductiveObjectRef;
  readonly category: string;
  readonly canonicalUnit: string;
  readonly verifiedQuantity: bigint;
  readonly alreadyCommittedQuantity: bigint;
  readonly availabilityWindow: AvailabilityWindow;
  readonly geography: GeographyRef;
  readonly qualityClass: string;
  readonly evidenceRefs: readonly string[];
  readonly oracleRefs: readonly string[];
  readonly contributionFingerprint: string | null;
  readonly observedAt: UtcInstant;
};

export type AccessCapacityPoolLedger = {
  readonly poolId: string;
  readonly commitmentId: string;
  readonly publishedUnits: bigint;
  readonly reservedUnits: bigint;
  readonly consumedUnits: bigint;
  readonly remainingUnits: bigint;
  readonly canonicalUnit: string;
};

export type AccessDeliveryEvidence = {
  readonly deliveryId: string;
  readonly commitmentId: string;
  readonly subjectRef: string;
  readonly quantity: bigint;
  readonly canonicalUnit: string;
  readonly deliveredAt: UtcInstant;
  readonly evidenceRefs: readonly string[];
  readonly settlementIntentId: string | null;
};

export type ProviderSettlementRecord = {
  readonly settlementId: string;
  readonly deliveryId: string;
  readonly providerRef: ProviderRef;
  readonly terms: ProviderSettlementTerms;
  readonly settledAt: UtcInstant;
  readonly moonreyIssuanceRef: null;
};

export type MoonReyIssuanceObservation = {
  readonly issuanceId: string;
  readonly contributionFingerprint: string;
  readonly moonreyQuantity: bigint;
  readonly issuedAt: UtcInstant;
  readonly triggeredByAccess: false;
};

export type ProductiveAccessBridgeReconciliation = {
  readonly productiveObjectRef: ProductiveObjectRef;
  readonly verifiedAvailableUnits: bigint;
  readonly totalCommittedUnits: bigint;
  readonly totalConsumedUnits: bigint;
  readonly remainingVerifiedUnits: bigint;
  readonly remainingPoolUnits: bigint;
  readonly canonicalUnit: string;
  readonly reconciled: boolean;
};

export type ProductiveAccessInvariantResult = {
  readonly invariant: ProductiveAccessBridgeInvariantId;
  readonly statement: string;
  readonly held: boolean;
  readonly evidence: string;
};

export type AutonomousFleetDemoResult = {
  readonly exampleId: ProductiveAccessExampleId;
  readonly totalVerifiedVehicleHours: bigint;
  readonly committedVehicleHours: bigint;
  readonly consumedVehicleDays: bigint;
  readonly consumedVehicleHours: bigint;
  readonly remainingVerifiedVehicleHours: bigint;
  readonly remainingPoolVehicleHours: bigint;
  readonly providerSettlement: ProviderSettlementRecord;
  readonly deliveryEvidence: AccessDeliveryEvidence;
  readonly moonreyIssuanceBefore: bigint;
  readonly moonreyIssuanceAfter: bigint;
  readonly moonreyIssuedByAccess: 0n;
  readonly invariants: readonly ProductiveAccessInvariantResult[];
  readonly invariantsHeld: boolean;
  readonly reconciliation: ProductiveAccessBridgeReconciliation;
};

export type ProductiveAccessBridgeFailureCode =
  | 'EXCEEDS_VERIFIED_CAPACITY'
  | 'DOUBLE_CAPACITY_COMMITMENT'
  | 'DOUBLE_MOONREY_ISSUANCE'
  | 'OUTPUT_DELIVERY_DOUBLE_COUNT'
  | 'PHANTOM_CAPACITY'
  | 'ORACLE_FACT_ALONE_INSUFFICIENT'
  | 'COMMITMENT_NOT_ACTIVE'
  | 'INSUFFICIENT_POOL_CAPACITY'
  | 'SETTLEMENT_EQUALS_ISSUANCE'
  | 'INVALID_QUANTITY';

export type ProductiveAccessBridgeFailure = {
  readonly code: ProductiveAccessBridgeFailureCode;
  readonly message: string;
};
