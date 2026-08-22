import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleConsumerBff } from './consumer/handler.ts';
import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';

function get(
  world: ReturnType<typeof createSandboxWorld>,
  path: string,
  persona: Parameters<typeof sandboxToken>[0] | null,
) {
  return handleConsumerBff(
    { bff: world.bff, sessions: world.sessions, identity: world.runtime.identity.service, payments: world.payments },
    {
      method: 'GET',
      path,
      query: {},
      body: {},
      authorization: persona ? `Bearer ${sandboxToken(persona)}` : undefined,
    },
  );
}

describe('Consumer BFF grow portfolio', () => {
  it('requires authentication', () => {
    const world = createSandboxWorld();
    const res = get(world, '/api/v1/grow/portfolio', null);
    assert.equal(res.status, 401);
  });

  it('returns portfolio, holdings, performance, allocation, and risk for the investment persona', () => {
    const world = createSandboxWorld();
    const portfolio = get(world, '/api/v1/grow/portfolio', 'investment');
    assert.equal(portfolio.status, 200);
    const body = portfolio.body as {
      schema: string;
      frontendMathAuthoritative: boolean;
      liveState: boolean;
      total: { minorUnits: string };
    };
    assert.equal(body.schema, 'sunrey.grow.portfolio.v1');
    assert.equal(body.frontendMathAuthoritative, false);
    assert.equal(body.liveState, false);
    const holdings = get(world, '/api/v1/grow/portfolio/holdings', 'investment');
    assert.equal(holdings.status, 200);
    assert.equal((holdings.body as { frontendMathAuthoritative: boolean }).frontendMathAuthoritative, false);
    const performance = get(world, '/api/v1/grow/portfolio/performance', 'investment');
    assert.equal(performance.status, 200);
    assert.equal((performance.body as { llmAuthoritative: boolean }).llmAuthoritative, false);
    const allocation = get(world, '/api/v1/grow/portfolio/allocation', 'investment');
    assert.equal(allocation.status, 200);
    const risk = get(world, '/api/v1/grow/portfolio/risk', 'investment');
    assert.equal(risk.status, 200);
    assert.equal((risk.body as { fabricatedStatistics: boolean }).fabricatedStatistics, false);
  });

  it('denies another customer', () => {
    const world = createSandboxWorld();
    const res = get(world, '/api/v1/grow/portfolio', 'basic_verified');
    assert.ok(res.status === 404 || res.status === 403);
  });

  it('does not expose execution routes', () => {
    const world = createSandboxWorld();
    const res = handleConsumerBff(
      { bff: world.bff, sessions: world.sessions, identity: world.runtime.identity.service, payments: world.payments },
      {
        method: 'POST',
        path: '/api/v1/grow/portfolio/execute',
        query: {},
        body: {},
        authorization: `Bearer ${sandboxToken('investment')}`,
      },
    );
    assert.ok(res.status === 404 || res.status === 405);
  });
});
