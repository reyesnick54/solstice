import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSandboxWorld, sandboxToken } from '../services/api/src/consumer/fixtures.ts';
import { handleConsumerBff, type ConsumerBffRuntime } from '../services/api/src/consumer/handler.ts';

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
  };
  return handleConsumerBff(runtime, {
    method,
    path,
    query: {},
    body: body ?? {},
    authorization: persona ? `Bearer ${sandboxToken(persona)}` : undefined,
    requestId: `req_${method}_${path.replace(/\//g, '_')}`,
  });
}

describe('ACCESS-14 provider network BFF integration', () => {
  it('exposes provider registry with live connectivity disabled', () => {
    const world = createSandboxWorld();
    const res = call(world, 'GET', '/api/v1/access/providers', 'basic_verified');
    assert.equal(res.status, 200);
    const body = res.body as { liveProviderConnectivity: boolean; items: { providerId: string }[] };
    assert.equal(body.liveProviderConnectivity, false);
    assert.ok(body.items.some((row) => row.providerId === 'turo'));
    assert.ok(body.items.some((row) => row.providerId === 'expedia'));
  });

  it('runs Mustang redemption through provider gateway and redemption engine', () => {
    const world = createSandboxWorld();
    const entitlements = call(world, 'GET', '/api/v1/access/entitlements', 'basic_verified');
    assert.equal(entitlements.status, 200);
    const mobility = (entitlements.body as { items: { entitlementId: string; category: string }[] }).items.find(
      (row) => row.category === 'MOBILITY',
    );
    assert.ok(mobility);

    const search = call(world, 'POST', '/api/v1/access/search', 'basic_verified', {
      category: 'MOBILITY',
      query: 'Mustang Miami',
      location: 'Miami, FL',
      providerId: 'turo',
    });
    assert.equal(search.status, 200);
    const opportunityId = (search.body as { items: { opportunityId: string }[] }).items[0]!.opportunityId;
    const opportunity = call(world, 'GET', `/api/v1/access/opportunities/${opportunityId}`, 'basic_verified');
    assert.equal(opportunity.status, 200);

    const quote = call(world, 'POST', '/api/v1/access/quotes', 'basic_verified', {
      providerId: (opportunity.body as { providerId: string }).providerId,
      catalogItemId: (opportunity.body as { catalogItemId: string }).catalogItemId,
      quantity: 4,
      startsAt: '2026-08-29T10:00:00.000Z',
      endsAt: '2026-09-02T10:00:00.000Z',
      location: 'Miami, FL',
      idempotencyKey: 'bff_mustang_quote',
    });
    assert.equal(quote.status, 201);
    const quoteBody = quote.body as { quoteId: string; providerPriceMinorUnits: string };
    assert.equal(quoteBody.providerPriceMinorUnits, '36400');

    const preview = call(world, 'POST', '/api/v1/access/redemptions/preview', 'basic_verified', {
      category: 'MOBILITY',
      providerId: 'turo',
      quoteId: quoteBody.quoteId,
      entitlementId: mobility.entitlementId,
      entitlementClass: 'MOBILITY_STANDARD',
      requestedQuantity: 4,
      maxUserContributionMinorUnits: '0',
      idempotencyKey: 'bff_mustang_preview',
    });
    assert.equal(preview.status, 200);
    const previewBody = preview.body as { status: string; userContributionMinorUnits: string };
    assert.equal(previewBody.status, 'READY_FOR_APPROVAL');
    assert.equal(previewBody.userContributionMinorUnits, '0');

    const started = call(world, 'POST', '/api/v1/access/redemptions', 'basic_verified', {
      category: 'MOBILITY',
      providerId: 'turo',
      quoteId: quoteBody.quoteId,
      entitlementId: mobility.entitlementId,
      entitlementClass: 'MOBILITY_STANDARD',
      requestedQuantity: 4,
      maxUserContributionMinorUnits: '0',
      idempotencyKey: 'bff_mustang_redemption',
    });
    assert.equal(started.status, 201);
    const redemptionId = (started.body as { redemptionId: string }).redemptionId;

    const confirmed = call(world, 'POST', `/api/v1/access/redemptions/${redemptionId}/confirm`, 'basic_verified', {});
    assert.equal(confirmed.status, 200);
    const confirmedBody = confirmed.body as { status: string; rightKind: string; accessRightRef: string | null };
    assert.equal(confirmedBody.status, 'REDEEMED');
    assert.equal(confirmedBody.rightKind, 'ACCESS_RIGHT');
    assert.ok(confirmedBody.accessRightRef);
  });

  it('overview exposes Access product contract metadata', () => {
    const world = createSandboxWorld();
    const res = call(world, 'GET', '/api/v1/access/overview', 'basic_verified');
    assert.equal(res.status, 200);
    const body = res.body as {
      navigationLabel: string;
      primarySurface: string;
      primaryCta: string;
      liveProviderConnectivity: boolean;
    };
    assert.equal(body.navigationLabel, 'Access');
    assert.equal(body.primarySurface, 'YOUR_ACCESS');
    assert.equal(body.primaryCta, 'REDEEM_ACCESS');
    assert.equal(body.liveProviderConnectivity, false);
  });
});
