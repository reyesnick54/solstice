/**
 * Service-delivery certification fixtures.
 *
 * Valid cases satisfy admission-shaped engineering checks.
 * Invalid cases stay refused. Certification does not mint.
 */

import { ingestServiceObservation } from './adapter.ts';
import {
  BOOKING_AS_COMPLETION,
  CUSTOMER_PII_LEAK,
  DIGITAL_PAYLOAD_LEAK,
  DIGITAL_SERVICE_METER,
  FLOAT_DURATION,
  HISTORICAL_MACHINE_HOUR,
  HOURS_FROM_INVOICE,
  HUMAN_WORTH_SCORE,
  INVOICE_AS_COMPLETION,
  MACHINE_H_AS_HUMAN_HOUR,
  SAME_CONTROLLER_QUORUM,
  SCHEMA_DRIFT,
  VALID_TIME_SERVICE,
  VALID_UNITIZED_SERVICE,
} from './fixtures.ts';
import type { ServiceRefusal, ServiceSourceObservation } from './types.ts';

export type ServiceCertificationCase = {
  readonly caseId: string;
  readonly valid: boolean;
  readonly observation?: ServiceSourceObservation;
  readonly evaluate: () => { readonly ok: boolean; readonly code?: ServiceRefusal['code'] };
};

function fromIngest(observation: ServiceSourceObservation) {
  return () => {
    const result = ingestServiceObservation(observation);
    return result.ok ? { ok: true } : { ok: false, code: result.error.code };
  };
}

export const VALID_SERVICE_CERTIFICATION_CASES: readonly ServiceCertificationCase[] = Object.freeze([
  {
    caseId: 'unitized-service-completion',
    valid: true,
    observation: VALID_UNITIZED_SERVICE,
    evaluate: fromIngest(VALID_UNITIZED_SERVICE),
  },
  {
    caseId: 'time-based-service',
    valid: true,
    observation: VALID_TIME_SERVICE,
    evaluate: fromIngest(VALID_TIME_SERVICE),
  },
  {
    caseId: 'digital-service-meter',
    valid: true,
    observation: DIGITAL_SERVICE_METER,
    evaluate: fromIngest(DIGITAL_SERVICE_METER),
  },
  {
    caseId: 'historical-machine-h',
    valid: true,
    observation: HISTORICAL_MACHINE_HOUR,
    evaluate: fromIngest(HISTORICAL_MACHINE_HOUR),
  },
]);

export const INVALID_SERVICE_CERTIFICATION_CASES: readonly ServiceCertificationCase[] = Object.freeze([
  {
    caseId: 'booking-treated-as-completion',
    valid: false,
    observation: BOOKING_AS_COMPLETION,
    evaluate: fromIngest(BOOKING_AS_COMPLETION),
  },
  {
    caseId: 'invoice-treated-as-completion',
    valid: false,
    observation: INVOICE_AS_COMPLETION,
    evaluate: fromIngest(INVOICE_AS_COMPLETION),
  },
  {
    caseId: 'machine-h-as-human-service-hour',
    valid: false,
    observation: MACHINE_H_AS_HUMAN_HOUR,
    evaluate: fromIngest(MACHINE_H_AS_HUMAN_HOUR),
  },
  {
    caseId: 'hours-from-invoice',
    valid: false,
    observation: HOURS_FROM_INVOICE,
    evaluate: fromIngest(HOURS_FROM_INVOICE),
  },
  {
    caseId: 'digital-payload-leak',
    valid: false,
    observation: DIGITAL_PAYLOAD_LEAK,
    evaluate: fromIngest(DIGITAL_PAYLOAD_LEAK),
  },
  {
    caseId: 'customer-pii-leaked',
    valid: false,
    observation: CUSTOMER_PII_LEAK,
    evaluate: fromIngest(CUSTOMER_PII_LEAK),
  },
  {
    caseId: 'human-worth-scoring',
    valid: false,
    observation: HUMAN_WORTH_SCORE,
    evaluate: fromIngest(HUMAN_WORTH_SCORE),
  },
  {
    caseId: 'same-controller-fake-quorum',
    valid: false,
    observation: SAME_CONTROLLER_QUORUM,
    evaluate: fromIngest(SAME_CONTROLLER_QUORUM),
  },
  {
    caseId: 'float-quantity',
    valid: false,
    observation: FLOAT_DURATION,
    evaluate: fromIngest(FLOAT_DURATION),
  },
  {
    caseId: 'schema-drift',
    valid: false,
    observation: SCHEMA_DRIFT,
    evaluate: fromIngest(SCHEMA_DRIFT),
  },
]);

export function evaluateServiceCertificationCase(caseId: string): { readonly ok: boolean; readonly code?: string } {
  const found = [...VALID_SERVICE_CERTIFICATION_CASES, ...INVALID_SERVICE_CERTIFICATION_CASES].find(
    (row) => row.caseId === caseId,
  );
  if (!found) {
    return { ok: false, code: 'SCHEMA_DRIFT' };
  }
  return found.evaluate();
}

export function certificationDoesNotMint(): false {
  return false;
}
