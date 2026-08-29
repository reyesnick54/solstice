import { err, ok, type Result } from '../../../domain/src/result.ts';
import { commitCanonical } from '../hash.ts';
import { commitAccessDomain, quantityLabel, unixSecondsLabel } from './commitments.ts';
import { ACCESS_COMMITMENT_DOMAINS, type AccessRightState } from './taxonomy.ts';
import type {
  AccessChainFailure,
  AccessChainState,
  AccessCommittedEvent,
  AccessDeliveryProjection,
  AccessReservationProjection,
  AccessRightProjection,
  AccessSettlementProjection,
  AccessUsageProjection,
} from './types.ts';

/**
 * Deterministic Access Fabric state.
 *
 * Every transition is a pure function of the prior state and the committed
 * event. There is no clock, no random source, and no chain lookup here, so two
 * nodes that replay the same event log reach byte-identical state.
 */

export function emptyAccessChainState(): AccessChainState {
  return {
    schemaVersion: 1,
    sequence: 0,
    rights: new Map(),
    reservations: new Map(),
    usages: new Map(),
    deliveries: new Map(),
    settlements: new Map(),
    commitmentKeys: new Set(),
  };
}

/** Expiry is derived from time, not from a separate event. */
export function effectiveRightState(
  right: AccessRightProjection,
  blockTimeUnixSeconds: bigint,
): AccessRightState {
  if (right.state === 'REVOKED') {
    return 'REVOKED';
  }
  if (blockTimeUnixSeconds >= right.expiresAtUnixSeconds) {
    return 'EXPIRED';
  }
  return 'ACTIVE';
}

export function availableCapacity(right: AccessRightProjection): bigint {
  return right.capacityQuantity - right.reservedQuantity - right.consumedQuantity;
}

type MutableState = {
  sequence: number;
  rights: Map<string, AccessRightProjection>;
  reservations: Map<string, AccessReservationProjection>;
  usages: Map<string, AccessUsageProjection>;
  deliveries: Map<string, AccessDeliveryProjection>;
  settlements: Map<string, AccessSettlementProjection>;
  commitmentKeys: Set<string>;
};

function fork(state: AccessChainState): MutableState {
  return {
    sequence: state.sequence,
    rights: new Map(state.rights),
    reservations: new Map(state.reservations),
    usages: new Map(state.usages),
    deliveries: new Map(state.deliveries),
    settlements: new Map(state.settlements),
    commitmentKeys: new Set(state.commitmentKeys),
  };
}

function seal(next: MutableState): AccessChainState {
  return {
    schemaVersion: 1,
    sequence: next.sequence,
    rights: next.rights,
    reservations: next.reservations,
    usages: next.usages,
    deliveries: next.deliveries,
    settlements: next.settlements,
    commitmentKeys: next.commitmentKeys,
  };
}

function failure(code: AccessChainFailure['code'], message: string): AccessChainFailure {
  return { code, message };
}

function requireActiveRight(
  next: MutableState,
  rightId: string,
  blockTimeUnixSeconds: bigint,
): Result<AccessRightProjection, AccessChainFailure> {
  const right = next.rights.get(rightId);
  if (!right) {
    return err(failure('ACCESS_RIGHT_UNKNOWN', `right ${rightId} does not exist`));
  }
  const state = effectiveRightState(right, blockTimeUnixSeconds);
  if (state === 'REVOKED') {
    return err(failure('ACCESS_RIGHT_REVOKED', `right ${rightId} is revoked`));
  }
  if (state === 'EXPIRED') {
    return err(failure('ACCESS_RIGHT_EXPIRED', `right ${rightId} expired`));
  }
  if (blockTimeUnixSeconds < right.validFromUnixSeconds) {
    return err(failure('ACCESS_RIGHT_NOT_STARTED', `right ${rightId} is not yet valid`));
  }
  return ok(right);
}

// eslint-disable-next-line complexity -- one transition table; splitting it hides the state machine
export function applyAccessEvent(
  state: AccessChainState,
  event: AccessCommittedEvent,
): Result<AccessChainState, AccessChainFailure> {
  if (event.sequence !== state.sequence + 1) {
    return err(
      failure(
        'ACCESS_SEQUENCE_INVALID',
        `expected sequence ${state.sequence + 1} and received ${event.sequence}`,
      ),
    );
  }
  if (state.commitmentKeys.has(event.commitmentKey)) {
    return err(failure('ACCESS_DUPLICATE_COMMITMENT', 'commitment key was already applied'));
  }
  const next = fork(state);
  const payload = event.payload;

  switch (payload.kind) {
    case 'ACCESS_RIGHT_CREATED': {
      if (next.rights.has(payload.rightId)) {
        return err(failure('ACCESS_RIGHT_ALREADY_EXISTS', `right ${payload.rightId} already exists`));
      }
      if (payload.capacityQuantity <= 0n) {
        return err(failure('ACCESS_TARGET_QUANTITY_INVALID', 'capacity must be a positive integer'));
      }
      if (payload.expiresAtUnixSeconds <= payload.validFromUnixSeconds) {
        return err(failure('ACCESS_RIGHT_WINDOW_INVALID', 'expiry must follow the start of validity'));
      }
      next.rights.set(payload.rightId, {
        rightId: payload.rightId,
        rightClass: payload.rightClass,
        state: 'ACTIVE',
        productiveObjectId: payload.productiveObjectId,
        capacityUnit: payload.capacityUnit,
        capacityQuantity: payload.capacityQuantity,
        reservedQuantity: 0n,
        consumedQuantity: 0n,
        holderCommitment: payload.holderCommitment,
        issuerActorRef: payload.issuerActorRef,
        scopeCommitment: payload.scopeCommitment,
        validFromUnixSeconds: payload.validFromUnixSeconds,
        expiresAtUnixSeconds: payload.expiresAtUnixSeconds,
        revokedAtUnixSeconds: null,
        transferable: payload.transferable,
        conveysOwnership: false,
      });
      break;
    }

    case 'ACCESS_RIGHT_REVOKED': {
      const right = next.rights.get(payload.rightId);
      if (!right) {
        return err(failure('ACCESS_RIGHT_UNKNOWN', `right ${payload.rightId} does not exist`));
      }
      if (right.state === 'REVOKED') {
        return err(failure('ACCESS_RIGHT_REVOKED', `right ${payload.rightId} is already revoked`));
      }
      if (effectiveRightState(right, event.blockTimeUnixSeconds) === 'EXPIRED') {
        return err(failure('ACCESS_RIGHT_EXPIRED', `right ${payload.rightId} already expired`));
      }
      next.rights.set(payload.rightId, {
        ...right,
        state: 'REVOKED',
        revokedAtUnixSeconds: payload.revokedAtUnixSeconds,
      });
      break;
    }

    case 'RESERVATION_COMMITTED': {
      if (next.reservations.has(payload.reservationId)) {
        return err(
          failure(
            'ACCESS_RESERVATION_ALREADY_EXISTS',
            `reservation ${payload.reservationId} already exists`,
          ),
        );
      }
      const resolved = requireActiveRight(next, payload.rightId, event.blockTimeUnixSeconds);
      if (!resolved.ok) {
        return err(resolved.error);
      }
      const right = resolved.value;
      if (payload.quantity <= 0n) {
        return err(failure('ACCESS_TARGET_QUANTITY_INVALID', 'reserved quantity must be positive'));
      }
      if (payload.endsAtUnixSeconds <= payload.startsAtUnixSeconds) {
        return err(failure('ACCESS_RIGHT_WINDOW_INVALID', 'reservation must end after it starts'));
      }
      if (
        payload.startsAtUnixSeconds < right.validFromUnixSeconds ||
        payload.endsAtUnixSeconds > right.expiresAtUnixSeconds
      ) {
        return err(
          failure('ACCESS_RIGHT_WINDOW_INVALID', 'reservation falls outside the right validity window'),
        );
      }
      if (payload.quantity > availableCapacity(right)) {
        return err(
          failure(
            'ACCESS_RESERVATION_CAPACITY_EXCEEDED',
            'reservation exceeds the capacity granted by the right',
          ),
        );
      }
      next.rights.set(right.rightId, {
        ...right,
        reservedQuantity: right.reservedQuantity + payload.quantity,
      });
      next.reservations.set(payload.reservationId, {
        reservationId: payload.reservationId,
        rightId: payload.rightId,
        state: 'COMMITTED',
        quantity: payload.quantity,
        startsAtUnixSeconds: payload.startsAtUnixSeconds,
        endsAtUnixSeconds: payload.endsAtUnixSeconds,
        holdExpiresAtUnixSeconds: payload.holdExpiresAtUnixSeconds,
        usageId: null,
        deliveryId: null,
        settlementEvidenceId: null,
      });
      break;
    }

    case 'RESERVATION_CONFIRMED':
    case 'RESERVATION_EXPIRED':
    case 'RESERVATION_CANCELLED': {
      const reservation = next.reservations.get(payload.reservationId);
      if (!reservation) {
        return err(
          failure('ACCESS_RESERVATION_UNKNOWN', `reservation ${payload.reservationId} does not exist`),
        );
      }
      if (payload.kind === 'RESERVATION_CONFIRMED' && reservation.state !== 'COMMITTED') {
        return err(
          failure(
            'ACCESS_RESERVATION_STATE_INVALID',
            `only a COMMITTED reservation may be confirmed, not ${reservation.state}`,
          ),
        );
      }
      if (
        payload.kind !== 'RESERVATION_CONFIRMED' &&
        reservation.state !== 'COMMITTED' &&
        reservation.state !== 'CONFIRMED'
      ) {
        return err(
          failure(
            'ACCESS_RESERVATION_STATE_INVALID',
            `reservation ${payload.reservationId} is ${reservation.state}`,
          ),
        );
      }
      if (
        payload.kind === 'RESERVATION_EXPIRED' &&
        event.blockTimeUnixSeconds < reservation.holdExpiresAtUnixSeconds
      ) {
        return err(
          failure('ACCESS_RESERVATION_NOT_EXPIRED', 'the reservation hold has not elapsed yet'),
        );
      }
      const nextState =
        payload.kind === 'RESERVATION_CONFIRMED'
          ? 'CONFIRMED'
          : payload.kind === 'RESERVATION_EXPIRED'
            ? 'EXPIRED'
            : 'CANCELLED';
      if (nextState !== 'CONFIRMED') {
        const right = next.rights.get(reservation.rightId);
        if (right) {
          next.rights.set(right.rightId, {
            ...right,
            reservedQuantity: right.reservedQuantity - reservation.quantity,
          });
        }
      }
      next.reservations.set(reservation.reservationId, { ...reservation, state: nextState });
      break;
    }

    case 'USAGE_COMMITTED': {
      if (next.usages.has(payload.usageId)) {
        return err(failure('ACCESS_USAGE_ALREADY_EXISTS', `usage ${payload.usageId} already exists`));
      }
      const resolved = requireActiveRight(next, payload.rightId, event.blockTimeUnixSeconds);
      if (!resolved.ok) {
        return err(resolved.error);
      }
      const right = resolved.value;
      if (payload.quantity <= 0n) {
        return err(failure('ACCESS_TARGET_QUANTITY_INVALID', 'used quantity must be positive'));
      }
      if (payload.reservationId === null) {
        if (payload.quantity > availableCapacity(right)) {
          return err(
            failure(
              'ACCESS_RESERVATION_CAPACITY_EXCEEDED',
              'usage exceeds the capacity granted by the right',
            ),
          );
        }
        next.rights.set(right.rightId, {
          ...right,
          consumedQuantity: right.consumedQuantity + payload.quantity,
        });
      } else {
        const reservation = next.reservations.get(payload.reservationId);
        if (!reservation) {
          return err(
            failure('ACCESS_RESERVATION_UNKNOWN', `reservation ${payload.reservationId} does not exist`),
          );
        }
        if (reservation.state !== 'CONFIRMED') {
          return err(
            failure(
              'ACCESS_RESERVATION_STATE_INVALID',
              `usage requires a CONFIRMED reservation, not ${reservation.state}`,
            ),
          );
        }
        if (reservation.rightId !== payload.rightId) {
          return err(
            failure('ACCESS_RESERVATION_STATE_INVALID', 'reservation belongs to a different right'),
          );
        }
        if (payload.quantity > reservation.quantity) {
          return err(
            failure(
              'ACCESS_RESERVATION_CAPACITY_EXCEEDED',
              'usage exceeds the reserved quantity',
            ),
          );
        }
        next.rights.set(right.rightId, {
          ...right,
          reservedQuantity: right.reservedQuantity - reservation.quantity,
          consumedQuantity: right.consumedQuantity + payload.quantity,
        });
        next.reservations.set(reservation.reservationId, {
          ...reservation,
          state: 'USED',
          usageId: payload.usageId,
        });
      }
      next.usages.set(payload.usageId, {
        usageId: payload.usageId,
        rightId: payload.rightId,
        reservationId: payload.reservationId,
        quantity: payload.quantity,
        committedAtUnixSeconds: payload.committedAtUnixSeconds,
        deliveryId: null,
      });
      break;
    }

    case 'DELIVERY_COMMITTED': {
      if (next.deliveries.has(payload.deliveryId)) {
        return err(
          failure('ACCESS_DELIVERY_ALREADY_EXISTS', `delivery ${payload.deliveryId} already exists`),
        );
      }
      const usage = next.usages.get(payload.usageId);
      if (!usage) {
        return err(failure('ACCESS_USAGE_UNKNOWN', `usage ${payload.usageId} does not exist`));
      }
      if (usage.deliveryId !== null) {
        return err(
          failure('ACCESS_DELIVERY_ALREADY_EXISTS', `usage ${payload.usageId} already has a delivery`),
        );
      }
      next.usages.set(usage.usageId, { ...usage, deliveryId: payload.deliveryId });
      next.deliveries.set(payload.deliveryId, {
        deliveryId: payload.deliveryId,
        usageId: payload.usageId,
        outcomeCode: payload.outcomeCode,
        committedAtUnixSeconds: payload.committedAtUnixSeconds,
        settlementEvidenceId: null,
      });
      if (usage.reservationId !== null) {
        const reservation = next.reservations.get(usage.reservationId);
        if (reservation) {
          next.reservations.set(reservation.reservationId, {
            ...reservation,
            state: 'DELIVERED',
            deliveryId: payload.deliveryId,
          });
        }
      }
      break;
    }

    case 'SETTLEMENT_EVIDENCE_REFERENCE': {
      if (next.settlements.has(payload.settlementEvidenceId)) {
        return err(
          failure(
            'ACCESS_SETTLEMENT_ALREADY_REFERENCED',
            `settlement evidence ${payload.settlementEvidenceId} already exists`,
          ),
        );
      }
      const delivery = next.deliveries.get(payload.deliveryId);
      if (!delivery) {
        return err(failure('ACCESS_DELIVERY_UNKNOWN', `delivery ${payload.deliveryId} does not exist`));
      }
      if (delivery.settlementEvidenceId !== null) {
        return err(
          failure(
            'ACCESS_SETTLEMENT_ALREADY_REFERENCED',
            `delivery ${payload.deliveryId} already references settlement evidence`,
          ),
        );
      }
      next.deliveries.set(delivery.deliveryId, {
        ...delivery,
        settlementEvidenceId: payload.settlementEvidenceId,
      });
      next.settlements.set(payload.settlementEvidenceId, {
        settlementEvidenceId: payload.settlementEvidenceId,
        deliveryId: payload.deliveryId,
        journalId: payload.journalId,
        transferId: payload.transferId,
        authoritativeLedger: 'canonical-internal-ledger',
        chainBalanceAuthoritative: false,
      });
      const usage = next.usages.get(delivery.usageId);
      if (usage?.reservationId) {
        const reservation = next.reservations.get(usage.reservationId);
        if (reservation) {
          next.reservations.set(reservation.reservationId, {
            ...reservation,
            state: 'SETTLED',
            settlementEvidenceId: payload.settlementEvidenceId,
          });
        }
      }
      break;
    }
  }

  next.sequence = event.sequence;
  next.commitmentKeys.add(event.commitmentKey);
  return ok(seal(next));
}

/**
 * Replays a committed event log from genesis. Events are ordered by sequence,
 * so an out-of-order feed converges on the same state as an ordered one.
 */
export function replayAccessEvents(
  events: readonly AccessCommittedEvent[],
): Result<AccessChainState, AccessChainFailure> {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  let state = emptyAccessChainState();
  for (const event of ordered) {
    const applied = applyAccessEvent(state, event);
    if (!applied.ok) {
      return err(applied.error);
    }
    state = applied.value;
  }
  return ok(state);
}

function sortedByKey<T>(entries: ReadonlyMap<string, T>): readonly T[] {
  return [...entries.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}

/**
 * Canonical snapshot of the access state. This is the value a node compares
 * with a peer to prove the two agree, and the value a replay must reproduce.
 */
export function accessStateSnapshot(state: AccessChainState): unknown {
  return {
    schemaVersion: state.schemaVersion,
    sequence: state.sequence,
    rights: sortedByKey(state.rights).map((right) => ({
      rightId: right.rightId,
      rightClass: right.rightClass,
      state: right.state,
      productiveObjectId: right.productiveObjectId,
      capacityUnit: right.capacityUnit,
      capacityQuantity: quantityLabel(right.capacityQuantity),
      reservedQuantity: quantityLabel(right.reservedQuantity),
      consumedQuantity: quantityLabel(right.consumedQuantity),
      holderCommitment: right.holderCommitment,
      issuerActorRef: right.issuerActorRef,
      scopeCommitment: right.scopeCommitment,
      validFrom: unixSecondsLabel(right.validFromUnixSeconds),
      expiresAt: unixSecondsLabel(right.expiresAtUnixSeconds),
      revokedAt: right.revokedAtUnixSeconds === null ? null : unixSecondsLabel(right.revokedAtUnixSeconds),
      transferable: right.transferable,
      conveysOwnership: right.conveysOwnership,
    })),
    reservations: sortedByKey(state.reservations).map((reservation) => ({
      reservationId: reservation.reservationId,
      rightId: reservation.rightId,
      state: reservation.state,
      quantity: quantityLabel(reservation.quantity),
      startsAt: unixSecondsLabel(reservation.startsAtUnixSeconds),
      endsAt: unixSecondsLabel(reservation.endsAtUnixSeconds),
      holdExpiresAt: unixSecondsLabel(reservation.holdExpiresAtUnixSeconds),
      usageId: reservation.usageId,
      deliveryId: reservation.deliveryId,
      settlementEvidenceId: reservation.settlementEvidenceId,
    })),
    usages: sortedByKey(state.usages).map((usage) => ({
      usageId: usage.usageId,
      rightId: usage.rightId,
      reservationId: usage.reservationId,
      quantity: quantityLabel(usage.quantity),
      committedAt: unixSecondsLabel(usage.committedAtUnixSeconds),
      deliveryId: usage.deliveryId,
    })),
    deliveries: sortedByKey(state.deliveries).map((delivery) => ({
      deliveryId: delivery.deliveryId,
      usageId: delivery.usageId,
      outcomeCode: delivery.outcomeCode,
      committedAt: unixSecondsLabel(delivery.committedAtUnixSeconds),
      settlementEvidenceId: delivery.settlementEvidenceId,
    })),
    settlements: sortedByKey(state.settlements).map((settlement) => ({
      settlementEvidenceId: settlement.settlementEvidenceId,
      deliveryId: settlement.deliveryId,
      journalId: settlement.journalId,
      transferId: settlement.transferId,
      authoritativeLedger: settlement.authoritativeLedger,
      chainBalanceAuthoritative: settlement.chainBalanceAuthoritative,
    })),
    commitmentKeys: [...state.commitmentKeys].sort(),
  };
}

export function accessStateCommitment(state: AccessChainState): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.STATE, {
    snapshot: commitCanonical(accessStateSnapshot(state)),
    sequence: state.sequence,
  });
}
