/**
 * ACCESS Wave 2 — Comprehensive regression tests for Prompt 33.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AccessBookingReconciliationService,
  AccessCapacityApprovalService,
  AccessProviderEventIdStore,
  AccessProviderOperations,
  AccessProviderRiskMonitor,
  AccessProviderWebhookNormalizer,
  bootstrapAccessProviderSdk,
  createDiscoveryProvider,
  decideBookingFallback,
  decideDiscoveryFallback,
  isCapacityContributor,
  isFulfillmentProvider,
  isInventoryProvider,
  isQuoteProvider,
  isRefundProvider,
  selectProvider,
  ACCESS_PROVIDER_DESCRIPTORS,
  createHealthSnapshot,
} from './index.ts';
import { createAccessProviderGateway } from '../gateway.ts';
import { COMMERCIAL_PROVIDER_IDS, DISCOVERY_PROVIDER_IDS } from '../types.ts';

describe('ACCESS Wave 2 — provider SDK bootstrap', () => {
  it('registers all commercial and discovery providers', () => {
    const world = bootstrapAccessProviderSdk();
    const registered = world.registry.list();
    assert.equal(registered.length, COMMERCIAL_PROVIDER_IDS.length + DISCOVERY_PROVIDER_IDS.length);
    for (const id of [...COMMERCIAL_PROVIDER_IDS, ...DISCOVERY_PROVIDER_IDS]) {
      assert.ok(world.registry.get(id), `missing provider ${id}`);
    }
  });

  it('lists discovery providers separately from fulfillment providers', () => {
    const world = bootstrapAccessProviderSdk();
    const discovery = world.registry.listDiscoveryProviders();
    assert.equal(discovery.length, DISCOVERY_PROVIDER_IDS.length);
    const fulfillment = world.registry.listFulfillmentProviders();
    assert.ok(fulfillment.length >= 3);
  });

  it('finds providers by category, capability, and geography', () => {
    const world = bootstrapAccessProviderSdk();
    const lodging = world.registry.findProviders({
      category: 'HOUSING_ROOM_NIGHTS',
      capability: 'CATALOG_SEARCH',
      geography: 'Miami, FL',
    });
    assert.ok(lodging.length >= 2);
    const compute = world.registry.findProviders({
      category: 'COMPUTE',
      capability: 'CATALOG_SEARCH',
      geography: 'GLOBAL',
    });
    assert.equal(compute.length, 1);
    assert.equal(compute[0]!.descriptor.providerId, 'compute_discovery');
  });
});

describe('ACCESS Wave 2 — discovery flow', () => {
  it('searches discovery provider and returns AccessOpportunity', async () => {
    const world = bootstrapAccessProviderSdk();
    const result = await world.discovery.search({
      requestId: 'disc_1',
      category: 'TRAVEL',
      query: 'flight miami jfk travel',
      geography: 'Miami, FL',
      limit: 5,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.providerId, 'travel_discovery');
    assert.ok(result.value.opportunities.length > 0);
    assert.equal(result.value.opportunities[0]!.product.category, 'TRAVEL');
    assert.equal(result.value.simulationOnly, true);
  });

  it('falls back to alternate discovery provider when primary is down', async () => {
    const world = bootstrapAccessProviderSdk();
    const gbfs = world.registry.get('gbfs_mobility')!.provider as ReturnType<typeof createDiscoveryProvider>;
    gbfs.setSimulateDown(true);

    const result = await world.discovery.search({
      requestId: 'disc_fallback',
      category: 'VEHICLE_HOURS',
      query: 'mustang miami',
      geography: 'Miami, FL',
      limit: 5,
    });
    // Turo commercial provider should still match mobility search
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.notEqual(result.value.providerId, 'gbfs_mobility');
  });
});

describe('ACCESS Wave 2 — commercial flow', () => {
  it('runs availability → quote → reservation → booking without money movement', () => {
    const world = bootstrapAccessProviderSdk();
    const gateway = createAccessProviderGateway();
    const search = gateway.search({
      requestId: 'comm_1',
      category: 'VEHICLE_HOURS',
      query: 'Mustang Miami',
      location: 'Miami, FL',
      limit: 5,
    });
    assert.equal(search.ok, true);
    if (!search.ok) return;
    const item = search.value.items[0]!;
    const availability = gateway.availability({
      requestId: 'avail_1',
      providerId: 'turo',
      catalogItemId: item.catalogItemId,
      quantity: 2n,
      startsAt: '2026-09-01T10:00:00.000Z',
      endsAt: '2026-09-03T10:00:00.000Z',
      location: 'Miami, FL',
    });
    assert.equal(availability.ok, true);
    const quote = gateway.quote({
      requestId: 'quote_1',
      providerId: 'turo',
      catalogItemId: item.catalogItemId,
      quantity: 2n,
      startsAt: '2026-09-01T10:00:00.000Z',
      endsAt: '2026-09-03T10:00:00.000Z',
      location: 'Miami, FL',
      idempotencyKey: 'comm_quote',
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    const reserve = gateway.reserve({
      requestId: 'res_1',
      providerId: 'turo',
      quoteId: quote.value.quoteId,
      subjectRef: 'cust_test',
      idempotencyKey: 'comm_reserve',
    });
    assert.equal(reserve.ok, true);
    if (!reserve.ok) return;
    const book = gateway.book({
      requestId: 'book_1',
      providerId: 'turo',
      reservationId: reserve.value.reservationId,
      subjectRef: 'cust_test',
      idempotencyKey: 'comm_book',
    });
    assert.equal(book.ok, true);
    if (!book.ok) return;
    assert.equal(book.value.simulationOnly, true);
    assert.equal(book.value.state, 'CONFIRMED');
  });
});

describe('ACCESS Wave 2 — capacity contributor flow', () => {
  it('requires approval before capacity becomes trusted AccessCapacity', () => {
    const approval = new AccessCapacityApprovalService();
    const candidate = approval.submit(
      Object.freeze({
        candidateId: 'cand_gpu_1',
        providerId: 'compute_discovery',
        category: 'COMPUTE',
        productId: 'gpu_a100_hour',
        geography: 'GLOBAL',
        periodStart: '2026-09-01T00:00:00.000Z',
        periodEnd: '2026-09-30T23:59:59.000Z',
        units: 100n,
        unit: 'GPU_HOUR',
        retailValueMinorUnits: 500_000n,
        providerCostMinorUnits: 300_000n,
        currency: 'USD',
        settlementPreference: 'FUTURE_NATIVE_MR',
        evidenceId: 'ev_gpu_capacity_1',
        termsRef: 'terms/compute-contribution',
        submittedAt: '2026-08-31T09:00:00.000Z',
        state: 'PENDING',
        simulationOnly: true,
      }),
    );
    assert.equal(candidate.state, 'PENDING');
    assert.equal(approval.getApproved('cand_gpu_1'), null);
    const decision = approval.approve('cand_gpu_1');
    assert.equal(decision.approved, true);
    assert.ok(decision.capacity);
    assert.equal(decision.capacity!.units, 100n);
  });

  it('rejects capacity without evidence', () => {
    const approval = new AccessCapacityApprovalService();
    approval.submit(
      Object.freeze({
        candidateId: 'cand_no_ev',
        providerId: 'compute_discovery',
        category: 'COMPUTE',
        productId: 'gpu_a100_hour',
        geography: 'GLOBAL',
        periodStart: '2026-09-01T00:00:00.000Z',
        periodEnd: '2026-09-30T23:59:59.000Z',
        units: 10n,
        unit: 'GPU_HOUR',
        retailValueMinorUnits: null,
        providerCostMinorUnits: null,
        currency: 'USD',
        settlementPreference: null,
        evidenceId: null,
        termsRef: null,
        submittedAt: '2026-08-31T09:00:00.000Z',
        state: 'PENDING',
        simulationOnly: true,
      }),
    );
    const decision = approval.approve('cand_no_ev');
    assert.equal(decision.approved, false);
  });
});

describe('ACCESS Wave 2 — provider failure handling', () => {
  it('blocks booking fallback on unknown booking state', () => {
    const decision = decideBookingFallback('UNKNOWN', 'turo');
    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /reconciliation/i);
  });

  it('enqueues unknown booking for reconciliation', () => {
    const reconciliation = new AccessBookingReconciliationService();
    const record = reconciliation.enqueueUnknownBooking({
      providerId: 'turo',
      reservationId: 'res_unknown_1',
      reason: 'booking timeout',
    });
    assert.equal(record.state, 'PENDING_RECONCILIATION');
    assert.equal(reconciliation.listPending().length, 1);
  });

  it('quarantined provider gets no new bookings', () => {
    const world = bootstrapAccessProviderSdk();
    world.operations.quarantine('turo', 'suspicious activity');
    assert.equal(world.risk.canInitiateNewBooking('turo'), false);
    const lodging = world.registry.findProviders({
      category: 'VEHICLE_HOURS',
      capability: 'BOOK',
      geography: 'Miami, FL',
    });
    assert.equal(lodging.some((row) => row.descriptor.providerId === 'turo'), false);
  });

  it('discovery fallback is safe for search only', () => {
    const selection = selectProvider(
      [
        {
          descriptor: ACCESS_PROVIDER_DESCRIPTORS.gbfs_mobility!,
          health: createHealthSnapshot({
            providerId: 'gbfs_mobility',
            capabilities: ['CATALOG_SEARCH'],
            health: 'UNHEALTHY',
            activationState: 'SANDBOX_ENABLED',
            credentialStatus: 'NOT_REQUIRED',
            contractStatus: 'DISCOVERY_TERMS',
            message: 'down',
            checkedAt: '2026-08-31T09:00:00.000Z',
          }),
          risk: new AccessProviderRiskMonitor().assess({ providerId: 'gbfs_mobility', down: true }),
          commercialPriority: 30,
          trustScore: 60,
        },
        {
          descriptor: ACCESS_PROVIDER_DESCRIPTORS.turo!,
          health: createHealthSnapshot({
            providerId: 'turo',
            capabilities: ['CATALOG_SEARCH'],
            health: 'HEALTHY',
            activationState: 'PREVIEW',
            credentialStatus: 'MISSING',
            contractStatus: 'COMMERCIAL_NEGOTIATION',
            message: 'ok',
            checkedAt: '2026-08-31T09:00:00.000Z',
          }),
          risk: new AccessProviderRiskMonitor().assess({ providerId: 'turo' }),
          commercialPriority: 50,
          trustScore: 50,
        },
      ],
      { category: 'VEHICLE_HOURS', capability: 'CATALOG_SEARCH', geography: 'US', preferredProviderId: 'gbfs_mobility' },
    );
    const fallback = decideDiscoveryFallback(selection, 'gbfs_mobility', 0);
    assert.equal(fallback.allowed, true);
    assert.equal(fallback.nextProviderId, 'turo');
  });
});

describe('ACCESS Wave 2 — capability enforcement', () => {
  it('discovery-only provider cannot book', () => {
    const world = bootstrapAccessProviderSdk();
    assert.equal(world.registry.canPerform('gbfs_mobility', 'CATALOG_SEARCH'), true);
    assert.equal(world.registry.canPerform('gbfs_mobility', 'BOOK'), false);
  });

  it('quote-only discovery provider cannot refund', () => {
    const world = bootstrapAccessProviderSdk();
    assert.equal(world.registry.canPerform('travel_discovery', 'REALTIME_PRICING'), false);
    assert.equal(world.registry.canPerform('travel_discovery', 'REFUND'), false);
  });

  it('non-capacity provider cannot publishCapacity', () => {
    const world = bootstrapAccessProviderSdk();
    const turo = world.registry.get('turo')!.provider;
    assert.equal(isCapacityContributor(turo), false);
    const compute = world.registry.get('compute_discovery');
    assert.ok(compute);
    // compute_discovery is discovery-only in this wave; capacity via approval service
    assert.equal(isCapacityContributor(compute!.provider), false);
  });

  it('validates interface guards', () => {
    const world = bootstrapAccessProviderSdk();
    const expedia = world.registry.get('expedia')!.provider;
    assert.equal(isInventoryProvider(expedia), true);
    assert.equal(isFulfillmentProvider(expedia), true);
    assert.equal(isQuoteProvider(expedia), true);
    assert.equal(isRefundProvider(expedia), false);
  });
});

describe('ACCESS Wave 2 — security controls', () => {
  it('rejects unsigned production webhooks', () => {
    const normalizer = new AccessProviderWebhookNormalizer();
    const result = normalizer.normalize(
      Object.freeze({
        providerId: 'expedia',
        providerEventId: 'evt_1',
        kind: 'BOOKING_CONFIRMED',
        providerTimestamp: '2026-08-31T09:00:00.000Z',
        payloadSummary: '{"bookingId":"b1"}',
        signature: null,
        idempotencyKey: 'idem_1',
        receivedAt: '2026-08-31T09:00:00.000Z',
        simulationOnly: false,
      }),
      () => false,
    );
    assert.equal('refused' in result && result.refused, true);
  });

  it('deduplicates webhook events by idempotency key', () => {
    const store = new AccessProviderEventIdStore();
    const first = store.record(
      Object.freeze({
        providerEventId: 'evt_dup',
        idempotencyKey: 'idem_dup',
        kind: 'BOOKING_CONFIRMED',
        processedAt: '2026-08-31T09:00:00.000Z',
        webhookEventId: 'wh_1',
      }),
    );
    const second = store.record(
      Object.freeze({
        providerEventId: 'evt_dup_2',
        idempotencyKey: 'idem_dup',
        kind: 'BOOKING_CONFIRMED',
        processedAt: '2026-08-31T09:00:00.000Z',
        webhookEventId: 'wh_2',
      }),
    );
    assert.equal(first, 'NEW');
    assert.equal(second, 'DUPLICATE');
  });

  it('FUTURE_NATIVE_MR is not production enabled', () => {
    const compute = ACCESS_PROVIDER_DESCRIPTORS.compute_discovery!;
    assert.equal(compute.settlementModel, 'FUTURE_NATIVE_MR');
    assert.notEqual(compute.activationState, 'PRODUCTION_ENABLED');
    assert.equal(compute.metadata.productionEnabled, 'false');
  });

  it('provider descriptors contain no secret fields', () => {
    for (const descriptor of Object.values(ACCESS_PROVIDER_DESCRIPTORS)) {
      const json = JSON.stringify(descriptor);
      assert.doesNotMatch(json, /api[_-]?key|secret|password|token/i);
    }
  });
});

describe('ACCESS Wave 2 — provider operations', () => {
  it('supports enable, disable, and quarantine', () => {
    const world = bootstrapAccessProviderSdk();
    world.operations.disable('expedia');
    assert.equal(world.operations.isEnabled('expedia'), false);
    world.operations.enable('expedia');
    assert.equal(world.operations.isEnabled('expedia'), true);
    world.operations.quarantine('airbnb', 'risk review');
    assert.equal(world.operations.isEnabled('airbnb'), false);
  });
});

describe('ACCESS Wave 2 — deterministic provider selection', () => {
  it('stores selection reason and ranks candidates', () => {
    const world = bootstrapAccessProviderSdk();
    const candidates = world.registry
      .findProviders({ category: 'HOUSING_ROOM_NIGHTS', capability: 'CATALOG_SEARCH', geography: 'Miami, FL' })
      .map((row) =>
        Object.freeze({
          descriptor: row.descriptor,
          health: createHealthSnapshot({
            providerId: row.descriptor.providerId,
            capabilities: row.descriptor.capabilities,
            health: 'HEALTHY',
            activationState: row.descriptor.activationState,
            credentialStatus: row.descriptor.credentialStatus,
            contractStatus: row.descriptor.commercialStatus,
            message: 'ok',
            checkedAt: '2026-08-31T09:00:00.000Z',
          }),
          risk: world.risk.assess({ providerId: row.descriptor.providerId }),
          commercialPriority: row.commercialPriority,
          trustScore: row.trustScore,
        }),
      );
    const selection = selectProvider(candidates, {
      category: 'HOUSING_ROOM_NIGHTS',
      capability: 'CATALOG_SEARCH',
      geography: 'Miami, FL',
    });
    assert.ok(selection.selectedProviderId);
    assert.ok(selection.reason.length > 0);
    assert.ok(selection.ranked.length > 0);
  });
});

describe('ACCESS Wave 2 — Access Wave 1 regression', () => {
  it('preserves ACCESS-14 gateway behavior', () => {
    const gateway = createAccessProviderGateway();
    const providers = gateway.listProviders();
    assert.equal(providers.length, 5);
    assert.equal(gateway.registry.canPerform('expedia', 'QUOTE'), true);
  });
});
