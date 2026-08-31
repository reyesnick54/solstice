import {
  ACCESS_CATEGORIES,
  ACCESS_CATEGORY_LABELS,
  type AccessCategory,
} from '../taxonomy.ts';
import type { AccessEntitlement, AccessReservation } from '../types.ts';
import type {
  AccessBookingSummaryView,
  AccessCategorySummaryView,
  AccessEntitlementView,
  AccessHistoryItemView,
  AccessOpportunityView,
  ConsumerFundingStatus,
  ConsumerProductStatus,
} from './types.ts';
import { mapDiscoveryStatus, mapFundingStatus, overallProductStatus } from './state-mapping.ts';

const CATEGORY_UNITS: Readonly<Record<AccessCategory, string>> = Object.freeze({
  MOBILITY: 'mobility day',
  TRAVEL: 'travel segment',
  STAY_HOUSING: 'stay night',
  FOOD: 'meal',
  EXPERIENCES: 'experience',
  COMPUTE_AI: 'compute hour',
  ROBOTS_SERVICES: 'service unit',
  ENERGY: 'kWh',
  GOODS: 'delivery',
});

const EXPIRING_SOON_DAYS = 30;
const NOW = '2026-08-23T12:00:00.000Z';
const ALLOCATION_PERIOD = '2026-08';

export function categoryUnit(category: AccessCategory): string {
  return CATEGORY_UNITS[category];
}

export function isExpiringSoon(validUntil: string | null, now = NOW): boolean {
  if (!validUntil) return false;
  const ms = Date.parse(validUntil) - Date.parse(now);
  return ms > 0 && ms <= EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
}

export function projectEntitlementView(
  row: AccessEntitlement,
  reservedUnits = 0,
  consumedUnits = 0,
): AccessEntitlementView {
  const allocated = row.remainingUses ?? 0;
  const remaining = Math.max(0, allocated - reservedUnits - consumedUnits);
  return Object.freeze({
    entitlementId: row.entitlementId,
    category: row.category,
    product: row.label,
    unit: categoryUnit(row.category),
    allocatedUnits: allocated + consumedUnits,
    reservedUnits,
    consumedUnits,
    remainingUnits: remaining,
    effectiveFrom: row.validFrom,
    expiresAt: row.validUntil,
    status: row.status,
    allocationPeriod: ALLOCATION_PERIOD,
    displayMetadata: Object.freeze({
      scope: row.scope,
      simulation: 'true',
    }),
  });
}

export function projectCategorySummary(input: {
  readonly category: AccessCategory;
  readonly entitlements: readonly AccessEntitlement[];
  readonly enabled: boolean;
  readonly fundingStatus: ConsumerFundingStatus;
  readonly discoveryStatus: import('./types.ts').ConsumerDiscoveryStatus;
  readonly reservedByCategory: Readonly<Partial<Record<AccessCategory, number>>>;
}): AccessCategorySummaryView {
  const rows = input.entitlements.filter((row) => row.category === input.category && row.status === 'ACTIVE');
  const availableUnits = rows.reduce((sum, row) => sum + (row.remainingUses ?? 0), 0);
  const reservedUnits = input.reservedByCategory[input.category] ?? 0;
  const usedUnits = 0;
  const expiresAt = rows.reduce<string | null>((earliest, row) => {
    if (!row.validUntil) return earliest;
    if (!earliest || row.validUntil < earliest) return row.validUntil;
    return earliest;
  }, null);
  return Object.freeze({
    category: input.category,
    displayName: ACCESS_CATEGORY_LABELS[input.category],
    status: overallProductStatus(true, input.enabled),
    availableUnits: Math.max(0, availableUnits - reservedUnits),
    reservedUnits,
    usedUnits,
    unit: categoryUnit(input.category),
    expiresAt,
    fundedAvailabilityStatus: input.fundingStatus,
    discoveryAvailabilityStatus: input.discoveryStatus,
  });
}

export function projectAllCategorySummaries(input: {
  readonly entitlements: readonly AccessEntitlement[];
  readonly enabled: boolean;
  readonly fundingByCategory: Readonly<Partial<Record<AccessCategory, ConsumerFundingStatus>>>;
  readonly discoveryByCategory: Readonly<Partial<Record<AccessCategory, import('./types.ts').ConsumerDiscoveryStatus>>>;
  readonly reservedByCategory: Readonly<Partial<Record<AccessCategory, number>>>;
}): readonly AccessCategorySummaryView[] {
  return ACCESS_CATEGORIES.map((category) =>
    projectCategorySummary({
      category,
      entitlements: input.entitlements,
      enabled: input.enabled,
      fundingStatus: input.fundingByCategory[category] ?? 'AVAILABLE',
      discoveryStatus: input.discoveryByCategory[category] ?? 'UNKNOWN',
      reservedByCategory: input.reservedByCategory,
    }),
  );
}

export function projectBookingSummary(reservation: AccessReservation): AccessBookingSummaryView {
  return Object.freeze({
    bookingId: reservation.reservationId,
    summary: reservation.summary,
    category: reservation.category,
    status: reservation.status === 'CONFIRMED' ? 'CONFIRMED' : reservation.status === 'CANCELLED' ? 'CANCELLED' : 'PROCESSING',
    startsAt: reservation.startsAt,
  });
}

export function projectActivityAsHistory(
  activity: { readonly activityId: string; readonly kind: string; readonly summary: string; readonly referenceId: string | null; readonly occurredAt: string },
  category: AccessCategory | null = null,
): AccessHistoryItemView {
  const kind =
    activity.kind.includes('RESERVATION') || activity.kind.includes('REDEMPTION')
      ? activity.kind.includes('CANCEL')
        ? 'CANCELLATION'
        : activity.kind.includes('CONFIRM')
          ? 'BOOKING'
          : 'BOOKING'
      : activity.kind.includes('QUOTE')
        ? 'QUOTE'
        : activity.kind.includes('SEARCH')
          ? 'SEARCH'
          : 'ALLOCATION';
  return Object.freeze({
    historyId: activity.activityId,
    kind,
    category,
    summary: activity.summary,
    status: null,
    occurredAt: activity.occurredAt,
    referenceId: activity.referenceId,
  });
}

export function defaultFundingForCategory(category: AccessCategory, enabled: boolean): ConsumerFundingStatus {
  if (!enabled) return 'TEMPORARILY_UNAVAILABLE';
  if (category === 'MOBILITY' || category === 'FOOD' || category === 'STAY_HOUSING') {
    return mapFundingStatus({ poolSolvent: true, allocatableUnits: 10n, publishedUnits: 100n });
  }
  return 'LIMITED';
}

export function defaultDiscoveryForCategory(category: AccessCategory, enabled: boolean): import('./types.ts').ConsumerDiscoveryStatus {
  if (!enabled) return 'UNKNOWN';
  return mapDiscoveryStatus(category === 'MOBILITY' || category === 'FOOD' || category === 'EXPERIENCES');
}

export function categoryDescription(category: AccessCategory): string {
  switch (category) {
    case 'MOBILITY':
      return 'Vehicle and local mobility access through partner providers.';
    case 'TRAVEL':
      return 'Travel segments and mobility corridors linked to the Access network.';
    case 'STAY_HOUSING':
      return 'Lodging and stay access for qualifying room-nights.';
    case 'FOOD':
      return 'Meal and delivery access through partner kitchens.';
    case 'EXPERIENCES':
      return 'Curated experiences and admission rights.';
    case 'COMPUTE_AI':
      return 'Compute and AI capacity access units.';
    case 'ROBOTS_SERVICES':
      return 'Robotics and automated service capacity.';
    case 'ENERGY':
      return 'Energy access units for qualifying consumption.';
    case 'GOODS':
      return 'Goods and delivery access rights.';
    default:
      return 'Access category.';
  }
}

export function supportedGeographies(category: AccessCategory): readonly string[] {
  switch (category) {
    case 'MOBILITY':
      return Object.freeze(['US-FL', 'US-CA']);
    case 'STAY_HOUSING':
      return Object.freeze(['US', 'IT', 'JP']);
    case 'FOOD':
      return Object.freeze(['US-FL']);
    case 'EXPERIENCES':
      return Object.freeze(['JP', 'US']);
    default:
      return Object.freeze([]);
  }
}

export function travelAccessLink(category: AccessCategory, opportunityId: string): string | null {
  if (category === 'MOBILITY' || category === 'TRAVEL' || category === 'STAY_HOUSING' || category === 'EXPERIENCES') {
    return `/api/v1/access/opportunities/${opportunityId}`;
  }
  return null;
}

export function providerDisplayName(providerId: string): string {
  switch (providerId) {
    case 'turo':
      return 'Turo (simulation)';
    case 'expedia':
      return 'Expedia (simulation)';
    case 'doordash':
      return 'DoorDash (simulation)';
    case 'airbnb':
      return 'Airbnb (simulation)';
    case 'amazon':
      return 'Amazon (simulation)';
    default:
      return 'Partner provider';
  }
}

export function providerType(providerId: string): string {
  switch (providerId) {
    case 'turo':
      return 'MOBILITY';
    case 'expedia':
    case 'airbnb':
      return 'LODGING';
    case 'doordash':
    case 'amazon':
      return 'COMMERCE';
    default:
      return 'ACCESS_PROVIDER';
  }
}

export function opportunityStatus(enabled: boolean): ConsumerProductStatus {
  return overallProductStatus(true, enabled);
}
