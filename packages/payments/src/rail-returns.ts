import type { UtcInstant } from '../../domain/src/time.ts';
import type { Money } from '../../money/src/money.ts';
import type { PaymentId } from './ids.ts';
import {
  asReturnReference,
  type RailSubmissionId,
  type ReturnReference,
  type RailMessageReferences,
} from './rail-ids.ts';
import { type ReturnReasonCode } from './rail-types.ts';

export type RailReturnRecord = {
  readonly returnReference: ReturnReference;
  readonly paymentId: PaymentId;
  readonly originalSubmissionId: RailSubmissionId;
  readonly reason: ReturnReasonCode;
  readonly amount: Money;
  readonly references: RailMessageReferences;
  readonly occurredAt: UtcInstant;
};

export function normalizeReturnReason(providerReason: string): ReturnReasonCode {
  const key = providerReason.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (key.includes('CLOSED')) {
    return 'BENEFICIARY_ACCOUNT_CLOSED';
  }
  if (key.includes('INVALID') || key.includes('NO_ACCOUNT')) {
    return 'BENEFICIARY_ACCOUNT_INVALID';
  }
  if (key.includes('INFO') || key.includes('AMEND')) {
    return 'INSUFFICIENT_INFORMATION';
  }
  if (key.includes('SANCTION') || key.includes('AML') || key.includes('COMPLIANCE')) {
    return 'COMPLIANCE_RETURN';
  }
  if (key.includes('DUP')) {
    return 'DUPLICATE_PAYMENT';
  }
  if (key.includes('CUSTOMER') || key.includes('REQUEST')) {
    return 'CUSTOMER_REQUESTED';
  }
  return 'PROVIDER_UNSPECIFIED';
}

export function freezeReturn(record: Omit<RailReturnRecord, 'returnReference'> & { readonly returnReference?: string }): RailReturnRecord {
  return Object.freeze({
    ...record,
    returnReference: asReturnReference(record.returnReference ?? `ret_${record.paymentId}`),
    references: Object.freeze({ ...record.references }),
  });
}
