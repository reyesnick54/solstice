/**
 * Service completion is governed. BOOKED, SCHEDULED, IN_PROGRESS, and
 * INVOICED do not prove the service was performed.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  BOOKING_EQUALS_COMPLETED_SERVICE,
  INVOICE_EQUALS_COMPLETED_SERVICE,
  isServiceCompleted,
  type ServiceRefusal,
  type ServiceSourceObservation,
} from './types.ts';

export function evaluateServiceCompletion(
  observation: ServiceSourceObservation,
): Result<{ readonly completed: true }, ServiceRefusal> {
  if (observation.cancelled && !observation.cancelledAfterRealization) {
    return err({
      code: 'CANCELLED_BEFORE_REALIZATION',
      detail: 'cancelled unfulfilled bookings create no completed service event',
    });
  }
  if (observation.completionState === 'BOOKED' || observation.completionState === 'SCHEDULED') {
    return err({
      code: 'BOOKING_IS_NOT_COMPLETION',
      detail: `state ${observation.completionState} is a booking, not a completed service`,
    });
  }
  if (observation.completionState === 'INVOICED' && !isServiceCompleted(observation.completionState)) {
    return err({
      code: 'INVOICE_IS_NOT_COMPLETION',
      detail: 'invoice issuance does not prove service completion',
    });
  }
  if (observation.invoicePresent && !isServiceCompleted(observation.completionState)) {
    return err({
      code: 'INVOICE_IS_NOT_COMPLETION',
      detail: 'invoice issuance does not prove service completion',
    });
  }
  if (observation.paymentPresent && !isServiceCompleted(observation.completionState)) {
    return err({
      code: 'PAYMENT_IS_NOT_OUTPUT',
      detail: 'payment does not prove service completion by itself',
    });
  }
  if (!isServiceCompleted(observation.completionState)) {
    return err({
      code: 'SERVICE_NOT_COMPLETED',
      detail: `state ${observation.completionState} is not COMPLETED or ACCEPTED`,
    });
  }
  return ok({ completed: true as const });
}

export function bookingEqualsCompletedService(): false {
  return BOOKING_EQUALS_COMPLETED_SERVICE;
}

export function invoiceEqualsCompletedService(): false {
  return INVOICE_EQUALS_COMPLETED_SERVICE;
}
