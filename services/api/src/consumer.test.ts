import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isOk } from '../../../packages/domain/src/result.ts';
import { projectBankingPosition } from '../../accounts/src/available-funds.ts';
import { handleConsumerBff } from './consumer/handler.ts';
import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';
import { FINANCIAL_CACHE, cachePolicyForPath } from './consumer/cache.ts';
import { mapInternalActionStatus } from './consumer/action-status.ts';
import { encodeCursor, paginate } from './consumer/pagination.ts';
import type { Account } from '../../../packages/domain/src/account.ts';
import { unwrapBff } from './consumer/bff-test-utils.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

function auth(persona: Parameters<typeof sandboxToken>[0]) {
  return `Bearer ${sandboxToken(persona)}`;
}

function get(world: ReturnType<typeof createSandboxWorld>, path: string, persona: Parameters<typeof sandboxToken>[0] | null, query: Record<string, string> = {}) {
  return unwrapBff(handleConsumerBff(
    { bff: world.bff, sessions: world.sessions, identity: world.runtime.identity.service, payments: world.payments, agent: world.agent },
    {
      method: 'GET',
      path,
      query,
      body: {},
      authorization: persona ? auth(persona) : undefined,
    },
  ));
}

function patch(world: ReturnType<typeof createSandboxWorld>, path: string, persona: Parameters<typeof sandboxToken>[0], body: Record<string, unknown>) {
  return unwrapBff(handleConsumerBff(
    { bff: world.bff, sessions: world.sessions, identity: world.runtime.identity.service, payments: world.payments, agent: world.agent },
    {
      method: 'PATCH',
      path,
      query: {},
      body,
      authorization: auth(persona),
    },
  ));
}

describe('Consumer BFF', () => {
  it('requires authentication on Home, bootstrap, and accounts', () => {
    const world = createSandboxWorld();
    for (const path of ['/api/v1/me/home', '/api/v1/me/bootstrap', '/api/v1/accounts']) {
      const res = get(world, path, null);
      assert.equal(res.status, 401);
      assert.equal((res.body as { errorCode: string }).errorCode, 'AUTH_REQUIRED');
    }
  });

  it('rejects another customer account as RESOURCE_NOT_OWNED', () => {
    const world = createSandboxWorld();
    const res = get(world, '/api/v1/accounts/acct_sandbox_basic_usd', 'restricted');
    assert.equal(res.status, 403);
    assert.equal((res.body as { errorCode: string }).errorCode, 'RESOURCE_NOT_OWNED');
  });

  it('aggregates Home from ledger-derived account positions', () => {
    const world = createSandboxWorld();
    const res = get(world, '/api/v1/me/home', 'basic_verified');
    assert.equal(res.status, 200);
    const home = res.body as {
      schema: string;
      wealth: { state: string; value: { total: { minorUnits: string; currency: string } } | null };
      cash: { state: string; value: { minorUnits: string } | null };
      recentActivity: { state: string; value: { items: unknown[]; nextCursor: string | null; hasMore: boolean } | null };
    };
    assert.equal(home.schema, 'sunrey.consumer.home.v1');
    assert.equal(home.wealth.state, 'READY');
    assert.equal(home.wealth.value?.total.currency, 'USD');
    assert.equal(home.wealth.value?.total.minorUnits, '25000');
    assert.equal(home.cash.value?.minorUnits, '25000');
    assert.ok(home.recentActivity.value);
    assert.equal(typeof home.recentActivity.value.hasMore, 'boolean');
  });

  it('does not manufacture a blended wealth total for mixed-currency users', () => {
    const world = createSandboxWorld();
    const res = get(world, '/api/v1/me/home', 'multi_currency');
    assert.equal(res.status, 200);
    const home = res.body as {
      wealth: { state: string; value: unknown };
      cash: { state: string; value: unknown };
    };
    assert.equal(home.wealth.state, 'MIXED_CURRENCY_WITHOUT_CONVERSION');
    assert.equal(home.wealth.value, null);
    assert.equal(home.cash.value, null);
    const accounts = get(world, '/api/v1/accounts', 'multi_currency');
    const items = (accounts.body as { items: { currency: string; balance: { value: { ledger: { minorUnits: string } } | null } }[] }).items;
    assert.equal(items.length, 3);
    const usd = items.find((row) => row.currency === 'USD');
    const gbp = items.find((row) => row.currency === 'GBP');
    const sar = items.find((row) => row.currency === 'SAR');
    assert.equal(usd?.balance.value?.ledger.minorUnits, '200000');
    assert.equal(gbp?.balance.value?.ledger.minorUnits, '8000');
    assert.equal(sar?.balance.value?.ledger.minorUnits, '8000');
    const valuation = (res.body as { valuation: { state: string; value: { authority: string; ledgerAuthoritative: boolean; rateTimestamp: string | null } | null } }).valuation;
    assert.equal(valuation.value?.authority, 'PRESENTATION_ONLY_NOT_LEDGER');
    assert.equal(valuation.value?.ledgerAuthoritative, false);
    assert.ok(valuation.value?.rateTimestamp);
  });

  it('returns bootstrap with capabilities and no secrets', () => {
    const world = createSandboxWorld();
    const res = get(world, '/api/v1/me/bootstrap', 'basic_verified');
    assert.equal(res.status, 200);
    const body = res.body as {
      schema: string;
      capabilities: { paymentsEnabled: boolean; details: Record<string, { enabled: boolean }> };
      application: { environment: string; productionActivated: boolean; liveMoneyEnabled: boolean };
      profile: { value: { verification: string; identityVerification: string } };
    };
    assert.equal(body.schema, 'sunrey.consumer.bootstrap.v1');
    assert.equal(body.profile.value.identityVerification, 'VERIFIED');
    assert.equal(body.application.environment, 'simulation');
    assert.equal(body.application.productionActivated, false);
    assert.equal(body.application.liveMoneyEnabled, false);
    assert.equal(typeof body.capabilities.paymentsEnabled, 'boolean');
    const json = JSON.stringify(body);
    assert.equal(json.includes('privateKey'), false);
    assert.equal(json.includes('LIVE_PAYMENTS_ENABLED":true'), false);
  });

  it('computes capabilities server-side for restricted and KYC-pending users', () => {
    const world = createSandboxWorld();
    const restricted = get(world, '/api/v1/me/capabilities', 'restricted');
    const pending = get(world, '/api/v1/me/capabilities', 'kyc_pending');
    const verified = get(world, '/api/v1/me/capabilities', 'basic_verified');
    const r = restricted.body as { paymentsEnabled: boolean; withdrawalsEnabled: boolean; details: { payments: { state: string } } };
    const p = pending.body as { withdrawalsEnabled: boolean; details: { withdrawals: { state: string } } };
    const v = verified.body as { growEnabled: boolean; details: { grow: { state: string }; cards: { availability: string; state: string } } };
    assert.equal(r.paymentsEnabled, false);
    assert.equal(r.details.payments.state, 'USER_INELIGIBLE');
    assert.equal(p.withdrawalsEnabled, false);
    assert.equal(p.details.withdrawals.state, 'PENDING_VERIFICATION');
    assert.equal(v.growEnabled, true);
    assert.equal(v.details.grow.state, 'SIMULATION_ONLY');
    assert.equal(v.details.cards.availability, 'AVAILABLE_SIMULATION');
    assert.equal(v.details.cards.state, 'SIMULATION_ONLY');
  });

  it('reads account balances from the ledger projection, not activity sums', () => {
    const world = createSandboxWorld();
    const account = get(world, '/api/v1/accounts/acct_sandbox_basic_usd', 'basic_verified');
    const owned = world.runtime.accounts.get('acct_sandbox_basic_usd' as Account['id']);
    assert.ok(owned);
    const position = projectBankingPosition(world.runtime.ledger, owned, world.runtime.holds, world.runtime.clock.now());
    assert.equal(isOk(position), true);
    if (!isOk(position)) {
      return;
    }
    const body = account.body as { balance: { value: { ledger: { minorUnits: string } } } };
    assert.equal(body.balance.value.ledger.minorUnits, position.value.ledgerBalance.minorUnits.toString());
    const source = readFileSync(join(HERE, 'consumer/accounts-adapter.ts'), 'utf8');
    assert.match(source, /projectBankingPosition/);
    assert.equal(source.includes('reduce'), false);
  });

  it('paginates activity with items, nextCursor, and hasMore', () => {
    const items = Array.from({ length: 5 }, (_, i) => i);
    const first = paginate(items, 'test', undefined, 2);
    if ('error' in first) {
      throw new Error('cursor');
    }
    assert.equal(first.items.length, 2);
    assert.equal(first.hasMore, true);
    assert.ok(first.nextCursor);
    const second = paginate(items, 'test', first.nextCursor ?? undefined, 2);
    if ('error' in second) {
      throw new Error('cursor');
    }
    assert.equal(second.items[0], 2);
    const invalid = paginate(items, 'test', encodeCursor({ namespace: 'other', offset: 0 }), 2);
    assert.equal('error' in invalid, true);
  });

  it('represents provider-down as unavailable, never a zero balance', () => {
    const world = createSandboxWorld({ providerDown: true });
    const home = get(world, '/api/v1/me/home', 'provider_down');
    const cards = get(world, '/api/v1/cards', 'provider_down');
    const capabilities = get(world, '/api/v1/me/capabilities', 'provider_down');
    const wealth = (home.body as { wealth: { state: string; value: { total: { minorUnits: string } } | null } }).wealth;
    assert.equal(wealth.state, 'READY');
    assert.equal(wealth.value?.total.minorUnits, '7500');
    const stub = cards.body as { state: string; items: unknown[] };
    assert.equal(stub.state, 'PROVIDER_UNAVAILABLE');
    assert.equal((capabilities.body as { cardsEnabled: boolean; details: { cards: { state: string } } }).cardsEnabled, false);
    assert.equal((capabilities.body as { details: { cards: { state: string } } }).details.cards.state, 'PROVIDER_UNAVAILABLE');
  });

  it('exposes restricted user state without hiding the restriction', () => {
    const world = createSandboxWorld();
    const home = get(world, '/api/v1/me/home', 'restricted');
    const alerts = (home.body as { securityAlerts: { state: string; value: { severity: string }[] | null } }).securityAlerts;
    assert.equal(alerts.state, 'READY');
    assert.equal(alerts.value?.[0]?.severity, 'RESTRICTED');
  });

  it('rejects KYC/legal identity edits on PATCH /me', () => {
    const world = createSandboxWorld();
    const forbidden = patch(world, '/api/v1/me', 'basic_verified', { legalName: 'Ada Lovelace' });
    assert.equal(forbidden.status, 403);
    assert.equal((forbidden.body as { errorCode: string }).errorCode, 'FORBIDDEN_PROFILE_FIELD');
    const ok = patch(world, '/api/v1/me', 'basic_verified', { displayLabel: 'Ada', preferredLanguage: 'en' });
    assert.equal(ok.status, 200);
    assert.equal((ok.body as { editable: { displayLabel: string } }).editable.displayLabel, 'Ada');
  });

  it('uses one error envelope across auth, ownership, and validation failures', () => {
    const world = createSandboxWorld();
    const authFail = get(world, '/api/v1/me', null);
    const owned = get(world, '/api/v1/accounts/acct_sandbox_basic_usd', 'investment');
    const cursor = get(world, '/api/v1/accounts/acct_sandbox_basic_usd/activity', 'basic_verified', { cursor: 'not-a-cursor' });
    for (const res of [authFail, owned, cursor]) {
      const body = res.body as { errorCode: string; category: string; requestId: string; apiVersion: string };
      assert.equal(body.apiVersion, 'v1');
      assert.equal(typeof body.errorCode, 'string');
      assert.equal(typeof body.category, 'string');
      assert.equal(typeof body.requestId, 'string');
    }
  });

  it('cannot create an authoritative balance — no mutator and no activity-sum path', () => {
    const source = readFileSync(join(HERE, 'consumer/orchestrator.ts'), 'utf8');
    assert.equal(source.includes('postJournal'), false);
    assert.equal(source.includes('AuthorityIssuer'), false);
    assert.equal(/reduce\(.*minorUnits/.test(source), false);
    const world = createSandboxWorld();
    const posted = handleConsumerBff(
      { bff: world.bff, sessions: world.sessions },
      {
        method: 'POST',
        path: '/api/v1/accounts',
        query: {},
        body: { balance: '999999' },
        authorization: auth('basic_verified'),
      },
    );
    assert.ok(posted.status === 404 || posted.status === 405);
  });

  it('maps regulated Kernel states onto client action statuses without collapsing them', () => {
    assert.equal(mapInternalActionStatus('REQUIRE_MANUAL_REVIEW').status, 'AWAITING_APPROVAL');
    assert.equal(mapInternalActionStatus('HOLD').approvalRequirement, 'KERNEL_HOLD');
    assert.equal(mapInternalActionStatus('BLOCK').status, 'FAILED');
  });

  it('never caches financial responses publicly', () => {
    assert.equal(FINANCIAL_CACHE.public, false);
    assert.match(cachePolicyForPath('/api/v1/me/home').cacheControl, /no-store/);
    assert.match(cachePolicyForPath('/api/v1/me/bootstrap').cacheControl, /private/);
  });

  it('lists sandbox personas as non-production fixtures', () => {
    const world = createSandboxWorld();
    const res = get(world, '/api/v1/sandbox/personas', null);
    assert.equal(res.status, 200);
    const body = res.body as { production: boolean; label: string; items: { id: string }[] };
    assert.equal(body.production, false);
    assert.equal(body.label, 'SANDBOX_FIXTURE_NON_PRODUCTION');
    assert.ok(body.items.some((item) => item.id === 'basic_verified'));
  });

  it('quotes and executes USD→SAR without client-side FX math', () => {
    const world = createSandboxWorld();
    const currencies = get(world, '/api/v1/fx/currencies', 'multi_currency');
    assert.equal(currencies.status, 200);
    const listed = (currencies.body as { items: { code: string; liveFxAvailable: boolean }[]; liveEnabled: boolean }).items;
    assert.ok(listed.some((row) => row.code === 'SAR'));
    assert.equal((currencies.body as { liveEnabled: boolean }).liveEnabled, false);

    const created = handleConsumerBff(
      { bff: world.bff, sessions: world.sessions, identity: world.runtime.identity.service },
      {
        method: 'POST',
        path: '/api/v1/fx/quotes',
        query: {},
        body: {
          sourceAccountId: 'acct_sandbox_fx_usd',
          sourceCurrency: 'USD',
          destinationCurrency: 'SAR',
          sourceAmountMinorUnits: '100000',
          quoteId: 'q_bff_usd_sar',
        },
        authorization: auth('multi_currency'),
      },
    );
    assert.equal(created.status, 201);
    const quote = created.body as { quoteId: string; destinationAmountMinorUnits: string; requiredApproval: string; provider: { live: boolean } };
    assert.equal(quote.destinationAmountMinorUnits, '374500');
    assert.equal(quote.requiredApproval, 'CUSTOMER_CONFIRMATION');
    assert.equal(quote.provider.live, false);

    const accepted = handleConsumerBff(
      { bff: world.bff, sessions: world.sessions, identity: world.runtime.identity.service },
      {
        method: 'POST',
        path: '/api/v1/fx/quotes/q_bff_usd_sar/accept',
        query: {},
        body: { accountId: 'acct_sandbox_fx_usd' },
        authorization: auth('multi_currency'),
      },
    );
    assert.equal(accepted.status, 200);

    const executed = handleConsumerBff(
      { bff: world.bff, sessions: world.sessions, identity: world.runtime.identity.service },
      {
        method: 'POST',
        path: '/api/v1/fx/quotes/q_bff_usd_sar/execute',
        query: {},
        body: {
          sourceAccountId: 'acct_sandbox_fx_usd',
          destinationAccountId: 'acct_sandbox_fx_sar',
        },
        authorization: auth('multi_currency'),
      },
    );
    assert.equal(executed.status, 200);
    assert.equal((executed.body as { status: string }).status, 'SETTLED');
  });

  it('lists grow opportunities with structured cards and denies cross-user access', () => {
    const world = createSandboxWorld();
    const listed = get(world, '/api/v1/grow/opportunities', 'grow');
    assert.equal(listed.status, 200);
    const body = listed.body as {
      schema: string;
      productionMoneyMovement: boolean;
      items: readonly { readonly opportunityId: string; readonly achievementPromised: boolean }[];
    };
    assert.equal(body.schema, 'sunrey.consumer.grow.opportunities.v1');
    assert.equal(body.productionMoneyMovement, false);
    assert.ok(body.items.length > 0);
    assert.equal(body.items.every((item) => item.achievementPromised === false), true);
    const other = get(world, `/api/v1/grow/opportunities/${body.items[0]?.opportunityId ?? 'gop_x'}`, 'basic_verified');
    assert.equal(other.status === 403 || other.status === 404, true);
  });

  it('surfaces agent recommendation counts for the agent-enabled persona', () => {
    const world = createSandboxWorld();
    const home = get(world, '/api/v1/me/home', 'agent_enabled');
    const agent = (home.body as { agent: { value: { recommendationCount: number } | null } }).agent;
    assert.equal(agent.value?.recommendationCount, 2);
  });

  it('streams Agent conversation events and refuses raw public LLM routes', () => {
    const world = createSandboxWorld();
    const posted = handleConsumerBff(
      { bff: world.bff, sessions: world.sessions, identity: world.runtime.identity.service },
      {
        method: 'POST',
        path: '/api/v1/agent/conversations/convo_1/messages',
        query: {},
        body: { text: 'Explain my sandbox balance' },
        authorization: auth('agent_enabled'),
      },
    );
    assert.equal(posted.status, 200);
    const body = posted.body as {
      rawLlm: boolean;
      financialExecuted: boolean;
      events: { type: string; hiddenReasoning: boolean }[];
      sse: string;
    };
    assert.equal(body.rawLlm, false);
    assert.equal(body.financialExecuted, false);
    assert.equal(body.events.some((event) => event.type === 'message.started'), true);
    assert.equal(body.events.every((event) => event.hiddenReasoning === false), true);
    assert.equal(body.sse.includes('event: message.completed'), true);

    const sse = handleConsumerBff(
      { bff: world.bff, sessions: world.sessions, identity: world.runtime.identity.service },
      {
        method: 'POST',
        path: '/api/v1/agent/conversations/convo_1/messages',
        query: {},
        body: { text: 'Explain my sandbox balance' },
        authorization: auth('agent_enabled'),
        accept: 'text/event-stream',
      },
    );
    assert.equal(sse.status, 200);
    assert.equal(String(sse.headers['content-type']).startsWith('text/event-stream'), true);
    assert.equal(typeof sse.body, 'string');

    const raw = get(world, '/api/v1/llm', 'agent_enabled');
    assert.equal(raw.status, 404);
  });
});
