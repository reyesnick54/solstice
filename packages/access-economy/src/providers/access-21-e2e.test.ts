import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  AccessProviderGateway,
  EXPEDIA_PROVIDER_CONTRACT,
  EXPEDIA_PRODUCTION_GATE_REQUIREMENTS,
  ExpediaWebhookVerifier,
  InMemoryFundingIntentPort,
  InMemoryProviderAuditPort,
  ProviderEconomicMetrics,
  ProviderWebhookNormalizer,
  RedemptionWorkflow,
  ScriptedExpediaSandboxTransport,
  createSandboxExpediaProvider,
  evaluateRedemption,
  expediaProductionGateChecklist,
} from './index.ts';
import { EXPEDIA_CREDENTIAL_REFS } from './adapters/expedia/credentials.ts';
import type { ProviderCredentialPort } from './security.ts';
import { ACCESS_PROVIDER_INVARIANT_IDS } from './redemption/invariants.ts';

class TestCredentialPort implements ProviderCredentialPort {
  private readonly apiKey: string | null;
  private readonly sharedSecret: string | null;
  private readonly webhookKey: string | null;

  constructor(apiKey: string | null, sharedSecret: string | null, webhookKey: string | null) {
    this.apiKey = apiKey;
    this.sharedSecret = sharedSecret;
    this.webhookKey = webhookKey;
  }

  async getCredential(ref: { readonly secretRef: string }): Promise<string | null> {
    if (ref.secretRef === EXPEDIA_CREDENTIAL_REFS.API_KEY.secretRef) {
      return this.apiKey;
    }
    if (ref.secretRef === EXPEDIA_CREDENTIAL_REFS.SHARED_SECRET.secretRef) {
      return this.sharedSecret;
    }
    if (ref.secretRef === EXPEDIA_CREDENTIAL_REFS.WEBHOOK_SIGNING_KEY.secretRef) {
      return this.webhookKey;
    }
    return null;
  }

  async rotateCredential(): Promise<void> {
    return;
  }
}

describe('ACCESS-21 Expedia sandbox capability state', () => {
  it('registers Expedia as SANDBOX_AVAILABLE without live enablement', () => {
    const gateway = new AccessProviderGateway();
    const expedia = gateway.listProviders().find((row) => row.providerId === 'expedia');
    assert.equal(expedia?.integrationState, 'SANDBOX_AVAILABLE');
    assert.equal(gateway.registry.isLiveEnabled('expedia'), false);
    assert.equal(EXPEDIA_PROVIDER_CONTRACT.liveConnectivity, false);
    assert.equal(EXPEDIA_PROVIDER_CONTRACT.sandboxConnectivity, true);
  });

  it('does not enable live connectivity from credentials alone', async () => {
    const credentials = new TestCredentialPort('sandbox-api-key', 'sandbox-shared-secret', 'whsec_test');
    const provider = createSandboxExpediaProvider({ credentials });
    assert.equal(provider.integrationState, 'SANDBOX_AVAILABLE');
    assert.equal(gatewayLiveEnabled(), false);
    const checklist = expediaProductionGateChecklist();
    assert.equal(checklist.liveEnabled, false);
    assert.equal(checklist.requirements.every((row) => row.satisfied === false), true);
    assert.equal(EXPEDIA_PRODUCTION_GATE_REQUIREMENTS.length, 10);
  });
});

describe('ACCESS-21 Case — Rome lodging sandbox E2E', () => {
  it('runs search → quote → coverage → reservation → booking → cancellation → evidence', async () => {
    const transport = new ScriptedExpediaSandboxTransport();
    const audit = new InMemoryProviderAuditPort();
    const metrics = new ProviderEconomicMetrics();
    const expedia = createSandboxExpediaProvider({ transport, audit });
    const gateway = new AccessProviderGateway({ providers: { expedia } });

    const search = gateway.search({
      requestId: 'access21_search',
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
    assert.equal(search.value.sandboxOnly, true);
    assert.equal(search.value.simulationOnly, false);
    const item = search.value.items[0]!;
    metrics.recordAvailability('expedia', true);

    const availability = gateway.availability({
      requestId: 'access21_avail',
      providerId: 'expedia',
      catalogItemId: item.catalogItemId,
      quantity: 5n,
      startsAt: '2026-09-01T15:00:00.000Z',
      endsAt: '2026-09-06T11:00:00.000Z',
      location: 'Rome, IT',
    });
    assert.equal(availability.ok, true);
    if (!availability.ok) {
      return;
    }
    assert.equal(availability.value.available, true);
    assert.equal(availability.value.sandboxOnly, true);

    const quote = gateway.quote({
      requestId: 'access21_quote',
      providerId: 'expedia',
      catalogItemId: item.catalogItemId,
      quantity: 5n,
      startsAt: '2026-09-01T15:00:00.000Z',
      endsAt: '2026-09-06T11:00:00.000Z',
      location: 'Rome, IT',
      idempotencyKey: 'access21_quote_key',
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) {
      return;
    }
    metrics.recordQuote('expedia', true, quote.value.providerPriceMinorUnits);
    assert.equal(quote.value.providerPriceMinorUnits, 90_000n);
    assert.equal(quote.value.sandboxOnly, true);
    assert.ok(quote.value.providerRateToken);

    const decision = evaluateRedemption({
      redemptionId: 'red_access21',
      subjectRef: 'cust_access21',
      intentId: null,
      category: 'STAY',
      providerId: 'expedia',
      providerQuote: quote.value,
      entitlement: {
        entitlementId: 'ent_stay_access21',
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

    const fundingPort = new InMemoryFundingIntentPort();
    const workflow = new RedemptionWorkflow(gateway, { funding: fundingPort });
    workflow.entitlements.seed('ent_stay_access21', 'cust_access21', 5n);
    const started = workflow.start(
      {
        redemptionId: 'red_access21',
        subjectRef: 'cust_access21',
        intentId: null,
        category: 'STAY',
        providerId: 'expedia',
        providerQuote: quote.value,
        entitlement: {
          entitlementId: 'ent_stay_access21',
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
      },
      'access21_start',
    );
    assert.equal(started.ok, true);
    const confirmed = workflow.confirm('red_access21');
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) {
      return;
    }
    metrics.recordBooking('expedia', true);
    assert.equal(confirmed.value.status, 'REDEEMED');
    assert.equal(confirmed.value.rightKind, 'OCCUPANCY_RIGHT');
    assert.ok(confirmed.value.accessRightRef);

    const cancelled = gateway.cancel({
      requestId: 'access21_cancel',
      providerId: 'expedia',
      bookingId: confirmed.value.providerBookingId!,
      reason: 'user_request',
      idempotencyKey: 'access21_cancel_key',
    });
    assert.equal(cancelled.ok, true);
    if (cancelled.ok) {
      metrics.recordCancellation('expedia');
      assert.equal(cancelled.value.state, 'CANCELLED');
      assert.equal(cancelled.value.sandboxOnly, true);
    }

    const normalizer = new ProviderWebhookNormalizer();
    const webhookKey = 'whsec_access21';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const payload = '{"kind":"booking_confirmed","booking_id":"pbk_access21"}';
    const signature = `sha256=${createHash('sha256').update(`${timestamp}.${payload}`, 'utf8').update(webhookKey, 'utf8').digest('hex')}`;
    const verifier = new ExpediaWebhookVerifier(new TestCredentialPort(null, null, webhookKey));
    const verified = await verifier.verify({
      payload,
      headers: Object.freeze({
        signature,
        timestamp,
        eventId: 'evt_access21',
      }),
    });
    assert.equal(verified.verified, true);

    const normalized = normalizer.normalize(
      {
        providerId: 'expedia',
        providerEventId: 'evt_access21',
        providerKind: 'booking_confirmed',
        payloadSummary: payload,
        providerTimestamp: new Date().toISOString(),
        signature,
        idempotencyKey: 'wh_access21',
        receivedAt: new Date().toISOString(),
        simulationOnly: false,
        sandboxOnly: true,
      },
      () => verified.verified,
    );
    assert.equal('webhookEventId' in normalized, true);
    metrics.recordFulfillment('expedia');

    assert.ok(audit.list().length > 0);
    const snapshot = metrics.snapshot('expedia');
    assert.equal(snapshot.quoteSuccesses, 1);
    assert.equal(snapshot.bookingSuccesses, 1);
    assert.equal(snapshot.cancellations, 1);
    assert.equal(snapshot.fulfillmentEvents, 1);
  });
});

describe('ACCESS-21 provider controls and webhook security', () => {
  it('rejects replayed webhook events', async () => {
    const webhookKey = 'whsec_replay';
    const verifier = new ExpediaWebhookVerifier(new TestCredentialPort(null, null, webhookKey));
    const timestamp = String(Math.floor(Date.now() / 1000));
    const payload = '{"kind":"booking_cancelled"}';
    const signature = `sha256=${createHash('sha256').update(`${timestamp}.${payload}`, 'utf8').update(webhookKey, 'utf8').digest('hex')}`;
    const headers = Object.freeze({ signature, timestamp, eventId: 'evt_replay' });
    const first = await verifier.verify({ payload, headers });
    const second = await verifier.verify({ payload, headers });
    assert.equal(first.verified, true);
    assert.equal(second.verified, false);
  });

  it('fails closed on unknown webhook events', () => {
    const normalizer = new ProviderWebhookNormalizer();
    const result = normalizer.normalize(
      {
        providerId: 'expedia',
        providerEventId: 'evt_unknown',
        providerKind: 'not_a_real_kind',
        payloadSummary: '{}',
        providerTimestamp: null,
        signature: 'sig',
        idempotencyKey: 'wh_unknown',
        receivedAt: new Date().toISOString(),
        simulationOnly: false,
        sandboxOnly: true,
      },
      () => true,
    );
    assert.equal('refused' in result, true);
  });
});

describe('ACCESS-21 permanent invariants', () => {
  it('declares ACCESS-21 invariant ids', () => {
    assert.equal(ACCESS_PROVIDER_INVARIANT_IDS.length, 23);
  });
});

function gatewayLiveEnabled(): boolean {
  const gateway = new AccessProviderGateway();
  return gateway.registry.isLiveEnabled('expedia');
}
