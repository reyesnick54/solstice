/**
 * ACCESS Wave 5 — Consumer protection controls.
 *
 * Price transparency, refund state clarity, cancellation preview.
 */

import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessRefundState } from './taxonomy.ts';
import type {
  AccessCancellationPreview,
  AccessDisputeContext,
  AccessPriceComponents,
  AccessRefundTransparency,
  AccessServiceFee,
  AccessTaxComponent,
} from './types.ts';

export function buildPriceComponents(input: {
  readonly basePriceMinorUnits: bigint;
  readonly taxMinorUnits: bigint;
  readonly mandatoryFeesMinorUnits: bigint;
  readonly optionalFeesMinorUnits: bigint;
  readonly depositMinorUnits: bigint;
  readonly accessCoverageMinorUnits: bigint;
  readonly userContributionMinorUnits: bigint;
  readonly accessServiceFeeMinorUnits?: bigint;
  readonly currency: string;
}): AccessPriceComponents {
  const accessServiceFeeMinorUnits = input.accessServiceFeeMinorUnits ?? 0n;
  const providerTotalMinorUnits =
    input.basePriceMinorUnits + input.taxMinorUnits + input.mandatoryFeesMinorUnits;
  if (
    input.accessCoverageMinorUnits + input.userContributionMinorUnits + accessServiceFeeMinorUnits !==
    providerTotalMinorUnits
  ) {
    throw new Error(
      'price components must reconcile: access coverage + user contribution + service fee = provider service total (excluding deposit)',
    );
  }
  return Object.freeze({
    basePriceMinorUnits: input.basePriceMinorUnits,
    taxMinorUnits: input.taxMinorUnits,
    mandatoryFeesMinorUnits: input.mandatoryFeesMinorUnits,
    optionalFeesMinorUnits: input.optionalFeesMinorUnits,
    depositMinorUnits: input.depositMinorUnits,
    accessCoverageMinorUnits: input.accessCoverageMinorUnits,
    userContributionMinorUnits: input.userContributionMinorUnits,
    accessServiceFeeMinorUnits,
    providerTotalMinorUnits,
    currency: input.currency,
  });
}

export function defaultAccessServiceFee(currency: string): AccessServiceFee {
  return Object.freeze({
    feeId: 'access-service-fee-default',
    amountMinorUnits: 0n,
    currency,
    explicit: true,
    waived: true,
  });
}

export function buildTaxComponents(input: {
  readonly providerCollectedTax: bigint;
  readonly sunreyFee: bigint;
  readonly userFee: bigint;
  readonly accessSubsidy: bigint;
  readonly currency: string;
  readonly jurisdiction: string | null;
}): readonly AccessTaxComponent[] {
  return Object.freeze([
    Object.freeze({
      role: 'PROVIDER_COLLECTED_TAX',
      amountMinorUnits: input.providerCollectedTax,
      currency: input.currency,
      providerSupplied: true,
      jurisdiction: input.jurisdiction,
    }),
    Object.freeze({
      role: 'SUNREY_FEE',
      amountMinorUnits: input.sunreyFee,
      currency: input.currency,
      providerSupplied: false,
      jurisdiction: input.jurisdiction,
    }),
    Object.freeze({
      role: 'USER_FEE',
      amountMinorUnits: input.userFee,
      currency: input.currency,
      providerSupplied: false,
      jurisdiction: input.jurisdiction,
    }),
    Object.freeze({
      role: 'ACCESS_SUBSIDY',
      amountMinorUnits: input.accessSubsidy,
      currency: input.currency,
      providerSupplied: false,
      jurisdiction: input.jurisdiction,
    }),
  ]);
}

export function createRefundTransparency(input: {
  readonly transactionId: string;
  readonly currency: string;
  readonly now: UtcInstant;
}): AccessRefundTransparency {
  return Object.freeze({
    refundId: `ref_${randomUUID().replace(/-/g, '')}`,
    transactionId: input.transactionId,
    states: Object.freeze([]),
    providerPenaltyMinorUnits: null,
    estimatedUserRefundMinorUnits: null,
    estimatedAccessRestorationMinorUnits: null,
  });
}

export function appendRefundState(
  transparency: AccessRefundTransparency,
  state: AccessRefundState,
  input: {
    readonly amountMinorUnits: bigint | null;
    readonly currency: string | null;
    readonly estimated: boolean;
    readonly updatedAt: UtcInstant;
  },
): AccessRefundTransparency {
  return Object.freeze({
    ...transparency,
    states: Object.freeze([
      ...transparency.states,
      Object.freeze({
        state,
        amountMinorUnits: input.amountMinorUnits,
        currency: input.currency,
        estimated: input.estimated,
        updatedAt: input.updatedAt,
      }),
    ]),
  });
}

export function isFullyRefundedToUser(transparency: AccessRefundTransparency): boolean {
  return transparency.states.some((row) => row.state === 'USER_REFUNDED' && !row.estimated);
}

export function hasOnlyProviderRefundPending(transparency: AccessRefundTransparency): boolean {
  const hasPending = transparency.states.some((row) => row.state === 'PROVIDER_REFUND_PENDING');
  const hasUserRefunded = transparency.states.some((row) => row.state === 'USER_REFUNDED');
  return hasPending && !hasUserRefunded;
}

export function buildCancellationPreview(input: {
  readonly transactionId: string;
  readonly providerPenaltyMinorUnits: bigint | null;
  readonly estimatedRefundableMinorUnits: bigint | null;
  readonly estimatedAccessRestorationUnits: bigint | null;
  readonly estimatedUserRefundMinorUnits: bigint | null;
  readonly amountsConfirmed: boolean;
  readonly disclosureIds: readonly string[];
}): AccessCancellationPreview {
  return Object.freeze({
    transactionId: input.transactionId,
    providerPenaltyMinorUnits: input.providerPenaltyMinorUnits,
    estimatedRefundableMinorUnits: input.estimatedRefundableMinorUnits,
    estimatedAccessRestorationUnits: input.estimatedAccessRestorationUnits,
    estimatedUserRefundMinorUnits: input.estimatedUserRefundMinorUnits,
    amountsConfirmed: input.amountsConfirmed,
    disclosures: Object.freeze([...input.disclosureIds]),
  });
}

export function createDisputeContext(input: {
  readonly category: AccessDisputeContext['category'];
  readonly accessTransactionId: string;
  readonly canonicalPaymentDisputeRef?: string | null;
  readonly providerDisputeRef?: string | null;
  readonly entitlementDisputeRef?: string | null;
}): AccessDisputeContext {
  return Object.freeze({
    disputeId: `dsp_${randomUUID().replace(/-/g, '')}`,
    category: input.category,
    accessTransactionId: input.accessTransactionId,
    canonicalPaymentDisputeRef: input.canonicalPaymentDisputeRef ?? null,
    providerDisputeRef: input.providerDisputeRef ?? null,
    entitlementDisputeRef: input.entitlementDisputeRef ?? null,
  });
}

/** Proportional refund split — configurable policy, default 75/25 access/user. */
export function proportionalRefundSplit(input: {
  readonly providerRefundMinorUnits: bigint;
  readonly originalAccessCoverage: bigint;
  readonly originalUserContribution: bigint;
  readonly accessShareNumerator?: bigint;
  readonly accessShareDenominator?: bigint;
}): { readonly accessRestored: bigint; readonly userRefunded: bigint } {
  const numerator = input.accessShareNumerator ?? 75n;
  const denominator = input.accessShareDenominator ?? 100n;
  const originalTotal = input.originalAccessCoverage + input.originalUserContribution;
  if (originalTotal === 0n) {
    return Object.freeze({ accessRestored: 0n, userRefunded: 0n });
  }
  const accessRestored = (input.providerRefundMinorUnits * numerator) / denominator;
  const userRefunded = input.providerRefundMinorUnits - accessRestored;
  return Object.freeze({ accessRestored, userRefunded });
}

export function coveragePromiseBoundary(input: {
  readonly entitlementUnitsRemaining: bigint;
  readonly fundedRedemptionAvailability: 'HEALTHY' | 'LIMITED' | 'EXHAUSTED' | 'SUSPENDED';
}): {
  readonly hasEntitlementUnits: boolean;
  readonly fundedRedemptionLimited: boolean;
  readonly message: string;
} {
  const hasEntitlementUnits = input.entitlementUnitsRemaining > 0n;
  const fundedRedemptionLimited =
    input.fundedRedemptionAvailability === 'LIMITED' ||
    input.fundedRedemptionAvailability === 'EXHAUSTED' ||
    input.fundedRedemptionAvailability === 'SUSPENDED';
  const message =
    hasEntitlementUnits && fundedRedemptionLimited
      ? 'entitlement units remain but funded redemption availability is limited — these are distinct states'
      : hasEntitlementUnits
        ? 'entitlement units available'
        : 'no entitlement units remaining';
  return Object.freeze({ hasEntitlementUnits, fundedRedemptionLimited, message });
}
