import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HIGH_IMPACT_ACKNOWLEDGEMENTS } from '../packages/sunrey-agent/src/conversation/index.ts';
import { createPhaseGWorld } from './phase-g-world.ts';

function qty(body: unknown): string {
  return String((body as { quantity?: string }).quantity ?? '');
}

describe('Phase G Exchange / wallet / coin E2E', () => {
  it('runs the sandbox BUY lifecycle through public Consumer BFF routes', () => {
    const world = createPhaseGWorld();
    const home = world.handle({ method: 'GET', path: '/api/v1/exchange' });
    assert.equal(home.status, 200);
    const homeBody = home.body as { schema: string; screens: string[]; liveExchangeEnabled: boolean };
    assert.equal(homeBody.schema, 'sunrey.consumer.exchange.home.v1');
    assert.ok(homeBody.screens.includes('ORDER_PREVIEW'));
    assert.equal(homeBody.liveExchangeEnabled, false);

    const eligibility = world.handle({ method: 'GET', path: '/api/v1/exchange/eligibility' });
    assert.equal(eligibility.status, 200);
    assert.equal((eligibility.body as { kycVerified: boolean }).kycVerified, true);

    const markets = world.handle({ method: 'GET', path: '/api/v1/exchange/markets' });
    assert.equal(markets.status, 200);
    const marketId = (markets.body as { items: Array<{ marketId: string; symbol: string }> }).items[0]?.marketId;
    assert.ok(marketId);

    const ticker = world.handle({ method: 'GET', path: `/api/v1/exchange/markets/${marketId}/ticker` });
    assert.equal(ticker.status, 200);
    const book = world.handle({ method: 'GET', path: `/api/v1/exchange/markets/${marketId}/order-book` });
    assert.equal(book.status, 200);
    const holdings = world.handle({ method: 'GET', path: '/api/v1/exchange/holdings' });
    assert.equal(holdings.status, 200);

    const funded = world.handle({ method: 'POST', path: '/api/v1/exchange/fund', body: {} });
    assert.equal(funded.status, 200);

    const preview = world.handle({
      method: 'POST',
      path: '/api/v1/exchange/preview',
      body: { side: 'BUY', quantity: '2', notionalUsdMinor: '50000' },
    });
    assert.equal(preview.status, 200);
    assert.match(String((preview.body as { humanReadableIntent: string }).humanReadableIntent), /Review before authorization/);

    const created = world.handle({
      method: 'POST',
      path: '/api/v1/exchange/proposals',
      body: { side: 'BUY', quantity: '2', notionalUsdMinor: '50000' },
    });
    assert.equal(created.status, 201);
    const proposalId = (created.body as { proposalId: string }).proposalId;
    const stepUp = world.handle({
      method: 'POST',
      path: `/api/v1/exchange/proposals/${proposalId}/approve`,
      body: { stepUpSatisfied: false },
    });
    assert.equal(stepUp.status, 403);
    assert.equal((stepUp.body as { errorCode?: string }).errorCode, 'STEP_UP_REQUIRED');

    const approved = world.handle({
      method: 'POST',
      path: `/api/v1/exchange/proposals/${proposalId}/approve`,
      body: { stepUpSatisfied: true, actor: 'HUMAN' },
    });
    assert.equal(approved.status, 200);
    assert.equal((approved.body as { executionAuthorityIssued: boolean }).executionAuthorityIssued, true);

    const submitted = world.handle({
      method: 'POST',
      path: `/api/v1/exchange/proposals/${proposalId}/submit`,
      body: { clientOrderId: 'buy-e2e-1' },
    });
    assert.equal(submitted.status, 200);
    const view = (submitted.body as { view: string }).view;
    assert.ok(['OPEN', 'PARTIALLY_FILLED', 'FILLED', 'SUBMITTED'].includes(view));

    const orders = world.handle({ method: 'GET', path: '/api/v1/exchange/orders' });
    assert.equal(orders.status, 200);
    const fills = world.handle({ method: 'GET', path: '/api/v1/exchange/fills' });
    assert.equal(fills.status, 200);
    const after = world.handle({ method: 'GET', path: '/api/v1/exchange/holdings' });
    assert.equal(after.status, 200);
  });

  it('repeats the SELL lifecycle with asset reservation and quote/asset balances', () => {
    const world = createPhaseGWorld();
    world.handle({ method: 'POST', path: '/api/v1/exchange/fund', body: {} });
    const principal = {
      actorId: 'a',
      customerId: 'cust_sandbox_basic',
      identityId: 'idn',
      sessionId: 's',
      jurisdiction: 'GB',
      verification: 'VERIFIED' as const,
      customerStatus: 'ACTIVE' as const,
      identityStatus: 'ACTIVE' as const,
      capabilities: [],
      risk: 'LOW' as const,
      restricted: false,
      sandboxPersona: 'basic_verified',
      deviceSummary: { deviceId: 'd', trustState: 'KNOWN' as const },
    };
    world.exchange.worldFor(principal).fundBase(10n);
    const again = world.handle({
      method: 'POST',
      path: '/api/v1/exchange/proposals',
      body: { side: 'SELL', quantity: '1' },
    });
    assert.equal(again.status, 201);
    const proposalId = (again.body as { proposalId: string }).proposalId;
    const approved = world.handle({
      method: 'POST',
      path: `/api/v1/exchange/proposals/${proposalId}/approve`,
      body: { stepUpSatisfied: true },
    });
    assert.equal(approved.status, 200);
    const submitted = world.handle({
      method: 'POST',
      path: `/api/v1/exchange/proposals/${proposalId}/submit`,
      body: { clientOrderId: 'sell-e2e-1' },
    });
    assert.equal(submitted.status, 200);
    const holdings = world.handle({ method: 'GET', path: '/api/v1/exchange/holdings' });
    assert.equal(holdings.status, 200);
    const items = (holdings.body as { items: Array<{ assetId: string; available: string }> }).items;
    assert.ok(items.some((row) => row.assetId === 'SUNREY_COIN'));
    assert.ok(items.some((row) => row.assetId === 'MOONREY_COIN'));
  });

  it('runs wallet deposit and withdrawal through public routes', () => {
    const world = createPhaseGWorld();
    const wallet = world.handle({ method: 'GET', path: '/api/v1/wallets' });
    assert.equal(wallet.status, 200);
    const address = world.handle({ method: 'GET', path: '/api/v1/wallets/deposit-address' });
    assert.equal(address.status, 200);
    assert.ok((address.body as { address: string }).address);

    const deposit = world.handle({
      method: 'POST',
      path: '/api/v1/wallets/deposits/simulate',
      body: { quantity: '25' },
    });
    assert.equal(deposit.status, 200);
    assert.equal((deposit.body as { credited: boolean }).credited, true);

    const quote = world.handle({
      method: 'POST',
      path: '/api/v1/wallets/withdrawals/quote',
      body: { assetId: 'SUNREY_COIN', quantity: '1', destination: 'sr1ex_external' },
    });
    assert.equal(quote.status, 200);

    const withdrawn = world.handle({
      method: 'POST',
      path: '/api/v1/wallets/withdrawals',
      body: { assetId: 'SUNREY_COIN', quantity: '1', destination: 'sr1ex_external', approved: true },
    });
    assert.equal(withdrawn.status, 200);
    const history = world.handle({ method: 'GET', path: '/api/v1/wallets/transactions' });
    assert.equal(history.status, 200);
  });

  it('covers SunRey Coin and MoonRey Coin views without unauthorized issuance', () => {
    const world = createPhaseGWorld();
    const sun = world.handle({ method: 'GET', path: '/api/v1/economy/sunrey-coin' });
    assert.equal(sun.status, 200);
    assert.equal((sun.body as { unauthorizedIssuance: boolean }).unauthorizedIssuance, false);
    const moon = world.handle({ method: 'GET', path: '/api/v1/economy/moonrey-coin' });
    assert.equal(moon.status, 200);
    assert.equal((moon.body as { testIssuanceIsNotProductionEconomics: boolean }).testIssuanceIsNotProductionEconomics, true);
    const economy = world.handle({ method: 'GET', path: '/api/v1/economy' });
    assert.equal(economy.status, 200);
    const status = world.handle({ method: 'GET', path: '/api/v1/economy/status' });
    assert.equal(status.status, 200);
    assert.equal((status.body as { marketData: string }).marketData, 'SANDBOX');
    const lifecycle = world.exchange.worldFor({
      actorId: 'a',
      customerId: 'cust_sandbox_basic',
      identityId: 'idn',
      sessionId: 's',
      jurisdiction: 'GB',
      verification: 'VERIFIED',
      customerStatus: 'ACTIVE',
      identityStatus: 'ACTIVE',
      capabilities: [],
      risk: 'LOW',
      restricted: false,
      sandboxPersona: 'basic_verified',
      deviceSummary: { deviceId: 'd', trustState: 'KNOWN' },
    });
    assert.equal(lifecycle.refuseUnauthorizedIssuance().reason, 'UNAUTHORIZED_ISSUANCE');
    const issued = lifecycle.authorizeSandboxMoonreyIssuance(5n);
    assert.equal(issued.ok, true);
    assert.equal(lifecycle.supplyInvariant().ok, true);
    void qty;
  });

  it('runs Agent Exchange proposal flow without self-approval', () => {
    const world = createPhaseGWorld();
    const started = world.handle({ method: 'POST', path: '/api/v1/agent/conversations', body: {} });
    assert.equal(started.status, 201);
    const conversationId = (started.body as { conversationId: string }).conversationId;
    const turn = world.handle({
      method: 'POST',
      path: `/api/v1/agent/conversations/${conversationId}/messages`,
      body: { text: 'Buy $500 of SunRey Coin.' },
    });
    assert.equal(turn.status, 200);
    const card = (turn.body as { card: { type: string; agentIsApprover: boolean } | null }).card;
    assert.equal(card?.type, 'EXCHANGE');
    assert.equal(card?.agentIsApprover, false);
    const actionId = (turn.body as { action: { actionId: string } }).action.actionId;
    const self = world.handle({
      method: 'POST',
      path: `/api/v1/exchange/proposals/xprp_agent/approve`,
      body: { actor: 'AGENT', stepUpSatisfied: true },
    });
    assert.ok(self.status === 403 || self.status === 401);
    const approved = world.handle({
      method: 'POST',
      path: `/api/v1/agent/actions/${actionId}/approve`,
      body: { stepUpSatisfied: true, acknowledgements: HIGH_IMPACT_ACKNOWLEDGEMENTS },
    });
    assert.equal(approved.status, 200);
    assert.equal((approved.body as { agentIsApprover: boolean }).agentIsApprover, false);

    world.handle({ method: 'POST', path: '/api/v1/exchange/fund', body: {} });
    const created = world.handle({
      method: 'POST',
      path: '/api/v1/exchange/proposals',
      body: { side: 'BUY', quantity: '2', notionalUsdMinor: '50000', origin: 'AGENT' },
    });
    assert.equal(created.status, 201);
    const exchangeProposalId = (created.body as { proposalId: string }).proposalId;
    const agentApprove = world.handle({
      method: 'POST',
      path: `/api/v1/exchange/proposals/${exchangeProposalId}/approve`,
      body: { actor: 'AGENT', stepUpSatisfied: true },
    });
    assert.equal(agentApprove.status, 403);
    const humanApprove = world.handle({
      method: 'POST',
      path: `/api/v1/exchange/proposals/${exchangeProposalId}/approve`,
      body: { actor: 'HUMAN', stepUpSatisfied: true },
    });
    assert.equal(humanApprove.status, 200);
    const filled = world.handle({
      method: 'POST',
      path: `/api/v1/exchange/proposals/${exchangeProposalId}/submit`,
      body: { clientOrderId: 'agent-buy-500' },
    });
    assert.equal(filled.status, 200);
    assert.ok(['OPEN', 'PARTIALLY_FILLED', 'FILLED', 'SUBMITTED'].includes((filled.body as { view: string }).view));
  });
});
