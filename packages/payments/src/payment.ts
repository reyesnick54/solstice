import type { AccountId } from '../../domain/src/account.ts';
import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { CustomerId } from '../../domain/src/customer.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { Money } from '../../money/src/money.ts';
import type { BeneficiaryId, CorridorId, HoldId, PaymentId, QuoteId, RouteId, SettlementRef } from './ids.ts';

export const PAYMENT_STATUSES = [
  'DRAFT',
  'PENDING_COMPLIANCE',
  'READY',
  'FUNDS_RESERVED',
  'SUBMITTED',
  'PROCESSING',
  'SETTLED',
  'FAILED',
  'RETURNED',
  'CANCELLED',
  'HELD',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ALLOWED_TRANSITIONS: { readonly [S in PaymentStatus]: readonly PaymentStatus[] } = {
  DRAFT: ['PENDING_COMPLIANCE', 'CANCELLED', 'FAILED'],
  PENDING_COMPLIANCE: ['READY', 'HELD', 'FAILED', 'CANCELLED'],
  READY: ['FUNDS_RESERVED', 'FAILED', 'CANCELLED', 'HELD'],
  FUNDS_RESERVED: ['SUBMITTED', 'FAILED', 'CANCELLED'],
  SUBMITTED: ['PROCESSING', 'SETTLED', 'FAILED', 'RETURNED'],
  PROCESSING: ['SETTLED', 'FAILED', 'RETURNED'],
  SETTLED: ['RETURNED'],
  FAILED: [],
  RETURNED: [],
  CANCELLED: [],
  HELD: ['CANCELLED', 'FAILED', 'READY'],
};

export type PaymentOrder = {
  readonly paymentId: PaymentId;
  readonly customerId: CustomerId;
  readonly sourceAccountId: AccountId;
  readonly beneficiaryId: BeneficiaryId;
  readonly sourceCurrency: CurrencyCode;
  readonly destinationCurrency: CurrencyCode;
  readonly sourceAmount: Money;
  readonly quotedDestinationAmount: Money;
  readonly fee: Money;
  readonly amountDebited: Money;
  readonly quoteId: QuoteId;
  readonly purposeReference: string;
  readonly corridorId: CorridorId;
  readonly routeId: RouteId | null;
  readonly holdId: HoldId | null;
  readonly settlementRef: SettlementRef | null;
  readonly status: PaymentStatus;
  readonly idempotencyKey: string;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly journalIds: readonly string[];
  readonly evidenceIds: readonly string[];
};

export type IllegalPaymentTransition = {
  readonly code: 'ILLEGAL_PAYMENT_TRANSITION';
  readonly paymentId: PaymentId;
  readonly from: PaymentStatus;
  readonly to: PaymentStatus;
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionPayment(
  payment: PaymentOrder,
  to: PaymentStatus,
  at: UtcInstant,
  patch: Partial<Omit<PaymentOrder, 'paymentId' | 'status' | 'createdAt' | 'idempotencyKey'>> = {},
): Result<PaymentOrder, IllegalPaymentTransition> {
  if (!canTransitionPayment(payment.status, to)) {
    return err(
      Object.freeze({
        code: 'ILLEGAL_PAYMENT_TRANSITION' as const,
        paymentId: payment.paymentId,
        from: payment.status,
        to,
      }),
    );
  }
  return ok(
    freezePayment({
      ...payment,
      ...patch,
      status: to,
      updatedAt: at,
    }),
  );
}

export function freezePayment(payment: PaymentOrder): PaymentOrder {
  return Object.freeze({
    ...payment,
    journalIds: Object.freeze([...payment.journalIds]),
    evidenceIds: Object.freeze([...payment.evidenceIds]),
  });
}
