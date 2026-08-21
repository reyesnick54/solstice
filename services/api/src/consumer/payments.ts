import { PaymentPlatform, type PaymentPlatformOutcome } from '../../../../packages/payments/src/platform/orchestrator.ts';
import type {
  Payment,
  PaymentApproval,
  PaymentQuote,
  PaymentStatus,
  Recipient,
} from '../../../../packages/payments/src/platform/resources.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

export function mapPaymentOutcome<T>(
  result: PaymentPlatformOutcome<T>,
  requestId: string,
): T | BffErrorEnvelope {
  if (result.outcome === 'OK' || result.outcome === 'AWAITING_APPROVAL') {
    return result.value;
  }
  if (result.outcome === 'STEP_UP_REQUIRED') {
    return bffError({
      errorCode: 'STEP_UP_REQUIRED',
      category: 'AUTHORIZATION',
      message: 'step-up authentication is required',
      retryable: false,
      requestId,
      detailsSafeForClient: {
        needed: result.needed,
        current: result.current,
        ...(result.paymentId ? { paymentId: result.paymentId } : {}),
      },
    });
  }
  if (result.outcome === 'KERNEL_REFUSED') {
    return bffError({
      errorCode: 'KERNEL_REFUSED',
      category: 'POLICY',
      message: 'Compliance Kernel refused this payment action',
      retryable: false,
      requestId,
      detailsSafeForClient: { status: result.decision.status },
    });
  }
  const code = result.code;
  if (code === 'RESOURCE_NOT_OWNED' || code === 'CROSS_USER_DENIED') {
    return bffError({
      errorCode: 'RESOURCE_NOT_OWNED',
      category: 'AUTHORIZATION',
      message: result.message,
      retryable: false,
      requestId,
    });
  }
  if (code === 'NOT_FOUND' || code === 'QUOTE_NOT_FOUND' || code === 'BENEFICIARY_NOT_FOUND' || code === 'APPROVAL_NOT_FOUND') {
    return bffError({
      errorCode: 'NOT_FOUND',
      category: 'NOT_FOUND',
      message: result.message,
      retryable: false,
      requestId,
    });
  }
  return bffError({
    errorCode: 'VALIDATION',
    category: 'VALIDATION',
    message: result.message,
    retryable: false,
    requestId,
    detailsSafeForClient: { code },
  });
}

export function listRecipients(platform: PaymentPlatform, principal: BffPrincipal): { readonly items: readonly Recipient[] } {
  return Object.freeze({ items: platform.listRecipients(principal.customerId) });
}

export function listPayments(platform: PaymentPlatform, principal: BffPrincipal): { readonly items: readonly Payment[] } {
  return Object.freeze({
    items: platform.listPayments(principal.customerId),
    productionMoneyMovement: false,
  });
}

export type { Payment, PaymentQuote, PaymentApproval, PaymentStatus, Recipient };