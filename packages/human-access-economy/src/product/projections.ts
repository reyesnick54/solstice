/**
 * Access Wave 4 product projections — Home, landing, history, upcoming, checkout.
 */

import { ACCESS_CATEGORY_LABELS, ACCESS_CATEGORIES, ACCESS_POSTURE, type AccessCategory } from '../taxonomy.ts';
import type { AccessEntitlement, AccessRecommendation, AccessReservation } from '../types.ts';
import type { AccessActivityItem } from './activity.ts';
import type { AccessCapabilityView } from '../projections.ts';
import type { AccessProductTransaction } from './transactions.ts';
import { ACCESS_PRODUCT_TERMINOLOGY } from './taxonomy.ts';

export type AccessHomeSummaryView = {
  readonly schema: 'sunrey.consumer.access.home-summary.v1';
  readonly productionReady: false;
  readonly productionActive: false;
  readonly liveConnectivityEnabled: false;
  readonly navigationLabel: 'Access';
  readonly title: 'Your Available Access';
  readonly categories: readonly {
    readonly category: AccessCategory;
    readonly label: string;
    readonly availableUnits: number;
    readonly unitLabel: string;
    readonly dataState: 'SIMULATED' | 'LIVE' | 'UNAVAILABLE';
  }[];
  readonly nextExpiration: {
    readonly category: AccessCategory;
    readonly label: string;
    readonly expiresAt: string;
    readonly remainingUnits: number;
  } | null;
  readonly primaryCta: 'Explore Access';
  readonly capability: AccessCapabilityView;
  readonly terminology: typeof ACCESS_PRODUCT_TERMINOLOGY;
};

export type AccessLandingView = {
  readonly schema: 'sunrey.consumer.access.landing.v1';
  readonly productionReady: false;
  readonly productionActive: false;
  readonly liveConnectivityEnabled: false;
  readonly sections: readonly {
    readonly key: 'YOUR_ACCESS' | 'EXPLORE' | 'UPCOMING' | 'RECOMMENDED' | 'RECENT_ACTIVITY';
    readonly label: string;
    readonly enabled: boolean;
  }[];
  readonly categoryCards: readonly {
    readonly category: AccessCategory;
    readonly label: string;
    readonly enabled: boolean;
    readonly dataState: 'SIMULATED' | 'UNAVAILABLE';
  }[];
  readonly yourAccess: AccessHomeSummaryView['categories'];
  readonly capability: AccessCapabilityView;
};

export type AccessUpcomingItem = {
  readonly upcomingId: string;
  readonly transactionId: string | null;
  readonly reservationId: string | null;
  readonly serviceName: string;
  readonly providerDisplayName: string;
  readonly category: AccessCategory;
  readonly serviceDate: string | null;
  readonly location: string | null;
  readonly bookingStatus: string;
  readonly bookingStatusLabel: string;
  readonly actionRequired: boolean;
  readonly requiredActions: readonly string[];
  readonly cancellationDeadline: string | null;
  readonly depositWarning: string | null;
  readonly dataState: 'SIMULATED' | 'LIVE';
};

export type AccessCheckoutView = {
  readonly schema: 'sunrey.consumer.access.checkout.v1';
  readonly transactionId: string;
  readonly providerDisplayName: string;
  readonly serviceName: string;
  readonly category: AccessCategory;
  readonly serviceDate: string | null;
  readonly location: string | null;
  readonly units: string;
  readonly unitLabel: string;
  readonly currency: string;
  readonly providerPrice: string;
  readonly accessCoverage: string;
  readonly userContribution: string;
  readonly taxes: string;
  readonly mandatoryFees: string;
  readonly optionalFees: string;
  readonly deposit: string | null;
  readonly depositWarning: string | null;
  readonly cancellationTerms: string;
  readonly quoteExpiresAt: string | null;
  readonly paymentRequired: boolean;
  readonly confirmationAction: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly requiredActions: readonly string[];
  readonly dataState: 'SIMULATED' | 'LIVE';
  readonly fundingAvailable: boolean;
};

export type AccessHistoryView = {
  readonly schema: 'sunrey.consumer.access.history.v1';
  readonly productionReady: false;
  readonly productionActive: false;
  readonly liveConnectivityEnabled: false;
  readonly filter: string;
  readonly items: readonly AccessActivityItem[];
};

export type AccessSupportContext = {
  readonly schema: 'sunrey.consumer.access.support-context.v1';
  readonly transactionId: string;
  readonly bookingStatus: string;
  readonly providerDisplayName: string | null;
  readonly lastEvent: string | null;
  readonly refundStatus: string | null;
  readonly reconciliationStatus: string | null;
  readonly serviceName: string;
};

function unitLabelFor(category: AccessCategory): string {
  switch (category) {
    case 'MOBILITY':
      return 'Days';
    case 'STAY_HOUSING':
      return 'Nights';
    case 'EXPERIENCES':
      return 'Credits';
    case 'COMPUTE_AI':
      return 'Hours';
    case 'FOOD':
      return 'Meals';
    default:
      return 'units';
  }
}

export function projectAccessHomeSummary(input: {
  readonly capability: AccessCapabilityView;
  readonly entitlements: readonly AccessEntitlement[];
}): AccessHomeSummaryView {
  const enabled = input.capability.enabled;
  const categories = ACCESS_CATEGORIES.map((category) => {
    const ent = input.entitlements.find((row) => row.category === category && row.status === 'ACTIVE');
    return Object.freeze({
      category,
      label: ACCESS_CATEGORY_LABELS[category],
      availableUnits: enabled && ent ? (ent.remainingUses ?? 0) : 0,
      unitLabel: unitLabelFor(category),
      dataState: enabled ? ('SIMULATED' as const) : ('UNAVAILABLE' as const),
    });
  }).filter((row) => row.availableUnits > 0 || ['MOBILITY', 'STAY_HOUSING', 'EXPERIENCES', 'COMPUTE_AI'].includes(row.category));

  const expiring = input.entitlements
    .filter((row) => row.status === 'ACTIVE' && row.validUntil && (row.remainingUses ?? 0) > 0)
    .sort((a, b) => (a.validUntil ?? '').localeCompare(b.validUntil ?? ''))[0];

  return Object.freeze({
    schema: 'sunrey.consumer.access.home-summary.v1',
    ...ACCESS_POSTURE,
    navigationLabel: 'Access',
    title: 'Your Available Access',
    categories,
    nextExpiration: expiring
      ? Object.freeze({
          category: expiring.category,
          label: ACCESS_CATEGORY_LABELS[expiring.category],
          expiresAt: expiring.validUntil!,
          remainingUnits: expiring.remainingUses ?? 0,
        })
      : null,
    primaryCta: 'Explore Access',
    capability: input.capability,
    terminology: ACCESS_PRODUCT_TERMINOLOGY,
  });
}

export function projectAccessLanding(input: {
  readonly capability: AccessCapabilityView;
  readonly entitlements: readonly AccessEntitlement[];
  readonly recommendations: readonly AccessRecommendation[];
}): AccessLandingView {
  const home = projectAccessHomeSummary(input);
  return Object.freeze({
    schema: 'sunrey.consumer.access.landing.v1',
    ...ACCESS_POSTURE,
    sections: Object.freeze([
      Object.freeze({ key: 'YOUR_ACCESS' as const, label: 'Your Access', enabled: input.capability.enabled }),
      Object.freeze({ key: 'EXPLORE' as const, label: 'Explore', enabled: input.capability.enabled }),
      Object.freeze({ key: 'UPCOMING' as const, label: 'Upcoming', enabled: input.capability.enabled }),
      Object.freeze({
        key: 'RECOMMENDED' as const,
        label: 'Recommended',
        enabled: input.capability.enabled && input.recommendations.length > 0,
      }),
      Object.freeze({ key: 'RECENT_ACTIVITY' as const, label: 'Recent Activity', enabled: input.capability.enabled }),
    ]),
    categoryCards: ACCESS_CATEGORIES.map((category) =>
      Object.freeze({
        category,
        label: ACCESS_CATEGORY_LABELS[category],
        enabled: input.capability.enabled,
        dataState: input.capability.enabled ? ('SIMULATED' as const) : ('UNAVAILABLE' as const),
      }),
    ),
    yourAccess: home.categories,
    capability: input.capability,
  });
}

export function projectUpcomingAccess(input: {
  readonly transactions: readonly AccessProductTransaction[];
  readonly reservations: readonly AccessReservation[];
}): readonly AccessUpcomingItem[] {
  const items: AccessUpcomingItem[] = [];
  for (const txn of input.transactions) {
    if (!['BOOKING_CONFIRMED', 'BOOKED', 'PROCESSING_CONFIRMATION'].includes(txn.status)) {
      continue;
    }
    items.push(
      Object.freeze({
        upcomingId: `upc_${txn.transactionId}`,
        transactionId: txn.transactionId,
        reservationId: txn.reservationId,
        serviceName: txn.serviceName,
        providerDisplayName: txn.providerDisplayName ?? 'Provider',
        category: txn.category,
        serviceDate: txn.serviceDate,
        location: txn.location,
        bookingStatus: txn.status,
        bookingStatusLabel: txn.productStatusLabel,
        actionRequired: txn.requiredActions.length > 0,
        requiredActions: txn.requiredActions,
        cancellationDeadline: txn.cancellationDeadline,
        depositWarning:
          txn.depositMinorUnits !== null
            ? `Refundable deposit: ${txn.depositMinorUnits} minor units — paid/secured separately`
            : null,
        dataState: txn.dataState,
      }),
    );
  }
  for (const res of input.reservations) {
    if (!['HELD', 'CONFIRMED', 'IN_PROGRESS'].includes(res.status)) {
      continue;
    }
    if (items.some((row) => row.reservationId === res.reservationId)) {
      continue;
    }
    items.push(
      Object.freeze({
        upcomingId: `upc_rsv_${res.reservationId}`,
        transactionId: null,
        reservationId: res.reservationId,
        serviceName: res.summary,
        providerDisplayName: 'Provider',
        category: res.category,
        serviceDate: res.startsAt,
        location: res.location,
        bookingStatus: res.status,
        bookingStatusLabel: res.status,
        actionRequired: false,
        requiredActions: Object.freeze([]),
        cancellationDeadline: null,
        depositWarning: null,
        dataState: 'SIMULATED',
      }),
    );
  }
  return Object.freeze(items.sort((a, b) => (a.serviceDate ?? '').localeCompare(b.serviceDate ?? '')));
}

export function projectCheckout(transaction: AccessProductTransaction): AccessCheckoutView {
  return Object.freeze({
    schema: 'sunrey.consumer.access.checkout.v1',
    transactionId: transaction.transactionId,
    providerDisplayName: transaction.providerDisplayName ?? 'Provider',
    serviceName: transaction.serviceName,
    category: transaction.category,
    serviceDate: transaction.serviceDate,
    location: transaction.location,
    units: transaction.unitsUsed,
    unitLabel: transaction.unitLabel,
    currency: transaction.currency,
    providerPrice: transaction.providerTotalMinorUnits,
    accessCoverage: transaction.accessCoverageMinorUnits,
    userContribution: transaction.userContributionMinorUnits,
    taxes: '0',
    mandatoryFees: '0',
    optionalFees: '0',
    deposit: transaction.depositMinorUnits,
    depositWarning:
      transaction.depositMinorUnits !== null
        ? `Refundable deposit secured separately on your personal card`
        : null,
    cancellationTerms: 'Subject to provider cancellation policy',
    quoteExpiresAt: transaction.quoteExpiresAt,
    paymentRequired: BigInt(transaction.userContributionMinorUnits) > 0n,
    confirmationAction: 'CONFIRM_BOOKING',
    status: transaction.status,
    statusLabel: transaction.productStatusLabel,
    requiredActions: transaction.requiredActions,
    dataState: transaction.dataState,
    fundingAvailable: transaction.fundingAvailable,
  });
}

export function projectAccessHistory(
  items: readonly AccessActivityItem[],
  filter: string,
): AccessHistoryView {
  return Object.freeze({
    schema: 'sunrey.consumer.access.history.v1',
    ...ACCESS_POSTURE,
    filter,
    items,
  });
}

export function projectSupportContext(transaction: AccessProductTransaction, lastEvent: string | null): AccessSupportContext {
  return Object.freeze({
    schema: 'sunrey.consumer.access.support-context.v1',
    transactionId: transaction.transactionId,
    bookingStatus: transaction.status,
    providerDisplayName: transaction.providerDisplayName,
    lastEvent,
    refundStatus: ['REFUND_PENDING', 'PARTIAL_REFUND', 'REFUNDED'].includes(transaction.status)
      ? transaction.status
      : null,
    reconciliationStatus: ['PROCESSING_CONFIRMATION', 'RECONCILIATION_REQUIRED'].includes(transaction.status)
      ? transaction.status
      : null,
    serviceName: transaction.serviceName,
  });
}
