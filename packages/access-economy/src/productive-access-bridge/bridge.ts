/**
 * ACCESS-19 — Productive Capacity to Access Bridge engine.
 *
 * Orchestrates capacity commitment, pool publication, Access consumption,
 * delivery evidence, and provider settlement. Does not mint MoonRey.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import { checkProductiveAccessInvariants } from './invariants.ts';
import { ACCESS_19_SCHEMA_VERSION } from './ids.ts';
import type {
  AccessCapacityCommitment,
  AccessCapacityPoolLedger,
  AccessDeliveryEvidence,
  AutonomousFleetDemoResult,
  MoonReyIssuanceObservation,
  ProductiveAccessBridgeFailure,
  ProductiveAccessBridgeReconciliation,
  ProductiveAccessInvariantResult,
  ProviderSettlementRecord,
  AccessCapacitySettlementTerms,
  RevocationPolicy,
  VerifiedAvailableCapacity,
} from './types.ts';

export const VEHICLE_HOURS_PER_DAY = 24n;

export type CommitCapacityInput = {
  readonly commitmentId: string;
  readonly providerRef: string;
  readonly productiveObjectRef: string;
  readonly category: string;
  readonly canonicalUnit: string;
  readonly quantity: bigint;
  readonly availabilityWindow: VerifiedAvailableCapacity['availabilityWindow'];
  readonly geography: VerifiedAvailableCapacity['geography'];
  readonly qualityClass: string;
  readonly settlementTerms: AccessCapacitySettlementTerms;
  readonly evidenceRefs: readonly string[];
  readonly oracleRefs: readonly string[];
  readonly expiration: UtcInstant;
  readonly revocationPolicy: RevocationPolicy;
  readonly verifiedContributionRef: string | null;
  readonly createdAt: UtcInstant;
};

export type ConsumeAccessInput = {
  readonly deliveryId: string;
  readonly commitmentId: string;
  readonly subjectRef: string;
  readonly quantity: bigint;
  readonly canonicalUnit: string;
  readonly deliveredAt: UtcInstant;
  readonly evidenceRefs: readonly string[];
  readonly settlementIntentId: string | null;
};

export type SettleProviderInput = {
  readonly settlementId: string;
  readonly deliveryId: string;
  readonly providerRef: string;
  readonly terms: AccessCapacitySettlementTerms;
  readonly settledAt: UtcInstant;
};

export type ProductiveAccessBridgeSnapshot = {
  readonly verifiedCapacities: readonly VerifiedAvailableCapacity[];
  readonly commitments: readonly AccessCapacityCommitment[];
  readonly poolLedgers: readonly AccessCapacityPoolLedger[];
  readonly deliveries: readonly AccessDeliveryEvidence[];
  readonly settlements: readonly ProviderSettlementRecord[];
  readonly moonreyIssuances: readonly MoonReyIssuanceObservation[];
  readonly outputDeliveryFingerprints: Readonly<Record<string, readonly string[]>>;
};

export class ProductiveAccessBridge {
  private verifiedCapacities = new Map<string, VerifiedAvailableCapacity>();
  private commitments = new Map<string, AccessCapacityCommitment>();
  private poolLedgers = new Map<string, AccessCapacityPoolLedger>();
  private deliveries: AccessDeliveryEvidence[] = [];
  private settlements: ProviderSettlementRecord[] = [];
  private moonreyIssuances: MoonReyIssuanceObservation[] = [];
  private outputDeliveryFingerprints = new Map<string, readonly string[]>();
  private moonreyIssuedByAccess = 0n;

  registerVerifiedCapacity(capacity: VerifiedAvailableCapacity): void {
    this.verifiedCapacities.set(capacity.productiveObjectRef, Object.freeze({ ...capacity }));
  }

  observeMoonReyIssuance(observation: MoonReyIssuanceObservation): void {
    if (observation.triggeredByAccess !== false) {
      throw new Error('MoonRey issuance triggered by Access is forbidden');
    }
    const duplicate = this.moonreyIssuances.some(
      (row) => row.contributionFingerprint === observation.contributionFingerprint,
    );
    if (duplicate) {
      throw new Error('DUPLICATE_MOONREY_ISSUANCE');
    }
    this.moonreyIssuances.push(Object.freeze({ ...observation }));
  }

  registerOutputDeliveryLineage(objectRef: string, fingerprints: readonly string[]): void {
    this.outputDeliveryFingerprints.set(objectRef, Object.freeze([...fingerprints]));
  }

  commitCapacity(
    input: CommitCapacityInput,
  ): { readonly ok: true; readonly commitment: AccessCapacityCommitment } | { readonly ok: false; readonly failure: ProductiveAccessBridgeFailure } {
    const capacity = this.verifiedCapacities.get(input.productiveObjectRef);
    if (!capacity) {
      return { ok: false, failure: { code: 'PHANTOM_CAPACITY', message: 'No verified capacity for object' } };
    }
    if (input.oracleRefs.length > 0 && input.evidenceRefs.length === 0 && input.verifiedContributionRef === null) {
      return {
        ok: false,
        failure: { code: 'ORACLE_FACT_ALONE_INSUFFICIENT', message: 'Oracle fact alone cannot commit capacity' },
      };
    }
    const alreadyCommitted = [...this.commitments.values()]
      .filter(
        (row) =>
          row.productiveObjectRef === input.productiveObjectRef &&
          row.status !== 'REVOKED' &&
          row.status !== 'CANCELLED',
      )
      .reduce((sum, row) => sum + row.quantity, 0n);
    const available = capacity.verifiedQuantity - alreadyCommitted;
    if (input.quantity > available) {
      return {
        ok: false,
        failure: {
          code: 'EXCEEDS_VERIFIED_CAPACITY',
          message: `Requested ${input.quantity} exceeds available ${available}`,
        },
      };
    }
    if (input.quantity <= 0n) {
      return { ok: false, failure: { code: 'INVALID_QUANTITY', message: 'Quantity must be positive' } };
    }

    const commitment = Object.freeze({
      schemaVersion: ACCESS_19_SCHEMA_VERSION,
      commitmentId: input.commitmentId,
      providerRef: input.providerRef,
      productiveObjectRef: input.productiveObjectRef,
      category: input.category,
      capacityType: 'CAPACITY' as const,
      canonicalUnit: input.canonicalUnit,
      quantity: input.quantity,
      availabilityWindow: input.availabilityWindow,
      geography: input.geography,
      qualityClass: input.qualityClass,
      settlementTerms: input.settlementTerms,
      evidenceRefs: Object.freeze([...input.evidenceRefs]),
      oracleRefs: Object.freeze([...input.oracleRefs]),
      expiration: input.expiration,
      revocationPolicy: input.revocationPolicy,
      status: 'ACTIVE' as const,
      verifiedContributionRef: input.verifiedContributionRef,
      createdAt: input.createdAt,
    });

    this.commitments.set(commitment.commitmentId, commitment);
    const poolId = `pool.${commitment.commitmentId}`;
    this.poolLedgers.set(
      poolId,
      Object.freeze({
        poolId,
        commitmentId: commitment.commitmentId,
        publishedUnits: commitment.quantity,
        reservedUnits: 0n,
        consumedUnits: 0n,
        remainingUnits: commitment.quantity,
        canonicalUnit: commitment.canonicalUnit,
      }),
    );

    const updated = Object.freeze({
      ...capacity,
      alreadyCommittedQuantity: capacity.alreadyCommittedQuantity + input.quantity,
    });
    this.verifiedCapacities.set(capacity.productiveObjectRef, updated);

    return { ok: true, commitment };
  }

  consumeAccess(
    input: ConsumeAccessInput,
  ): { readonly ok: true; readonly delivery: AccessDeliveryEvidence } | { readonly ok: false; readonly failure: ProductiveAccessBridgeFailure } {
    const commitment = this.commitments.get(input.commitmentId);
    if (!commitment || commitment.status !== 'ACTIVE' && commitment.status !== 'PARTIALLY_CONSUMED') {
      return { ok: false, failure: { code: 'COMMITMENT_NOT_ACTIVE', message: 'Commitment is not active' } };
    }
    const ledger = [...this.poolLedgers.values()].find((row) => row.commitmentId === input.commitmentId);
    if (!ledger) {
      return { ok: false, failure: { code: 'COMMITMENT_NOT_ACTIVE', message: 'Pool ledger missing' } };
    }
    if (input.quantity > ledger.remainingUnits) {
      return {
        ok: false,
        failure: { code: 'INSUFFICIENT_POOL_CAPACITY', message: 'Insufficient pool capacity' },
      };
    }

    const delivery = Object.freeze({
      deliveryId: input.deliveryId,
      commitmentId: input.commitmentId,
      subjectRef: input.subjectRef,
      quantity: input.quantity,
      canonicalUnit: input.canonicalUnit,
      deliveredAt: input.deliveredAt,
      evidenceRefs: Object.freeze([...input.evidenceRefs]),
      settlementIntentId: input.settlementIntentId,
    });
    this.deliveries.push(delivery);

    const consumed = ledger.consumedUnits + input.quantity;
    const remaining = ledger.publishedUnits - consumed - ledger.reservedUnits;
    this.poolLedgers.set(
      ledger.poolId,
      Object.freeze({
        ...ledger,
        consumedUnits: consumed,
        remainingUnits: remaining,
      }),
    );

    const newStatus = remaining === 0n ? 'FULLY_CONSUMED' : 'PARTIALLY_CONSUMED';
    this.commitments.set(
      commitment.commitmentId,
      Object.freeze({ ...commitment, status: newStatus }),
    );

    return { ok: true, delivery };
  }

  settleProvider(
    input: SettleProviderInput,
  ): { readonly ok: true; readonly settlement: ProviderSettlementRecord } | { readonly ok: false; readonly failure: ProductiveAccessBridgeFailure } {
    const delivery = this.deliveries.find((row) => row.deliveryId === input.deliveryId);
    if (!delivery) {
      return { ok: false, failure: { code: 'COMMITMENT_NOT_ACTIVE', message: 'Delivery not found' } };
    }
    if (input.terms.moonreyMinorUnits > 0n && input.terms.kind === 'MOONREY_COIN') {
      const matchingIssuance = this.moonreyIssuances.find(
        (row) => row.moonreyQuantity === input.terms.moonreyMinorUnits,
      );
      if (matchingIssuance) {
        return {
          ok: false,
          failure: {
            code: 'SETTLEMENT_EQUALS_ISSUANCE',
            message: 'Provider MR settlement must not equal productive issuance amount',
          },
        };
      }
    }

    const settlement = Object.freeze({
      settlementId: input.settlementId,
      deliveryId: input.deliveryId,
      providerRef: input.providerRef,
      terms: input.terms,
      settledAt: input.settledAt,
      moonreyIssuanceRef: null,
    });
    this.settlements.push(settlement);
    return { ok: true, settlement };
  }

  reconcile(productiveObjectRef: string): ProductiveAccessBridgeReconciliation {
    const capacity = this.verifiedCapacities.get(productiveObjectRef);
    const objectCommitments = [...this.commitments.values()].filter(
      (row) => row.productiveObjectRef === productiveObjectRef,
    );
    const objectLedgers = [...this.poolLedgers.values()].filter((ledger) =>
      objectCommitments.some((commitment) => commitment.commitmentId === ledger.commitmentId),
    );
    const verifiedAvailable = capacity?.verifiedQuantity ?? 0n;
    const totalCommitted = objectCommitments
      .filter((row) => row.status !== 'REVOKED' && row.status !== 'CANCELLED')
      .reduce((sum, row) => sum + row.quantity, 0n);
    const totalConsumed = objectLedgers.reduce((sum, row) => sum + row.consumedUnits, 0n);
    const remainingPool = objectLedgers.reduce((sum, row) => sum + row.remainingUnits, 0n);
    const remainingVerified = verifiedAvailable - totalCommitted;
    return Object.freeze({
      productiveObjectRef,
      verifiedAvailableUnits: verifiedAvailable,
      totalCommittedUnits: totalCommitted,
      totalConsumedUnits: totalConsumed,
      remainingVerifiedUnits: remainingVerified,
      remainingPoolUnits: remainingPool,
      canonicalUnit: capacity?.canonicalUnit ?? 'unknown',
      reconciled: remainingVerified >= 0n && remainingPool === totalCommitted - totalConsumed,
    });
  }

  checkInvariants(): readonly ProductiveAccessInvariantResult[] {
    return checkProductiveAccessInvariants({
      verifiedCapacities: [...this.verifiedCapacities.values()],
      commitments: [...this.commitments.values()],
      poolLedgers: [...this.poolLedgers.values()],
      deliveries: this.deliveries,
      settlements: this.settlements,
      moonreyIssuances: this.moonreyIssuances,
      moonreyIssuedByAccess: this.moonreyIssuedByAccess,
      outputDeliveryFingerprints: this.outputDeliveryFingerprints,
    });
  }

  totalMoonReyIssued(): bigint {
    return this.moonreyIssuances.reduce((sum, row) => sum + row.moonreyQuantity, 0n);
  }

  snapshot(): ProductiveAccessBridgeSnapshot {
    return Object.freeze({
      verifiedCapacities: Object.freeze([...this.verifiedCapacities.values()]),
      commitments: Object.freeze([...this.commitments.values()]),
      poolLedgers: Object.freeze([...this.poolLedgers.values()]),
      deliveries: Object.freeze([...this.deliveries]),
      settlements: Object.freeze([...this.settlements]),
      moonreyIssuances: Object.freeze([...this.moonreyIssuances]),
      outputDeliveryFingerprints: Object.freeze(Object.fromEntries(this.outputDeliveryFingerprints)),
    });
  }
}

export function vehicleDaysToHours(days: bigint): bigint {
  return days * VEHICLE_HOURS_PER_DAY;
}

export function runAutonomousFleetBridgeDemo(input: {
  readonly bridge: ProductiveAccessBridge;
  readonly verifiedCapacity: VerifiedAvailableCapacity;
  readonly moonreyBefore: bigint;
  readonly moonreyAfter: bigint;
  readonly moonreyIssuance: MoonReyIssuanceObservation;
}): AutonomousFleetDemoResult {
  const {
    bridge,
    verifiedCapacity,
    moonreyBefore,
    moonreyAfter,
    moonreyIssuance,
  } = input;

  bridge.registerVerifiedCapacity(verifiedCapacity);
  bridge.observeMoonReyIssuance(moonreyIssuance);

  const committed = bridge.commitCapacity({
    commitmentId: 'commit.fleet.access',
    providerRef: verifiedCapacity.providerRef,
    productiveObjectRef: verifiedCapacity.productiveObjectRef,
    category: verifiedCapacity.category,
    canonicalUnit: 'vehicle_hour',
    quantity: 10_000n,
    availabilityWindow: verifiedCapacity.availabilityWindow,
    geography: verifiedCapacity.geography,
    qualityClass: verifiedCapacity.qualityClass,
    settlementTerms: Object.freeze({
      kind: 'MIXED',
      currency: 'USD',
      fiatMinorUnits: 28_000n,
      sunreyMinorUnits: 0n,
      moonreyMinorUnits: 500n,
      contractRef: 'contract.fleet.access.sim',
    }),
    evidenceRefs: Object.freeze(['evidence.fleet.capacity.verified']),
    oracleRefs: Object.freeze(['oracle.fleet.capacity.finalized']),
    expiration: verifiedCapacity.availabilityWindow.validUntil,
    revocationPolicy: Object.freeze({
      cancellableByProvider: true,
      cancellableByPlatform: true,
      refundOnRevocation: true,
      noticePeriodSeconds: 86_400n,
    }),
    verifiedContributionRef: verifiedCapacity.contributionFingerprint,
    createdAt: verifiedCapacity.observedAt,
  });
  if (!committed.ok) {
    throw new Error(`commit failed: ${committed.failure.message}`);
  }

  const consumedVehicleDays = 4n;
  const consumedVehicleHours = vehicleDaysToHours(consumedVehicleDays);
  const consumed = bridge.consumeAccess({
    deliveryId: 'delivery.fleet.001',
    commitmentId: committed.commitment.commitmentId,
    subjectRef: 'subject.participant.001',
    quantity: consumedVehicleHours,
    canonicalUnit: 'vehicle_hour',
    deliveredAt: verifiedCapacity.observedAt,
    evidenceRefs: Object.freeze(['evidence.delivery.fleet.trip']),
    settlementIntentId: 'settlement.intent.fleet.001',
  });
  if (!consumed.ok) {
    throw new Error(`consume failed: ${consumed.failure.message}`);
  }

  const settled = bridge.settleProvider({
    settlementId: 'settlement.fleet.001',
    deliveryId: consumed.delivery.deliveryId,
    providerRef: verifiedCapacity.providerRef,
    terms: Object.freeze({
      kind: 'MIXED',
      currency: 'USD',
      fiatMinorUnits: 10_920n,
      sunreyMinorUnits: 0n,
      moonreyMinorUnits: 200n,
      contractRef: 'contract.fleet.delivery.sim',
    }),
    settledAt: verifiedCapacity.observedAt,
  });
  if (!settled.ok) {
    throw new Error(`settlement failed: ${settled.failure.message}`);
  }

  const reconciliation = bridge.reconcile(verifiedCapacity.productiveObjectRef);
  const invariants = bridge.checkInvariants();

  return Object.freeze({
    exampleId: 'AUTONOMOUS_VEHICLE_FLEET',
    totalVerifiedVehicleHours: verifiedCapacity.verifiedQuantity,
    committedVehicleHours: 10_000n,
    consumedVehicleDays,
    consumedVehicleHours,
    remainingVerifiedVehicleHours: reconciliation.remainingVerifiedUnits,
    remainingPoolVehicleHours: reconciliation.remainingPoolUnits,
    providerSettlement: settled.settlement,
    deliveryEvidence: consumed.delivery,
    moonreyIssuanceBefore: moonreyBefore,
    moonreyIssuanceAfter: moonreyAfter,
    moonreyIssuedByAccess: 0n,
    invariants,
    invariantsHeld: invariants.every((row) => row.held),
    reconciliation,
  });
}
