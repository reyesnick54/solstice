/**
 * ACCESS-14 — Redemption domain types.
 */

import type { AccessProviderId, CanonicalCapacityUnit, ProviderQuote, ProviderRightKind } from '../types.ts';
import type { CoverageDecision } from '../coverage-policy.ts';
import type { FundingComposition } from '../funding-router.ts';

export const REDEMPTION_STATUSES = [
  'FULLY_COVERED',
  'PARTIALLY_COVERED',
  'USER_CONTRIBUTION_REQUIRED',
  'ENTITLEMENT_INSUFFICIENT',
  'NOT_ELIGIBLE',
  'PROVIDER_UNAVAILABLE',
  'POLICY_BLOCKED',
  'QUOTE_EXPIRED',
  'AUTHORIZATION_REQUIRED',
  'READY_FOR_APPROVAL',
  'REDEEMED',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];

export const ENTITLEMENT_HOLD_STATES = [
  'AVAILABLE',
  'HELD',
  'CONSUMED',
  'RELEASED',
  'EXPIRED',
  'REINSTATED_AFTER_REFUND',
] as const;
export type EntitlementHoldState = (typeof ENTITLEMENT_HOLD_STATES)[number];

export type RedemptionEntitlementRef = {
  readonly entitlementId: string;
  readonly entitlementClass: string;
  readonly availableUnits: bigint;
  readonly canonicalUnit: CanonicalCapacityUnit;
};

export type RedemptionRequest = {
  readonly redemptionId: string;
  readonly subjectRef: string;
  readonly intentId: string | null;
  readonly category: string;
  readonly providerId: AccessProviderId;
  readonly providerQuote: ProviderQuote;
  readonly entitlement: RedemptionEntitlementRef;
  readonly requestedQuantity: bigint;
  readonly jurisdiction: string;
  readonly maxUserContributionMinorUnits: bigint;
  readonly policyContext: {
    readonly benefitSource: string;
    readonly geographicZone: string | null;
    readonly serviceLevel: string;
  };
};

export type RedemptionDecision = {
  readonly redemptionId: string;
  readonly status: RedemptionStatus;
  readonly providerPriceMinorUnits: bigint;
  readonly coverage: CoverageDecision | null;
  readonly userContributionMinorUnits: bigint;
  readonly entitlementUnitsHeld: bigint;
  readonly explanation: readonly string[];
};

export type RedemptionRecord = {
  readonly redemptionId: string;
  readonly subjectRef: string;
  readonly status: RedemptionStatus;
  readonly providerId: AccessProviderId;
  readonly providerQuoteId: string;
  readonly providerBookingId: string | null;
  readonly accessRightRef: string | null;
  readonly rightKind: ProviderRightKind | null;
  readonly decision: RedemptionDecision;
  readonly funding: FundingComposition | null;
  readonly entitlementHoldState: EntitlementHoldState;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type BundleFailurePolicy = 'ALL_OR_NOTHING' | 'PARTIAL_WITH_APPROVAL' | 'BEST_EFFORT';

export type ExperienceBundleComponent = {
  readonly componentId: string;
  readonly providerId: AccessProviderId;
  readonly category: string;
  readonly quoteId: string | null;
  readonly status: RedemptionStatus;
};

export type ExperienceBundleRedemption = {
  readonly bundleId: string;
  readonly subjectRef: string;
  readonly failurePolicy: BundleFailurePolicy;
  readonly components: readonly ExperienceBundleComponent[];
  readonly status: RedemptionStatus;
};
