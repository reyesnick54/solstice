/**
 * Delivery completion is a governed state. BOOKED / IN_TRANSIT /
 * OUT_FOR_DELIVERY do not prove completed delivery.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { commitmentOf } from './privacy.ts';
import { deliveryDedupKey } from './shipments.ts';
import {
  isDeliveryCompleted,
  type DeliveryStatus,
  type LogisticsRefusal,
  type LogisticsSourceObservation,
  type ProofOfDelivery,
} from './types.ts';

export type DeliveryDecision = {
  readonly completed: boolean;
  readonly status: DeliveryStatus | null;
  readonly proofRef: string | null;
  readonly dedupKey: string | null;
  readonly storesSignatureImage: false;
};

const seenDeliveries = new Map<string, string>();

export function resetDeliveryDedup(): void {
  seenDeliveries.clear();
}

export function evaluateDeliveryCompletion(
  observation: LogisticsSourceObservation,
): Result<DeliveryDecision, LogisticsRefusal> {
  const status = observation.deliveryStatus ?? null;
  const pod = observation.proofOfDelivery;
  if (status !== null && !isDeliveryCompleted(status) && observation.factType === 'DELIVERY_COMPLETION') {
    return err({
      code: 'DELIVERY_NOT_COMPLETED',
      detail: `status ${status} is not a governed completion state`,
      reviewRequired: false,
    });
  }
  if (observation.factType === 'DELIVERY_COMPLETION' && status === null && !pod) {
    return err({
      code: 'DELIVERY_NOT_COMPLETED',
      detail: 'DELIVERY_COMPLETION requires DELIVERED, ACCEPTED, or equivalent evidence',
      reviewRequired: false,
    });
  }
  if (pod && !isDeliveryCompleted(pod.completedState)) {
    return err({
      code: 'DELIVERY_NOT_COMPLETED',
      detail: `proof-of-delivery state ${pod.completedState} is not completed`,
      reviewRequired: false,
    });
  }
  const completed = (status !== null && isDeliveryCompleted(status)) || Boolean(pod);
  const dedupKey = completed ? deliveryDedupKey(observation) : null;
  if (completed && dedupKey) {
    const existing = seenDeliveries.get(dedupKey);
    if (existing && existing !== observation.observationId) {
      return err({
        code: 'DUPLICATE_DELIVERY',
        detail: `shipment already completed by ${existing}`,
        reviewRequired: false,
      });
    }
    seenDeliveries.set(dedupKey, observation.observationId);
  }
  return ok(
    Object.freeze({
      completed,
      status,
      proofRef: pod ? proofRefOf(pod) : null,
      dedupKey,
      storesSignatureImage: false,
    }),
  );
}

export function proofRefOf(pod: ProofOfDelivery): string {
  return commitmentOf(`${pod.kind}:${pod.evidenceCommitment}:${pod.evidenceReference}:${pod.completedState}`);
}

export function inTransitIsNotCompleted(status: DeliveryStatus): boolean {
  return status === 'IN_TRANSIT' || status === 'BOOKED' || status === 'OUT_FOR_DELIVERY';
}
