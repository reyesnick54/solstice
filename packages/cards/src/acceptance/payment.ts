import type { UtcInstant } from '../../../domain/src/time.ts';
import type { Money } from '../../../money/src/money.ts';
import { assertNoSensitiveCardData } from '../pci-boundary.ts';
import type {
  AcceptanceDeviceId,
  AcceptancePaymentId,
  AcceptanceSessionId,
  MerchantId,
  ProviderAcceptanceTransactionRef,
} from './ids.ts';

export const ACCEPTANCE_PAYMENT_RESULTS = ['APPROVED', 'DECLINED', 'CANCELLED', 'FAILED', 'UNKNOWN'] as const;
export type AcceptancePaymentResult = (typeof ACCEPTANCE_PAYMENT_RESULTS)[number];

export const ACCEPTANCE_PAYMENT_STATES = ['CREATED', 'PENDING_SETTLEMENT', 'SETTLED', 'DECLINED', 'CANCELLED', 'FAILED'] as const;
export type AcceptancePaymentState = (typeof ACCEPTANCE_PAYMENT_STATES)[number];

export type MerchantPayment = {
  readonly paymentId: AcceptancePaymentId;
  readonly merchantId: MerchantId;
  readonly deviceId: AcceptanceDeviceId;
  readonly sessionId: AcceptanceSessionId;
  readonly amount: Money;
  readonly merchantReference: string;
  readonly providerTransactionRef: ProviderAcceptanceTransactionRef | null;
  readonly result: AcceptancePaymentResult | null;
  readonly state: AcceptancePaymentState;
  readonly settlementJournalId: string | null;
  readonly feeJournalId: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export function freezeMerchantPayment(payment: MerchantPayment): MerchantPayment {
  assertNoSensitiveCardData(payment, 'merchantPayment');
  return Object.freeze({ ...payment });
}
