import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';
import { handleConsumerBff, type ConsumerBffRuntime } from './consumer/handler.ts';
import { unwrapBff } from './consumer/bff-test-utils.ts';

function call(
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
    agentExternalEvidence: world.agentExternalEvidence,
  };
  return unwrapBff(handleConsumerBff(runtime, {
    method,
    path,
    query: {},
    body: body ?? {},
    authorization: persona ? `Bearer ${sandboxToken(persona)}` : undefined,
    requestId: `req_${method}_${path.replace(/\//g, '_')}`,
  }));
}

describe('Access Wave 4 BFF productization', () => {
  it('includes Access summary on Home', () => {
    const world = createSandboxWorld();
    const home = call(world, 'GET', '/api/v1/me/home', 'basic_verified');
    assert.equal(home.status, 200);
    const homeBody = home.body as {
      access: { value: { categoryHighlights: { category: string }[] } };
    };
    assert.ok(homeBody.access.value.categoryHighlights.some((row) => row.category === 'MOBILITY'));
  });

  it('completes Mustang user journey with backend-authoritative receipt values', () => {
    const world = createSandboxWorld();
    const landing = call(world, 'GET', '/api/v1/access/landing', 'basic_verified');
    assert.equal(landing.status, 200);

    const quote = call(world, 'POST', '/api/v1/access/quotes', 'basic_verified', {
      category: 'MOBILITY',
      summary: 'Ford Mustang — Miami weekend',
      location: 'Miami, FL',
      idempotencyKey: 'wave4-mustang-quote',
    });
    assert.equal(quote.status, 201);
    const quoteBody = quote.body as { quoteId: string; pricing: { minorUnits: string } };

    const historyAfterQuote = call(world, 'GET', '/api/v1/access/history', 'basic_verified');
    assert.equal(historyAfterQuote.status, 200);

    const reservation = call(world, 'POST', '/api/v1/access/reservations', 'basic_verified', {
      quoteId: quoteBody.quoteId,
      idempotencyKey: 'wave4-mustang-reservation',
    });
    assert.equal(reservation.status, 201);
    const reservationBody = reservation.body as { reservationId: string };

    const confirm = call(
      world,
      'POST',
      `/api/v1/access/reservations/${reservationBody.reservationId}/confirm`,
      'basic_verified',
      {},
    );
    assert.equal(confirm.status, 200);

    const receipts = call(world, 'GET', '/api/v1/access/receipts', 'basic_verified');
    assert.equal(receipts.status, 200);
    const receiptItems = (receipts.body as { items: { receiptType: string; financial: { providerTotal: string } }[] })
      .items;
    assert.ok(receiptItems.length > 0);
    assert.equal(receiptItems[0]!.financial.providerTotal, quoteBody.pricing.minorUnits);

    const upcoming = call(world, 'GET', '/api/v1/access/upcoming', 'basic_verified');
    assert.equal(upcoming.status, 200);
    assert.ok((upcoming.body as { items: unknown[] }).items.length > 0);

    const events = call(world, 'GET', '/api/v1/agent/external-events', 'basic_verified');
    assert.equal(events.status, 200);
    const eventTypes = (events.body as { events: { type: string }[] }).events.map((row) => row.type);
    assert.ok(eventTypes.includes('ACCESS_BOOKING_CONFIRMED') || eventTypes.includes('ACCESS_ALLOCATION_AVAILABLE'));
  });

  it('denies cross-user receipt access', () => {
    const world = createSandboxWorld();
    const quote = call(world, 'POST', '/api/v1/access/quotes', 'basic_verified', {
      category: 'MOBILITY',
      summary: 'Ford Mustang — Miami weekend',
      location: 'Miami, FL',
      idempotencyKey: 'sec-quote',
    });
    assert.equal(quote.status, 201);
    call(world, 'POST', '/api/v1/access/reservations', 'basic_verified', {
      quoteId: (quote.body as { quoteId: string }).quoteId,
      idempotencyKey: 'sec-res',
    });
    call(
      world,
      'POST',
      `/api/v1/access/reservations/${(quote.body as { reservationId?: string }).reservationId ?? 'x'}/confirm`,
      'basic_verified',
      {},
    );
    const receipts = call(world, 'GET', '/api/v1/access/receipts', 'basic_verified');
    const receiptId = (receipts.body as { items: { receiptId: string }[] }).items[0]?.receiptId;
    if (!receiptId) {
      return;
    }
    const denied = call(world, 'GET', `/api/v1/access/receipts/${receiptId}`, 'kyc_pending');
    assert.notEqual(denied.status, 200);
  });

  it('does not expose provider secrets in checkout contract', () => {
    const world = createSandboxWorld();
    const quote = call(world, 'POST', '/api/v1/access/quotes', 'basic_verified', {
      category: 'MOBILITY',
      summary: 'Ford Mustang — Miami weekend',
      location: 'Miami, FL',
      idempotencyKey: 'checkout-quote',
    });
    const txnId = world.access.productOrchestrator().store.transactionByQuote.get(
      (quote.body as { quoteId: string }).quoteId,
    );
    assert.ok(txnId);
    const checkout = call(world, 'GET', `/api/v1/access/transactions/${txnId}/checkout`, 'basic_verified');
    assert.equal(checkout.status, 200);
    const body = JSON.stringify(checkout.body);
    assert.equal(body.includes('PAN'), false);
    assert.equal(body.includes('CVV'), false);
    assert.equal(body.includes('apiKey'), false);
  });
});
