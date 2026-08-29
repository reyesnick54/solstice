import {
  ACCESS_CATEGORIES,
  ACCESS_CATEGORY_LABELS,
  ACCESS_POSTURE,
  type AccessCategory,
} from './taxonomy.ts';
import type {
  AccessActivityRecord,
  AccessAvailabilityStatus,
  AccessEntitlement,
  AccessExperience,
  AccessIntent,
  AccessQuote,
  AccessRecommendation,
  AccessReservation,
} from './types.ts';

export type AccessCapabilityView = {
  readonly enabled: boolean;
  readonly state:
    | 'READY'
    | 'SIMULATION_ONLY'
    | 'FEATURE_DISABLED'
    | 'USER_INELIGIBLE'
    | 'PENDING_VERIFICATION';
  readonly reason: string;
};

export type AccessOverviewView = {
  readonly schema: 'sunrey.consumer.access.overview.v1';
  readonly productionReady: false;
  readonly productionActive: false;
  readonly liveConnectivityEnabled: false;
  readonly liveProviderConnectivity: false;
  readonly navigationLabel: 'Access';
  readonly primarySurface: 'YOUR_ACCESS';
  readonly primaryCta: 'REDEEM_ACCESS';
  readonly capability: AccessCapabilityView;
  readonly activeEntitlements: AccessCollectionField<AccessEntitlement>;
  readonly upcomingReservations: AccessCollectionField<AccessReservation>;
  readonly activeExperiences: AccessCollectionField<AccessExperience>;
  readonly recommendations: AccessCollectionField<AccessRecommendation>;
  readonly availabilityStatus: AccessAvailabilityStatus;
};

export type AccessCollectionField<T> = {
  readonly state:
    | 'READY'
    | 'EMPTY'
    | 'FEATURE_DISABLED'
    | 'SIMULATION_ONLY'
    | 'USER_INELIGIBLE'
    | 'PENDING_VERIFICATION';
  readonly availability: 'AVAILABLE_SIMULATION' | 'NOT_YET_PRODUCTIZED';
  readonly items: readonly T[];
  readonly reason: string | null;
};

export type AccessCategoriesView = {
  readonly schema: 'sunrey.consumer.access.categories.v1';
  readonly productionReady: false;
  readonly productionActive: false;
  readonly liveConnectivityEnabled: false;
  readonly items: readonly {
    readonly category: AccessCategory;
    readonly label: string;
    readonly productiveTaxonomyOwnedBy: 'packages/sunrey-chain';
  }[];
};

export type AccessEnvelope = {
  readonly schema: string;
  readonly productionReady: false;
  readonly productionActive: false;
  readonly liveConnectivityEnabled: false;
};

function collectionField<T>(
  enabled: boolean,
  state: AccessCollectionField<T>['state'],
  items: readonly T[],
  reason: string | null,
): AccessCollectionField<T> {
  return Object.freeze({
    state,
    availability: enabled ? 'AVAILABLE_SIMULATION' : 'NOT_YET_PRODUCTIZED',
    items: enabled ? items : Object.freeze([]),
    reason,
  });
}

export function projectAccessOverview(input: {
  readonly capability: AccessCapabilityView;
  readonly entitlements: readonly AccessEntitlement[];
  readonly reservations: readonly AccessReservation[];
  readonly experiences: readonly AccessExperience[];
  readonly recommendations: readonly AccessRecommendation[];
  readonly availability: AccessAvailabilityStatus;
}): AccessOverviewView {
  const enabled = input.capability.enabled;
  const state = input.capability.state;
  const activeEntitlements = input.entitlements.filter((row) => row.status === 'ACTIVE');
  const upcomingReservations = input.reservations.filter((row) =>
    ['DRAFT', 'QUOTED', 'HELD', 'CONFIRMED'].includes(row.status),
  );
  const activeExperiences = input.experiences.filter((row) =>
    ['QUOTED', 'CONFIRMED', 'IN_PROGRESS'].includes(row.status),
  );
  return Object.freeze({
    schema: 'sunrey.consumer.access.overview.v1',
    ...ACCESS_POSTURE,
    navigationLabel: 'Access',
    primarySurface: 'YOUR_ACCESS',
    primaryCta: 'REDEEM_ACCESS',
    capability: input.capability,
    activeEntitlements: collectionField(
      enabled,
      enabled ? (activeEntitlements.length > 0 ? 'SIMULATION_ONLY' : 'EMPTY') : state,
      activeEntitlements,
      enabled ? null : input.capability.reason,
    ),
    upcomingReservations: collectionField(
      enabled,
      enabled ? (upcomingReservations.length > 0 ? 'SIMULATION_ONLY' : 'EMPTY') : state,
      upcomingReservations,
      enabled ? null : input.capability.reason,
    ),
    activeExperiences: collectionField(
      enabled,
      enabled ? (activeExperiences.length > 0 ? 'SIMULATION_ONLY' : 'EMPTY') : state,
      activeExperiences,
      enabled ? null : input.capability.reason,
    ),
    recommendations: collectionField(
      enabled,
      enabled ? (input.recommendations.length > 0 ? 'SIMULATION_ONLY' : 'EMPTY') : state,
      input.recommendations,
      enabled ? null : input.capability.reason,
    ),
    availabilityStatus: input.availability,
  });
}

export function projectAccessCategories(): AccessCategoriesView {
  return Object.freeze({
    schema: 'sunrey.consumer.access.categories.v1',
    ...ACCESS_POSTURE,
    items: ACCESS_CATEGORIES.map((category) =>
      Object.freeze({
        category,
        label: ACCESS_CATEGORY_LABELS[category],
        productiveTaxonomyOwnedBy: 'packages/sunrey-chain' as const,
      }),
    ),
  });
}

export function projectAccessList<T>(
  schema: string,
  capability: AccessCapabilityView,
  items: readonly T[],
): AccessEnvelope & { readonly capability: AccessCapabilityView; readonly items: readonly T[] } {
  return Object.freeze({
    schema,
    ...ACCESS_POSTURE,
    capability,
    items: capability.enabled ? items : Object.freeze([]),
  });
}

export function projectAccessResource<T>(
  schema: string,
  value: T,
): AccessEnvelope & T {
  return Object.freeze({
    schema,
    ...ACCESS_POSTURE,
    ...value,
  });
}

export type { AccessIntent, AccessQuote, AccessReservation, AccessExperience, AccessActivityRecord };
