import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  BFF_PAYMENT_STATUSES,
  RECIPIENT_DESTINATION_TYPES,
  createSunReyConsumerBffClient,
  CONSUMER_ACTIVITY_STATUSES,
  FINANCIAL_ACCOUNT_LIFECYCLES,
  FINANCIAL_PRODUCT_TYPES,
  GROW_PLAN_STATUSES,
  GROW_PROPOSAL_STATUSES,
  WALLET_STATUSES,
  CLIENT_FINALITY_STATES,
} from './consumer-bff/index.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('consumer BFF grow SDK', () => {
  it('calls Grow profile and goal routes', async () => {
    const urls: string[] = [];
    const client = createSunReyConsumerBffClient({
      baseUrl: 'http://example.test',
      getAccessToken: () => 'sandbox.grow_healthy_saver',
      generateRequestId: () => 'req_grow',
      fetchImpl: async (input, init) => {
        const url = typeof input === 'string' ? input : String(input);
        urls.push(`${init?.method ?? 'GET'} ${url}`);
        return new Response(
          JSON.stringify({
            schema: 'sunrey.grow.profile.v1',
            authoritativeBalance: false,
            ledgerWins: true,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const profile = await client.getGrowProfile();
    assert.equal(profile.schema, 'sunrey.grow.profile.v1');
    await client.createGrowGoal({
      goalKind: 'TRAVEL',
      name: 'Trip',
      targetMinorUnits: '1000',
      currency: 'USD',
    });
    assert.ok(urls.some((row) => row.includes('/api/v1/grow/profile')));
    assert.ok(urls.some((row) => row.startsWith('POST ') && row.includes('/api/v1/grow/goals')));
  });
});

describe('consumer BFF payments SDK', () => {
  it('exposes typed payment and recipient statuses', () => {
    assert.ok(BFF_PAYMENT_STATUSES.includes('SETTLED'));
    assert.ok(BFF_PAYMENT_STATUSES.includes('AWAITING_STEP_UP_AUTH'));
    assert.ok(RECIPIENT_DESTINATION_TYPES.includes('SUNREY_USER'));
  });

  it('calls Consumer BFF payment routes without privileged imports', async () => {
    const calls: Array<{ url: string; method: string; idempotency?: string | null }> = [];
    const client = createSunReyConsumerBffClient({
      baseUrl: 'http://example.test',
      getAccessToken: () => 'sandbox.basic_verified',
      generateRequestId: () => 'req_pay',
      fetchImpl: async (input, init) => {
        const url = typeof input === 'string' ? input : String(input);
        const headers = new Headers(init?.headers);
        calls.push({
          url,
          method: init?.method ?? 'GET',
          idempotency: headers.get('idempotency-key'),
        });
        if (url.endsWith('/api/v1/payments/quote')) {
          return new Response(
            JSON.stringify({
              quoteId: 'pq_1',
              settlementTimePromise: null,
              productionMoneyMovement: false,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({ paymentId: 'pay_1', status: 'SETTLED', productionMoneyMovement: false }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const quote = await client.quotePayment({
      sourceAccountId: 'acct_1',
      amountMinorUnits: '1000',
      currency: 'USD',
    });
    assert.equal(quote.quoteId, 'pq_1');
    assert.equal(quote.settlementTimePromise, null);
    const payment = await client.createPayment(
      {
        sourceAccountId: 'acct_1',
        amountMinorUnits: '1000',
        currency: 'USD',
        quoteId: quote.quoteId,
      },
      { idempotencyKey: 'pay_sdk_1' },
    );
    assert.equal(payment.status, 'SETTLED');
    assert.equal(calls[1]?.idempotency, 'pay_sdk_1');
    assert.equal(calls[0]?.url, 'http://example.test/api/v1/payments/quote');
  });

  it('reads Grow My Money portfolio views without execution methods', async () => {
    const calls: string[] = [];
    const client = createSunReyConsumerBffClient({
      baseUrl: 'http://example.test',
      getAccessToken: () => 'sandbox.investment',
      generateRequestId: () => 'req_grow',
      fetchImpl: async (input, init) => {
        const url = typeof input === 'string' ? input : String(input);
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        return new Response(
          JSON.stringify({
            schema: 'sunrey.grow.portfolio.v1',
            frontendMathAuthoritative: false,
            liveState: false,
            securitiesBrokerageLive: false,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const portfolio = await client.getGrowPortfolio();
    assert.equal(portfolio.frontendMathAuthoritative, false);
    assert.equal(portfolio.liveState, false);
    await client.getGrowHoldings();
    await client.getGrowPerformance();
    await client.getGrowAllocation();
    await client.getGrowRisk();
    assert.deepEqual(calls, [
      'GET http://example.test/api/v1/grow/portfolio',
      'GET http://example.test/api/v1/grow/portfolio/holdings',
      'GET http://example.test/api/v1/grow/portfolio/performance',
      'GET http://example.test/api/v1/grow/portfolio/allocation',
      'GET http://example.test/api/v1/grow/portfolio/risk',
    ]);
    assert.equal('submitGrowOrder' in client, false);
  });

  it('calls Grow opportunity routes without privileged imports', async () => {
    const client = createSunReyConsumerBffClient({
      baseUrl: 'http://example.test',
      getAccessToken: () => 'sandbox.grow',
      fetchImpl: async (input) => {
        const url = typeof input === 'string' ? input : String(input);
        if (url.endsWith('/api/v1/grow/opportunities')) {
          return new Response(
            JSON.stringify({
              schema: 'sunrey.consumer.grow.opportunities.v1',
              productionMoneyMovement: false,
              items: [],
              suppressedCount: 0,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({
            opportunityId: 'gop_1',
            proposalId: 'gpr_1',
            status: 'ACCEPTED_FOR_PROPOSAL',
            executesMoney: false,
            issuesExecutionAuthority: false,
            productionMoneyMovement: false,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const feed = await client.listGrowOpportunities();
    assert.equal(feed.productionMoneyMovement, false);
    const started = await client.startGrowProposal('gop_1');
    assert.equal(started.executesMoney, false);
  });
});

describe('consumer BFF exchange SDK', () => {
  it('calls Exchange market, preview, and proposal-required order routes', async () => {
    const urls: string[] = [];
    const client = createSunReyConsumerBffClient({
      baseUrl: 'http://example.test',
      getAccessToken: () => 'sandbox.exchange',
      fetchImpl: async (input, init) => {
        const url = typeof input === 'string' ? input : String(input);
        urls.push(`${init?.method ?? 'GET'} ${url}`);
        return new Response(
          JSON.stringify({
            productionTradingEnabled: false,
            guaranteedExecutionPrice: false,
            requiresExecution: true,
            items: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const markets = await client.listExchangeMarkets();
    assert.equal(markets.productionTradingEnabled, false);
    await client.getExchangeTicker('SUNREY_COIN-USD');
    const preview = await client.previewExchangeOrder({
      marketId: 'market:sunrey-coin-usd-simulation',
      instrument: 'SUNREY_COIN-USD',
      side: 'BUY',
      quantity: '1',
    });
    assert.equal(preview.guaranteedExecutionPrice, false);
    const submitted = await client.submitExchangeOrder({
      marketId: 'market:sunrey-coin-usd-simulation',
      side: 'BUY',
      quantity: '1',
      proposalId: 'prop_1',
    });
    assert.equal(submitted.requiresExecution, true);
    await client.listExchangeFills();
    await client.listExchangeHoldings();
    assert.ok(urls.some((row) => row.includes('/api/v1/exchange/markets')));
    assert.ok(urls.some((row) => row.startsWith('POST ') && row.includes('/api/v1/exchange/preview')));
    assert.ok(urls.some((row) => row.startsWith('POST ') && row.includes('/api/v1/exchange/orders')));
  });
});

describe('consumer BFF grow SDK', () => {
  it('exposes grow statuses and calls grow routes', async () => {
    assert.ok(GROW_PLAN_STATUSES.includes('PROPOSED'));
    assert.ok(GROW_PROPOSAL_STATUSES.includes('AWAITING_STEP_UP'));
    const client = createSunReyConsumerBffClient({
      baseUrl: 'http://example.test',
      getAccessToken: () => 'sandbox.basic_verified',
      fetchImpl: async (input) => {
        const url = typeof input === 'string' ? input : String(input);
        if (url.endsWith('/api/v1/grow/plans')) {
          return new Response(
            JSON.stringify({
              planId: 'gmp_1',
              status: 'PROPOSED',
              guaranteedOutcome: false,
              productionActive: false,
              primaryProposal: { proposalId: 'fpr_1' },
            }),
            { status: 201, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({
            proposalId: 'fpr_1',
            status: 'APPROVED',
            guaranteedOutcome: false,
            executionAuthorityId: null,
            serverIssued: true,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const plan = await client.createGrowPlan({
      startingCapitalMinorUnits: '1000000',
      currency: 'USD',
      timeHorizonMonths: 12,
      riskProfile: 'BALANCED',
    });
    assert.equal(plan.guaranteedOutcome, false);
    const approved = await client.approveGrowProposal('fpr_1', { stepUpSatisfied: true });
    assert.equal(approved.executionAuthorityId, null);
  });
});

describe('consumer BFF wallets SDK', () => {
  it('exposes wallet vocabularies and calls wallet routes', async () => {
    assert.ok(WALLET_STATUSES.includes('ACTIVE'));
    assert.ok(CLIENT_FINALITY_STATES.includes('FINALIZED'));
    const urls: string[] = [];
    const client = createSunReyConsumerBffClient({
      baseUrl: 'http://example.test',
      getAccessToken: () => 'sandbox.basic_verified',
      generateRequestId: () => 'req_wal',
      fetchImpl: async (input, init) => {
        const url = typeof input === 'string' ? input : String(input);
        urls.push(`${init?.method ?? 'GET'} ${url}`);
        return new Response(
          JSON.stringify({
            schema: 'sunrey.consumer.wallet.v1',
            productionSigningAuthorized: false,
            items: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    await client.listWallets();
    await client.getDepositAddress('wal_1');
    await client.quoteWithdrawal('wal_1', { destination: 'sr1peer', amountMinorUnits: '1' });
    await client.getAssetDetail('SUNREY_COIN');
    assert.ok(urls.some((row) => row.includes('/api/v1/wallets')));
    assert.ok(urls.some((row) => row.includes('/deposit-address')));
    assert.ok(urls.some((row) => row.includes('/withdrawal-quote')));
    assert.ok(urls.some((row) => row.includes('/api/v1/assets/SUNREY_COIN')));
  });
});

describe('consumer BFF SDK models', () => {
  it('exposes typed account, balance, and activity vocabularies', () => {
    assert.ok(FINANCIAL_ACCOUNT_LIFECYCLES.includes('ACTIVE'));
    assert.ok(FINANCIAL_ACCOUNT_LIFECYCLES.includes('RESTRICTED'));
    assert.ok(FINANCIAL_PRODUCT_TYPES.includes('CHECKING_PAYMENT'));
    assert.ok(CONSUMER_ACTIVITY_STATUSES.includes('PENDING'));
    assert.ok(CONSUMER_ACTIVITY_STATUSES.includes('COMPLETED'));
    assert.equal(CONSUMER_ACTIVITY_STATUSES.includes('DONE' as never), false);
  });
});

describe('consumer BFF native economy SDK', () => {
  it('calls read-only economy supply routes', async () => {
    const urls: string[] = [];
    const client = createSunReyConsumerBffClient({
      baseUrl: 'http://example.test',
      getAccessToken: () => 'sandbox.basic_verified',
      generateRequestId: () => 'req_econ',
      fetchImpl: async (input, init) => {
        const url = typeof input === 'string' ? input : String(input);
        urls.push(`${init?.method ?? 'GET'} ${url}`);
        return new Response(
          JSON.stringify({
            schema: 'sunrey.consumer.native-economy.v1',
            tickerStatus: 'NOT_ASSIGNED',
            productionActive: false,
            privilegedIssuanceEndpoints: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const overview = await client.getNativeEconomy();
    await client.getNativeSupply();
    await client.getNativeAsset('SUNREY_COIN');
    assert.equal(overview.schema, 'sunrey.consumer.native-economy.v1');
    assert.ok(urls.some((row) => row.includes('/api/v1/economy/supply')));
    assert.ok(urls.every((row) => row.startsWith('GET ')));
  });
});

describe('consumer BFF SDK browser boundary', () => {
  it('does not import privileged or Node-only modules', () => {
    const dir = join(here, 'consumer-bff');
    const files = readdirSync(dir).filter((name) => name.endsWith('.ts'));
    assert.ok(files.includes('index.ts'));
    const forbidden = [
      'node:http',
      'node:fs',
      'node:net',
      'node:crypto',
      '../gateway/server',
      '../developer-platform',
      '../signer',
      '../../ledger',
      '../../kernel',
      '../../permissions/src/execution-authority',
      '../../persistence',
      'createSimulationKeyProvider',
      'AuthorityIssuer',
      'postJournal',
      'import { ExecutionAuthority',
      'import type { ExecutionAuthority',
      'verifyExecutionAuthority',
      'import type { ExecutionAuthority',
      'export type ExecutionAuthority',
    ];
    for (const file of files) {
      const source = readFileSync(join(dir, file), 'utf8');
      for (const needle of forbidden) {
        assert.equal(source.includes(needle), false, `${file} leaked ${needle}`);
      }
      assert.equal(/import[\s\S]*ExecutionAuthority/.test(source), false, `${file} imported ExecutionAuthority`);
    }
  });
});
