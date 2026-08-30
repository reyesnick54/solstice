import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AccessProviderGateway,
  EXPEDIA_PROVIDER_CONTRACT,
  InMemoryFundingIntentPort,
  ProviderWebhookNormalizer,
  RedemptionWorkflow,
  TURO_PROVIDER_CONTRACT,
  createAccessProviderGateway,
  evaluateRedemption,
} from './index.ts';
import { ACCESS_PROVIDER_INVARIANT_IDS } from './redemption/invariants.ts';

describe('ACCESS-14 provider capability registry', () => {
  it('registers all five candidate providers', () => {
    const gateway = createAccessProviderGateway();
    const providers = gateway.listProviders();
    assert.equal(providers.length, 5);
    assert.equal(providers.find((row) => row.providerId === 'expedia')?.integrationState, 'SANDBOX_AVAILABLE');
    assert.equal(providers.find((row) => row.providerId === 'turo')?.integrationState, 'PARTNER_APPROVAL_REQUIRED');
  });

  it('does not treat partner providers as live enabled', () => {
    const gateway = createAccessProviderGateway();
    assert.equal(gateway.registry.isLiveEnabled('turo'), false);
    assert.equal(gateway.registry.canPerform('expedia', 'QUOTE'), true);
  });
});

describe('ACCESS-14 provider contracts', () => {
  it('documents Expedia sandbox mode', () => {
    assert.equal(EXPEDIA_PROVIDER_CONTRACT.liveConnectivity, false);
    assert.equal(EXPEDIA_PROVIDER_CONTRACT.integrationMode, 'SANDBOX_AVAILABLE');
    assert.equal(EXPEDIA_PROVIDER_CONTRACT.sandboxConnectivity, true);
  });

  it('documents Turo partner approval requirement', () => {
    assert.equal(TURO_PROVIDER_CONTRACT.liveConnectivity, false);
    assert.equal(TURO_PROVIDER_CONTRACT.integrationMode, 'PARTNER_APPROVAL_REQUIRED');
  });
});

describe('ACCESS-14 Case A — Turo Mustang mobility redemption', () => {
  it('quotes, covers 100%, and redeems with zero user contribution', () => {
    const gateway = createAccessProviderGateway();
    const search = gateway.search({
      requestId: 'search_a',
      category: 'VEHICLE_HOURS',
      query: 'Mustang Miami',
      location: 'Miami, FL',
      limit: 5,
    });
    assert.equal(search.ok, true);
    if (!search.ok) {
      return;
    }
    const item = search.value.items[0]!;
    const quote = gateway.quote({
      requestId: 'quote_a',
      providerId: 'turo',
      catalogItemId: item.catalogItemId,
      quantity: 4n,
      startsAt: '2026-08-29T10:00:00.000Z',
      endsAt: '2026-09-02T10:00:00.000Z',
      location: 'Miami, FL',
      idempotencyKey: 'case_a_quote',
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) {
      return;
    }
    assert.equal(quote.value.providerPriceMinorUnits, 36_400n);
    const decision = evaluateRedemption({
      redemptionId: 'red_case_a',
      subjectRef: 'cust_a',
      intentId: 'intent_a',
      category: 'MOBILITY',
      providerId: 'turo',
      providerQuote: quote.value,
      entitlement: {
        entitlementId: 'ent_mobility_a',
        entitlementClass: 'MOBILITY_STANDARD',
        availableUnits: 4n,
        canonicalUnit: 'VEHICLE_DAY',
      },
      requestedQuantity: 4n,
      jurisdiction: 'US-FL',
      maxUserContributionMinorUnits: 0n,
      policyContext: {
        benefitSource: 'SIMULATION',
        geographicZone: 'Miami, FL',
        serviceLevel: 'STANDARD',
      },
    });
    assert.equal(decision.status, 'READY_FOR_APPROVAL');
    assert.equal(decision.userContributionMinorUnits, 0n);
    assert.equal(decision.coverage?.appliedCoverageMinorUnits, 36_400n);

    const fundingPort = new InMemoryFundingIntentPort();
    const workflow = new RedemptionWorkflow(gateway, { funding: fundingPort });
    workflow.entitlements.seed('ent_mobility_a', 'cust_a', 4n);
    const started = workflow.start(
      {
        redemptionId: 'red_case_a',
        subjectRef: 'cust_a',
        intentId: 'intent_a',
        category: 'MOBILITY',
        providerId: 'turo',
        providerQuote: quote.value,
        entitlement: {
          entitlementId: 'ent_mobility_a',
          entitlementClass: 'MOBILITY_STANDARD',
          availableUnits: 4n,
          canonicalUnit: 'VEHICLE_DAY',
        },
        requestedQuantity: 4n,
        jurisdiction: 'US-FL',
        maxUserContributionMinorUnits: 0n,
        policyContext: {
          benefitSource: 'SIMULATION',
          geographicZone: 'Miami, FL',
          serviceLevel: 'STANDARD',
        },
      },
      'case_a_start',
    );
    assert.equal(started.ok, true);
    const confirmed = workflow.confirm('red_case_a');
    assert.equal(confirmed.ok, true);
    if (confirmed.ok) {
      assert.equal(confirmed.value.status, 'REDEEMED');
      assert.equal(confirmed.value.rightKind, 'ACCESS_RIGHT');
      assert.equal(confirmed.value.entitlementHoldState, 'CONSUMED');
      assert.ok(confirmed.value.funding);
      assert.equal(fundingPort.listByRedemption('red_case_a').length, 1);
    }
  });
});

describe('ACCESS-14 Case B — premium vehicle upgrade', () => {
  it('requires user contribution for partial coverage', () => {
    const gateway = createAccessProviderGateway();
    const search = gateway.search({
      requestId: 'search_b',
      category: 'VEHICLE_HOURS',
      query: 'Mustang Premium Miami',
      location: 'Miami, FL',
      limit: 5,
    });
    assert.equal(search.ok, true);
    if (!search.ok) {
      return;
    }
    const item = search.value.items[0]!;
    const quote = gateway.quote({
      requestId: 'quote_b',
      providerId: 'turo',
      catalogItemId: item.catalogItemId,
      quantity: 4n,
      startsAt: '2026-08-29T10:00:00.000Z',
      endsAt: '2026-09-02T10:00:00.000Z',
      location: 'Miami, FL',
      idempotencyKey: 'case_b_quote',
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) {
      return;
    }
    assert.equal(quote.value.providerPriceMinorUnits, 84_000n);
    const decision = evaluateRedemption({
      redemptionId: 'red_case_b',
      subjectRef: 'cust_b',
      intentId: null,
      category: 'MOBILITY',
      providerId: 'turo',
      providerQuote: quote.value,
      entitlement: {
        entitlementId: 'ent_mobility_b',
        entitlementClass: 'MOBILITY_STANDARD',
        availableUnits: 4n,
        canonicalUnit: 'VEHICLE_DAY',
      },
      requestedQuantity: 4n,
      jurisdiction: 'US-FL',
      maxUserContributionMinorUnits: 400_00n,
      policyContext: {
        benefitSource: 'SIMULATION',
        geographicZone: 'Miami, FL',
        serviceLevel: 'PREMIUM',
      },
    });
    assert.equal(decision.status, 'USER_CONTRIBUTION_REQUIRED');
    assert.equal(decision.coverage?.appliedCoverageMinorUnits, 44_000n);
    assert.equal(decision.userContributionMinorUnits, 40_000n);
  });
});

describe('ACCESS-14 Case C — Expedia Rome hotel', () => {
  it('maps lodging to room-night occupancy right', () => {
    const gateway = createAccessProviderGateway();
    const search = gateway.search({
      requestId: 'search_c',
      category: 'HOUSING_ROOM_NIGHTS',
      query: 'Rome hotel',
      location: 'Rome, IT',
      providerId: 'expedia',
      limit: 5,
    });
    assert.equal(search.ok, true);
    if (!search.ok) {
      return;
    }
    const item = search.value.items[0]!;
    const quote = gateway.quote({
      requestId: 'quote_c',
      providerId: 'expedia',
      catalogItemId: item.catalogItemId,
      quantity: 5n,
      startsAt: '2026-09-01T15:00:00.000Z',
      endsAt: '2026-09-06T11:00:00.000Z',
      location: 'Rome, IT',
      idempotencyKey: 'case_c_quote',
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) {
      return;
    }
    assert.equal(quote.value.canonicalUnit, 'ROOM_NIGHT');
    const decision = evaluateRedemption({
      redemptionId: 'red_case_c',
      subjectRef: 'cust_c',
      intentId: null,
      category: 'STAY',
      providerId: 'expedia',
      providerQuote: quote.value,
      entitlement: {
        entitlementId: 'ent_stay_c',
        entitlementClass: 'STAY_STANDARD',
        availableUnits: 5n,
        canonicalUnit: 'ROOM_NIGHT',
      },
      requestedQuantity: 5n,
      jurisdiction: 'IT',
      maxUserContributionMinorUnits: 0n,
      policyContext: {
        benefitSource: 'SIMULATION',
        geographicZone: 'Rome, IT',
        serviceLevel: 'STANDARD',
      },
    });
    assert.equal(decision.status, 'READY_FOR_APPROVAL');
    assert.equal(decision.coverage?.appliedCoverageMinorUnits, 90_000n);
  });
});

describe('ACCESS-14 provider webhook normalization', () => {
  it('rejects duplicate webhook deliveries idempotently', () => {
    const normalizer = new ProviderWebhookNormalizer();
    const raw = {
      providerId: 'turo' as const,
      providerEventId: 'evt_1',
      providerKind: 'vehicle_pickup',
      payloadSummary: 'simulation',
      providerTimestamp: '2026-08-23T12:00:00.000Z',
      signature: null,
      idempotencyKey: 'wh_1',
      receivedAt: '2026-08-23T12:00:00.000Z',
      simulationOnly: true as const,
    };
    const first = normalizer.normalize(raw, () => true);
    assert.equal('webhookEventId' in first, true);
    const second = normalizer.normalize(raw, () => true);
    assert.equal('duplicate' in second, true);
  });
});

describe('ACCESS-14 permanent invariants', () => {
  it('declares all ACCESS-14 invariant ids', () => {
    assert.equal(ACCESS_PROVIDER_INVARIANT_IDS.length, 23);
  });
});
