/**
 * ACCESS Wave 3 Prompt 34 — Checkout quote and coverage types.
 *
 * Read-only calculation plane. No payment, reservation, or ledger mutation.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessProviderId, CanonicalCapacityUnit } from '../providers/types.ts';
import type { TOKEN_CONVERSION_CONTRIBUTION } from '../funding-solvency/taxonomy.ts';

export const ACCESS_COST_CLASSIFICATIONS = [
  'ACCESS_ELIGIBLE',
  'USER_RESPONSIBILITY',
  'MANDATORY_FEE',
  'OPTIONAL_FEE',
  'SECURITY_DEPOSIT',
  'CONTINGENT_LIABILITY',
  'TAX',
  'INELIGIBLE',
] as const;
export type AccessCostClassification = (typeof ACCESS_COST_CLASSIFICATIONS)[number];

export const PROVIDER_QUOTE_CLASSIFICATIONS = [
  'FIRM',
  'REFERENCE',
  'INDICATIVE',
  'EXPIRED',
] as const;
export type ProviderQuoteClassification = (typeof PROVIDER_QUOTE_CLASSIFICATIONS)[number];

export const CHECKOUT_QUOTE_STATUSES = [
  'CALCULATED',
  'SETTLEABLE',
  'NON_SETTLEABLE',
  'EXPIRED',
  'SUPERSEDED',
] as const;
export type AccessCheckoutQuoteStatus = (typeof CHECKOUT_QUOTE_STATUSES)[number];

export const CHECKOUT_QUOTE_FAILURE_CODES = [
  'QUOTE_NOT_FIRM',
  'QUOTE_REFERENCE',
  'QUOTE_INDICATIVE',
  'QUOTE_EXPIRED',
  'ENTITLEMENT_INSUFFICIENT',
  'ACCESS_FUNDING_UNAVAILABLE',
  'CATEGORY_FUNDING_RESTRICTED',
  'PROVIDER_FUNDING_RESTRICTED',
  'POLICY_NOT_FOUND',
  'CURRENCY_MISMATCH_NO_FX',
  'PROGRAM_COVERAGE_EXHAUSTED',
] as const;
export type AccessCheckoutQuoteFailureCode = (typeof CHECKOUT_QUOTE_FAILURE_CODES)[number];

export const FX_QUOTE_KINDS = ['REFERENCE_FX', 'EXECUTION_FX'] as const;
export type FxQuoteKind = (typeof FX_QUOTE_KINDS)[number];

/** Monetary line item on a provider firm quote. */
export type ProviderQuoteCostLine = {
  readonly lineId: string;
  readonly code: string;
  readonly label: string;
  readonly amountMinorUnits: bigint;
  readonly costType:
    | 'BASE'
    | 'TAX'
    | 'MANDATORY_FEE'
    | 'OPTIONAL_FEE'
    | 'SECURITY_DEPOSIT'
    | 'CONTINGENT_LIABILITY'
    | 'OTHER';
  readonly optional: boolean;
};

/** Settlement-bound provider quote with decomposed cost lines. */
export type AccessProviderFirmQuote = {
  readonly quoteId: string;
  readonly providerId: AccessProviderId;
  readonly catalogItemId: string;
  readonly canonicalUnit: CanonicalCapacityUnit;
  readonly classification: ProviderQuoteClassification;
  readonly quantity: bigint;
  readonly currency: string;
  readonly baseAmount: bigint;
  readonly taxes: bigint;
  readonly mandatoryFees: bigint;
  readonly optionalFees: bigint;
  readonly securityDeposit: bigint;
  readonly contingentLiability: bigint;
  /** Immediate provider service charge (excludes refundable deposits). */
  readonly totalProviderAmount: bigint;
  /** Total exposure including contingent / deposit amounts. */
  readonly totalExposure: bigint;
  readonly costLines: readonly ProviderQuoteCostLine[];
  readonly expiresAt: UtcInstant;
  readonly previousQuoteId: string | null;
  readonly simulationOnly: boolean;
};

/** Classified cost component after policy application. */
export type ClassifiedCostComponent = {
  readonly lineId: string;
  readonly code: string;
  readonly label: string;
  readonly amountMinorUnits: bigint;
  readonly sourceCostType: ProviderQuoteCostLine['costType'];
  readonly classification: AccessCostClassification;
  readonly accessEligible: boolean;
};

/** Entitlement snapshot for checkout calculation (read-only). */
export type CheckoutEntitlementRef = {
  readonly entitlementId: string;
  readonly userId: string;
  readonly category: string;
  readonly entitlementClass: string;
  readonly unit: string;
  readonly canonicalUnit: CanonicalCapacityUnit;
  readonly remainingUnits: bigint;
};

export type CheckoutPricingBreakdown = {
  readonly baseAmount: bigint;
  readonly taxes: bigint;
  readonly mandatoryFees: bigint;
  readonly optionalFees: bigint;
  readonly securityDeposit: bigint;
  readonly contingentLiability: bigint;
  readonly totalProviderAmount: bigint;
  readonly totalExposure: bigint;
};

export type CheckoutCoverageBreakdown = {
  readonly accessEligibleAmount: bigint;
  readonly accessCoverageAmount: bigint;
  readonly userFiatContribution: bigint;
  readonly excludedAmount: bigint;
  readonly otherAuthorizedProgramCoverage: bigint;
  readonly tokenConversionContribution: typeof TOKEN_CONVERSION_CONTRIBUTION;
};

export type CheckoutEntitlementBreakdown = {
  readonly entitlementId: string;
  readonly availableUnits: bigint;
  readonly unitsRequested: bigint;
  readonly unitsToReserve: bigint;
};

export type CheckoutFundingBreakdown = {
  readonly fundingPoolId: string;
  readonly fundingAvailable: bigint;
  readonly fundingToReserve: bigint;
  readonly currency: string;
  readonly fxQuoteKind: FxQuoteKind | null;
  readonly referenceFxEstimateMinorUnits: bigint | null;
};

export type CheckoutQuoteExplanationLine = {
  readonly code: string;
  readonly label: string;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
};

export type CheckoutReservationPlan = {
  readonly entitlementUnitsToReserve: bigint;
  readonly entitlementUnit: string;
  readonly fundingToReserve: bigint;
  readonly fundingCurrency: string;
  readonly userPaymentRequired: bigint;
  readonly providerAmountRequired: bigint;
  readonly securityDepositUserSecured: bigint;
};

/** Authoritative Access checkout calculation for Prompt 35 settlement. */
export type AccessCheckoutQuote = {
  readonly checkoutQuoteId: string;
  readonly accessTransactionId: string;
  readonly userId: string;
  readonly providerId: AccessProviderId;
  readonly providerQuoteId: string;
  readonly category: string;
  readonly productId: string | null;
  readonly requestedUnits: bigint;
  readonly unit: string;
  readonly currency: string;
  readonly pricing: CheckoutPricingBreakdown;
  readonly coverage: CheckoutCoverageBreakdown;
  readonly classifiedComponents: readonly ClassifiedCostComponent[];
  readonly entitlement: CheckoutEntitlementBreakdown;
  readonly funding: CheckoutFundingBreakdown;
  readonly reservationPlan: CheckoutReservationPlan;
  readonly explanation: readonly CheckoutQuoteExplanationLine[];
  readonly expiresAt: UtcInstant;
  readonly status: AccessCheckoutQuoteStatus;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly evidenceReference: string;
  readonly previousCheckoutQuoteId: string | null;
  readonly replacementProviderQuoteId: string | null;
  readonly failureCode: AccessCheckoutQuoteFailureCode | null;
  readonly failureMessage: string | null;
  readonly createdAt: UtcInstant;
};

export type AccessCheckoutQuoteRequest = {
  readonly checkoutQuoteId?: string;
  readonly accessTransactionId: string;
  readonly userId: string;
  readonly category: string;
  readonly productId?: string | null;
  readonly providerQuote: AccessProviderFirmQuote;
  readonly entitlement: CheckoutEntitlementRef;
  readonly requestedUnits: bigint;
  readonly fundingPoolId: string;
  readonly fundingCurrency: string;
  readonly programCoverageRemainingMinorUnits?: bigint | null;
  readonly transactionCoverageCapMinorUnits?: bigint | null;
  readonly otherAuthorizedProgramCoverageMinorUnits?: bigint;
  readonly sunreyCheckoutExpiryMinutes?: number;
  readonly idempotencyKey: string;
  readonly evidenceReference: string;
  readonly now: UtcInstant;
  readonly previousCheckoutQuoteId?: string | null;
};

export type AccessCheckoutQuoteResult =
  | { readonly ok: true; readonly quote: AccessCheckoutQuote; readonly idempotent: boolean }
  | {
      readonly ok: false;
      readonly code: AccessCheckoutQuoteFailureCode;
      readonly message: string;
      readonly quote: AccessCheckoutQuote | null;
    };
