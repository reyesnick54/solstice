import { asUtcInstant } from '../../domain/src/time.ts';
import {
  newAccessActivityId,
  newAccessEntitlementId,
  newAccessExperienceId,
  newAccessIntentId,
  newAccessQuoteId,
  newAccessReservationId,
} from './ids.ts';
import type { HumanAccessEconomyStore } from './store.ts';
import type { AccessEntitlement, AccessRecommendation } from './types.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

export const FIXTURE_MUSTANG_DAILY_USD = Object.freeze({
  currency: 'USD',
  minorUnits: '36400',
  source: 'SIMULATION_FIXTURE' as const,
});

export const FIXTURE_JAPAN_EXPERIENCE_USD = Object.freeze({
  currency: 'USD',
  minorUnits: '1280000',
  source: 'SIMULATION_FIXTURE' as const,
});

export function seedSandboxAccessFixtures(store: HumanAccessEconomyStore, customerId: string): void {
  const foodEntitlement: AccessEntitlement = Object.freeze({
    entitlementId: newAccessEntitlementId(),
    customerId,
    category: 'FOOD',
    label: 'Neighborhood meal access',
    status: 'ACTIVE',
    scope: 'Miami metro — partner kitchens',
    validFrom: NOW,
    validUntil: '2027-08-23T12:00:00.000Z',
    remainingUses: 12,
    simulationFixture: true,
  });
  store.entitlements.set(foodEntitlement.entitlementId, foodEntitlement);

  const mobilityEntitlement: AccessEntitlement = Object.freeze({
    entitlementId: newAccessEntitlementId(),
    customerId,
    category: 'MOBILITY',
    label: 'MOBILITY_STANDARD — 4 vehicle-days',
    status: 'ACTIVE',
    scope: 'Qualifying standard mobility — simulation',
    validFrom: NOW,
    validUntil: '2027-08-23T12:00:00.000Z',
    remainingUses: 4,
    simulationFixture: true,
  });
  store.entitlements.set(mobilityEntitlement.entitlementId, mobilityEntitlement);

  const stayEntitlement: AccessEntitlement = Object.freeze({
    entitlementId: newAccessEntitlementId(),
    customerId,
    category: 'STAY_HOUSING',
    label: 'STAY_STANDARD — 5 room-nights',
    status: 'ACTIVE',
    scope: 'Qualifying stay access — simulation',
    validFrom: NOW,
    validUntil: '2027-08-23T12:00:00.000Z',
    remainingUses: 5,
    simulationFixture: true,
  });
  store.entitlements.set(stayEntitlement.entitlementId, stayEntitlement);

  const recommendations: readonly AccessRecommendation[] = [
    Object.freeze({
      recommendationId: 'rec_mobility_miami',
      category: 'MOBILITY',
      title: 'Weekend mobility in Miami',
      summary: 'Simulation-only mobility catalog for verified customers.',
      eligible: true,
      reason: 'AVAILABLE_SIMULATION',
    }),
    Object.freeze({
      recommendationId: 'rec_experience_japan',
      category: 'EXPERIENCES',
      title: 'Japan cultural experience',
      summary: '14-day curated experience quote available in simulation.',
      eligible: true,
      reason: 'AVAILABLE_SIMULATION',
    }),
  ];
  for (const row of recommendations) {
    store.recommendations.set(row.recommendationId, row);
  }
}

export function fixtureMustangIntent(customerId: string) {
  return Object.freeze({
    intentId: newAccessIntentId(),
    customerId,
    category: 'MOBILITY' as const,
    summary: 'Ford Mustang — Miami weekend',
    location: 'Miami, FL',
    status: 'SUBMITTED' as const,
    createdAt: NOW,
    expiresAt: '2026-08-30T12:00:00.000Z',
  });
}

export function fixtureMustangQuote(customerId: string, intentId: string) {
  return Object.freeze({
    quoteId: newAccessQuoteId(),
    customerId,
    intentId,
    category: 'MOBILITY' as const,
    summary: 'Ford Mustang — Miami weekend (simulation fixture)',
    pricing: FIXTURE_MUSTANG_DAILY_USD,
    capacityKnown: false as const,
    expiresAt: '2026-08-24T12:00:00.000Z',
    simulationFixture: true as const,
  });
}

export function fixtureJapanExperience(customerId: string) {
  return Object.freeze({
    experienceId: newAccessExperienceId(),
    customerId,
    category: 'EXPERIENCES' as const,
    title: 'Japan 14-day experience',
    destination: 'Japan',
    durationDays: 14,
    status: 'QUOTED' as const,
    pricing: FIXTURE_JAPAN_EXPERIENCE_USD,
    startsAt: null,
    endsAt: null,
    createdAt: NOW,
  });
}

export function fixtureMustangReservation(
  customerId: string,
  quoteId: string,
) {
  return Object.freeze({
    reservationId: newAccessReservationId(),
    customerId,
    quoteId,
    category: 'MOBILITY' as const,
    summary: 'Ford Mustang — Miami weekend',
    location: 'Miami, FL',
    status: 'HELD' as const,
    startsAt: '2026-08-29T10:00:00.000Z',
    endsAt: '2026-08-31T10:00:00.000Z',
    pricing: FIXTURE_MUSTANG_DAILY_USD,
    createdAt: NOW,
  });
}

export function recordActivity(
  store: HumanAccessEconomyStore,
  input: {
    readonly customerId: string;
    readonly kind: import('./types.ts').AccessActivityRecord['kind'];
    readonly summary: string;
    readonly referenceId?: string;
  },
): void {
  const row = Object.freeze({
    activityId: newAccessActivityId(),
    customerId: input.customerId,
    kind: input.kind,
    summary: input.summary,
    referenceId: input.referenceId ?? null,
    occurredAt: NOW,
  });
  store.activities.set(row.activityId, row);
}
