import type { UtcInstant } from '../../../domain/src/time.ts';
import { asContractId, type ExchangeAccountId, type ExchangeMarketId, type OrderId } from '../ids.ts';
import type { ExchangePrice } from '../price.ts';
import type {
  CapacityAccessTerms,
  CapacityDeliveryEvidence,
  CapacityReservation,
  ConsiderationTerms,
} from './types.ts';
import type {
  CapacityReservationState,
  CapacityTradeMechanism,
  DeliveryEvidenceQuality,
} from './taxonomy.ts';

/**
 * Capacity reservation lifecycle.
 *
 * A reservation records commitments and rail references only. It deliberately
 * has no balance, available, or holdings field: fiat position is read from the
 * canonical Ledger, native-asset position from custody or chain, and entitlement
 * position from the entitlement owner.
 */
const PERMITTED_TRANSITIONS: {
  readonly [K in CapacityReservationState]: readonly CapacityReservationState[];
} = Object.freeze({
  REQUESTED: ['POLICY_REFUSED', 'CONSIDERATION_RESERVED', 'CANCELLED', 'FAILED'],
  POLICY_REFUSED: [],
  CONSIDERATION_RESERVED: ['CONFIRMED', 'CANCELLED', 'EXPIRED', 'FAILED', 'REQUIRES_COMPENSATION'],
  CONFIRMED: [
    'PARTIALLY_DELIVERED',
    'DELIVERED',
    'CANCELLED',
    'EXPIRED',
    'FAILED',
    'REQUIRES_COMPENSATION',
  ],
  PARTIALLY_DELIVERED: ['PARTIALLY_DELIVERED', 'DELIVERED', 'REFUNDED', 'FAILED', 'REQUIRES_COMPENSATION'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: ['REFUNDED'],
  EXPIRED: ['REFUNDED'],
  REFUNDED: [],
  FAILED: ['REFUNDED', 'REQUIRES_COMPENSATION'],
  REQUIRES_COMPENSATION: ['REFUNDED', 'FAILED'],
});

export function openCapacityReservation(input: {
  readonly reservationId: string;
  readonly marketId: ExchangeMarketId;
  readonly mechanism: CapacityTradeMechanism;
  readonly buyerAccountId: ExchangeAccountId;
  readonly providerAccountId: ExchangeAccountId;
  readonly terms: CapacityAccessTerms;
  readonly reservedQuantity: bigint;
  readonly unitPrice: ExchangePrice;
  readonly consideration: ConsiderationTerms;
  readonly sourceOrderId?: OrderId | null;
  readonly at: UtcInstant;
}): CapacityReservation {
  if (input.reservedQuantity <= 0n) {
    throw new TypeError('a capacity reservation requires a positive quantity');
  }
  if (input.reservedQuantity > input.terms.quantity) {
    throw new TypeError('reserved quantity exceeds the listed capacity quantity');
  }
  return Object.freeze({
    reservationId: input.reservationId,
    contractId: asContractId(`xcon_${input.reservationId}`),
    marketId: input.marketId,
    mechanism: input.mechanism,
    buyerAccountId: input.buyerAccountId,
    providerAccountId: input.providerAccountId,
    terms: input.terms,
    reservedQuantity: input.reservedQuantity,
    deliveredQuantity: 0n,
    unitPrice: input.unitPrice,
    consideration: input.consideration,
    state: 'REQUESTED',
    escrowId: null,
    sourceOrderId: input.sourceOrderId ?? null,
    createdAt: input.at,
    updatedAt: input.at,
  });
}

export function canTransition(
  from: CapacityReservationState,
  to: CapacityReservationState,
): boolean {
  return PERMITTED_TRANSITIONS[from].includes(to);
}

export function transitionReservation(
  reservation: CapacityReservation,
  to: CapacityReservationState,
  at: UtcInstant,
  patch: {
    readonly deliveredQuantity?: bigint;
    readonly escrowId?: CapacityReservation['escrowId'];
  } = {},
): CapacityReservation {
  if (!canTransition(reservation.state, to)) {
    throw new TypeError(`capacity reservation cannot move from ${reservation.state} to ${to}`);
  }
  const delivered = patch.deliveredQuantity ?? reservation.deliveredQuantity;
  if (delivered > reservation.reservedQuantity) {
    throw new TypeError('delivered quantity cannot exceed the reserved quantity');
  }
  return Object.freeze({
    ...reservation,
    state: to,
    deliveredQuantity: delivered,
    escrowId: patch.escrowId ?? reservation.escrowId,
    updatedAt: at,
  });
}

export function capacityDeliveryEvidence(input: {
  readonly evidenceId: string;
  readonly reservationId: string;
  readonly deliveredQuantity: bigint;
  readonly unit: string;
  readonly quality: DeliveryEvidenceQuality;
  readonly oracleFactIds?: readonly string[];
  readonly productiveClaimId?: string | null;
  readonly at: UtcInstant;
}): CapacityDeliveryEvidence {
  if (input.deliveredQuantity <= 0n) {
    throw new TypeError('delivery evidence requires a positive delivered quantity');
  }
  return Object.freeze({
    evidenceId: input.evidenceId,
    reservationId: input.reservationId,
    deliveredQuantity: input.deliveredQuantity,
    unit: input.unit,
    quality: input.quality,
    oracleFactIds: Object.freeze([...(input.oracleFactIds ?? [])]),
    productiveClaimId: input.productiveClaimId ?? null,
    attestedAt: input.at,
  });
}

/**
 * Whether attested delivery satisfies the term sheet. Unit mismatch, an
 * unaccepted evidence quality, or a missing oracle fact where one is required
 * all refuse; they do not degrade to a self-report.
 */
export function deliveryEvidenceAccepted(
  reservation: CapacityReservation,
  evidence: CapacityDeliveryEvidence,
): { readonly accepted: boolean; readonly reasons: readonly string[] } {
  const reasons: string[] = [];
  const requirements = reservation.terms.deliveryRequirements;
  if (evidence.unit !== reservation.terms.unit) {
    reasons.push('unit mismatch');
  }
  if (!requirements.acceptedEvidenceQualities.includes(evidence.quality)) {
    reasons.push(`evidence quality ${evidence.quality} is not accepted`);
  }
  if (requirements.requiresOracleAttestation && evidence.oracleFactIds.length === 0) {
    reasons.push('oracle attestation is required');
  }
  const total = reservation.deliveredQuantity + evidence.deliveredQuantity;
  if (total > reservation.reservedQuantity) {
    reasons.push('delivery exceeds the reserved quantity');
  }
  if (
    !requirements.partialDeliveryAllowed &&
    evidence.deliveredQuantity !== reservation.reservedQuantity
  ) {
    reasons.push('partial delivery is not allowed for these terms');
  }
  return Object.freeze({ accepted: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function undeliveredQuantity(reservation: CapacityReservation): bigint {
  return reservation.reservedQuantity - reservation.deliveredQuantity;
}
