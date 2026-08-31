/**
 * Access Wave 4 receipt models — immutable, backend-authoritative.
 */

import type { AccessCategory } from '../taxonomy.ts';
import type { AccessReceiptType } from './taxonomy.ts';

export type AccessReceiptFinancial = {
  readonly providerTotal: string;
  readonly accessCoverage: string;
  readonly userContribution: string;
  readonly taxes: string;
  readonly mandatoryFees: string;
  readonly optionalFees: string;
  readonly depositAmount: string | null;
  readonly refundAmount: string | null;
  readonly currency: string;
};

export type AccessReceiptAccess = {
  readonly unit: string;
  readonly unitsUsed: string;
  readonly entitlementBefore: string | null;
  readonly entitlementAfter: string | null;
};

export type AccessReceiptBooking = {
  readonly confirmationReference: string | null;
  readonly bookingStatus: string;
};

export type AccessReceipt = {
  readonly schema: 'sunrey.consumer.access.receipt.v1';
  readonly receiptId: string;
  readonly receiptType: AccessReceiptType;
  readonly accessTransactionId: string;
  readonly userId: string;
  readonly providerDisplayName: string;
  readonly serviceName: string;
  readonly category: AccessCategory;
  readonly serviceDate: string | null;
  readonly location: string | null;
  readonly financial: AccessReceiptFinancial;
  readonly access: AccessReceiptAccess;
  readonly booking: AccessReceiptBooking;
  readonly settlement: { readonly settlementStatus: string };
  readonly evidence: {
    readonly receiptGeneratedAt: string;
    readonly evidenceReference: string;
  };
  readonly immutable: true;
  readonly simulationFixture: true;
};

export type AccessRefundReceipt = {
  readonly schema: 'sunrey.consumer.access.refund-receipt.v1';
  readonly refundReceiptId: string;
  readonly originalReceiptId: string;
  readonly accessTransactionId: string;
  readonly userId: string;
  readonly providerDisplayName: string;
  readonly serviceName: string;
  readonly currency: string;
  readonly providerRefund: string;
  readonly returnedToUser: string;
  readonly returnedToAccessPool: string;
  readonly penaltyAmount: string;
  readonly entitlementRestored: string | null;
  readonly entitlementNotRestored: string | null;
  readonly status: string;
  readonly processedAt: string;
  readonly immutable: true;
  readonly simulationFixture: true;
};

export type AccessReceiptInput = {
  readonly receiptId: string;
  readonly receiptType: AccessReceiptType;
  readonly accessTransactionId: string;
  readonly userId: string;
  readonly providerDisplayName: string;
  readonly serviceName: string;
  readonly category: AccessCategory;
  readonly serviceDate: string | null;
  readonly location: string | null;
  readonly financial: AccessReceiptFinancial;
  readonly access: AccessReceiptAccess;
  readonly booking: AccessReceiptBooking;
  readonly settlementStatus: string;
  readonly generatedAt: string;
  readonly evidenceReference: string;
};

export function buildAccessReceipt(input: AccessReceiptInput): AccessReceipt {
  return Object.freeze({
    schema: 'sunrey.consumer.access.receipt.v1',
    receiptId: input.receiptId,
    receiptType: input.receiptType,
    accessTransactionId: input.accessTransactionId,
    userId: input.userId,
    providerDisplayName: input.providerDisplayName,
    serviceName: input.serviceName,
    category: input.category,
    serviceDate: input.serviceDate,
    location: input.location,
    financial: Object.freeze({ ...input.financial }),
    access: Object.freeze({ ...input.access }),
    booking: Object.freeze({ ...input.booking }),
    settlement: Object.freeze({ settlementStatus: input.settlementStatus }),
    evidence: Object.freeze({
      receiptGeneratedAt: input.generatedAt,
      evidenceReference: input.evidenceReference,
    }),
    immutable: true as const,
    simulationFixture: true as const,
  });
}

export type AccessRefundReceiptInput = {
  readonly refundReceiptId: string;
  readonly originalReceiptId: string;
  readonly accessTransactionId: string;
  readonly userId: string;
  readonly providerDisplayName: string;
  readonly serviceName: string;
  readonly currency: string;
  readonly providerRefund: string;
  readonly returnedToUser: string;
  readonly returnedToAccessPool: string;
  readonly penaltyAmount: string;
  readonly entitlementRestored: string | null;
  readonly entitlementNotRestored: string | null;
  readonly status: string;
  readonly processedAt: string;
};

export function buildAccessRefundReceipt(input: AccessRefundReceiptInput): AccessRefundReceipt {
  return Object.freeze({
    schema: 'sunrey.consumer.access.refund-receipt.v1',
    refundReceiptId: input.refundReceiptId,
    originalReceiptId: input.originalReceiptId,
    accessTransactionId: input.accessTransactionId,
    userId: input.userId,
    providerDisplayName: input.providerDisplayName,
    serviceName: input.serviceName,
    currency: input.currency,
    providerRefund: input.providerRefund,
    returnedToUser: input.returnedToUser,
    returnedToAccessPool: input.returnedToAccessPool,
    penaltyAmount: input.penaltyAmount,
    entitlementRestored: input.entitlementRestored,
    entitlementNotRestored: input.entitlementNotRestored,
    status: input.status,
    processedAt: input.processedAt,
    immutable: true as const,
    simulationFixture: true as const,
  });
}

export function formatMoneyLabel(minorUnits: string, currency: string): string {
  const amount = Number(minorUnits) / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
