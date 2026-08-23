import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleConsumerBff } from './consumer/handler.ts';
import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';

function runtime(world: ReturnType<typeof createSandboxWorld>) {
  return {
    bff: world.bff,
    sessions: world.sessions,
    identity: world.runtime.identity.service,
    payments: world.payments,
    growProduct: world.grow,
  };
}

function call(
  world: ReturnType<typeof createSandboxWorld>,
  method: string,
  path: string,
  persona: Parameters<typeof sandboxToken>[0] | null,
  body: Record<string, unknown> = {},
) {
  return handleConsumerBff(runtime(world), {
    method,
    path,
    query: {},
    body,
    authorization: persona ? `Bearer ${sandboxToken(persona)}` : undefined,
  });
}

describe('Consumer BFF grow plans and proposals', () => {
  it('creates a plan, returns Lovable experience, and lists it', () => {
    const world = createSandboxWorld();
    const created = call(world, 'POST', '/api/v1/grow/plans', 'basic_verified', {
      startingCapitalMinorUnits: '1000000',
      currency: 'USD',
      timeHorizonMonths: 24,
      riskProfile: 'BALANCED',
      goalTargetMinorUnits: '1300000',
      recurringContributionMinorUnits: '5000',
      liquidityRequirementMinorUnits: '200000',
    });
    assert.equal(created.status, 201);
    const body = created.body as {
      planId: string;
      guaranteedOutcome: false;
      primaryProposal: { proposalId: string } | null;
      experience: { schema: string; guaranteedOutcome: false };
    };
    assert.equal(body.guaranteedOutcome, false);
    assert.equal(body.experience.schema, 'sunrey.lovable.grow-my-money.v1');
    assert.ok(body.primaryProposal?.proposalId.startsWith('fpr_'));
    const loaded = call(world, 'GET', `/api/v1/grow/plans/${body.planId}`, 'basic_verified');
    assert.equal(loaded.status, 200);
    const catalog = call(world, 'GET', '/api/v1/grow', 'basic_verified');
    assert.equal(catalog.status, 200);
    assert.equal((catalog.body as { productionActive: boolean }).productionActive, false);
  });

  it('denies cross-user plan reads', () => {
    const world = createSandboxWorld();
    const created = call(world, 'POST', '/api/v1/grow/plans', 'basic_verified', {
      startingCapitalMinorUnits: '500000',
      currency: 'USD',
      timeHorizonMonths: 12,
      riskProfile: 'CONSERVATIVE',
    });
    const planId = (created.body as { planId: string }).planId;
    const denied = call(world, 'GET', `/api/v1/grow/plans/${planId}`, 'investment');
    assert.equal(denied.status, 403);
  });

  it('approves with step-up and refuses fabricated proposal ids', () => {
    const world = createSandboxWorld();
    const created = call(world, 'POST', '/api/v1/grow/plans', 'basic_verified', {
      startingCapitalMinorUnits: '1000000',
      currency: 'USD',
      timeHorizonMonths: 12,
      riskProfile: 'BALANCED',
    });
    const proposalId = (created.body as { primaryProposal: { proposalId: string } }).primaryProposal.proposalId;
    const blocked = call(world, 'POST', `/api/v1/grow/proposals/${proposalId}/approve`, 'basic_verified', {});
    assert.equal(blocked.status, 401);
    assert.equal((blocked.body as { errorCode: string }).errorCode, 'STEP_UP_REQUIRED');
    const approved = call(world, 'POST', `/api/v1/grow/proposals/${proposalId}/approve`, 'basic_verified', {
      stepUpSatisfied: true,
    });
    assert.equal(approved.status, 200);
    assert.equal((approved.body as { status: string; executionAuthorityId: null }).status, 'APPROVED');
    assert.equal((approved.body as { executionAuthorityId: null }).executionAuthorityId, null);
    const fake = call(world, 'GET', '/api/v1/grow/proposals/fpr_invented', 'basic_verified');
    assert.equal(fake.status, 404);
  });

  it('modification creates a new proposal version', () => {
    const world = createSandboxWorld();
    const created = call(world, 'POST', '/api/v1/grow/plans', 'basic_verified', {
      startingCapitalMinorUnits: '800000',
      currency: 'USD',
      timeHorizonMonths: 18,
      riskProfile: 'BALANCED',
    });
    const proposalId = (created.body as { primaryProposal: { proposalId: string } }).primaryProposal.proposalId;
    call(world, 'POST', `/api/v1/grow/proposals/${proposalId}/approve`, 'basic_verified', {});
    const modified = call(world, 'POST', `/api/v1/grow/proposals/${proposalId}/modify`, 'basic_verified', {
      amountMinorUnits: '250000',
    });
    assert.equal(modified.status, 200);
    assert.notEqual((modified.body as { proposalId: string }).proposalId, proposalId);
    const previous = call(world, 'GET', `/api/v1/grow/proposals/${proposalId}`, 'basic_verified');
    assert.equal((previous.body as { status: string }).status, 'SUPERSEDED');
  });
});

function auth(persona: Parameters<typeof sandboxToken>[0]) {
  return `Bearer ${sandboxToken(persona)}`;
}

function get(
  world: ReturnType<typeof createSandboxWorld>,
  path: string,
  persona: Parameters<typeof sandboxToken>[0] | null,
  query: Record<string, string> = {},
) {
  return handleConsumerBff(
    { bff: world.bff, sessions: world.sessions, identity: world.runtime.identity.service, payments: world.payments },
    {
      method: 'GET',
      path,
      query,
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

function post(
  world: ReturnType<typeof createSandboxWorld>,
  path: string,
  persona: Parameters<typeof sandboxToken>[0],
  body: Record<string, unknown>,
) {
  return handleConsumerBff(
    { bff: world.bff, sessions: world.sessions, identity: world.runtime.identity.service, payments: world.payments },
    {
      method: 'POST',
      path,
      query: {},
      body,
      authorization: auth(persona),
      requestId: 'req_grow',
    },
  );
}

describe('Consumer BFF Grow / PEG', () => {
  it('renders a financial profile for a grow sandbox persona', () => {
    const world = createSandboxWorld();
    const res = get(world, '/api/v1/grow/profile', 'grow_healthy_saver');
    assert.equal(res.status, 200);
    const body = res.body as { schema: string; authoritativeBalance: boolean; cash: unknown[] };
    assert.equal(body.schema, 'sunrey.grow.profile.v1');
    assert.equal(body.authoritativeBalance, false);
    assert.ok(body.cash.length >= 1);
  });

  it('returns a snapshot without a cross-currency total', () => {
    const world = createSandboxWorld();
    const res = get(world, '/api/v1/grow/snapshot', 'grow_multi_currency');
    assert.equal(res.status, 200);
    const body = res.body as { crossCurrencyTotal: null; ledgerWins: true; cash: { amount: { currency: string } }[] };
    assert.equal(body.crossCurrencyTotal, null);
    assert.equal(body.ledgerWins, true);
    const currencies = new Set(body.cash.map((row) => row.amount.currency));
    assert.ok(currencies.has('USD'));
    assert.ok(currencies.has('SAR'));
    const valued = get(world, '/api/v1/grow/snapshot', 'grow_multi_currency', { valuationCurrency: 'USD' });
    assert.equal(valued.status, 200);
    const valuedBody = valued.body as {
      crossCurrencyTotal: null;
      presentationValuation: { authority: string; targetCurrency: string; lines: { rateTimestamp: string }[] } | null;
    };
    assert.equal(valuedBody.crossCurrencyTotal, null);
    assert.equal(valuedBody.presentationValuation?.authority, 'PRESENTATION_ONLY_NOT_LEDGER');
    assert.equal(valuedBody.presentationValuation?.targetCurrency, 'USD');
    assert.ok((valuedBody.presentationValuation?.lines.length ?? 0) >= 1);
    assert.ok(valuedBody.presentationValuation?.lines.every((line) => typeof line.rateTimestamp === 'string'));
  });

  it('creates a goal and lists it', () => {
    const world = createSandboxWorld();
    const created = post(world, '/api/v1/grow/goals', 'grow_new_user', {
      goalKind: 'TRAVEL',
      name: 'Trip',
      targetMinorUnits: '800000',
      currency: 'USD',
      priority: 3,
    });
    assert.equal(created.status, 201);
    const listed = get(world, '/api/v1/grow/goals', 'grow_new_user');
    assert.equal(listed.status, 200);
    const items = (listed.body as { items: { name: string }[] }).items;
    assert.ok(items.some((item) => item.name === 'Trip'));
  });

  it('refuses an authoritative balance override', () => {
    const world = createSandboxWorld();
    const res = post(world, '/api/v1/grow/assumptions', 'grow_healthy_saver', {
      kind: 'BALANCE_OVERRIDE',
      accountId: 'acct_peg_saver',
      minorUnits: '1',
      currency: 'USD',
    });
    assert.equal(res.status, 403);
    assert.equal((res.body as { errorCode: string }).errorCode, 'FORBIDDEN_PROFILE_FIELD');
  });

  it('does not give an Agent every PEG category automatically', () => {
    const world = createSandboxWorld();
    const res = get(world, '/api/v1/grow/agent', 'grow_healthy_saver');
    assert.equal(res.status, 403);
  });

  it('lists derived insights for idle cash', () => {
    const world = createSandboxWorld();
    const res = get(world, '/api/v1/grow/insights', 'grow_high_idle_cash');
    assert.equal(res.status, 200);
    const items = (res.body as { items: { type: string }[] }).items;
    assert.ok(items.some((item) => item.type === 'HIGH_IDLE_CASH'));
  });
});
