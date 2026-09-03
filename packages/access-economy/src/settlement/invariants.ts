/**
 * ACCESS Wave 3 Prompt 35 — Settlement equation and plan invariants.
 */

import { LAUNCH_TOKEN_CONVERSION_CONTRIBUTION } from './taxonomy.ts';
import type {
  AccessCheckoutQuote,
  AccessRefundAllocation,
  AccessSettlementFailure,
  AccessSettlementPlan,
  AccessSettlementSourceOfFunds,
} from './types.ts';
import { accessEvidenceRefFor, type AccessEvidenceRef } from '../domain/ids.ts';

export function settlementFailure(
  code: AccessSettlementFailure['code'],
  message: string,
): AccessSettlementFailure {
  return Object.freeze({ code, message });
}

/**
 * ProviderSettlementAmount =
 *   AccessPoolContribution +
 *   UserFiatContribution +
 *   TokenConversionContribution +
 *   OtherExplicitProgramContribution
 */
export function computeProviderSettlementAmount(sources: AccessSettlementSourceOfFunds): bigint {
  return (
    sources.accessPoolContribution +
    sources.userFiatContribution +
    sources.tokenConversionContribution +
    sources.otherProgramContribution
  );
}

export function validateSettlementEquation(input: {
  readonly providerAmount: bigint;
  readonly accessPoolContribution: bigint;
  readonly userFiatContribution: bigint;
  readonly tokenConversionContribution: bigint;
  readonly otherProgramContribution: bigint;
}): AccessSettlementFailure | null {
  if (input.tokenConversionContribution !== LAUNCH_TOKEN_CONVERSION_CONTRIBUTION) {
    return settlementFailure(
      'TOKEN_CONVERSION_NON_ZERO',
      'tokenConversionContribution must be zero at launch',
    );
  }
  const computed =
    input.accessPoolContribution +
    input.userFiatContribution +
    input.tokenConversionContribution +
    input.otherProgramContribution;
  if (computed !== input.providerAmount) {
    return settlementFailure(
      'SETTLEMENT_EQUATION_MISMATCH',
      `providerAmount (${input.providerAmount}) must equal funding sources (${computed})`,
    );
  }
  return null;
}

export function sourceOfFundsFromPlan(plan: AccessSettlementPlan): AccessSettlementSourceOfFunds {
  return Object.freeze({
    accessPoolContribution: plan.accessPoolContribution,
    userFiatContribution: plan.userContribution,
    tokenConversionContribution: plan.tokenConversionContribution,
    otherProgramContribution: plan.otherProgramContribution,
    currency: plan.currency,
  });
}

export function validateCheckoutQuote(quote: AccessCheckoutQuote): AccessSettlementFailure | null {
  return validateSettlementEquation({
    providerAmount: quote.providerAmount,
    accessPoolContribution: quote.accessPoolContribution,
    userFiatContribution: quote.userContribution,
    tokenConversionContribution: quote.tokenConversionContribution,
    otherProgramContribution: quote.otherProgramContribution,
  });
}

export function validateSettlementPlan(plan: AccessSettlementPlan): AccessSettlementFailure | null {
  return validateSettlementEquation({
    providerAmount: plan.providerAmount,
    accessPoolContribution: plan.accessPoolContribution,
    userFiatContribution: plan.userContribution,
    tokenConversionContribution: plan.tokenConversionContribution,
    otherProgramContribution: plan.otherProgramContribution,
  });
}

/** Deterministic proportional refund allocation — basis for Prompt 37. */
export function allocateProportionalRefund(input: {
  readonly totalRefundAmount: bigint;
  readonly original: AccessSettlementSourceOfFunds;
  readonly evidenceReference: AccessEvidenceRef;
}): AccessRefundAllocation {
  const originalTotal = computeProviderSettlementAmount(input.original);
  if (originalTotal === 0n || input.totalRefundAmount === 0n) {
    return Object.freeze({
      totalRefundAmount: input.totalRefundAmount,
      accessPoolRefund: 0n,
      userRefund: 0n,
      tokenConversionRefund: 0n,
      otherProgramRefund: 0n,
      currency: input.original.currency,
      policy: 'PROPORTIONAL',
      evidenceReference: input.evidenceReference,
    });
  }

  const accessPoolRefund =
    (input.totalRefundAmount * input.original.accessPoolContribution) / originalTotal;
  const userRefund =
    (input.totalRefundAmount * input.original.userFiatContribution) / originalTotal;
  const tokenConversionRefund =
    (input.totalRefundAmount * input.original.tokenConversionContribution) / originalTotal;
  const otherProgramRefund =
    input.totalRefundAmount - accessPoolRefund - userRefund - tokenConversionRefund;

  return Object.freeze({
    totalRefundAmount: input.totalRefundAmount,
    accessPoolRefund,
    userRefund,
    tokenConversionRefund,
    otherProgramRefund,
    currency: input.original.currency,
    policy: 'PROPORTIONAL',
    evidenceReference: input.evidenceReference,
  });
}

export function buildSettlementPlanFromQuote(input: {
  readonly quote: AccessCheckoutQuote;
  readonly accessTransactionId: import('../domain/ids.ts').AccessDomainTransactionId;
  readonly planId: string;
  readonly paymentRail: import('./taxonomy.ts').AccessPaymentRailKind;
  readonly providerPaymentMethod: import('./types.ts').ProviderPaymentMethodRef;
  readonly userFundingSource: import('./types.ts').UserFundingSourceRef;
  readonly settlementStrategy: import('./taxonomy.ts').AccessSettlementStrategy;
}): AccessSettlementPlan {
  const failure = validateCheckoutQuote(input.quote);
  if (failure) {
    throw new RangeError(failure.message);
  }
  return Object.freeze({
    planId: input.planId,
    checkoutQuoteId: input.quote.checkoutQuoteId,
    accessTransactionId: input.accessTransactionId,
    userId: input.quote.userId,
    providerId: input.quote.providerId,
    category: input.quote.category,
    unit: input.quote.unit,
    entitlementId: input.quote.entitlementId,
    entitlementUnits: input.quote.entitlementUnits,
    fundingPoolId: input.quote.fundingPoolId,
    currency: input.quote.currency,
    providerAmount: input.quote.providerAmount,
    accessPoolContribution: input.quote.accessPoolContribution,
    userContribution: input.quote.userContribution,
    tokenConversionContribution: input.quote.tokenConversionContribution,
    otherProgramContribution: input.quote.otherProgramContribution,
    paymentRail: input.paymentRail,
    providerPaymentMethod: input.providerPaymentMethod,
    userFundingSource: input.userFundingSource,
    settlementStrategy: input.settlementStrategy,
    expiresAt: input.quote.expiresAt,
    evidenceReference: input.quote.evidenceReference,
  });
}
