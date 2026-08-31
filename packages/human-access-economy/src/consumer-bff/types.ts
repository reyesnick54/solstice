import type { AccessCategory } from '../taxonomy.ts';

export const CONSUMER_PRODUCT_STATUSES = ['LIVE', 'PARTIAL', 'STALE', 'UNAVAILABLE', 'SIMULATED'] as const;
export type ConsumerProductStatus = (typeof CONSUMER_PRODUCT_STATUSES)[number];

export const CONSUMER_TRANSACTION_STATUSES = [
  'PROCESSING',
  'BOOKED',
  'CONFIRMED',
  'FULFILLED',
  'CANCELLED',
  'REFUND_PENDING',
  'REFUNDED',
  'ACTION_REQUIRED',
  'FAILED',
  'PROCESSING_CONFIRMATION',
] as const;
export type ConsumerTransactionStatus = (typeof CONSUMER_TRANSACTION_STATUSES)[number];

export const CONSUMER_FUNDING_STATUSES = ['AVAILABLE', 'LIMITED', 'TEMPORARILY_UNAVAILABLE'] as const;
export type ConsumerFundingStatus = (typeof CONSUMER_FUNDING_STATUSES)[number];

export const CONSUMER_DISCOVERY_STATUSES = ['AVAILABLE', 'LIMITED', 'TEMPORARILY_UNAVAILABLE', 'UNKNOWN'] as const;
export type ConsumerDiscoveryStatus = (typeof CONSUMER_DISCOVERY_STATUSES)[number];

export const PRICE_KINDS = ['REFERENCE', 'FIRM'] as const;
export type PriceKind = (typeof PRICE_KINDS)[number];

export const CONSUMER_ACCESS_ERROR_CODES = [
  'PROVIDER_TEMPORARILY_UNAVAILABLE',
  'QUOTE_EXPIRED',
  'PRICE_CHANGED',
  'BOOKING_CONFIRMATION_PENDING',
  'PAYMENT_ACTION_REQUIRED',
  'REFUND_PENDING',
  'FUNDING_TEMPORARILY_UNAVAILABLE',
] as const;
export type ConsumerAccessErrorCode = (typeof CONSUMER_ACCESS_ERROR_CODES)[number];

export type AccessMoneyBreakdown = {
  readonly currency: string;
  readonly baseAmountMinorUnits: string;
  readonly taxesMinorUnits: string;
  readonly mandatoryFeesMinorUnits: string;
  readonly optionalFeesMinorUnits: string;
  readonly securityDepositMinorUnits: string;
  readonly totalProviderAmountMinorUnits: string;
  readonly accessEligibleAmountMinorUnits: string;
  readonly accessCoverageAmountMinorUnits: string;
  readonly userContributionMinorUnits: string;
  readonly excludedAmountMinorUnits: string;
};

export type AccessDepositWarning = {
  readonly required: boolean;
  readonly amountMinorUnits: string | null;
  readonly currency: string;
  readonly paidSeparately: boolean;
  readonly accessCovered: false;
  readonly message: string;
};

export type AccessEntitlementView = {
  readonly entitlementId: string;
  readonly category: AccessCategory;
  readonly product: string;
  readonly unit: string;
  readonly allocatedUnits: number;
  readonly reservedUnits: number;
  readonly consumedUnits: number;
  readonly remainingUnits: number;
  readonly effectiveFrom: string;
  readonly expiresAt: string | null;
  readonly status: string;
  readonly allocationPeriod: string | null;
  readonly displayMetadata: Readonly<Record<string, string>>;
};

export type AccessCategorySummaryView = {
  readonly category: AccessCategory;
  readonly displayName: string;
  readonly status: ConsumerProductStatus;
  readonly availableUnits: number;
  readonly reservedUnits: number;
  readonly usedUnits: number;
  readonly unit: string;
  readonly expiresAt: string | null;
  readonly fundedAvailabilityStatus: ConsumerFundingStatus;
  readonly discoveryAvailabilityStatus: ConsumerDiscoveryStatus;
};

export type AccessOverviewResponse = {
  readonly schema: 'sunrey.consumer.access.dashboard.v1';
  readonly productionReady: false;
  readonly productionActive: false;
  readonly liveConnectivityEnabled: false;
  readonly user: {
    readonly accessEnabled: boolean;
    readonly allocationPeriod: string;
    readonly nextAllocationDate: string | null;
  };
  readonly summary: {
    readonly totalActiveEntitlements: number;
    readonly expiringSoonCount: number;
    readonly activeBookingsCount: number;
    readonly pendingActionsCount: number;
  };
  readonly categories: readonly AccessCategorySummaryView[];
  readonly recentActivity: readonly AccessHistoryItemView[];
  readonly upcomingBookings: readonly AccessBookingSummaryView[];
  readonly recommendedOpportunities: readonly AccessOpportunityView[] | null;
  readonly overallStatus: ConsumerProductStatus;
  readonly updatedAt: string;
};

export type AccessHomeSummary = {
  readonly schema: 'sunrey.consumer.access.home-summary.v1';
  readonly accessEnabled: boolean;
  readonly overallStatus: ConsumerProductStatus;
  readonly categoryHighlights: readonly { readonly category: AccessCategory; readonly label: string; readonly remainingUnits: number; readonly unit: string }[];
  readonly nextExpiration: string | null;
  readonly activeBooking: AccessBookingSummaryView | null;
  readonly actionRequired: boolean;
  readonly actionRequiredMessage: string | null;
};

export type AccessOpportunityView = {
  readonly opportunityId: string;
  readonly category: AccessCategory;
  readonly title: string;
  readonly description: string;
  readonly providerDisplayName: string;
  readonly providerType: string;
  readonly providerTermsReference: string | null;
  readonly location: string | null;
  readonly start: string | null;
  readonly end: string | null;
  readonly availabilityStatus: string;
  readonly unit: string;
  readonly referencePrice: { readonly kind: 'REFERENCE'; readonly currency: string; readonly minorUnits: string } | null;
  readonly imageReference: string | null;
  readonly sourceType: 'SIMULATION' | 'PROVIDER_CATALOG';
  readonly fulfillmentCapability: boolean;
  readonly bookingCapability: boolean;
  readonly status: ConsumerProductStatus;
  readonly freshness: string;
  readonly travelAccessLink: string | null;
};

export type AccessCheckoutQuoteView = {
  readonly schema: 'sunrey.consumer.access.checkout-quote.v1';
  readonly checkoutQuoteId: string;
  readonly opportunityId: string;
  readonly priceKind: 'FIRM';
  readonly currency: string;
  readonly breakdown: AccessMoneyBreakdown;
  readonly depositWarning: AccessDepositWarning | null;
  readonly accessUsed: { readonly unit: string; readonly quantity: number };
  readonly remainingAfterPurchase: { readonly unit: string; readonly quantity: number } | null;
  readonly expiresAt: string;
  readonly displayLines: readonly { readonly label: string; readonly amountMinorUnits: string; readonly emphasis?: 'TOTAL' | 'ACCESS' | 'USER' }[];
  readonly simulationOnly: true;
};

export type AccessTransactionView = {
  readonly schema: 'sunrey.consumer.access.transaction.v1';
  readonly transactionId: string;
  readonly status: ConsumerTransactionStatus;
  readonly consumerStatusMessage: string;
  readonly category: AccessCategory;
  readonly summary: string;
  readonly checkoutQuoteId: string;
  readonly bookingId: string | null;
  readonly paymentMethodId: string | null;
  readonly refund: AccessRefundView | null;
  readonly updatedAt: string;
  readonly simulationOnly: true;
};

export type AccessRefundView = {
  readonly refundStatus: 'NONE' | 'PENDING' | 'PARTIAL' | 'COMPLETED';
  readonly originalAmountMinorUnits: string;
  readonly providerRefundAmountMinorUnits: string | null;
  readonly accessPoolRefundMinorUnits: string | null;
  readonly userRefundMinorUnits: string | null;
  readonly penaltyMinorUnits: string | null;
  readonly expectedTiming: string | null;
  readonly entitlementRestorationStatus: 'NONE' | 'PENDING' | 'RESTORED';
};

export type AccessBookingView = {
  readonly schema: 'sunrey.consumer.access.booking.v1';
  readonly bookingId: string;
  readonly transactionId: string;
  readonly providerDisplayName: string;
  readonly service: string;
  readonly location: string | null;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly confirmationReference: string | null;
  readonly accessUnits: { readonly unit: string; readonly quantity: number };
  readonly accessCoverage: { readonly currency: string; readonly minorUnits: string };
  readonly userContribution: { readonly currency: string; readonly minorUnits: string };
  readonly deposit: AccessDepositWarning | null;
  readonly termsReference: string | null;
  readonly cancellationPolicy: string | null;
  readonly status: ConsumerTransactionStatus;
  readonly simulationOnly: true;
};

export type AccessBookingSummaryView = {
  readonly bookingId: string;
  readonly summary: string;
  readonly category: AccessCategory;
  readonly status: ConsumerTransactionStatus;
  readonly startsAt: string | null;
};

export type AccessHistoryItemView = {
  readonly historyId: string;
  readonly kind: 'ALLOCATION' | 'BOOKING' | 'FULFILLMENT' | 'CANCELLATION' | 'REFUND' | 'SEARCH' | 'QUOTE';
  readonly category: AccessCategory | null;
  readonly summary: string;
  readonly status: ConsumerTransactionStatus | string | null;
  readonly occurredAt: string;
  readonly referenceId: string | null;
};

export type AccessAllocationExplanation = {
  readonly schema: 'sunrey.consumer.access.allocation-explanation.v1';
  readonly summary: string;
  readonly allocationPeriod: string;
  readonly categoryAllocations: readonly {
    readonly category: AccessCategory;
    readonly displayName: string;
    readonly units: number;
    readonly unit: string;
    readonly expiresAt: string | null;
  }[];
  readonly simulationOnly: true;
};

export type AccessCategoryDetailView = {
  readonly schema: 'sunrey.consumer.access.category-detail.v1';
  readonly category: AccessCategory;
  readonly displayName: string;
  readonly description: string;
  readonly unit: string;
  readonly userAvailability: {
    readonly remainingUnits: number;
    readonly reservedUnits: number;
    readonly expiresAt: string | null;
  };
  readonly fundingStatus: ConsumerFundingStatus;
  readonly discoveryStatus: ConsumerDiscoveryStatus;
  readonly supportedGeographies: readonly string[];
  readonly providerAvailability: readonly { readonly providerDisplayName: string; readonly providerType: string; readonly status: ConsumerProductStatus }[];
  readonly opportunitiesSummary: { readonly count: number; readonly status: ConsumerProductStatus };
};

export type AccessEntitlementDetailView = {
  readonly schema: 'sunrey.consumer.access.entitlement-detail.v1';
  readonly entitlement: AccessEntitlementView;
  readonly usageHistory: readonly AccessHistoryItemView[];
  readonly reservationHistory: readonly AccessHistoryItemView[];
  readonly expiration: { readonly expiresAt: string | null; readonly expiringSoon: boolean };
  readonly categoryRules: readonly string[];
  readonly termsReference: string;
  readonly allocationExplanation: string;
};

export type AccessSearchInput = {
  readonly category: AccessCategory;
  readonly location?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly units?: number;
  readonly unit?: string;
  readonly query?: string;
  readonly filters?: Readonly<Record<string, string>>;
  readonly sort?: string;
  readonly cursor?: string;
  readonly pageSize?: number;
};

export type AccessCheckoutQuoteInput = {
  readonly opportunityId: string;
  readonly requestedUnits: number;
  readonly start?: string;
  readonly end?: string;
  readonly selectedOptions?: Readonly<Record<string, string>>;
  readonly userAcknowledgements?: readonly string[];
  readonly idempotencyKey: string;
};

export type AccessReserveInput = {
  readonly checkoutQuoteId: string;
  readonly paymentMethodId?: string;
  readonly idempotencyKey: string;
};

export type AccessConfirmTransactionInput = {
  readonly userApproved?: boolean;
  readonly paymentMethodId?: string;
  readonly idempotencyKey: string;
};

export type AccessHistoryFilters = {
  readonly category?: AccessCategory;
  readonly status?: string;
  readonly fromDate?: string;
  readonly toDate?: string;
  readonly cursor?: string;
  readonly pageSize?: number;
};

export type AccessEntitlementFilters = {
  readonly category?: AccessCategory;
  readonly status?: string;
  readonly period?: string;
  readonly expiringSoon?: boolean;
};
