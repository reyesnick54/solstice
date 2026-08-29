import { asUtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { authorizeAccessMutate, authorizeAccessView, type AccessActor } from './access.ts';
import {
  FIXTURE_JAPAN_EXPERIENCE_USD,
  FIXTURE_MUSTANG_DAILY_USD,
  fixtureJapanExperience,
  fixtureMustangIntent,
  fixtureMustangQuote,
  fixtureMustangReservation,
  recordActivity,
  seedSandboxAccessFixtures,
} from './fixtures.ts';
import {
  newAccessExperienceId,
  newAccessIntentId,
  newAccessQuoteId,
  newAccessReservationId,
} from './ids.ts';
import {
  projectAccessCategories,
  projectAccessList,
  projectAccessOverview,
  projectAccessResource,
  type AccessCapabilityView,
} from './projections.ts';
import { HumanAccessEconomyStore } from './store.ts';
import {
  ACCESS_CATEGORIES,
  ACCESS_POSTURE,
  type AccessCategory,
} from './taxonomy.ts';
import type {
  AccessAvailabilityCategory,
  AccessAvailabilityStatus,
  AccessExperience,
  AccessFailure,
  AccessIntent,
  AccessQuote,
  AccessReservation,
  CheckAccessAvailabilityInput,
  CreateAccessIntentInput,
  CreateAccessQuoteInput,
  CreateAccessReservationInput,
  QuoteAccessExperienceInput,
} from './types.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

function parseCategory(value: string): AccessCategory | null {
  return (ACCESS_CATEGORIES as readonly string[]).includes(value) ? (value as AccessCategory) : null;
}

function capabilityOf(actor: AccessActor): AccessCapabilityView {
  if (actor.restricted) {
    return Object.freeze({
      enabled: false,
      state: 'USER_INELIGIBLE',
      reason: 'access economy is unavailable for restricted customers',
    });
  }
  if (!actor.verified) {
    return Object.freeze({
      enabled: false,
      state: 'PENDING_VERIFICATION',
      reason: 'verification must complete before access economy is available',
    });
  }
  return Object.freeze({
    enabled: true,
    state: 'SIMULATION_ONLY',
    reason: 'ENVIRONMENT is simulation; live provider connectivity remains disabled',
  });
}

function availabilityFor(enabled: boolean): AccessAvailabilityStatus {
  const categories: AccessAvailabilityCategory[] = ACCESS_CATEGORIES.map((category) =>
    Object.freeze({
      category,
      state: enabled ? 'AVAILABLE_SIMULATION' : 'DISABLED',
      reason: enabled
        ? 'simulation catalog only; capacity is not asserted'
        : 'access economy capability is disabled',
      capacityKnown: false as const,
      earliestKnown: null,
    }),
  );
  return Object.freeze({
    overallState: enabled ? 'AVAILABLE_SIMULATION' : 'DISABLED',
    categories,
  });
}

function mustangMatch(input: { readonly summary?: string; readonly location?: string; readonly category: AccessCategory }): boolean {
  if (input.category !== 'MOBILITY') {
    return false;
  }
  const haystack = `${input.summary ?? ''} ${input.location ?? ''}`.toLowerCase();
  return haystack.includes('mustang') && haystack.includes('miami');
}

export class HumanAccessEconomyProduct {
  private readonly store: HumanAccessEconomyStore;

  constructor(store: HumanAccessEconomyStore = new HumanAccessEconomyStore()) {
    this.store = store;
  }

  seedCustomer(customerId: string): void {
    seedSandboxAccessFixtures(this.store, customerId);
  }

  overview(actor: AccessActor) {
    const capability = capabilityOf(actor);
    return ok(
      projectAccessOverview({
        capability,
        entitlements: capability.enabled ? this.store.listEntitlements(actor.customerId) : [],
        reservations: capability.enabled ? this.store.listReservations(actor.customerId) : [],
        experiences: capability.enabled ? this.store.listExperiences(actor.customerId) : [],
        recommendations: capability.enabled ? this.store.listRecommendations() : [],
        availability: availabilityFor(capability.enabled),
      }),
    );
  }

  categories() {
    return ok(projectAccessCategories());
  }

  entitlements(actor: AccessActor) {
    const capability = capabilityOf(actor);
    return ok(
      projectAccessList(
        'sunrey.consumer.access.entitlements.v1',
        capability,
        capability.enabled ? this.store.listEntitlements(actor.customerId) : [],
      ),
    );
  }

  reservations(actor: AccessActor) {
    const capability = capabilityOf(actor);
    return ok(
      projectAccessList(
        'sunrey.consumer.access.reservations.v1',
        capability,
        capability.enabled ? this.store.listReservations(actor.customerId) : [],
      ),
    );
  }

  activity(actor: AccessActor) {
    const capability = capabilityOf(actor);
    return ok(
      projectAccessList(
        'sunrey.consumer.access.activity.v1',
        capability,
        capability.enabled ? this.store.listActivities(actor.customerId) : [],
      ),
    );
  }

  createIntent(
    actor: AccessActor,
    input: CreateAccessIntentInput,
  ): Result<ReturnType<typeof projectAccessResource<AccessIntent>>, AccessFailure> {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) {
      return err(auth.error);
    }
    const capability = capabilityOf(actor);
    if (!capability.enabled) {
      return err({ code: 'FEATURE_DISABLED', message: capability.reason });
    }
    const category = parseCategory(input.category);
    if (!category) {
      return err({ code: 'INVALID_CATEGORY', message: 'access category is invalid' });
    }
    if (!input.summary.trim()) {
      return err({ code: 'INVALID_CATEGORY', message: 'summary is required' });
    }
    const existing = this.store.idempotency.get(`intent:${input.idempotencyKey}`);
    if (existing) {
      const prior = this.store.intents.get(existing);
      if (prior) {
        return ok(projectAccessResource('sunrey.consumer.access.intent.v1', prior));
      }
    }
    const intent: AccessIntent = Object.freeze({
      intentId: newAccessIntentId(),
      customerId: actor.customerId,
      category,
      summary: input.summary,
      location: input.location ?? null,
      status: 'SUBMITTED',
      createdAt: NOW,
      expiresAt: '2026-08-30T12:00:00.000Z',
    });
    this.store.intents.set(intent.intentId, intent);
    this.store.idempotency.set(`intent:${input.idempotencyKey}`, intent.intentId);
    recordActivity(this.store, {
      customerId: actor.customerId,
      kind: 'INTENT_CREATED',
      summary: intent.summary,
      referenceId: intent.intentId,
    });
    return ok(projectAccessResource('sunrey.consumer.access.intent.v1', intent));
  }

  checkAvailability(
    actor: AccessActor,
    input: CheckAccessAvailabilityInput,
  ): Result<
    {
      readonly schema: 'sunrey.consumer.access.availability.v1';
      readonly productionReady: false;
      readonly productionActive: false;
      readonly liveConnectivityEnabled: false;
      readonly category: AccessCategory;
      readonly state: import('./taxonomy.ts').AccessAvailabilityState;
      readonly reason: string;
      readonly capacityKnown: false;
      readonly earliestKnown: string | null;
      readonly intentId: string | null;
    },
    AccessFailure
  > {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) {
      return err(auth.error);
    }
    const capability = capabilityOf(actor);
    if (!capability.enabled) {
      return err({ code: 'FEATURE_DISABLED', message: capability.reason });
    }
    const category = parseCategory(input.category);
    if (!category) {
      return err({ code: 'INVALID_CATEGORY', message: 'access category is invalid' });
    }
    const mustang = mustangMatch({
      category,
      summary: input.summary,
      location: input.location,
    });
    const state = mustang ? 'AVAILABLE_SIMULATION' : category === 'EXPERIENCES' ? 'CHECK_REQUIRED' : 'LIMITED';
    const reason = mustang
      ? 'simulation mobility fixture recognizes Mustang in Miami'
      : 'live capacity is not connected; only explicit simulation matches return availability';
    recordActivity(this.store, {
      customerId: actor.customerId,
      kind: 'AVAILABILITY_CHECKED',
      summary: `${category} availability checked`,
      referenceId: input.intentId ?? null,
    });
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.access.availability.v1',
        ...ACCESS_POSTURE,
        category,
        state,
        reason,
        capacityKnown: false as const,
        earliestKnown: mustang ? '2026-08-29T10:00:00.000Z' : null,
        intentId: input.intentId ?? null,
      }),
    );
  }

  createQuote(
    actor: AccessActor,
    input: CreateAccessQuoteInput,
  ): Result<ReturnType<typeof projectAccessResource<AccessQuote>>, AccessFailure> {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) {
      return err(auth.error);
    }
    const capability = capabilityOf(actor);
    if (!capability.enabled) {
      return err({ code: 'FEATURE_DISABLED', message: capability.reason });
    }
    const category = parseCategory(input.category);
    if (!category) {
      return err({ code: 'INVALID_CATEGORY', message: 'access category is invalid' });
    }
    const existing = this.store.idempotency.get(`quote:${input.idempotencyKey}`);
    if (existing) {
      const prior = this.store.quotes.get(existing);
      if (prior) {
        return ok(projectAccessResource('sunrey.consumer.access.quote.v1', prior));
      }
    }
    const mustang = mustangMatch({
      category,
      summary: input.summary,
      location: input.location,
    });
    if (!mustang) {
      return err({
        code: 'FEATURE_DISABLED',
        message: 'no simulation quote fixture matches this request; live pricing is not connected',
      });
    }
    const intentId = input.intentId ?? null;
    const quote = fixtureMustangQuote(actor.customerId, intentId ?? newAccessIntentId());
    const stored: AccessQuote = Object.freeze({
      ...quote,
      intentId,
    });
    this.store.quotes.set(stored.quoteId, stored);
    this.store.idempotency.set(`quote:${input.idempotencyKey}`, stored.quoteId);
    recordActivity(this.store, {
      customerId: actor.customerId,
      kind: 'QUOTE_CREATED',
      summary: stored.summary,
      referenceId: stored.quoteId,
    });
    return ok(projectAccessResource('sunrey.consumer.access.quote.v1', stored));
  }

  createReservation(
    actor: AccessActor,
    input: CreateAccessReservationInput,
  ): Result<ReturnType<typeof projectAccessResource<AccessReservation>>, AccessFailure> {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) {
      return err(auth.error);
    }
    const capability = capabilityOf(actor);
    if (!capability.enabled) {
      return err({ code: 'FEATURE_DISABLED', message: capability.reason });
    }
    const existing = this.store.idempotency.get(`reservation:${input.idempotencyKey}`);
    if (existing) {
      const prior = this.store.reservations.get(existing);
      if (prior) {
        return ok(projectAccessResource('sunrey.consumer.access.reservation.v1', prior));
      }
    }
    const quote = this.store.quotes.get(input.quoteId);
    if (!quote || quote.customerId !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'access quote not found' });
    }
    if (quote.expiresAt < NOW) {
      return err({ code: 'QUOTE_EXPIRED', message: 'access quote has expired' });
    }
    const reservation = fixtureMustangReservation(actor.customerId, quote.quoteId);
    const stored: AccessReservation = Object.freeze({
      ...reservation,
      startsAt: input.startsAt ?? reservation.startsAt,
      endsAt: input.endsAt ?? reservation.endsAt,
    });
    this.store.reservations.set(stored.reservationId, stored);
    this.store.idempotency.set(`reservation:${input.idempotencyKey}`, stored.reservationId);
    recordActivity(this.store, {
      customerId: actor.customerId,
      kind: 'RESERVATION_CREATED',
      summary: stored.summary,
      referenceId: stored.reservationId,
    });
    return ok(projectAccessResource('sunrey.consumer.access.reservation.v1', stored));
  }

  confirmReservation(
    actor: AccessActor,
    reservationId: string,
  ): Result<ReturnType<typeof projectAccessResource<AccessReservation>>, AccessFailure> {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) {
      return err(auth.error);
    }
    const capability = capabilityOf(actor);
    if (!capability.enabled) {
      return err({ code: 'FEATURE_DISABLED', message: capability.reason });
    }
    const reservation = this.store.reservations.get(reservationId);
    if (!reservation || reservation.customerId !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'access reservation not found' });
    }
    if (!['DRAFT', 'QUOTED', 'HELD'].includes(reservation.status)) {
      return err({
        code: 'INVALID_TRANSITION',
        message: 'reservation cannot be confirmed from its current status',
      });
    }
    const confirmed: AccessReservation = Object.freeze({
      ...reservation,
      status: 'CONFIRMED',
    });
    this.store.reservations.set(reservationId, confirmed);
    recordActivity(this.store, {
      customerId: actor.customerId,
      kind: 'RESERVATION_CONFIRMED',
      summary: confirmed.summary,
      referenceId: confirmed.reservationId,
    });
    return ok(projectAccessResource('sunrey.consumer.access.reservation.v1', confirmed));
  }

  cancelReservation(
    actor: AccessActor,
    reservationId: string,
  ): Result<ReturnType<typeof projectAccessResource<AccessReservation>>, AccessFailure> {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) {
      return err(auth.error);
    }
    const capability = capabilityOf(actor);
    if (!capability.enabled) {
      return err({ code: 'FEATURE_DISABLED', message: capability.reason });
    }
    const reservation = this.store.reservations.get(reservationId);
    if (!reservation || reservation.customerId !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'access reservation not found' });
    }
    if (['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(reservation.status)) {
      return err({
        code: 'INVALID_TRANSITION',
        message: 'reservation cannot be cancelled from its current status',
      });
    }
    const cancelled: AccessReservation = Object.freeze({
      ...reservation,
      status: 'CANCELLED',
    });
    this.store.reservations.set(reservationId, cancelled);
    recordActivity(this.store, {
      customerId: actor.customerId,
      kind: 'RESERVATION_CANCELLED',
      summary: cancelled.summary,
      referenceId: cancelled.reservationId,
    });
    return ok(projectAccessResource('sunrey.consumer.access.reservation.v1', cancelled));
  }

  quoteExperience(
    actor: AccessActor,
    input: QuoteAccessExperienceInput,
  ): Result<ReturnType<typeof projectAccessResource<AccessExperience>>, AccessFailure> {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) {
      return err(auth.error);
    }
    const capability = capabilityOf(actor);
    if (!capability.enabled) {
      return err({ code: 'FEATURE_DISABLED', message: capability.reason });
    }
    const existing = this.store.idempotency.get(`experience:${input.idempotencyKey}`);
    if (existing) {
      const prior = this.store.experiences.get(existing);
      if (prior) {
        return ok(projectAccessResource('sunrey.consumer.access.experience.v1', prior));
      }
    }
    const destination = input.destination.trim().toLowerCase();
    const isJapan = destination.includes('japan') && input.durationDays === 14;
    if (!isJapan) {
      return err({
        code: 'FEATURE_DISABLED',
        message: 'no simulation experience fixture matches this request; live catalog is not connected',
      });
    }
    const experience = fixtureJapanExperience(actor.customerId);
    const stored: AccessExperience = Object.freeze({
      ...experience,
      title: input.title ?? experience.title,
    });
    this.store.experiences.set(stored.experienceId, stored);
    this.store.idempotency.set(`experience:${input.idempotencyKey}`, stored.experienceId);
    recordActivity(this.store, {
      customerId: actor.customerId,
      kind: 'EXPERIENCE_QUOTED',
      summary: stored.title,
      referenceId: stored.experienceId,
    });
    return ok(projectAccessResource('sunrey.consumer.access.experience.v1', stored));
  }

  confirmExperience(
    actor: AccessActor,
    experienceId: string,
  ): Result<ReturnType<typeof projectAccessResource<AccessExperience>>, AccessFailure> {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) {
      return err(auth.error);
    }
    const capability = capabilityOf(actor);
    if (!capability.enabled) {
      return err({ code: 'FEATURE_DISABLED', message: capability.reason });
    }
    const experience = this.store.experiences.get(experienceId);
    if (!experience || experience.customerId !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'access experience not found' });
    }
    if (experience.status !== 'QUOTED') {
      return err({
        code: 'INVALID_TRANSITION',
        message: 'experience cannot be confirmed from its current status',
      });
    }
    const confirmed: AccessExperience = Object.freeze({
      ...experience,
      status: 'CONFIRMED',
      startsAt: '2026-09-01T00:00:00.000Z',
      endsAt: '2026-09-15T00:00:00.000Z',
      pricing: FIXTURE_JAPAN_EXPERIENCE_USD,
    });
    this.store.experiences.set(experienceId, confirmed);
    recordActivity(this.store, {
      customerId: actor.customerId,
      kind: 'EXPERIENCE_CONFIRMED',
      summary: confirmed.title,
      referenceId: confirmed.experienceId,
    });
    return ok(projectAccessResource('sunrey.consumer.access.experience.v1', confirmed));
  }
}

export function createSandboxAccessEconomy(customerId: string): HumanAccessEconomyProduct {
  const product = new HumanAccessEconomyProduct();
  product.seedCustomer(customerId);
  return product;
}

export { FIXTURE_MUSTANG_DAILY_USD, FIXTURE_JAPAN_EXPERIENCE_USD, fixtureMustangIntent };
