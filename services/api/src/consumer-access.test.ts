import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';
import { handleConsumerBff, type ConsumerBffRuntime } from './consumer/handler.ts';

async function call(
  world: ReturnType<typeof createSandboxWorld>,
  method: string,
  path: string,
  persona: Parameters<typeof sandboxToken>[0] | null,
  body?: Record<string, unknown>,
) {
  const runtime: ConsumerBffRuntime = {
    bff: world.bff,
    sessions: world.sessions,
    identity: world.runtime.identity.service,
    access: world.access,
  };
  return await handleConsumerBff(runtime, {
    method,
    path,
    query: {},
    body: body ?? {},
    authorization: persona ? `Bearer ${sandboxToken(persona)}` : undefined,
    requestId: `req_${method}_${path.replace(/\//g, '_')}`,
  });
}

describe('Consumer BFF Human Access Economy', () => {
  it('requires authentication on access routes', async () => {
    const world = createSandboxWorld();
    const res = await call(world, 'GET', '/api/v1/access/overview', null);
    assert.equal(res.status, 401);
    assert.equal((res.body as { errorCode: string }).errorCode, 'AUTH_REQUIRED');
  });

  it('returns disabled overview for pending verification', async () => {
    const world = createSandboxWorld();
    const res = await call(world, 'GET', '/api/v1/access/overview', 'kyc_pending');
    assert.equal(res.status, 200);
    const body = res.body as {
      capability: { enabled: boolean; state: string };
      productionReady: boolean;
      productionActive: boolean;
      liveConnectivityEnabled: boolean;
      activeEntitlements: { state: string; items: unknown[] };
    };
    assert.equal(body.productionReady, false);
    assert.equal(body.productionActive, false);
    assert.equal(body.liveConnectivityEnabled, false);
    assert.equal(body.capability.enabled, false);
    assert.equal(body.capability.state, 'PENDING_VERIFICATION');
    assert.equal(body.activeEntitlements.items.length, 0);
  });

  it('exposes categories as presentation metadata', async () => {
    const world = createSandboxWorld();
    const res = await call(world, 'GET', '/api/v1/access/categories', 'basic_verified');
    assert.equal(res.status, 200);
    const body = res.body as { items: { category: string; label: string; productiveTaxonomyOwnedBy: string }[] };
    assert.ok(body.items.some((row) => row.category === 'MOBILITY' && row.label === 'Mobility'));
    assert.ok(body.items.some((row) => row.category === 'FOOD'));
    assert.equal(body.items[0]?.productiveTaxonomyOwnedBy, 'packages/sunrey-chain');
  });

  it('lists a food-access entitlement for the verified sandbox persona', async () => {
    const world = createSandboxWorld();
    const res = await call(world, 'GET', '/api/v1/access/entitlements', 'basic_verified');
    assert.equal(res.status, 200);
    const body = res.body as { items: { category: string; label: string; status: string }[] };
    const food = body.items.find((row) => row.category === 'FOOD');
    assert.ok(food);
    assert.equal(food.status, 'ACTIVE');
    assert.match(food.label, /meal/i);
  });

  it('supports Mustang in Miami reservation flow without fabricating unmatched quotes', async () => {
    const world = createSandboxWorld();
    const intent = await call(world, 'POST', '/api/v1/access/intents', 'basic_verified', {
      category: 'MOBILITY',
      summary: 'Ford Mustang — Miami weekend',
      location: 'Miami, FL',
      idempotencyKey: 'bff-mustang-intent',
    });
    assert.equal(intent.status, 201);
    const intentBody = intent.body as { intentId: string };
    const availability = await call(world, 'POST', '/api/v1/access/availability', 'basic_verified', {
      category: 'MOBILITY',
      summary: 'Ford Mustang — Miami weekend',
      location: 'Miami, FL',
      intentId: intentBody.intentId,
    });
    assert.equal(availability.status, 200);
    assert.equal((availability.body as { state: string; capacityKnown: boolean }).capacityKnown, false);
    const quote = await call(world, 'POST', '/api/v1/access/quotes', 'basic_verified', {
      category: 'MOBILITY',
      summary: 'Ford Mustang — Miami weekend',
      location: 'Miami, FL',
      intentId: intentBody.intentId,
      idempotencyKey: 'bff-mustang-quote',
    });
    assert.equal(quote.status, 201);
    assert.equal((quote.body as { pricing: { source: string } }).pricing.source, 'SIMULATION_FIXTURE');
    const reservation = await call(world, 'POST', '/api/v1/access/reservations', 'basic_verified', {
      quoteId: (quote.body as { quoteId: string }).quoteId,
      idempotencyKey: 'bff-mustang-reservation',
    });
    assert.equal(reservation.status, 201);
    const confirm = await call(
      world,
      'POST',
      `/api/v1/access/reservations/${(reservation.body as { reservationId: string }).reservationId}/confirm`,
      'basic_verified',
      {},
    );
    assert.equal(confirm.status, 200);
    assert.equal((confirm.body as { status: string }).status, 'CONFIRMED');

    const rejectedQuote = await call(world, 'POST', '/api/v1/access/quotes', 'basic_verified', {
      category: 'MOBILITY',
      summary: 'Generic sedan — Seattle',
      location: 'Seattle, WA',
      idempotencyKey: 'bff-generic-quote',
    });
    assert.equal(rejectedQuote.status, 503);
  });

  it('quotes and confirms a Japan 14-day experience', async () => {
    const world = createSandboxWorld();
    const quoted = await call(world, 'POST', '/api/v1/access/experiences/quote', 'basic_verified', {
      destination: 'Japan',
      durationDays: 14,
      idempotencyKey: 'bff-japan-exp',
    });
    assert.equal(quoted.status, 201);
    const experienceId = (quoted.body as { experienceId: string }).experienceId;
    const confirmed = await call(world, 'POST', `/api/v1/access/experiences/${experienceId}/confirm`, 'basic_verified', {});
    assert.equal(confirmed.status, 200);
    assert.equal((confirmed.body as { status: string; durationDays: number }).status, 'CONFIRMED');
    assert.equal((confirmed.body as { durationDays: number }).durationDays, 14);
  });

  it('includes access capability in /me/capabilities', async () => {
    const world = createSandboxWorld();
    const res = await call(world, 'GET', '/api/v1/me/capabilities', 'basic_verified');
    assert.equal(res.status, 200);
    const body = res.body as { accessEnabled: boolean; details: { access: { key: string; enabled: boolean } } };
    assert.equal(typeof body.accessEnabled, 'boolean');
    assert.equal(body.details.access.key, 'access');
    assert.equal(body.details.access.enabled, true);
  });
});
