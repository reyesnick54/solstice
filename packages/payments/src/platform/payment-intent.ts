import type { AccountId } from '../../../domain/src/account.ts';
import type { CurrencyCode } from '../../../domain/src/currency.ts';
import type { CustomerId } from '../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { Money } from '../../../money/src/money.ts';
import type { BeneficiaryId, PaymentId, QuoteId } from '../ids.ts';
import type { BeneficiaryDestinationType } from './destination.ts';
import type { PaymentLifecycleStatus } from './lifecycle.ts';

export const PAYMENT_TYPES = [
  'SUNREY_TO_SUNREY',
  'ACCOUNT_TO_ACCOUNT',
  'BANK_PAYOUT',
  'ACH',
  'WIRE',
  'RTP',
  'SEPA',
  'SWIFT',
  'SAUDI_RAIL',
  'INTERNATIONAL_REMITTANCE',
] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const RAIL_PREFERENCES = [
  'LEDGER_INTERNAL',
  'ACH',
  'WIRE',
  'RTP',
  'SEPA',
  'SWIFT',
  'SADAD',
  'SARIE',
  'REMITTANCE',
  'UNSPECIFIED',
] as const;
export type RailPreference = (typeof RAIL_PREFERENCES)[number];

export type PaymentFeeLine = {
  readonly code: string;
  readonly amount: Money;
  readonly description: string;
};

export type PaymentFxDependency = {
  readonly quoteId: QuoteId;
  readonly rateLabel: string | null;
  readonly rateSource: string;
  readonly pricingVersion: string;
};

export type PaymentPolicyRefs = {
  readonly kernelEvidenceId: string | null;
  readonly screeningRef: string | null;
  readonly limitsPolicyId: string;
  readonly approvalId: string | null;
  readonly workflowId: string | null;
};

/**
 * Canonical product Payment Intent. Customer resource — never includes
 * provider credentials, API keys, or rail endpoint configuration.
 */
export type PaymentIntent = {
  readonly paymentId: PaymentId;
  readonly payerId: CustomerId;
  readonly sourceAccountId: AccountId;
  readonly beneficiaryId: BeneficiaryId | null;
  readonly destination: {
    readonly type: BeneficiaryDestinationType | 'OWN_ACCOUNT';
    readonly accountId: AccountId | null;
    readonly displayHint: string;
  };
  readonly amount: Money;
  readonly currency: CurrencyCode;
  readonly destinationAmount: Money;
  readonly paymentType: PaymentType;
  readonly railPreference: RailPreference;
  readonly purpose: string;
  readonly reference: string;
  readonly fees: readonly PaymentFeeLine[];
  readonly fx: PaymentFxDependency | null;
  readonly status: PaymentLifecycleStatus;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly providerReference: string | null;
  readonly idempotencyKey: string;
  readonly policy: PaymentPolicyRefs;
  readonly journalIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly holdId: string | null;
  readonly quoteId: QuoteId | null;
  readonly railOrderId: string | null;
};

export function freezePaymentIntent(intent: PaymentIntent): PaymentIntent {
  return Object.freeze({
    ...intent,
    destination: Object.freeze({ ...intent.destination }),
    fees: Object.freeze(intent.fees.map((fee) => Object.freeze({ ...fee }))),
    fx: intent.fx ? Object.freeze({ ...intent.fx }) : null,
    policy: Object.freeze({ ...intent.policy }),
    journalIds: Object.freeze([...intent.journalIds]),
    evidenceIds: Object.freeze([...intent.evidenceIds]),
  });
}

export function paymentTypeForDestination(
  destinationType: BeneficiaryDestinationType | 'OWN_ACCOUNT',
  railPreference: RailPreference,
): PaymentType {
  if (destinationType === 'OWN_ACCOUNT') {
    return 'ACCOUNT_TO_ACCOUNT';
  }
  if (destinationType === 'SUNREY_USER') {
    return 'SUNREY_TO_SUNREY';
  }
  if (destinationType === 'WALLET') {
    return 'BANK_PAYOUT';
  }
  switch (railPreference) {
    case 'ACH':
      return 'ACH';
    case 'WIRE':
      return 'WIRE';
    case 'RTP':
      return 'RTP';
    case 'SEPA':
      return 'SEPA';
    case 'SWIFT':
      return 'SWIFT';
    case 'SADAD':
    case 'SARIE':
      return 'SAUDI_RAIL';
    case 'REMITTANCE':
      return 'INTERNATIONAL_REMITTANCE';
    default:
      return destinationType === 'DOMESTIC_BANK' ? 'BANK_PAYOUT' : 'INTERNATIONAL_REMITTANCE';
  }
}
