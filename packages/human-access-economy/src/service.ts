import { asUtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { authorizeAccessMutate, authorizeAccessView, type AccessActor } from './access.ts';
import {
  FIXTURE_JAPAN_EXPERIENCE_USD,
  FIXTURE_MUSTANG_DAILY_USD,
  fixtureJapanExperience,
  fixtureMustangIntent,
  recordActivity,
  seedSandboxAccessFixtures,
} from './fixtures.ts';
import { createCanonicalAccessRuntime, toCanonicalRuntimeCategory } from './canonical-runtime.ts';
import { AccessProviderNetworkService, createAccessProviderNetworkService } from './provider-network.ts';
import {
  newAccessExperienceId,
  newAccessIntentId,
  newAccessQuoteId,
  newAccessReservationId,
  newAccessRedemptionId,
} from './ids.ts';
import {
  AccessAllocationProjection,
  type AccessAllocationPreviewInput,
} from './allocation.ts';
import {
  projectAccessCategories,
  projectAccessList,
  projectAccessOverview,
  projectAccessResource,
  type AccessCapabilityView,
} from './projections.ts';
import { projectConsumerSolvencyPosture } from './consumer-solvency.ts';
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
  SearchAccessProvidersInput,
  CreateProviderQuoteInput,
  PreviewAccessRedemptionInput,
  StartAccessRedemptionInput,
  ConfirmAccessRedemptionInput,
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
  private readonly canonical = createCanonicalAccessRuntime();
  private readonly providerNetwork: AccessProviderNetworkService;
  private readonly providerQuoteByAccessQuote = new Map<string, string>();
  private readonly redemptionByReservation = new Map<string, string>();
  private readonly bundleByExperience = new Map<string, string>();
  private readonly allocationProjection = new AccessAllocationProjection();

  constructor(
    store: HumanAccessEconomyStore = new HumanAccessEconomyStore(),
    providerNetwork: AccessProviderNetworkService = createAccessProviderNetworkService(),
  ) {
    this.store = store;
    this.providerNetwork = providerNetwork;
  }

  seedCustomer(customerId: string): void {
    seedSandboxAccessFixtures(this.store, customerId);
    for (const entitlement of this.store.listEntitlements(customerId)) {
      if (entitlement.remainingUses !== null) {
        this.providerNetwork.seedEntitlement(entitlement.entitlementId, customerId, entitlement.remainingUses);
      }
    }
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
    this.canonical.registerConsumerIntent({
      customerId: actor.customerId,
      summary: intent.summary,
      category: toCanonicalRuntimeCategory(category),
      location: intent.location,
    });
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
      readonly consumerPosture: import('./consumer-solvency.ts').ConsumerSolvencyPosture;
      readonly consumerPostureMessage: string;
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
    const solvencyPosture = projectConsumerSolvencyPosture({
      poolSolvent: mustang,
      allocatableUnits: mustang ? 10n : 0n,
      publishedUnits: mustang ? 10n : 100n,
      providerAvailable: mustang,
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
        consumerPosture: solvencyPosture.posture,
        consumerPostureMessage: solvencyPosture.message,
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
    const search = this.providerNetwork.search({
      query: input.summary,
      category,
      location: input.location ?? undefined,
      providerId: 'turo',
    });
    if (!search.ok || search.value.items.length === 0) {
      return err({ code: 'PROVIDER_UNAVAILABLE', message: 'provider search returned no catalog items' });
    }
    const catalogItem = search.value.items[0]!;
    const providerQuote = this.providerNetwork.createQuote({
      providerId: 'turo',
      catalogItemId: catalogItem.catalogItemId,
      quantity: 4,
      startsAt: '2026-08-29T10:00:00.000Z',
      endsAt: '2026-09-02T10:00:00.000Z',
      location: input.location ?? 'Miami, FL',
      idempotencyKey: input.idempotencyKey,
    });
    if (!providerQuote.ok) {
      return err({ code: 'PROVIDER_UNAVAILABLE', message: providerQuote.message });
    }
    const intentId = input.intentId ?? null;
    const stored: AccessQuote = Object.freeze({
      quoteId: newAccessQuoteId(),
      customerId: actor.customerId,
      intentId,
      category,
      summary: input.summary,
      pricing: Object.freeze({
        currency: providerQuote.value.currency,
        minorUnits: providerQuote.value.providerPriceMinorUnits.toString(),
        source: 'SIMULATION_FIXTURE' as const,
      }),
      capacityKnown: false as const,
      expiresAt: providerQuote.value.expiresAt,
      simulationFixture: true as const,
    });
    this.providerQuoteByAccessQuote.set(stored.quoteId, providerQuote.value.quoteId);
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
    const providerQuoteId = this.providerQuoteByAccessQuote.get(input.quoteId);
    if (!providerQuoteId) {
      return err({ code: 'NOT_FOUND', message: 'provider quote mapping not found' });
    }
    const entitlement = this.store.listEntitlements(actor.customerId).find((row) => row.category === 'MOBILITY');
    if (!entitlement) {
      return err({ code: 'NOT_FOUND', message: 'mobility entitlement not found' });
    }
    const redemptionId = newAccessRedemptionId();
    const started = this.providerNetwork.startRedemption(
      {
        redemptionId,
        customerId: actor.customerId,
        category: 'MOBILITY',
        providerId: 'turo',
        quoteId: providerQuoteId,
        entitlementId: entitlement.entitlementId,
        entitlementClass: 'MOBILITY_STANDARD',
        requestedQuantity: 4,
        maxUserContributionMinorUnits: '0',
        intentId: quote.intentId ?? undefined,
      },
      input.idempotencyKey,
    );
    if (!started.ok) {
      return err({ code: 'REDEMPTION_BLOCKED', message: started.message });
    }
    const reservation: AccessReservation = Object.freeze({
      reservationId: newAccessReservationId(),
      customerId: actor.customerId,
      quoteId: quote.quoteId,
      category: quote.category,
      summary: quote.summary,
      location: 'Miami, FL',
      status: 'HELD',
      startsAt: input.startsAt ?? '2026-08-29T10:00:00.000Z',
      endsAt: input.endsAt ?? '2026-08-31T10:00:00.000Z',
      pricing: quote.pricing,
      createdAt: NOW,
    });
    this.redemptionByReservation.set(reservation.reservationId, redemptionId);
    this.store.reservations.set(reservation.reservationId, reservation);
    this.store.idempotency.set(`reservation:${input.idempotencyKey}`, reservation.reservationId);
    recordActivity(this.store, {
      customerId: actor.customerId,
      kind: 'RESERVATION_CREATED',
      summary: reservation.summary,
      referenceId: reservation.reservationId,
    });
    return ok(projectAccessResource('sunrey.consumer.access.reservation.v1', reservation));
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
    const redemptionId = this.redemptionByReservation.get(reservationId);
    if (redemptionId) {
      const confirmed = this.providerNetwork.confirmRedemption(redemptionId, { userApproved: true });
      if (!confirmed.ok) {
        return err({ code: 'REDEMPTION_BLOCKED', message: confirmed.message });
      }
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
    const bundleId = `bundle_${stored.experienceId}`;
    this.bundleByExperience.set(stored.experienceId, bundleId);
    const mobilitySearch = this.providerNetwork.search({
      query: 'Mustang Miami',
      category: 'MOBILITY',
      location: 'Miami, FL',
      providerId: 'turo',
    });
    const staySearch = this.providerNetwork.search({
      query: 'Rome hotel',
      category: 'STAY_HOUSING',
      location: 'Rome, IT',
      providerId: 'expedia',
    });
    const foodSearch = this.providerNetwork.search({
      query: 'meal delivery',
      category: 'FOOD',
      location: 'Miami, FL',
      providerId: 'doordash',
    });
    const components: {
      componentId: string;
      providerId: import('../../access-economy/src/providers/types.ts').AccessProviderId;
      category: string;
      quote: import('../../access-economy/src/providers/types.ts').ProviderQuote;
    }[] = [];
    for (const [componentId, search, category, providerId, location] of [
      ['mobility', mobilitySearch, 'MOBILITY', 'turo', 'Miami, FL'],
      ['stay', staySearch, 'HOUSING_ROOM_NIGHTS', 'expedia', 'Rome, IT'],
      ['food', foodSearch, 'FOOD', 'doordash', 'Miami, FL'],
    ] as const) {
      if (!search.ok || search.value.items.length === 0) {
        continue;
      }
      const quoted = this.providerNetwork.createQuote({
        providerId,
        catalogItemId: search.value.items[0]!.catalogItemId,
        quantity: 1,
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: '2026-09-15T00:00:00.000Z',
        location,
        idempotencyKey: `${bundleId}_${componentId}`,
      });
      if (quoted.ok) {
        components.push({
          componentId,
          providerId,
          category,
          quote: quoted.value,
        });
      }
    }
    if (components.length > 0) {
      this.providerNetwork.orchestrateBundle({
        bundleId,
        subjectRef: actor.customerId,
        failurePolicy: 'ALL_OR_NOTHING',
        components,
      });
    }
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
    const bundleId = this.bundleByExperience.get(experienceId);
    if (bundleId) {
      const confirmedBundle = this.providerNetwork.confirmBundle({
        bundleId,
        failurePolicy: 'ALL_OR_NOTHING',
        userApproved: true,
      });
      if (!confirmedBundle.ok) {
        return err({ code: 'REDEMPTION_BLOCKED', message: confirmedBundle.message });
      }
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

  providers(actor: AccessActor) {
    const capability = capabilityOf(actor);
    if (!capability.enabled) {
      return err({ code: 'FEATURE_DISABLED', message: capability.reason });
    }
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.access.providers.v1',
        ...ACCESS_POSTURE,
        items: this.providerNetwork.listProviders(),
      }),
    );
  }

  searchProviders(actor: AccessActor, input: SearchAccessProvidersInput) {
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
    const outcome = this.providerNetwork.search({
      query: input.query,
      category,
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.providerId ? { providerId: input.providerId as import('../../access-economy/src/providers/types.ts').AccessProviderId } : {}),
    });
    if (!outcome.ok) {
      return err({ code: 'PROVIDER_UNAVAILABLE', message: outcome.message });
    }
    recordActivity(this.store, {
      customerId: actor.customerId,
      kind: 'PROVIDER_SEARCH',
      summary: `${input.query} provider search`,
    });
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.access.search.v1',
        ...ACCESS_POSTURE,
        items: outcome.value.items.map((item) =>
          Object.freeze({
            catalogItemId: item.catalogItemId,
            providerId: item.providerId,
            title: item.title,
            description: item.description,
            location: item.location,
            canonicalUnit: item.canonicalUnit,
            rightKind: item.rightKind,
          }),
        ),
      }),
    );
  }

  createProviderQuote(actor: AccessActor, input: CreateProviderQuoteInput) {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) {
      return err(auth.error);
    }
    const capability = capabilityOf(actor);
    if (!capability.enabled) {
      return err({ code: 'FEATURE_DISABLED', message: capability.reason });
    }
    const existing = this.store.idempotency.get(`provider-quote:${input.idempotencyKey}`);
    if (existing) {
      const quote = this.providerNetwork.getQuote(existing);
      if (quote) {
        return ok(this.projectProviderQuote(quote));
      }
    }
    const outcome = this.providerNetwork.createQuote({
      providerId: input.providerId as import('../../access-economy/src/providers/types.ts').AccessProviderId,
      catalogItemId: input.catalogItemId,
      quantity: input.quantity,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      idempotencyKey: input.idempotencyKey,
      ...(input.location !== undefined ? { location: input.location } : {}),
    });
    if (!outcome.ok) {
      return err({ code: 'PROVIDER_UNAVAILABLE', message: outcome.message });
    }
    this.store.idempotency.set(`provider-quote:${input.idempotencyKey}`, outcome.value.quoteId);
    recordActivity(this.store, {
      customerId: actor.customerId,
      kind: 'QUOTE_CREATED',
      summary: `provider quote ${outcome.value.quoteId}`,
      referenceId: outcome.value.quoteId,
    });
    return ok(this.projectProviderQuote(outcome.value));
  }

  previewRedemption(actor: AccessActor, input: PreviewAccessRedemptionInput) {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) {
      return err(auth.error);
    }
    const capability = capabilityOf(actor);
    if (!capability.enabled) {
      return err({ code: 'FEATURE_DISABLED', message: capability.reason });
    }
    const entitlement = this.store.entitlements.get(input.entitlementId);
    if (!entitlement || entitlement.customerId !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'entitlement not found' });
    }
    const redemptionId = input.redemptionId ?? newAccessRedemptionId();
    const outcome = this.providerNetwork.previewRedemption({
      redemptionId,
      customerId: actor.customerId,
      category: input.category,
      providerId: input.providerId as import('../../access-economy/src/providers/types.ts').AccessProviderId,
      quoteId: input.quoteId,
      entitlementId: input.entitlementId,
      entitlementClass: input.entitlementClass,
      requestedQuantity: input.requestedQuantity,
      maxUserContributionMinorUnits: input.maxUserContributionMinorUnits ?? '0',
      ...(input.intentId !== undefined ? { intentId: input.intentId } : {}),
    });
    if (!outcome.ok) {
      return err({ code: 'REDEMPTION_BLOCKED', message: outcome.message });
    }
    recordActivity(this.store, {
      customerId: actor.customerId,
      kind: 'REDEMPTION_PREVIEWED',
      summary: `redemption preview ${redemptionId}`,
      referenceId: redemptionId,
    });
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.access.redemption.preview.v1',
        ...ACCESS_POSTURE,
        redemptionId,
        status: outcome.value.status,
        providerPriceMinorUnits: outcome.value.providerPriceMinorUnits.toString(),
        coverageMinorUnits: outcome.value.coverage?.appliedCoverageMinorUnits.toString() ?? null,
        userContributionMinorUnits: outcome.value.userContributionMinorUnits.toString(),
        entitlementUnitsHeld: Number(outcome.value.entitlementUnitsHeld),
        explanation: outcome.value.explanation,
      }),
    );
  }

  startRedemption(actor: AccessActor, input: StartAccessRedemptionInput) {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) {
      return err(auth.error);
    }
    const capability = capabilityOf(actor);
    if (!capability.enabled) {
      return err({ code: 'FEATURE_DISABLED', message: capability.reason });
    }
    const redemptionId = input.redemptionId ?? newAccessRedemptionId();
    const outcome = this.providerNetwork.startRedemption(
      {
        redemptionId,
        customerId: actor.customerId,
        category: input.category,
        providerId: input.providerId as import('../../access-economy/src/providers/types.ts').AccessProviderId,
        quoteId: input.quoteId,
        entitlementId: input.entitlementId,
        entitlementClass: input.entitlementClass,
        requestedQuantity: input.requestedQuantity,
        maxUserContributionMinorUnits: input.maxUserContributionMinorUnits ?? '0',
        ...(input.intentId !== undefined ? { intentId: input.intentId } : {}),
      },
      input.idempotencyKey,
    );
    if (!outcome.ok) {
      return err({ code: 'REDEMPTION_BLOCKED', message: outcome.message });
    }
    recordActivity(this.store, {
      customerId: actor.customerId,
      kind: 'REDEMPTION_STARTED',
      summary: `redemption ${redemptionId}`,
      referenceId: redemptionId,
    });
    return ok(this.projectRedemption(outcome.value));
  }

  confirmRedemption(actor: AccessActor, redemptionId: string, input: ConfirmAccessRedemptionInput = {}) {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) {
      return err(auth.error);
    }
    const capability = capabilityOf(actor);
    if (!capability.enabled) {
      return err({ code: 'FEATURE_DISABLED', message: capability.reason });
    }
    const existing = this.providerNetwork.getRedemption(redemptionId);
    if (!existing || existing.subjectRef !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'redemption not found' });
    }
    const outcome = this.providerNetwork.confirmRedemption(
      redemptionId,
      {
        ...(input.userApproved === true ? { userApproved: true as const } : {}),
        ...(input.userFiatMinorUnits !== undefined ? { userFiatMinorUnits: input.userFiatMinorUnits } : {}),
      },
    );
    if (!outcome.ok) {
      return err({ code: 'REDEMPTION_BLOCKED', message: outcome.message });
    }
    recordActivity(this.store, {
      customerId: actor.customerId,
      kind: 'REDEMPTION_CONFIRMED',
      summary: `redemption confirmed ${redemptionId}`,
      referenceId: redemptionId,
    });
    return ok(this.projectRedemption(outcome.value));
  }

  cancelRedemption(actor: AccessActor, redemptionId: string) {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) {
      return err(auth.error);
    }
    const capability = capabilityOf(actor);
    if (!capability.enabled) {
      return err({ code: 'FEATURE_DISABLED', message: capability.reason });
    }
    const existing = this.providerNetwork.getRedemption(redemptionId);
    if (!existing || existing.subjectRef !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'redemption not found' });
    }
    const outcome = this.providerNetwork.cancelRedemption(redemptionId);
    if (!outcome.ok) {
      return err({ code: 'REDEMPTION_BLOCKED', message: outcome.message });
    }
    recordActivity(this.store, {
      customerId: actor.customerId,
      kind: 'REDEMPTION_CANCELLED',
      summary: `redemption cancelled ${redemptionId}`,
      referenceId: redemptionId,
    });
    return ok(this.projectRedemption(outcome.value));
  }

  getRedemption(actor: AccessActor, redemptionId: string) {
    const auth = authorizeAccessView(actor, actor.customerId);
    if (!auth.ok) {
      return err(auth.error);
    }
    const capability = capabilityOf(actor);
    if (!capability.enabled) {
      return err({ code: 'FEATURE_DISABLED', message: capability.reason });
    }
    const record = this.providerNetwork.getRedemption(redemptionId);
    if (!record || record.subjectRef !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'redemption not found' });
    }
    return ok(this.projectRedemption(record));
  }

  private projectProviderQuote(quote: import('../../access-economy/src/providers/types.ts').ProviderQuote) {
    return Object.freeze({
      schema: 'sunrey.consumer.access.provider-quote.v1',
      ...ACCESS_POSTURE,
      quoteId: quote.quoteId,
      providerId: quote.providerId,
      catalogItemId: quote.catalogItemId,
      canonicalUnit: quote.canonicalUnit,
      quantity: Number(quote.quantity),
      providerPriceMinorUnits: quote.providerPriceMinorUnits.toString(),
      currency: quote.currency,
      expiresAt: quote.expiresAt,
      simulationOnly: true as const,
    });
  }

  private projectRedemption(record: import('../../access-economy/src/providers/redemption/types.ts').RedemptionRecord) {
    return Object.freeze({
      schema: 'sunrey.consumer.access.redemption.v1',
      ...ACCESS_POSTURE,
      redemptionId: record.redemptionId,
      status: record.status,
      providerId: record.providerId,
      providerQuoteId: record.providerQuoteId,
      providerBookingId: record.providerBookingId,
      accessRightRef: record.accessRightRef,
      rightKind: record.rightKind,
      entitlementHoldState: record.entitlementHoldState,
      providerPriceMinorUnits: record.decision.providerPriceMinorUnits.toString(),
      userContributionMinorUnits: record.decision.userContributionMinorUnits.toString(),
      coverageMinorUnits: record.decision.coverage?.appliedCoverageMinorUnits.toString() ?? null,
    });
  }

  accessEpoch(actor: AccessActor, epochId?: string) {
    return this.allocationProjection.epoch(actor, epochId);
  }

  accessParticipation(actor: AccessActor, epochId?: string) {
    return this.allocationProjection.participation(actor, epochId);
  }

  accessAllocation(actor: AccessActor, epochId?: string) {
    return this.allocationProjection.allocation(actor, epochId);
  }

  accessAllocationCategories(epochId?: string) {
    return this.allocationProjection.allocationCategories(epochId);
  }

  accessAllocationHistory(actor: AccessActor) {
    return this.allocationProjection.allocationHistory(actor);
  }

  accessAllocationPreview(actor: AccessActor, input: AccessAllocationPreviewInput = {}) {
    return this.allocationProjection.allocationPreview(actor, input);
  }
}

export function createSandboxAccessEconomy(customerId: string): HumanAccessEconomyProduct {
  const product = new HumanAccessEconomyProduct();
  product.seedCustomer(customerId);
  return product;
}

export { FIXTURE_MUSTANG_DAILY_USD, FIXTURE_JAPAN_EXPERIENCE_USD, fixtureMustangIntent };
