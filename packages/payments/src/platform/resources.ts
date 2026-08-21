/**
 * Client-safe payment resources for BFF / SDK / Lovable.
 * Backend owns authoritative status.
 */

import type { PaymentLifecycleStatus } from './lifecycle.ts';
import type { BeneficiaryDestinationType } from './destination.ts';
import type { PaymentType, RailPreference } from './payment-intent.ts';
import type { ClientComplianceState, QuoteDeliveryClass } from './quote-preview.ts';

export type MoneyResource = {
  readonly minorUnits: string;
  readonly currency: string;
};

export type Recipient = {
  readonly id: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly destinationType: BeneficiaryDestinationType;
  readonly country: string;
  readonly currency: string;
  readonly displayHint: string;
  readonly relationship: string | null;
  readonly purpose: string | null;
  readonly verificationStatus: 'PENDING' | 'ACTIVE' | 'REVIEW' | 'BLOCKED' | 'DISABLED';
  readonly screeningStatus: string;
  readonly createdAt: string;
};

export type PaymentQuote = {
  readonly quoteId: string;
  readonly sourceAmount: MoneyResource;
  readonly destinationAmount: MoneyResource | null;
  readonly currency: string;
  readonly fees: readonly { readonly code: string; readonly amount: MoneyResource; readonly description: string }[];
  readonly amountDebited: MoneyResource;
  readonly fx: { readonly rateLabel: string | null; readonly rateSource: string; readonly reference: string } | null;
  readonly estimatedRoute: {
    readonly railPreference: RailPreference;
    readonly paymentType: PaymentType;
    readonly corridorId: string | null;
  };
  readonly estimatedDeliveryClass: QuoteDeliveryClass;
  readonly settlementTimePromise: null;
  readonly requiredApprovals: readonly string[];
  readonly complianceState: ClientComplianceState;
  readonly expiresAt: string;
  readonly productionMoneyMovement: false;
};

export type PaymentStatus = PaymentLifecycleStatus;

export type Payment = {
  readonly paymentId: string;
  readonly payerId: string;
  readonly sourceAccountId: string;
  readonly beneficiaryId: string | null;
  readonly destination: {
    readonly type: string;
    readonly accountId: string | null;
    readonly displayHint: string;
  };
  readonly amount: MoneyResource;
  readonly destinationAmount: MoneyResource;
  readonly currency: string;
  readonly paymentType: PaymentType;
  readonly railPreference: RailPreference;
  readonly purpose: string;
  readonly reference: string;
  readonly fees: readonly { readonly code: string; readonly amount: MoneyResource; readonly description: string }[];
  readonly fx: { readonly rateLabel: string | null; readonly rateSource: string; readonly reference: string } | null;
  readonly status: PaymentStatus;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly providerReference: string | null;
  readonly idempotencyKey: string;
  readonly approvalId: string | null;
  readonly workflowId: string | null;
  readonly productionMoneyMovement: false;
};

export type PaymentApproval = {
  readonly approvalId: string;
  readonly paymentId: string;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED';
  readonly createdAt: string;
  readonly decidedAt: string | null;
};
